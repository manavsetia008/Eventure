"use client";

import { useEffect, useState } from "react";
import GlassyDashboard from "@/components/ui/glassy-dashboard";

const settings = {
  workspaceName: "EVENTURE INTEL",
  panelFrost: 12,
};

function useWorkspaceTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const preferred = matchMedia("(prefers-color-scheme: dark)");

    const update = () => {
      if (html.classList.contains("dark") || html.dataset.theme === "dark") {
        setDark(true);
      } else if (html.classList.contains("light") || html.dataset.theme === "light") {
        setDark(false);
      } else {
        setDark(preferred.matches);
      }
    };

    const changes = new MutationObserver(update);
    changes.observe(html, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    preferred.addEventListener("change", update);
    update();

    return () => {
      changes.disconnect();
      preferred.removeEventListener("change", update);
    };
  }, []);

  return dark;
}

export default function GlassyDashboardDemo(props: Partial<typeof settings> = {}) {
  const s = { ...settings, ...props };
  const dark = useWorkspaceTheme();

  return (
    <>
      <style>{"#root .w-screen:has(.gd-app) { width: 100%; min-width: 0; }"}</style>
      <GlassyDashboard
        workspaceName={s.workspaceName}
        panelFrost={s.panelFrost}
        initialTheme={dark ? "dark" : "light"}
      />
    </>
  );
}
