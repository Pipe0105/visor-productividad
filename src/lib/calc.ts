import { LineMetrics } from "../types";

// Líneas que NO tienen datos de horas en asistencia_horas
// Todas las líneas principales ahora tienen datos de horas
const linesWithoutLaborData = new Set<string>([]);

export const hasLaborDataForLine = (lineId: string) =>
  !linesWithoutLaborData.has(lineId);

export const formatCOP = (value: number) => {
  const inThousands = Math.round(value / 1000);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(inThousands);
};

export const formatHours = (value: number) => {
  return value.toFixed(2);
};

export const formatPercent = (value: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
};

export const calcLineCost = (line: LineMetrics) => {
  if (!hasLaborDataForLine(line.id)) {
    return 0;
  }
  return line.hours * line.hourlyRate;
};

export const calcLineMargin = (line: LineMetrics) => {
  if (!hasLaborDataForLine(line.id)) {
    return 0;
  }
  return line.sales - calcLineCost(line);
};

