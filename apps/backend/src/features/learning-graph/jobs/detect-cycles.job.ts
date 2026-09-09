import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type {
  DetectCyclesJobData,
  GetPrerequisitesJobResult,
  GraphProposal,
} from '../graph-build.types';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';

enum VisitState {
  VISITED,
  UNVISITED,
  VISITING,
}

@Injectable()
export class DetectCyclesJob {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly openAiService: OpenAiService,
  ) {}

  async process(job: Job<DetectCyclesJobData>): Promise<GraphProposal | void> {
    const graph = await this.prismaService.learningGraph.findUnique({
      where: {
        id: job.data.graphId,
        moduleId: job.data.moduleId,
        version: job.data.graphVersion,
        module: { graphVersion: job.data.graphVersion },
      },
      select: { id: true },
    });
    if (!graph) return;

    const childResults = Object.values(
      await job.getChildrenValues<GetPrerequisitesJobResult>(),
    );
    const rawGraph: GraphProposal = {
      topicIds: childResults.map(({ topicId }) => topicId),
      dependencies: childResults.flatMap(({ topicId, prerequisites }) =>
        prerequisites.map(({ topicId: dependsOnTopicId }) => ({
          topicId,
          dependsOnTopicId,
        })),
      ),
    };
    const visitStates = new Map<string, VisitState>(
      rawGraph.topicIds.map((topicId) => [topicId, VisitState.UNVISITED]),
    );
    const adjacencyList = new Map<string, Set<string>>(
      rawGraph.topicIds.map((topicId) => [topicId, new Set<string>()]),
    );
    for (const dependency of rawGraph.dependencies) {
      adjacencyList.get(dependency.topicId)?.add(dependency.dependsOnTopicId);
    }

    const path: string[] = [];
    for (const topicId of rawGraph.topicIds) {
      if (visitStates.get(topicId) == VisitState.UNVISITED) {
        dfs(topicId);
      }
    }

    function dfs(topicId: string) {
      visitStates.set(topicId, VisitState.VISITING);
      path.push(topicId);
      const dependencies: Set<string> | undefined = adjacencyList.get(topicId)!;
      for (const dependency of dependencies) {
        if (visitStates.get(dependency) == VisitState.VISITING) {
          // cycle detected
        } else if (visitStates.get(dependency) == VisitState.UNVISITED) {
          dfs(dependency);
        }
      }
      visitStates.set(topicId, VisitState.VISITED);
      path.pop();
    }
  }
}
