export type AnalysisJobData =
  | PrepareTopicAnalysis
  | DetectBoundaries
  | MergeBoundaries
  | ExtractSourceTopics
  | MatchSourceTopics
  | FinalizeTopicAnalysis
  | SummarizeTopic;

export interface PrepareTopicAnalysis {
  sourceId: string;
}
export interface AnalysisUnit {
  index: number;
  documentUnitRefs: string[];
}
export interface DetectBoundaries {
  sourceId: string;
  analysisUnit: AnalysisUnit;
}
export interface DetectedBoundary {
  afterRef: string;
  confidence: number;
}
export interface BoundaryDetectionResult {
  boundaries: DetectedBoundary[];
}
export interface MergeBoundaries {
  sourceId: string;
}
export interface BoundaryConfidenceEvidence {
  unitAgreement: number;
  structuralEvidence: number;
  semanticDiscontinuity: number;
  modelDecision: number;
  windowEdgeDistance: number;
  childConfidence: number;
}
export interface MergedBoundary {
  afterRef: string;
  confidence: number;
  evidence: BoundaryConfidenceEvidence;
}
export interface TopicSpan {
  spanIndex: number;
  startRef: string;
  endRef: string;
}
export interface ExtractSourceTopics {
  sourceId: string;
  spans: TopicSpan[];
}
export interface MatchSourceTopics {
  sourceId: string;
}
export interface FinalizeTopicAnalysis {
  sourceId: string;
}
export interface SummarizeTopic {
  topicId: string;
  contentRevision: number;
}
