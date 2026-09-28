import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';

import {
  CashFlowDto,
  CashFlowPeriod,
  MovementStatus,
} from '../../../core/financial/financial-cash-flow.model';

import {
  FinancialCashFlowService,
} from '../../../core/financial/financial-cash-flow.service';

type ViewState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'unavailable';

type StatusFilter = MovementStatus | 'ALL';

@Component({
  selector: 'app-financial-cash-flow',
  imports: [Card, Button],
  templateUrl: './financial-cash-flow.html',
  styleUrl: './financial-cash-flow.scss',
})
export class FinancialCashFlow implements OnInit {
  private readonly service =
    inject(FinancialCashFlowService);

  private readonly destroyRef = inject(DestroyRef);

  private request?: Subscription;

  readonly startMonth = signal(this.currentMonth());
  readonly endMonth = signal(this.currentMonth());

  readonly state = signal<ViewState>('loading');
  readonly validationError = signal('');

  private readonly snapshot =
    signal<CashFlowDto | null>(null);

  readonly statusFilter =
    signal<StatusFilter>('ALL');

  readonly summary = computed(
    () => this.snapshot()?.summary
  );

  readonly timeline = computed(
    () => this.snapshot()?.timeline ?? []
  );

  readonly movements = computed(() => {
    const entries = this.snapshot()?.movements ?? [];
    const status = this.statusFilter();

    if (status === 'ALL') {
      return entries;
    }

    return entries.filter(
      movement => movement.status === status
    );
  });

  readonly statusLabel = computed(() => {
    if (this.state() === 'loading') {
      return 'Carregando';
    }

    if (this.state() === 'unavailable') {
      return 'Dados indisponíveis';
    }

    if (this.snapshot()?.source === 'PREVIEW') {
      return 'Prévia sem dados reais';
    }

    return this.state() === 'empty'
      ? 'Sem movimentações'
      : 'Dados atualizados';
  });

  readonly maxBar = computed(() => {
    const values = this.timeline().flatMap(point => [
      point.realizedInflows,
      point.realizedOutflows,
      point.expectedInflows,
      point.expectedOutflows,
    ]);

    return Math.max(1, ...values);
  });

  ngOnInit(): void {
    this.load();
  }

  applyPeriod(
    start: string,
    end: string
  ): void {
    const valid = /^\d{4}-(0[1-9]|1[0-2])$/;

    if (
      !valid.test(start) ||
      !valid.test(end) ||
      start > end
    ) {
      this.validationError.set(
        'Informe um período inicial anterior ou igual ao final.'
      );
      return;
    }

    this.validationError.set('');
    this.startMonth.set(start);
    this.endMonth.set(end);

    this.load();
  }

  setStatus(value: string): void {
    if (
      value === 'ALL' ||
      value === 'SETTLED' ||
      value === 'SCHEDULED'
    ) {
      this.statusFilter.set(value);
    }
  }

  load(): void {
    this.request?.unsubscribe();

    this.snapshot.set(null);
    this.state.set('loading');

    const period = this.buildPeriod();

    this.request = this.service
      .getCashFlow(period)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.snapshot.set(data);

          this.state.set(
            data.status === 'EMPTY'
              ? 'empty'
              : 'ready'
          );
        },
        error: () => {
          this.snapshot.set(null);
          this.state.set('unavailable');
        },
      });
  }

  barHeight(value: number): number {
    return Math.max(
      2,
      Math.max(0, value) / this.maxBar() * 100
    );
  }

  money(
    value: number | null | undefined
  ): string {
    if (value == null) {
      return 'R$ —';
    }

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  displayDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  private currentMonth(): string {
    const now = new Date();

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
    ].join('-');
  }

  private buildPeriod(): CashFlowPeriod {
    const start = this.startMonth();
    const end = this.endMonth();

    const [year, month] = end
      .split('-')
      .map(Number);

    const lastDay = new Date(
      year,
      month,
      0
    ).getDate();

    return {
      start: `${start}-01`,
      end: `${end}-${String(lastDay).padStart(2, '0')}`,
    };
  }
}
