import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type {
  DetectCyclesJobData,
  GetPrerequisitesJobResult,
  GraphProposal,
} from '../graph-build.types';
import { OpenAiService } from '../../../infrastructure/open-ai/open-ai.service';

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
    const cyclicComponents = this.findStronglyConnectedComponents(
      rawGraph,
    ).filter(
      (component) =>
        component.length > 1 ||
        rawGraph.dependencies.some(
          ({ topicId, dependsOnTopicId }) =>
            topicId === component[0] && dependsOnTopicId === component[0],
        ),
    );
    if (cyclicComponents.length === 0) return rawGraph;

    // Resolve cyclicComponents before returning the graph.
    return rawGraph;
  }

  private findStronglyConnectedComponents(graph: GraphProposal): string[][] {
    const adjacencyList = new Map<string, Set<string>>(
      graph.topicIds.map((topicId) => [topicId, new Set<string>()]),
    );
    for (const dependency of graph.dependencies) {
      adjacencyList.get(dependency.topicId)?.add(dependency.dependsOnTopicId);
    }

    let nextIndex = 0;
    const indexes = new Map<string, number>();
    const lowLinks = new Map<string, number>();
    const stack: string[] = [];
    const topicsOnStack = new Set<string>();
    const components: string[][] = [];

    function dfs(topicId: string): void {
      const index = nextIndex++;
      indexes.set(topicId, index);
      lowLinks.set(topicId, index);
      stack.push(topicId);
      topicsOnStack.add(topicId);

      for (const adjacentTopicId of adjacencyList.get(topicId)!) {
        if (!indexes.has(adjacentTopicId)) {
          dfs(adjacentTopicId);
          lowLinks.set(
            topicId,
            Math.min(lowLinks.get(topicId)!, lowLinks.get(adjacentTopicId)!),
          );
        } else if (topicsOnStack.has(adjacentTopicId)) {
          lowLinks.set(
            topicId,
            Math.min(lowLinks.get(topicId)!, indexes.get(adjacentTopicId)!),
          );
        }
      }

      if (lowLinks.get(topicId) !== index) return;

      const component: string[] = [];
      let componentTopicId: string;
      do {
        componentTopicId = stack.pop()!;
        topicsOnStack.delete(componentTopicId);
        component.push(componentTopicId);
      } while (componentTopicId !== topicId);
      components.push(component);
    }

    for (const topicId of graph.topicIds) {
      if (!indexes.has(topicId)) dfs(topicId);
    }

    return components;
  }
}
