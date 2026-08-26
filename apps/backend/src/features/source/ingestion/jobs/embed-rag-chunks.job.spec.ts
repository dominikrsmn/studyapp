import { Logger } from '@nestjs/common';
import { embeddingConfig } from '../../../../infrastructure/config/embedding.config';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { OpenAiService } from '../../../../infrastructure/open-ai/open-ai.service';
import { SourceProcessingStageService } from '../source-processing-stage.service';
import { EmbedRagChunksJob } from './embed-rag-chunks.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../../infrastructure/database/generated/client', () => ({
  Prisma: {
    join: (values: unknown[]) => {
      const sql: string[] = [];
      const flattenedValues: unknown[] = [];

      for (const value of values) {
        if (
          typeof value === 'object' &&
          value !== null &&
          'sql' in value &&
          'values' in value
        ) {
          const fragment = value as { sql: string; values: unknown[] };
          sql.push(fragment.sql);
          flattenedValues.push(...fragment.values);
        } else {
          sql.push('?');
          flattenedValues.push(value);
        }
      }

      return { sql: sql.join(','), values: flattenedValues };
    },
    sql: (strings: TemplateStringsArray, ...interpolations: unknown[]) => {
      let sql = strings[0];
      const values: unknown[] = [];

      interpolations.forEach((interpolation, index) => {
        if (
          typeof interpolation === 'object' &&
          interpolation !== null &&
          'sql' in interpolation &&
          'values' in interpolation
        ) {
          const fragment = interpolation as {
            sql: string;
            values: unknown[];
          };
          sql += fragment.sql;
          values.push(...fragment.values);
        } else {
          sql += '?';
          values.push(interpolation);
        }

        sql += strings[index + 1];
      });

      return { sql, values };
    },
  },
}));

describe('EmbedRagChunksJob', () => {
  const sourceId = 'source-id';
  const source = { name: 'Linear Algebra Notes' };
  const chunks = [
    {
      id: 'chunk-1',
      chunkIndex: 3,
      content: 'A basis spans the vector space.',
      headingPath: ['Vector spaces', 'Bases'],
      pageStart: 10,
      pageEnd: 11,
    },
    {
      id: 'chunk-2',
      chunkIndex: 4,
      content: 'The vectors must also be linearly independent.',
      headingPath: [],
      pageStart: 12,
      pageEnd: 12,
    },
  ];
  const sourceDelegate = { findUnique: jest.fn() };
  const queryRaw = jest.fn();
  const executeRaw = jest.fn();
  const prismaService = {
    source: sourceDelegate,
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  };
  const createEmbeddings = jest.fn();
  const openAiService = {
    client: { embeddings: { create: createEmbeddings } },
  };
  const sourceProcessingStageService = { transition: jest.fn() };

  let job: EmbedRagChunksJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    sourceDelegate.findUnique.mockResolvedValue(source);
    queryRaw.mockResolvedValue(chunks);
    executeRaw.mockResolvedValue(1);
    createEmbeddings.mockResolvedValue({
      data: [
        { index: 1, embedding: [0.3, 0.4] },
        { index: 0, embedding: [0.1, 0.2] },
      ],
    });
    sourceProcessingStageService.transition.mockResolvedValue({
      id: 'stage-id',
    });

    job = new EmbedRagChunksJob(
      prismaService as unknown as PrismaService,
      openAiService as unknown as OpenAiService,
      sourceProcessingStageService as unknown as SourceProcessingStageService,
      embeddingConfig(),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads only the requested unembedded source chunks and embeds them in one request', async () => {
    await job.process({
      sourceId,
      chunkIds: ['chunk-1', 'chunk-2', 'chunk-1'],
    });

    expect(sourceDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: sourceId },
      select: { name: true },
    });
    const query = queryRaw.mock.calls[0][0] as {
      sql: string;
      values: unknown[];
    };
    expect(query.sql).toContain('chunk."sourceId" = ?');
    expect(query.sql).toContain('chunk."id" IN (?,?)');
    expect(query.sql).toContain('chunk."embedding" IS NULL');
    expect(query.values).toEqual([sourceId, 'chunk-1', 'chunk-2']);
    expect(createEmbeddings).toHaveBeenCalledTimes(1);
    expect(createEmbeddings).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      encoding_format: 'float',
      input: [
        'Source: Linear Algebra Notes\n' +
          'Section: Vector spaces > Bases\n' +
          'Pages: 10-11\n\n' +
          'A basis spans the vector space.',
        'Source: Linear Algebra Notes\n' +
          'Page: 12\n\n' +
          'The vectors must also be linearly independent.',
      ],
    });
  });

  it('persists response vectors by API index in one atomic statement', async () => {
    await job.process({ sourceId, chunkIds: ['chunk-1', 'chunk-2'] });

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const query = executeRaw.mock.calls[0][0] as {
      sql: string;
      values: unknown[];
    };
    expect(query.sql).toContain('UPDATE "SourceChunk" AS chunk');
    expect(query.sql).toContain(
      'VALUES (?::uuid, ?::vector),(?::uuid, ?::vector)',
    );
    expect(query.sql).toContain('AND chunk."embedding" IS NULL');
    expect(query.values).toEqual([
      'chunk-1',
      '[0.1,0.2]',
      'chunk-2',
      '[0.3,0.4]',
      sourceId,
    ]);
  });

  it('does not request or write embeddings for an already completed retry batch', async () => {
    queryRaw.mockResolvedValue([]);

    await job.process({ sourceId, chunkIds: ['chunk-1', 'chunk-2'] });

    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('does not re-embed persisted chunks when the batch is retried', async () => {
    await job.process({ sourceId, chunkIds: ['chunk-1', 'chunk-2'] });
    queryRaw.mockResolvedValueOnce([]);
    await job.process({ sourceId, chunkIds: ['chunk-1', 'chunk-2'] });

    expect(createEmbeddings).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('does not persist partial API results and records the failure', async () => {
    const responseError = new Error(
      'Embedding API returned 1 vectors for 2 chunks',
    );
    createEmbeddings.mockResolvedValue({
      data: [{ index: 0, embedding: [0.1, 0.2] }],
    });

    await expect(
      job.process({ sourceId, chunkIds: ['chunk-1', 'chunk-2'] }),
    ).rejects.toThrow(responseError.message);

    expect(executeRaw).not.toHaveBeenCalled();
    expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.RAG_INDEXING,
      ProcessingState.FAILED,
      { error: expect.objectContaining({ message: responseError.message }) },
    );
  });

  it('skips deleted sources without calling OpenAI or continuing ingestion', async () => {
    sourceDelegate.findUnique.mockResolvedValue(null);

    await job.process({ sourceId, chunkIds: ['chunk-1'] });

    expect(queryRaw).not.toHaveBeenCalled();
    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
