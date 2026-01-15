export type Linekey =
  | "cajas"
  | "fruver"
  | "industria"
  | "carnes"
  | "pollo y pescado"
  | "asadero";

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

export interface DailySummary {
  sales: number;
  hours: number;
  cost: number;
  margin: number;
}
