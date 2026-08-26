export type AnalysisJobData =
  | PrepareTopicAnalysis
  | DetectBoundaries
  | MergeBoundaries
  | ExtractSourceTopics
  | MatchSourceTopics
  | FinalizeTopicAnalysis;

export interface PrepareTopicAnalysis {
  sourceId: string;
}
export interface DetectBoundaries {
  sourceId: string;
  window_refs: string[];
}
export interface MergeBoundaries {
  sourceId: string;
}
export interface ExtractSourceTopics {
  sourceId: string;
  span_descriptors: string[];
}
export interface MatchSourceTopics {
  sourceId: string;
}
export interface FinalizeTopicAnalysis {
  sourceId: string;
}
