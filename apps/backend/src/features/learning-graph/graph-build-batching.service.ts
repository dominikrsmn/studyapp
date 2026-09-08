import { Injectable } from '@nestjs/common';

@Injectable()
export class GraphBuildBatchingService {
  // TODO: Split target topics into batches of 30; merge a final batch below 10.
  batchTopicIds(_topicIds: string[]): void {}
}
