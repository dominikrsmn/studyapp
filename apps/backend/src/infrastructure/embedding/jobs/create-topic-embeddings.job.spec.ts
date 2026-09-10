import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { EmbeddingService } from '../embedding.service';
import { CreateTopicEmbeddingsJob } from './create-topic-embeddings.job';

jest.mock('../../database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../database/generated/client', () => {
  type Sql = { sql: string; values: unknown[] };
  const render = (value: unknown): Sql =>
    typeof value === 'object' && value !== null && 'sql' in value
      ? (value as Sql)
      : { sql: '?', values: [value] };
  return {
    Prisma: {
      sql: (strings: TemplateStringsArray, ...values: unknown[]): Sql => {
        let sql = strings[0];
        const parameters: unknown[] = [];
        values.forEach((value, index) => {
          const rendered = render(value);
          sql += rendered.sql + strings[index + 1];
          parameters.push(...rendered.values);
        });
        return { sql, values: parameters };
      },
      join: (values: unknown[]): Sql => {
        const rendered = values.map(render);
        return {
          sql: rendered.map((value) => value.sql).join(','),
          values: rendered.flatMap((value) => value.values),
        };
      },
    },
  };
});

describe('CreateTopicEmbeddingsJob', () => {
  const data = {
    graphId: 'graph-id',
    moduleId: 'module-id',
    graphVersion: 4,
    topicIds: ['topic-id'],
  };
  const topic = {
    id: 'topic-id',
    title: 'Gradient Descent',
    description: 'Iterative first-order optimization.',
  };
  const findUnique = jest.fn();
  const queryRaw = jest.fn();
  const executeRaw = jest.fn();
  const embedTexts = jest.fn();
  const prismaService = {
    learningGraph: { findUnique },
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  };
  let job: CreateTopicEmbeddingsJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    findUnique.mockResolvedValue({ id: data.graphId });
    queryRaw.mockResolvedValue([topic]);
    embedTexts.mockResolvedValue([[0.1, 0.2]]);
    executeRaw.mockResolvedValue(1);
    job = new CreateTopicEmbeddingsJob(
      prismaService as unknown as PrismaService,
      { embedTexts } as unknown as EmbeddingService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists a current vector against the title and description used to generate it', async () => {
    await job.process(data);

    expect(embedTexts).toHaveBeenCalledWith([
      'Gradient Descent: Iterative first-order optimization.',
    ]);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const query = executeRaw.mock.calls[0][0] as {
      sql: string;
      values: unknown[];
    };
    const sql = query.sql.replace(/\s+/g, ' ').trim();
    expect(sql).toContain(
      'AS incoming("id", "title", "description", "embedding")',
    );
    expect(sql).toContain('topic."title" = incoming."title"');
    expect(sql).toContain('topic."description" = incoming."description"');
    expect(query.values).toEqual([
      topic.id,
      topic.title,
      topic.description,
      '[0.1,0.2]',
      data.moduleId,
    ]);
  });

  it('does not persist a vector when topic text changes during the embedding request', async () => {
    let currentTitle = topic.title;
    let vectorPersisted = false;
    embedTexts.mockImplementation(async () => {
      currentTitle = 'Stochastic Gradient Descent';
      return [[0.1, 0.2]];
    });
    executeRaw.mockImplementation(async (query: { sql: string }) => {
      const sql = query.sql.replace(/\s+/g, ' ').trim();
      const sourceTextStillMatches =
        currentTitle === topic.title &&
        sql.includes('topic."title" = incoming."title"') &&
        sql.includes('topic."description" = incoming."description"');
      vectorPersisted = sourceTextStillMatches;
      return sourceTextStillMatches ? 1 : 0;
    });

    await job.process(data);

    expect(vectorPersisted).toBe(false);
  });

  it('continues selecting requested topics whose embedding is null', async () => {
    await job.process(data);

    const query = queryRaw.mock.calls[0][0] as {
      sql: string;
      values: unknown[];
    };
    expect(query.sql).toContain('topic."embedding" IS NULL');
    expect(query.values).toEqual([data.moduleId, data.topicIds[0]]);
  });
});
