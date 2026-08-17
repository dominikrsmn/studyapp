import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../../open-ai/open-ai.service';
import { PrismaService } from '../../database/prisma/prisma.service';

type SourceIdWithUserId = {
  id: string;
  userId: string;
};
@Injectable()
export class EmbeddingService {
  constructor(
    private readonly openAIService: OpenAiService,
    private readonly prismaService: PrismaService,
  ) {}

  async embed(source: SourceIdWithUserId, chunk: string) {
    const embedding = await this.openAIService.client.embeddings.create({
      input: chunk,
      model: 'text-embedding-3-small',
      encoding_format: 'float',
      user: source.userId,
    });
  }
}
