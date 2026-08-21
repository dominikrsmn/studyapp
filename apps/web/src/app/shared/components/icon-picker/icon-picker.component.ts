import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FeatherIconNames } from 'feather-icons';
import feather from 'feather-icons';

import { ZardButtonComponent } from '../button';
import { ZardInputComponent } from '../input';
import { ZardPopoverComponent, ZardPopoverDirective } from '../popover';
import { IconDirective } from '../../icons/icon.directive';

@Component({
  selector: 'app-icon-picker',
  imports: [
    IconDirective,
    ZardButtonComponent,
    ZardInputComponent,
    ZardPopoverComponent,
    ZardPopoverDirective,
    IconDirective,
  ],
  templateUrl: './icon-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconPickerComponent {
  readonly value = input.required<FeatherIconNames>();
  readonly valueChange = output<FeatherIconNames>();

  protected readonly search = signal('');

  private readonly allIcons = Object.keys(feather.icons) as FeatherIconNames[];

  protected readonly filteredIcons = computed(() => {
    const search = this.search().trim().toLowerCase();

    if (!search) {
      return this.allIcons;
    }

    return this.allIcons.filter((icon) => icon.toLowerCase().includes(search));
  });

  private readonly popover = viewChild.required('iconPopoverTrigger', {
    read: ZardPopoverDirective,
  });

  protected selectIcon(icon: FeatherIconNames): void {
    this.valueChange.emit(icon);

    this.popover().hide();
  }

  protected selectRandomIcon(): void {
    const icons = this.filteredIcons();

    if (icons.length === 0) {
      return;
    }

    const icon = icons[Math.floor(Math.random() * icons.length)];

    this.selectIcon(icon);
  }

  protected onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.search.set(input.value);
  }
}
