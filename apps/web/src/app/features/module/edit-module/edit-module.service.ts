import { inject, Service } from '@angular/core';
import { ZardDialogService } from '../../../shared/components/dialog';
import { ModuleApiService } from '../module-api-service';
import { EditModuleComponent } from './edit-module.component';

@Service()
export class EditModuleService {
  private readonly dialogService = inject(ZardDialogService);
  private readonly moduleApiService = inject(ModuleApiService);

  open(): void {
    this.dialogService.create({
      zTitle: 'Create module',
      zDescription: 'Add a new module to your current semester.',
      zContent: EditModuleComponent,
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
