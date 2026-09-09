import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Job } from 'bullmq';
import { embeddingConfig } from '../config/embedding.config';
import { JobHistoryService } from '../open-ai/job-history.service';
import type {
  CreateEvidenceEmbeddingsJobData,
  CreateRagEmbeddingsJobData,
  CreateTopicEmbeddingsJobData,
  EmbeddingJobData,
} from './embedding.types';
import { CreateEvidenceEmbeddingsJob } from './jobs/create-evidence-embeddings.job';
import { CreateRagEmbeddingsJob } from './jobs/create-rag-embeddings.job';
import { CreateTopicEmbeddingsJob } from './jobs/create-topic-embeddings.job';

@Processor(embeddingConfig().queue.name, {
  concurrency: embeddingConfig().queue.concurrency,
})
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly jobHistory: JobHistoryService,
    @Inject(embeddingConfig.KEY)
    private readonly config: ConfigType<typeof embeddingConfig>,
    private readonly createRagEmbeddingsJob: CreateRagEmbeddingsJob,
    private readonly createTopicEmbeddingsJob: CreateTopicEmbeddingsJob,
    private readonly createEvidenceEmbeddingsJob: CreateEvidenceEmbeddingsJob,
  ) {
    super();
  }

  process(job: Job<EmbeddingJobData>): Promise<void> {
    return this.jobHistory.run(job, () => this.processJob(job));
  }

  private processJob(job: Job<EmbeddingJobData>): Promise<void> {
    this.logger.log(`Processing ${job.name} job: ${job.id}`);
    switch (job.name) {
      case this.config.queue.jobs.create_rag_embeddings:
        return this.createRagEmbeddingsJob.process(
          job.data as CreateRagEmbeddingsJobData,
        );
      case this.config.queue.jobs.create_topic_embeddings:
        return this.createTopicEmbeddingsJob.process(
          job.data as CreateTopicEmbeddingsJobData,
        );
      case this.config.queue.jobs.create_evidence_embeddings:
        return this.createEvidenceEmbeddingsJob.process(
          job.data as CreateEvidenceEmbeddingsJobData,
        );
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
