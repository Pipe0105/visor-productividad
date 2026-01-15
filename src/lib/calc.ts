import { DailySummary, LineMetrics } from "@/types";

export const formatCOP = (value: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
};

export const calcLineCost = (line: LineMetrics) => line.hours * line.hourlyRate;

export const calcLineMargin = (line: LineMetrics) =>
  line.sales - calcLineCost(line);

export const calcDailySummary = (lines: LineMetrics[]): DailySummary => {
  return lines.reduce(
    (acc, line) => {
      const cost = calcLineCost(line);
      return {
        sales: acc.sales + line.sales,
        hours: acc.hours + line.hours,
        cost: acc.cost + cost,
        margin: acc.margin + (line.sales - cost),
      };
    },
    {
      sales: 0,
      hours: 0,
      cost: 0,
      margin: 0,
    }
  );
};
