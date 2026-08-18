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

@Component({
  selector: 'app-navigation',
  imports: [NavigationItemComponent, NavigationSectionComponent],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  protected readonly workspaceItems: readonly NavigationItem[] = [
    {
      type: 'route',
      route: '/workspace',
      label: 'Workspace',
      icon: 'compass',
      active: true,
    },
    {
      type: 'action',
      action: () => console.log('suche'),
      label: 'Search',
      icon: 'search',
    },
  ];
  protected readonly semesterItems = computed<readonly NavigationItem[]>(() =>
    this.modules().map((module: ModuleDto): NavigationItem => ({
      type: 'route',
      route: `/module/${module.id}`,
      label: module.name,
      icon: module.icon,
      muted: true,
    })),
  );
  protected readonly newModuleItem: NavigationItem = {
    type: 'action',
    action: () => console.log('new module'),
    label: 'New module',
    icon: 'plus',
  };
  private readonly moduleApiService = inject(ModuleApiService);
  protected readonly modules = toSignal(this.moduleApiService.findAll(), {
    initialValue: [],
  });
  private readonly userService = inject(UserService);
  protected readonly accountItems = computed<readonly NavigationItem[]>(() => [
    {
      type: 'action',
      action: () => console.log('user'),
      label: this.userService.name(),
      icon: 'user',
    },
  ]);
  private readonly semesterService = inject(SemesterService);
  protected readonly semesterLabel = computed<string>(() => {
    const semester = this.semesterService.activeSemester();
    if (!semester) {
      return 'Semester';
    }
    const start = new Date(semester.startDate);
    const end = new Date(semester.endDate);

    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear === endYear) {
      return `SoSe ${startYear}`;
    }

    return `WiSe ${String(startYear).slice(-2)}/${String(endYear).slice(-2)}`;
  });
}
