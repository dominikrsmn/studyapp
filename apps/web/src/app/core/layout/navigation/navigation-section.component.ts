import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-navigation-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block px-5' },
  template: `
    <section [attr.aria-labelledby]="headingId()">
      <h2
        [id]="headingId()"
        class="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-sage-500"
      >
        {{ label() }}
      </h2>
      <div class="space-y-1">
        <ng-content />
      </div>
    </section>
  `,
})
export class NavigationSectionComponent {
  readonly label = input.required<string>();
  readonly headingId = input.required<string>();
}
