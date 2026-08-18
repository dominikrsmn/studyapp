import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-navigation-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-labelledby]="headingId()" class="px-3 mb-4">
      @if (label()) {
        <h2
          [id]="headingId()"
          class="mb-2 text-[11px] font-bold uppercase tracking-widest text-sage-500"
        >
          {{ label() }}
        </h2>
      }
      <div class="space-y-1">
        <ng-content />
      </div>
    </section>
  `,
})
export class NavigationSectionComponent {
  readonly label = input<string>();
  readonly headingId = input.required<string>();
}
