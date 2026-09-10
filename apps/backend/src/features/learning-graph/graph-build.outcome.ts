import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { GraphBuildJobData } from './graph-build.types';

export function graphBuildErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function failQueuedGraphBuild(
  prismaService: PrismaService,
  data: GraphBuildJobData,
  errorMessage: string,
): Promise<void> {
  await prismaService.learningGraph.updateMany({
    where: {
      id: data.graphId,
      moduleId: data.moduleId,
      version: data.graphVersion,
      status: 'QUEUED',
    },
    data: {
      status: 'FAILED',
      finishedAt: new Date(),
      errorMessage,
    },
  });
}
