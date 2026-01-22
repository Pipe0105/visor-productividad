import { DailyProductivity } from "@/types";

export const sedes = [
  {
    id: "floresta",
    name: "Floresta",
  },
];

export const mockDailyData: DailyProductivity[] = [
  {
    date: "2024-06-18",
    sede: "floresta",
    lines: [
      {
        id: "cajas",
        name: "Cajas",
        sales: 4820000,
        hours: 0,
        hourlyRate: 0,
      },
      {
        id: "fruver",
        name: "Fruver",
        sales: 3125000,
        hours: 0,
        hourlyRate: 0,
      },
    ],
  },
  {
    date: "2024-06-19",
    sede: "floresta",
    lines: [
      {
        id: "cajas",
        name: "Cajas",
        sales: 4580000,
        hours: 0,
        hourlyRate: 0,
      },
      {
        id: "fruver",
        name: "Fruver",
        sales: 2680000,
        hours: 0,
        hourlyRate: 0,
      },
    ],
  },
  {
    date: "2024-06-20",
    sede: "floresta",
    lines: [
      {
        id: "cajas",
        name: "Cajas",
        sales: 5010000,
        hours: 0,
        hourlyRate: 0,
      },
      {
        id: "fruver",
        name: "Fruver",
        sales: 3350000,
        hours: 0,
        hourlyRate: 0,
      },
    ],
  },
];
