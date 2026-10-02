import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private activeCount = signal<number>(0);

  // Readonly signal indicating if any API or navigation is in progress
  readonly isLoading = computed(() => this.activeCount() > 0);

  show(): void {
    this.activeCount.update((count) => count + 1);
  }

  hide(): void {
    this.activeCount.update((count) => Math.max(0, count - 1));
  }

  reset(): void {
    this.activeCount.set(0);
  }
}

