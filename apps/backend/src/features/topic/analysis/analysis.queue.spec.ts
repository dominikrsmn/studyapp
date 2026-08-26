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

  it('adds one detection child per analysis unit under the merge job', async () => {
    await analysisQueue.addBoundaryDetectionFlow(sourceId, [
      { index: 0, documentUnitRefs: ['ref-1', 'ref-2'] },
      { index: 1, documentUnitRefs: ['ref-2', 'ref-3'] },
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
            data: {
              sourceId,
              analysisUnit: {
                index: 0,
                documentUnitRefs: ['ref-1', 'ref-2'],
              },
            },
            opts: {
              jobId: `${config.queue.jobs.detect_boundaries}/${sourceId}/0`,
              failParentOnFailure: true,
            },
          },
          {
            name: config.queue.jobs.detect_boundaries,
            queueName: config.queue.name,
            data: {
              sourceId,
              analysisUnit: {
                index: 1,
                documentUnitRefs: ['ref-2', 'ref-3'],
              },
            },
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

  it('rejects invalid boundary analysis units', async () => {
    await expect(
      analysisQueue.addBoundaryDetectionFlow(sourceId, [
        { index: 0, documentUnitRefs: [] },
      ]),
    ).rejects.toThrow('Cannot enqueue invalid boundary analysis units');

    expect(flowProducer.add).not.toHaveBeenCalled();
  });

  it('enqueues finalized topic spans for extraction', async () => {
    const spans = [
      { spanIndex: 0, startRef: 'ref-1', endRef: 'ref-3' },
      { spanIndex: 1, startRef: 'ref-4', endRef: 'ref-6' },
    ];

    await analysisQueue.addExtractSourceTopics(sourceId, spans);

    expect(queue.add).toHaveBeenCalledWith(
      config.queue.jobs.extract_source_topics,
      { sourceId, spans },
      {
        jobId: `${config.queue.jobs.extract_source_topics}/${sourceId}`,
      },
    );
  });

  it('rejects non-contiguous extraction span indexes', async () => {
    await expect(
      analysisQueue.addExtractSourceTopics(sourceId, [
        { spanIndex: 1, startRef: 'ref-1', endRef: 'ref-2' },
      ]),
    ).rejects.toThrow('Cannot enqueue invalid topic spans');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enqueues source-topic matching after extraction', async () => {
    await analysisQueue.addMatchSourceTopics(sourceId);

    expect(queue.add).toHaveBeenCalledWith(
      config.queue.jobs.match_source_topics,
      { sourceId },
      {
        jobId: `${config.queue.jobs.match_source_topics}/${sourceId}`,
      },
    );
  });

  it('enqueues topic-analysis finalization after matching', async () => {
    await analysisQueue.addFinalizeTopicAnalysis(sourceId);

    expect(queue.add).toHaveBeenCalledWith(
      config.queue.jobs.finalize_topic_analysis,
      { sourceId },
      {
        jobId: `${config.queue.jobs.finalize_topic_analysis}/${sourceId}`,
      },
    );
  });

  it('enqueues a deterministic summary job for a Topic revision', async () => {
    await analysisQueue.addSummarizeTopic('topic-id', 3);

    expect(queue.add).toHaveBeenCalledWith(
      config.queue.jobs.summarize_topic,
      { topicId: 'topic-id', contentRevision: 3 },
      {
        jobId: `${config.queue.jobs.summarize_topic}/topic-id/3`,
      },
    );
  });
});
