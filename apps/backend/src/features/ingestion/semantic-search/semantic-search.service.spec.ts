import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SemanticSearchService } from './semantic-search.service';

jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;
  const embeddingService = { embedQuery: jest.fn() };
  const prismaService = { $queryRaw: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SemanticSearchService(
      embeddingService as unknown as EmbeddingService,
      prismaService as unknown as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('embeds the query and returns matching chunks', async () => {
    const results = [{ content: 'Relevant notes' }];
    embeddingService.embedQuery.mockResolvedValue([0.1, 0.2]);
    prismaService.$queryRaw.mockResolvedValue(results);

    await expect(
      service.search('exam topics', 'module-id', 'user-id'),
    ).resolves.toEqual(results);
    expect(embeddingService.embedQuery).toHaveBeenCalledWith(
      'exam topics',
      'user-id',
    );
    expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
