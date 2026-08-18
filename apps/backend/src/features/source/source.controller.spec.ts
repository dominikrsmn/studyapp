import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import {
  ModuleSourcesController,
  SourcesController,
} from './source.controller';
import { SourceService } from './source.service';

describe('Source controllers', () => {
  let moduleSourcesController: ModuleSourcesController;
  let sourcesController: SourcesController;
  const request = { userId: 'user-id' } as AuthenticatedRequest;
  const sourceService = {
    uploadSource: jest.fn(),
    findAll: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModuleSourcesController, SourcesController],
      providers: [{ provide: SourceService, useValue: sourceService }],
    }).compile();

    moduleSourcesController = module.get(ModuleSourcesController);
    sourcesController = module.get(SourcesController);
    jest.clearAllMocks();
  });

  it('uploads a source to the module from the URL', async () => {
    const file = createFile();
    sourceService.uploadSource.mockResolvedValue({ id: 'source-id' });

    await moduleSourcesController.uploadSource(request, 'module-id', file);

    expect(sourceService.uploadSource).toHaveBeenCalledWith(
      'user-id',
      'module-id',
      file,
    );
  });

  it('lists sources belonging to a module', async () => {
    sourceService.findAll.mockResolvedValue([]);

    await moduleSourcesController.findAll(request, 'module-id');

    expect(sourceService.findAll).toHaveBeenCalledWith('user-id', 'module-id');
  });

  it('deletes a source by id', async () => {
    sourceService.remove.mockResolvedValue({ id: 'source-id' });

    await sourcesController.deleteSource(request, 'source-id');

    expect(sourceService.remove).toHaveBeenCalledWith('user-id', 'source-id');
  });
});

function createFile(): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'notes.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 3,
    buffer: Buffer.from('pdf'),
    stream: undefined as never,
    destination: '',
    filename: 'notes.pdf',
    path: '',
  } as Express.Multer.File;
}
