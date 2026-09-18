import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import type {
  GroupedGraphProposal,
  RecoverGraphJobData,
} from '../graph-build.types';
import { GroupTopicsJob } from './group-topics.job';
import { PublishGraphJob } from './publish-graph.job';

@Injectable()
export class RecoverGraphJob {
  constructor(
    private readonly groupTopicsJob: GroupTopicsJob,
    private readonly publishGraphJob: PublishGraphJob,
  ) {}

  async process(job: Job<RecoverGraphJobData>): Promise<void> {
    let proposal: GroupedGraphProposal;
    if (job.data.stage === 'GROUPING') {
      const grouped = await this.groupTopicsJob.processProposal(
        job.data,
        job.data.proposal,
      );
      if (!grouped) return;
      proposal = grouped;
      await job.updateData({
        ...job.data,
        stage: 'PUBLICATION',
        proposal,
      });
    } else {
      proposal = job.data.proposal;
    }

    await this.publishGraphJob.processProposal(job.data, proposal);
  }
}
