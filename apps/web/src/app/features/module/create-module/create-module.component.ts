import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ZardDatePickerComponent } from '../../../shared/components/date-picker';
import { ZardInputComponent } from '../../../shared/components/input';
import { CreateModule } from '@study/contracts';

@Component({
  selector: 'app-create-module',
  imports: [ReactiveFormsModule, ZardInputComponent, ZardDatePickerComponent],
  templateUrl: './create-module.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateModuleComponent {
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),

    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),

    examDate: new FormControl<Date | null>(null),
  });

  getValue(): CreateModule {
    const { title, description, examDate } = this.form.getRawValue();

    return {
      name: title.trim(),
      description: description.trim(),
      icon: 'zap',
      examDate: examDate
        ? `${examDate.getFullYear()}-${String(examDate.getMonth() + 1).padStart(2, '0')}-${String(examDate.getDate()).padStart(2, '0')}`
        : undefined,
    };
  }
}
