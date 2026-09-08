import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { FlowProducer, Queue } from 'bullmq';
import { graphBuildConfig } from './graph-build.config';
import type {
  CreateGraphJobData,
  DetectCyclesJobData,
  FindCandidatesJobData,
  GraphBuildJobData,
  GraphJobData,
  RefineGraphJobData,
} from './graph-build.types';

@Injectable()
export class GraphBuildQueue {
  constructor(
    @InjectQueue(graphBuildConfig().queue.name)
    private readonly queue: Queue<GraphJobData>,
    @InjectFlowProducer(graphBuildConfig().flowProducer.name)
    private readonly flowProducer: FlowProducer,
  ) {}

  // TODO: Embedding children must finish before dispatch-candidate-batches runs.
  async addEmbeddingFlow(_data: GraphBuildJobData): Promise<void> {}

  // TODO: Create the candidate batches and their downstream dependency flow.
  async addCandidateFlow(
    _data: GraphBuildJobData,
    _topicBatches: string[][],
  ): Promise<void> {}

  async addFindCandidates(_data: FindCandidatesJobData): Promise<void> {}

  async addCreateGraph(_data: CreateGraphJobData): Promise<void> {}

  async addRefineGraph(_data: RefineGraphJobData): Promise<void> {}

  async addDetectCycles(_data: DetectCyclesJobData): Promise<void> {}
}
