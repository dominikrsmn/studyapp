import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { NavigationItemComponent } from './navigation-item/navigation-item.component';
import type { NavigationItem } from './navigation.models';
import { NavigationSectionComponent } from './navigation-section.component';
import type { ModuleDto } from '@study/contracts';
import { UserService } from '../../user/user.service';
import { SemesterService } from '../../../features/semester/semester.service';
import { formatSemesterLabel } from '../../../features/semester/semester.label';
import { CreateModuleService } from '../../../features/module/create-module/create-module.service';
import { EditModuleService } from '../../../features/module/edit-module/edit-module.service';
import { AuthService } from '../../auth/auth.service';
import { ModuleService } from '../../../features/module/module.service';
import { DeleteModuleService } from '../../../features/module/delete-module/delete-module.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navigation',
  imports: [NavigationItemComponent, NavigationSectionComponent],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly semesterService = inject(SemesterService);
  private readonly moduleService = inject(ModuleService);
  private readonly newModuleService = inject(CreateModuleService);
  private readonly editModuleService = inject(EditModuleService);
  private readonly deleteModuleService = inject(DeleteModuleService);
  private readonly authService = inject(AuthService);
  private readonly routerService = inject(Router);

  constructor() {
    this.moduleService.loadAll().subscribe();
  }

  protected readonly workspaceItems: readonly NavigationItem[] = [
    {
      type: 'route',
      route: '/workspace',
      label: 'Workspace',
      icon: 'compass',
    },
    {
      type: 'action',
      action: () => console.log('suche'),
      label: 'Search',
      icon: 'search',
    },
  ];

  protected readonly semesterLabel = computed(() => {
    const semester = this.semesterService.activeSemester();
    return semester ? formatSemesterLabel(semester, 'short') : 'Semester';
  });
  protected readonly modules = this.moduleService.modules;

  protected readonly semesterItems = computed<readonly NavigationItem[]>(() =>
    this.modules().map((module: ModuleDto): NavigationItem => ({
      type: 'route',
      route: `/module/${module.id}`,
      label: module.name,
      icon: module.icon,
      muted: true,
      trailingItem: {
        icon: 'more-horizontal',
        item: {
          type: 'popover',
          label: 'Module Actions',
          items: [
            {
              type: 'action',
              label: 'Edit Module',
              action: () => this.editModuleService.open(module),
            },
            {
              type: 'action',
              label: 'Delete Module',
              destructive: true,
              action: () => this.deleteModuleService.open(module.id),
            },
          ],
        },
      },
    })),
  );

  protected readonly newModuleItem: NavigationItem = {
    type: 'action',
    action: () => this.newModuleService.open(),
    label: 'New module',
    icon: 'plus',
  };

  private readonly userService = inject(UserService);
  protected readonly accountItems = computed<readonly NavigationItem[]>(() => [
    {
      type: 'popover',
      label: this.userService.name(),
      icon: 'user',
      items: [
        {
          type: 'action',
          label: 'Settings',
          icon: 'settings',
          action: () => console.log('settings'),
        },
        {
          type: 'action',
          label: 'Log Out',
          icon: 'log-out',
          action: () =>
            this.authService
              .logout()
              .subscribe(() => this.routerService.navigate(['/login'])),
        },
      ],
    },
  ]);
}
