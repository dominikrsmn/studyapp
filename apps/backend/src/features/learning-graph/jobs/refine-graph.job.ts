import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { GraphProposal, RefineGraphJobData } from '../graph-build.types';

@Injectable()
export class RefineGraphJob {
  constructor(private readonly prismaService: PrismaService) {}

  async process(job: Job<RefineGraphJobData>): Promise<void> {
    const [proposal] = Object.values(
      await job.getChildrenValues<GraphProposal | null>(),
    );
    if (!proposal) return;

    const prerequisites = new Map<string, Set<string>>(
      proposal.topicIds.map((topicId) => [topicId, new Set<string>()]),
    );
    for (const { topicId, dependsOnTopicId } of proposal.dependencies) {
      prerequisites.get(topicId)!.add(dependsOnTopicId);
    }

    const reducedPrerequisites = new Map<string, string[]>();
    for (const [topicId, directPrerequisites] of prerequisites) {
      const indirectPrerequisites = new Set<string>();
      const pending = [...directPrerequisites].flatMap((prerequisiteId) => [
        ...prerequisites.get(prerequisiteId)!,
      ]);
      while (pending.length > 0) {
        const prerequisiteId = pending.pop()!;
        if (indirectPrerequisites.has(prerequisiteId)) continue;
        indirectPrerequisites.add(prerequisiteId);
        pending.push(...prerequisites.get(prerequisiteId)!);
      }
      reducedPrerequisites.set(
        topicId,
        [...directPrerequisites].filter(
          (prerequisiteId) => !indirectPrerequisites.has(prerequisiteId),
        ),
      );
    }

    this.findOutliers(reducedPrerequisites); // ToDo: handle outliers

    const { graphId, moduleId, graphVersion } = job.data;
    await this.prismaService.$transaction(async (transaction) => {
      // Serialize publication with graph regeneration on the module row.
      const modules = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Module"
          WHERE "id" = ${moduleId} AND "graphVersion" = ${graphVersion}
          FOR UPDATE`,
      );
      if (modules.length === 0) return;

      const graph = await transaction.learningGraph.findUnique({
        where: { id: graphId, moduleId, version: graphVersion },
        select: { id: true },
      });
      if (!graph) return;

      const topics = await transaction.topic.findMany({
        where: { moduleId },
        select: { id: true },
      });
      for (const topic of topics) {
        await transaction.topic.update({
          where: { id: topic.id },
          data: {
            prerequisites: {
              set: (reducedPrerequisites.get(topic.id) ?? []).map((id) => ({
                id,
              })),
            },
          },
        });
      }

      await transaction.learningGraph.update({
        where: { id: graphId },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          errorMessage: null,
        },
      });
    });
  }

  private findOutliers(prerequisites: Map<string, string[]>): string[] {
    const requiredTopics = new Set([...prerequisites.values()].flat());
    return [...prerequisites]
      .filter(
        ([topicId, dependencies]) =>
          dependencies.length === 0 && !requiredTopics.has(topicId),
      )
      .map(([topicId]) => topicId);
  }
}
