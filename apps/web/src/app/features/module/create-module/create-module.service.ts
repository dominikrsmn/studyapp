import { inject, Service } from '@angular/core';
import { ZardDialogService } from '../../../shared/components/dialog';
import { CreateModuleComponent } from './create-module.component';
import { ModuleService } from '../module.service';
import type { CreateModule } from '@study/contracts';

@Service()
export class CreateModuleService {
  private readonly dialogService = inject(ZardDialogService);
  private readonly moduleService = inject(ModuleService);

  open(): void {
    this.dialogService.create({
      zTitle: 'Create module',
      zDescription: 'Add a new module to your current semester.',
      zContent: CreateModuleComponent,
      zOkText: 'Create',
      zOnOk: (component) => {
        if (component.form.invalid) {
          component.form.markAllAsTouched();
          return false;
        }
        const value: CreateModule = component.getValue();
        this.moduleService.create(value).subscribe();
        return;
      },
    });
  }
}
