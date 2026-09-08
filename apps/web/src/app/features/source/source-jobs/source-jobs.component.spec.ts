import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SourceJobsComponent } from './source-jobs.component';
import { SourceApiService } from '../source-api-service';
import { Z_MODAL_DATA } from '../../../shared/components/dialog';

describe('SourceJobsComponent', () => {
  const getJobs = vi.fn();
  beforeEach(() => {
    getJobs.mockReset();
    TestBed.configureTestingModule({
      imports: [SourceJobsComponent],
      providers: [
        { provide: SourceApiService, useValue: { getJobs } },
        {
          provide: Z_MODAL_DATA,
          useValue: { id: 'source', moduleId: 'module' },
        },
      ],
    });
  });

  it('shows a legacy source without inventing zero costs', () => {
    getJobs.mockReturnValue(
      of({
        jobs: [],
        recordedCostUsd: null,
        processingStages: [{ stage: 'TOPIC_ANALYSIS', state: 'COMPLETED' }],
      }),
    );
    const fixture = TestBed.createComponent(SourceJobsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No detailed job history',
    );
    expect(fixture.nativeElement.textContent).toContain('Topic analysis');
    expect(fixture.nativeElement.textContent).not.toContain('$0.00000000');
  });

  it('distinguishes missing costs from a recorded zero', () => {
    const job = {
      name: 'extract-source-topics',
      attempt: 1,
      state: 'COMPLETED',
      startedAt: '2026-09-08T10:00:00Z',
      shared: false,
    };
    getJobs.mockReturnValue(
      of({
        jobs: [
          { ...job, id: '1', costUsd: null },
          { ...job, id: '2', costUsd: '0.00000000' },
        ],
        recordedCostUsd: '0.00000000',
        processingStages: [],
      }),
    );
    const fixture = TestBed.createComponent(SourceJobsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Not recorded');
    expect(fixture.nativeElement.textContent).toContain('$0.00000000');
  });

  it('allows retry after a failed load', () => {
    getJobs
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValue(
        of({ jobs: [], recordedCostUsd: null, processingStages: [] }),
      );
    const fixture = TestBed.createComponent(SourceJobsComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(getJobs).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
