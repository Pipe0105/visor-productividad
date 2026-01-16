import { Linekey } from "@/types";

type Thresholds = {
  excellent: number;
  normal: number;
  attention: number;
};

type StatusConfig = {
  summary: Thresholds;
  line: Thresholds;
  lineOverrides?: Partial<Record<Linekey, Thresholds>>;
};

const defaultConfig: StatusConfig = {
  summary: {
    excellent: 1200000,
    normal: 0,
    attention: -400000,
  },
  line: {
    excellent: 500000,
    normal: 0,
    attention: -200000,
  },
};

const statusConfigBySede: Record<string, StatusConfig> = {
  floresta: {
    summary: {
      excellent: 1200000,
      normal: 0,
      attention: -400000,
    },
    line: {
      excellent: 500000,
      normal: 0,
      attention: -200000,
    },
  },
};

const summaryLabels = {
  excellent: "Día sólido",
  normal: "Día estable",
  attention: "Revisar",
  problem: "Crítico",
};

const lineLabels = {
  excellent: "Excelente",
  normal: "Normal",
  attention: "Atención",
  problem: "Problema",
};

const statusClasses = {
  excellent:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  normal:
    "bg-slate-200 text-slate-600 dark:bg-slate-400/15 dark:text-slate-200",
  attention:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  problem: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
};

export const getSummaryStatus = (sede: string, margin: number) => {
  const thresholds = statusConfigBySede[sede]?.summary ?? defaultConfig.summary;
  return resolveStatus(margin, thresholds, summaryLabels);
};

export const getLineStatus = (
  sede: string,
  lineId: Linekey,
  margin: number
) => {
  const sedeConfig = statusConfigBySede[sede] ?? defaultConfig;
  const thresholds = sedeConfig.lineOverrides?.[lineId] ?? sedeConfig.line;
  return resolveStatus(margin, thresholds, lineLabels);
};

const resolveStatus = (
  margin: number,
  thresholds: Thresholds,
  labels: typeof summaryLabels
) => {
  if (margin >= thresholds.excellent) {
    return {
      label: labels.excellent,
      className: statusClasses.excellent,
      textClass: "text-emerald-600 dark:text-emerald-200",
    };
  }
  if (margin >= thresholds.normal) {
    return {
      label: labels.normal,
      className: statusClasses.normal,
      textClass: "text-slate-600 dark:text-slate-200",
    };
  }
  if (margin >= thresholds.attention) {
    return {
      label: labels.attention,
      className: statusClasses.attention,
      textClass: "text-amber-600 dark:text-amber-200",
    };
  }
  return {
    label: labels.problem,
    className: statusClasses.problem,
    textClass: "text-rose-600 dark:text-rose-200",
  };
};
