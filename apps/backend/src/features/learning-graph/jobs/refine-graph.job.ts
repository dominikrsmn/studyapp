import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { GraphProposal, RefineGraphJobData } from '../graph-build.types';
import { failQueuedGraphBuild } from '../graph-build.outcome';

@Injectable()
export class RefineGraphJob {
  constructor(private readonly prismaService: PrismaService) {}

  async process(job: Job<RefineGraphJobData>): Promise<GraphProposal | void> {
    const [proposal] = Object.values(
      await job.getChildrenValues<GraphProposal | null>(),
    );
    if (!proposal) {
      await failQueuedGraphBuild(
        this.prismaService,
        job.data,
        'Graph build became stale before refinement',
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

    return {
      topicIds: proposal.topicIds,
      dependencies: [...reducedPrerequisites].flatMap(([topicId, ids]) =>
        ids.map((dependsOnTopicId) => ({ topicId, dependsOnTopicId })),
      ),
    };
  }
}
