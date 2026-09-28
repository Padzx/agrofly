import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import {
  BillingDocument, BillingDto, BillingPeriod, BillingStatus,
  CreateBillingDocument, RecordExternalInvoice,
} from './financial-billing.model';

@Injectable({ providedIn: 'root' })
export class FinancialBillingService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/v1/financial/billing';

  // O backend será implementado somente após concluir todas as interfaces.
  readonly previewMode = true;
  private documents: BillingDocument[] = [];
  private nextId = 0;

  list(period: BillingPeriod): Observable<BillingDto> {
    if (!this.previewMode) {
      const params = new HttpParams().set('start', period.start).set('end', period.end);
      return this.http.get<BillingDto>(this.endpoint, { params });
    }
    const documents = this.documents.filter(item =>
      item.competence >= period.start && item.competence <= period.end
    );
    return of({
      status: documents.length ? 'READY' : 'EMPTY',
      source: 'PREVIEW', period, documents, updatedAt: null,
    });
  }

  create(draft: CreateBillingDocument): Observable<BillingDocument> {
    if (!this.previewMode) {
      return this.http.post<BillingDocument>(this.endpoint, draft);
    }
    const document: BillingDocument = {
      ...draft, id: `preview-billing-${++this.nextId}`,
      status: 'DRAFT', source: 'PREVIEW',
      externalInvoiceRef: null, issuedAt: null,
    };
    this.documents = [document, ...this.documents];
    return of(document);
  }

  setStatus(id: string, status: Extract<BillingStatus, 'READY' | 'CANCELLED'>): Observable<BillingDocument> {
    if (!this.previewMode) {
      return this.http.patch<BillingDocument>(`${this.endpoint}/${encodeURIComponent(id)}/status`, { status });
    }
    const item = this.documents.find(doc => doc.id === id);
    if (!item) { throw new Error('Documento não encontrado.'); }
    if (item.status === 'ISSUED' || item.status === 'CANCELLED') {
      throw new Error('O status deste documento não pode ser alterado na prévia.');
    }
    const updated = { ...item, status };
    this.documents = this.documents.map(doc => doc.id === id ? updated : doc);
    return of(updated);
  }

  recordExternalInvoice(id: string, details: RecordExternalInvoice): Observable<BillingDocument> {
    if (!this.previewMode) {
      return this.http.patch<BillingDocument>(
        `${this.endpoint}/${encodeURIComponent(id)}/external-invoice`, details
      );
    }
    const item = this.documents.find(doc => doc.id === id);
    if (!item || item.status !== 'READY') {
      throw new Error('Prepare o documento antes de registrar a emissão externa.');
    }
    const updated: BillingDocument = {
      ...item, status: 'ISSUED',
      externalInvoiceRef: details.externalInvoiceRef,
      issuedAt: details.issuedAt,
    };
    this.documents = this.documents.map(doc => doc.id === id ? updated : doc);
    return of(updated);
  }

  deleteDraft(id: string): Observable<void> {
    if (!this.previewMode) {
      return this.http.delete<void>(`${this.endpoint}/${encodeURIComponent(id)}`);
    }
    const item = this.documents.find(doc => doc.id === id);
    if (!item || item.status !== 'DRAFT') {
      throw new Error('Somente rascunhos podem ser excluídos.');
    }
    this.documents = this.documents.filter(doc => doc.id !== id);
    return of(undefined);
  }
}
