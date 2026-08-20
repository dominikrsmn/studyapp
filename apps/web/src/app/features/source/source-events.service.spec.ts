import { TestBed } from '@angular/core/testing';

import { SourceEventsService } from './source-events.service';

describe('SourceEventsService', () => {
  let service: SourceEventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SourceEventsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
