import { Processor, WorkerHost } from '@nestjs/bullmq';
import { analysisConfig } from './analysis.config';
import { Inject, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Job } from 'bullmq';
import {
  AnalysisJobData,
  BoundaryDetectionResult,
  DetectBoundaries,
  PrepareTopicAnalysis,
} from './analysis.types';
import { PrepareTopicAnalysisJob } from './jobs/prepare-topic-analysis.job';
import { DetectBoundariesJob } from './jobs/detect-boundaries.job';

@Processor(analysisConfig().queue.name, {})
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    @Inject(analysisConfig.KEY)
    private readonly config: ConfigType<typeof analysisConfig>,
    private readonly prepareTopicAnalysisJob: PrepareTopicAnalysisJob,
    private readonly detectBoundariesJob: DetectBoundariesJob,
  ) {
    super();
  }

  process(job: Job<AnalysisJobData>): Promise<void | BoundaryDetectionResult> {
    this.logger.log(`Processing ${job.name} job: ${job.id}`);
    switch (job.name) {
      case this.config.queue.jobs.prepare_topic_analysis:
        return this.prepareTopicAnalysisJob.process(
          job.data as PrepareTopicAnalysis,
        );
      case this.config.queue.jobs.detect_boundaries:
        return this.detectBoundariesJob.process(job.data as DetectBoundaries);
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
