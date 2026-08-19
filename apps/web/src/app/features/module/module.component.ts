import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModuleApiService } from './module-api-service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { formatSemesterLabel } from '../semester/semester.label';
import { SemesterService } from '../semester/semester.service';

@Component({
  selector: 'app-module',
  imports: [],
  templateUrl: './module.component.html',
})
export default class ModuleComponent {
  moduleId = signal('');
  private activatedRoute = inject(ActivatedRoute);
  private moduleApiService = inject(ModuleApiService);
  private semesterService = inject(SemesterService);

  protected readonly module = toSignal(
    toObservable(this.moduleId).pipe(
      switchMap((id) => this.moduleApiService.findOne(id)),
    ),
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
