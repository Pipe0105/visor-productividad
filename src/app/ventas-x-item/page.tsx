"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import * as ExcelJS from "exceljs";
import {
  buildDailyTableAllRange,
  buildNumericPivotRange,
  itemsDisplayList,
  prepareDataframe,
  type DailyTableRow,
  type VentasXItemPreparedRow,
  type VentasXItemRawRow,
} from "@/lib/ventas-x-item";

const EMPRESA_LABELS: Record<string, string> = {
  mercamio: "MERCAMIO",
  mtodo: "MERCATODO",
  bogota: "BOGOTA",
};

const HEATMAP_COLORS = [
  "#f8fafc",
  "#fee2e2",
  "#fecaca",
  "#fca5a5",
  "#f87171",
  "#ef4444",
];

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const parseCsv = (csvText: string): VentasXItemRawRow[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((values) => {
    const out: VentasXItemRawRow = {};
    headers.forEach((header, idx) => {
      out[header] = values[idx] ?? "";
    });
    return out;
  });
};

const firstWordsFromOption = (option: string) => {
  const desc = (option.includes(" - ") ? option.split(" - ", 2)[1] : option)
    .trim()
    .replace(/[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñ/ ]+/g, "");
  if (!desc) return "";
  return desc.split(/\s+/).slice(0, 2).join(" ");
};

