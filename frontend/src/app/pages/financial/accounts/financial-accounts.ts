import {
  Component, computed, DestroyRef, inject, OnInit, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';
import {
  AccountCategory, AccountDirection, CreateFinancialAccount,
  CreateSettlement, FinancialAccount, FinancialAccountsDto,
  SettlementMethod,
} from '../../../core/financial/financial-accounts.model';
import { FinancialAccountsService } from
  '../../../core/financial/financial-accounts.service';

type DirectionFilter = AccountDirection | 'ALL';
type StatusFilter = 'ALL' | 'OPEN' | 'PARTIAL' | 'SETTLED' | 'OVERDUE';
type ViewState = 'loading' | 'ready' | 'empty' | 'error';

@Component({
  selector: 'app-financial-accounts',
  imports: [Card, Button, FormsModule],
  templateUrl: './financial-accounts.html',
  styleUrl: './financial-accounts.scss',
})
export class FinancialAccounts implements OnInit {
  private readonly service = inject(FinancialAccountsService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly startMonth = signal(this.currentMonth());
  readonly endMonth = signal(this.currentMonth());
  readonly state = signal<ViewState>('loading');
  readonly snapshot = signal<FinancialAccountsDto | null>(null);
  readonly directionFilter = signal<DirectionFilter>('ALL');
  readonly statusFilter = signal<StatusFilter>('ALL');
  readonly search = signal('');
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly feedback = signal('');
  readonly errorMessage = signal('');
  readonly settlementTarget = signal<string | null>(null);
  readonly deleteTarget = signal<string | null>(null);
  readonly historyTarget = signal<string | null>(null);

  readonly directions: { code: AccountDirection; label: string }[] = [
    { code: 'RECEIVABLE', label: 'A receber' },
    { code: 'PAYABLE', label: 'A pagar' },
  ];
  readonly categories: {
    code: AccountCategory; label: string; directions: AccountDirection[];
  }[] = [
    { code: 'SERVICE', label: 'Serviço aeroagrícola', directions: ['RECEIVABLE'] },
    { code: 'FUEL', label: 'Combustível pago pela AgroFly', directions: ['PAYABLE'] },
    { code: 'CREW', label: 'Tripulação', directions: ['PAYABLE'] },
    { code: 'MAINTENANCE', label: 'Manutenção', directions: ['PAYABLE'] },
    { code: 'SUPPLIER', label: 'Fornecedores', directions: ['PAYABLE'] },
    { code: 'TAX', label: 'Tributos', directions: ['PAYABLE'] },
    { code: 'ADMIN', label: 'Administrativo', directions: ['PAYABLE'] },
    { code: 'OTHER', label: 'Outros', directions: ['RECEIVABLE', 'PAYABLE'] },
  ];
  readonly methods: { code: SettlementMethod; label: string }[] = [
    { code: 'PIX', label: 'Pix' },
    { code: 'TRANSFER', label: 'Transferência' },
    { code: 'BOLETO', label: 'Boleto' },
    { code: 'CARD', label: 'Cartão' },
    { code: 'CASH', label: 'Dinheiro' },
    { code: 'OTHER', label: 'Outro' },
  ];

  draft: CreateFinancialAccount = this.emptyDraft();
  settlement: CreateSettlement = this.emptySettlement();

  readonly accounts = computed(() => this.snapshot()?.accounts ?? []);
  readonly summary = computed(() => {
    const accounts = this.accounts();
    if (!accounts.length) return null;
    const remainingByDirection = (direction: AccountDirection) =>
      accounts.filter(item => item.direction === direction)
        .reduce((sum, item) => sum + this.remainingCents(item), 0) / 100;
    const overdueByDirection = (direction: AccountDirection) =>
      accounts.filter(item => item.direction === direction && this.isOverdue(item))
        .reduce((sum, item) => sum + this.remainingCents(item), 0) / 100;
    return {
      receivable: remainingByDirection('RECEIVABLE'),
      payable: remainingByDirection('PAYABLE'),
      overdueReceivable: overdueByDirection('RECEIVABLE'),
      overduePayable: overdueByDirection('PAYABLE'),
    };
  });
  readonly filtered = computed(() => {
    const needle = this.search().trim().toLocaleLowerCase('pt-BR');
    return this.accounts().filter(item => {
      const directionOk = this.directionFilter() === 'ALL' ||
        item.direction === this.directionFilter();
      const status = this.statusFilter();
      const statusOk = status === 'ALL' ||
        (status === 'OVERDUE' ? this.isOverdue(item) :
         status === 'SETTLED' ? this.isSettled(item) :
         status === 'PARTIAL' ? this.isPartial(item) :
         this.remainingCents(item) > 0 && !this.isPartial(item));
      const text = `${item.description} ${item.counterparty} ${item.contractRef ?? ''}`
        .toLocaleLowerCase('pt-BR');
      return directionOk && statusOk && (!needle || text.includes(needle));
    });
  });
  readonly upcoming = computed(() => this.accounts()
    .filter(item => this.remainingCents(item) > 0 && item.dueDate >= this.today())
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5));
  readonly statusLabel = computed(() => {
    if (this.state() === 'loading') return 'Carregando';
    if (this.state() === 'error') return 'Dados indisponíveis';
    return 'Pré-visualização sem integração';
  });

  get availableCategories() {
    return this.categories.filter(item =>
      item.directions.includes(this.draft.direction)
    );
  }

  ngOnInit(): void { this.load(); }

  applyPeriod(start: string, end: string): void {
    const month = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!month.test(start) || !month.test(end) || start > end) {
      this.errorMessage.set('Informe um período inicial anterior ou igual ao final.');
      return;
    }
    this.errorMessage.set('');
    this.startMonth.set(start);
    this.endMonth.set(end);
    this.load();
  }

  setDirectionFilter(value: string): void {
    if (value === 'ALL' || value === 'PAYABLE' || value === 'RECEIVABLE') {
      this.directionFilter.set(value);
    }
  }

  setStatusFilter(value: string): void {
    if (['ALL', 'OPEN', 'PARTIAL', 'SETTLED', 'OVERDUE'].includes(value)) {
      this.statusFilter.set(value as StatusFilter);
    }
  }

  onDraftDirectionChange(): void {
    this.draft.category = this.availableCategories[0]?.code ?? 'OTHER';
  }

  openForm(direction: AccountDirection = 'RECEIVABLE'): void {
    this.draft = { ...this.emptyDraft(), direction,
      category: direction === 'RECEIVABLE' ? 'SERVICE' : 'FUEL' };
    this.errorMessage.set('');
    this.showForm.set(true);
  }

  cancelForm(): void { this.showForm.set(false); }

  load(): void {
    this.request?.unsubscribe();
    this.state.set('loading');
    this.request = this.service.list({
      start: this.startMonth(), end: this.endMonth(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    const amount = Number(this.draft.amount);
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    const month = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (this.saving() || !this.draft.description.trim() ||
        !this.draft.counterparty.trim() ||
        !isoDate.test(this.draft.issueDate) ||
        !isoDate.test(this.draft.dueDate) ||
        !month.test(this.draft.competence) ||
        this.draft.dueDate < this.draft.issueDate ||
        !Number.isFinite(amount) || Math.round(amount * 100) <= 0 ||
        !this.availableCategories.some(item => item.code === this.draft.category)) {
      this.errorMessage.set('Revise descrição, contraparte, datas, categoria e valor.');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    const payload: CreateFinancialAccount = {
      ...this.draft,
      description: this.draft.description.trim(),
      counterparty: this.draft.counterparty.trim(),
      contractRef: this.draft.contractRef?.trim() || null,
      amount: Math.round(amount * 100) / 100,
    };
    this.service.create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.feedback.set('Título de teste criado (somente nesta sessão).');
          this.startMonth.set(payload.dueDate.slice(0, 7));
          this.endMonth.set(payload.dueDate.slice(0, 7));
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Não foi possível cadastrar o título.');
        },
      });
  }

  openSettlement(item: FinancialAccount): void {
    this.settlementTarget.set(item.id);
    this.deleteTarget.set(null);
    this.settlement = {
      date: this.today(), amount: this.remainingCents(item) / 100, method: 'PIX',
    };
    this.errorMessage.set('');
  }

  cancelSettlement(): void { this.settlementTarget.set(null); }

  settle(item: FinancialAccount): void {
    const cents = Math.round(Number(this.settlement.amount) * 100);
    if (this.saving() || !Number.isFinite(cents) || cents <= 0 ||
        cents > this.remainingCents(item) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(this.settlement.date)) {
      this.errorMessage.set('Informe data e valor válido, sem exceder o saldo.');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    this.service.settle(item.id, { ...this.settlement, amount: cents / 100 })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.saving.set(false);
          this.settlementTarget.set(null);
          this.feedback.set('Baixa de teste registrada. Não afeta o Fluxo de Caixa.');
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('Falha ao registrar a baixa.');
        },
      });
  }

  requestDelete(item: FinancialAccount): void {
    if (item.settlements.length) return;
    this.deleteTarget.set(item.id);
    this.settlementTarget.set(null);
  }

  confirmDelete(id: string): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.service.remove(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleteTarget.set(null);
        this.feedback.set('Título de teste excluído.');
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Título já baixado não pode ser excluído.');
      },
    });
  }

  toggleHistory(id: string): void {
    this.historyTarget.update(current => current === id ? null : id);
  }

  remainingCents(item: FinancialAccount): number {
    const paid = item.settlements.reduce(
      (sum, entry) => sum + Math.round(entry.amount * 100), 0
    );
    return Math.max(0, Math.round(item.amount * 100) - paid);
  }
  remaining(item: FinancialAccount): number {
    return this.remainingCents(item) / 100;
  }
  isSettled(item: FinancialAccount): boolean {
    return this.remainingCents(item) === 0;
  }
  isPartial(item: FinancialAccount): boolean {
    return item.settlements.length > 0 && !this.isSettled(item);
  }
  isOverdue(item: FinancialAccount): boolean {
    return !this.isSettled(item) && item.dueDate < this.today();
  }
  statusText(item: FinancialAccount): string {
    if (this.isSettled(item)) return 'Liquidado';
    if (this.isOverdue(item)) return this.isPartial(item) ? 'Vencido · parcial' : 'Vencido';
    return this.isPartial(item) ? 'Parcial' : 'Em aberto';
  }
  categoryLabel(code: AccountCategory): string {
    return this.categories.find(item => item.code === code)?.label ?? code;
  }
  directionLabel(code: AccountDirection): string {
    return code === 'RECEIVABLE' ? 'A receber' : 'A pagar';
  }
  methodLabel(code: SettlementMethod): string {
    return this.methods.find(item => item.code === code)?.label ?? code;
  }
  money(value: number | null | undefined): string {
    return value == null ? 'R$ —' : new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL',
    }).format(value);
  }
  displayDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  private currentMonth(): string { return this.today().slice(0, 7); }
  private emptyDraft(): CreateFinancialAccount {
    return {
      direction: 'RECEIVABLE', description: '', counterparty: '',
      category: 'SERVICE', competence: this.currentMonth(),
      issueDate: this.today(), dueDate: this.today(),
      amount: 0, contractRef: null,
    };
  }
  private emptySettlement(): CreateSettlement {
    return { date: this.today(), amount: 0, method: 'PIX' };
  }
}
