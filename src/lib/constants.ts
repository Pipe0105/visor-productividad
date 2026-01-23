import { LineMetrics } from "@/types";

export type Sede = { id: string; name: string };

export const BRANCH_LOCATIONS = [
  "Ciudad Jardín",
  "Calle 5ta",
  "La 39",
  "Centro Sur",
  "Floresta",
  "Plaza Norte",
  "Floralia",
  "Guaduales",
  "Palmira",
  "Bogotá",
  "Chia",
  "Planta",
];

export const DEFAULT_SEDES: Sede[] = BRANCH_LOCATIONS.map((sede) => ({
  id: sede,
  name: sede,
}));

export const DEFAULT_LINES: Array<Pick<LineMetrics, "id" | "name">> = [
  { id: "cajas", name: "Cajas" },
  { id: "fruver", name: "Fruver" },
  { id: "industria", name: "Industria" },
  { id: "carnes", name: "Carnes" },
  { id: "pollo y pescado", name: "Pollo y pescado" },
  { id: "asadero", name: "Asadero" },
];
