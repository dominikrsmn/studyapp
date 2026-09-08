import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { embeddingConfig } from '../config/embedding.config';
import { OpenAiService } from '../open-ai/open-ai.service';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly openAiService: OpenAiService,
    @Inject(embeddingConfig.KEY)
    private readonly config: ConfigType<typeof embeddingConfig>,
  ) {}

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0 || texts.length > this.config.batchSize) {
      throw new Error(
        `Embedding batch must contain 1-${this.config.batchSize} texts`,
      );
    }
    if (texts.some((text) => !text.trim())) {
      throw new Error('Embedding texts cannot be blank');
    }

    const response = await this.openAiService.client.embeddings.create({
      model: this.config.model,
      dimensions: this.config.dimensions,
      encoding_format: this.config.encodingFormat,
      input: texts,
    });
    if (response.data.length !== texts.length) {
      throw new Error(
        `Embedding API returned ${response.data.length} vectors for ${texts.length} texts`,
      );
    }

    const vectors: number[][] = new Array(texts.length);
    for (const { index, embedding } of response.data) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= texts.length ||
        vectors[index] !== undefined ||
        embedding.length !== this.config.dimensions ||
        embedding.some((value) => !Number.isFinite(value))
      ) {
        throw new Error('Embedding API returned invalid vector data');
      }
      vectors[index] = embedding;
    }
    return vectors;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([text]);
    return embedding;
  }
}
