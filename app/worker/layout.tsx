"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LanguageProvider, useLanguage } from "@/app/lib/LanguageContext";
import LanguageSwitchButton from "@/app/components/LanguageSwitchButton";
import {
  Sun,
  Moon,
  Bell,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Clock,
  Info,
  CheckCheck,
  ExternalLink,
  Menu,
  MapPin,
} from "lucide-react";
import { getStoredUser } from "@/app/lib/auth";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "alert" | "action" | "resolved" | "review" | "info";
  link: string;
  location?: string;
}

function WorkerAppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Notification state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Default to clean industrial light theme
    const saved = (localStorage.getItem("foresite_theme") as "light" | "dark" | null) || "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);

    const u = getStoredUser();
    if (u) setCurrentUser(u);

    // Load persisted read notifications
    try {
      const storedRead = localStorage.getItem("foresite_worker_read_notifs");
      if (storedRead) {
        setReadIds(JSON.parse(storedRead));
      }
    } catch {
      // ignore parse err
    }
  }, []);

  // Fetch live notifications based on reports and alerts
  useEffect(() => {
    let isMounted = true;

    async function fetchNotifications() {
      try {
        const [repRes, altRes] = await Promise.allSettled([
          fetch("/api/reports?limit=15").then((r) => r.json()),
          fetch("/api/alerts").then((r) => r.json()),
        ]);

        const items: NotificationItem[] = [];

        // 1. Process active alerts
        if (altRes.status === "fulfilled" && altRes.value?.success && Array.isArray(altRes.value.data)) {
          altRes.value.data.forEach((alt: any) => {
            const isCritical = alt.riskLevel === "CRITICAL" || alt.riskScore >= 80;
            items.push({
              id: `alt_${alt._id || alt.reportId || Math.random()}`,
              title: isCritical
                ? (lang === "hi" ? "गंभीर SIF सुरक्षा चेतावनी" : "Critical SIF Hazard Alert")
                : (lang === "hi" ? "प्लांट सुरक्षा सूचना" : "Plant Safety Warning"),
              message: alt.message || alt.reportTitle || "High risk safety precursor active.",
              timestamp: alt.createdAt || new Date().toISOString(),
              type: "alert",
              link: alt.reportId ? `/worker/reports/${alt.reportId}` : "/worker/reports",
              location: alt.location || "Refinery Unit Alpha",
            });
          });
        }

        // 2. Process reports status updates
        if (repRes.status === "fulfilled" && repRes.value?.success && Array.isArray(repRes.value.data)) {
          repRes.value.data.forEach((rep: any) => {
            if (rep.status === "action_assigned") {
              items.push({
                id: `rep_act_${rep._id}`,
                title: lang === "hi" ? "मेंटेनेंस टीम भेजी गई" : "Maintenance Team Dispatched",
                message: `${lang === "hi" ? "कार्य आदेश जारी:" : "Work order assigned for:"} ${rep.title}`,
                timestamp: rep.createdAt || new Date().toISOString(),
                type: "action",
                link: `/worker/reports/${rep._id}`,
                location: rep.location,
              });
            } else if (rep.status === "resolved" || rep.status === "closed") {
              items.push({
                id: `rep_res_${rep._id}`,
                title: lang === "hi" ? "खतरा हल और सत्यापित" : "Hazard Cleared & Verified",
                message: `${lang === "hi" ? "सुरक्षा क्लीयरेंस स्वीकृत:" : "Safety clearance verified:"} ${rep.title}`,
                timestamp: rep.createdAt || new Date().toISOString(),
                type: "resolved",
                link: `/worker/reports/${rep._id}`,
                location: rep.location,
              });
            } else if (rep.status === "under_review") {
              items.push({
                id: `rep_rev_${rep._id}`,
                title: lang === "hi" ? "अधिकारी समीक्षाधीन" : "Safety Officer Review",
                message: `${lang === "hi" ? "समीक्षा जारी:" : "Review in progress:"} ${rep.title}`,
                timestamp: rep.createdAt || new Date().toISOString(),
                type: "review",
                link: `/worker/reports/${rep._id}`,
                location: rep.location,
              });
            }
          });
        }

        // Ensure default safety advisories exist
        if (items.length < 2) {
          items.push(
            {
              id: "sys_ppe_adv",
              title: lang === "hi" ? "दैनिक सुरक्षा एडवाइजरी" : "Daily Safety Protocol Active",
              message: lang === "hi" ? "सेक्टर 4 में 100% पीपीई और हार्नेस टाई-ऑफ अनिवार्य है।" : "Mandatory 100% harness tie-off and dual SRL protocol active in Sector 4.",
              timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
              type: "info",
              link: "/worker/reports",
              location: "Tank Farm Sector 4",
            },
            {
              id: "sys_telemetry_ok",
              title: lang === "hi" ? "सेंसर टेलीमेट्री सक्रिय" : "Telemetry Monitor Online",
              message: lang === "hi" ? "गैस व कंपन डिटेक्टर सामान्य स्तर पर कार्य कर रहे हैं।" : "Live gas & vibration telemetry channels healthy across all units.",
              timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
              type: "info",
              link: "/worker",
              location: "Refinery Unit Alpha",
            }
          );
        }

        // Sort descending by timestamp
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (isMounted) {
          setNotifications(items);
        }
      } catch (err) {
        console.warn("Failed to load notifications:", err);
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [lang]);

  // Outside click & Escape key listener
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setNotificationsOpen(false);
      }
    }
    if (notificationsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem("foresite_worker_read_notifs", JSON.stringify(allIds));
    } catch {}
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!readIds.includes(item.id)) {
      const updated = [...readIds, item.id];
      setReadIds(updated);
      try {
        localStorage.setItem("foresite_worker_read_notifs", JSON.stringify(updated));
      } catch {}
    }
    setNotificationsOpen(false);
    router.push(item.link);
  };

  const getTimeAgo = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return lang === "hi" ? "अभी" : "Just now";
      if (mins < 60) return `${mins}${lang === "hi" ? " मि. पहले" : "m ago"}`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}${lang === "hi" ? " घंटे पहले" : "h ago"}`;
      const days = Math.floor(hrs / 24);
      return `${days}${lang === "hi" ? " दिन पहले" : "d ago"}`;
    } catch {
      return "Recent";
    }
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("foresite_theme", next);
  };

  const isHome = pathname === "/worker";
  const isSubmit = pathname === "/worker/submit";
  const isReports = pathname.startsWith("/worker/reports");
  const isProfile = pathname === "/worker/profile";

  const navItems = [
    {
      label: lang === "hi" ? "डैशबोर्ड" : "Dashboard",
      href: "/worker",
      exact: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      label: lang === "hi" ? "रिपोर्ट जमा करें" : "Submit Report",
      href: "/worker/submit",
      exact: false,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
    },
    {
      label: lang === "hi" ? "मेरी रिपोर्ट्स" : "My Reports",
      href: "/worker/reports",
      exact: false,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      label: lang === "hi" ? "प्रोफ़ाइल" : "Profile",
      href: "/worker/profile",
      exact: false,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <div style={s.layoutWrapper}>
      {/* ── Desktop Left Sidebar ───────────────────────────────────── */}
      <aside className="worker-sidebar" style={s.sidebar}>
        {/* Logo */}
        <div style={s.sidebarHeader}>
          <Link href="/worker" style={s.brandWrap}>
            <div style={s.logoBadge}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div style={s.brandTitle}>ForeSite</div>
              <div style={s.brandSubtitle}>Worker Portal</div>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav style={s.sidebarNav}>
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...s.navItem,
                  color: isActive ? "var(--primary)" : "var(--text)",
                  background: isActive ? "var(--primary-light)" : "transparent",
                  fontWeight: isActive ? 700 : 500,
                  borderLeft: isActive ? "4px solid var(--primary)" : "4px solid transparent",
                }}
              >
                <div style={{ color: isActive ? "var(--primary)" : "var(--text-light)" }}>
                  {item.icon}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Illustration */}
        <div style={s.sidebarFooter}>
          <div style={s.citySvgWrap}>
            <svg width="100%" height="40" viewBox="0 0 200 40" fill="none" style={{ opacity: 0.25 }}>
              {/* Industrial facility silhouette: tanks, smokestacks, crane */}
              <rect x="5" y="20" width="20" height="20" rx="10" fill="var(--primary)" />
              <rect x="30" y="10" width="8" height="30" fill="var(--primary)" />
              <rect x="32" y="5" width="4" height="5" fill="var(--primary)" />
              <rect x="45" y="15" width="25" height="25" fill="var(--primary)" />
              <rect x="75" y="22" width="20" height="18" rx="10" fill="var(--primary)" />
              <rect x="100" y="8" width="6" height="32" fill="var(--primary)" />
              <rect x="102" y="3" width="2" height="5" fill="var(--primary)" />
              <rect x="115" y="18" width="30" height="22" fill="var(--primary)" />
              <rect x="150" y="12" width="6" height="28" fill="var(--primary)" />
              <rect x="160" y="25" width="20" height="15" rx="8" fill="var(--primary)" />
              <line x1="152" y1="12" x2="185" y2="5" stroke="var(--primary)" strokeWidth="1.5" />
            </svg>
          </div>
          <div style={s.footerMotto}>Safer Plants. Stronger Workforce.</div>
        </div>
      </aside>

      {/* ── Main Canvas Content ────────────────────────────────────── */}
      <div className="worker-main-canvas" style={s.mainCanvas}>
        {/* Top Header Bar */}
        <header className="apple-glass" style={s.topbar}>
          <div style={s.topbarLeft}>
            {/* Mobile Hamburger toggle */}
            <button
              className="worker-mobile-hamburger apple-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={s.hamburgerBtn}
              aria-label="Toggle Menu"
            >
              <Menu size={20} />
            </button>

            {/* Mobile Brand Title */}
            <div className="worker-mobile-brand" style={s.mobileBrand}>
              <span style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>ForeSite</span>
            </div>

            {/* Desktop Header Subtitle */}
            <div className="worker-desktop-header-title" style={s.desktopHeaderTitle}>
              <span style={s.greetingTitle}>
                {currentUser?.name
                  ? `${lang === "hi" ? "नमस्ते" : "Welcome"}, ${currentUser.name.split(" ")[0]}!`
                  : t.greeting}
              </span>
              <span style={s.greetingSub}>{t.greetingSub}</span>
            </div>
          </div>

          <div style={s.topbarRight}>
            {/* Language Switch Button */}
            <LanguageSwitchButton variant="header" />

            {/* Dark / Light Industrial Theme Switcher */}
            <button
              onClick={toggleTheme}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text)",
              }}
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notification Bell with Dropdown */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                className="apple-btn"
                style={{
                  ...s.iconBtn,
                  backgroundColor: notificationsOpen ? "var(--primary-light)" : "var(--surface)",
                  borderColor: notificationsOpen ? "var(--primary)" : "var(--border)",
                  color: notificationsOpen ? "var(--primary)" : "var(--text)",
                }}
                title={lang === "hi" ? "सूचनाएँ" : "Notifications"}
                aria-label="Notifications"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <Bell size={18} strokeWidth={2.2} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      borderRadius: 999,
                      backgroundColor: "var(--danger, #ef4444)",
                      color: "#ffffff",
                      fontSize: 10,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 0 2px var(--surface)",
                    }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {notificationsOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    width: 380,
                    maxWidth: "calc(100vw - 32px)",
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border)",
                    zIndex: 100,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Dropdown Header */}
                  <div
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "var(--surface-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>
                        {lang === "hi" ? "सूचनाएँ" : "Notifications"}
                      </span>
                      {unreadCount > 0 ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 999,
                            backgroundColor: "var(--danger)",
                            color: "#ffffff",
                          }}
                        >
                          {unreadCount} {lang === "hi" ? "नई" : "new"}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 999,
                            backgroundColor: "var(--surface)",
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {lang === "hi" ? "सब पढ़ा हुआ" : "All read"}
                        </span>
                      )}
                    </div>

                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 8px",
                          borderRadius: 6,
                        }}
                      >
                        <CheckCheck size={14} />
                        <span>{lang === "hi" ? "सभी पढ़ा हुआ करें" : "Mark all read"}</span>
                      </button>
                    )}
                  </div>

                  {/* Dropdown List */}
                  <div
                    style={{
                      maxHeight: 360,
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {notifications.length === 0 ? (
                      <div
                        style={{
                          padding: "36px 20px",
                          textAlign: "center",
                          color: "var(--text-muted)",
                        }}
                      >
                        <Bell size={28} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {lang === "hi" ? "कोई नई सूचना नहीं है" : "No new notifications"}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                          {lang === "hi" ? "आपके सभी सुरक्षा कार्य अद्यतित हैं।" : "You're all caught up on plant safety updates."}
                        </div>
                      </div>
                    ) : (
                      notifications.map((item) => {
                        const isUnread = !readIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            style={{
                              padding: "12px 16px",
                              borderBottom: "1px solid var(--border)",
                              display: "flex",
                              gap: 12,
                              cursor: "pointer",
                              backgroundColor: isUnread ? "rgba(14, 165, 233, 0.04)" : "transparent",
                              transition: "background 0.15s ease",
                              alignItems: "flex-start",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--surface-subtle)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isUnread ? "rgba(14, 165, 233, 0.04)" : "transparent";
                            }}
                          >
                            {/* Icon Avatar */}
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 2,
                                backgroundColor:
                                  item.type === "alert"
                                    ? "rgba(239, 68, 68, 0.12)"
                                    : item.type === "action"
                                    ? "rgba(245, 158, 11, 0.12)"
                                    : item.type === "resolved"
                                    ? "rgba(16, 185, 129, 0.12)"
                                    : item.type === "review"
                                    ? "rgba(59, 130, 246, 0.12)"
                                    : "rgba(99, 102, 241, 0.12)",
                                color:
                                  item.type === "alert"
                                    ? "#ef4444"
                                    : item.type === "action"
                                    ? "#f59e0b"
                                    : item.type === "resolved"
                                    ? "#10b981"
                                    : item.type === "review"
                                    ? "#3b82f6"
                                    : "#6366f1",
                              }}
                            >
                              {item.type === "alert" && <AlertTriangle size={16} />}
                              {item.type === "action" && <Wrench size={16} />}
                              {item.type === "resolved" && <CheckCircle2 size={16} />}
                              {item.type === "review" && <Clock size={16} />}
                              {item.type === "info" && <Info size={16} />}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: isUnread ? 700 : 600,
                                    color: "var(--text)",
                                    lineHeight: 1.2,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {item.title}
                                </span>
                                {isUnread && (
                                  <span
                                    style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: "50%",
                                      backgroundColor: "var(--primary)",
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                              </div>
                              <p
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-muted)",
                                  margin: "0 0 4px 0",
                                  lineHeight: 1.35,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {item.message}
                              </p>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-light)" }}>
                                {item.location && (
                                  <span style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    <MapPin size={11} /> {item.location}
                                  </span>
                                )}
                                <span>·</span>
                                <span>{getTimeAgo(item.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div
                    style={{
                      padding: "10px 16px",
                      borderTop: "1px solid var(--border)",
                      backgroundColor: "var(--surface-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Link
                      href="/worker/reports"
                      onClick={() => setNotificationsOpen(false)}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--primary)",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>{lang === "hi" ? "सभी रिपोर्ट्स देखें" : "View All Incident Reports"}</span>
                      <ExternalLink size={12} />
                    </Link>

                    <button
                      onClick={() => setNotificationsOpen(false)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 11,
                        color: "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      {lang === "hi" ? "बंद करें" : "Dismiss"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Avatar */}
            <Link href="/worker/profile" className="apple-btn" style={s.userAvatarBtn}>
              <div style={s.userAvatar}>
                {currentUser?.name
                  ? currentUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                  : "SW"}
              </div>
              <span className="worker-desktop-username" style={s.userName}>
                {currentUser?.name || (lang === "hi" ? "कार्यकर्ता" : "Worker")}
              </span>
            </Link>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="bottom-nav-safe apple-page-enter" key={pathname} style={s.pageContainer}>
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="worker-mobile-bottom-nav apple-glass" style={s.bottomNav}>
          <div style={s.bottomNavInner}>
            {/* 1. Home / Dashboard Tab */}
            <Link
              href="/worker"
              className="apple-pill"
              style={{
                ...s.bottomNavItem,
                color: isHome ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: isHome ? 700 : 500 }}>
                {lang === "hi" ? "होम" : "Home"}
              </span>
            </Link>

            {/* 2. Floating Report Action Button */}
            <Link href="/worker/submit" className="apple-btn" style={s.centerActionButton} aria-label={t.reportIssue}>
              <div style={s.actionButtonCircle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span style={s.actionButtonLabel}>
                {lang === "hi" ? "रिपोर्ट" : "Report"}
              </span>
            </Link>

            {/* 3. My Reports Tab */}
            <Link
              href="/worker/reports"
              style={{
                ...s.bottomNavItem,
                color: isReports ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: isReports ? 700 : 500 }}>
                {lang === "hi" ? "रिपोर्ट्स" : "Reports"}
              </span>
            </Link>

            {/* 4. Profile Tab */}
            <Link
              href="/worker/profile"
              style={{
                ...s.bottomNavItem,
                color: isProfile ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: isProfile ? 700 : 500 }}>
                {lang === "hi" ? "प्रोफ़ाइल" : "Profile"}
              </span>
            </Link>
          </div>
        </nav>
      </div>

      <style jsx global>{`
        /* Desktop layout rules */
        .worker-sidebar {
          display: flex !important;
        }
        .worker-main-canvas {
          margin-left: 240px;
          width: calc(100% - 240px);
        }
        .worker-mobile-hamburger,
        .worker-mobile-brand,
        .worker-mobile-bottom-nav {
          display: none !important;
        }

        /* Mobile layout rules */
        @media (max-width: 860px) {
          .worker-sidebar {
            display: none !important;
          }
          .worker-main-canvas {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .worker-mobile-hamburger,
          .worker-mobile-brand,
          .worker-mobile-bottom-nav {
            display: flex !important;
          }
          .worker-desktop-header-title,
          .worker-desktop-username {
            display: none !important;
          }
          .bottom-nav-safe {
            padding: 16px 16px 120px 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <WorkerAppContent>{children}</WorkerAppContent>
    </LanguageProvider>
  );
}

const s: Record<string, React.CSSProperties> = {
  layoutWrapper: {
    display: "flex",
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "var(--bg)",
  },
  sidebar: {
    width: 240,
    backgroundColor: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 60,
  },
  sidebarHeader: {
    padding: "20px 20px 16px",
    borderBottom: "1px solid var(--border)",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#0A192F",
    border: "1px solid #1E293B",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontWeight: 800,
    fontSize: 17,
    color: "var(--text)",
    lineHeight: 1.1,
    letterSpacing: "-0.3px",
  },
  brandSubtitle: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontWeight: 600,
    marginTop: 2,
  },
  sidebarNav: {
    flex: 1,
    padding: "20px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    overflowY: "auto",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 14,
    textDecoration: "none",
    transition: "all 0.15s ease",
  },
  sidebarFooter: {
    padding: "16px 20px",
    borderTop: "1px solid var(--border)",
    backgroundColor: "var(--surface-subtle)",
    textAlign: "center",
  },
  citySvgWrap: {
    marginBottom: 6,
  },
  footerMotto: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  mainCanvas: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  topbar: {
    height: 64,
    backgroundColor: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    position: "sticky",
    top: 0,
    zIndex: 40,
    boxShadow: "var(--shadow-sm)",
  },
  topbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  hamburgerBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "1px solid var(--border)",
    backgroundColor: "var(--surface)",
    fontSize: 18,
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  mobileBrand: {
    display: "flex",
    alignItems: "center",
  },
  desktopHeaderTitle: {
    display: "flex",
    flexDirection: "column",
  },
  greetingTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text)",
    lineHeight: 1.2,
  },
  greetingSub: {
    fontSize: 11,
    color: "var(--text-muted)",
  },
  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid var(--border)",
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    cursor: "pointer",
  },
  bellBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: "var(--danger)",
  },
  userAvatarBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    backgroundColor: "var(--primary)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text)",
  },
  pageContainer: {
    flex: 1,
    padding: "24px 28px",
    boxSizing: "border-box",
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 60,
    justifyContent: "center",
    pointerEvents: "none",
  },
  bottomNavInner: {
    pointerEvents: "auto",
    width: "100%",
    height: 64,
    backgroundColor: "var(--surface)",
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    padding: "0 8px calc(env(safe-area-inset-bottom, 0px) + 4px)",
    boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.06)",
  },
  bottomNavItem: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    textDecoration: "none",
    gap: 2,
  },
  centerActionButton: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    transform: "translateY(-10px)",
    gap: 2,
  },
  actionButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    backgroundColor: "var(--primary)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
    border: "3px solid var(--surface)",
  },
  actionButtonLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "var(--primary)",
    letterSpacing: "0.03em",
  },
};
