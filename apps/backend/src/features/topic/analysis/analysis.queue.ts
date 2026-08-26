import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { FlowProducer, Queue } from 'bullmq';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';
import { analysisConfig } from './analysis.config';
import { SourceProcessingStageService } from '../../source/ingestion/source-processing-stage.service';
import {
  AnalysisJobData,
  AnalysisUnit,
  DetectBoundaries,
  MergeBoundaries,
  PrepareTopicAnalysis,
} from './analysis.types';

@Injectable()
export class AnalysisQueue {
  constructor(
    @InjectQueue(analysisConfig().queue.name)
    private readonly queue: Queue<AnalysisJobData>,
    @InjectFlowProducer(analysisConfig().flowProducer.name)
    private readonly flowProducer: FlowProducer,
    @Inject(analysisConfig.KEY)
    private readonly config: ConfigType<typeof analysisConfig>,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
  ) {}

  async addPrepareTopicAnalysis(sourceId: string): Promise<void> {
    await this.enqueueStage(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      () =>
        this.queue.add(
          this.config.queue.jobs.prepare_topic_analysis,
          { sourceId } satisfies PrepareTopicAnalysis,
          {
            jobId: `${this.config.queue.jobs.prepare_topic_analysis}/${sourceId}`,
          },
        ),
    );
  }

  async addBoundaryDetectionFlow(
    sourceId: string,
    analysisUnits: AnalysisUnit[],
  ): Promise<void> {
    if (
      analysisUnits.length === 0 ||
      analysisUnits.some(
        ({ index, documentUnitRefs }) =>
          !Number.isInteger(index) ||
          index < 0 ||
          documentUnitRefs.length === 0,
      ) ||
      new Set(analysisUnits.map(({ index }) => index)).size !==
        analysisUnits.length
    ) {
      throw new Error('Cannot enqueue invalid boundary analysis units');
    }

    await this.flowProducer.add(
      {
        name: this.config.queue.jobs.merge_boundaries,
        queueName: this.config.queue.name,
        data: { sourceId } satisfies MergeBoundaries,
        opts: {
          jobId: `${this.config.queue.jobs.merge_boundaries}/${sourceId}`,
        },
        children: analysisUnits.map((analysisUnit) => ({
          name: this.config.queue.jobs.detect_boundaries,
          queueName: this.config.queue.name,
          data: { sourceId, analysisUnit } satisfies DetectBoundaries,
          opts: {
            jobId: `${this.config.queue.jobs.detect_boundaries}/${sourceId}/${analysisUnit.index}`,
            failParentOnFailure: true,
          },
        })),
      },
      {
        queuesOptions: {
          [this.config.queue.name]: {
            defaultJobOptions: this.config.queue.defaultJobOptions,
          },
        },
      },
    );
  }

  private async enqueueStage(
    sourceId: string,
    stage: SourceProcessingStageType,
    enqueue: () => Promise<unknown>,
  ): Promise<void> {
    await this.sourceProcessingStageService.transition(
      sourceId,
      stage,
      ProcessingState.QUEUED,
    );

    try {
      await enqueue();
    } catch (error) {
      await this.sourceProcessingStageService
        .transition(sourceId, stage, ProcessingState.FAILED, { error })
        .catch(() => undefined);
      throw error;
    }
  }
}
