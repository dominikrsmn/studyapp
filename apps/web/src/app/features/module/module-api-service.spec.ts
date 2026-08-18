import { TestBed } from '@angular/core/testing';

import { ModuleApiService } from './module-api-service';

describe('ModuleApiService', () => {
  let service: ModuleApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModuleApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
