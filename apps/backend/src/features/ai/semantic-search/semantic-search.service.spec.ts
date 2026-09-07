import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { EmbeddingService } from '../../../infrastructure/embedding/embedding.service';
import { SemanticSearchService } from './semantic-search.service';
import { aiConfig } from '../ai.config';

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
      aiConfig(),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('embeds the query and returns matching chunks', async () => {
    const rows = [
      {
        sourceId: 'source-id',
        sourceName: 'Lecture notes',
        content: 'Relevant notes',
        pageStart: 2,
        pageEnd: 3,
      },
    ];
    embeddingService.embedQuery.mockResolvedValue([0.1, 0.2]);
    prismaService.$queryRaw.mockResolvedValue(rows);

    await expect(
      service.search('exam topics', 'module-id', 'user-id'),
    ).resolves.toEqual([{ ...rows[0], citationLabel: 'S1' }]);
    expect(embeddingService.embedQuery).toHaveBeenCalledWith(
      'exam topics',
      'user-id',
    );
    expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('scopes search to the owner and module with completed RAG indexing', async () => {
    embeddingService.embedQuery.mockResolvedValue([0.1, 0.2]);
    prismaService.$queryRaw.mockResolvedValue([]);

    await expect(
      service.search('exam topics', 'module-id', 'user-id', 5),
    ).resolves.toEqual([]);

    const [strings, ...parameters] = prismaService.$queryRaw.mock.calls[0];
    const sql = strings.join('?').replace(/\s+/g, ' ').trim();

    expect(sql).toContain('semester."userId" = ?');
    expect(sql).toContain('module."id" = ?');
    expect(sql).toContain(
      `AND EXISTS ( SELECT 1 FROM "SourceProcessingStage" AS stage WHERE stage."sourceId" = source."id" AND stage."stage" = 'RAG_INDEXING' AND stage."state" = 'COMPLETED' )`,
    );
    expect(sql).not.toContain('source."status"');
    expect(sql).not.toContain('TOPIC_ANALYSIS');
    expect(sql).toContain('chunk."embedding" IS NOT NULL');
    expect(sql).toContain(
      'ORDER BY chunk."embedding" <=> ?::vector, chunk."id" LIMIT ?',
    );
    expect(parameters).toEqual(['user-id', 'module-id', '[0.1,0.2]', 5]);
  });
});
