import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { topicAnalysisConfig } from './topic-analysis.config';
import type { TopicAnalysisJobData } from './topic-analysis.queue';
import { TopicAnalysisService } from './topic-analysis.service';

// keep concurrency at 1 since each analysis depends on their predecessors results
@Processor(topicAnalysisConfig().queue.queueName)
export class TopicAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(TopicAnalysisProcessor.name);

  constructor(private readonly topicAnalysisService: TopicAnalysisService) {
    super();
  }

  async process(job: Job<TopicAnalysisJobData>): Promise<void> {
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    const context = `sourceId="${job.data.sourceId}", jobId="${job.id}", attempt=${attempt}/${maxAttempts}`;

    this.logger.log(`Topic analysis job started (${context})`);

    try {
      await this.topicAnalysisService.analyze(job.data.sourceId);
      this.logger.log(`Topic analysis job completed (${context})`);
    } catch (error) {
      this.logger.error(
        `Topic analysis job failed (${context}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
