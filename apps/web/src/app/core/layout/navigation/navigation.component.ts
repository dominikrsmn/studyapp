import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { NavigationItemComponent } from './navigation-item.component';
import type { NavigationItem } from './navigation.models';
import { NavigationSectionComponent } from './navigation-section.component';
import { ModuleApiService } from '../../../features/module/module-api-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ModuleDto } from '@study/contracts';
import { IconDirective } from '@study/shared/icons/icon.directive';

@Component({
  selector: 'app-navigation',
  imports: [NavigationItemComponent, NavigationSectionComponent, IconDirective],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly moduleApiService = inject(ModuleApiService);

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

  protected readonly accountItems: readonly NavigationItem[] = [
    { label: 'Settings', icon: 'settings' },
    { label: 'username', icon: 'user' },
  ];
}
