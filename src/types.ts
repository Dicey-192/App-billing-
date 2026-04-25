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
  isPaid: boolean;
  expenses: ExpenseItem[];
  moveInDate?: string;
  updatedAt: number;
}

export interface BillHistoryEntry {
  id: string;
  propertyId: string;
  month: string; // YYYY-MM
  snapshot: {
    property: Property;
    tenants: Tenant[];
  };
  createdAt: number;
}

export interface AppData {
  properties: Property[];
  tenants: Tenant[];
  history: BillHistoryEntry[];
  activeMonth?: string;
}
