import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import {
  CompleteAccessory, CreateFiscalObligation, FiscalObligation,
  FiscalObligationsDto, FiscalPeriod, NewFiscalPayment, openAmount,
} from './financial-taxes.model';

@Injectable({ providedIn: 'root' })
export class FinancialTaxesService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/v1/financial/obligations';
  readonly previewMode = true; // Trocar apenas quando todos os módulos tiverem interfaces prontas.
  private obligations: FiscalObligation[] = [];
  private nextId = 0;

  list(period: FiscalPeriod): Observable<FiscalObligationsDto> {
    if (!this.previewMode) {
      const params = new HttpParams().set('start', period.start).set('end', period.end);
      return this.http.get<FiscalObligationsDto>(this.endpoint, { params });
    }
    const obligations = this.obligations.filter(item =>
      item.competence >= period.start && item.competence <= period.end
    );
    return of({
      status: obligations.length ? 'READY' : 'EMPTY',
      source: 'PREVIEW', period, obligations, updatedAt: null,
    });
  }

  create(draft: CreateFiscalObligation): Observable<FiscalObligation> {
    if (!this.previewMode) {
      return this.http.post<FiscalObligation>(this.endpoint, draft);
    }
    const record: FiscalObligation = {
      ...draft, id: `preview-fiscal-${++this.nextId}`, source: 'PREVIEW',
      payments: [], completedAt: null, completionReference: null,
    };
    this.obligations = [record, ...this.obligations];
    return of(record);
  }

  pay(id: string, payment: NewFiscalPayment): Observable<FiscalObligation> {
    if (!this.previewMode) {
      return this.http.post<FiscalObligation>(
        `${this.endpoint}/${encodeURIComponent(id)}/payments`, payment
      );
    }
    const current = this.obligations.find(item => item.id === id);
    if (!current || current.kind !== 'TAX') {
      return throwError(() => new Error('Tributo não encontrado.'));
    }
    const available = openAmount(current);
    if (!Number.isFinite(payment.amount) || payment.amount <= 0.004 ||
        Math.round(payment.amount * 100) / 100 > available) {
      return throwError(() => new Error('O valor deve ser positivo e não ultrapassar o saldo.'));
    }
    const updated: FiscalObligation = {
      ...current,
      payments: [...current.payments, {
        ...payment, id: `preview-payment-${++this.nextId}`,
        amount: Math.round(payment.amount * 100) / 100,
      }],
    };
    this.obligations = this.obligations.map(item => item.id === id ? updated : item);
    return of(updated);
  }

  complete(id: string, details: CompleteAccessory): Observable<FiscalObligation> {
    if (!this.previewMode) {
      return this.http.patch<FiscalObligation>(
        `${this.endpoint}/${encodeURIComponent(id)}/complete`, details
      );
    }
    const current = this.obligations.find(item => item.id === id);
    if (!current || current.kind !== 'ACCESSORY' || current.completedAt !== null) {
      return throwError(() => new Error('Obrigação acessória indisponível.'));
    }
    const updated: FiscalObligation = {
      ...current,
      completedAt: details.completedAt,
      completionReference: details.completionReference,
    };
    this.obligations = this.obligations.map(item => item.id === id ? updated : item);
    return of(updated);
  }

  deleteDraft(id: string): Observable<void> {
    if (!this.previewMode) {
      return this.http.delete<void>(`${this.endpoint}/${encodeURIComponent(id)}`);
    }
    const current = this.obligations.find(item => item.id === id);
    if (!current || current.payments.length || current.completedAt !== null) {
      return throwError(() => new Error('Só é possível excluir lançamentos sem baixas.'));
    }
    this.obligations = this.obligations.filter(item => item.id !== id);
    return of(undefined);
  }
}
