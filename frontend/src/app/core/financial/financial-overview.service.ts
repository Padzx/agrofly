import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { FinancialOverviewDto } from './financial-overview.model';

@Injectable({
  providedIn: 'root',
})
export class FinancialOverviewService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/v1/financial/overview';

  getOverview(): Observable<FinancialOverviewDto> {
    return this.http.get<FinancialOverviewDto>(
      this.endpoint
    );
  }
}
