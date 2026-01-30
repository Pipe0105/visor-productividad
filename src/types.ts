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
