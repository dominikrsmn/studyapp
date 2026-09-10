import type { Job } from 'bullmq';
import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { DispatchCandidatesJob } from './jobs/dispatch-candidates.job';
import type { GetPrerequisitesJob } from './jobs/get-prerequisites.job';
import type { RefineGraphJob } from './jobs/refine-graph.job';
import type { DetectCyclesJob } from './jobs/detect-cycles.job';
import type { GraphBuildJobData } from './graph-build.types';
import { graphBuildConfig } from './graph-build.config';
import { GraphBuildProcessor } from './graph-build.processor';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../infrastructure/database/generated/client', () => ({
  Prisma: { sql: (strings: TemplateStringsArray) => strings.join('?') },
}));

describe('GraphBuildProcessor', () => {
  const data: GraphBuildJobData = {
    graphId: 'graph-id',
    moduleId: 'module-id',
    graphVersion: 7,
  };
  const prisma = { learningGraph: { updateMany: jest.fn() } };
  const dispatchCandidatesJob = { process: jest.fn() };
  const processor = new GraphBuildProcessor(
    prisma as unknown as PrismaService,
    dispatchCandidatesJob as unknown as DispatchCandidatesJob,
    { process: jest.fn() } as unknown as GetPrerequisitesJob,
    { process: jest.fn() } as unknown as RefineGraphJob,
    { process: jest.fn() } as unknown as DetectCyclesJob,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.learningGraph.updateMany.mockResolvedValue({ count: 1 });
  });

  function job(attemptsMade: number, attempts: number): Job<GraphBuildJobData> {
    return {
      name: graphBuildConfig().queue.jobs.dispatch_candidates,
      data,
      attemptsMade,
      opts: { attempts },
    } as Job<GraphBuildJobData>;
  }

  it('marks the queued build failed when a graph job exhausts its attempts', async () => {
    dispatchCandidatesJob.process.mockRejectedValueOnce(
      new Error('Candidate dispatch failed'),
    );

    await expect(processor.process(job(2, 3))).rejects.toThrow(
      'Candidate dispatch failed',
    );
    expect(prisma.learningGraph.updateMany).toHaveBeenCalledWith({
      where: {
        id: data.graphId,
        moduleId: data.moduleId,
        version: data.graphVersion,
        status: 'QUEUED',
      },
      data: {
        status: 'FAILED',
        finishedAt: expect.any(Date),
        errorMessage:
          'Graph job "dispatch-candidates" failed: Candidate dispatch failed',
      },
    });
  });

  it('does not make a build terminal while a retry remains', async () => {
    dispatchCandidatesJob.process.mockRejectedValueOnce(
      new Error('Candidate dispatch failed'),
    );

    await expect(processor.process(job(0, 3))).rejects.toThrow(
      'Candidate dispatch failed',
    );
    expect(prisma.learningGraph.updateMany).not.toHaveBeenCalled();
  });

  it('preserves the processing error if persisting failure status fails', async () => {
    const processingError = new Error('Candidate dispatch failed');
    dispatchCandidatesJob.process.mockRejectedValueOnce(processingError);
    prisma.learningGraph.updateMany.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );

    await expect(processor.process(job(0, 1))).rejects.toBe(processingError);
  });
});
