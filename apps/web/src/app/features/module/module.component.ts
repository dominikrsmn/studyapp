import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-module.component',
  imports: [],
  templateUrl: './module.component.html',
  styleUrl: './module.component.css',
})
export default class ModuleComponent {
  private activatedRoute = inject(ActivatedRoute);

  constructor() {
    console.log(this.activatedRoute);
  }
}
