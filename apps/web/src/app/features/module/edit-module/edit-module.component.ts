import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FeatherIconNames } from 'feather-icons';

import { CreateModule, ModuleDto } from '@study/contracts';
import { ZardDatePickerComponent } from '../../../shared/components/date-picker';
import { ZardInputComponent } from '../../../shared/components/input';
import { IconPickerComponent } from '../../../shared/components/icon-picker/icon-picker.component';
import { ZardTextareaComponent } from '../../../shared/components/textarea';
import { Z_MODAL_DATA } from '../../../shared/components/dialog';

@Component({
  selector: 'app-create-module',
  imports: [
    ReactiveFormsModule,
    ZardInputComponent,
    ZardDatePickerComponent,
    ZardTextareaComponent,
    IconPickerComponent,
  ],
  templateUrl: './edit-module.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditModuleComponent implements AfterViewInit {
  private readonly zData = inject(Z_MODAL_DATA) as ModuleDto;

  ngAfterViewInit() {
    if (this.zData) {
      this.form.patchValue({
        title: this.zData.name,
        description: this.zData.description ?? '',
        icon: this.zData.icon as FeatherIconNames,
      });
    }
  }
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
      examDate: examDate
        ? `${examDate.getFullYear()}-${String(examDate.getMonth() + 1).padStart(
            2,
            '0',
          )}-${String(examDate.getDate()).padStart(2, '0')}`
        : undefined,
    };
  }
}
