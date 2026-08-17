import { Test, TestingModule } from '@nestjs/testing';
import { FilestorageService } from './filestorage.service';

describe('FilestorageService', () => {
  let service: FilestorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilestorageService],
    }).compile();

    service = module.get<FilestorageService>(FilestorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
