import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  ElementRef,
  effect,
  input,
  output,
  signal,
  type TemplateRef,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';

import { twMerge } from 'tailwind-merge';
import { IconDirective } from '../../icons/icon.directive';

import {
  tabButtonVariants,
  tabContainerVariants,
  tabNavVariants,
  type ZardTabVariants,
} from './tabs.variants';

@Component({
  selector: 'z-tab',
  imports: [],
  template: `
    <ng-template #content>
      <ng-content />
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ZardTabComponent {
  readonly label = input.required<string>();
  readonly zIcon = input<string | undefined>(undefined);
  readonly zDisabled = input(false, { transform: booleanAttribute });
  readonly contentTemplate =
    viewChild.required<TemplateRef<unknown>>('content');
}

@Component({
  selector: 'z-tab-group',
  imports: [NgTemplateOutlet, IconDirective],
  template: `
    <nav
      [class]="navClasses()"
      role="tablist"
      [attr.aria-orientation]="zOrientation()"
      [attr.data-variant]="zVariant()"
    >
      @for (tab of tabs(); track $index; let index = $index) {
        <button
          type="button"
          role="tab"
          [attr.id]="'tab-' + index"
          [attr.aria-selected]="activeTabIndex() === index"
          [attr.data-active]="activeTabIndex() === index ? '' : null"
          [attr.tabindex]="activeTabIndex() === index ? 0 : -1"
          [attr.aria-controls]="'tabpanel-' + index"
          [disabled]="zDisabled() || tab.zDisabled()"
          (click)="setActiveTab(index)"
          [class]="buttonClasses()"
        >
          @if (tab.zIcon()) {
            <span [appIcon]="tab.zIcon()!" class="inline-flex size-4"></span>
          }
          {{ tab.label() }}
        </button>
      }
    </nav>

    <div
      #contentContainer
      [class]="contentClasses()"
      (scroll)="contentScrolled($event)"
    >
      @for (tab of tabs(); track $index; let index = $index) {
        <div
          role="tabpanel"
          [attr.id]="'tabpanel-' + index"
          [attr.aria-labelledby]="'tab-' + index"
          [attr.tabindex]="0"
          [hidden]="activeTabIndex() !== index"
          class="focus-visible:ring-primary/50 outline-none focus-visible:ring-2"
        >
          <ng-container [ngTemplateOutlet]="tab.contentTemplate()" />
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class]': 'containerClasses()',
    '[attr.data-orientation]': 'zOrientation()',
  },
})
export class ZardTabGroupComponent {
  private readonly tabComponents = contentChildren(ZardTabComponent, {
    descendants: true,
  });

  protected readonly tabs = computed(() => this.tabComponents());
  protected readonly activeTabIndex = signal<number>(0);

  protected readonly zTabChange = output<{
    index: number;
    label: string;
    tab: ZardTabComponent;
  }>();

  protected readonly zDeselect = output<{
    index: number;
    label: string;
    tab: ZardTabComponent;
  }>();

  readonly zContentScroll = output<number>();

  readonly zVariant = input<ZardTabVariants['zVariant']>('default');
  readonly zOrientation = input<ZardTabVariants['zOrientation']>('horizontal');
  readonly zDisabled = input(false, { transform: booleanAttribute });
  readonly zActiveTabIndex = input(0);
  readonly class = input<string>('');
  readonly zNavClass = input<string>('');
  readonly zTabClass = input<string>('');
  readonly zContentClass = input<string>('');

  private readonly contentContainer =
    viewChild<ElementRef<HTMLElement>>('contentContainer');

  constructor() {
    effect(() => this.activeTabIndex.set(this.zActiveTabIndex()));
  }

  protected setActiveTab(index: number) {
    const currentTab = this.tabs()[this.activeTabIndex()];
    if (index !== this.activeTabIndex() && currentTab) {
      this.zDeselect.emit({
        index: this.activeTabIndex(),
        label: currentTab.label(),
        tab: currentTab,
      });
    }

    this.activeTabIndex.set(index);
    const activeTabComponent = this.tabs()[index];
    if (activeTabComponent) {
      this.zTabChange.emit({
        index,
        label: activeTabComponent.label(),
        tab: activeTabComponent,
      });
    }
  }

  protected contentScrolled(event: Event): void {
    this.zContentScroll.emit((event.currentTarget as HTMLElement).scrollTop);
  }

  protected readonly containerClasses = computed(() =>
    twMerge(
      tabContainerVariants({ zOrientation: this.zOrientation() }),
      this.class(),
    ),
  );

  protected readonly navClasses = computed(() =>
    twMerge(tabNavVariants({ zVariant: this.zVariant() }), this.zNavClass()),
  );

  protected readonly buttonClasses = computed(() =>
    twMerge(tabButtonVariants(), this.zTabClass()),
  );

  protected readonly contentClasses = computed(() =>
    twMerge('flex-1', this.zContentClass()),
  );

  selectTabByIndex(index: number): void {
    if (index >= 0 && index < this.tabs().length) {
      this.setActiveTab(index);
    } else {
      console.warn(`Index ${index} outside the range of available tabs.`);
    }
  }

  scrollContentToTop(): void {
    const contentContainer = this.contentContainer()?.nativeElement;
    if (contentContainer) {
      contentContainer.scrollTop = 0;
    }
  }
}
