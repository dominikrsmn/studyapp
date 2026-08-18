import { Test, TestingModule } from '@nestjs/testing';
import { PdfTextExtractorService } from './pdf-text-extractor.service';

describe('PdfTextExtractorService', () => {
  let service: PdfTextExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfTextExtractorService],
    }).compile();

    service = module.get<PdfTextExtractorService>(PdfTextExtractorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
