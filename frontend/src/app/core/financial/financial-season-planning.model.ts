export type SeasonMonth =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12;

export interface SeasonMonthAllocation {
  month: SeasonMonth;
  percentage: number;
}

export interface SeasonMonthProjection {
  month: SeasonMonth;

  percentage: number;

  hectares: number;

  flightHours: number;

  grossRevenue: number;

  pilotCommission: number;

  taxes: number;

  variableCosts: number;

  contributionMargin: number;
}
