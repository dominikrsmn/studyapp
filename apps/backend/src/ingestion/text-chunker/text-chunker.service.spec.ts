import { Test, TestingModule } from '@nestjs/testing';
import { TextChunkerService } from './text-chunker.service';

describe('TextChunkerService', () => {
  let service: TextChunkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextChunkerService],
    }).compile();

    service = module.get<TextChunkerService>(TextChunkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
