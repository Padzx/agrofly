import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import {
  CostPeriod,
  CostRecord,
  CreateCostRecord,
  CostCategory,
  FinancialCostsDto,
} from './financial-costs.model';

@Injectable({
  providedIn: 'root',
})
export class FinancialCostsService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/v1/financial/costs';

  // Desativaremos este modo somente
  // quando o backend estiver implementado.
  readonly previewMode = true;

  private records: CostRecord[] = [];
  private nextId = 0;

  getCosts(period: CostPeriod): Observable<FinancialCostsDto> {
    if (!this.previewMode) {
      const params = new HttpParams()
        .set('start', period.start)
        .set('end', period.end);

      return this.http.get<FinancialCostsDto>(
        this.endpoint,
        { params }
      );
    }

    const filtered = this.records.filter(record =>
      record.competence >= period.start &&
      record.competence <= period.end
    );

    const operating = this.sum(
      filtered.filter(item => item.nature === 'OPERATING')
    );

    const administrative = this.sum(
      filtered.filter(item => item.nature === 'ADMINISTRATIVE')
    );

    const commercial = this.sum(
      filtered.filter(item => item.nature === 'COMMERCIAL')
    );

    const groups = new Map<CostCategory, number>();

    for (const record of filtered) {
      groups.set(
        record.category,
        (groups.get(record.category) ?? 0) + record.amount
      );
    }

    const categoryTotals = [...groups.entries()]
      .map(([category, total]) => ({
        category,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    const hasRecords = filtered.length > 0;

    return of({
      status: hasRecords ? 'READY' : 'EMPTY',
      source: 'PREVIEW',
      period,
      summary: {
        operatingCosts: hasRecords ? operating : null,
        administrativeExpenses: hasRecords
          ? administrative : null,
        commercialExpenses: hasRecords
          ? commercial : null,
        totalExpenses: hasRecords
          ? operating + administrative + commercial
          : null,

        // Depende dos hectares executados
        // registrados no módulo operacional.
        costPerHectare: null,
      },
      categoryTotals,
      records: filtered,
      updatedAt: null,
    });
  }

  createCost(
    draft: CreateCostRecord
  ): Observable<CostRecord> {
    if (!this.previewMode) {
      return this.http.post<CostRecord>(
        this.endpoint,
        draft
      );
    }

    const record: CostRecord = {
      ...draft,
      id: `preview-${++this.nextId}`,
      source: 'PREVIEW',
    };

    this.records = [record, ...this.records];

    return of(record);
  }

  deleteCost(id: string): Observable<void> {
    if (!this.previewMode) {
      return this.http.delete<void>(
        `${this.endpoint}/${encodeURIComponent(id)}`
      );
    }

    this.records = this.records.filter(
      record => record.id !== id
    );

    return of(undefined);
  }

  private sum(records: CostRecord[]): number {
    return records.reduce(
      (total, record) => total + record.amount,
      0
    );
  }
}
