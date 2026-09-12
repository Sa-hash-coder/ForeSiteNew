"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ─── 1. Real Chart.js Doughnut Chart: Status Distribution ───────────────────

interface StatusSegment {
  label: string;
  count: number;
  color: string;
}

export function RealDonutChart({ segments }: { segments: StatusSegment[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute("data-theme") as "light" | "dark";
      setTheme(current === "dark" ? "dark" : "light");
    };
    updateTheme();

    const observer = new MutationObserver(() => updateTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const isDark = theme === "dark";
    const tooltipBg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.92)";

    chartInstance.current = new ChartJS(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: segments.map((s) => s.label),
        datasets: [
          {
            data: segments.map((s) => s.count),
            backgroundColor: segments.map((s) => s.color),
            borderColor: isDark ? "#111827" : "#ffffff",
            borderWidth: 2.5,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        animation: {
          duration: 600,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: "#ffffff",
            bodyColor: "#e2e8f0",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const count = ctx.parsed;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return `  ${ctx.label}: ${count} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [segments, theme, total]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      {/* Canvas with centered total */}
      <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
        <canvas ref={canvasRef} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
            {total}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, fontWeight: 600 }}>
            Reports
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 140 }}>
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{s.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{s.count}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2. Real Chart.js Category Bar Chart ────────────────────────────────────

interface CategoryData {
  category: string;
  count: number;
  color: string;
}

export function RealCategoryBarChart({ categories }: { categories: CategoryData[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute("data-theme") as "light" | "dark";
      setTheme(current === "dark" ? "dark" : "light");
    };
    updateTheme();

    const observer = new MutationObserver(() => updateTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const isDark = theme === "dark";
    const textColor = isDark ? "#94a3b8" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.06)";
    const tooltipBg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.92)";

    chartInstance.current = new ChartJS(canvasRef.current, {
      type: "bar",
      data: {
        labels: categories.map((c) => c.category),
        datasets: [
          {
            label: "Incident Reports",
            data: categories.map((c) => c.count),
            backgroundColor: categories.map((c) => c.color),
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 34,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: "#ffffff",
            bodyColor: "#e2e8f0",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `  ${ctx.parsed.y} reports filed`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: textColor,
              font: {
                size: 10,
                weight: 600,
              },
              maxRotation: 20,
              minRotation: 0,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              font: {
                size: 10,
                weight: 500,
              },
              precision: 0,
            },
            border: {
              display: false,
              dash: [4, 4],
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [categories, theme]);

  return (
    <div style={{ position: "relative", width: "100%", height: 180 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── 3. Real Chart.js Risk Score Distribution Histogram ──────────────────────

interface RiskBucket {
  label: string;
  count: number;
  color: string;
}

export function RealRiskHistogramChart({ buckets }: { buckets: RiskBucket[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute("data-theme") as "light" | "dark";
      setTheme(current === "dark" ? "dark" : "light");
    };
    updateTheme();

    const observer = new MutationObserver(() => updateTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const isDark = theme === "dark";
    const textColor = isDark ? "#94a3b8" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.06)";
    const tooltipBg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.92)";

    chartInstance.current = new ChartJS(canvasRef.current, {
      type: "bar",
      data: {
        labels: buckets.map((b) => `Score ${b.label}`),
        datasets: [
          {
            label: "Reports in Range",
            data: buckets.map((b) => b.count),
            backgroundColor: buckets.map((b) => b.color),
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 44,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: "#ffffff",
            bodyColor: "#e2e8f0",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `  ${ctx.parsed.y} reports in this risk band`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: textColor,
              font: {
                size: 11,
                weight: 600,
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              font: {
                size: 10,
                weight: 500,
              },
              precision: 0,
            },
            border: {
              display: false,
              dash: [4, 4],
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [buckets, theme]);

  return (
    <div style={{ position: "relative", width: "100%", height: 160 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ─── 4. Real Chart.js Weekly Reports Bar Chart (Officer Home Dashboard) ──────

export function RealWeeklyReportsChart({
  weeks,
}: {
  weeks: { week: string; total: number; critical: number }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute("data-theme") as "light" | "dark";
      setTheme(current === "dark" ? "dark" : "light");
    };
    updateTheme();

    const observer = new MutationObserver(() => updateTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const isDark = theme === "dark";
    const primaryBar = isDark ? "#38bdf8" : "#0284c7";
    const dangerBar = isDark ? "#f87171" : "#dc2626";
    const textColor = isDark ? "#94a3b8" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.06)";
    const tooltipBg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.92)";

    chartInstance.current = new ChartJS(canvasRef.current, {
      type: "bar",
      data: {
        labels: weeks.map((w) => w.week),
        datasets: [
          {
            label: "Total Reports",
            data: weeks.map((w) => w.total),
            backgroundColor: primaryBar,
            borderRadius: 5,
            borderSkipped: false,
            maxBarThickness: 20,
          },
          {
            label: "Critical SIF",
            data: weeks.map((w) => w.critical),
            backgroundColor: dangerBar,
            borderRadius: 5,
            borderSkipped: false,
            maxBarThickness: 20,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500,
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: textColor,
              font: {
                size: 11,
                weight: 600,
              },
              boxWidth: 12,
              boxHeight: 12,
              borderRadius: 3,
              useBorderRadius: true,
              padding: 14,
            },
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: "#ffffff",
            bodyColor: "#e2e8f0",
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => `  ${ctx.dataset.label}: ${ctx.parsed.y} incidents`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: textColor,
              font: {
                size: 10,
                weight: 600,
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              font: {
                size: 10,
                weight: 500,
              },
              precision: 0,
            },
            border: {
              display: false,
              dash: [4, 4],
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [weeks, theme]);

  return (
    <div style={{ position: "relative", width: "100%", height: 210 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

