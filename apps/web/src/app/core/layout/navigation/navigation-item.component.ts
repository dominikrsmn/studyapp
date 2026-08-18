import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ZardButtonComponent } from '../../../shared/components/button/button.component';
import { mergeClasses } from '../../../shared/utils/merge-classes';
import { IconDirective } from '../../../shared/icons/icon.directive';

@Component({
  selector: 'app-navigation-item',
  imports: [ZardButtonComponent, IconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <button
      z-button
      type="button"
      zType="ghost"
      zSize="lg"
      [class]="classes()"
      [attr.aria-current]="active() ? 'page' : null"
    >
      <span [appIcon]="icon()" aria-hidden="true"></span>
      <span class="min-w-0 truncate">{{ label() }}</span>
    </button>
  `,
})
export class NavigationItemComponent {
  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly active = input(false);
  readonly muted = input(false);

  protected readonly classes = computed(() =>
    mergeClasses(
      'h-10 w-full justify-start gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors',
      'text-sage-600 hover:bg-sage-200/50 hover:text-sage-950',
      'focus-visible:border-sage-400 focus-visible:ring-sage-400/30',
      this.active() &&
        'bg-white text-sage-950 shadow-sm shadow-sage-200/50 hover:bg-white hover:text-sage-950',
      this.muted() && !this.active() && 'text-sage-500 hover:text-sage-700',
    ),
  );
}
