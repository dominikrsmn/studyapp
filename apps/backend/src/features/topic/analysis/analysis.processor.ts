import { Processor, WorkerHost } from '@nestjs/bullmq';
import { analysisConfig } from './analysis.config';
import { Inject, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Job } from 'bullmq';
import {
  AnalysisJobData,
  BoundaryDetectionResult,
  DetectBoundaries,
  ExtractSourceTopics,
  FinalizeTopicAnalysis,
  MatchSourceTopics,
  MergeBoundaries,
  PrepareTopicAnalysis,
  SummarizeTopic,
} from './analysis.types';
import { PrepareTopicAnalysisJob } from './jobs/prepare-topic-analysis.job';
import { DetectBoundariesJob } from './jobs/detect-boundaries.job';
import { MergeBoundariesJob } from './jobs/merge-boundaries.job';
import { ExtractSourceTopicsJob } from './jobs/extract-source-topics.job';
import { MatchSourceTopicsJob } from './jobs/match-source-topics.job';
import { FinalizeTopicAnalysisJob } from './jobs/finalize-topic-analysis.job';
import { SummarizeTopicJob } from './jobs/summarize-topic.job';

@Processor(analysisConfig().queue.name, { concurrency: 1 })
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    @Inject(analysisConfig.KEY)
    private readonly config: ConfigType<typeof analysisConfig>,
    private readonly prepareTopicAnalysisJob: PrepareTopicAnalysisJob,
    private readonly detectBoundariesJob: DetectBoundariesJob,
    private readonly mergeBoundariesJob: MergeBoundariesJob,
    private readonly extractSourceTopicsJob: ExtractSourceTopicsJob,
    private readonly matchSourceTopicsJob: MatchSourceTopicsJob,
    private readonly finalizeTopicAnalysisJob: FinalizeTopicAnalysisJob,
    private readonly summarizeTopicJob: SummarizeTopicJob,
  ) {
    super();
  }

  process(job: Job<AnalysisJobData>): Promise<void | BoundaryDetectionResult> {
    this.logger.log(`Processing ${job.name} job: ${job.id}`);
    switch (job.name) {
      case this.config.queue.jobs.prepare_topic_analysis:
        return this.prepareTopicAnalysisJob.process(
          job.data as PrepareTopicAnalysis,
        );
      case this.config.queue.jobs.detect_boundaries:
        return this.detectBoundariesJob.process(job.data as DetectBoundaries);
      case this.config.queue.jobs.merge_boundaries:
        return this.mergeBoundariesJob.process(job as Job<MergeBoundaries>);
      case this.config.queue.jobs.extract_source_topics:
        return this.extractSourceTopicsJob.process(
          job.data as ExtractSourceTopics,
          {
            isFinalAttempt:
              job.attemptsMade + 1 >= (job.opts.attempts ?? 1),
          },
        );
      case this.config.queue.jobs.match_source_topics:
        return this.matchSourceTopicsJob.process(job.data as MatchSourceTopics);
      case this.config.queue.jobs.finalize_topic_analysis:
        return this.finalizeTopicAnalysisJob.process(
          job.data as FinalizeTopicAnalysis,
        );
      case this.config.queue.jobs.summarize_topic:
        return this.summarizeTopicJob.process(job.data as SummarizeTopic);
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
