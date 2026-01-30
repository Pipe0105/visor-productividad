"use client";

import { useState, useCallback } from "react";
import { GripVertical } from "lucide-react";
import {
  formatCOP,
  formatHours,
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

type LineWithMetrics = LineMetrics;

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

const TableHeader = () => (
  <thead>
    <tr className="text-[10px] uppercase tracking-widest text-slate-700 sm:text-xs sm:tracking-[0.2em]">
      <th className="w-6 px-1 py-1.5 sm:w-8 sm:px-2 sm:py-2"></th>
      <th className="sticky left-0 bg-white px-2 py-1.5 text-left font-semibold sm:px-4 sm:py-2">Línea</th>
      <th className="px-2 py-1.5 text-left font-semibold sm:px-4 sm:py-2">Ventas</th>
      <th className="px-2 py-1.5 text-left font-semibold sm:px-4 sm:py-2">Vta/Hr</th>
      <th className="px-2 py-1.5 text-left font-semibold sm:px-4 sm:py-2">Horas</th>
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
  const zeroHours = "0h";
  const displayHours = hasLaborDataForLine(line.id) ? line.hours : 0;
  const salesPerHour = hasLaborDataForLine(line.id) && line.hours > 0
    ? line.sales / 1_000_000 / line.hours
    : 0;

  return (
    <tr
      data-animate="comparison-row"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-xl transition-all cursor-grab active:cursor-grabbing sm:rounded-2xl ${
        isDragging
          ? "opacity-50 bg-mercamio-100"
          : isDragOver
            ? "bg-mercamio-50 ring-2 ring-mercamio-300"
            : "bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <td className="rounded-l-xl px-1 py-2 text-slate-700 sm:rounded-l-2xl sm:px-2 sm:py-3">
        <GripVertical className="h-3 w-3 sm:h-4 sm:w-4" />
      </td>
      <td className="sticky left-0 bg-inherit px-2 py-2 sm:px-4 sm:py-3">
        <p className="text-xs font-semibold text-slate-900 sm:text-sm">{line.name}</p>
        <p className="hidden text-xs text-slate-700 sm:block">{line.id}</p>
      </td>
      <td className="px-2 py-2 text-xs font-semibold text-slate-900 sm:px-4 sm:py-3 sm:text-sm">
        {hasData ? formatCOP(line.sales) : "—"}
      </td>
      <td className="px-2 py-2 text-xs font-semibold text-slate-900 sm:px-4 sm:py-3 sm:text-sm">
        {hasData ? salesPerHour.toFixed(3) : "—"}
      </td>
      <td className="px-2 py-2 text-xs text-slate-700 sm:px-4 sm:py-3 sm:text-sm">
        {hasData ? `${formatHours(displayHours)}h` : zeroHours}
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
  <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
    <div>
      <p className="text-xs uppercase tracking-[0.15em] text-slate-800 sm:text-sm sm:tracking-[0.2em]">
        Comparativo de líneas
      </p>
      <h3 className="text-lg font-semibold text-slate-900 sm:text-2xl">
        Ventas en comparación
      </h3>
      <p className="mt-1 text-xs text-slate-700 sm:mt-2 sm:text-sm">
        {isCustomOrder
          ? "Orden personalizado."
          : "Ordenado por ventas."}
        <span className="hidden sm:inline"> Arrastra las filas para comparar.</span>
      </p>
    </div>
    <div className="flex items-center gap-1.5 sm:gap-2">
      {isCustomOrder && (
        <button
          type="button"
          onClick={onResetOrder}
          className="rounded-full border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-100 sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.2em]"
        >
          Restaurar
        </button>
      )}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-700 sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.2em]">
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
  return { ...line };
};

const sortLinesBySales = (lines: LineWithMetrics[]): LineWithMetrics[] => {
  return [...lines].sort((a, b) => b.sales - a.sales);
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

  // Ordenar por ventas (orden por defecto)
  const defaultSortedLines = sortLinesBySales(enrichedLines);

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
      className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)] transition-all hover:shadow-[0_20px_70px_-35px_rgba(15,23,42,0.2)] sm:rounded-3xl sm:p-6"
    >
      <TableSummary
        count={sortedLines.length}
        isCustomOrder={customOrder !== null}
        onResetOrder={handleResetOrder}
      />

      {sortedLines.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="-mx-1 mt-3 overflow-x-auto sm:mx-0 sm:mt-6">
          <table className="w-full min-w-100 border-separate border-spacing-y-1 text-left text-xs sm:min-w-175 sm:border-spacing-y-2 sm:text-sm">
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

