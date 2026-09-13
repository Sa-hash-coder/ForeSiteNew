"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { translations, Language, Translations } from "./translations";

interface LanguageContextType {
  lang: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  t: translations.en,
  setLanguage: () => {},
  toggleLanguage: () => {},
});

const STORAGE_KEY = "foresite_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("hi"); // Default to Hindi for high accessibility, or saved preference

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved === "en" || saved === "hi") {
      setLangState(saved);
    }

    const handleCustom = (e: any) => {
      if (e.detail === "en" || e.detail === "hi") {
        setLangState(e.detail);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "en" || e.newValue === "hi")) {
        setLangState(e.newValue as Language);
      }
    };

    window.addEventListener("foresite_lang_changed", handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("foresite_lang_changed", handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setLanguage = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("foresite_lang_changed", { detail: newLang }));
    }
  };

  const toggleLanguage = () => {
    const nextLang: Language = lang === "en" ? "hi" : "en";
    setLanguage(nextLang);
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        t: translations[lang],
        setLanguage,
        toggleLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
