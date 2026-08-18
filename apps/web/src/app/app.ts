import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LayoutComponent } from './core/layout/layout.component';

@Component({
  imports: [RouterModule, LayoutComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {}
