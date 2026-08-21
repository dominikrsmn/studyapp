import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SourcesController } from './source.controller';
import { SourceEventService } from './source-event.service';
import { SourceService } from './source.service';

jest.mock('./source-event.service', () => ({
  SourceEventService: class SourceEventService {},
}));
jest.mock('./source.service', () => ({
  SourceService: class SourceService {},
}));

describe('SourcesController', () => {
  let sourcesController: SourcesController;
  const request = { userId: 'user-id' } as AuthenticatedRequest;
  const sourceService = {
    uploadSource: jest.fn(),
    findAll: jest.fn(),
    remove: jest.fn(),
  };
  const sourceEventService = {
    subscribeToStateChanges: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SourcesController],
      providers: [
        { provide: SourceService, useValue: sourceService },
        { provide: SourceEventService, useValue: sourceEventService },
      ],
    }).compile();

    sourcesController = module.get(SourcesController);
    jest.clearAllMocks();
  });

  it('uploads a source to the module from the URL', async () => {
    const file = createFile();
    sourceService.uploadSource.mockResolvedValue({ id: 'source-id' });

    await sourcesController.uploadSource(request, 'module-id', file);

    expect(sourceService.uploadSource).toHaveBeenCalledWith(
      'user-id',
      'module-id',
      file,
    );
  });

  it('lists source belonging to a module', async () => {
    sourceService.findAll.mockResolvedValue([]);

    await sourcesController.findAll(request, 'module-id');

    expect(sourceService.findAll).toHaveBeenCalledWith('user-id', 'module-id');
  });

  it('deletes a source by id', async () => {
    sourceService.remove.mockResolvedValue({ id: 'source-id' });

    await sourcesController.deleteSource(request, 'module-id', 'source-id');

    expect(sourceService.remove).toHaveBeenCalledWith('user-id', 'source-id');
  });

  it('subscribes to state changes for the requested module', () => {
    const events = Symbol('events');
    sourceEventService.subscribeToStateChanges.mockReturnValue(events);

    expect(sourcesController.stateEvents(request, 'module-id')).toBe(events);
    expect(sourceEventService.subscribeToStateChanges).toHaveBeenCalledWith(
      'user-id',
      'module-id',
    );
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
