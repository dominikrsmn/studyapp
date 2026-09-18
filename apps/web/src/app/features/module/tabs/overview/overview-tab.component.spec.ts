import { TestBed } from '@angular/core/testing';
import type { PublishedLearningGraphDto } from '@study/contracts';
import { of, throwError } from 'rxjs';
import { LearningGraphApiService } from '../../../learning-graph/learning-graph-api.service';
import OverviewTabComponent from './overview-tab.component';

describe('OverviewTabComponent', () => {
  const graph: PublishedLearningGraphDto = {
    id: 'graph-id',
    version: 7,
    units: [],
    ordering: [],
    topics: [
      {
        id: 'dependent',
        title: 'Integral Calculus',
        description: 'Techniques for evaluating integrals.',
        prerequisiteIds: ['foundation'],
      },
      {
        id: 'isolated',
        title: 'Probability',
        description: 'Reasoning about chance.',
        prerequisiteIds: [],
      },
      {
        id: 'foundation',
        title: 'Functions',
        description: 'Inputs and outputs.',
        prerequisiteIds: [],
      },
    ],
  };
  const api = {
    findPublished: vi.fn(),
    findLatest: vi.fn(),
    regenerate: vi.fn(),
    retryPublication: vi.fn(),
  };

  beforeEach(async () => {
    api.findPublished.mockReset().mockReturnValue(of(graph));
    api.findLatest.mockReset().mockReturnValue(of(null));
    api.regenerate.mockReset().mockReturnValue(of({}));
    api.retryPublication.mockReset().mockReturnValue(of({}));
    await TestBed.configureTestingModule({
      imports: [OverviewTabComponent],
      providers: [{ provide: LearningGraphApiService, useValue: api }],
    }).compileComponents();
  });

  it('starts a new build only when regeneration is requested', () => {
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();
    expect(api.regenerate).not.toHaveBeenCalled();
    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    button.click();
    expect(api.regenerate).toHaveBeenCalledWith('module-id');
    expect(api.retryPublication).not.toHaveBeenCalled();
  });

  it('retries saved publication without requesting regeneration', () => {
    api.findLatest.mockReturnValue(
      of({
        id: 'graph-id',
        version: 7,
        status: 'FAILED',
        current: true,
        errorMessage: 'Timeout',
      }),
    );
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    buttons
      .find((button) => button.textContent?.includes('Retry saved'))!
      .click();
    expect(api.retryPublication).toHaveBeenCalledWith('module-id');
    expect(api.regenerate).not.toHaveBeenCalled();
  });

  it('keeps the published graph visible while a new build is queued', () => {
    api.findLatest.mockReturnValue(
      of({
        id: 'next-graph',
        version: 8,
        status: 'QUEUED',
        current: true,
        errorMessage: null,
      }),
    );
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('article')).toHaveLength(3);
    expect(
      (fixture.nativeElement.querySelector('button') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fixture.destroy();
  });

  it('shows static cards, directed prerequisites, and a separate isolated-topic row', () => {
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const cards = Array.from(element.querySelectorAll('article'));
    expect(cards).toHaveLength(3);
    expect(element.textContent).toContain(
      'Techniques for evaluating integrals.',
    );
    expect(element.textContent).toContain('Isolated topics');
    const foundation = cards.find((card) =>
      card.textContent?.includes('Functions'),
    )!.parentElement!;
    const dependent = cards.find((card) =>
      card.textContent?.includes('Integral Calculus'),
    )!.parentElement!;
    const isolated = cards.find((card) =>
      card.textContent?.includes('Probability'),
    )!.parentElement!;
    expect(Number(foundation.getAttribute('x'))).toBeLessThan(
      Number(dependent.getAttribute('x')),
    );
    expect(Number(isolated.getAttribute('y'))).toBeGreaterThan(
      Math.max(
        Number(foundation.getAttribute('y')),
        Number(dependent.getAttribute('y')),
      ) + Number(foundation.getAttribute('height')),
    );
    const edge = element.querySelector('path[role="img"]');
    expect(edge?.getAttribute('aria-label')).toBe(
      'Functions is a prerequisite for Integral Calculus',
    );
    expect(edge?.getAttribute('marker-end')).toBe(
      'url(#graph-arrow-module-id)',
    );
    expect(element.querySelectorAll('path[role="img"]')).toHaveLength(1);
    expect(
      element.querySelector(
        'article button, article a, article input, [data-slot="accordion-trigger"]',
      ),
    ).toBeNull();
    cards[0].click();
    fixture.detectChanges();
    expect(api.findPublished).toHaveBeenCalledExactlyOnceWith('module-id');
    expect(element.querySelectorAll('article')).toHaveLength(3);
  });

  it('keeps the layout stable when API topic and prerequisite order changes', () => {
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();
    const first = (fixture.nativeElement as HTMLElement).querySelector(
      'svg',
    )!.innerHTML;
    fixture.destroy();
    api.findPublished.mockReturnValue(
      of({ ...graph, topics: [...graph.topics].reverse() }),
    );
    const reordered = TestBed.createComponent(OverviewTabComponent);
    reordered.componentRef.setInput('moduleId', 'module-id');
    reordered.detectChanges();
    expect(
      (reordered.nativeElement as HTMLElement).querySelector('svg')!.innerHTML,
    ).toBe(first);
  });

  it('shows a successful empty publication', () => {
    api.findPublished.mockReturnValue(of({ ...graph, topics: [] }));
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No topics were found in your sources.',
    );
  });

  it('shows when no graph has been published', () => {
    api.findPublished.mockReturnValue(of(null));
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No learning graph has been published yet.',
    );
  });

  it('reports a failed graph request', () => {
    api.findPublished.mockReturnValue(
      throwError(() => new Error('Unavailable')),
    );
    const fixture = TestBed.createComponent(OverviewTabComponent);
    fixture.componentRef.setInput('moduleId', 'module-id');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain('Could not load the learning graph.');
  });
});
