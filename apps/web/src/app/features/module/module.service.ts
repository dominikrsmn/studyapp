import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CreateModule, ModuleDto, UpdateModule } from '@study/contracts';
import { ModuleApiService } from './module-api-service';

@Injectable({
  providedIn: 'root',
})
export class ModuleService {
  private readonly moduleApiService = inject(ModuleApiService);

  private readonly _modules = signal<ModuleDto[]>([]);

  readonly modules = this._modules.asReadonly();

  loadAll(): Observable<ModuleDto[]> {
    return this.moduleApiService
      .findAll()
      .pipe(tap((modules) => this._modules.set(modules)));
  }

  create(input: CreateModule): Observable<ModuleDto> {
    return this.moduleApiService
      .create(input)
      .pipe(tap((module) => this.upsert(module)));
  }

  delete(id: string): Observable<ModuleDto> {
    return this.moduleApiService.delete(id).pipe(
      tap(() => {
        this._modules.update((modules) =>
          modules.filter((module) => module.id !== id),
        );
      }),
    );
  }

  update(id: string, input: UpdateModule): Observable<ModuleDto> {
    return this.moduleApiService
      .update(id, input)
      .pipe(tap((module) => this.upsert(module)));
  }

  findById(id: string): ModuleDto | undefined {
    return this._modules().find((module) => module.id === id);
  }

  private upsert(module: ModuleDto): void {
    this._modules.update((modules) => {
      const index = modules.findIndex((item) => item.id === module.id);

      if (index === -1) {
        return [...modules, module];
      }

      return modules.map((item) => (item.id === module.id ? module : item));
    });
  }
}
