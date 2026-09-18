import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type {
  GroupedGraphProposal,
  PublishGraphJobData,
} from '../graph-build.types';
import { failQueuedGraphBuild } from '../graph-build.outcome';

@Injectable()
export class PublishGraphJob {
  private readonly logger = new Logger(PublishGraphJob.name);
  constructor(private readonly prismaService: PrismaService) {}

  async process(job: Job<PublishGraphJobData>): Promise<void> {
    const [proposal] = Object.values(
      await job.getChildrenValues<GroupedGraphProposal | null>(),
    );
    await this.processProposal(job.data, proposal);
  }

  async processProposal(
    data: PublishGraphJobData,
    proposal: GroupedGraphProposal | null | undefined,
  ): Promise<void> {
    if (!proposal) {
      await failQueuedGraphBuild(
        this.prismaService,
        data,
        'Graph build became stale before publication',
      );
      return;
    }

    const { graphId, moduleId, graphVersion } = data;
    const dependencies = proposal.dependencies.map(
      ({ topicId, dependsOnTopicId }) => ({
        topicId,
        prerequisiteId: dependsOnTopicId,
      }),
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
        // A is the topic that requires the prerequisite in B.
        await transaction.$executeRaw(Prisma.sql`
          DELETE FROM "_TopicDependencies"
          WHERE "A" IN (SELECT jsonb_array_elements_text(${JSON.stringify(proposal.topicIds)}::jsonb))
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "_TopicDependencies" ("A", "B")
          SELECT "topicId", "prerequisiteId"
          FROM jsonb_to_recordset(${JSON.stringify(dependencies)}::jsonb)
            AS relationships("topicId" text, "prerequisiteId" text)
        `);

        await transaction.$executeRaw(Prisma.sql`
          DELETE FROM "LearningUnit" WHERE "moduleId" = ${moduleId}
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "LearningUnit" ("id", "moduleId", "title", "summary", "topicIds", "entryTopicId", "exitTopicIds")
          SELECT "id", ${moduleId}, "title", "summary", "topicIds", "entryTopicId", "exitTopicIds"
          FROM jsonb_to_recordset(${JSON.stringify(proposal.units)}::jsonb)
            AS units("id" text, "title" text, "summary" text, "topicIds" text[], "entryTopicId" text, "exitTopicIds" text[])
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "LearningUnitOrdering" ("sourceUnitId", "destinationUnitId")
          SELECT "sourceUnitId", "destinationUnitId"
          FROM jsonb_to_recordset(${JSON.stringify(proposal.ordering)}::jsonb)
            AS ordering("sourceUnitId" text, "destinationUnitId" text)
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
        data,
        'Graph build became stale before publication',
      );
    }
  }
}
