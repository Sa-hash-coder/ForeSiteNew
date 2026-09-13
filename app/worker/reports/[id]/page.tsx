"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { MOCK_REPORT_DETAIL } from "@/app/lib/mockData";
import { useLanguage } from "@/app/lib/LanguageContext";
import StatusBadge from "@/app/components/StatusBadge";
import DangerBadge from "@/app/components/DangerBadge";
import VoiceReadAloudButton from "@/app/components/VoiceReadAloudButton";
import { getReportByIdApi } from "@/app/lib/api";
import {
  AlertTriangle,
  MapPin,
  ShieldCheck,
  Wrench,
  HardHat,
  Calendar,
  Check,
} from "lucide-react";
import { translateSafetyText, translateLocation } from "@/app/lib/hindiTranslator";

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang, t } = useLanguage();

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getReportByIdApi(id);
        if (res?.data) {
          const d: any = res.data;
          setReport({
            _id: d._id,
            title: (d.description && d.description.length > (d.title || "").length) ? d.description : (d.title || d.description || "Hazard Report"),
            description: d.description,
            location: d.location,
            status: d.status,
            createdAt: d.createdAt,
            imageUrl: d.imageUrl,
            riskAssessment: d.riskAssessment,
            suggestions: d.recommendations || d.riskAssessment?.recommendations || [
              "Halt hazardous operation immediately under Stop-Work Authority.",
              "Report situation to unit supervisor and maintain safe distance.",
            ],
            maintenanceTasks: [],
          });
          return;
        }
      } catch (err) {
        console.warn("Could not load report from API, checking mock data:", err);
      }

      // Fallback to mock data
      const fallback = MOCK_REPORT_DETAIL[id] || Object.values(MOCK_REPORT_DETAIL)[0];
      setReport(fallback);
      setLoading(false);
    }

    loadData().finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
        <p>{lang === 'hi' ? 'खतरा रिपोर्ट लोड हो रही है...' : 'Loading hazard report...'}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={s.errorBox}>
        <p style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
          <AlertTriangle size={16} /> {lang === "hi" ? "रिपोर्ट नहीं मिली" : "Report not found"}
        </p>
        <Link href="/worker/reports" style={s.backLink}>{t.backToReports}</Link>
      </div>
    );
  }

  const displayTitle = lang === "hi" ? (report.titleHi || translateSafetyText(report.title, "hi")) : report.title;
  const displayDesc = lang === "hi" ? (report.descriptionHi || translateSafetyText(report.description, "hi")) : report.description;
  const displayLocation = lang === "hi" ? (report.locationHi || translateLocation(report.location, "hi")) : report.location;
  const suggestions = lang === "hi"
    ? (report.suggestionsHi || (report.suggestions || []).map((s: string) => translateSafetyText(s, "hi")))
    : (report.suggestions || []);
  const risk = report.riskAssessment;

  // Text that will be read aloud by the Voice button
  const dangerLevelText = risk ? t.dangerLevels[risk.riskLevel as keyof typeof t.dangerLevels]?.label || "" : "";
  const spokenContent = `${dangerLevelText}. ${t.suggestionsTitle}. ${suggestions.join(". ")}`;

  return (
    <div>
      <Link href="/worker/reports" style={s.backLink}>{t.backToReports}</Link>

      {/* Header Summary */}
      <div style={s.card}>
        <div style={s.titleRow}>
          <h1 style={s.title}>{displayTitle}</h1>
          <StatusBadge status={report.status} />
        </div>
        <div style={s.metaRow}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {displayLocation}</span>
          <span>•</span>
          <span>
            {new Date(report.createdAt).toLocaleDateString(
              lang === "hi" ? "hi-IN" : "en-IN",
              { day: "numeric", month: "long", year: "numeric" }
            )}
          </span>
        </div>
      </div>

      {/* 1. DANGER LEVEL CARD — High Contrast & Clear */}
      {risk && (
        <div style={s.dangerCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-muted)" }}>
              {t.dangerLevelTitle}
            </span>
            {/* Voice Read Aloud Button */}
            <VoiceReadAloudButton textToRead={spokenContent} />
          </div>
          <DangerBadge level={risk.riskLevel} showSubtext={true} />
        </div>
      )}

      {/* 2. SUGGESTIONS & SAFETY ADVICE CARD */}
      {suggestions.length > 0 && (
        <div style={s.suggestionsCard}>
          <div style={s.cardHeaderWithIcon}>
            <ShieldCheck size={20} color="#16a34a" />
            <h2 style={s.sectionTitle}>{t.suggestionsTitle}</h2>
          </div>
          <div style={s.suggestionList}>
            {suggestions.map((item: string, idx: number) => (
              <div key={idx} style={s.suggestionItem}>
                <span style={s.bulletPoint}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. ACTION / REPAIR PROGRESS */}
      {report.maintenanceTasks && report.maintenanceTasks.length > 0 && (
        <div style={s.card}>
          <div style={s.cardHeaderWithIcon}>
            <Wrench size={18} color="var(--primary)" />
            <h2 style={s.sectionTitle}>{t.actionTakenTitle}</h2>
          </div>
          {report.maintenanceTasks.map((task: any) => (
            <div key={task._id} style={s.taskCard}>
              <div style={s.taskTop}>
                <span style={s.taskTitle}>{lang === "hi" ? translateSafetyText(task.title, "hi") : task.title}</span>
                <span style={{ ...s.taskBadge, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {task.status === "verified" ? (
                    <>
                      <Check size={11} strokeWidth={3} />
                      {lang === "hi" ? "पूर्ण (सत्यापित)" : "Verified"}
                    </>
                  ) : (
                    lang === "hi" ? "मरम्मत चालू है" : "In Progress"
                  )}
                </span>
              </div>
              {task.assignedTo && (
                <p style={{ ...s.taskDetail, display: "flex", alignItems: "center", gap: 5 }}>
                  <HardHat size={13} /> <strong>{t.assignedTo}:</strong> {task.assignedTo.name}
                </p>
              )}
              {task.dueDate && (
                <p style={{ ...s.taskDetail, display: "flex", alignItems: "center", gap: 5 }}>
                  <Calendar size={13} /> <strong>{t.dueDate}:</strong> {new Date(task.dueDate).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 4. WHAT WAS REPORTED (Brief) */}
      <div style={s.card}>
        <h2 style={s.sectionTitle}>{t.reportedDetailsTitle}</h2>
        <p style={s.bodyText}>{displayDesc}</p>
        {report.imageUrl && (
          <div style={{ marginTop: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={report.imageUrl} alt="Hazard photo" style={s.photo} />
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backLink: {
    display: "inline-block",
    color: "#1d4ed8",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    marginBottom: "14px",
  },
  card: {
    backgroundColor: "#fff",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  dangerCard: {
    backgroundColor: "#fff",
    border: "2px solid #e5e7eb",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  suggestionsCard: {
    backgroundColor: "#eff6ff",
    border: "1.5px solid #bfdbfe",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
  },
  cardHeaderWithIcon: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "8px",
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "var(--text)",
    flex: 1,
    lineHeight: 1.35,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    fontSize: "13px",
    color: "var(--text-muted)",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text)",
  },
  suggestionList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "8px",
  },
  suggestionItem: {
    backgroundColor: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: "8px",
    padding: "10px 12px",
  },
  bulletPoint: {
    fontSize: "14px",
    color: "#1e3a8a",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  bodyText: {
    fontSize: "15px",
    color: "var(--text)",
    lineHeight: 1.6,
    marginTop: "6px",
  },
  photo: {
    width: "100%",
    maxHeight: "220px",
    objectFit: "cover",
    borderRadius: "8px",
    border: "1px solid var(--border)",
  },
  taskCard: {
    backgroundColor: "#fafaf9",
    border: "1px solid #e7e5e4",
    borderRadius: "8px",
    padding: "12px",
    marginTop: "8px",
  },
  taskTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "6px",
  },
  taskTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text)",
    flex: 1,
  },
  taskBadge: {
    fontSize: "12px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "10px",
    backgroundColor: "#dcfce7",
    color: "#15803d",
    whiteSpace: "nowrap",
  },
  taskDetail: {
    fontSize: "13px",
    color: "var(--text-muted)",
    marginTop: "3px",
  },
  errorBox: {
    backgroundColor: "var(--danger-light)",
    border: "1px solid #fca5a5",
    color: "var(--danger)",
    padding: "16px",
    borderRadius: "8px",
  },
};
