import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { SemesterService } from '../semester/semester.service';
import ModuleComponent from './module.component';
import { ModuleService } from './module.service';

describe('ModuleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuleComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ id: 'module-1' }),
            data: of({ moduleTab: 'overview' }),
          },
        },
        {
          provide: Router,
          useValue: { navigate: vi.fn().mockResolvedValue(true) },
        },
        {
          provide: ModuleService,
          useValue: {
            findById: () => ({
              id: 'module-1',
              name: 'Mathematics II',
              examDate: '2026-09-01',
            }),
          },
        },
        {
          provide: SemesterService,
          useValue: { activeSemester: signal(undefined) },
        },
      ],
    }).compileComponents();
  });

  it('compacts and restores the header as the content viewport scrolls', () => {
    const fixture = TestBed.createComponent(ModuleComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const header = element.querySelector('header');
    const viewport = element.querySelector('[role="tabpanel"]')?.parentElement;

    expect(header).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!header || !viewport) {
      throw new Error('Expected the module header and content viewport');
    }

    viewport.scrollTop = 40;
    viewport.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(header.classList).toContain('module-header--compact');

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(header.classList).not.toContain('module-header--compact');
  });
});
