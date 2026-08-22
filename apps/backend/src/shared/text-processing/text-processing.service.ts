import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ingestionConfig } from '../../features/ingestion/ingestion.config';
import { topicAnalysisConfig } from '../../features/topic/topic-analysis.config';

export type AnalysisTextChunk = {
  content: string;
  startOffset: number;
  endOffset: number;
};

@Injectable()
export class TextProcessingService {
  constructor(
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

  chunkForAnalysis(text: string): AnalysisTextChunk[] {
    return this.chunkFixedSizeWithOffsets(
      text,
      this.topicAnalysisConfiguration.chunks.chunkSize,
      this.topicAnalysisConfiguration.chunks.chunkOverlap,
    );
  }

  private chunkFixedSize(
    text: string,
    chunkSize: number,
    overlap: number,
  ): string[] {
    return this.chunkFixedSizeWithOffsets(text, chunkSize, overlap).map(
      ({ content }) => content,
    );
  }

  private chunkFixedSizeWithOffsets(
    text: string,
    chunkSize: number,
    overlap: number,
  ): AnalysisTextChunk[] {
    if (chunkSize <= 0) {
      throw new RangeError('Chunk size must be greater than zero');
    }
    if (overlap < 0 || overlap >= chunkSize) {
      throw new RangeError(
        'Chunk overlap must be non-negative and smaller than the chunk size',
      );
    }

    const chunks: AnalysisTextChunk[] = [];
    for (let start = 0; start < text.length; start += chunkSize - overlap) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({
        content: text.slice(start, end),
        startOffset: start,
        endOffset: end,
      });
      if (start + chunkSize >= text.length) {
        break;
      }
    }

    return chunks;
  }
}
