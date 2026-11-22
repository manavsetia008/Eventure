import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth.jsx";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "./languages";

const LanguageContext = createContext(null);
const STORAGE_KEY = "eventure_language";
const CACHE_KEY = "eventure_ui_translation_cache_v1";
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"];

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function shouldSkip(element) {
  if (!element) return true;
  return Boolean(
    element.closest(
      [
        "[data-no-translate]",
        "[contenteditable='true']",
        "script",
        "style",
        "noscript",
        "textarea",
        "input",
        "select",
        "option",
        "code",
        "pre",
        "svg",
        ".map",
        ".map-embed",
        ".user-generated-content",
      ].join(",")
    )
  );
}

function shouldSkipAttributeTranslation(element) {
  if (!element) return true;
  return Boolean(
    element.closest(
      [
        "[data-no-translate]",
        "[contenteditable='true']",
        "script",
        "style",
        "noscript",
        "select",
        "option",
        "code",
        "pre",
        "svg",
        ".map",
        ".map-embed",
        ".user-generated-content",
      ].join(",")
    )
  );
}

function hasReadableText(value) {
  return Boolean(value && value.trim() && /[\p{L}]/u.test(value));
}

export function LanguageProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.some((item) => item.code === saved)
      ? saved
      : DEFAULT_LANGUAGE;
  });
  const [languageStatus, setLanguageStatus] = useState("");
  const textRecords = useRef(new Map());
  const attributeRecords = useRef(new Map());
  const cache = useRef(readCache());
  const failedLanguages = useRef(new Set());
  const languageRef = useRef(language);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // An account preference takes priority after login/profile hydration.
  useEffect(() => {
    const preferred = user?.primary_language;
    if (preferred && SUPPORTED_LANGUAGES.some((item) => item.code === preferred)) {
      setLanguageState(preferred);
      localStorage.setItem(STORAGE_KEY, preferred);
    }
  }, [user?.primary_language]);

  const setLanguage = useCallback(async (nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.some((item) => item.code === nextLanguage)) return;
    failedLanguages.current.delete(nextLanguage);
    setLanguageState(nextLanguage);
    localStorage.setItem(STORAGE_KEY, nextLanguage);
    setLanguageStatus(nextLanguage === DEFAULT_LANGUAGE ? "" : "Changing language…");

    if (user) {
      try {
        const response = await api.patch("/auth/me", { primary_language: nextLanguage });
        if (response.user) updateUser(response.user);
      } catch (error) {
        setLanguageStatus(`Language is selected on this device, but account sync failed: ${error.message}`);
      }
    }
  }, [user, updateUser]);

  // Translate visible interface text in small batches. Original strings are kept
  // in memory so changing language never translates a previous translation.
  useEffect(() => {
    const currentLanguage = language;
    const pending = [];
    let timer = null;
    let cancelled = false;
    const observerRecords = textRecords.current;
    const attrRecords = attributeRecords.current;

    document.documentElement.lang = currentLanguage === "en" ? "en" : currentLanguage;

    for (const [node, record] of observerRecords) {
      if (!node.isConnected) {
        observerRecords.delete(node);
        continue;
      }
      if (record.translated != null && node.nodeValue === record.translated) {
        node.nodeValue = record.original;
      }
      record.translated = null;
      record.language = null;
    }

    for (const [element, records] of attrRecords) {
      if (!element.isConnected) {
        attrRecords.delete(element);
        continue;
      }
      for (const [attribute, record] of records) {
        if (record.translated != null && element.getAttribute(attribute) === record.translated) {
          element.setAttribute(attribute, record.original);
        }
        record.translated = null;
        record.language = null;
      }
    }

    if (currentLanguage === DEFAULT_LANGUAGE) {
      setLanguageStatus("");
      return () => {
        if (timer) window.clearTimeout(timer);
      };
    }

    if (failedLanguages.current.has(currentLanguage)) {
      setLanguageStatus("Translation is unavailable. Check the Sarvam API key in Render.");
    } else {
      setLanguageStatus("Translating interface…");
    }

    const cacheKey = (text) => `${currentLanguage}::${text}`;

    const queueValue = (entry) => {
      if (!hasReadableText(entry.original)) return;
      const key = cacheKey(entry.original);
      const cached = cache.current[key];
      if (cached) {
        applyTranslation(entry, cached);
        return;
      }
      pending.push(entry);
      if (!timer) {
        timer = window.setTimeout(flush, 120);
      }
    };

    const applyTranslation = (entry, translated) => {
      if (cancelled || languageRef.current !== currentLanguage || !translated) return;
      if (entry.kind === "text") {
        if (!entry.node.isConnected) return;
        if (entry.node.nodeValue !== entry.original) return;
        entry.node.nodeValue = translated;
        entry.record.translated = translated;
        entry.record.language = currentLanguage;
      } else {
        if (!entry.element.isConnected) return;
        if (entry.element.getAttribute(entry.attribute) !== entry.original) return;
        entry.element.setAttribute(entry.attribute, translated);
        entry.record.translated = translated;
        entry.record.language = currentLanguage;
      }
    };

    const flush = async () => {
      timer = null;
      if (cancelled || failedLanguages.current.has(currentLanguage)) return;
      while (pending.length && !cancelled && languageRef.current === currentLanguage) {
        const group = pending.splice(0, 18);
        try {
          const result = await api.post("/translate/ui", {
            target_language: currentLanguage,
            texts: group.map((entry) => entry.original),
          });
          if (cancelled || languageRef.current !== currentLanguage) return;
          const translations = result.translations || [];
          group.forEach((entry, index) => {
            const translated = translations[index] || entry.original;
            cache.current[cacheKey(entry.original)] = translated;
            applyTranslation(entry, translated);
          });
          const keys = Object.keys(cache.current);
          if (keys.length > 700) {
            cache.current = Object.fromEntries(keys.slice(-500).map((key) => [key, cache.current[key]]));
          }
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache.current));
          setLanguageStatus(`Interface language: ${SUPPORTED_LANGUAGES.find((item) => item.code === currentLanguage)?.name || currentLanguage}`);
        } catch (error) {
          failedLanguages.current.add(currentLanguage);
          pending.length = 0;
          setLanguageStatus(
            error.message?.includes("SARVAM_API_KEY")
              ? "Add SARVAM_API_KEY in Render to translate the entire site."
              : `Translation failed: ${error.message}`
          );
          return;
        }
      }
    };

    const processTextNode = (node) => {
      const element = node.parentElement;
      if (!element || shouldSkip(element)) return;
      const value = node.nodeValue || "";
      if (!hasReadableText(value)) return;
      let record = observerRecords.get(node);
      if (!record) {
        record = { original: value, translated: null, language: null };
        observerRecords.set(node, record);
      } else if (record.translated != null && value !== record.translated && value !== record.original) {
        record.original = value;
        record.translated = null;
      } else if (record.translated == null && value !== record.original) {
        record.original = value;
      }
      if (record.language === currentLanguage && record.translated === value) return;
      if (record.translated != null && value !== record.translated) record.translated = null;
      queueValue({ kind: "text", node, record, original: record.original });
    };

    const processElement = (element) => {
      if (!element || element.nodeType !== Node.ELEMENT_NODE || shouldSkipAttributeTranslation(element)) return;
      let records = attrRecords.get(element);
      if (!records) {
        records = new Map();
        attrRecords.set(element, records);
      }
      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const value = element.getAttribute(attribute);
        if (!hasReadableText(value)) continue;
        let record = records.get(attribute);
        if (!record) {
          record = { original: value, translated: null, language: null };
          records.set(attribute, record);
        } else if (record.translated != null && value !== record.translated && value !== record.original) {
          record.original = value;
          record.translated = null;
        } else if (record.translated == null && value !== record.original) {
          record.original = value;
        }
        if (record.language === currentLanguage && record.translated === value) continue;
        queueValue({ kind: "attribute", element, attribute, record, original: record.original });
      }
    };

    const scan = (root) => {
      if (cancelled || !root) return;
      if (root.nodeType === Node.TEXT_NODE) {
        processTextNode(root);
        return;
      }
      if (root.nodeType === Node.ELEMENT_NODE) processElement(root);
      const treeRoot = root.nodeType === Node.DOCUMENT_NODE ? root.body : root;
      if (!treeRoot?.ownerDocument && treeRoot !== document.body) return;
      const walker = document.createTreeWalker(treeRoot, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) processTextNode(node);
      if (treeRoot.querySelectorAll) {
        treeRoot.querySelectorAll("[placeholder], [title], [aria-label]").forEach(processElement);
      }
    };

    scan(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") processTextNode(mutation.target);
        if (mutation.type === "attributes") processElement(mutation.target);
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(scan);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    languageStatus,
    languages: SUPPORTED_LANGUAGES,
  }), [language, setLanguage, languageStatus]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider.");
  return context;
}

export function LanguageSwitcher({ floating = false }) {
  const { language, setLanguage, languageStatus, languages } = useLanguage();
  return (
    <div className={`language-switcher-wrap ${floating ? "language-switcher-floating" : ""}`}>
      <label className="language-switcher" title="Change Eventure's language">
        <span aria-hidden="true">文</span>
        <select
          data-no-translate="true"
          aria-label="Site language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {languages.map((item) => (
            <option key={item.code} value={item.code}>{item.label}</option>
          ))}
        </select>
      </label>
      {languageStatus && <span className="language-status" role="status">{languageStatus}</span>}
    </div>
  );
}
