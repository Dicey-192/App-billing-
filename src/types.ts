export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  electricRate: number;
  waterRate: number;
  qrCodeDataUrl?: string; // For uploaded QR image
  createdAt: number;
  updatedAt: number;
  defaultExpenses: ExpenseItem[];
}

export interface Tenant {
  id: string;
  propertyId: string;
  name: string;
  roomNumber: string;
  rent: number;
  previousDues: number;
  prevElecReading: number;
  currElecReading: number;
  prevWaterReading: number;
  currWaterReading: number;
  whatsappNumber?: string;
  isPaid: boolean;
  paidAmount?: number;
  payments?: PaymentRecord[];
  expenses: ExpenseItem[];
  moveInDate?: string;
  updatedAt: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: number;
  note?: string;
}

export interface HistoryTenantSnapshot extends Tenant {
}

export interface BillHistoryEntry {
  id: string;
  propertyId: string;
  month: string; // "Month Year" e.g. "May 2026"
  snapshot: {
    property: Property;
    tenants: HistoryTenantSnapshot[];
  };
  createdAt: number;
}

export interface AppData {
  properties: Property[];
  tenants: Tenant[];
  history: BillHistoryEntry[];
  activeMonth?: string;
  dismissedMonth?: string;
  lastBackupAt?: number;
}
