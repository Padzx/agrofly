export type FiscalKind = 'TAX' | 'ACCESSORY';
export type FiscalCategory =
  | 'REVENUE_TAX' | 'PROFIT_TAX' | 'PAYROLL' | 'OTHER_TAX'
  | 'ACCESSORY_REPORT' | 'OTHER_ACCESSORY';
export type FiscalDisplayStatus = 'OPEN' | 'PARTIAL' | 'OVERDUE' | 'DONE';

export interface FiscalPeriod {
  start: string; // Competência YYYY-MM
  end: string;
}

export interface CreateFiscalObligation {
  kind: FiscalKind;
  category: FiscalCategory;
  description: string;
  competence: string; // YYYY-MM: competência, distinta do vencimento
  dueDate: string; // YYYY-MM-DD; preenchimento manual
  amount: number | null; // obrigatório para tributos; null para acessórias
  responsible: string | null;
  reference: string | null; // texto de referência; não é upload de comprovante
  notes: string | null;
}

export interface FiscalPayment {
  id: string;
  paidAt: string;
  amount: number;
  proofReference: string | null;
}

export interface FiscalObligation extends CreateFiscalObligation {
  id: string;
  source: 'PREVIEW' | 'API';
  payments: FiscalPayment[];
  completedAt: string | null; // usado somente em obrigação acessória
  completionReference: string | null;
}

export interface NewFiscalPayment {
  paidAt: string;
  amount: number;
  proofReference: string | null;
}
export interface CompleteAccessory {
  completedAt: string;
  completionReference: string | null;
}
export interface FiscalObligationsDto {
  status: 'READY' | 'EMPTY';
  source: 'PREVIEW' | 'API';
  period: FiscalPeriod;
  obligations: FiscalObligation[];
  updatedAt: string | null;
}

// Valores manuais na prévia; nenhum tributo, alíquota ou vencimento é calculado automaticamente.
export function settledAmount(item: FiscalObligation): number {
  return item.payments.reduce((sum, payment) => sum + payment.amount, 0);
}
export function openAmount(item: FiscalObligation): number {
  if (item.kind !== 'TAX' || item.amount === null) { return 0; }
  return Math.max(0, Math.round((item.amount - settledAmount(item)) * 100) / 100);
}
export function fiscalStatus(item: FiscalObligation, today: string): FiscalDisplayStatus {
  const done = item.kind === 'ACCESSORY'
    ? item.completedAt !== null
    : openAmount(item) < 0.005;
  if (done) { return 'DONE'; }
  if (item.dueDate < today) { return 'OVERDUE'; }
  return item.kind === 'TAX' && settledAmount(item) > 0 ? 'PARTIAL' : 'OPEN';
}
export function daysUntil(date: string, today: string): number {
  // Datas ISO em UTC evitam discrepância por horário de verão.
  return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}
