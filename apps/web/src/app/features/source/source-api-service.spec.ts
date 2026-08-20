import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SourceDto } from '@study/contracts';
import { environment } from '../../../environments/environment';

import { SourceApiService } from './source-api-service';

describe('SourceApiService', () => {
  let service: SourceApiService;
  let httpTesting: HttpTestingController;

  const moduleId = 'f74a46b6-2d6d-4542-a9b8-37a8eef82d8c';
  const source: SourceDto = {
    id: 'f43ff589-36b0-4f0f-b0cf-9cc1101b1952',
    moduleId,
    name: 'Lecture notes.pdf',
    type: 'DOCUMENT',
    mimeType: 'application/pdf',
    status: 'READY',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SourceApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads all source for a module', () => {
    let result: SourceDto[] | undefined;
    service.findAll(moduleId).subscribe((sources) => (result = sources));

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/module/${moduleId}/source`,
    );
    expect(request.request.method).toBe('GET');
    request.flush([source]);

    expect(result).toEqual([source]);
  });

  it('uploads the source as multipart form data', () => {
    const file = new File(['pdf'], 'Lecture notes.pdf', {
      type: 'application/pdf',
    });
    service.create(moduleId, { moduleId, file }).subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/module/${moduleId}/source`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush(source);
  });

  it('deletes a source from its module', () => {
    service.delete(moduleId, source.id).subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/module/${moduleId}/source/${source.id}`,
    );
    expect(request.request.method).toBe('DELETE');
    request.flush(source);
  });
});
