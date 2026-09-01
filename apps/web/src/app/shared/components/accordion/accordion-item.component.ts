import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { ClassValue } from 'clsx';
import { IconDirective } from '../../icons/icon.directive';
import { mergeClasses } from '../../utils/merge-classes';
import type { ZardAccordionComponent } from './accordion.component';
import {
  accordionContentVariants,
  accordionItemVariants,
  accordionTriggerVariants,
} from './accordion.variants';

@Component({
  selector: 'z-accordion-item',
  imports: [IconDirective],
  template: `
    <button
      type="button"
      data-slot="accordion-trigger"
      [attr.aria-controls]="'content-' + zValue()"
      [attr.aria-expanded]="isOpen()"
      [id]="'accordion-' + zValue()"
      [disabled]="zDisabled()"
      [class]="triggerClasses()"
      (click)="toggle()"
    >
      <span
        appIcon="chevron-right"
        class="pointer-events-none inline-flex size-5 shrink-0 text-sage-400 transition-transform duration-200"
        [class.rotate-90]="isOpen()"
      ></span>
      <span class="min-w-0">{{ zTitle() }}</span>
    </button>

    @if (!zDisabled()) {
      <div
        role="region"
        data-slot="accordion-content"
        [attr.aria-labelledby]="'accordion-' + zValue()"
        [attr.data-state]="isOpen() ? 'open' : 'closed'"
        [id]="'content-' + zValue()"
        [class]="contentClasses()"
      >
        <div class="overflow-hidden">
          <div class="pb-4">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'data-slot': 'accordion-item',
    '[class]': 'itemClasses()',
    '[attr.data-state]': "isOpen() ? 'open' : 'closed'",
    '[attr.data-disabled]': 'zDisabled() || null',
    '[attr.aria-disabled]': 'zDisabled()',
  },
  exportAs: 'zAccordionItem',
})
export class ZardAccordionItemComponent {
  readonly zTitle = input('');
  readonly zValue = input('');
  readonly class = input<ClassValue>('');
  readonly zTriggerClass = input<ClassValue>('');
  readonly zContentClass = input<ClassValue>('');
  readonly zDisabled = input(false, { transform: booleanAttribute });

  accordion?: ZardAccordionComponent;
  readonly isOpen = signal(false);

  protected readonly itemClasses = computed(() =>
    mergeClasses(accordionItemVariants(), this.class()),
  );
  protected readonly triggerClasses = computed(() =>
    mergeClasses(accordionTriggerVariants(), this.zTriggerClass()),
  );
  protected readonly contentClasses = computed(() =>
    mergeClasses(
      accordionContentVariants({ isOpen: this.isOpen() }),
      this.zContentClass(),
    ),
  );

  toggle(): void {
    if (this.accordion) {
      this.accordion.toggleItem(this);
      return;
    }
    this.isOpen.update((value) => !value);
  }
}
