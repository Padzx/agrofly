import {
  Component, computed, DestroyRef, inject, OnInit, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';
import {
  BillingDocument, BillingStatus, CreateBillingDocument,
  estimatedBillingTotal, BillingDto,
} from '../../../core/financial/financial-billing.model';
import { FinancialBillingService } from '../../../core/financial/financial-billing.service';

type ViewState = 'loading' | 'ready' | 'empty' | 'error';
type StatusFilter = BillingStatus | 'ALL';

@Component({
  selector: 'app-financial-billing',
  imports: [Card, Button, FormsModule],
  templateUrl: './financial-billing.html',
  styleUrl: './financial-billing.scss',
})
export class FinancialBilling implements OnInit {
  private readonly service = inject(FinancialBillingService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly startMonth = signal(this.currentMonth());
  readonly endMonth = signal(this.currentMonth());
  readonly state = signal<ViewState>('loading');
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly statusFilter = signal<StatusFilter>('ALL');
  readonly search = signal('');
  readonly message = signal('');
  readonly error = signal('');
  readonly selectedForIssue = signal<string | null>(null);
  private readonly snapshot = signal<BillingDto | null>(null);

  draft: CreateBillingDocument = this.newDraft();
  externalInvoiceRef = '';
  externalIssuedAt = this.today();

  readonly documents = computed(() => this.snapshot()?.documents ?? []);
  readonly filtered = computed(() => {
    const term = this.search().trim().toLocaleLowerCase('pt-BR');
    return this.documents().filter(item =>
      (this.statusFilter() === 'ALL' || this.statusFilter() === item.status) &&
      (!term || [item.customer, item.serviceDescription, item.contractRef ?? '',
        item.serviceOrderRef ?? '', item.externalInvoiceRef ?? '']
        .some(value => value.toLocaleLowerCase('pt-BR').includes(term)))
    );
  });

  readonly totals = computed(() => {
    const docs = this.documents();
    const sum = (status: BillingStatus) => docs
      .filter(item => item.status === status)
      .reduce((total, item) => total + estimatedBillingTotal(item), 0);
    return {
      drafts: docs.filter(item => item.status === 'DRAFT').length,
      awaitingIssue: docs.filter(item => item.status === 'READY').length,
      issued: docs.filter(item => item.status === 'ISSUED').length,
      cancelled: docs.filter(item => item.status === 'CANCELLED').length,
      awaitingIssueAmount: docs.length ? sum('READY') : null,
      issuedAmount: docs.length ? sum('ISSUED') : null,
    };
  });

  readonly statusLabel = computed(() => {
    if (this.state() === 'loading') { return 'Carregando'; }
    if (this.state() === 'error') { return 'Dados indisponíveis'; }
    return this.snapshot()?.source === 'PREVIEW'
      ? 'Pré-visualização — sem emissão fiscal'
      : this.state() === 'empty' ? 'Sem documentos' : 'Dados atualizados';
  });

  readonly statuses: { code: BillingStatus; label: string }[] = [
    { code: 'DRAFT', label: 'Rascunho' },
    { code: 'READY', label: 'Aguardando emissão' },
    { code: 'ISSUED', label: 'Emissão externa simulada' },
    { code: 'CANCELLED', label: 'Cancelado na prévia' },
  ];

  ngOnInit(): void { this.load(); }

  applyPeriod(start: string, end: string): void {
    const valid = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!valid.test(start) || !valid.test(end) || start > end) {
      this.error.set('Selecione um período válido, com início anterior ou igual ao fim.');
      return;
    }
    this.error.set('');
    this.startMonth.set(start);
    this.endMonth.set(end);
    this.load();
  }

  changeStatusFilter(value: string): void {
    if (value === 'ALL' || this.statuses.some(item => item.code === value)) {
      this.statusFilter.set(value as StatusFilter);
    }
  }

  openForm(): void {
    this.draft = this.newDraft();
    this.error.set('');
    this.message.set('');
    this.showForm.set(true);
  }

  closeForm(): void { this.showForm.set(false); }

  load(): void {
    this.request?.unsubscribe();
    this.state.set('loading');
    this.request = this.service.list({ start: this.startMonth(), end: this.endMonth() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.snapshot.set(data);
          this.state.set(data.status === 'EMPTY' ? 'empty' : 'ready');
        },
        error: () => { this.snapshot.set(null); this.state.set('error'); },
      });
  }

  saveDraft(): void {
    if (this.saving()) { return; }
    this.error.set('');
    const draft = this.draft;
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(draft.servicedAt);
    const monthValid = /^\d{4}-(0[1-9]|1[0-2])$/.test(draft.competence);
    const numbers = [draft.hectares, draft.pricePerHectare,
      draft.mobilization, draft.discount].map(Number);
    const estimate = estimatedBillingTotal(draft);
    if (!draft.customer.trim() || !draft.serviceDescription.trim()
        || !monthValid || !dateValid || numbers.some(value => !Number.isFinite(value))
        || numbers[0] <= 0 || numbers[1] <= 0 || numbers[2] < 0 || numbers[3] < 0
        || !Number.isFinite(estimate) || estimate <= 0) {
      this.error.set('Preencha cliente, serviço, datas e valores válidos. O total deve ser positivo.');
      return;
    }
    this.saving.set(true);
    const payload: CreateBillingDocument = {
      ...draft,
      customer: draft.customer.trim(),
      customerTaxId: draft.customerTaxId?.trim() || null,
      contractRef: draft.contractRef?.trim() || null,
      serviceOrderRef: draft.serviceOrderRef?.trim() || null,
      serviceDescription: draft.serviceDescription.trim(),
      notes: draft.notes?.trim() || null,
      hectares: numbers[0], pricePerHectare: numbers[1],
      mobilization: numbers[2], discount: numbers[3],
    };
    this.service.create(payload).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false); this.showForm.set(false);
          this.message.set('Rascunho criado apenas nesta pré-visualização.');
          this.load();
        },
        error: () => {
          this.saving.set(false); this.error.set('Não foi possível criar o rascunho.');
        },
      });
  }

  markReady(item: BillingDocument): void {
    if (this.saving() || item.status !== 'DRAFT') { return; }
    this.saving.set(true); this.error.set('');
    this.service.setStatus(item.id, 'READY')
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Documento marcado como aguardando emissão — apenas na prévia.');
          this.load();
        },
        error: () => {
          this.saving.set(false); this.error.set('Falha ao alterar o status.');
        },
      });
  }

  openExternalForm(item: BillingDocument): void {
    if (item.status !== 'READY') { return; }
    this.selectedForIssue.set(item.id);
    this.externalInvoiceRef = '';
    this.externalIssuedAt = this.today();
    this.error.set('');
  }

  recordExternal(): void {
    const id = this.selectedForIssue();
    const ref = this.externalInvoiceRef.trim();
    if (!id || this.saving()) { return; }
    if (!ref || !/^\d{4}-\d{2}-\d{2}$/.test(this.externalIssuedAt)) {
      this.error.set('Informe referência e data da emissão externa para a simulação.');
      return;
    }
    this.saving.set(true);
    this.service.recordExternalInvoice(id, {
      externalInvoiceRef: ref, issuedAt: this.externalIssuedAt,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false); this.selectedForIssue.set(null);
        this.message.set('Emissão externa registrada SOMENTE na pré-visualização. Nenhuma nota foi emitida.');
        this.load();
      },
      error: () => {
        this.saving.set(false); this.error.set('Falha ao registrar a emissão simulada.');
      },
    });
  }

  cancel(item: BillingDocument): void {
    if (this.saving() || item.status !== 'READY') { return; }
    this.saving.set(true);
    this.service.setStatus(item.id, 'CANCELLED')
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.saving.set(false);
          this.message.set('Documento cancelado somente na pré-visualização.');
          this.load();
        },
        error: () => {
          this.saving.set(false); this.error.set('Falha ao cancelar na prévia.');
        },
      });
  }

  remove(item: BillingDocument): void {
    if (this.saving() || item.status !== 'DRAFT') { return; }
    this.saving.set(true);
    this.service.deleteDraft(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.saving.set(false); this.message.set('Rascunho removido.'); this.load();
        },
        error: () => {
          this.saving.set(false); this.error.set('Não foi possível remover o rascunho.');
        },
      });
  }

  statusText(value: BillingStatus): string {
    return this.statuses.find(item => item.code === value)?.label ?? value;
  }

  amount(item: BillingDocument): number { return estimatedBillingTotal(item); }

  money(value: number | null | undefined): string {
    if (value == null) { return 'R$ —'; }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  dateText(iso: string): string {
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }

  private newDraft(): CreateBillingDocument {
    return {
      competence: this.currentMonth(), customer: '', customerTaxId: null,
      contractRef: null, serviceOrderRef: null, serviceDescription: '',
      servicedAt: this.today(), hectares: 0, pricePerHectare: 0,
      mobilization: 0, discount: 0, notes: null,
    };
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
