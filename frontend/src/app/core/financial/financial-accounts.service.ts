import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import {
  AccountsQuery, CreateFinancialAccount, CreateSettlement,
  FinancialAccount, FinancialAccountsDto,
} from './financial-accounts.model';

@Injectable({ providedIn: 'root' })
export class FinancialAccountsService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/v1/financial/accounts';

  // Somente prévia: nada é salvo no servidor ou em outros módulos.
  readonly previewMode = true;
  private records: FinancialAccount[] = [];
  private sequence = 0;

  list(query: AccountsQuery): Observable<FinancialAccountsDto> {
    if (!this.previewMode) {
      const params = new HttpParams()
        .set('start', query.start).set('end', query.end);
      return this.http.get<FinancialAccountsDto>(this.endpoint, { params });
    }
    // O filtro de período considera a DATA DE VENCIMENTO do título.
    const accounts = this.records
      .filter(item => item.dueDate.slice(0, 7) >= query.start &&
                      item.dueDate.slice(0, 7) <= query.end)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return of({
      status: accounts.length ? 'READY' : 'EMPTY',
      source: 'PREVIEW', period: query,
      accounts: accounts.map(item => ({
        ...item,
        settlements: [...item.settlements],
      })),
      updatedAt: null,
    });
  }

  create(draft: CreateFinancialAccount): Observable<FinancialAccount> {
    if (!this.previewMode) {
      return this.http.post<FinancialAccount>(this.endpoint, draft);
    }
    const item: FinancialAccount = {
      ...draft, id: `preview-${++this.sequence}`,
      settlements: [], source: 'PREVIEW',
    };
    this.records = [item, ...this.records];
    return of(item);
  }

  settle(id: string, draft: CreateSettlement): Observable<FinancialAccount> {
    if (!this.previewMode) {
      return this.http.post<FinancialAccount>(
        `${this.endpoint}/${encodeURIComponent(id)}/settlements`, draft
      );
    }
    const item = this.records.find(record => record.id === id);
    if (!item) {
      return throwError(() => new Error('Título não encontrado.'));
    }
    // Centavos para impedir baixas acima do valor do título.
    const amountCents = Math.round(draft.amount * 100);
    const paidCents = item.settlements.reduce(
      (sum, entry) => sum + Math.round(entry.amount * 100), 0
    );
    const totalCents = Math.round(item.amount * 100);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
        !Number.isFinite(draft.amount) || amountCents <= 0 ||
        amountCents + paidCents > totalCents) {
      return throwError(() => new Error('Baixa inválida ou superior ao saldo.'));
    }
    item.settlements = [
      ...item.settlements,
      { ...draft, amount: amountCents / 100,
        id: `settlement-${++this.sequence}` },
    ];
    return of({ ...item, settlements: [...item.settlements] });
  }

  remove(id: string): Observable<void> {
    if (!this.previewMode) {
      return this.http.delete<void>(
        `${this.endpoint}/${encodeURIComponent(id)}`
      );
    }
    const item = this.records.find(record => record.id === id);
    if (!item || item.settlements.length) {
      return throwError(() => new Error('Título inexistente ou já baixado.'));
    }
    this.records = this.records.filter(record => record.id !== id);
    return of(undefined);
  }
}
