import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ingestionConfig } from './ingestion.config';
import { IngestionJobData, ParseDocumentJobData } from './ingestion.types';
import { Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ParseDocumentJob } from './jobs/parse-document.job';

@Processor(ingestionConfig().queue.name, {})
export class IngestionProcessor extends WorkerHost {
  constructor(
    @Inject(ingestionConfig.KEY)
    private readonly config: ConfigType<typeof ingestionConfig>,
    private readonly parseDocumentJob: ParseDocumentJob,
  ) {
    super();
  }

  process(job: Job<IngestionJobData>): Promise<void> {
    switch (job.name) {
      case this.config.queue.jobs.parse_document:
        return this.parseDocumentJob.process(job.data as ParseDocumentJobData);
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
