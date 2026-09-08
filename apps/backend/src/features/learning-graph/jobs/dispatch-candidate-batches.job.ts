import { Injectable } from '@nestjs/common';
import type { DispatchCandidateBatchesJobData } from '../graph-build.types';

@Injectable()
export class DispatchCandidateBatchesJob {
  async process(_data: DispatchCandidateBatchesJobData): Promise<void> {}
}
