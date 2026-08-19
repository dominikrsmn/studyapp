import { computed, inject, Service, signal } from '@angular/core';
import { CreateModule, ModuleDto, UpdateModule } from '@study/contracts';
import { Observable, of, tap } from 'rxjs';
import { ModuleApiService } from './module-api-service';

@Service()
export class ModuleService {
  private readonly moduleApiService = inject(ModuleApiService);

  private readonly _modules = signal<readonly ModuleDto[]>([]);
  private readonly _loaded = signal(false);

  readonly modules = this._modules.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly count = computed(() => this._modules().length);

  loadAll(force = false): Observable<readonly ModuleDto[]> {
    if (this._loaded() && !force) {
      return of(this._modules());
    }

    return this.moduleApiService.findAll().pipe(
      tap((modules) => {
        this._modules.set(modules);
        this._loaded.set(true);
      }),
    );
  }

  getById(id: string): ModuleDto | undefined {
    return this._modules().find((module) => module.id === id);
  }

  findOne(id: string, force = false): Observable<ModuleDto> {
    const cached = this.getById(id);

    if (cached && !force) {
      return of(cached);
    }

    return this.moduleApiService
      .findOne(id)
      .pipe(tap((module) => this.upsert(module)));
  }

  create(input: CreateModule): Observable<ModuleDto> {
    return this.moduleApiService
      .create(input)
      .pipe(tap((module) => this.upsert(module)));
  }

  update(id: string, input: UpdateModule): Observable<ModuleDto> {
    return this.moduleApiService
      .update(id, input)
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

  refresh(): Observable<readonly ModuleDto[]> {
    return this.loadAll(true);
  }

  clear(): void {
    this._modules.set([]);
    this._loaded.set(false);
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
