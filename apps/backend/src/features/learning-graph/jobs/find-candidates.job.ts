import { Injectable } from '@nestjs/common';
import type { FindCandidatesJobData } from '../graph-build.types';

@Injectable()
export class FindCandidatesJob {
  async process(_data: FindCandidatesJobData): Promise<void> {}
}
