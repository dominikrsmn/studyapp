import { Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  SourceTopicOverviewDto,
  TopicOverviewDto,
} from '@study/contracts';
import { finalize } from 'rxjs';
import { AiApiService } from '../../../ai/ai-api.service';
import { TopicApiService } from '../../../topic/topic-api.service';
import {
  ZardAccordionComponent,
  ZardAccordionItemComponent,
} from '../../../../shared/components/accordion';
import { ZardButtonComponent } from '../../../../shared/components/button';
import { ZardInputComponent } from '../../../../shared/components/input';
import { ZardSpinnerComponent } from '../../../../shared/components/spinner';
import { IconDirective } from '../../../../shared/icons/icon.directive';

@Component({
  selector: 'app-overview-tab',
  imports: [
    IconDirective,
    ReactiveFormsModule,
    ZardAccordionComponent,
    ZardAccordionItemComponent,
    ZardButtonComponent,
    ZardInputComponent,
    ZardSpinnerComponent,
  ],
  templateUrl: './overview-tab.component.html',
})
export default class OverviewTabComponent {
  readonly moduleId = input.required<string>();

  private readonly aiApi = inject(AiApiService);
  private readonly topicApi = inject(TopicApiService);

  protected readonly questionControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });
  protected readonly isAsking = signal(false);
  protected readonly answer = signal<string | null>(null);
  protected readonly questionError = signal<string | null>(null);
  protected readonly topics = signal<TopicOverviewDto[]>([]);
  protected readonly topicsLoading = signal(true);
  protected readonly topicsError = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const moduleId = this.moduleId();
      this.topicsLoading.set(true);
      this.topicsError.set(null);

      const subscription = this.topicApi.findAll(moduleId).subscribe({
        next: (topics) => {
          this.topics.set(topics);
          this.topicsLoading.set(false);
        },
        error: () => {
          this.topics.set([]);
          this.topicsLoading.set(false);
          this.topicsError.set('Could not load topics. Please try again.');
        },
      });

      onCleanup(() => subscription.unsubscribe());
    });
  }

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

  protected sourceTopicPages(sourceTopic: SourceTopicOverviewDto): string {
    const { pageStart, pageEnd } = sourceTopic;
    if (pageStart === null) {
      return '';
    }
    if (pageEnd === null || pageEnd === pageStart) {
      return `Page ${pageStart}`;
    }
    return `Pages ${pageStart}–${pageEnd}`;
  }
}
