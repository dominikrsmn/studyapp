import { Injectable } from '@nestjs/common';
import type { DetectCyclesJobData } from '../graph-build.types';

@Injectable()
export class DetectCyclesJob {
  async process(_data: DetectCyclesJobData): Promise<void> {}
}
