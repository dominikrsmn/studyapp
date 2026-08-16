import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthSession, AuthTokenService } from '../auth/auth-token.service';
import {
  Semester,
  Source,
  StudyApiService,
  StudyModule,
} from '../study-api.service';

@Component({
  selector: 'app-home',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly auth = inject(AuthTokenService);
  private readonly studyApi = inject(StudyApiService);
  private readonly now = signal(Date.now());

  readonly emailControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly email = this.auth.email;
  readonly sessions = signal<AuthSession[]>([]);
  readonly statusMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly semesters = signal<Semester[]>([]);
  readonly selectedSemesterId = signal<string | null>(null);
  readonly modules = signal<StudyModule[]>([]);
  readonly selectedModuleId = signal<string | null>(null);
  readonly sources = signal<Source[]>([]);
  readonly isStudyRequestPending = signal(false);
  readonly startDateControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly endDateControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly moduleNameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });
  readonly moduleDescriptionControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(500)],
  });
  readonly sourceFile = signal<File | null>(null);
  readonly accessTokenRemaining = computed(() =>
    this.formatRemaining(this.auth.accessTokenExpiresAt()),
  );
  readonly refreshTokenRemaining = computed(() =>
    this.formatRemaining(this.auth.refreshTokenExpiresAt()),
  );

  constructor() {
    const intervalId = globalThis.setInterval(
      () => this.now.set(Date.now()),
      1_000,
    );
    inject(DestroyRef).onDestroy(() => globalThis.clearInterval(intervalId));

    effect(() => {
      if (this.isAuthenticated()) {
        this.loadSessions();
        this.loadSemesters();
      } else {
        this.sessions.set([]);
        this.resetStudyData();
      }
    });
  }

  requestMagicLink(event: SubmitEvent): void {
    event.preventDefault();
    this.emailControl.markAsTouched();
    if (this.emailControl.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.statusMessage.set(null);
    this.auth.requestMagicLink(this.emailControl.value).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.statusMessage.set(
          'Magic link requested. In development, check the backend console.',
        );
      },
      error: () => {
        this.isSubmitting.set(false);
        this.statusMessage.set('Could not request a magic link.');
      },
    });
  }

  revokeSession(session: AuthSession): void {
    this.auth.revokeSession(session.id).subscribe({
      next: () => {
        if (session.isCurrent) {
          this.auth.clearAccessToken();
        } else {
          this.loadSessions();
        }
      },
      error: () => this.statusMessage.set('Could not revoke that session.'),
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.sessions.set([]),
      error: () => {
        this.sessions.set([]);
        this.statusMessage.set('You were logged out locally.');
      },
    });
  }

  createSemester(event: SubmitEvent): void {
    event.preventDefault();
    this.startDateControl.markAsTouched();
    this.endDateControl.markAsTouched();
    if (
      this.startDateControl.invalid ||
      this.endDateControl.invalid ||
      this.startDateControl.value > this.endDateControl.value
    ) {
      return;
    }

    this.runStudyRequest(
      this.studyApi.createSemester(
        this.startDateControl.value,
        this.endDateControl.value,
      ),
      (semester) => {
        this.semesters.update((items) => [semester, ...items]);
        this.selectSemester(semester.id);
        this.startDateControl.reset();
        this.endDateControl.reset();
      },
      'Semester konnte nicht angelegt werden.',
    );
  }

  selectSemester(semesterId: string): void {
    this.selectedSemesterId.set(semesterId);
    this.modules.set([]);
    this.selectedModuleId.set(null);
    this.sources.set([]);
    this.runStudyRequest(
      this.studyApi.findModules(semesterId),
      (modules) => this.modules.set(modules),
      'Module konnten nicht geladen werden.',
    );
  }

  deleteSemester(semester: Semester): void {
    this.runStudyRequest(
      this.studyApi.deleteSemester(semester.id),
      () => {
        this.semesters.update((items) =>
          items.filter((item) => item.id !== semester.id),
        );
        if (this.selectedSemesterId() === semester.id) {
          this.selectedSemesterId.set(null);
          this.modules.set([]);
          this.selectedModuleId.set(null);
          this.sources.set([]);
        }
      },
      'Semester konnte nicht gelöscht werden.',
    );
  }

  createModule(event: SubmitEvent): void {
    event.preventDefault();
    this.moduleNameControl.markAsTouched();
    const semesterId = this.selectedSemesterId();
    if (!semesterId || this.moduleNameControl.invalid) return;

    this.runStudyRequest(
      this.studyApi.createModule(
        semesterId,
        this.moduleNameControl.value.trim(),
        this.moduleDescriptionControl.value.trim(),
      ),
      (studyModule) => {
        this.modules.update((items) => [studyModule, ...items]);
        this.moduleNameControl.reset();
        this.moduleDescriptionControl.reset();
      },
      'Modul konnte nicht angelegt werden.',
    );
  }

  selectModule(moduleId: string): void {
    this.selectedModuleId.set(moduleId);
    this.sources.set([]);
    this.runStudyRequest(
      this.studyApi.findSources(moduleId),
      (sources) => this.sources.set(sources),
      'Sources konnten nicht geladen werden.',
    );
  }

  deleteModule(studyModule: StudyModule): void {
    const semesterId = this.selectedSemesterId();
    if (!semesterId) return;
    this.runStudyRequest(
      this.studyApi.deleteModule(semesterId, studyModule.id),
      () => {
        this.modules.update((items) =>
          items.filter((item) => item.id !== studyModule.id),
        );
        if (this.selectedModuleId() === studyModule.id) {
          this.selectedModuleId.set(null);
          this.sources.set([]);
        }
      },
      'Modul konnte nicht gelöscht werden.',
    );
  }

  chooseSource(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.sourceFile.set(input.files?.item(0) ?? null);
  }

  uploadSource(event: SubmitEvent): void {
    event.preventDefault();
    const moduleId = this.selectedModuleId();
    const file = this.sourceFile();
    if (!moduleId || !file) return;
    this.runStudyRequest(
      this.studyApi.uploadSource(moduleId, file),
      (source) => {
        this.sources.update((items) => [source, ...items]);
        this.sourceFile.set(null);
        const input = document.querySelector<HTMLInputElement>('#source-file');
        if (input) input.value = '';
      },
      'Source konnte nicht hochgeladen werden.',
    );
  }

  deleteSource(source: Source): void {
    this.runStudyRequest(
      this.studyApi.deleteSource(source.id),
      () =>
        this.sources.update((items) =>
          items.filter((item) => item.id !== source.id),
        ),
      'Source konnte nicht gelöscht werden.',
    );
  }

  private loadSemesters(): void {
    this.runStudyRequest(
      this.studyApi.findSemesters(),
      (semesters) => this.semesters.set(semesters),
      'Semester konnten nicht geladen werden.',
    );
  }

  private runStudyRequest<T>(
    request: Observable<T>,
    onSuccess: (value: T) => void,
    errorMessage: string,
  ): void {
    this.isStudyRequestPending.set(true);
    this.statusMessage.set(null);
    request.subscribe({
      next: (value) => {
        onSuccess(value);
        this.isStudyRequestPending.set(false);
      },
      error: () => {
        this.isStudyRequestPending.set(false);
        this.statusMessage.set(errorMessage);
      },
    });
  }

  private resetStudyData(): void {
    this.semesters.set([]);
    this.selectedSemesterId.set(null);
    this.modules.set([]);
    this.selectedModuleId.set(null);
    this.sources.set([]);
  }

  private loadSessions(): void {
    this.auth.findSessions().subscribe({
      next: (sessions) => this.sessions.set(sessions),
      error: () => this.statusMessage.set('Could not load active sessions.'),
    });
  }

  private formatRemaining(expiresAt: Date | null): string {
    this.now();
    if (!expiresAt) {
      return '—';
    }

    const totalSeconds = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - this.now()) / 1_000),
    );
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    return [
      days ? `${days}d` : '',
      hours ? `${hours}h` : '',
      minutes ? `${minutes}m` : '',
      `${seconds}s`,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
