import { embeddingConfig } from '../config/embedding.config';
import { OpenAiService } from '../open-ai/open-ai.service';
import { EmbeddingService } from './embedding.service';

jest.mock('../database/prisma/prisma.service', () => ({
  PrismaService: class {},
}));

describe('EmbeddingService', () => {
  const createEmbeddings = jest.fn();
  const config = { ...embeddingConfig(), dimensions: 2 };
  const service = new EmbeddingService(
    {
      client: { embeddings: { create: createEmbeddings } },
    } as unknown as OpenAiService,
    config,
  );

  beforeEach(() => {
    createEmbeddings.mockReset();
    createEmbeddings.mockResolvedValue({
      data: [
        { index: 1, embedding: [0.3, 0.4] },
        { index: 0, embedding: [0.1, 0.2] },
      ],
    });
  });

  it('returns vectors in input order using the shared model and dimensions', async () => {
    await expect(service.embedTexts(['first', 'second'])).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(createEmbeddings).toHaveBeenCalledWith({
      model: config.model,
      dimensions: 2,
      encoding_format: 'float',
      input: ['first', 'second'],
    });
  });

  it.each([[], [' '], Array(65).fill('text')])(
    'rejects invalid batches before calling the API: %j',
    async (...texts) => {
      await expect(service.embedTexts(texts)).rejects.toThrow();
      expect(createEmbeddings).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ index: 0, embedding: [0.1, 0.2] }],
    [
      { index: 0, embedding: [0.1, 0.2] },
      { index: 0, embedding: [0.3, 0.4] },
    ],
    [
      { index: -1, embedding: [0.1, 0.2] },
      { index: 1, embedding: [0.3, 0.4] },
    ],
    [
      { index: 2, embedding: [0.1, 0.2] },
      { index: 1, embedding: [0.3, 0.4] },
    ],
    [
      { index: 0.5, embedding: [0.1, 0.2] },
      { index: 1, embedding: [0.3, 0.4] },
    ],
    [
      { index: 0, embedding: [0.1] },
      { index: 1, embedding: [0.3, 0.4] },
    ],
    [
      { index: 0, embedding: [NaN, 0.2] },
      { index: 1, embedding: [0.3, 0.4] },
    ],
    [
      { index: 0, embedding: [Infinity, 0.2] },
      { index: 1, embedding: [0.3, 0.4] },
    ],
  ])('rejects malformed API vectors: %j', async (...data) => {
    createEmbeddings.mockResolvedValue({ data });
    await expect(service.embedTexts(['first', 'second'])).rejects.toThrow(
      'Embedding API returned',
    );
  });

  it('embeds a search query through the same API', async () => {
    createEmbeddings.mockResolvedValue({
      data: [{ index: 0, embedding: [0.1, 0.2] }],
    });
    await expect(service.embedQuery('query')).resolves.toEqual([0.1, 0.2]);
    expect(createEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({ input: ['query'] }),
    );
  });
});
