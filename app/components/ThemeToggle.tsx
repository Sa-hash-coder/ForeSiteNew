"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check local storage on mount (default to clean light industrial theme)
    const savedTheme = localStorage.getItem("foresite_theme") as "light" | "dark" | null;
    const initial = savedTheme || "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("foresite_theme", newTheme);
    window.dispatchEvent(new Event("themechange"));
  };

  return (
    <button
      onClick={toggleTheme}
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        backgroundColor: "var(--surface-subtle)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--text)",
        transition: "all 0.15s ease",
      }}
      title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Moon style={{ width: 18, height: 18, color: "var(--text)" }} />
      ) : (
        <Sun style={{ width: 18, height: 18, color: "#F59E0B" }} />
      )}
    </button>
  );
}
