import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { sourceIngestionConfig } from './source-ingestion.config';

export type SourceIngestionJobData = {
  sourceId: string;
};

@Injectable()
export class SourceIngestionQueue {
  constructor(
    @InjectQueue(sourceIngestionConfig().queueName)
    private readonly queue: Queue<SourceIngestionJobData>,
    @Inject(sourceIngestionConfig.KEY)
    private readonly config: ConfigType<typeof sourceIngestionConfig>,
  ) {}

  async enqueue(sourceId: string): Promise<void> {
    await this.queue.add(
      this.config.jobName,
      { sourceId },
      {
        jobId: sourceId,
        attempts: this.config.attempts,
        backoff: {
          type: 'exponential',
          delay: this.config.backoffDelay,
        },
      },
    );
  }
}
