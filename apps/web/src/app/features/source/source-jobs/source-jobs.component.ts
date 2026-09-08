import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import type { SourceDto, SourceJobsDto } from '@study/contracts';
import { Z_MODAL_DATA } from '../../../shared/components/dialog';
import { ZardButtonComponent } from '../../../shared/components/button';
import { ZardSpinnerComponent } from '../../../shared/components/spinner';
import { SourceApiService } from '../source-api-service';

@Component({
  selector: 'app-source-jobs',
  imports: [DatePipe, ZardButtonComponent, ZardSpinnerComponent],
  templateUrl: './source-jobs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceJobsComponent {
  private readonly source = inject(Z_MODAL_DATA) as SourceDto;
  private readonly api = inject(SourceApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = signal<SourceJobsDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.api
      .getJobs(this.source.moduleId, this.source.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (data) => this.data.set(data),
        error: () => this.error.set(true),
      });
  }

  protected label(name: string): string {
    const labels: Record<string, string> = {
      'parse-document': 'Convert document',
      'build-rag-chunks': 'Build search chunks',
      'embed-rag-chunks': 'Embed search chunks',
      'finalize-ingestion': 'Finalize indexing',
      'prepare-topic-analysis': 'Prepare topic analysis',
      'detect-boundaries': 'Detect boundaries',
      'merge-boundaries': 'Merge boundaries',
      'extract-source-topics': 'Extract topics',
      'match-source-topics': 'Match topics',
      'finalize-topic-analysis': 'Finalize topic analysis',
      'summarize-topic': 'Summarize topic',
      CONVERSION: 'Conversion',
      RAG_INDEXING: 'Indexing',
      TOPIC_ANALYSIS: 'Topic analysis',
    };
    return labels[name] ?? name;
  }

  protected stateLabel(state: string): string {
    return state.toLowerCase().replace(/_/g, ' ');
  }
}
