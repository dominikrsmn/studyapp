import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { embeddingConfig } from '../config/embedding.config';

@Injectable()
export class EmbeddingBatchingService {
  constructor(
    @Inject(embeddingConfig.KEY)
    private readonly config: ConfigType<typeof embeddingConfig>,
  ) {}

  batch<T>(items: readonly T[]): T[][] {
    const batches: T[][] = [];
    for (let offset = 0; offset < items.length; offset += this.config.batchSize) {
      batches.push(items.slice(offset, offset + this.config.batchSize));
    }
    return batches;
  }
}
