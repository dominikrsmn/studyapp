import { Processor, WorkerHost } from '@nestjs/bullmq';
import { analysisConfig } from './analysis.config';
import { Inject, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Job } from 'bullmq';
import { AnalysisJobData } from './analysis.types';
import { PrepareTopicAnalysisJob } from './jobs/prepare-topic-analysis.job';

@Processor(analysisConfig().queue.name, {})
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    @Inject(analysisConfig.KEY)
    private readonly config: ConfigType<typeof analysisConfig>,
    private readonly prepareTopicAnalysisJob: PrepareTopicAnalysisJob,
  ) {
    super();
  }

  process(job: Job<AnalysisJobData>): Promise<void> {
    this.logger.log(`Processing ${job.name} job: ${job.id}`);
    switch (job.name) {
      case this.config.queue.jobs.prepare_topic_analysis:
        return this.prepareTopicAnalysisJob.process(job.data);
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
