import { Test, TestingModule } from '@nestjs/testing';
import { rm } from 'node:fs/promises';
import { FileStorageService } from './filestorage.service';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  readFile: jest.fn(),
  rm: jest.fn(),
  writeFile: jest.fn(),
}));

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileStorageService],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('deletes the complete source directory', async () => {
    await service.delete('source-id');

    expect(rm).toHaveBeenCalledWith(
      expect.stringMatching(/uploads\/source-id$/),
      { recursive: true, force: true },
    );
  });

  it('deletes all requested source directories', async () => {
    await service.deleteMany(['first', 'second']);

    expect(rm).toHaveBeenCalledTimes(2);
  });
});
