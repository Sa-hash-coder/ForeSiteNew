"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScriptableContext,
} from "chart.js";

// Register necessary Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface ChartDataPoint {
  label: string;
  total: number;
  critical: number;
  date?: string;
  resolved?: number;
}

interface ReportsOverTimeChartProps {
  data: ChartDataPoint[];
  height?: number;
  range?: "7d" | "30d" | "3m";
  onRangeChange?: (r: "7d" | "30d" | "3m") => void;
  title?: string;
  subtitle?: string;
}

export default function ReportsOverTimeChart({
  data,
  height = 260,
  range,
  onRangeChange,
  title = "Reports Over Time",
  subtitle = "Dynamic Incident Rate & Critical SIF Precursors",
}: ReportsOverTimeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showTotal, setShowTotal] = useState(true);
  const [showCritical, setShowCritical] = useState(true);

  // Detect and synchronize with document theme (light/dark mode)
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

  // Compute total counts in period
  const totalReportsCount = data.reduce((acc, d) => acc + d.total, 0);
  const totalCriticalCount = data.reduce((acc, d) => acc + d.critical, 0);
  const criticalRate =
    totalReportsCount > 0
      ? Math.round((totalCriticalCount / totalReportsCount) * 100)
      : 0;

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart instance before creating a new one
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const isDark = theme === "dark";
    const primaryColor = isDark ? "#38bdf8" : "#0284c7"; // Cyan/Blue tone
    const primaryBorder = isDark ? "#0ea5e9" : "#0369a1";
    const dangerColor = isDark ? "#f87171" : "#dc2626"; // Red tone
    const dangerBorder = isDark ? "#ef4444" : "#b91c1c";

    const textColor = isDark ? "#94a3b8" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.06)";
    const tooltipBg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.92)";

    const labels = data.map((d) => d.label);
    const totalPoints = data.map((d) => d.total);
    const criticalPoints = data.map((d) => d.critical);

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    chartInstance.current = new ChartJS(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total Reports",
            data: totalPoints,
            hidden: !showTotal,
            borderColor: primaryBorder,
            borderWidth: 2.5,
            pointBackgroundColor: primaryColor,
            pointBorderColor: isDark ? "#0f172a" : "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: primaryBorder,
            pointHoverBorderColor: "#ffffff",
            pointHoverBorderWidth: 2.5,
            tension: 0.35,
            fill: true,
            backgroundColor: (context: ScriptableContext<"line">) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return "rgba(14, 165, 233, 0.1)";
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, isDark ? "rgba(56, 189, 248, 0.28)" : "rgba(14, 165, 233, 0.22)");
              gradient.addColorStop(1, "rgba(14, 165, 233, 0.00)");
              return gradient;
            },
          },
          {
            label: "Critical SIF Hazards",
            data: criticalPoints,
            hidden: !showCritical,
            borderColor: dangerBorder,
            borderWidth: 2.5,
            borderDash: [5, 4],
            pointBackgroundColor: dangerColor,
            pointBorderColor: isDark ? "#0f172a" : "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6.5,
            pointHoverBackgroundColor: dangerBorder,
            pointHoverBorderColor: "#ffffff",
            pointHoverBorderWidth: 2.5,
            tension: 0.35,
            fill: true,
            backgroundColor: (context: ScriptableContext<"line">) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return "rgba(239, 68, 68, 0.08)";
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, isDark ? "rgba(248, 113, 113, 0.22)" : "rgba(220, 38, 38, 0.16)");
              gradient.addColorStop(1, "rgba(220, 38, 38, 0.00)");
              return gradient;
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 600,
          easing: "easeOutQuart",
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: false, // Handled by custom interactive buttons above
          },
          tooltip: {
            enabled: true,
            backgroundColor: tooltipBg,
            titleColor: "#ffffff",
            bodyColor: "#e2e8f0",
            borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.2)",
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            usePointStyle: true,
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                const point = data[idx];
                return point?.date ? `${point.label} · ${point.date}` : `Period: ${point?.label}`;
              },
              label: (context) => {
                const val = context.parsed.y;
                const datasetName = context.dataset.label || "";
                return `  ${datasetName}: ${val} ${val === 1 ? "incident" : "incidents"}`;
              },
              afterBody: (items) => {
                const total = items.find((i) => i.datasetIndex === 0)?.parsed.y || 0;
                const crit = items.find((i) => i.datasetIndex === 1)?.parsed.y || 0;
                if (total > 0) {
                  const pct = Math.round((crit / total) * 100);
                  return `\n  Critical SIF Ratio: ${pct}%`;
                }
                return "";
              },
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
              padding: 6,
            },
            border: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: Math.max(...data.map((d) => Math.max(d.total, d.critical)), 4) + 1,
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              font: {
                size: 11,
                weight: 500,
              },
              precision: 0,
              padding: 8,
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
  }, [data, theme, showTotal, showCritical]);

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        border: "1px solid var(--border)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Chart Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text)",
                margin: 0,
                letterSpacing: "-0.2px",
              }}
            >
              {title}
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                backgroundColor: "var(--surface-subtle)",
                color: "var(--primary)",
                border: "1px solid var(--border)",
              }}
            >
              Live Analytics
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: 3,
            }}
          >
            {subtitle} · <strong style={{ color: "var(--text)" }}>{totalReportsCount}</strong> reports ({totalCriticalCount} critical, {criticalRate}% SIF exposure)
          </div>
        </div>

        {/* Right Controls: Interactive Series Toggles & Optional Time Range Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Custom Interactive Legend Toggles */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "var(--surface-subtle)",
              padding: "4px 8px",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            {/* Total Reports toggle */}
            <button
              onClick={() => setShowTotal(!showTotal)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                opacity: showTotal ? 1 : 0.4,
                transition: "opacity 0.2s ease",
              }}
              title="Click to toggle Total Reports series"
            >
              <span
                style={{
                  width: 14,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: theme === "dark" ? "#38bdf8" : "#0284c7",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text)",
                  textDecoration: showTotal ? "none" : "line-through",
                }}
              >
                Total Reports
              </span>
            </button>

            {/* Critical SIF toggle */}
            <button
              onClick={() => setShowCritical(!showCritical)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                opacity: showCritical ? 1 : 0.4,
                transition: "opacity 0.2s ease",
              }}
              title="Click to toggle Critical SIF series"
            >
              <span
                style={{
                  width: 14,
                  height: 0,
                  borderTop: "2px dashed " + (theme === "dark" ? "#f87171" : "#dc2626"),
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text)",
                  textDecoration: showCritical ? "none" : "line-through",
                }}
              >
                Critical SIF
              </span>
            </button>
          </div>

          {/* Time range switcher if passed */}
          {range && onRangeChange && (
            <div
              style={{
                display: "flex",
                borderRadius: 10,
                border: "1px solid var(--border)",
                overflow: "hidden",
                backgroundColor: "var(--surface)",
              }}
            >
              {(["7d", "30d", "3m"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => onRangeChange(r)}
                  style={{
                    padding: "5px 12px",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    backgroundColor: range === r ? "var(--primary)" : "transparent",
                    color: range === r ? "#ffffff" : "var(--text-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {r === "7d" ? "7D" : r === "30d" ? "30D" : "3M"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real HTML5 Canvas for Chart.js */}
      <div style={{ position: "relative", width: "100%", height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
