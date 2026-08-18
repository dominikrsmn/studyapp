import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
  lucideCalculator,
  lucideCode,
  lucideCpu,
  lucideHome,
  lucideLayers,
  lucidePlus,
  lucideSearch,
  lucideSettings,
  lucideUser,
} from '@ng-icons/lucide';

import { NavigationItemComponent } from './navigation-item.component';
import type { NavigationItem } from './navigation.models';
import { NavigationSectionComponent } from './navigation-section.component';
import { ModuleApiService } from '../../../features/module/module-api-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ModuleDto } from '@study/contracts';

@Component({
  selector: 'app-navigation',
  imports: [NavigationItemComponent, NavigationSectionComponent],
  providers: [
    provideIcons({
      lucideCalculator,
      lucideCode,
      lucideCpu,
      lucideHome,
      lucideLayers,
      lucidePlus,
      lucideSearch,
      lucideSettings,
      lucideUser,
    }),
  ],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  private readonly moduleApiService = inject(ModuleApiService);

  protected readonly modules = toSignal(
    this.moduleApiService.findAll(),
    {
      initialValue: []
    }
  )

  protected readonly semesterItems = computed<readonly NavigationItem[]>(() =>
    this.modules().map((module: ModuleDto): NavigationItem => ({
      label: module.name,
      icon: module.icon
    }))
  )

  protected readonly workspaceItems: readonly NavigationItem[] = [
    { label: 'Home', icon: 'lucideHome', active: true },
    { label: 'Search', icon: 'lucideSearch' },
  ];



  protected readonly accountItems: readonly NavigationItem[] = [
    { label: 'Settings', icon: 'lucideSettings' },
    { label: 'Dominik', icon: 'lucideUser' },
  ];
}
