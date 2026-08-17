import { TestBed } from '@angular/core/testing';

import { SourcesApiService } from './sources-api-service';

describe('SourcesApiService', () => {
  let service: SourcesApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SourcesApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
