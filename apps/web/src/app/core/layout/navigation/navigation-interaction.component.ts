import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import type { NavigationItem } from './navigation.models';
import { NavigationPopoverContentComponent } from './navigation-popover-content.component';

import { ZardButtonComponent } from '../../../shared/components/button';
import { ZardPopoverDirective } from '../../../shared/components/popover';

@Component({
  selector: 'app-navigation-interaction',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    ZardButtonComponent,
    ZardPopoverDirective,
    NavigationPopoverContentComponent,
  ],
  templateUrl: './navigation-interaction.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationInteractionComponent {
  readonly item = input.required<NavigationItem>();

  readonly variant = input<'item' | 'icon'>('item');
  readonly ariaLabel = input<string>();

  readonly classes = input.required<(active: boolean) => string>();

  protected size(): 'lg' | 'icon-sm' {
    return this.variant() === 'icon' ? 'icon-sm' : 'lg';
  }
}
