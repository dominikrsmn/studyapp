import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ingestionConfig } from '../../features/ingestion/ingestion.config';
import { topicAnalysisConfig } from '../../features/topic/topic-analysis.config';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class TextProcessingService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(ingestionConfig.KEY)
    private readonly ingestionConfiguration: ConfigType<typeof ingestionConfig>,
    @Inject(topicAnalysisConfig.KEY)
    private readonly topicAnalysisConfiguration: ConfigType<
      typeof topicAnalysisConfig
    >,
  ) {}

  chunkForRag(text: string): string[] {
    return this.chunkFixedSize(
      text,
      this.ingestionConfiguration.chunking.size,
      this.ingestionConfiguration.chunking.overlap,
    );
  }

  async chunkForAnalysis(text: string): Promise<string[]> {
    return this.chunkFixedSize(
      text,
      this.topicAnalysisConfiguration.chunkSize,
      this.topicAnalysisConfiguration.chunkOverlap,
    );
  }

  private chunkFixedSize(
    text: string,
    chunkSize: number,
    overlap: number,
  ): string[] {
    if (chunkSize <= 0) {
      throw new RangeError('Chunk size must be greater than zero');
    }
    if (overlap < 0 || overlap >= chunkSize) {
      throw new RangeError(
        'Chunk overlap must be non-negative and smaller than the chunk size',
      );
    }

    const chunks: string[] = [];
    for (let start = 0; start < text.length; start += chunkSize - overlap) {
      chunks.push(text.slice(start, start + chunkSize));
      if (start + chunkSize >= text.length) {
        break;
      }
    }

    return chunks;
  }
}
