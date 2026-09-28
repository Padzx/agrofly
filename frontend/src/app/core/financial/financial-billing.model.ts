export type BillingStatus = 'DRAFT' | 'READY' | 'ISSUED' | 'CANCELLED';

export interface BillingPeriod {
  start: string; // YYYY-MM
  end: string;
}

export interface CreateBillingDocument {
  competence: string; // YYYY-MM; não confundir com emissão/recebimento
  customer: string;
  customerTaxId: string | null; // apenas referência de cadastro, sem validação fiscal
  contractRef: string | null;
  serviceOrderRef: string | null;
  serviceDescription: string;
  servicedAt: string; // YYYY-MM-DD
  hectares: number;
  pricePerHectare: number;
  mobilization: number;
  discount: number;
  notes: string | null;
}

export interface BillingDocument extends CreateBillingDocument {
  id: string;
  status: BillingStatus;
  source: 'PREVIEW' | 'API';
  // Preenchidos somente para demonstrar um documento externo já emitido.
  externalInvoiceRef: string | null;
  issuedAt: string | null;
}

export interface BillingSummary {
  drafts: number;
  awaitingIssue: number;
  issued: number;
  cancelled: number;
  awaitingIssueAmount: number | null;
  issuedAmount: number | null;
}

export interface BillingDto {
  status: 'READY' | 'EMPTY';
  source: 'PREVIEW' | 'API';
  period: BillingPeriod;
  documents: BillingDocument[];
  updatedAt: string | null;
}

export interface RecordExternalInvoice {
  externalInvoiceRef: string;
  issuedAt: string;
}

// Somente estimativa comercial; valores fiscais serão fornecidos pelo backend.
export function estimatedBillingTotal(item: CreateBillingDocument): number {
  return Math.round((item.hectares * item.pricePerHectare
    + item.mobilization - item.discount) * 100) / 100;
}
