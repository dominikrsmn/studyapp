import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconDirective } from '../../../../shared/icons/icon.directive';
import { mergeClasses } from '../../../../shared/utils';
import type { NavigationItem } from '../navigation.models';
import { NavigationInteractionComponent } from '../navigation-interaction/navigation-interaction.component';

@Component({
  selector: 'app-navigation-item',
  imports: [IconDirective, NavigationInteractionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navigation-item.component.html',
})
export class NavigationItemComponent {
  readonly item = input.required<NavigationItem>();

  protected readonly classes = (active: boolean): string => {
    return mergeClasses(
      'h-10 min-w-0 flex-1 justify-start gap-3 rounded-xl px-3',
      'text-left text-sm font-medium transition-colors',
      'text-sage-600 hover:bg-sage-200/50 hover:text-sage-950',
      'group-hover:bg-sage-200/50 group-hover:text-sage-950',
      'focus-visible:border-sage-400 focus-visible:ring-sage-400/30',

      active &&
        'bg-white text-sage-950 shadow-sm shadow-sage-200/50 ' +
          'hover:bg-white hover:text-sage-950 ' +
          'group-hover:bg-white group-hover:text-sage-950',

      this.item().muted &&
        !active &&
        'text-sage-500 hover:text-sage-700 group-hover:text-sage-700',

      this.item().destructive &&
        !active &&
        'text-red-600 ' +
          'hover:bg-red-50 hover:text-red-700 ' +
          'group-hover:bg-red-50 group-hover:text-red-700 ' +
          'focus-visible:border-red-400 focus-visible:ring-red-400/30',
    );
  };

  protected readonly trailingClasses = (): string => {
    return mergeClasses(
      'shrink-0 rounded-lg',
      'text-sage-500 hover:bg-sage-200/50 hover:text-sage-950',
      'focus-visible:border-sage-400 focus-visible:ring-sage-400/30',
    );
  };
}
