import { Test, TestingModule } from '@nestjs/testing';
import { TopicReconcilerService } from './topic-reconciler.service';

describe('TopicReconcilerService', () => {
  let service: TopicReconcilerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TopicReconcilerService],
    }).compile();

    service = module.get<TopicReconcilerService>(TopicReconcilerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
