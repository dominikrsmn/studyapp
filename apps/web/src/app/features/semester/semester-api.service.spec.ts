import { TestBed } from '@angular/core/testing';

import { SemesterApiService } from './semester-api.service';

describe('SemesterApiService', () => {
  let service: SemesterApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SemesterApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
