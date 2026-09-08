import { Injectable } from '@nestjs/common';
import type { CreateGraphJobData } from '../graph-build.types';

@Injectable()
export class CreateGraphJob {
  async process(_data: CreateGraphJobData): Promise<void> {}
}
