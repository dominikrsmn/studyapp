import { Injectable } from '@nestjs/common';
import type { CreateTopicEmbeddingsJobData } from '../embedding.types';

@Injectable()
export class CreateTopicEmbeddingsJob {
  async process(_data: CreateTopicEmbeddingsJobData): Promise<void> {}
}
