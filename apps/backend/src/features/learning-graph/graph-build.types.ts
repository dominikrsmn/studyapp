export interface GraphBuildJobData {
  graphId: string;
  moduleId: string;
  graphVersion: number;
}

export type DispatchCandidatesJobData = GraphBuildJobData;

export interface GetPrerequisitesJobData extends GraphBuildJobData {
  topicId: string;
  candidateTopicIds: string[];
}

export interface GetPrerequisitesJobResult {
  topicId: string;
  prerequisites: { topicId: string; justification: string }[];
}

export interface GraphProposal {
  topicIds: string[];
  dependencies: { topicId: string; dependsOnTopicId: string }[];
}

export type RefineGraphJobData = GraphBuildJobData;

export type DetectCyclesJobData = GraphBuildJobData;

export type GraphJobData =
  | DispatchCandidatesJobData
  | GetPrerequisitesJobData
  | RefineGraphJobData
  | DetectCyclesJobData;
