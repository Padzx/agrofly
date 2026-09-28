import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import {
  CashFlowDto,
  CashFlowPeriod,
} from './financial-cash-flow.model';

@Injectable({
  providedIn: 'root',
})
export class FinancialCashFlowService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/v1/financial/cash-flow';

  // Mantemos o modo de pré-visualização
  // até começarmos a implementar o backend.
  private readonly previewMode = true;

  getCashFlow(
    period: CashFlowPeriod
  ): Observable<CashFlowDto> {
    if (this.previewMode) {
      return of({
        status: 'EMPTY',
        source: 'PREVIEW',
        period,
        summary: {
          openingBalance: null,
          realizedInflows: null,
          realizedOutflows: null,
          closingBalance: null,
          expectedInflows: null,
          expectedOutflows: null,
          projectedBalance: null,
        },
        timeline: [],
        movements: [],
        updatedAt: null,
      });
    }

    const params = new HttpParams()
      .set('start', period.start)
      .set('end', period.end);

    return this.http.get<CashFlowDto>(
      this.endpoint,
      { params }
    );
  }
}
