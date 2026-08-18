import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
import { ModulesApiService } from '@study/features/modules/modules-api-service';

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
  private readonly modulesApiService = inject(ModulesApiService);

  protected readonly workspaceItems: readonly NavigationItem[] = [
    { label: 'Home', icon: 'lucideHome', active: true },
    { label: 'Search', icon: 'lucideSearch' },
  ];

  protected readonly semesterItems: readonly NavigationItem[] = () => {
    this.modulesApiService.findAll(/*activeSemesterId vom User*/)
  };

  protected readonly accountItems: readonly NavigationItem[] = [
    { label: 'Settings', icon: 'lucideSettings' },
    { label: 'Dominik', icon: 'lucideUser' },
  ];
}
