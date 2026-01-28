"use client";

import { useState, useCallback } from "react";
import { GripVertical } from "lucide-react";
import {
  calcLineCost,
  calcLineMargin,
  formatCOP,
  formatHours,
  formatPercent,
  hasLaborDataForLine,
} from "@/lib/calc";
import { LineMetrics } from "@/types";

interface LineComparisonTableProps {
  lines: LineMetrics[];
  hasData?: boolean;
}

// ============================================================================
// TIPOS
// ============================================================================

type LineWithMetrics = LineMetrics & {
  cost: number;
  margin: number;
  marginRatio: number;
  marginPerHour: number;
};

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

const TableHeader = () => (
  <thead>
    <tr className="text-xs uppercase tracking-[0.2em] text-slate-700">
      <th className="w-8 px-2 py-2"></th>
      <th className="px-4 py-2 text-left font-semibold">Línea</th>
      <th className="px-4 py-2 text-left font-semibold">Ventas</th>
      <th className="px-4 py-2 text-left font-semibold">Horas</th>
      <th className="px-4 py-2 text-left font-semibold">Costo</th>
      <th className="px-4 py-2 text-left font-semibold">Margen</th>
      <th className="px-4 py-2 text-left font-semibold">Margen %</th>
      <th className="px-4 py-2 text-left font-semibold">Margen/h</th>
    </tr>
  </thead>
);

const TableRow = ({
  line,
  hasData,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  line: LineWithMetrics;
  hasData: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) => {
  const zeroCurrency = formatCOP(0);
  const zeroHours = "0h";
  const zeroPercent = formatPercent(0);
  const displayHours = hasLaborDataForLine(line.id) ? line.hours : 0;

  return (
    <tr
      data-animate="comparison-row"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-2xl transition-all cursor-grab active:cursor-grabbing ${
        isDragging
          ? "opacity-50 bg-mercamio-100"
          : isDragOver
            ? "bg-mercamio-50 ring-2 ring-mercamio-300"
            : "bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <td className="rounded-l-2xl px-2 py-3 text-slate-700">
        <GripVertical className="h-4 w-4" />
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-900">{line.name}</p>
        <p className="text-xs text-slate-700">{line.id}</p>
      </td>
      <td className="px-4 py-3 font-semibold text-slate-900">
        {hasData ? formatCOP(line.sales) : "—"}
      </td>
      <td className="px-4 py-3 text-slate-700">
        {hasData ? `${formatHours(displayHours)}h` : zeroHours}
      </td>
      <td className="px-4 py-3 text-slate-700">
        {hasData ? formatCOP(line.cost) : zeroCurrency}
      </td>
      <td
        className={`px-4 py-3 font-semibold ${
          hasData && line.margin >= 0 ? "text-green-600" : hasData && line.margin < 0 ? "text-red-600" : "text-slate-900"
        }`}
      >
        {hasData ? formatCOP(line.margin) : zeroCurrency}
      </td>
      <td
        className={`px-4 py-3 font-semibold ${
          hasData && line.marginRatio >= 0 ? "text-green-600" : hasData && line.marginRatio < 0 ? "text-red-600" : "text-slate-900"
        }`}
      >
        {hasData ? formatPercent(line.marginRatio) : zeroPercent}
      </td>
      <td className="rounded-r-2xl px-4 py-3 font-semibold text-slate-900">
        {hasData ? formatCOP(line.marginPerHour) : zeroCurrency}
      </td>
    </tr>
  );
};

const TableSummary = ({
  count,
  isCustomOrder,
  onResetOrder,
}: {
  count: number;
  isCustomOrder: boolean;
  onResetOrder: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <p className="text-sm uppercase tracking-[0.2em] text-slate-800">
        Comparativo de líneas
      </p>
      <h3 className="text-2xl font-semibold text-slate-900">
        Rentabilidad en comparación
      </h3>
      <p className="mt-2 text-sm text-slate-700">
        {isCustomOrder
          ? "Orden personalizado. Arrastra las filas para comparar."
          : "Ordenado por margen. Arrastra las filas para comparar."}
      </p>
    </div>
    <div className="flex items-center gap-2">
      {isCustomOrder && (
        <button
          type="button"
          onClick={onResetOrder}
          className="rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100"
        >
          Restaurar orden
        </button>
      )}
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
        {count} {count === 1 ? "línea" : "líneas"}
      </span>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="py-12 text-center">
    <p className="text-sm uppercase tracking-[0.2em] text-slate-700">
      Sin datos
    </p>
    <p className="mt-2 text-slate-700">No hay líneas para comparar</p>
  </div>
);

// ============================================================================
// UTILIDADES
// ============================================================================

const enrichLineWithMetrics = (line: LineMetrics): LineWithMetrics => {
  const cost = calcLineCost(line);
  const margin = calcLineMargin(line);
  const marginRatio = line.sales ? margin / line.sales : 0;
  const marginPerHour = line.hours ? margin / line.hours : 0;

  return {
    ...line,
    cost,
    margin,
    marginRatio,
    marginPerHour,
  };
};

const sortLinesByMargin = (lines: LineWithMetrics[]): LineWithMetrics[] => {
  return [...lines].sort((a, b) => b.margin - a.margin);
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const LineComparisonTable = ({
  lines,
  hasData = true,
}: LineComparisonTableProps) => {
  // Estado para drag and drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);

  // Enriquecer líneas con métricas calculadas
  const enrichedLines = lines.map((line) => enrichLineWithMetrics(line));

  // Ordenar por margen (orden por defecto)
  const defaultSortedLines = sortLinesByMargin(enrichedLines);

  // Aplicar orden personalizado si existe
  const sortedLines = customOrder
    ? customOrder
        .map((id) => defaultSortedLines.find((line) => line.id === id))
        .filter((line): line is LineWithMetrics => line !== undefined)
    : defaultSortedLines;

  // Handlers de drag and drop
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (draggedIndex === null || draggedIndex === targetIndex) return;

      const currentOrder = customOrder || sortedLines.map((line) => line.id);
      const newOrder = [...currentOrder];
      const [draggedItem] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);

      setCustomOrder(newOrder);
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, customOrder, sortedLines],
  );

  const handleResetOrder = useCallback(() => {
    setCustomOrder(null);
  }, []);

  return (
    <section
      data-animate="comparison-card"
      className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] transition-all hover:shadow-[0_20px_70px_-35px_rgba(15,23,42,0.2)]"
    >
      <TableSummary
        count={sortedLines.length}
        isCustomOrder={customOrder !== null}
        onResetOrder={handleResetOrder}
      />

      {sortedLines.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-180 border-separate border-spacing-y-2 text-left text-sm">
            <TableHeader />
            <tbody>
              {sortedLines.map((line, index) => (
                <TableRow
                  key={line.id}
                  line={line}
                  hasData={hasData}
                  isDragging={draggedIndex === index}
                  isDragOver={dragOverIndex === index}
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(index)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

