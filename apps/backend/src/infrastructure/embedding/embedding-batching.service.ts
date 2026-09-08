import { Injectable } from '@nestjs/common';

@Injectable()
export class EmbeddingBatchingService {
  // TODO: Split embedding inputs using the configured API batch size.
  batchTopicIds(_topicIds: string[]): void {}

  batchEvidenceIds(_topicEvidenceIds: string[]): void {}
}
