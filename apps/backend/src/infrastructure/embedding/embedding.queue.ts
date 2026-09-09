import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { embeddingConfig } from '../config/embedding.config';
import type {
  CreateEvidenceEmbeddingsJobData,
  CreateRagEmbeddingsJobData,
  CreateTopicEmbeddingsJobData,
  EmbeddingJobData,
} from './embedding.types';

@Injectable()
export class EmbeddingQueue {
  constructor(
    @InjectQueue(embeddingConfig().queue.name)
    private readonly queue: Queue<EmbeddingJobData>,
    @Inject(embeddingConfig.KEY)
    private readonly config: ConfigType<typeof embeddingConfig>,
  ) {}

  async addCreateTopicEmbeddings(
    data: CreateTopicEmbeddingsJobData,
  ): Promise<void> {
    await this.queue.add(this.config.queue.jobs.create_topic_embeddings, data);
  }

  async addCreateEvidenceEmbeddings(
    data: CreateEvidenceEmbeddingsJobData,
  ): Promise<void> {
    await this.queue.add(this.config.queue.jobs.create_evidence_embeddings, data);
  }

  async addCreateRagEmbeddings(
    data: CreateRagEmbeddingsJobData,
  ): Promise<void> {
    await this.queue.add(this.config.queue.jobs.create_rag_embeddings, data);
  }
}
