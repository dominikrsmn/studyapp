import { Test, TestingModule } from '@nestjs/testing';
import { TopicReconciliationService } from './topic-reconciliation.service';

describe('TopicReconcilerService', () => {
  let service: TopicReconciliationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicReconciliationService],
    }).compile();

    service = module.get<TopicReconciliationService>(
      TopicReconciliationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
