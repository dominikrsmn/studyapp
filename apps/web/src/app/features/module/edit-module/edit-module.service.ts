import { inject, Service } from '@angular/core';
import { ZardDialogService } from '../../../shared/components/dialog';
import { EditModuleComponent } from './edit-module.component';
import { ModuleDto } from '@study/contracts';

@Service()
export class EditModuleService {
  private readonly dialogService = inject(ZardDialogService);

  open(module: ModuleDto): void {
    this.dialogService.create({
      zTitle: 'Edit module',
      zDescription: "Edit the current module's metadata.",
      zContent: EditModuleComponent,
      zOkText: 'Save changes',
      zData: module,
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
