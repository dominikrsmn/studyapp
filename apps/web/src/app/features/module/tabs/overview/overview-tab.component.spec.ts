import { TestBed } from '@angular/core/testing';
import type { TopicOverviewDto } from '@study/contracts';
import { of } from 'rxjs';
import { AiApiService } from '../../../ai/ai-api.service';
import { TopicApiService } from '../../../topic/topic-api.service';
import OverviewTabComponent from './overview-tab.component';

describe('OverviewTabComponent', () => {
  const topics: TopicOverviewDto[] = [
    {
      id: 'e627260b-4a01-4abd-b021-3f4b3fbbb6f7',
      title: 'Integral Calculus',
      description: 'Techniques for evaluating integrals.',
      summary: 'How integral techniques are selected and applied.',
      sourceTopics: [
        {
          id: 'f402a225-d7f0-4f5a-a7bc-16ac116553ac',
          title: 'Integration by Parts',
          description: 'Derivation of the integration-by-parts formula.',
          pageStart: 12,
          pageEnd: 16,
          source: {
            id: '63e87239-1162-408f-a9a0-6ab7db38d02f',
            name: 'Lecture 07 — Integration.pdf',
          },
        },
      ],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewTabComponent],
      providers: [
        {
          provide: TopicApiService,
          useValue: { findAll: vi.fn(() => of(topics)) },
        },
        {
          provide: AiApiService,
          useValue: { ask: vi.fn() },
        },
      ],
    }).compileComponents();
  });

  it('shows topics as accordions and SourceTopics inside them', () => {
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector<HTMLButtonElement>(
      '[data-slot="accordion-trigger"]',
    );

    expect(trigger?.textContent).toContain('Integral Calculus');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    trigger?.click();
    fixture.detectChanges();

    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(element.textContent).toContain('Integration by Parts');
    expect(element.textContent).toContain('Lecture 07 — Integration.pdf');
    expect(element.textContent).toContain('Pages 12–16');
    expect(element.textContent).not.toMatch(/Strong|Developing|Needs practice/);
  });
});
