import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { OpenAiService } from './open-ai.service';
import { openAiConfig } from '../config/open-ai.config';

describe('OpenAiService', () => {
  let service: OpenAiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAiService,
        {
          provide: openAiConfig.KEY,
          useValue: { apiKey: 'test-api-key' },
        },
      ],
    }).compile();

    service = module.get<OpenAiService>(OpenAiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
