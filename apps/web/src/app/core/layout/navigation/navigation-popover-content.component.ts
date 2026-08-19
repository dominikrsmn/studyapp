import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
} from '@angular/core';

import { NavigationItem } from './navigation.models';
import { NavigationItemComponent } from './navigation-item.component';
import { ZardPopoverComponent } from '../../../shared/components/popover';

@Component({
  selector: 'app-navigation-popover-content',
  imports: [ZardPopoverComponent, forwardRef(() => NavigationItemComponent)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-popover class="w-56 p-1">
      <div class="grid gap-1">
        @for (item of items(); track $index) {
          <app-navigation-item [item]="item" />
        }
      </div>
    </z-popover>
  `,
})
export class NavigationPopoverContentComponent {
  readonly items = input.required<readonly NavigationItem[]>();
}
