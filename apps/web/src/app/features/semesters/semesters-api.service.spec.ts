import { TestBed } from '@angular/core/testing';

import { SemestersApiService } from './semesters-api.service';

describe('SemestersApiService', () => {
  let service: SemestersApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SemestersApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
