import { TestBed } from '@angular/core/testing';

import { ModulesApiService } from './modules-api-service';

describe('ModulesApiService', () => {
  let service: ModulesApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ModulesApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
