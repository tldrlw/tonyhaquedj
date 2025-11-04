import Chart from "react-apexcharts";

/** Order we want on the X-axis */
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

/** Build counts per camelot_key from your raw rows */
function buildCounts(rows = []) {
  const counts = new Map(CAMELOT_ORDER.map((k) => [k, 0]));
  for (const r of rows) {
    const k = r.camelot_key || r.camelotKey || r.camelot; // be flexible
    if (k && counts.has(k)) counts.set(k, counts.get(k) + 1);
  }
  const labels = [];
  const data = [];
  for (const k of CAMELOT_ORDER) {
    labels.push(k);
    data.push(counts.get(k));
  }
  return { labels, data };
}

export default function Charts({ rows }) {
  const { labels, data } = buildCounts(rows);

  const options = {
    chart: { type: "bar", toolbar: { show: false } },
    xaxis: { categories: labels, title: { text: "camelot key" } },
    yaxis: { title: { text: "songs" }, min: 0, forceNiceScale: true },
    grid: { strokeDashArray: 3 },
    dataLabels: { enabled: false },
    tooltip: {
      y: { formatter: (val) => `${val} song${val === 1 ? "" : "s"}` },
    },
    legend: { show: false },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: "55%",
      },
    },
    responsive: [
      {
        // Small screens: tighten columns and move tooltip if needed
        breakpoint: 576,
        options: {
          plotOptions: { bar: { columnWidth: "70%" } },
        },
      },
    ],
  };

  const series = [{ name: "Songs", data }];

  return (
    <div className="container mt-2">
      <div className="card p-3">
        <h5 className="card-title text-center mb-3">songs per camelot key</h5>
        {/* width="100%" lets it fill Bootstrap columns responsively */}
        <Chart
          options={options}
          series={series}
          type="bar"
          width="100%"
          height={360}
        />
      </div>
    </div>
  );
}
