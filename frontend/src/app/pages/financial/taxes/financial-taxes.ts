import {
  Component, computed, DestroyRef, inject, OnInit, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Card } from '../../../shared/ui/card/card';
import {
  CompleteAccessory, CreateFiscalObligation, FiscalCategory, FiscalDisplayStatus,
  FiscalKind, FiscalObligation, FiscalObligationsDto, NewFiscalPayment,
  daysUntil, fiscalStatus, openAmount, settledAmount,
} from '../../../core/financial/financial-taxes.model';
import { FinancialTaxesService } from '../../../core/financial/financial-taxes.service';

type ViewState = 'loading' | 'ready' | 'empty' | 'error';
type KindFilter = FiscalKind | 'ALL';
type StatusFilter = FiscalDisplayStatus | 'ALL';

interface FiscalCategoryOption {
  code: FiscalCategory;
  label: string;
  kind: FiscalKind;
}

@Component({
  selector: 'app-financial-taxes',
  imports: [Card, FormsModule],
  templateUrl: './financial-taxes.html',
  styleUrl: './financial-taxes.scss',
})
export class FinancialTaxes implements OnInit {
  private readonly service = inject(FinancialTaxesService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly periodStart = signal(this.currentMonth());
  readonly periodEnd = signal(this.currentMonth());
  readonly today = this.currentDate();
  readonly state = signal<ViewState>('loading');
  readonly saving = signal(false);
  readonly feedback = signal('');
  readonly validationError = signal('');
  readonly showForm = signal(false);
  readonly kindFilter = signal<KindFilter>('ALL');
  readonly statusFilter = signal<StatusFilter>('ALL');
  readonly categoryFilter = signal<FiscalCategory | 'ALL'>('ALL');
  readonly search = signal('');
  readonly selectedForPayment = signal<FiscalObligation | null>(null);
  readonly selectedForCompletion = signal<FiscalObligation | null>(null);
  readonly pendingDelete = signal<string | null>(null);
  private readonly snapshot = signal<FiscalObligationsDto | null>(null);

  readonly kinds: { code: FiscalKind; label: string }[] = [
    { code: 'TAX', label: 'Tributo / guia' },
    { code: 'ACCESSORY', label: 'Obrigação acessória' },
  ];
  readonly categories: FiscalCategoryOption[] = [
    { code: 'REVENUE_TAX', label: 'Tributos sobre receita', kind: 'TAX' },
    { code: 'PROFIT_TAX', label: 'Tributos sobre lucro', kind: 'TAX' },
    { code: 'PAYROLL', label: 'Encargos relacionados à folha', kind: 'TAX' },
    { code: 'OTHER_TAX', label: 'Outros tributos', kind: 'TAX' },
    { code: 'ACCESSORY_REPORT', label: 'Declaração / entrega acessória', kind: 'ACCESSORY' },
    { code: 'OTHER_ACCESSORY', label: 'Outra obrigação acessória', kind: 'ACCESSORY' },
  ];

  draft = this.emptyDraft();
  paymentDraft: { amount: number | null; paidAt: string; proofReference: string } = {
    amount: null, paidAt: this.today, proofReference: '',
  };
  completionDraft: { completedAt: string; completionReference: string } = {
    completedAt: this.today, completionReference: '',
  };

  readonly records = computed(() => this.snapshot()?.obligations ?? []);
  readonly summary = computed(() => {
    const records = this.records();
    const open = records.filter(item => fiscalStatus(item, this.today) !== 'DONE');
    const taxOpen = open.filter(item => item.kind === 'TAX');
    const overdue = open.filter(item => item.dueDate < this.today);
    const upcoming = open.filter(item => {
      const days = daysUntil(item.dueDate, this.today);
      return days >= 0 && days <= 30;
    });
    return {
      outstanding: records.length ? taxOpen.reduce((sum, item) => sum + openAmount(item), 0) : null,
      overdueAmount: records.length ? overdue.reduce((sum, item) => sum + openAmount(item), 0) : null,
      upcomingAmount: records.length ? upcoming.reduce((sum, item) => sum + openAmount(item), 0) : null,
      overdueCount: overdue.filter(item => item.kind === 'TAX').length,
      upcomingCount: upcoming.length,
      completedCount: records.filter(item => fiscalStatus(item, this.today) === 'DONE').length,
      pendingAccessories: open.filter(item => item.kind === 'ACCESSORY').length,
      completedAccessories: records.filter(item => item.kind === 'ACCESSORY' && item.completedAt !== null).length,
    };
  });
  readonly upcoming = computed(() => this.records()
    .filter(item => fiscalStatus(item, this.today) !== 'DONE' &&
      daysUntil(item.dueDate, this.today) >= 0 &&
      daysUntil(item.dueDate, this.today) <= 30)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6));
  readonly filtered = computed(() => {
    const text = this.search().trim().toLocaleLowerCase('pt-BR');
    return this.records().filter(item =>
      (this.kindFilter() === 'ALL' || item.kind === this.kindFilter()) &&
      (this.categoryFilter() === 'ALL' || item.category === this.categoryFilter()) &&
      (this.statusFilter() === 'ALL' || fiscalStatus(item, this.today) === this.statusFilter()) &&
      (!text || [item.description, item.reference ?? '', item.responsible ?? '']
        .some(value => value.toLocaleLowerCase('pt-BR').includes(text)))
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  });
  readonly statusLabel = computed(() => {
    if (this.state() === 'loading') { return 'Carregando'; }
    if (this.state() === 'error') { return 'Dados indisponíveis'; }
    if (this.snapshot()?.source === 'PREVIEW') { return 'Prévia sem dados fiscais reais'; }
    return this.state() === 'empty' ? 'Sem registros' : 'Dados atualizados';
  });

  get categoriesForDraft(): FiscalCategoryOption[] {
    return this.categories.filter(item => item.kind === this.draft.kind);
  }
  ngOnInit(): void { this.load(); }
  onKindChange(): void {
    this.draft.category = this.categoriesForDraft[0].code;
    this.draft.amount = null;
  }
  toggleForm(): void { this.showForm.update(value => !value); }
  setKindFilter(value: string): void {
    if (value === 'ALL' || value === 'TAX' || value === 'ACCESSORY') {
      this.kindFilter.set(value);
    }
  }
  setStatusFilter(value: string): void {
    if (value === 'ALL' || value === 'OPEN' || value === 'PARTIAL' ||
        value === 'OVERDUE' || value === 'DONE') {
      this.statusFilter.set(value);
    }
  }
  setCategoryFilter(value: string): void {
    if (value === 'ALL' || this.categories.some(item => item.code === value)) {
      this.categoryFilter.set(value as FiscalCategory | 'ALL');
    }
  }
  applyPeriod(start: string, end: string): void {
    const valid = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!valid.test(start) || !valid.test(end) || start > end) {
      this.validationError.set('Informe um período válido, com início anterior ou igual ao fim.');
      return;
    }
    this.validationError.set('');
    this.periodStart.set(start);
    this.periodEnd.set(end);
    this.load();
  }
  load(): void {
    this.request?.unsubscribe();
    this.state.set('loading');
    this.request = this.service.list({ start: this.periodStart(), end: this.periodEnd() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.snapshot.set(data);
          this.state.set(data.status === 'EMPTY' ? 'empty' : 'ready');
        },
        error: () => {
          this.snapshot.set(null);
          this.state.set('error');
        },
      });
  }
  saveDraft(): void {
    const amount = this.draft.amount === null ? null : Number(this.draft.amount);
    const validDate = /^\d{4}-\d{2}-\d{2}$/;
    const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/;
    const validCategory = this.categories.some(item =>
      item.code === this.draft.category && item.kind === this.draft.kind
    );
    if (this.saving() || !this.draft.description.trim() ||
        !validMonth.test(this.draft.competence) || !validDate.test(this.draft.dueDate) ||
        Number.isNaN(Date.parse(this.draft.dueDate)) || !validCategory ||
        (this.draft.kind === 'TAX' && (amount === null || !Number.isFinite(amount) || amount <= 0))) {
      this.feedback.set('Preencha descrição, competência, vencimento, categoria e valor quando aplicável.');
      return;
    }
    const payload: CreateFiscalObligation = {
      ...this.draft,
      description: this.draft.description.trim(),
      amount: this.draft.kind === 'TAX' ? Math.round((amount ?? 0) * 100) / 100 : null,
      responsible: this.draft.responsible?.trim() || null,
      reference: this.draft.reference?.trim() || null,
      notes: this.draft.notes?.trim() || null,
    };
    this.saving.set(true);
    this.service.create(payload).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.feedback.set('Rascunho de teste adicionado somente à prévia.');
          this.draft = this.emptyDraft();
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.feedback.set('Não foi possível adicionar o rascunho.');
        },
      });
  }
  openPayment(item: FiscalObligation): void {
    this.selectedForCompletion.set(null);
    this.selectedForPayment.set(item);
    this.paymentDraft = { amount: null, paidAt: this.today, proofReference: '' };
  }
  recordPayment(): void {
    const item = this.selectedForPayment();
    if (!item || this.saving()) { return; }
    const amount = Number(this.paymentDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0 ||
        amount > openAmount(item) || !this.paymentDraft.paidAt ||
        this.paymentDraft.paidAt > this.today) {
      this.feedback.set('Informe valor dentro do saldo e data de pagamento não futura.');
      return;
    }
    const payment: NewFiscalPayment = {
      paidAt: this.paymentDraft.paidAt,
      amount,
      proofReference: this.paymentDraft.proofReference.trim() || null,
    };
    this.saving.set(true);
    this.service.pay(item.id, payment).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.selectedForPayment.set(null);
          this.feedback.set('Baixa simulada registrada apenas na prévia.');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.feedback.set('Falha na baixa de teste. Verifique o valor informado.');
        },
      });
  }
  openCompletion(item: FiscalObligation): void {
    this.selectedForPayment.set(null);
    this.selectedForCompletion.set(item);
    this.completionDraft = { completedAt: this.today, completionReference: '' };
  }
  completeAccessory(): void {
    const item = this.selectedForCompletion();
    if (!item || this.saving()) { return; }
    if (!this.completionDraft.completedAt || this.completionDraft.completedAt > this.today) {
      this.feedback.set('Informe uma data de conclusão válida, não futura.');
      return;
    }
    const details: CompleteAccessory = {
      completedAt: this.completionDraft.completedAt,
      completionReference: this.completionDraft.completionReference.trim() || null,
    };
    this.saving.set(true);
    this.service.complete(item.id, details).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.selectedForCompletion.set(null);
          this.feedback.set('Conclusão simulada registrada somente na prévia.');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.feedback.set('Não foi possível concluir a obrigação.');
        },
      });
  }
  remove(item: FiscalObligation): void {
    if (this.saving() || this.pendingDelete() !== item.id) {
      this.pendingDelete.set(item.id);
      return;
    }
    this.saving.set(true);
    this.service.deleteDraft(item.id).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.pendingDelete.set(null);
          this.feedback.set('Rascunho removido da prévia.');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.feedback.set('Não é possível excluir registros já concluídos ou com baixas.');
        },
      });
  }

  kindText(kind: FiscalKind): string {
    return this.kinds.find(item => item.code === kind)?.label ?? kind;
  }
  categoryText(category: FiscalCategory): string {
    return this.categories.find(item => item.code === category)?.label ?? category;
  }
  status(item: FiscalObligation): FiscalDisplayStatus {
    return fiscalStatus(item, this.today);
  }
  statusText(item: FiscalObligation): string {
    switch (this.status(item)) {
      case 'DONE': return item.kind === 'TAX' ? 'Pago' : 'Concluída';
      case 'OVERDUE': return 'Vencido';
      case 'PARTIAL': return 'Pago parcialmente';
      default: return 'Em aberto';
    }
  }
  daysLabel(item: FiscalObligation): string {
    const days = daysUntil(item.dueDate, this.today);
    return days === 0 ? 'Vence hoje' : `Vence em ${days} dia${days === 1 ? '' : 's'}`;
  }
  paid(item: FiscalObligation): number { return settledAmount(item); }
  remaining(item: FiscalObligation): number { return openAmount(item); }
  money(value: number | null | undefined): string {
    if (value == null) { return 'R$ —'; }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
  dateText(date: string): string {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
  private currentMonth(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  private currentDate(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  private emptyDraft(): CreateFiscalObligation {
    return {
      kind: 'TAX', category: 'REVENUE_TAX', description: '',
      competence: this.currentMonth(), dueDate: '', amount: null,
      responsible: null, reference: null, notes: null,
    };
  }
}
