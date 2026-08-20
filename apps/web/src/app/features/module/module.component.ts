import { Component, computed, inject, signal } from '@angular/core';
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
})
export default class ModuleComponent {
  moduleId = signal('');
  protected readonly activeTabIndex = signal(0);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private moduleService = inject(ModuleService);
  private semesterService = inject(SemesterService);

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

    const commands =
      tab === 'overview'
        ? ['/module', this.moduleId()]
        : ['/module', this.moduleId(), tab];

    void this.router.navigate(commands, {
      queryParamsHandling: 'preserve',
    });
  }
}
