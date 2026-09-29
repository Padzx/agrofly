import {
  computed,
  Injectable,
  signal
} from '@angular/core';

import {
  SeasonMonth,
  SeasonMonthAllocation
} from './financial-season-planning.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialSeasonStateService {

  private readonly initialValue:
    SeasonMonthAllocation[] = [
      { month: 1, percentage: 20 },
      { month: 2, percentage: 20 },
      { month: 3, percentage: 15 },
      { month: 4, percentage: 5 },

      { month: 5, percentage: 0 },
      { month: 6, percentage: 0 },
      { month: 7, percentage: 0 },
      { month: 8, percentage: 0 },

      { month: 9, percentage: 5 },
      { month: 10, percentage: 10 },
      { month: 11, percentage: 10 },
      { month: 12, percentage: 15 }
    ];

  readonly allocation =
    signal<SeasonMonthAllocation[]>(
      this.cloneInitial()
    );

  readonly totalPercentage =
    computed(() =>
      this.allocation().reduce(
        (total, item) =>
          total + item.percentage,
        0
      )
    );

  updatePercentage(
    month: SeasonMonth,
    percentage: number
  ): void {

    if (
      Number.isNaN(percentage)
      || percentage < 0
      || percentage > 100
    ) {
      return;
    }

    this.allocation.update(
      current =>
        current.map(item =>
          item.month === month
            ? {
                ...item,
                percentage
              }
            : item
        )
    );
  }

  reset(): void {
    this.allocation.set(
      this.cloneInitial()
    );
  }

  private cloneInitial():
    SeasonMonthAllocation[] {

    return this.initialValue.map(
      item => ({ ...item })
    );
  }
}
