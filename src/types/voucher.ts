export interface Voucher {
  id: string;
  imageUrl: string;
  imageBlob?: Blob;
  amount: number | null;
  currency: string;
  confidence: number;
  rawText?: string;
  detectedRows?: string[];
  createdAt: number;
  editedManually?: boolean;
}

export interface Batch {
  id: string;
  voucherIds: string[];
  createdAt: number;
}

export interface CurrencyTotal {
  currency: string;
  total: number;
  count: number;
}

export interface GrandTotal {
  totalByCurrency: CurrencyTotal[];
  overallTotal: number | null;
  singleCurrency: boolean;
}
