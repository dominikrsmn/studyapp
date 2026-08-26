import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type {
  ProcessingState,
  SemanticSearchResult,
  SourceDto,
  SourceProcessingStageType,
} from '@study/contracts';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ZardAlertDialogService } from '../../../../shared/components/alert-dialog';
import { ZardButtonComponent } from '../../../../shared/components/button';
import {
  ZardPopoverComponent,
  ZardPopoverDirective,
} from '../../../../shared/components/popover';
import { ZardTableImports } from '../../../../shared/components/table';
import { IconDirective } from '../../../../shared/icons/icon.directive';
import { SourceListItem, SourceService } from '../../../source/source.service';
import { ZardSpinnerComponent } from '../../../../shared/components/spinner';
import { ZardInputComponent } from '../../../../shared/components/input';
import { SemanticSearchApiService } from '../../../search/semantic-search-api.service';

type SourceStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

type ProcessingStageDisplay = {
  stage: SourceProcessingStageType;
  label: string;
};

const PROCESSING_STAGES: readonly ProcessingStageDisplay[] = [
  { stage: 'CONVERSION', label: 'Conversion' },
  { stage: 'RAG_INDEXING', label: 'Indexing' },
  { stage: 'TOPIC_ANALYSIS', label: 'Topic analysis' },
];

const PROCESSING_MESSAGES: Record<
  SourceProcessingStageType,
  Partial<Record<ProcessingState, string>>
> = {
  CONVERSION: {
    QUEUED: 'Queued for conversion',
    PROCESSING: 'Converting document…',
    FAILED: 'Conversion failed',
  },
  RAG_INDEXING: {
    QUEUED: 'Queued for indexing',
    PROCESSING: 'Indexing content…',
    FAILED: 'Indexing failed',
  },
  TOPIC_ANALYSIS: {
    QUEUED: 'Queued for topic analysis',
    PROCESSING: 'Extracting topics & exercises…',
    FAILED: 'Topic analysis failed',
  },
};

const PROCESSING_STAGE_CLASSES: Record<ProcessingState, string> = {
  NOT_STARTED: 'bg-sage-200',
  QUEUED: 'bg-sage-300',
  PROCESSING: 'bg-sage-400',
  COMPLETED: 'bg-sage-700',
  FAILED: 'bg-destructive',
};

const PROCESSING_STATE_LABELS: Record<ProcessingState, string> = {
  NOT_STARTED: 'Not started',
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const STATUS_ICONS: Record<SourceStatus, string> = {
  PENDING: 'clock',
  PROCESSING: '',
  READY: 'check-circle',
  FAILED: 'alert-circle',
};

const STATUS_LABELS: Record<SourceStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  READY: 'Ready',
  FAILED: 'Failed',
};

