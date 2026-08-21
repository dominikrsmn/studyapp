import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { formatSemesterLabel } from '../semester/semester.label';
import { SemesterService } from '../semester/semester.service';
import { ModuleService } from './module.service';
import {
  ZardTabComponent,
  ZardTabGroupComponent,
} from '../../shared/components/tabs';
import OverviewTabComponent from './tabs/overview/overview-tab.component';
import SourcesTabComponent from './tabs/sources/sources-tab.component';

const MODULE_TABS = ['overview', 'sources', 'practice', 'exam-prep'] as const;

@Component({
  selector: 'app-module',
  imports: [
    OverviewTabComponent,
    SourcesTabComponent,
    ZardTabComponent,
    ZardTabGroupComponent,
  ],
  templateUrl: './module.component.html',
  styleUrl: './module.component.css',
})
export default class ModuleComponent {
  moduleId = signal('');
  protected readonly activeTabIndex = signal(0);
  protected readonly isHeaderCompact = signal(false);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private moduleService = inject(ModuleService);
  private semesterService = inject(SemesterService);
  private readonly moduleTabs = viewChild<ZardTabGroupComponent>('moduleTabs');

  protected readonly moduleTabNavClass = computed(() => {
    const baseClasses =
      'group-data-[orientation=horizontal]/tabs:h-auto w-full shrink-0 justify-start gap-8 overflow-hidden rounded-none border-b border-sage-200 bg-sage-50 p-0 px-16 text-sage-500 transition-[max-height,opacity,border-color] duration-300 ease-out motion-reduce:transition-none';

    return this.isHeaderCompact()
      ? `${baseClasses} max-h-0 border-transparent opacity-0`
      : `${baseClasses} max-h-14 opacity-100`;
  });

  protected readonly module = computed(() =>
    this.moduleService.findById(this.moduleId()),
  );

  protected readonly semesterLabel = computed(() => {
    const semester = this.semesterService.activeSemester();
    return semester ? formatSemesterLabel(semester, 'long') : 'Semester';
  });

  protected readonly timeUntilExamLabel = computed(() => {
    const examDate = this.module()?.examDate;
    if (!examDate) {
      return null;
    }
    const [year, month, day] = examDate.split('-').map(Number);

    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const examUtc = Date.UTC(year, month - 1, day);
    const days = Math.round((examUtc - todayUtc) / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Exam today';
    }
    if (days < 0) {
      return 'Exam passed';
    }
    if (days < 30) {
      return `Exam in ${days} ${days === 1 ? 'day' : 'days'}`;
    }
    const months = Math.round(days / 30.44);

    return `Exam in ${months} ${months === 1 ? 'month' : 'months'}`;
  });
  constructor() {
    this.activatedRoute.params.subscribe((params) => {
      this.moduleId.set(params['id']);
      this.resetModuleScroll();
    });

    this.activatedRoute.data.subscribe((data) => {
      const tabIndex = MODULE_TABS.findIndex(
        (tab) => tab === data['moduleTab'],
      );
      this.activeTabIndex.set(tabIndex === -1 ? 0 : tabIndex);
    });
  }

  protected selectTab(index: number): void {
    const tab = MODULE_TABS[index];
    if (!tab) {
      return;
    }

    this.resetModuleScroll();

    const commands =
      tab === 'overview'
        ? ['/module', this.moduleId()]
        : ['/module', this.moduleId(), tab];

    void this.router.navigate(commands, {
      queryParamsHandling: 'preserve',
    });
  }

  protected handleContentScroll(scrollTop: number): void {
    if (scrollTop >= 32) {
      this.isHeaderCompact.set(true);
    } else if (scrollTop <= 8) {
      this.isHeaderCompact.set(false);
    }
  }

  private resetModuleScroll(): void {
    this.isHeaderCompact.set(false);
    this.moduleTabs()?.scrollContentToTop();
  }
}
