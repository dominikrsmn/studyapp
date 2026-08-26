import { Processor, WorkerHost } from '@nestjs/bullmq';
import { analysisConfig } from './analysis.config';
import { Inject, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Job } from 'bullmq';
import {
  AnalysisJobData,
  BoundaryDetectionResult,
  BoundaryMergeResult,
  DetectBoundaries,
  MergeBoundaries,
  PrepareTopicAnalysis,
} from './analysis.types';
import { PrepareTopicAnalysisJob } from './jobs/prepare-topic-analysis.job';
import { DetectBoundariesJob } from './jobs/detect-boundaries.job';
import { MergeBoundariesJob } from './jobs/merge-boundaries.job';

@Processor(analysisConfig().queue.name, {})
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    @Inject(analysisConfig.KEY)
    private readonly config: ConfigType<typeof analysisConfig>,
    private readonly prepareTopicAnalysisJob: PrepareTopicAnalysisJob,
    private readonly detectBoundariesJob: DetectBoundariesJob,
    private readonly mergeBoundariesJob: MergeBoundariesJob,
  ) {
    super();
  }

  process(
    job: Job<AnalysisJobData>,
  ): Promise<void | BoundaryDetectionResult | BoundaryMergeResult> {
    this.logger.log(`Processing ${job.name} job: ${job.id}`);
    switch (job.name) {
      case this.config.queue.jobs.prepare_topic_analysis:
        return this.prepareTopicAnalysisJob.process(
          job.data as PrepareTopicAnalysis,
        );
      case this.config.queue.jobs.detect_boundaries:
        return this.detectBoundariesJob.process(job.data as DetectBoundaries);
      case this.config.queue.jobs.merge_boundaries:
        return this.mergeBoundariesJob.process(job as Job<MergeBoundaries>);
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