@Component({
  selector: 'app-source-tab',
  imports: [
    IconDirective,
    ZardButtonComponent,
    ZardPopoverComponent,
    ZardPopoverDirective,
    ZardTableImports,
    ZardSpinnerComponent,
    ZardInputComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './sources-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export default class SourcesTabComponent {
  readonly moduleId = input.required<string>();

  private readonly sourcesService = inject(SourceService);
  private readonly alertDialogService = inject(ZardAlertDialogService);
  private readonly semanticSearchApi = inject(SemanticSearchApiService);

  protected readonly sources = this.sourcesService.sources;
  protected readonly isLoading = signal(true);
  protected readonly isUploading = signal(false);
  protected readonly deletingSourceId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500)],
  });
  protected readonly isSearching = signal(false);
  protected readonly searchResults = signal<SemanticSearchResult[] | null>(
    null,
  );
  protected readonly searchError = signal<string | null>(null);
  protected readonly processingStages = PROCESSING_STAGES;

  private readonly loadSources = effect((onCleanup) => {
    const moduleId = this.moduleId();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const subscription = this.sourcesService
      .loadAll(moduleId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        error: () =>
          this.errorMessage.set(
            'Sources could not be loaded. Please try again.',
          ),
      });

    const events = this.sourcesService.watchStateChanges(moduleId).subscribe({
      error: () =>
        this.errorMessage.set(
          'source SSE connection failed. Please try again.',
        ),
    });

    onCleanup(() => {
      subscription.unsubscribe();
      events.unsubscribe();
    });
  });

  protected search(): void {
    const query = this.searchControl.value.trim();
    if (!query || this.searchControl.invalid || this.isSearching()) {
      return;
    }

    this.isSearching.set(true);
    this.searchError.set(null);

    this.semanticSearchApi
      .search(this.moduleId(), { query })
      .pipe(finalize(() => this.isSearching.set(false)))
      .subscribe({
        next: (results) => this.searchResults.set(results),
        error: () => {
          this.searchResults.set(null);
          this.searchError.set('Search failed. Please try again.');
        },
      });
  }

  protected uploadSource(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const moduleId = this.moduleId();
    this.isUploading.set(true);
    this.errorMessage.set(null);

    this.sourcesService
      .create(moduleId, { moduleId, file })
      .pipe(finalize(() => this.isUploading.set(false)))
      .subscribe({
        error: () =>
          this.errorMessage.set(
            'The source could not be uploaded. Please try again.',
          ),
      });
  }

  protected confirmDelete(
    source: SourceDto,
    popover: ZardPopoverDirective,
  ): void {
    popover.hide();
    this.alertDialogService.confirm({
      zSize: 'sm',
      zTitle: 'Delete source?',
      zDescription: `This will permanently delete “${source.name}”.`,
      zOkText: 'Delete',
      zOkDestructive: true,
      zOnOk: () => this.deleteSource(source),
    });
  }

  protected sourceStatus(source: SourceDto): SourceStatus {
    if (source.processingStages.some(({ state }) => state === 'FAILED')) {
      return 'FAILED';
    }

    if (
      this.processingStages.every(
        ({ stage }) => this.processingStageState(source, stage) === 'COMPLETED',
      )
    ) {
      return 'READY';
    }

    if (source.processingStages.some(({ state }) => state !== 'NOT_STARTED')) {
      return 'PROCESSING';
    }

    return 'PENDING';
  }

  protected processingInfo(source: SourceListItem): string | undefined {
    const currentStage =
      source.processingStages.find(({ state }) => state === 'FAILED') ??
      source.processingStages.find(({ state }) => state === 'PROCESSING') ??
      source.processingStages.find(({ state }) => state === 'QUEUED');

    if (!currentStage) {
      return undefined;
    }

    if (source.processingInfo && currentStage.state !== 'FAILED') {
      return source.processingInfo;
    }

    return PROCESSING_MESSAGES[currentStage.stage][currentStage.state];
  }

  protected processingStageState(
    source: SourceDto,
    stage: SourceProcessingStageType,
  ): ProcessingState {
    return (
      source.processingStages.find((item) => item.stage === stage)?.state ??
      'NOT_STARTED'
    );
  }

  protected processingStageClass(state: ProcessingState): string {
    return PROCESSING_STAGE_CLASSES[state];
  }

  protected processingStageStateLabel(state: ProcessingState): string {
    return PROCESSING_STATE_LABELS[state];
  }

  protected statusIcon(status: SourceStatus): string {
    return STATUS_ICONS[status];
  }

  protected statusLabel(status: SourceStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusClass(status: SourceStatus): string {
    if (status === 'FAILED') {
      return 'text-destructive';
    }
    if (status === 'READY') {
      return 'text-sage-800';
    }
    return status === 'PROCESSING' ? 'text-sage-800' : 'text-sage-600';
  }

  private deleteSource(source: SourceDto): void {
    this.deletingSourceId.set(source.id);
    this.errorMessage.set(null);

    this.sourcesService
      .delete(this.moduleId(), source.id)
      .pipe(finalize(() => this.deletingSourceId.set(null)))
      .subscribe({
        error: () =>
          this.errorMessage.set(
            'The source could not be deleted. Please try again.',
          ),
      });
  }
}
