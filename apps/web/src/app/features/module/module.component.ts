import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModuleApiService } from './module-api-service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-module',
  imports: [],
  templateUrl: './module.component.html',
})
export default class ModuleComponent {
  moduleId = signal('');
  private activatedRoute = inject(ActivatedRoute);
  private moduleApiService = inject(ModuleApiService);

  protected readonly module = toSignal(
    toObservable(this.moduleId).pipe(
      switchMap((id) => this.moduleApiService.findOne(id)),
    ),
  );

  constructor() {
    this.activatedRoute.params.subscribe((params) => {
      this.moduleId.set(params['id']);
    });
  }
}
