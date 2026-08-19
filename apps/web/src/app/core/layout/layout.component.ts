import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavigationComponent } from './navigation/navigation.component';

@Component({
  selector: 'app-layout',
  imports: [RouterModule, NavigationComponent],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {}
