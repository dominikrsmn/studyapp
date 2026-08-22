import { Test, TestingModule } from '@nestjs/testing';
import { TopicMergingService } from './topic-merging.service';

describe('TopicReconcilerService', () => {
  let service: TopicMergingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicMergingService],
    }).compile();

    service = module.get<TopicMergingService>(TopicMergingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
