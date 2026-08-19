import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { NavigationItemComponent } from './navigation-item.component';
import type { NavigationItem } from './navigation.models';
import { NavigationSectionComponent } from './navigation-section.component';
import { ModuleApiService } from '../../../features/module/module-api-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ModuleDto } from '@study/contracts';
import { UserService } from '../../user/user.service';
import { SemesterService } from '../../../features/semester/semester.service';
import { formatSemesterLabel } from '../../../features/semester/semester.label';
import { CreateModuleService } from '../../../features/module/create-module/create-module.service';

@Component({
  selector: 'app-navigation',
  imports: [NavigationItemComponent, NavigationSectionComponent],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly semesterService = inject(SemesterService);
  private readonly newModuleDialog = inject(CreateModuleService);

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
  protected readonly newModuleItem: NavigationItem = {
    type: 'action',
    action: () => this.newModuleDialog.open(),
    label: 'New module',
    icon: 'plus',
  };
  protected readonly semesterLabel = computed(() => {
    const semester = this.semesterService.activeSemester();
    return semester ? formatSemesterLabel(semester, 'short') : 'Semester';
  });
  private readonly moduleApiService = inject(ModuleApiService);
  protected readonly modules = toSignal(this.moduleApiService.findAll(), {
    initialValue: [],
  });
  protected readonly semesterItems = computed<readonly NavigationItem[]>(() =>
    this.modules().map((module: ModuleDto): NavigationItem => ({
      type: 'route',
      route: `/module/${module.id}`,
      label: module.name,
      icon: module.icon,
      muted: true,
    })),
  );
  private readonly userService = inject(UserService);
  protected readonly accountItems = computed<readonly NavigationItem[]>(() => [
    {
      type: 'action',
      action: () => console.log('user'),
      label: this.userService.name(),
      icon: 'user',
    },
  ]);
}
