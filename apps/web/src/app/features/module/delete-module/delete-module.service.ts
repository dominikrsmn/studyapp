import { inject, Service } from '@angular/core';
import { ModuleService } from '../module.service';
import { ZardAlertDialogService } from '../../../shared/components/alert-dialog';
import { Router } from '@angular/router';

@Service()
export class DeleteModuleService {
  private readonly dialogService = inject(ZardAlertDialogService);
  private readonly moduleService = inject(ModuleService);
  private readonly routerService = inject(Router);

  open(id: string): void {
    this.dialogService.create({
      zSize: 'sm',
      zTitle: 'Delete Module?',
      zDescription: 'This will permanently delete this module.',
      zOkText: 'Delete',
      zCancelText: 'Cancel',
      zOkDestructive: true,
      zOnOk: () => {
        this.moduleService.delete(id).subscribe(() => {
          this.routerService.navigate(['workspace']);
        });
        return;
      },
    });
  }
}
