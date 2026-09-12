"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Activity,
  Wrench,
  Radio,
  Lock,
  CheckCircle2,
  Bell,
  Sun,
  Moon,
  LogOut,
  Search,
  Menu,
  X,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";
import { getStoredUser, logout } from "@/app/lib/auth";

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("desk");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("foresite_theme") as "light" | "dark" | null;
    const initialTheme = saved || "light";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);

    const u = getStoredUser();
    if (u) setCurrentUser(u);

    try {
      const storedRead = localStorage.getItem("foresite_maint_read_notifs");
      if (storedRead) setReadNotifIds(JSON.parse(storedRead));
    } catch {}

    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener("maintenance-tab-change", handleTabChange);
    return () => window.removeEventListener("maintenance-tab-change", handleTabChange);
  }, []);

  // Fetch notifications for maintenance
  useEffect(() => {
    let isMounted = true;
    async function loadMaintNotifs() {
      try {
        const [repRes, altRes] = await Promise.allSettled([
          fetch("/api/reports?limit=15").then((r) => r.json()),
          fetch("/api/alerts").then((r) => r.json()),
        ]);

        const list: any[] = [];

        if (altRes.status === "fulfilled" && altRes.value?.success && Array.isArray(altRes.value.data)) {
          altRes.value.data.forEach((alt: any) => {
            list.push({
              id: `alt_${alt._id || Math.random()}`,
              title: alt.riskLevel === "CRITICAL" ? "CRITICAL SIF ALERT" : "Active Safety Hazard",
              desc: alt.message || alt.reportTitle,
              tab: "orders",
              time: alt.createdAt || new Date().toISOString(),
              type: "alert",
            });
          });
        }

        if (repRes.status === "fulfilled" && repRes.value?.success && Array.isArray(repRes.value.data)) {
          repRes.value.data.forEach((r: any) => {
            if (r.status === "action_assigned") {
              list.push({
                id: `wo_${r._id}`,
                title: "Work Order Pending Action",
                desc: `${r.title} (${r.location || "Refinery"})`,
                tab: "orders",
                time: r.createdAt || new Date().toISOString(),
                type: "order",
              });
            } else if (r.status === "resolved" || r.status === "closed") {
              list.push({
                id: `clr_${r._id}`,
                title: "Clearance Sign-Off Archived",
                desc: `${r.title} - OSHA Sign-Off Completed`,
                tab: "clearance",
                time: r.createdAt || new Date().toISOString(),
                type: "clearance",
              });
            }
          });
        }

        if (isMounted) {
          setNotifications(list);
        }
      } catch (err) {
        console.warn("Maint notif load error:", err);
      }
    }

    loadMaintNotifs();
    const interval = setInterval(loadMaintNotifs, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Outside click & escape handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setNotifOpen(false);
    }
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notifOpen]);

  const unreadMaintCount = notifications.filter((n) => !readNotifIds.includes(n.id)).length;

  const markAllMaintRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotifIds(allIds);
    try {
      localStorage.setItem("foresite_maint_read_notifs", JSON.stringify(allIds));
    } catch {}
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("foresite_theme", nextTheme);
  };

  const isDark = theme === "dark";

  const navItems = [
    { label: "Operations Desk", id: "desk", icon: Activity, tag: "LIVE" },
    { label: "Work Orders Queue", id: "orders", icon: Wrench, count: 4 },
    { label: "Fleet Telemetry", id: "telemetry", icon: Radio, count: 6 },
    { label: "LOTO Safety Permits", id: "loto", icon: Lock, count: 3 },
    { label: "Clearance Sign-Off", id: "clearance", icon: CheckCircle2, tag: "OSHA" },
  ];

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    const event = new CustomEvent("maintenance-tab-change", { detail: id });
    window.dispatchEvent(event);
    setMobileMenuOpen(false);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg)", width: "100%" }}>
      
      {/* ─── 1. FIXED LEFT SIDEBAR (Matching Officer Desk) ────────────── */}
      <aside
        style={{
          width: 250,
          backgroundColor: "var(--surface)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 40,
        }}
        className="maintenance-sidebar"
      >
        {/* Logo & Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: "#0A192F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldCheck style={{ width: 20, height: 20, color: "#ffffff" }} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", lineHeight: 1.1, letterSpacing: "-0.4px" }}>
              ForeSite
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>
              Maintenance Desk
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div style={{ flex: 1, padding: "20px 14px", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.08em", paddingLeft: 12, marginBottom: 6 }}>
            Command Modules
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? "#FFFFFF" : "var(--text)",
                  backgroundColor: isActive ? "#0A192F" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-subtle)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <item.icon style={{ width: 17, height: 17, color: isActive ? "#FFFFFF" : "#0F172A" }} />
                  <span>{item.label}</span>
                </div>
                {item.count && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "1px 7px",
                      borderRadius: 10,
                      backgroundColor: isActive ? "rgba(255, 255, 255, 0.2)" : "var(--surface-subtle)",
                      color: isActive ? "#FFFFFF" : "#0F172A",
                      border: isActive ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {item.count}
                  </span>
                )}
                {item.tag && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: 4,
                      backgroundColor: isActive ? "rgba(255, 255, 255, 0.25)" : "#FEF2F2",
                      color: isActive ? "#FFFFFF" : "#DC2626",
                      border: isActive ? "none" : "1px solid #FECACA",
                    }}
                  >
                    {item.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", backgroundColor: "var(--surface-subtle)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>Unit M-4 Shift A · Lead</div>
          <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>ISO 45001 &amp; OSHA 1910 Verified</div>
        </div>
      </aside>

      {/* ─── 2. MAIN CANVAS WRAPPER ───────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 250, display: "flex", flexDirection: "column", minHeight: "100vh", width: "calc(100% - 250px)" }} className="maintenance-main">
        
        {/* Top Sticky Header */}
        <header
          style={{
            height: 64,
            backgroundColor: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          {/* Mobile Menu Toggle & Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="maintenance-mobile-btn"
              style={{
                display: "none",
                background: "none",
                border: "none",
                color: "var(--text)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, backgroundColor: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}>
                PLANT SECTOR 4
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--success)", display: "inline-block" }} />
                Modbus Telemetry Online
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Dark/Light Toggle */}
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
              title="Toggle Theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Notification Bell with Dropdown */}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: notifOpen ? "var(--primary-light)" : "var(--surface-subtle)",
                  border: "1px solid " + (notifOpen ? "var(--primary)" : "var(--border)"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: notifOpen ? "var(--primary)" : "var(--text)",
                  position: "relative",
                }}
                title="Operations Alerts & Notifications"
              >
                <Bell size={16} />
                {unreadMaintCount > 0 && (
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
                    {unreadMaintCount > 9 ? "9+" : unreadMaintCount}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {notifOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    width: 360,
                    maxWidth: "calc(100vw - 32px)",
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border)",
                    zIndex: 100,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "var(--surface-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>
                        Maintenance Alerts
                      </span>
                      {unreadMaintCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 999,
                            backgroundColor: "var(--danger)",
                            color: "#ffffff",
                          }}
                        >
                          {unreadMaintCount} new
                        </span>
                      )}
                    </div>
                    {unreadMaintCount > 0 && (
                      <button
                        onClick={markAllMaintRead}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--primary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <CheckCheck size={13} />
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                        No pending work order alerts.
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const isUnread = !readNotifIds.includes(n.id);
                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (isUnread) {
                                const next = [...readNotifIds, n.id];
                                setReadNotifIds(next);
                                try {
                                  localStorage.setItem("foresite_maint_read_notifs", JSON.stringify(next));
                                } catch {}
                              }
                              handleTabClick(n.tab);
                              setNotifOpen(false);
                            }}
                            style={{
                              padding: "11px 14px",
                              borderBottom: "1px solid var(--border)",
                              display: "flex",
                              gap: 10,
                              cursor: "pointer",
                              backgroundColor: isUnread ? "rgba(14, 165, 233, 0.05)" : "transparent",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--surface-subtle)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isUnread ? "rgba(14, 165, 233, 0.05)" : "transparent";
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                backgroundColor:
                                  n.type === "alert"
                                    ? "rgba(239, 68, 68, 0.12)"
                                    : n.type === "order"
                                    ? "rgba(245, 158, 11, 0.12)"
                                    : "rgba(16, 185, 129, 0.12)",
                                color:
                                  n.type === "alert"
                                    ? "#ef4444"
                                    : n.type === "order"
                                    ? "#f59e0b"
                                    : "#10b981",
                              }}
                            >
                              {n.type === "alert" && <AlertTriangle size={14} />}
                              {n.type === "order" && <Wrench size={14} />}
                              {n.type === "clearance" && <CheckCircle2 size={14} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                                  {n.title}
                                </div>
                                {isUnread && (
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--primary)" }} />
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {n.desc}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div
                    style={{
                      padding: "8px 14px",
                      borderTop: "1px solid var(--border)",
                      backgroundColor: "var(--surface-subtle)",
                      textAlign: "right",
                    }}
                  >
                    <button
                      onClick={() => setNotifOpen(false)}
                      style={{ background: "none", border: "none", fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8, borderLeft: "1px solid var(--border)" }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  backgroundColor: "var(--primary)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {currentUser?.name
                  ? currentUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                  : "MT"}
              </div>
              <div className="maintenance-tech-info">
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", lineHeight: 1.1 }}>
                  {currentUser?.name || "Maintenance Tech"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-light)" }}>
                  {currentUser?.role === "maintenance" ? "Lead Reliability Tech" : (currentUser?.role || "Reliability Tech")}
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  window.location.href = "/";
                }}
                title="Sign Out"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "4px 6px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 4,
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Children / Content */}
        <main style={{ flex: 1, padding: "28px" }}>
          {children}
        </main>

      </div>

      {/* Responsive Style */}
      <style jsx global>{`
        @media (max-width: 900px) {
          .maintenance-sidebar {
            display: ${mobileMenuOpen ? "flex" : "none"} !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          }
          .maintenance-main {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .maintenance-mobile-btn {
            display: block !important;
          }
          .maintenance-tech-info {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
