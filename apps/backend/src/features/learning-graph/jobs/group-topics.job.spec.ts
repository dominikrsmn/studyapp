import type { Job } from 'bullmq';
import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';
import type { GraphBuildJobData, GraphProposal } from '../graph-build.types';
import { GroupTopicsJob } from './group-topics.job';

jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class {},
}));
jest.mock('../../../infrastructure/open-ai/open-ai.service', () => ({
  OpenAiService: class {},
}));

const unit = (topicIds: string[], entryTopicId = topicIds[0]) => ({
  title: 'Theme',
  summary: 'Scope',
  topicIds,
  entryTopicId,
});
const dependency = (source: string, destination: string) => ({
  topicId: destination,
  dependsOnTopicId: source,
});

describe('GroupTopicsJob', () => {
  const prisma = {
    learningGraph: { findUnique: jest.fn(), updateMany: jest.fn() },
    topic: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const ai = { parseResponse: jest.fn() };
  const grouping = new GroupTopicsJob(
    prisma as unknown as PrismaService,
    ai as unknown as OpenAiService,
  );
  const data = { graphId: 'graph', moduleId: 'module', graphVersion: 1 };

  async function run(
    proposal: GraphProposal,
    units: ReturnType<typeof unit>[],
  ) {
    prisma.topic.findMany.mockResolvedValue(
      proposal.topicIds.map((id) => ({ id, title: id, description: id })),
    );
    ai.parseResponse.mockResolvedValue({ output_parsed: { units } });
    return grouping.process({
      data,
      getChildrenValues: jest.fn().mockResolvedValue({ refinement: proposal }),
    } as unknown as Job<GraphBuildJobData>);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.learningGraph.findUnique.mockResolvedValue({ id: 'graph' });
  });

  it('keeps disconnected members, singleton units, multiple exits, and the refined prerequisites', async () => {
    const proposal = {
      topicIds: ['a', 'b', 'c', 'd', 'e'],
      dependencies: [dependency('a', 'b'), dependency('a', 'c')],
    };
    const result = await run(proposal, [
      unit(['d']),
      unit(['e', 'c', 'b', 'a'], 'a'),
    ]);
    expect(result).toEqual({
      ...proposal,
      units: [
        {
          ...unit(['a', 'b', 'c', 'e']),
          id: 'a',
          exitTopicIds: ['b', 'c', 'e'],
        },
        { ...unit(['d']), id: 'd', exitTopicIds: ['d'] },
      ],
      ordering: [],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(ai.parseResponse).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing', [unit(['a'])]],
    ['duplicate within a unit', [unit(['a', 'a', 'b'])]],
    ['duplicate across units', [unit(['a', 'b']), unit(['b'])]],
    ['foreign', [unit(['a', 'b', 'foreign'])]],
    ['foreign entry', [unit(['a', 'b'], 'foreign')]],
    ['entry outside its unit', [unit(['a'], 'b'), unit(['b'])]],
    ['entry with an internal prerequisite', [unit(['a', 'b'], 'b')]],
    ['empty unit', [unit(['a', 'b']), unit([], 'a')]],
  ])('rejects %s output before publication', async (_, units) => {
    await expect(
      run(
        { topicIds: ['a', 'b'], dependencies: [dependency('a', 'b')] },
        units,
      ),
    ).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a missing structured response', async () => {
    prisma.topic.findMany.mockResolvedValue([
      { id: 'a', title: 'A', description: 'A' },
    ]);
    ai.parseResponse.mockResolvedValue({ output_parsed: null });
    await expect(
      grouping.process({
        data,
        getChildrenValues: async () => ({
          refinement: { topicIds: ['a'], dependencies: [] },
        }),
      } as unknown as Job<GraphBuildJobData>),
    ).rejects.toThrow();
  });

  it('returns empty units for an empty proposal without AI', async () => {
    await expect(run({ topicIds: [], dependencies: [] }, [])).resolves.toEqual({
      topicIds: [],
      dependencies: [],
      units: [],
      ordering: [],
    });
    expect(ai.parseResponse).not.toHaveBeenCalled();
  });

  it('skips stale builds without AI or publication', async () => {
    prisma.learningGraph.findUnique.mockResolvedValue(null);
    await expect(
      run({ topicIds: ['a'], dependencies: [] }, [unit(['a'])]),
    ).resolves.toBeUndefined();
    expect(ai.parseResponse).not.toHaveBeenCalled();
    expect(prisma.learningGraph.updateMany).toHaveBeenCalled();
  });

  it.each([
    [2, 3, true],
    [2, 2, false],
    [1, 3, false],
  ])(
    'uses distinct contributors (%s) and exact directed coverage (%s/10)',
    async (contributors, covered, admitted) => {
      const source = ['a0', 'a1'];
      const destination = Array.from({ length: 10 }, (_, i) => `b${i}`);
      const dependencies = Array.from({ length: covered }, (_, i) =>
        dependency(source[i % contributors], destination[i]),
      );
      const proposal = {
        topicIds: [...source, ...destination],
        dependencies: [...dependencies, ...dependencies],
      };
      const result = await run(proposal, [unit(source), unit(destination)]);
      expect(result?.ordering).toEqual(
        admitted ? [{ sourceUnitId: 'a0', destinationUnitId: 'b0' }] : [],
      );
      expect(result?.dependencies).toEqual(proposal.dependencies);
    },
  );

  it('ranks coverage then contributors then IDs, skips cycles, and ignores input order', async () => {
    const groups = [
      unit(['a0', 'a1', 'a2', 'a3']),
      unit(['b0', 'b1', 'b2', 'b3']),
      unit(['c0', 'c1', 'c2', 'c3']),
    ];
    // Topic relationships remain acyclic although contracting the groups creates a cycle.
    const dependencies = [
      dependency('a0', 'b2'),
      dependency('a1', 'b3'),
      dependency('b0', 'c2'),
      dependency('b1', 'c3'),
      dependency('c0', 'a2'),
      dependency('c1', 'a3'),
    ];
    const topicIds = groups.flatMap((u) => u.topicIds);
    const first = await run({ topicIds, dependencies }, groups);
    const second = await run(
      {
        topicIds: [...topicIds].reverse(),
        dependencies: [...dependencies].reverse(),
      },
      [...groups]
        .reverse()
        .map((u) => ({ ...u, topicIds: [...u.topicIds].reverse() })),
    );
    expect(first?.ordering).toEqual([
      { sourceUnitId: 'a0', destinationUnitId: 'b0' },
      { sourceUnitId: 'b0', destinationUnitId: 'c0' },
    ]);
    expect(second?.ordering).toEqual(first?.ordering);
    expect(second?.units).toEqual(first?.units);
    const stronger = await run(
      { topicIds, dependencies: [...dependencies, dependency('c0', 'a1')] },
      groups,
    );
    expect(stronger?.ordering).toEqual([
      { sourceUnitId: 'c0', destinationUnitId: 'a0' },
      { sourceUnitId: 'a0', destinationUnitId: 'b0' },
    ]);
    const moreContributors = await run(
      { topicIds, dependencies: [...dependencies, dependency('c2', 'a3')] },
      groups,
    );
    expect(moreContributors?.ordering).toEqual([
      { sourceUnitId: 'c0', destinationUnitId: 'a0' },
      { sourceUnitId: 'a0', destinationUnitId: 'b0' },
    ]);
  });
});
