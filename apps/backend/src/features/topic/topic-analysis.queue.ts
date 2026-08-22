import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { topicAnalysisConfig } from './topic-analysis.config';

export type TopicAnalysisJobData = {
  sourceId: string;
};

@Injectable()
export class TopicAnalysisQueue {
  constructor(
    @InjectQueue(topicAnalysisConfig().queueName)
    private readonly queue: Queue<TopicAnalysisJobData>,
    @Inject(topicAnalysisConfig.KEY)
    private readonly config: ConfigType<typeof topicAnalysisConfig>,
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
