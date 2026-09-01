import { Test, TestingModule } from '@nestjs/testing';
import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { FileStorageService } from './filestorage.service';
import { fileStorageConfig } from '../config/filestorage.config';

jest.mock('node:fs/promises', () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
  readFile: jest.fn(),
  rename: jest.fn(),
  rm: jest.fn(),
  writeFile: jest.fn(),
}));

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        { provide: fileStorageConfig.KEY, useValue: fileStorageConfig() },
      ],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);
    jest.clearAllMocks();
    jest.mocked(rm).mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('atomically stores the converted Docling document', async () => {
    const document = Buffer.from('{"schema_name":"DoclingDocument"}');

    await service.saveDoclingDocument('source-id', document);

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/uploads\/source-id\/docling\.json\..+\.tmp$/),
      document,
    );
    expect(rename).toHaveBeenCalledWith(
      expect.stringMatching(/uploads\/source-id\/docling\.json\..+\.tmp$/),
      expect.stringMatching(/uploads\/source-id\/docling\.json$/),
    );
  });

  it('reads a stored Docling document', async () => {
    const document = Buffer.from('{"schema_name":"DoclingDocument"}');
    jest.mocked(readFile).mockResolvedValue(document);

    await expect(service.readDoclingDocument('source-id')).resolves.toBe(
      document,
    );
  });

  it('returns null when a Docling document does not exist', async () => {
    jest
      .mocked(readFile)
      .mockRejectedValue(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      );

    await expect(service.readDoclingDocument('source-id')).resolves.toBeNull();
  });

  it('checks whether a Docling document exists', async () => {
    jest.mocked(access).mockResolvedValue(undefined);

    await expect(service.hasDoclingDocument('source-id')).resolves.toBe(true);

    jest
      .mocked(access)
      .mockRejectedValue(
        Object.assign(new Error('missing'), { code: 'ENOENT' }),
      );

    await expect(service.hasDoclingDocument('source-id')).resolves.toBe(false);
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
