import { Component, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AiApiService } from '../../../ai/ai-api.service';
import { ZardButtonComponent } from '../../../../shared/components/button';
import { ZardInputComponent } from '../../../../shared/components/input';
import { ZardSpinnerComponent } from '../../../../shared/components/spinner';
import { IconDirective } from '../../../../shared/icons/icon.directive';

@Component({
  selector: 'app-overview-tab',
  imports: [
    IconDirective,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputComponent,
    ZardSpinnerComponent,
  ],
  templateUrl: './overview-tab.component.html',
})
export default class OverviewTabComponent {
  readonly moduleId = input.required<string>();

  private readonly aiApi = inject(AiApiService);

  protected readonly questionControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });
  protected readonly isAsking = signal(false);
  protected readonly answer = signal<string | null>(null);
  protected readonly questionError = signal<string | null>(null);

  protected askQuestion(): void {
    const question = this.questionControl.value.trim();
    if (!question || this.questionControl.invalid || this.isAsking()) {
      return;
    }

    this.isAsking.set(true);
    this.questionError.set(null);

    this.aiApi
      .ask(this.moduleId(), { question })
      .pipe(finalize(() => this.isAsking.set(false)))
      .subscribe({
        next: (response) => this.answer.set(response.answer),
        error: () => {
          this.answer.set(null);
          this.questionError.set('Could not get an answer. Please try again.');
        },
      });
  }
}
