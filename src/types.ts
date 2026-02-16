export type Linekey =
  | "cajas"
  | "fruver"
  | "carnes"
  | "industria"
  | "pollo y pescado"
  | "asadero"
  | (string & {});

export interface LineMetrics {
  id: Linekey;
  name: string;
  sales: number;
  hours: number;
  hourlyRate: number;
}

export interface DailyProductivity {
  date: string;
  sede: string;
  lines: LineMetrics[];
}

export interface HourlyLineSales {
  lineId: Linekey;
  lineName: string;
  sales: number;
}

export interface HourSlot {
  hour: number;
  slotStartMinute: number;
  slotEndMinute: number;
  label: string;
  totalSales: number;
  employeesPresent: number;
  employeesByLine?: Record<string, number>;
  lines: HourlyLineSales[];
}

export interface HourlyAnalysisData {
  date: string;
  scopeLabel: string;
  attendanceDateUsed?: string | null;
  salesDateUsed?: string | null;
  bucketMinutes?: number;
  hours: HourSlot[];
}
