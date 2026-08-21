import { inject, Service } from '@angular/core';
import { ZardDialogService } from '../../../shared/components/dialog';
import { EditModuleComponent } from './edit-module.component';
import type { ModuleDto } from '@study/contracts';
import { ModuleService } from '../module.service';

@Service()
export class EditModuleService {
  private readonly dialogService = inject(ZardDialogService);
  private readonly moduleService = inject(ModuleService);

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
          return false;
        }

        const value = component.getValue();
        this.moduleService.update(module.id, value).subscribe();
        return;
      },
    });
  }
}
