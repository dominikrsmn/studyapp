import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { SemanticSearchResult } from '@study/contracts';
import { SourceDto } from '@study/contracts';
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

type SourceStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

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
      source.processingStages.some(
        ({ stage, state }) =>
          stage === 'TOPIC_ANALYSIS' && state === 'COMPLETED',
      )
    ) {
      return 'PROCESSED';
    }

    if (source.processingStages.some(({ state }) => state !== 'NOT_STARTED')) {
      return 'PROCESSING';
    }

    return 'PENDING';
  }

  protected processingInfo(source: SourceListItem): string | undefined {
    return (
      source.processingInfo ??
      source.processingStages.find(({ state }) => state === 'FAILED')
        ?.errorMessage ??
      undefined
    );
  }

  protected statusIcon(status: SourceStatus): string {
    const icons: Record<SourceStatus, string> = {
      PENDING: 'clock',
      PROCESSING: 'loader',
      PROCESSED: 'check-circle',
      FAILED: 'x-circle',
    };
    return icons[status];
  }

  protected statusLabel(status: SourceStatus): string {
    const labels: Record<SourceStatus, string> = {
      PENDING: 'Pending',
      PROCESSING: 'Processing',
      PROCESSED: 'Processed',
      FAILED: 'Failed',
    };
    return labels[status];
  }

  protected statusClass(status: SourceStatus): string {
    if (status === 'FAILED') {
      return 'text-destructive';
    }
    if (status === 'PROCESSED') {
      return 'text-sage-800';
    }
    return 'text-sage-600';
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