const escapeCsv = (value: string | number) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function VentasXItemPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadingDb, setLoadingDb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VentasXItemPreparedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [empresasSel, setEmpresasSel] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [itemLimit, setItemLimit] = useState(10);
  const [itemsSel, setItemsSel] = useState<string[]>([]);
  const [itemsOrder, setItemsOrder] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [itemsDropdownOpen, setItemsDropdownOpen] = useState(false);
  const [layout, setLayout] = useState<"one" | "two">("one");
  const [exportingXlsx, setExportingXlsx] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) return;

        const payload = (await response.json()) as {
          user?: { role?: string; allowedDashboards?: string[] | null };
        };
        const isAdmin = payload.user?.role === "admin";
        if (
          !isAdmin &&
          Array.isArray(payload.user?.allowedDashboards) &&
          !payload.user?.allowedDashboards.includes("ventas-x-item")
        ) {
          router.replace("/tableros");
          return;
        }

        if (isMounted) setReady(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router]);

  const validRows = useMemo(
    () => rows.filter((row) => row.fecha !== null),
    [rows],
  );
  const minDateKey = useMemo(() => {
    if (validRows.length === 0) return "";
    return toDateKey(
      validRows.reduce(
        (min, row) => (row.fecha!.getTime() < min.getTime() ? row.fecha! : min),
        validRows[0].fecha!,
      ),
    );
  }, [validRows]);
  const maxDateKey = useMemo(() => {
    if (validRows.length === 0) return "";
    return toDateKey(
      validRows.reduce(
        (max, row) => (row.fecha!.getTime() > max.getTime() ? row.fecha! : max),
        validRows[0].fecha!,
      ),
    );
  }, [validRows]);

  const empresasDisponibles = useMemo(
    () => Array.from(new Set(rows.map((row) => row.empresa_norm))).sort(),
    [rows],
  );
  const empresasVisibles = empresasSel.length > 0 ? empresasSel : empresasDisponibles;

  const rowsEmpresa = useMemo(
    () => rows.filter((row) => empresasVisibles.includes(row.empresa_norm)),
    [empresasVisibles, rows],
  );

  const rowsEmpresaFecha = useMemo(
    () =>
      rowsEmpresa.filter((row) => {
        if (!row.fecha || !dateStart || !dateEnd) return false;
        const key = toDateKey(row.fecha);
        return key >= dateStart && key <= dateEnd;
      }),
    [dateEnd, dateStart, rowsEmpresa],
  );

  const itemOptions = useMemo(() => {
    const source = rowsEmpresaFecha.length > 0 ? rowsEmpresaFecha : rowsEmpresa;
    return itemsDisplayList(source);
  }, [rowsEmpresa, rowsEmpresaFecha]);
  const filteredItemOptions = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return itemOptions;
    return itemOptions.filter((item) => item.toLowerCase().includes(term));
  }, [itemOptions, itemSearch]);

  useEffect(() => {
    setItemsSel((prev) => prev.filter((item) => itemOptions.includes(item)));
    setItemsOrder((prev) => prev.filter((item) => itemOptions.includes(item)));
  }, [itemOptions]);

  const title = useMemo(() => {
    if (itemsOrder.length === 0) return "Tabla diaria consolidada (unidades)";
    const words = itemsOrder.map(firstWordsFromOption).filter(Boolean);
    return `Tabla diaria consolidada - ${words.join(" | ")} (unidades)`;
  }, [itemsOrder]);

  const rowsFilteredByItems = useMemo(() => {
    if (itemsSel.length === 0) return [];
    const ids = new Set<string>();
    const descNeedles: string[] = [];

    itemsSel.forEach((item) => {
      const raw = String(item);
      if (raw.includes(" - ")) {
        ids.add(raw.split(" - ", 2)[0].trim());
      } else if (/^\d+$/.test(raw.trim())) {
        ids.add(raw.trim());
      } else {
        descNeedles.push(raw.toLowerCase().trim());
      }
    });

    return rowsEmpresaFecha.filter((row) => {
      const byId = ids.size > 0 && ids.has(String(row.id_item));
      const desc = row.descripcion.toLowerCase();
      const byDesc =
        descNeedles.length > 0 && descNeedles.some((needle) => desc.includes(needle));
      return byId || byDesc;
    });
  }, [itemsSel, rowsEmpresaFecha]);

  const tableRows = useMemo<DailyTableRow[]>(() => {
    if (!dateStart || !dateEnd) return [];
    const start = new Date(`${dateStart}T00:00:00Z`);
    const end = new Date(`${dateEnd}T00:00:00Z`);
    return buildDailyTableAllRange(rowsFilteredByItems, start, end);
  }, [dateEnd, dateStart, rowsFilteredByItems]);
  const tableColumns = useMemo(() => {
    if (tableRows.length === 0) return [] as string[];
    return Object.keys(tableRows[0]);
  }, [tableRows]);

  const pivot = useMemo(() => {
    if (!dateStart || !dateEnd) return null;
    const start = new Date(`${dateStart}T00:00:00Z`);
    const end = new Date(`${dateEnd}T00:00:00Z`);
    return buildNumericPivotRange(rowsFilteredByItems, start, end);
  }, [dateEnd, dateStart, rowsFilteredByItems]);

  const lineLabels = useMemo(
    () => (pivot ? pivot.rows.map((row) => toDateKey(row.fecha).slice(5)) : []),
    [pivot],
  );
  const lineData = useMemo(
    () => (pivot ? pivot.rows.map((row) => row.values["T. Dia"] ?? 0) : []),
    [pivot],
  );
  const sedeSeries = useMemo(() => {
    if (!pivot) return [] as Array<{ label: string; data: number[] }>;
    const sedes = pivot.columns.filter((column) => column !== "T. Dia");
    return sedes.map((sede) => ({
      label: sede,
      data: pivot.rows.map((row) => row.values[sede] ?? 0),
    }));
  }, [pivot]);
  const acumuladoSede = useMemo(() => {
    if (!pivot) return [] as Array<{ sede: string; unidades: number }>;
    return pivot.columns
      .filter((column) => column !== "T. Dia")
      .map((sede) => ({
        sede,
        unidades: pivot.rows.reduce((sum, row) => sum + (row.values[sede] ?? 0), 0),
      }))
      .sort((a, b) => b.unidades - a.unidades);
  }, [pivot]);
  const heatMax = useMemo(
    () => Math.max(1, ...sedeSeries.flatMap((series) => series.data)),
    [sedeSeries],
  );

  const toggleItem = (item: string) => {
    setItemsSel((prev) => {
      const exists = prev.includes(item);
      if (exists) return prev.filter((v) => v !== item);
      if (prev.length >= itemLimit) return prev;
      return [...prev, item];
    });
    setItemsOrder((prev) => {
      if (prev.includes(item)) return prev.filter((v) => v !== item);
      if (itemsSel.length >= itemLimit) return prev;
      return [...prev, item];
    });
  };

  const onUpload = async (file: File) => {
    setError(null);
    setLoadingFile(true);
    try {
      const text = await file.text();
      const rawRows = parseCsv(text);
      const prepared = prepareDataframe(rawRows);
      const withDate = prepared.filter((row) => row.fecha !== null);
      if (withDate.length === 0) throw new Error("No hay fechas válidas en el archivo.");
      const min = withDate.reduce(
        (acc, row) => (row.fecha!.getTime() < acc.getTime() ? row.fecha! : acc),
        withDate[0].fecha!,
      );
      const max = withDate.reduce(
        (acc, row) => (row.fecha!.getTime() > acc.getTime() ? row.fecha! : acc),
        withDate[0].fecha!,
      );
      const empresas = Array.from(new Set(prepared.map((row) => row.empresa_norm))).sort();
      setRows(prepared);
      setFileName(file.name);
      setEmpresasSel(empresas);
      setDateStart(toDateKey(min));
      setDateEnd(toDateKey(max));
      setItemsSel([]);
      setItemsOrder([]);
      setItemSearch("");
      setItemsDropdownOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFile(false);
    }
  };

  const onLoadFromDb = async () => {
    setError(null);
    setLoadingDb(true);
    try {
      const response = await fetch("/api/ventas-x-item", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        rows?: VentasXItemRawRow[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo cargar datos desde base de datos.");
      }
      const prepared = prepareDataframe(payload.rows ?? []);
      const withDate = prepared.filter((row) => row.fecha !== null);
      if (withDate.length === 0) throw new Error("La base de datos no tiene fechas válidas.");
      const min = withDate.reduce(
        (acc, row) => (row.fecha!.getTime() < acc.getTime() ? row.fecha! : acc),
        withDate[0].fecha!,
      );
      const max = withDate.reduce(
        (acc, row) => (row.fecha!.getTime() > acc.getTime() ? row.fecha! : acc),
        withDate[0].fecha!,
      );
      const empresas = Array.from(new Set(prepared.map((row) => row.empresa_norm))).sort();
      setRows(prepared);
      setFileName("DB: ventas_item_diario");
      setEmpresasSel(empresas);
      setDateStart(toDateKey(min));
      setDateEnd(toDateKey(max));
      setItemsSel([]);
      setItemsOrder([]);
      setItemSearch("");
      setItemsDropdownOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDb(false);
    }
  };

  const handleDownloadCsv = () => {
    if (tableRows.length === 0 || tableColumns.length === 0) return;
    const lines = [
      tableColumns.map((col) => escapeCsv(col)).join(","),
      ...tableRows.map((row) =>
        tableColumns.map((col) => escapeCsv(row[col] as string | number)).join(","),
      ),
    ];
    const content = "\ufeff" + lines.join("\n");
    downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8;" }), "ventas-x-item.csv");
  };

  const handleDownloadXlsx = async () => {
    if (tableRows.length === 0 || tableColumns.length === 0) return;
    setExportingXlsx(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Tabla Consolidada");
      sheet.views = [{ showGridLines: false }];

      const START_ROW = 6;
      const START_COL = 7; // Columna G
      const totalCols = tableColumns.length;
      const headerRow = START_ROW;
      const dataStartRow = START_ROW + 1;
      const totalRowNumber = dataStartRow + tableRows.length - 1;
      const lastCol = START_COL + totalCols - 1;
      const monthYear = new Intl.DateTimeFormat("es-CO", {
        month: "long",
        year: "numeric",
      })
        .format(new Date())
        .toUpperCase();
      const titleBase = title
        .replace("Tabla diaria consolidada - ", "")
        .replace("(unidades)", "")
        .trim()
        .toUpperCase();
      const titleText = `${monthYear}  VTA POR DIA Y ACUMULADA DE ${titleBase}`;

      sheet.mergeCells(headerRow - 2, START_COL, headerRow - 2, lastCol);
      const titleCell = sheet.getCell(headerRow - 2, START_COL);
      titleCell.value = titleText;
      titleCell.font = { bold: true, color: { argb: "FFFF0000" }, size: 12 };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      tableColumns.forEach((column, index) => {
        const cell = sheet.getCell(headerRow, START_COL + index);
        cell.value = column;
        cell.font = { bold: true };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      const tDiaIdx = tableColumns.findIndex((col) => col === "T. Dia");
      for (let rowIndex = 0; rowIndex < tableRows.length; rowIndex += 1) {
        const row = tableRows[rowIndex];
        const excelRow = dataStartRow + rowIndex;
        const isTotal = rowIndex === tableRows.length - 1;
        const isSunday =
          !isTotal &&
          typeof row["Fecha"] === "string" &&
          row["Fecha"].includes("/dom");

        tableColumns.forEach((column, columnIndex) => {
          const cell = sheet.getCell(excelRow, START_COL + columnIndex);
          const value = row[column];
          const isFechaCol = columnIndex === 0;
          const isTDiaCol = tDiaIdx >= 0 && columnIndex === tDiaIdx;
          const isNumber = typeof value === "number";

          if (isNumber) {
            cell.value = value;
            cell.numFmt = "#,##0.##";
          } else {
            cell.value = String(value ?? "");
          }

          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
          cell.alignment = { horizontal: "center", vertical: "middle" };

          if (isTotal) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFE6F2FF" },
            };
            cell.font = { bold: true };
            return;
          }

          if (isSunday) {
            cell.font = { bold: true, color: { argb: "FFFF0000" } };
          } else if (isTDiaCol) {
            cell.font = { bold: true };
          } else if (isFechaCol) {
            cell.font = {};
          }
        });
      }

      tableColumns.forEach((column, index) => {
        const values = tableRows.map((row) => String(row[column] ?? ""));
        const maxLen = values.reduce(
          (max, val) => (val.length > max ? val.length : max),
          column.length,
        );
        const colWidth = Math.min(40, Math.max(10, maxLen + 2));
        sheet.getColumn(START_COL + index).width = colWidth;
      });

      sheet.getRow(headerRow - 2).height = 20;
      sheet.getRow(headerRow).height = 18;
      for (let row = dataStartRow; row <= totalRowNumber; row += 1) {
        sheet.getRow(row).height = 17;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "ventas-x-item.xlsx",
      );
    } finally {
      setExportingXlsx(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10 text-foreground">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.15)]">
          <p className="text-sm text-slate-600">Cargando tablero...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12 text-foreground">
      <div className="mx-auto w-full max-w-7xl rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_28px_70px_-45px_rgba(15,23,42,0.4)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
              Ventas X item
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Ventas por ítem(s) x sedes</h1>
          </div>
          <Link
            href="/tableros"
            className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-200/70"
          >
            Volver a tableros
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <label className="text-sm font-semibold text-slate-800">
            Cargar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void onUpload(file);
              }}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void onLoadFromDb()}
              disabled={loadingDb}
              className="inline-flex items-center rounded-full border border-emerald-300/80 bg-emerald-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800 transition-all hover:border-emerald-400 hover:bg-emerald-200/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingDb ? "Cargando BD..." : "Cargar desde BD"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {loadingFile
              ? "Procesando archivo..."
              : fileName
                ? `Archivo cargado: ${fileName}`
                : "Sube un archivo CSV para comenzar."}
          </p>
          {error && (
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 md:grid-cols-4">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Fecha inicio
                <input
                  type="date"
                  value={dateStart}
                  min={minDateKey}
                  max={maxDateKey}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Fecha fin
                <input
                  type="date"
                  value={dateEnd}
                  min={minDateKey}
                  max={maxDateKey}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Límite de ítems
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={itemLimit}
                  onChange={(e) => setItemLimit(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Descargas
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    disabled={tableRows.length === 0}
                    className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadXlsx()}
                    disabled={tableRows.length === 0 || exportingXlsx}
                    className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {exportingXlsx ? "Generando..." : "XLSX"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Empresas
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {empresasDisponibles.map((empresa) => {
                    const checked = empresasSel.includes(empresa);
                    return (
                      <button
                        key={empresa}
                        type="button"
                        onClick={() =>
                          setEmpresasSel((prev) =>
                            checked
                              ? prev.filter((v) => v !== empresa)
                              : [...prev, empresa],
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          checked
                            ? "border-blue-300 bg-blue-100 text-blue-800"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {EMPRESA_LABELS[empresa] ?? empresa.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Ítems ({itemsSel.length}/{itemLimit})
                </p>
                <div className="relative mt-2">
                  <button
                    type="button"
                    onClick={() => setItemsDropdownOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-800"
                  >
                    <span className="truncate">
                      {itemsSel.length === 0
                        ? "Selecciona items..."
                        : `${itemsSel.length} item(s) seleccionado(s)`}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {itemsDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {itemsDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 shadow-lg">
                      <input
                        type="text"
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        placeholder="Buscar por ID o descripcion..."
                        className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800"
                      />
                      <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{filteredItemOptions.length} resultados</span>
                        <button
                          type="button"
                          onClick={() => {
                            setItemsSel([]);
                            setItemsOrder([]);
                          }}
                          className="font-semibold text-blue-700"
                        >
                          Limpiar
                        </button>
                      </div>
                      <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 p-1">
                        {filteredItemOptions.map((item) => {
                          const checked = itemsSel.includes(item);
                          const disabled = !checked && itemsSel.length >= itemLimit;
                          return (
                            <label
                              key={item}
                              className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs ${
                                disabled ? "opacity-50" : "hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => toggleItem(item)}
                                className="mt-0.5"
                              />
                              <span className="leading-4 text-slate-700">{item}</span>
                            </label>
                          );
                        })}
                        {filteredItemOptions.length === 0 && (
                          <p className="px-2 py-2 text-xs text-slate-500">
                            Sin resultados para esa busqueda.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4">
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              {tableRows.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Selecciona al menos un ítem y un rango válido para ver resultados.
                </p>
              ) : (
                <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-xs text-slate-700">
                    <thead className="bg-slate-100">
                      <tr>
                        {tableColumns.map((column) => (
                          <th key={column} className="border-b border-slate-200 px-2 py-2 text-left font-bold">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, index) => {
                        const isTotal = index === tableRows.length - 1;
                        const isSunday =
                          typeof row["Fecha"] === "string" &&
                          row["Fecha"].includes("/dom") &&
                          !isTotal;
                        return (
                          <tr
                            key={`${String(row["Fecha"])}-${index}`}
                            className={isTotal ? "bg-blue-50 font-bold" : ""}
                          >
                            {tableColumns.map((column) => {
                              const value = row[column];
                              const tDia = column === "T. Dia";
                              return (
                                <td
                                  key={column}
                                  className={`border-b border-slate-100 px-2 py-1.5 ${
                                    isSunday ? "font-bold text-red-600" : ""
                                  } ${tDia ? "font-bold" : ""}`}
                                >
                                  {String(value)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {pivot && (
              <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">Gráficas</h3>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setLayout("one")}
                      className={`rounded-full border px-3 py-1 ${layout === "one" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                    >
                      Una columna
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayout("two")}
                      className={`rounded-full border px-3 py-1 ${layout === "two" ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}
                    >
                      Dos columnas
                    </button>
                  </div>
                </div>

                <div className={layout === "two" ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Total por día (T. Dia)</p>
                    <LineChart
                      xAxis={[{ data: lineLabels, scaleType: "point" }]}
                      series={[{ data: lineData, label: "T. Dia" }]}
                      height={280}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Unidades por sede por día (apilado)</p>
                    <BarChart
                      xAxis={[{ data: lineLabels, scaleType: "band" }]}
                      series={sedeSeries.map((serie) => ({
                        data: serie.data,
                        label: serie.label,
                        stack: "total",
                      }))}
                      height={320}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Mapa de calor</p>
                    <div className="overflow-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr>
                            <th className="px-2 py-1 text-left">Sede</th>
                            {lineLabels.map((label) => (
                              <th key={label} className="px-1 py-1 text-center">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sedeSeries.map((serie) => (
                            <tr key={serie.label}>
                              <td className="whitespace-nowrap px-2 py-1 font-semibold text-slate-700">
                                {serie.label}
                              </td>
                              {serie.data.map((value, idx) => {
                                const bucket = Math.min(
                                  HEATMAP_COLORS.length - 1,
                                  Math.floor((value / heatMax) * (HEATMAP_COLORS.length - 1)),
                                );
                                return (
                                  <td
                                    key={`${serie.label}-${idx}`}
                                    className="px-1 py-1 text-center text-[10px]"
                                    style={{ backgroundColor: HEATMAP_COLORS[bucket] }}
                                    title={`${serie.label} ${lineLabels[idx]}: ${value}`}
                                  >
                                    {value === 0 ? "-" : value.toFixed(1)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Acumulado del rango por sede</p>
                    <BarChart
                      xAxis={[{ data: acumuladoSede.map((v) => v.sede), scaleType: "band" }]}
                      series={[{ data: acumuladoSede.map((v) => v.unidades), label: "Unidades" }]}
                      height={280}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
