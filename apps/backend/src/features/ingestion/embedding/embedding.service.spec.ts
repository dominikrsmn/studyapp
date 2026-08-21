import { EmbeddingService } from './embedding.service';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../infrastructure/config/env.schema';

const BATCH_SIZE = 64;

describe('EmbeddingServiceService', () => {
  let service: EmbeddingService;

  const createEmbedding = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmbeddingService(
      {
        client: { embeddings: { create: createEmbedding } },
      } as unknown as OpenAiService,
      {
        get: jest.fn().mockReturnValue(BATCH_SIZE),
      } as unknown as ConfigService<Env, true>,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('batches chunk embeddings and preserves global chunk indexes', async () => {
    const chunks = Array.from({ length: BATCH_SIZE + 1 }, (_, index) => ({
      content: `chunk-${index}`,
      page: 1,
    }));
    createEmbedding.mockImplementation(async ({ input }) => ({
      data: input.map((_content: string, index: number) => ({
        index,
        embedding: [index],
      })),
    }));

    const result = await service.embedChunks(
      { id: 'source-id', userId: 'user-id' },
      chunks,
      10,
    );

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(createEmbedding.mock.calls[0][0].input).toHaveLength(BATCH_SIZE);
    expect(createEmbedding.mock.calls[1][0].input).toEqual([
      `chunk-${BATCH_SIZE}`,
    ]);
    expect(result).toHaveLength(BATCH_SIZE + 1);
    expect(result[0].index).toBe(10);
    expect(result[result.length - 1].index).toBe(10 + BATCH_SIZE);
  });
});
