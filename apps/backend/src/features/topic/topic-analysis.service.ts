import { Injectable } from '@nestjs/common';

@Injectable()
export class TopicAnalysisService {
  async analyze(_moduleId: string): Promise<void> {}
}
