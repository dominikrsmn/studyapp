import { computed, effect, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserApiService } from './user-api.service';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly userApi = inject(UserApiService);

  readonly user = toSignal(
    this.userApi.getMe().pipe(
      tap({
        next: (user) => console.log('HTTP USER:', user),
        error: (error) => console.error('HTTP ERROR:', error),
        complete: () => console.log('HTTP COMPLETE'),
      }),
    ),
  );

  readonly activeSemesterId = computed(
    () => this.user()?.activeSemesterId ?? null,
  );

  readonly name = computed(() => {
    const user = this.user();

    if (!user) {
      return "Unknown User";
    }

    return user.name ?? user.email;
  });

  constructor() {
    effect(() => {
      console.log('USER SIGNAL:', this.user());
    });
  }
}
