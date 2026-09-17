import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { graphlib, layout } from '@dagrejs/dagre';
import type { PublishedLearningGraphDto } from '@study/contracts';
import { LearningGraphApiService } from '../../../learning-graph/learning-graph-api.service';

@Component({
  selector: 'app-overview-tab',
  templateUrl: './overview-tab.component.html',
})
export default class OverviewTabComponent {
  readonly moduleId = input.required<string>();

  private readonly graphApi = inject(LearningGraphApiService);
  protected readonly graph = signal<PublishedLearningGraphDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly nodeWidth = 256;
  protected readonly nodeHeight = 128;

  protected readonly diagram = computed(() => {
    const topics = [...(this.graph()?.topics ?? [])].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    const prerequisites = new Set(
      topics.flatMap((topic) => topic.prerequisiteIds),
    );
    const connected = topics.filter(
      (topic) =>
        topic.prerequisiteIds.length > 0 || prerequisites.has(topic.id),
    );
    const isolated = topics.filter(
      (topic) =>
        topic.prerequisiteIds.length === 0 && !prerequisites.has(topic.id),
    );
    const graph = new graphlib.Graph()
      .setGraph({
        rankdir: 'LR',
        ranksep: 96,
        nodesep: 40,
        marginx: 24,
        marginy: 24,
      })
      .setDefaultEdgeLabel(() => ({}));
    for (const topic of connected) {
      graph.setNode(topic.id, {
        width: this.nodeWidth,
        height: this.nodeHeight,
      });
    }
    for (const topic of connected) {
      for (const prerequisiteId of [...topic.prerequisiteIds].sort()) {
        graph.setEdge(prerequisiteId, topic.id);
      }
    }
    if (connected.length) layout(graph);

    const connectedHeight = connected.length ? graph.graph().height! : 0;
    const isolatedY = connectedHeight + 64;
    const nodes = connected.map((topic) => ({
      ...topic,
      x: graph.node(topic.id).x - this.nodeWidth / 2,
      y: graph.node(topic.id).y - this.nodeHeight / 2,
    }));
    const isolatedNodes = isolated.map((topic, index) => ({
      ...topic,
      x: 24 + index * (this.nodeWidth + 40),
      y: isolatedY,
    }));
    const titles = new Map(topics.map((topic) => [topic.id, topic.title]));
    const edges = graph.edges().map((edge) => {
      const points = graph.edge(edge).points;
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let index = 1; index < points.length - 1; index++) {
        const point = points[index];
        const next = points[index + 1];
        path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
      }
      const end = points[points.length - 1];
      path += ` L ${end.x} ${end.y}`;
      return {
        id: `${edge.v}-${edge.w}`,
        label: `${titles.get(edge.v)} is a prerequisite for ${titles.get(edge.w)}`,
        path,
      };
    });
    return {
      nodes,
      isolatedNodes,
      edges,
      isolatedY,
      width: Math.max(
        connected.length ? graph.graph().width! : 0,
        isolated.length * (this.nodeWidth + 40) + 8,
        304,
      ),
      height: isolated.length
        ? isolatedY + this.nodeHeight + 24
        : connectedHeight,
    };
  });

  constructor() {
    effect((onCleanup) => {
      const moduleId = this.moduleId();
      this.loading.set(true);
      this.error.set(false);
      this.graph.set(null);
      const subscription = this.graphApi.findPublished(moduleId).subscribe({
        next: (graph) => {
          this.graph.set(graph);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
