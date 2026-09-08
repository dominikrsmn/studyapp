import { Injectable } from '@nestjs/common';
import type { CreateEvidenceEmbeddingsJobData } from '../embedding.types';

@Injectable()
export class CreateEvidenceEmbeddingsJob {
  async process(_data: CreateEvidenceEmbeddingsJobData): Promise<void> {}
}
