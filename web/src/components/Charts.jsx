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

const CAMELOT_TO_KEY = {
  "1A": "Abm/G#m",
  "2A": "Ebm/D#m",
  "3A": "Bbm/A#m",
  "4A": "Fm",
  "5A": "Cm",
  "6A": "Gm",
  "7A": "Dm",
  "8A": "Am",
  "9A": "Em",
  "10A": "Bm",
  "11A": "F#m",
  "12A": "C#m",

  "1B": "B",
  "2B": "F#",
  "3B": "Db/C#",
  "4B": "Ab",
  "5B": "Eb",
  "6B": "Bb",
  "7B": "F",
  "8B": "C",
  "9B": "G",
  "10B": "D",
  "11B": "A",
  "12B": "E",
};

function toSeriesPoints(rows = []) {
  const counts = new Map(CAMELOT_ORDER.map((k) => [k, 0]));

  for (const r of rows) {
    const k = r.camelot_key ?? r.camelotKey ?? r.camelot;
    if (k && counts.has(k)) counts.set(k, counts.get(k) + 1);
  }

  return CAMELOT_ORDER.map((camelot) => {
    const keyLabel = CAMELOT_TO_KEY[camelot] ?? "";
    const label = keyLabel ? `${camelot} / ${keyLabel}` : camelot;
    return { x: label, y: counts.get(camelot) };
  });
}

function tightMax(n) {
  if (!n || n < 1) return 1;
  const buffer = Math.max(1, Math.ceil(n * 0.02));
  return n + buffer;
}

function chooseTickAmount(xMax) {
  return Math.min(6, Math.max(2, Math.floor(xMax)));
}

export default function Charts({ rows }) {
  const points = useMemo(() => toSeriesPoints(rows), [rows]);
  const values = points.map((p) => p.y);
  const maxSongs = Math.max(0, ...values);
  const xMax = tightMax(maxSongs);
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
    xaxis: {
      type: "numeric",
      min: 0,
      max: xMax,
      tickAmount: tickAmt,
      title: { text: "" },
      labels: { formatter: (v) => Math.round(v) },
    },
    yaxis: {
      title: { text: "" },
      labels: { style: { fontSize: "12px" } },
    },
    grid: { strokeDashArray: 3 },
    dataLabels: { enabled: false },
    tooltip: {
      x: { formatter: (val) => String(val) },
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
    <div className="container mt-2 mb-3">
      <div className="card p-3">
        <h5 className="card-title text-center mb-3">songs per key</h5>
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
