import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { GraphProposal, RefineGraphJobData } from '../graph-build.types';
import { failQueuedGraphBuild } from '../graph-build.outcome';

@Injectable()
export class RefineGraphJob {
  private readonly logger = new Logger(RefineGraphJob.name);
  constructor(private readonly prismaService: PrismaService) {}

  async process(job: Job<RefineGraphJobData>): Promise<void> {
    const [proposal] = Object.values(
      await job.getChildrenValues<GraphProposal | null>(),
    );
    if (!proposal) {
      await failQueuedGraphBuild(
        this.prismaService,
        job.data,
        'Graph build became stale before publication',
      );
      return;
    }

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
    const dependencies = [...reducedPrerequisites].flatMap(([topicId, ids]) =>
      ids.map((prerequisiteId) => ({ topicId, prerequisiteId })),
    );
    const requestedAt = performance.now();
    let transactionStartedAt: number | undefined;
    let lockAcquiredAt: number | undefined;
    this.logger.log(
      `Publishing graph "${graphId}" version ${graphVersion}: ${proposal.topicIds.length} topics, ${dependencies.length} prerequisite relationships`,
    );
    const published = await this.prismaService
      .$transaction(async (transaction) => {
        transactionStartedAt = performance.now();
        // Serialize publication with graph regeneration on the module row.
        const modules = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "Module"
          WHERE "id" = ${moduleId} AND "graphVersion" = ${graphVersion}
          FOR UPDATE`,
        );
        lockAcquiredAt = performance.now();
        if (modules.length === 0) return false;

        const graph = await transaction.learningGraph.findUnique({
          where: {
            id: graphId,
            moduleId,
            version: graphVersion,
            status: 'QUEUED',
          },
          select: { id: true },
        });
        if (!graph) return false;

        await transaction.topic.updateMany({
          where: { moduleId, published: true },
          data: { published: false },
        });

        await transaction.topic.updateMany({
          where: { moduleId, id: { in: proposal.topicIds } },
          data: { published: true },
        });

        // Prisma's self-relation orders prerequisites before requiredBy:
        // A is the prerequisite, B is the topic that requires it.
        await transaction.$executeRaw(Prisma.sql`
          DELETE FROM "_TopicDependencies"
          WHERE "B" IN (SELECT jsonb_array_elements_text(${JSON.stringify(proposal.topicIds)}::jsonb))
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "_TopicDependencies" ("A", "B")
          SELECT "prerequisiteId", "topicId"
          FROM jsonb_to_recordset(${JSON.stringify(dependencies)}::jsonb)
            AS relationships("topicId" text, "prerequisiteId" text)
        `);

        await transaction.learningGraph.update({
          where: {
            id: graphId,
            moduleId,
            version: graphVersion,
            status: 'QUEUED',
          },
          data: {
            status: 'COMPLETED',
            finishedAt: new Date(),
            errorMessage: null,
          },
        });
        return true;
      })
      .catch((error: unknown) => {
        const failedAt = performance.now();
        this.logger.error(
          `Publication failed for graph "${graphId}": transaction wait ${Math.round((transactionStartedAt ?? failedAt) - requestedAt)}ms, module lock ${Math.round((lockAcquiredAt ?? failedAt) - (transactionStartedAt ?? failedAt))}ms, total ${Math.round(failedAt - requestedAt)}ms`,
        );
        throw error;
      });
    this.logger.log(
      `Publication ${published ? 'completed' : 'skipped'} for graph "${graphId}": transaction wait ${Math.round(transactionStartedAt! - requestedAt)}ms, module lock ${Math.round(lockAcquiredAt! - transactionStartedAt!)}ms, total ${Math.round(performance.now() - requestedAt)}ms`,
    );

    if (!published) {
      await failQueuedGraphBuild(
        this.prismaService,
        job.data,
        'Graph build became stale before publication',
      );
    }
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
