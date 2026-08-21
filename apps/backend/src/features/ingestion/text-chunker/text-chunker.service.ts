import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ingestionConfig } from '../ingestion.config';

@Injectable()
export class TextChunkerService {
  constructor(
    @Inject(ingestionConfig.KEY)
    private readonly config: ConfigType<typeof ingestionConfig>,
  ) {}

  chunk(text: string): string[] {
    const chunks: string[] = [];
    for (
      let start = 0;
      start < text.length;
      start += this.config.chunkSize - this.config.chunkOverlap
    ) {
      chunks.push(text.slice(start, start + this.config.chunkSize));
      if (start + this.config.chunkSize >= text.length) {
        break;
      }
    }

    return chunks;
  }
}
