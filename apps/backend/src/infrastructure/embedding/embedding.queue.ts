import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { embeddingConfig } from '../config/embedding.config';
import type {
  CreateEvidenceEmbeddingsJobData,
  CreateTopicEmbeddingsJobData,
  EmbeddingJobData,
} from './embedding.types';

@Injectable()
export class EmbeddingQueue {
  constructor(
    @InjectQueue(embeddingConfig().queue.name)
    private readonly queue: Queue<EmbeddingJobData>,
  ) {}

  async addCreateTopicEmbeddings(
    _data: CreateTopicEmbeddingsJobData,
  ): Promise<void> {}

  async addCreateEvidenceEmbeddings(
    _data: CreateEvidenceEmbeddingsJobData,
  ): Promise<void> {}
}
