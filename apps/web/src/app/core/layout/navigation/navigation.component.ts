import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { NavigationItemComponent } from './navigation-item.component';
import type { NavigationItem } from './navigation.models';
import { NavigationSectionComponent } from './navigation-section.component';
import { ModuleApiService } from '../../../features/module/module-api-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ModuleDto } from '@study/contracts';
import { IconDirective } from '../../../shared/icons/icon.directive';
import { UserService } from '../../user/user.service';
import { SemesterService } from '@study/features/semester/semester.service';
import { SemesterApiService } from '@study/features/semester/semester-api.service';

@Component({
  selector: 'app-navigation',
  imports: [NavigationItemComponent, NavigationSectionComponent, IconDirective],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly moduleApiService = inject(ModuleApiService);
  private readonly userService = inject(UserService);
  private readonly semesterService = inject(SemesterService)

  protected readonly modules = toSignal(this.moduleApiService.findAll(), {
    initialValue: [],
  });


  protected readonly semesterItems = computed<readonly NavigationItem[]>(() =>
    this.modules().map((module: ModuleDto): NavigationItem => ({
      label: module.name,
      icon: module.icon,
    })),
  );

  protected readonly workspaceItems: readonly NavigationItem[] = [
    { label: 'Workspace', icon: 'compass', active: true },
    { label: 'Search', icon: 'search' },
  ];

  protected readonly accountItems = computed<readonly NavigationItem[]>(() => [
    { label: 'Settings', icon: 'settings' },
    { label: this.userService.name(), icon: 'user' },
  ]);

  protected readonly semesterLabel = computed<string>(() => {
    const semester = this.semesterService.activeSemester()
    if(!semester) {
      return "Semester";
    }
    const start = new Date(semester.startDate);
    const end = new Date(semester.endDate);

    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear === endYear) {
      return `SoSe ${startYear}`;
    }

    return `WiSe ${String(startYear).slice(-2)}/${String(endYear).slice(-2)}`;
  })
}
