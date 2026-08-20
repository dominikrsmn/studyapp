import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { SourceDto } from '@study/contracts';
import { finalize } from 'rxjs';
import { ZardAlertDialogService } from '../../../../shared/components/alert-dialog';
import { ZardButtonComponent } from '../../../../shared/components/button';
import {
  ZardPopoverComponent,
  ZardPopoverDirective,
} from '../../../../shared/components/popover';
import { ZardTableImports } from '../../../../shared/components/table';
import {
  ZardTabComponent,
  ZardTabGroupComponent,
} from '../../../../shared/components/tabs';
import { IconDirective } from '../../../../shared/icons/icon.directive';
import { SourcesService } from '../../../sources/sources.service';

type SourceFilter = 'ALL' | SourceDto['type'];

const SOURCE_FILTERS: ReadonlyArray<{
  label: string;
  value: SourceFilter;
}> = [
  { label: 'All', value: 'ALL' },
  { label: 'Documents', value: 'DOCUMENT' },
  { label: 'Images', value: 'IMAGE' },
  { label: 'Audio', value: 'AUDIO' },
  { label: 'Text', value: 'TEXT' },
  { label: 'Web', value: 'WEB' },
];

@Component({
  selector: 'app-sources-tab',
  imports: [
    IconDirective,
    ZardButtonComponent,
    ZardPopoverComponent,
    ZardPopoverDirective,
    ZardTableImports,
    ZardTabComponent,
    ZardTabGroupComponent,
  ],
  templateUrl: './sources-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SourcesTabComponent {
  readonly moduleId = input.required<string>();

  private readonly sourcesService = inject(SourcesService);
  private readonly alertDialogService = inject(ZardAlertDialogService);

  protected readonly filters = SOURCE_FILTERS;
  protected readonly sources = this.sourcesService.sources;
  protected readonly activeFilter = signal<SourceFilter>('ALL');
  protected readonly isLoading = signal(true);
  protected readonly isUploading = signal(false);
  protected readonly deletingSourceId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly filteredSources = computed(() => {
    const filter = this.activeFilter();
    const sources = this.sources();
    return filter === 'ALL'
      ? sources
      : sources.filter((source) => source.type === filter);
  });

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

    onCleanup(() => subscription.unsubscribe());
  });

  protected setFilter(index: number): void {
    const filter = this.filters[index];
    if (filter) {
      this.activeFilter.set(filter.value);
    }
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

  protected sourceIcon(type: SourceDto['type']): string {
    const icons: Record<SourceDto['type'], string> = {
      DOCUMENT: 'file-text',
      IMAGE: 'image',
      AUDIO: 'headphones',
      TEXT: 'type',
      WEB: 'globe',
    };
    return icons[type];
  }

  protected sourceTypeLabel(type: SourceDto['type']): string {
    const labels: Record<SourceDto['type'], string> = {
      DOCUMENT: 'Document',
      IMAGE: 'Image',
      AUDIO: 'Audio',
      TEXT: 'Text',
      WEB: 'Web',
    };
    return labels[type];
  }

  protected statusIcon(status: SourceDto['status']): string {
    const icons: Record<SourceDto['status'], string> = {
      PENDING: 'clock',
      PROCESSING: 'loader',
      READY: 'check-circle',
      FAILED: 'x-circle',
    };
    return icons[status];
  }

  protected statusLabel(status: SourceDto['status']): string {
    const labels: Record<SourceDto['status'], string> = {
      PENDING: 'Pending',
      PROCESSING: 'Processing',
      READY: 'Ready',
      FAILED: 'Failed',
    };
    return labels[status];
  }

  protected statusClass(status: SourceDto['status']): string {
    if (status === 'FAILED') {
      return 'text-destructive';
    }
    if (status === 'READY') {
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
