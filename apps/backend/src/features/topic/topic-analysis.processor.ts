import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { topicAnalysisConfig } from './topic-analysis.config';
import type { TopicAnalysisJobData } from './topic-analysis.queue';
import { TopicAnalysisService } from './topic-analysis.service';

// keep concurrency at 1 since each analysis depends on their predecessors results
@Processor(topicAnalysisConfig().queue.queueName)
export class TopicAnalysisProcessor extends WorkerHost {
  constructor(private readonly topicAnalysisService: TopicAnalysisService) {
    super();
  }

  process(job: Job<TopicAnalysisJobData>): Promise<void> {
    return this.topicAnalysisService.analyze(job.data.sourceId);
  }
}
