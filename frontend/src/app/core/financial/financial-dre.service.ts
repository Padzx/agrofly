import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  FinancialDreDto,
} from './financial-dre.model';

@Injectable({
  providedIn: 'root',
})
export class FinancialDreService {
  private readonly http = inject(HttpClient);

  private readonly endpoint =
    '/api/v1/financial/dre';

  getDre(competence: string): Observable<FinancialDreDto> {
    const params = new HttpParams()
      .set('competence', competence);

    return this.http.get<FinancialDreDto>(
      this.endpoint,
      { params }
    );
  }
}
