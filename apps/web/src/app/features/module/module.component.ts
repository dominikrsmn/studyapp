import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { formatSemesterLabel } from '../semester/semester.label';
import { SemesterService } from '../semester/semester.service';
import { ModuleService } from './module.service';

@Component({
  selector: 'app-module',
  imports: [],
  templateUrl: './module.component.html',
})
export default class ModuleComponent {
  moduleId = signal('');
  private activatedRoute = inject(ActivatedRoute);
  private moduleService = inject(ModuleService);
  private semesterService = inject(SemesterService);

  protected readonly module = computed(() =>
    this.moduleService.findById(this.moduleId()),
  );

  protected readonly semesterLabel = computed(() => {
    const semester = this.semesterService.activeSemester();
    return semester ? formatSemesterLabel(semester, 'long') : 'Semester';
  });

  constructor() {
    this.activatedRoute.params.subscribe((params) => {
      this.moduleId.set(params['id']);
    });
  }
}
