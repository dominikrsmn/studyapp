import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ingestionConfig } from './ingestion.config';

export type SourceIngestionJobData = {
  sourceId: string;
};

@Injectable()
export class SourceIngestionQueue {
  constructor(
    @InjectQueue(ingestionConfig().queue.name)
    private readonly queue: Queue<SourceIngestionJobData>,
    @Inject(ingestionConfig.KEY)
    private readonly config: ConfigType<typeof ingestionConfig>,
  ) {}

  async enqueue(sourceId: string): Promise<void> {
    await this.queue.add(
      this.config.queue.jobName,
      { sourceId },
      {
        jobId: sourceId,
        attempts: this.config.queue.attempts,
        backoff: {
          type: 'exponential',
          delay: this.config.queue.backoffDelay,
        },
      },
    );
  }
}
