import type {
  AfterViewInit} from '@angular/core';
import {
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
import type { FeatherIconNames } from 'feather-icons';

import type {
  CreateModule,
  ModuleDto} from '@study/contracts';
import {
  dateOnlyToDate,
  dateToDateOnly
} from '@study/contracts';
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

  ngAfterViewInit(): void {
    if (!this.zData) {
      return;
    }

    this.form.patchValue({
      title: this.zData.name,
      description: this.zData.description ?? '',
      icon: this.zData.icon as FeatherIconNames,
      examDate: this.zData.examDate
        ? dateOnlyToDate(this.zData.examDate)
        : null,
    });
  }

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
