import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FeatherIconNames } from 'feather-icons';

import { CreateModule, dateToDateOnly } from '@study/contracts';
import { ZardDatePickerComponent } from '../../../shared/components/date-picker';
import { ZardInputComponent } from '../../../shared/components/input';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';
import { ZardTextareaComponent } from '../../../shared/components/textarea';

@Component({
  selector: 'app-create-module',
  imports: [
    ReactiveFormsModule,
    ZardInputComponent,
    ZardDatePickerComponent,
    ZardTextareaComponent,
    IconPickerComponent,
  ],
  templateUrl: './create-module.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateModuleComponent {
  readonly form = new FormGroup({
    icon: new FormControl<FeatherIconNames>('book-open', {
      nonNullable: true,
    }),

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
    const { icon, title, description, examDate } = this.form.getRawValue();

    return {
      icon,
      name: title.trim(),
      description: description.trim(),
      examDate: examDate ? dateToDateOnly(examDate) : undefined,
    };
  }
}
