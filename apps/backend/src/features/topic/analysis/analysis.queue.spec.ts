import { FlowProducer, Queue } from 'bullmq';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';
import type { SourceProcessingStageService } from '../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from './analysis.config';
import { AnalysisQueue } from './analysis.queue';
import { AnalysisJobData } from './analysis.types';

jest.mock('../../source/ingestion/source-processing-stage.service', () => ({
  SourceProcessingStageService: class SourceProcessingStageService {},
}));

describe('AnalysisQueue', () => {
  const sourceId = 'source-id';
  const queue = { add: jest.fn() };
  const flowProducer = { add: jest.fn() };
  const sourceProcessingStageService = { transition: jest.fn() };
  const config = analysisConfig();
  const analysisQueue = new AnalysisQueue(
    queue as unknown as Queue<AnalysisJobData>,
    flowProducer as unknown as FlowProducer,
    config,
    sourceProcessingStageService as unknown as SourceProcessingStageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queue.add.mockResolvedValue(undefined);
    flowProducer.add.mockResolvedValue(undefined);
    sourceProcessingStageService.transition.mockResolvedValue(undefined);
  });

  it('marks topic analysis queued before publishing preparation', async () => {
    await analysisQueue.addPrepareTopicAnalysis(sourceId);

    expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.QUEUED,
    );
    expect(queue.add).toHaveBeenCalledWith(
      config.queue.jobs.prepare_topic_analysis,
      { sourceId },
      {
        jobId: `${config.queue.jobs.prepare_topic_analysis}/${sourceId}`,
      },
    );
  });

  it('adds all detection windows as children of the merge job', async () => {
    await analysisQueue.addBoundaryDetectionFlow(sourceId, [
      ['ref-1', 'ref-2'],
      ['ref-2', 'ref-3'],
    ]);

    expect(flowProducer.add).toHaveBeenCalledWith(
      {
        name: config.queue.jobs.merge_boundaries,
        queueName: config.queue.name,
        data: { sourceId },
        opts: {
          jobId: `${config.queue.jobs.merge_boundaries}/${sourceId}`,
        },
        children: [
          {
            name: config.queue.jobs.detect_boundaries,
            queueName: config.queue.name,
            data: { sourceId, window_refs: ['ref-1', 'ref-2'] },
            opts: {
              jobId: `${config.queue.jobs.detect_boundaries}/${sourceId}/0`,
              failParentOnFailure: true,
            },
          },
          {
            name: config.queue.jobs.detect_boundaries,
            queueName: config.queue.name,
            data: { sourceId, window_refs: ['ref-2', 'ref-3'] },
            opts: {
              jobId: `${config.queue.jobs.detect_boundaries}/${sourceId}/1`,
              failParentOnFailure: true,
            },
          },
        ],
      },
      {
        queuesOptions: {
          [config.queue.name]: {
            defaultJobOptions: config.queue.defaultJobOptions,
          },
        },
      },
    );
  });

  it('rejects empty boundary detection windows', async () => {
    await expect(
      analysisQueue.addBoundaryDetectionFlow(sourceId, [[]]),
    ).rejects.toThrow('Cannot enqueue empty boundary detection windows');

    expect(flowProducer.add).not.toHaveBeenCalled();
  });
});
