import { useMemo } from "react";
import Chart from "react-apexcharts";

const CAMELOT_ORDER = [
  "1A",
  "2A",
  "3A",
  "4A",
  "5A",
  "6A",
  "7A",
  "8A",
  "9A",
  "10A",
  "11A",
  "12A",
  "1B",
  "2B",
  "3B",
  "4B",
  "5B",
  "6B",
  "7B",
  "8B",
  "9B",
  "10B",
  "11B",
  "12B",
];

function toSeriesPoints(rows = []) {
  const counts = new Map(CAMELOT_ORDER.map((k) => [k, 0]));
  for (const r of rows) {
    const k = r.camelot_key ?? r.camelotKey ?? r.camelot;
    if (k && counts.has(k)) counts.set(k, counts.get(k) + 1);
  }
  // [{ x: "1A", y: 12 }, ...] in correct order
  return CAMELOT_ORDER.map((k) => ({ x: k, y: counts.get(k) }));
}

function tightMax(n) {
  if (!n || n < 1) return 1;
  const buffer = Math.max(1, Math.ceil(n * 0.02)); // ~2% pad, at least 1
  return n + buffer; // hugs the tallest bar
}

// Optional: keep ticks integer & sensible
function chooseTickAmount(xMax) {
  // Use up to 6 ticks, but never more than the integer range
  return Math.min(6, Math.max(2, Math.floor(xMax)));
}

export default function Charts({ rows }) {
  const points = useMemo(() => toSeriesPoints(rows), [rows]);
  const values = points.map((p) => p.y);
  const maxSongs = Math.max(0, ...values);
  const xMax = tightMax(maxSongs); // 👈 tighter cap
  const tickAmt = chooseTickAmount(xMax);
  const chartHeight = Math.max(520, points.length * 26);

  const options = {
    chart: { type: "bar", toolbar: { show: false } },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "50%",
        borderRadius: 4,
      },
    },
    // Numeric axis across the bottom
    xaxis: {
      type: "numeric",
      min: 0,
      max: xMax, // no big round-up to 50
      tickAmount: tickAmt, // avoids fractional ticks
      title: { text: "" },
      labels: { formatter: (v) => Math.round(v) }, // force integer tick labels
    },
    // Categories come from each point's `x` automatically
    yaxis: {
      title: { text: "" },
      labels: { style: { fontSize: "12px" } },
      // IMPORTANT: leave categories/tickAmount unset to avoid numeric scaling
    },
    grid: { strokeDashArray: 3 },
    dataLabels: { enabled: false },
    tooltip: {
      x: { formatter: (val) => String(val) }, // show the Camelot key
      y: { formatter: (v) => `${v} song${v === 1 ? "" : "s"}` },
    },
    colors: ["#5A8DEE"],
    legend: { show: false },
    responsive: [
      {
        breakpoint: 576,
        options: {
          plotOptions: { bar: { barHeight: "65%" } },
          xaxis: { tickAmount: Math.min(4, xMax || 1) },
          yaxis: { labels: { style: { fontSize: "11px" } } },
        },
      },
    ],
  };

  const series = [{ name: "Songs", data: points }];

  return (
    <div className="container mt-2">
      <div className="card p-3">
        <h5 className="card-title text-center mb-3">songs per camelot key</h5>
        <Chart
          options={options}
          series={series}
          type="bar"
          width="100%"
          height={chartHeight}
        />
      </div>
    </div>
  );
}
