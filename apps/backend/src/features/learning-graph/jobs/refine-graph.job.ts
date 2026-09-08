import { Injectable } from '@nestjs/common';
import type { RefineGraphJobData } from '../graph-build.types';

@Injectable()
export class RefineGraphJob {
  async process(_data: RefineGraphJobData): Promise<void> {}
}
