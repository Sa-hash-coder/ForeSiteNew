"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/app/lib/LanguageContext";
import { getStoredUser, logout, saveAuth } from "@/app/lib/auth";
import { getToken } from "@/app/lib/auth";
import { MOCK_REPORTS } from "@/app/lib/mockData";
import { getMyReportsApi } from "@/app/lib/api";
import { Check } from "lucide-react";

export default function WorkerProfilePage() {
  const { lang } = useLanguage();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDept, setFormDept] = useState("");
  const [saved, setSaved] = useState(false);
  const [reportCount, setReportCount] = useState(MOCK_REPORTS.length);
  const [resolvedCount, setResolvedCount] = useState(
    MOCK_REPORTS.filter((r) => ["resolved", "closed"].includes(r.status)).length
  );

  useEffect(() => {
    const u = getStoredUser();
    if (u) {
      setCurrentUser(u);
      setFormName(u.name || "");
      setFormEmail(u.email || "");
      setFormDept(u.department || "");
    }
    async function loadStats() {
      try {
        const res = await getMyReportsApi();
        if (res.data && res.data.length > 0) {
          const mockIds = new Set(MOCK_REPORTS.map((r) => r._id));
          const liveOnly = res.data.filter((r: any) => !mockIds.has(r._id));
          const all = [...liveOnly, ...MOCK_REPORTS];
          setReportCount(all.length);
          setResolvedCount(all.filter((r: any) => ["resolved", "closed"].includes(r.status)).length);
        }
      } catch {}
    }
    loadStats();
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  const handleSave = () => {
    const token = getToken() || "";
    const updated = {
      ...currentUser,
      name: formName,
      email: formEmail,
      department: formDept,
    };
    saveAuth(token, updated);
    setCurrentUser(updated);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const displayName = currentUser?.name || (lang === "hi" ? "फ़ील्ड कार्यकर्ता" : "Field Worker");
  const displayInitials = currentUser?.name
    ? currentUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "FW";
  const displayRole = currentUser?.role
    ? currentUser.role === "worker"
      ? lang === "hi" ? "सुरक्षा कार्यकर्ता" : "Field Safety Worker"
      : currentUser.role.toUpperCase()
    : lang === "hi" ? "प्लांट कार्यकर्ता" : "Plant Worker";

  return (
    <div style={styles.container}>
      {/* Success toast */}
      {saved && (
        <div style={{ ...styles.toast, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
          <Check size={14} strokeWidth={3} />
          <span>{lang === "hi" ? "प्रोफ़ाइल अपडेट हो गई" : "Profile updated successfully"}</span>
        </div>
      )}

      {/* Profile Header Card */}
      <div style={styles.card}>
        <div style={styles.avatarWrap}>
          <div style={styles.avatar}>{displayInitials}</div>
        </div>
        <h1 style={styles.name}>{displayName}</h1>
        <p style={styles.role}>{displayRole}</p>
        <p style={styles.memberSince}>
          {currentUser?.department
            ? `${lang === "hi" ? "विभाग" : "Dept"}: ${currentUser.department}`
            : ""}
          {currentUser?.email ? ` • ${currentUser.email}` : ""}
        </p>

        {/* Stats Grid */}
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{reportCount}</div>
            <div style={styles.statLabel}>{lang === "hi" ? "रिपोर्ट्स" : "Reports"}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{resolvedCount}</div>
            <div style={styles.statLabel}>{lang === "hi" ? "हल किया" : "Resolved"}</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{reportCount - resolvedCount}</div>
            <div style={styles.statLabel}>{lang === "hi" ? "लंबित" : "Pending"}</div>
          </div>
        </div>
      </div>

      {/* Edit Profile Section */}
      <div style={styles.menuCard}>
        {!editing ? (
          <button onClick={() => setEditing(true)} style={styles.menuItem}>
            <div style={styles.menuLeft}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span style={styles.menuText}>{lang === "hi" ? "प्रोफ़ाइल संपादित करें" : "Edit Profile"}</span>
            </div>
            <span style={styles.arrow}>›</span>
          </button>
        ) : (
          <div style={styles.editForm}>
            <h3 style={styles.editTitle}>
              {lang === "hi" ? "प्रोफ़ाइल संपादित करें" : "Edit Profile"}
            </h3>

            <label style={styles.label}>{lang === "hi" ? "नाम" : "Name"}</label>
            <input
              style={styles.input}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={lang === "hi" ? "पूरा नाम" : "Full name"}
            />

            <label style={styles.label}>{lang === "hi" ? "ईमेल" : "Email"}</label>
            <input
              style={styles.input}
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="email@example.com"
            />

            <label style={styles.label}>{lang === "hi" ? "विभाग" : "Department"}</label>
            <input
              style={styles.input}
              value={formDept}
              onChange={(e) => setFormDept(e.target.value)}
              placeholder={lang === "hi" ? "विभाग का नाम" : "e.g. Boiler Room B"}
            />

            <div style={styles.editBtns}>
              <button onClick={handleSave} style={styles.saveBtn}>
                {lang === "hi" ? "सहेजें" : "Save Changes"}
              </button>
              <button onClick={() => setEditing(false)} style={styles.cancelBtn}>
                {lang === "hi" ? "रद्द करें" : "Cancel"}
              </button>
            </div>
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout} style={{ ...styles.menuItem, borderBottom: "none" }}>
          <div style={styles.menuLeft}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span style={{ ...styles.menuText, color: "var(--danger)" }}>{lang === "hi" ? "लॉग आउट" : "Logout"}</span>
          </div>
          <span style={{ ...styles.arrow, color: "var(--danger)" }}>›</span>
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 600,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  toast: {
    backgroundColor: "#10b981",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center",
  },
  card: {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 24,
    textAlign: "center",
    boxShadow: "var(--shadow-sm)",
  },
  avatarWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    backgroundColor: "var(--primary)",
    color: "#fff",
    fontSize: 24,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(10, 25, 47, 0.25)",
  },
  name: {
    fontSize: 20,
    fontWeight: 800,
    color: "var(--text)",
    margin: "0 0 4px 0",
  },
  role: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0F172A",
    margin: "0 0 2px 0",
  },
  memberSince: {
    fontSize: 12,
    color: "var(--text-muted)",
    margin: "0 0 20px 0",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    paddingTop: 16,
    borderTop: "1px solid var(--border)",
  },
  statBox: {
    backgroundColor: "var(--surface-subtle)",
    borderRadius: 12,
    padding: "12px 8px",
  },
  statNum: {
    fontSize: 20,
    fontWeight: 800,
    color: "var(--text)",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "var(--text-muted)",
    fontWeight: 600,
  },
  menuCard: {
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
  },
  menuItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s ease",
  },
  menuLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  menuText: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text)",
  },
  arrow: {
    fontSize: 20,
    color: "var(--text-light)",
    fontWeight: 400,
  },
  editForm: {
    padding: "20px",
    borderBottom: "1px solid var(--border)",
  },
  editTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)",
    marginBottom: 16,
    marginTop: 0,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text)",
    backgroundColor: "var(--surface-subtle)",
    outline: "none",
    boxSizing: "border-box",
  },
  editBtns: {
    display: "flex",
    gap: 10,
    marginTop: 18,
  },
  saveBtn: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    backgroundColor: "#0A192F",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  cancelBtn: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    backgroundColor: "transparent",
    color: "var(--text-muted)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
