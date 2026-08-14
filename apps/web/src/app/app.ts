import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  public readonly isProd = environment.production
    ? 'Production'
    : 'Development';
}
