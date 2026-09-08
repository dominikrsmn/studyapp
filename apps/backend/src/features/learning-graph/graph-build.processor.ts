import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { graphBuildConfig } from './graph-build.config';
import type { GraphJobData } from './graph-build.types';

@Processor(graphBuildConfig().queue.name, {
  concurrency: graphBuildConfig().queue.concurrency,
})
export class GraphBuildProcessor extends WorkerHost {
  // TODO: Dispatch to job handlers when the pipeline is implemented.
  async process(_job: Job<GraphJobData>): Promise<void> {}
}
