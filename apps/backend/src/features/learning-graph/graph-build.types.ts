export interface GraphBuildJobData {
  graphId: string;
  moduleId: string;
  graphVersion: number;
}

export type DispatchCandidatesJobData = GraphBuildJobData;

export interface FindCandidatesJobData extends GraphBuildJobData {
  topicId: string;
  embedding: number[];
  evidence: {
    id: string;
    topicId: string;
    embedding: number[];
  }[];
}

export interface CreateGraphJobData extends GraphBuildJobData {
  topicId: string;
  candidateTopicIds: string[];
}

export interface GraphProposal {
  topicIds: string[];
  dependencies: { topicId: string; dependsOnTopicId: string }[];
}

export interface RefineGraphJobData extends GraphBuildJobData {}

export interface DetectCyclesJobData extends GraphBuildJobData {
  graph: GraphProposal;
}

export type GraphJobData =
  | DispatchCandidatesJobData
  | FindCandidatesJobData
  | CreateGraphJobData
  | RefineGraphJobData
  | DetectCyclesJobData;
