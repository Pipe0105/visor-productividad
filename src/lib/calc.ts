import { DailySummary, LineMetrics } from "@/types";

const linesWithoutLaborData = new Set([
  "cajas",
  "fruver",
  "carnes",
  "industria",
  "pollo y pescado",
  "asadero",
]);

export const hasLaborDataForLine = (lineId: string) =>
  !linesWithoutLaborData.has(lineId);

export const formatCOP = (value: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
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

export const calcDailySummary = (lines: LineMetrics[]): DailySummary => {
  return lines.reduce(
    (acc, line) => {
      const hasLaborData = hasLaborDataForLine(line.id);
      const cost = hasLaborData ? calcLineCost(line) : 0;
      const margin = hasLaborData ? calcLineMargin(line) : 0;
      const hours = hasLaborData ? line.hours : 0;
      return {
        sales: acc.sales + line.sales,
        hours: acc.hours + hours,
        cost: acc.cost + cost,
        margin: acc.margin + margin,
      };
    },
    {
      sales: 0,
      hours: 0,
      cost: 0,
      margin: 0,
    },
  );
};
