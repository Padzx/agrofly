export type AccountDirection = 'RECEIVABLE' | 'PAYABLE';
export type AccountCategory =
  | 'SERVICE' | 'FUEL' | 'CREW' | 'MAINTENANCE'
  | 'SUPPLIER' | 'TAX' | 'ADMIN' | 'OTHER';
export type SettlementMethod =
  | 'PIX' | 'TRANSFER' | 'BOLETO' | 'CARD' | 'CASH' | 'OTHER';

export interface AccountSettlement {
  id: string;
  date: string; // YYYY-MM-DD: data efetiva da baixa
  amount: number; // BRL, positivo
  method: SettlementMethod;
}

export interface CreateFinancialAccount {
  direction: AccountDirection;
  description: string;
  counterparty: string;
  category: AccountCategory;
  competence: string; // YYYY-MM; distinta do vencimento
  issueDate: string;
  dueDate: string;
  amount: number;
  contractRef: string | null;
}

export interface FinancialAccount extends CreateFinancialAccount {
  id: string;
  source: 'PREVIEW' | 'API';
  settlements: AccountSettlement[];
}

export interface AccountsQuery {
  start: string; // mês inicial YYYY-MM
  end: string;   // mês final YYYY-MM
}

export interface FinancialAccountsDto {
  status: 'READY' | 'EMPTY';
  source: 'PREVIEW' | 'API';
  period: AccountsQuery;
  accounts: FinancialAccount[];
  updatedAt: string | null;
}

export interface CreateSettlement {
  date: string;
  amount: number;
  method: SettlementMethod;
}
