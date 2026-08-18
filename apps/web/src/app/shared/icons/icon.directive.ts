import {
  Directive,
  ElementRef,
  Renderer2,
  effect,
  inject,
  input,
} from '@angular/core';
import feather, { FeatherIcon, FeatherIconNames } from 'feather-icons';


@Directive({
  selector: '[appIcon]',
})
export class IconDirective {
  readonly appIcon = input.required<string>();

  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  constructor() {
    effect(() => {
      const name = this.appIcon();
      if (!this.isFeatherIconName(name)) {
        this.renderer.setProperty(this.element.nativeElement, 'innerHTML', '');
        return;
      }

      const icon:FeatherIcon = feather.icons[name];

      if (!icon) {
        this.renderer.setProperty(this.element.nativeElement, 'innerHTML', '');

        return;
      }

      this.renderer.setProperty(
        this.element.nativeElement,
        'innerHTML',
        icon.toSvg({
          width: '1em',
          height: '1em',
        }),
      );
    });
  }

  private isFeatherIconName(name: string): name is FeatherIconNames {
    return name in feather.icons;
  }
}
