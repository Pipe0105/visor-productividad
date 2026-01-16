interface SparklineProps {
  data: number[];
  className?: string;
  strokeClassName?: string;
}

export const Sparkline = ({
  data,
  className = "",
  strokeClassName = "stroke-mercamio-200",
}: SparklineProps) => {
  if (data.length < 2) {
    return (
      <div
        className={`flex h-10 items-center justify-center rounded-xl border border-dashed border-slate-200/70 bg-slate-50 text-xs text-slate-700 ${className}`}
      >
        Sin historial
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 40;
  const width = 140;
  const padding = 6;
  const points = data
    .map((value, index) => {
      const x =
        padding + (index / (data.length - 1 || 1)) * (width - padding * 2);
      const y =
        height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className={`h-10 w-full ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Sparkline"
    >
      <polyline
        points={points}
        fill="none"
        className={`${strokeClassName} stroke-[2.2]`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
