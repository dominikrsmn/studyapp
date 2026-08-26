import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';
import { analysisConfig } from './analysis.config';
import { SourceProcessingStageService } from '../../source/ingestion/source-processing-stage.service';
import { AnalysisJobData } from './analysis.types';

@Injectable()
export class IngestionQueue {
  constructor(
    @InjectQueue(analysisConfig().queue.name)
    private readonly queue: Queue<AnalysisJobData>,
    @Inject(analysisConfig.KEY)
    private readonly config: ConfigType<typeof analysisConfig>,
    private readonly sourceProcessingStageService: SourceProcessingStageService,
  ) {}

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
