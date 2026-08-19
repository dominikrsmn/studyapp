import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { NavigationItemComponent } from './navigation-item/navigation-item.component';
import type { NavigationItem } from './navigation.models';
import { NavigationSectionComponent } from './navigation-section.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { ModuleDto } from '@study/contracts';
import { UserService } from '../../user/user.service';
import { SemesterService } from '../../../features/semester/semester.service';
import { formatSemesterLabel } from '../../../features/semester/semester.label';
import { CreateModuleService } from '../../../features/module/create-module/create-module.service';
import { EditModuleService } from '../../../features/module/edit-module/edit-module.service';
import { AuthTokenService } from '../../auth/auth-token.service';
import { ModuleService } from '../../../features/module/module.service';

@Component({
  selector: 'app-navigation',
  imports: [NavigationItemComponent, NavigationSectionComponent],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly semesterService = inject(SemesterService);
  private readonly moduleService = inject(ModuleService);
  private readonly newModuleDialog = inject(CreateModuleService);
  private readonly editModuleDialog = inject(EditModuleService);
  private readonly authTokenService = inject(AuthTokenService);

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
  protected readonly modules = toSignal(this.moduleService.loadAll(), {
    initialValue: [],
  });
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
              action: () => this.editModuleDialog.open(module),
            },
            {
              type: 'action',
              label: 'Delete Module',
              destructive: true,
              action: () => console.log('delete module'),
            },
          ],
        },
      },
    })),
  );

  protected readonly newModuleItem: NavigationItem = {
    type: 'action',
    action: () => this.newModuleDialog.open(),
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
          action: () => this.authTokenService.logout(),
        },
      ],
    },
  ]);
}
