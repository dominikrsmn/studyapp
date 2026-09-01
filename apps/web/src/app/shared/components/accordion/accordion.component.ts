import {
  type AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { ClassValue } from 'clsx';
import { mergeClasses } from '../../utils/merge-classes';
import { ZardAccordionItemComponent } from './accordion-item.component';

@Component({
  selector: 'z-accordion, [z-accordion]',
  template: `<ng-content />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'data-slot': 'accordion',
    '[class]': 'classes()',
  },
  exportAs: 'zAccordion',
})
export class ZardAccordionComponent implements AfterContentInit {
  readonly items = contentChildren(ZardAccordionItemComponent);

  readonly class = input<ClassValue>('');
  readonly zType = input<'single' | 'multiple'>('single');
  readonly zCollapsible = input(true);
  readonly zDefaultValue = input<string | string[]>('');

  private readonly defaultValue = computed(() => {
    const defaultValue = this.zDefaultValue();
    if (typeof defaultValue === 'string') {
      return defaultValue ? [defaultValue] : [];
    }
    if (this.zType() === 'single') {
      throw new Error(
        'Array of default values is supported only for multiple zType',
      );
    }
    return defaultValue;
  });

  protected readonly classes = computed(() => mergeClasses(this.class()));

  ngAfterContentInit(): void {
    for (const item of this.items()) {
      item.accordion = this;
      item.isOpen.set(this.defaultValue().includes(item.zValue()));
    }
  }

  toggleItem(selectedItem: ZardAccordionItemComponent): void {
    if (this.zType() === 'single') {
      this.toggleForSingleType(selectedItem);
      return;
    }
    this.toggleForMultipleType(selectedItem);
  }

  private toggleForSingleType(selectedItem: ZardAccordionItemComponent): void {
    const isClosing = selectedItem.isOpen();

    if (isClosing && !this.zCollapsible()) {
      return;
    }

    for (const item of this.items()) {
      item.isOpen.set(item === selectedItem ? !item.isOpen() : false);
    }
  }

  private toggleForMultipleType(
    selectedItem: ZardAccordionItemComponent,
  ): void {
    const isClosing = selectedItem.isOpen();
    if (isClosing && !this.zCollapsible() && this.countOpenItems() <= 1) {
      return;
    }

    selectedItem.isOpen.update((value) => !value);
  }

  private countOpenItems(): number {
    return this.items().filter((item) => item.isOpen()).length;
  }
}
