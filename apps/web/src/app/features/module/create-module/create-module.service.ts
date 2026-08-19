import { inject, Service } from '@angular/core';
import { ZardDialogService } from '../../../shared/components/dialog';
import { ModuleApiService } from '../module-api-service';
import { CreateModuleComponent } from './create-module.component';

@Service()
export class CreateModuleService {
  private readonly dialogService = inject(ZardDialogService);
  private readonly moduleApiService = inject(ModuleApiService);

  open(): void {
    this.dialogService.create({
      zTitle: 'Create module',
      zDescription: 'Add a new module to your current semester.',
      zContent: CreateModuleComponent,
      zOkText: 'Create',
      zOnOk: (component) => {
        if (component.form.invalid) {
          component.form.markAllAsTouched();
          return;
        }

        const value = component.getValue();

        console.log(value);
      },
    });
  }
}
