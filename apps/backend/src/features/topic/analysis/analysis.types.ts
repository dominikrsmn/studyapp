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
  index: number;
  startRef: string;
  endRef: string;
}
export interface BoundaryMergeResult {
  boundaries: MergedBoundary[];
  spans: TopicSpan[];
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
