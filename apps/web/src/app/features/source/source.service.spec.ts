import { TestBed } from '@angular/core/testing';
import { SourceDto, SourceStateChangedEvent } from '@study/contracts';
import { of, Subject } from 'rxjs';
import { SourceApiService } from './source-api-service';
import {
  SourceEventConnectionOptions,
  SourceEventsService,
} from './source-events.service';
import { SourceService } from './source.service';

describe('SourceService', () => {
  const moduleId = 'f74a46b6-2d6d-4542-a9b8-37a8eef82d8c';
  const source: SourceDto = {
    id: 'f43ff589-36b0-4f0f-b0cf-9cc1101b1952',
    moduleId,
    name: 'Lecture notes.pdf',
    type: 'DOCUMENT',
    mimeType: 'application/pdf',
    status: 'PROCESSED',
  };
  const sourceApi = {
    findAll: vi.fn(),
  };
  const stateChanges = new Subject<SourceStateChangedEvent>();
  const stateChangesMock =
    vi.fn<
      (
        moduleId: string,
        options?: SourceEventConnectionOptions,
      ) => Subject<SourceStateChangedEvent>
    >();
  const sourceEvents = {
    stateChanges: stateChangesMock,
  };

  beforeEach(() => {
    sourceApi.findAll.mockReset();
    stateChangesMock.mockReset();
    stateChangesMock.mockReturnValue(stateChanges);
    TestBed.configureTestingModule({
      providers: [
        { provide: SourceApiService, useValue: sourceApi },
        { provide: SourceEventsService, useValue: sourceEvents },
      ],
    });
  });

  it('refreshes the database snapshot whenever the event stream opens', async () => {
    sourceApi.findAll.mockReturnValue(of([source]));
    const service = TestBed.inject(SourceService);

    service.watchStateChanges(moduleId).subscribe();
    const options = sourceEvents.stateChanges.mock.calls[0]?.[1] as
      SourceEventConnectionOptions | undefined;

    await options?.onOpen?.();
    await options?.onOpen?.();

    expect(sourceApi.findAll).toHaveBeenCalledTimes(2);
    expect(sourceApi.findAll).toHaveBeenNthCalledWith(1, moduleId);
    expect(sourceApi.findAll).toHaveBeenNthCalledWith(2, moduleId);
    expect(service.sources()).toEqual([source]);
  });

  it('does not let an older load overwrite a reconnect snapshot', async () => {
    const initialLoad = new Subject<SourceDto[]>();
    const reconnectLoad = new Subject<SourceDto[]>();
    sourceApi.findAll
      .mockReturnValueOnce(initialLoad)
      .mockReturnValueOnce(reconnectLoad);
    const service = TestBed.inject(SourceService);

    service.loadAll(moduleId).subscribe();
    service.watchStateChanges(moduleId).subscribe();
    const options = sourceEvents.stateChanges.mock.calls[0]?.[1] as
      SourceEventConnectionOptions | undefined;
    const reconnect = options?.onOpen?.();

    reconnectLoad.next([source]);
    initialLoad.next([{ ...source, status: 'PROCESSING' }]);
    await reconnect;

    expect(service.sources()).toEqual([source]);
  });

  it('applies transient processing info from state events', () => {
    sourceApi.findAll.mockReturnValue(of([source]));
    const service = TestBed.inject(SourceService);

    service.loadAll(moduleId).subscribe();
    service.watchStateChanges(moduleId).subscribe();
    stateChanges.next({
      sourceId: source.id,
      moduleId,
      processingState: 'PROCESSING',
      info: 'Extracting topics…',
    });

    expect(service.sources()).toEqual([
      {
        ...source,
        status: 'PROCESSING',
        processingInfo: 'Extracting topics…',
      },
    ]);

    stateChanges.next({
      sourceId: source.id,
      moduleId,
      processingState: 'PROCESSED',
    });

    expect(service.sources()[0]).toMatchObject({
      ...source,
      status: 'PROCESSED',
      processingInfo: undefined,
    });
  });
});
