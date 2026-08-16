import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SourceController } from './source.controller';
import { SourceService } from './source.service';
import type { SourceUploadFile } from './source.types';

jest.mock('./source.service', () => ({
  SourceService: class SourceService {
    uploadSource = jest.fn();
  },
}));

describe('SourceController', () => {
  let controller: SourceController;
  const request = { userId: 'user-id' } as AuthenticatedRequest;
  const sourceService = {
    uploadSource: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SourceController],
      providers: [
        {
          provide: SourceService,
          useValue: sourceService,
        },
      ],
    }).compile();

    controller = module.get<SourceController>(SourceController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uploads a pdf source for the authenticated user', async () => {
    const file = createFile('notes.pdf', 'application/pdf');
    sourceService.uploadSource.mockResolvedValue({ id: 'source-id' });

    await controller.uploadSource(
      request,
      { moduleId: '2e5c9c12-a0bd-455b-8411-9564e38e81d6' },
      file,
    );

    expect(sourceService.uploadSource).toHaveBeenCalledWith(
      'user-id',
      '2e5c9c12-a0bd-455b-8411-9564e38e81d6',
      file,
    );
  });

  it('rejects missing file upload', () => {
    expect(() =>
      controller.uploadSource(request, {
        moduleId: '2e5c9c12-a0bd-455b-8411-9564e38e81d6',
      }),
    ).toThrow(BadRequestException);
    expect(sourceService.uploadSource).not.toHaveBeenCalled();
  });

  it('rejects non-pdf uploads', () => {
    expect(() =>
      controller.uploadSource(
        request,
        { moduleId: '2e5c9c12-a0bd-455b-8411-9564e38e81d6' },
        createFile('notes.txt', 'text/plain'),
      ),
    ).toThrow(BadRequestException);
    expect(sourceService.uploadSource).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads', () => {
    expect(() =>
      controller.uploadSource(request, { moduleId: 'not-a-uuid' }, createFile()),
    ).toThrow(BadRequestException);
    expect(sourceService.uploadSource).not.toHaveBeenCalled();
  });
});

function createFile(
  originalName = 'notes.pdf',
  mimetype = 'application/pdf',
): SourceUploadFile {
  return {
    originalname: originalName,
    mimetype,
  };
}
