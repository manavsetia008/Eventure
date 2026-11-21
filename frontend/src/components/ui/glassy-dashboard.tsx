"use client";

import { useId, useState, type CSSProperties, type ReactNode, useEffect, useRef, type MouseEvent } from "react";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Box, CircleDollarSign, Clock3, Download, Ellipsis, Eye, Filter, ListChecks, Search, ShieldCheck, ShoppingBag, TriangleAlert, Users, Zap, ArrowDownToLine, BarChart3, Bell, BriefcaseBusiness, ChevronRight, Command, LayoutDashboard, Moon, Sun, TrendingUp, X } from "lucide-react";

import { useGSAP } from "@gsap/react";

import { gsap } from "gsap";

import "@fontsource-variable/manrope";



/** A spatial analytics workspace with four views, sample records, and local CSV export.

 * Pass a background image and credit to use your own scene. Use panelFrost (0–36px)

 * for the main glass and initialTheme for the initial palette. All data stays in the browser. */

export interface GlassyDashboardProps {
  backgroundImage?: string;
  backgroundCredit?: { label: string; href: string };
  workspaceName?: string;
  panelFrost?: number;
  initialTheme?: "light" | "dark";
}

const studioPhoto = "https://cdn.21st.dev/assets/mirror/ea/ea9270b3b7246283219ac52fa77a1213e9d1efb285d76348d3620609ba6cefa7.jpg";

const dashboardStyles = `
.gd-app {
  --gd-ink: #25201e;
  --gd-muted: #423731;
  --gd-line: rgb(74 49 33 / 15%);
  --gd-grid: rgb(74 49 33 / 19%);
  --gd-rim: rgb(255 253 246 / 51%);
  --gd-edge-light: rgb(255 254 247 / 84%);
  --gd-edge-shade: rgb(57 40 28 / 19%);
  --gd-gloss: rgb(255 251 242 / 45%);
  --gd-frame: rgb(247 234 219 / 23%);
  --gd-rail: rgb(241 222 206 / 48%);
  --gd-card: rgb(250 242 232 / 46%);
  --gd-card-light: rgb(255 251 245 / 34%);
  --gd-raised: rgb(255 249 243 / 81%);
  --gd-inner: rgb(255 250 245 / 37%);
  --gd-surface: #f6ece2;
  --gd-track: rgb(81 49 32 / 14%);
  --gd-primary: #261e1b;
  --gd-primary-ink: #fffaf5;
  --gd-pick: #fff9f3;
  --gd-pick-ink: #241b17;
  --gd-coral: #a43c27;
  --gd-teal: #09644f;
  --gd-ochre: #996300;
  --gd-graph-ink: #40332d;
  --gd-focus: #194b48;
  --gd-dark-shadow: 35 21 14;
  inline-size: 100%;
  min-inline-size: 0;
  flex: 1 1 100%;
  position: relative;
  isolation: isolate;
  min-block-size: 100svh;
  background: #ab8e76;
  color: var(--gd-ink);
  color-scheme: light;
  font-family: "Manrope Variable", Manrope, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}
.gd-app[data-theme="dark"] {
  --gd-ink: #fff6e9;
  --gd-muted: #e5d5c7;
  --gd-line: rgb(243 221 198 / 19%);
  --gd-grid: rgb(243 221 198 / 19%);
  --gd-rim: rgb(255 236 212 / 31%);
  --gd-edge-light: rgb(255 242 225 / 49%);
  --gd-edge-shade: rgb(11 6 5 / 30%);
  --gd-gloss: rgb(255 237 213 / 13%);
  --gd-frame: rgb(42 31 29 / 52%);
  --gd-rail: rgb(45 32 30 / 59%);
  --gd-card: rgb(47 36 34 / 53%);
  --gd-card-light: rgb(106 88 81 / 30%);
  --gd-raised: rgb(80 67 61 / 82%);
  --gd-inner: rgb(78 61 56 / 49%);
  --gd-surface: #3b302c;
  --gd-track: rgb(245 226 212 / 16%);
  --gd-primary: #f3ddca;
  --gd-primary-ink: #231a16;
  --gd-pick: #f9eee0;
  --gd-pick-ink: #241b17;
  --gd-coral: #ff9177;
  --gd-teal: #75dac0;
  --gd-ochre: #f1be58;
  --gd-graph-ink: #e7d9cd;
  --gd-focus: #f9bf9b;
  --gd-dark-shadow: 10 4 3;
  background: #40322b;
  color-scheme: dark;
}

.gd-app *, .gd-app *::before, .gd-app *::after { box-sizing: border-box; }
.gd-app :where(button, input, select) { color: inherit; font: inherit; }
.gd-app :where(button, a, input, select):focus-visible { outline: 2px solid var(--gd-focus); outline-offset: 3px; }
.gd-app a { color: inherit; text-decoration: none; }
.gd-app button { cursor: pointer; }
.gd-app :where(h1, h2, h3, p, figure) { margin: 0; }
.gd-app svg { flex: none; }
.gd-sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

.gd-background, .gd-app::before {
  position: fixed;
  z-index: -2;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  pointer-events: none;
}
.gd-background {
  object-fit: cover;
  object-position: center 60%;
  filter: sepia(.22) saturate(.78) brightness(.86);
}
.gd-app::before {
  content: "";
  z-index: -1;
  background: linear-gradient(116deg, rgb(73 48 37 / 35%), transparent 43%, rgb(162 101 63 / 24%) 76%, transparent 100%),
    linear-gradient(0deg, rgb(53 33 25 / 34%), transparent 58%);
}
.gd-app[data-theme="dark"] .gd-background { filter: sepia(.15) saturate(.75) brightness(.61); }
.gd-surround {
  inline-size: min(calc(100% - 100px), 1380px);
  margin-inline: auto;
  padding-block: 24px 8px;
}
.gd-top, .gd-dock {
  border: 1px solid var(--gd-rim);
  background: linear-gradient(165deg, var(--gd-gloss), transparent 32% 73%, var(--gd-gloss)), var(--gd-rail);
  box-shadow: inset 1px 1px 1px var(--gd-edge-light), inset -1px -1px 1px var(--gd-edge-shade),
    inset 0 -2px 5px var(--gd-gloss), 0 7px 20px rgb(var(--gd-dark-shadow) / 17%);
  backdrop-filter: blur(15px) saturate(1.35);
  -webkit-backdrop-filter: blur(15px) saturate(1.35);
}
.gd-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 400px) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-block-size: 60px;
  border-radius: 999px;
  padding: 6px 9px 6px 13px;
}
.gd-brand { display: flex; align-items: center; gap: 10px; min-inline-size: 0; padding-inline-start: 3px; }
.gd-logo {
  inline-size: 35px; block-size: 35px; display: grid; place-items: center;
  border-radius: 50%; background: var(--gd-pick); color: var(--gd-pick-ink);
  box-shadow: inset 0 0 0 1px var(--gd-gloss), 0 2px 7px rgb(var(--gd-dark-shadow) / 12%);
}
.gd-logo svg { width: 22px; height: 22px; }
.gd-brand strong { display: block; font-size: 12px; letter-spacing: .17em; line-height: 1.1; font-weight: 850; }
.gd-brand small { display: block; margin-block-start: 3px; font-size: 10px; color: var(--gd-muted); }
.gd-ask {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-block-size: 43px;
  max-inline-size: 100%;
  border: 1px solid var(--gd-line);
  border-radius: 999px;
  background: var(--gd-inner);
  box-shadow: inset 0 1px 0 var(--gd-gloss);
  padding: 4px 13px 4px 9px;
  text-align: start;
}
.gd-ask:hover, .gd-icon-button:hover { background: var(--gd-raised); }
.gd-orb {
  flex: none;
  inline-size: 25px;
  block-size: 25px;
  border-radius: 50%;
  background:
    radial-gradient(ellipse at 32% 24%, #faf7fe 5%, #72ecf1 25%, transparent 58%),
    radial-gradient(ellipse at 67% 54%, #e1b7f9, #815add 55%, #353467 79%);
  box-shadow: inset 0 0 0 .75px rgb(246 245 255 / 75%), inset 0 -2px 5px #604db4, 0 0 0 3px rgb(91 70 115 / 13%), 0 2px 8px rgb(71 46 113 / 35%);
}
.gd-prompt {
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  font-size: 12px; font-weight: 750;
  animation: gd-prompt-in .74s steps(28, end) both;
}
@keyframes gd-prompt-in { from { clip-path: inset(0 100% 0 0); } }
.gd-ask-search { margin-inline-start: auto; width: 15px; height: 15px; color: var(--gd-muted); }
.gd-top-actions { display: flex; justify-content: flex-end; gap: 6px; }
.gd-icon-button {
  position: relative; min-inline-size: 44px; min-block-size: 44px; display: inline-grid; place-items: center;
  border-radius: 999px; border: 1px solid var(--gd-line); padding: 0; background: var(--gd-inner);
}
.gd-icon-button svg { width: 17px; height: 17px; stroke-width: 1.75; }
.gd-notices { background: var(--gd-raised); }
.gd-notices i {
  position: absolute; block-size: 6px; inline-size: 6px; inset: 9px 9px auto auto; border-radius: 50%;
  background: var(--gd-coral); box-shadow: 0 0 0 2px var(--gd-surface);
}

.gd-stage-wrap { position: relative; margin-block: 11px 0; }
.gd-stage {
  color: var(--gd-ink);
  border: 1px solid var(--gd-rim);
  border-radius: 34px;
  background:
    linear-gradient(148deg, var(--gd-gloss), transparent 19% 77%, color-mix(in srgb, var(--gd-gloss) 48%, transparent)),
    var(--gd-frame);
  box-shadow: inset 1px 1px 1px var(--gd-edge-light), inset -1px -1px 1px var(--gd-edge-shade),
    inset 0 0 7px var(--gd-gloss),
    0 1px 3px rgb(var(--gd-dark-shadow) / 17%), 0 22px 72px rgb(var(--gd-dark-shadow) / 22%);
  backdrop-filter: blur(var(--gd-panel-frost, 12px)) saturate(1.24);
  -webkit-backdrop-filter: blur(var(--gd-panel-frost, 12px)) saturate(1.24);
}
.gd-stage-scroll {
  block-size: max(605px, min(865px, calc(100svh - 165px)));
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--gd-line) transparent;
  border-radius: inherit;
  padding: clamp(19px, 2.15vw, 35px) clamp(25px, 3.2vw, 49px) 41px;
}
.gd-view-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px 22px;
  margin-block-end: 19px;
}
.gd-view-head h1 {
  font-size: clamp(29px, 3.35vw, 49px);
  font-weight: 760;
  line-height: 1.03;
  letter-spacing: -.062em;
}
.gd-view-head p { color: var(--gd-muted); font-size: 13px; margin-block-start: 8px; }
.gd-view-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
.gd-period {
  display: inline-flex; align-items: center; padding: 3px; border-radius: 999px;
  border: 1px solid var(--gd-rim); background: var(--gd-inner);
  box-shadow: inset 0 1px 0 var(--gd-gloss);
}
.gd-period button {
  min-block-size: 35px; min-inline-size: 56px; border: 0; border-radius: 999px; background: transparent;
  padding: 0 11px; font-size: 11px; font-weight: 750; white-space: nowrap;
}
.gd-period button[aria-pressed="true"] { background: var(--gd-primary); color: var(--gd-primary-ink); }
.gd-period button[aria-pressed="false"]:hover { background: var(--gd-inner); }

.gd-primary, .gd-secondary {
  display: inline-flex; justify-content: center; align-items: center; gap: 7px;
  min-block-size: 40px; padding: 7px 12px;
  font-size: 11.5px; font-weight: 790; line-height: 1.2; border-radius: 999px;
  border: 1px solid transparent;
}
.gd-primary { background: var(--gd-primary); color: var(--gd-primary-ink); }
.gd-secondary { background: var(--gd-raised); border-color: var(--gd-rim); color: var(--gd-ink); }
.gd-primary:hover { filter: brightness(1.17); }
.gd-secondary:hover { background: var(--gd-surface); }
.gd-primary svg, .gd-secondary svg { width: 14px; height: 14px; }
.gd-export { white-space: nowrap; }
.gd-content { min-inline-size: 0; }
.gd-analytics, .gd-command-grid, .gd-command-side, .gd-summary, .gd-metric-grid, .gd-analytics-grid { display: grid; gap: 12px; }
.gd-command-grid { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr) minmax(0, 1.05fr); align-items: stretch; }
.gd-command-side { grid-column: 1; align-content: start; }
.gd-command-grid > .gd-activity { grid-column: 2 / -1; }
.gd-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding: 6px; }
.gd-analytics-grid { grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr); }
.gd-metric-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.gd-panel, .gd-metric, .gd-summary {
  min-inline-size: 0;
  border: 1px solid var(--gd-rim);
  border-radius: 20px;
  background: linear-gradient(144deg, var(--gd-card-light), transparent 66%), var(--gd-card);
  box-shadow: inset 0 1px 1px var(--gd-edge-light), inset 0 -1px 1px var(--gd-edge-shade), 0 6px 18px rgb(var(--gd-dark-shadow) / 9%);
}
.gd-summary { border-radius: 20px; background: var(--gd-inner); }
.gd-summary .gd-metric { border-radius: 15px; }
.gd-panel { padding: 15px 16px; }
.gd-panel-head {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start;
  gap: 7px 12px; margin-block-end: 12px;
}
.gd-panel-head h2 { font-size: 14px; font-weight: 810; letter-spacing: -.024em; }
.gd-panel-head p { font-size: 11px; color: var(--gd-muted); margin-block-start: 3px; }
.gd-metric { display: flex; flex-direction: column; justify-content: space-between; min-block-size: 112px; padding: 11px 12px; }
.gd-metric[data-tone="teal"] {
  --gd-coral: #ffc8b8;
  --gd-teal: #b8f1dd;
  --gd-muted: #e4f5ef;
  color: #fff;
  border-color: rgb(196 248 231 / 55%);
  background: radial-gradient(ellipse at 5% -20%, #3a9381, transparent 68%), linear-gradient(145deg, #1e7461, #08443a);
  box-shadow: inset 0 1px 2px rgb(214 252 240 / 45%), 0 6px 14px rgb(19 78 64 / 17%);
}
.gd-metric-head { display: flex; justify-content: space-between; align-items: center; gap: 4px; min-inline-size: 0; font-size: 11px; font-weight: 740; }
.gd-metric-icon, .gd-list-icon {
  display: grid; place-items: center; flex: none; color: inherit;
  inline-size: 28px; block-size: 28px; border-radius: 10px;
  background: var(--gd-inner); box-shadow: inset 0 1px 0 var(--gd-gloss);
}
.gd-metric-icon svg, .gd-list-icon svg { width: 14px; height: 14px; }
.gd-metric[data-tone="teal"] .gd-metric-icon { background: rgb(235 255 247 / 16%); }
.gd-metric-value { display: block; font-size: clamp(22px, 2.35vw, 35px); line-height: 1.05; margin-block: 3px 7px; letter-spacing: -.052em; font-weight: 815; }
.gd-summary .gd-metric-value { font-size: clamp(20px, 2vw, 31px); }
.gd-metric-caption, .gd-balance-change { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; color: var(--gd-muted); font-size: 10px; font-weight: 680; }
.gd-delta {
  display: inline-flex; align-items: center; gap: 2px; color: var(--gd-teal); font-weight: 850;
  border-radius: 6px; padding: 2px 4px;
  background: color-mix(in srgb, var(--gd-teal) 12%, transparent);
}
.gd-delta[data-attention="true"] { color: var(--gd-coral); background: color-mix(in srgb, var(--gd-coral) 11%, transparent); }
.gd-delta svg { width: 11px; height: 11px; stroke-width: 2.4; }

.gd-balance .gd-panel-head { align-items: center; margin-block-end: 9px; }
.gd-unit { border-radius: 6px; padding: 4px 6px; background: var(--gd-raised); font-size: 10px; font-weight: 810; }
.gd-balance-number { font-size: clamp(28px, 3.85vw, 57px); font-weight: 820; letter-spacing: -.077em; line-height: 1.02; }
.gd-balance-change { margin-block-start: 7px; }
.gd-balance-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-block: 13px 12px; }
.gd-streams { display: flex; border-radius: 12px; background: var(--gd-inner); padding: 8px 2px; }
.gd-streams div { flex: 1; min-inline-size: 0; padding: 0 7px; }
.gd-streams div + div { border-inline-start: 1px solid var(--gd-line); }
.gd-streams span, .gd-streams strong { display: block; }
.gd-streams span { font-size: 9px; color: var(--gd-muted); }
.gd-streams strong { font-size: 11px; font-weight: 810; margin-block-start: 4px; }
.gd-capacity .gd-panel-head, .gd-approvals .gd-panel-head { margin-block-end: 10px; }
.gd-capacity-track, .gd-mix-track { display: block; height: 7px; border-radius: 999px; overflow: hidden; background: var(--gd-track); }
.gd-capacity-track .gd-fill { display: block; block-size: 100%; border-radius: inherit; background: var(--gd-teal); transform-origin: left center; }
.gd-capacity-label { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; color: var(--gd-muted); font-size: 10px; margin-top: 8px; }
.gd-capacity-label strong { color: var(--gd-ink); }
.gd-approval-content { display: flex; align-items: center; gap: 9px; min-inline-size: 0; }
.gd-approval-content .gd-list-icon { inline-size: 37px; block-size: 37px; color: var(--gd-teal); background: color-mix(in srgb, var(--gd-teal) 12%, var(--gd-inner)); }
.gd-approval-content div { flex: 1; min-inline-size: 0; }
.gd-approval-content strong, .gd-approval-content small { display: block; }
.gd-approval-content strong { font-size: 12px; font-weight: 810; }
.gd-approval-content small { margin-top: 4px; font-size: 10px; color: var(--gd-muted); }
.gd-statement .gd-panel-head { margin-block-end: 8px; }

.gd-table-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; max-inline-size: 100%; }
.gd-search, .gd-filter {
  display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--gd-line); border-radius: 10px;
  background: var(--gd-inner); min-block-size: 35px; padding: 0 8px;
}
.gd-search svg, .gd-filter svg { width: 13px; height: 13px; color: var(--gd-muted); }
.gd-search input { width: 105px; flex: 1; min-inline-size: 0; border: 0; background: transparent; min-block-size: 33px; }
.gd-search input::placeholder { color: var(--gd-muted); opacity: 1; }
.gd-search input, .gd-filter select { font-size: 11px; }
.gd-filter select { border: 0; background: transparent; padding: 5px 0; min-inline-size: 0; }
.gd-filter select option { color: var(--gd-ink); background: var(--gd-surface); }
.gd-search:focus-within, .gd-filter:focus-within { outline: 2px solid var(--gd-focus); }
.gd-app .gd-search input:focus-visible, .gd-app .gd-filter select:focus-visible { outline: none; }
.gd-table-scroll { max-inline-size: 100%; overflow: auto; scrollbar-width: thin; }
.gd-table-scroll table { inline-size: 100%; border-spacing: 0; text-align: start; }
.gd-table-scroll th, .gd-table-scroll td { padding: 9px 10px; text-align: start; }
.gd-table-scroll th { background: var(--gd-inner); font-size: 10px; color: var(--gd-muted); font-weight: 800; }
.gd-table-scroll th:first-child { border-radius: 8px 0 0 8px; }
.gd-table-scroll th:last-child { border-radius: 0 8px 8px 0; }
.gd-table-scroll td { white-space: nowrap; font-size: 11px; }
.gd-table-scroll td:first-child { font-weight: 750; }
.gd-table-scroll tr + tr td { border-top: 1px solid var(--gd-line); }
.gd-status {
  --gd-status-color: var(--gd-graph-ink);
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 6px; border-radius: 999px; font-size: 10px; font-weight: 790;
  background: color-mix(in srgb, var(--gd-status-color) 11%, var(--gd-inner));
  color: var(--gd-status-color); white-space: nowrap;
}
.gd-status[data-state="teal"] { --gd-status-color: var(--gd-teal); }
.gd-status[data-state="coral"] { --gd-status-color: var(--gd-coral); }
.gd-status i { inline-size: 5px; block-size: 5px; border-radius: 50%; background: currentColor; }
.gd-empty { padding: 12px 3px; color: var(--gd-muted); font-size: 12px; }

.gd-app [data-tone="ink"] { --gd-series: var(--gd-graph-ink); }
.gd-app [data-tone="coral"] { --gd-series: var(--gd-coral); }
.gd-app [data-tone="teal"] { --gd-series: var(--gd-teal); }
.gd-app [data-tone="ochre"] { --gd-series: var(--gd-ochre); }
.gd-legend { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; color: var(--gd-muted); }
.gd-legend span, .gd-device-list button span:first-child { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 740; }
.gd-legend i, .gd-device-list button span:first-child i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--gd-series); }
.gd-stack-meta { display: flex; justify-content: space-between; align-items: center; height: 20px; gap: 4px; }
.gd-chart-readout { font-size: 10px; font-weight: 830; white-space: nowrap; }
.gd-stack-plot { display: grid; grid-template-columns: repeat(var(--gd-series-count), minmax(0, 1fr)); gap: 4px; block-size: 194px; margin-top: 5px; }
.gd-command-chart .gd-stack-plot { block-size: 141px; }
.gd-stack-column { display: flex; flex-direction: column; align-items: center; min-inline-size: 0; border: 0; border-radius: 8px; background: transparent; padding: 3px 0 0; }
.gd-stack-column:is(:focus-visible, :hover, [aria-pressed="true"]) { background: var(--gd-inner); }
.gd-stack-track { display: flex; justify-content: center; align-items: end; flex: 1; inline-size: 100%; border-bottom: 1px solid var(--gd-line); }
.gd-stack-bar {
  display: flex; flex-direction: column; transform-origin: center bottom;
  inline-size: min(65%, 40px); min-inline-size: 6px; border-radius: 6px 6px 3px 3px; overflow: hidden;
}
.gd-stack-bar i { display: block; flex-basis: 0; background: var(--gd-series); min-block-size: 2px; }
.gd-stack-bar i:first-child { background: repeating-linear-gradient(138deg, var(--gd-series) 0 4px, color-mix(in srgb, var(--gd-series) 76%, white) 4px 6px); }
.gd-stack-label { font-size: 9px; color: var(--gd-muted); margin-top: 7px; white-space: nowrap; }
.gd-revenue-main { display: grid; grid-template-columns: 38px minmax(0, 1fr); }
.gd-chart-y { display: flex; flex-direction: column; justify-content: space-between; padding-block: 0; font-size: 10px; color: var(--gd-muted); }
.gd-line-plot { position: relative; min-inline-size: 0; block-size: 208px; }
.gd-line-plot svg { display: block; width: 100%; height: 100%; overflow: visible; }
.gd-grid-line { stroke: var(--gd-grid); stroke-dasharray: 3 4; vector-effect: non-scaling-stroke; }
.gd-chart-path { fill: none; stroke: var(--gd-series); stroke-width: 2.5; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.gd-line-cursor { stroke: var(--gd-muted); stroke-dasharray: 2 4; vector-effect: non-scaling-stroke; }
.gd-chart-zones { position: absolute; inset: 0; display: flex; align-items: stretch; }
.gd-chart-zones button { flex: 1; min-inline-size: 0; border: 0; background: transparent; padding: 0; border-radius: 2px; }
.gd-line-tooltip {
  pointer-events: none; position: absolute; top: 6px; left: clamp(70px, var(--gd-tooltip-x), calc(100% - 70px)); translate: -50% 0;
  display: grid; gap: 2px; min-inline-size: 132px; padding: 7px 8px; background: var(--gd-surface);
  border: 1px solid var(--gd-line); border-radius: 9px; font-size: 10px; box-shadow: 0 4px 10px rgb(var(--gd-dark-shadow) / 15%);
}
.gd-line-tooltip span { display: flex; justify-content: space-between; gap: 10px; }
.gd-chart-axis { display: flex; justify-content: space-between; margin: 9px 0 0 38px; font-size: 9px; color: var(--gd-muted); }
.gd-device { display: grid; gap: 8px; justify-items: stretch; }
.gd-device-ring { position: relative; inline-size: min(100%, 150px); aspect-ratio: 1; justify-self: center; }
.gd-device-ring svg { display: block; inline-size: 100%; block-size: 100%; }
.gd-device-segment { stroke: var(--gd-series); transition: opacity .2s ease; }
.gd-device-segment[data-muted="true"] { opacity: .29; }
.gd-device-total { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; pointer-events: none; }
.gd-device-total strong { font-size: 23px; line-height: 1.05; letter-spacing: -.05em; font-weight: 850; }
.gd-device-total > span { font-size: 10px; margin-top: 5px; color: var(--gd-muted); }
.gd-device-list { display: grid; gap: 2px; }
.gd-device-list button {
  display: grid; grid-template-columns: 66px minmax(0, 1fr) 34px; gap: 7px; align-items: center;
  min-block-size: 32px; text-align: start; background: transparent; border: 0; border-radius: 8px; padding: 3px 6px;
}
.gd-device-list button:is(:hover, [aria-pressed="true"]) { background: var(--gd-inner); }
.gd-device-list button strong { text-align: end; font-weight: 850; font-size: 11px; }
.gd-mix-track { height: 4px; }
.gd-mix-track .gd-fill { display: block; block-size: 100%; border-radius: inherit; background: var(--gd-series); transform-origin: left center; }

.gd-lanes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }
.gd-lanes[data-filtered="true"] { grid-template-columns: minmax(0, 1fr); }
.gd-lane { min-inline-size: 0; border: 1px solid var(--gd-line); background: var(--gd-inner); padding: 7px; border-radius: 14px; }
.gd-lane header { display: flex; align-items: center; gap: 5px; padding: 3px 4px 8px; }
.gd-lane header i { display: inline-grid; place-items: center; border-radius: 7px; width: 23px; height: 23px; color: var(--gd-series); background: color-mix(in srgb, var(--gd-series) 13%, transparent); }
.gd-lane header svg { width: 13px; height: 13px; }
.gd-lane header h3 { min-inline-size: 0; font-size: 11px; font-weight: 840; }
.gd-lane header span { margin-inline-start: auto; color: var(--gd-muted); font-size: 10px; }
.gd-work-item {
  display: grid; gap: 5px; width: 100%; text-align: start; border-radius: 11px; padding: 9px;
  border: 1px solid var(--gd-rim); background: var(--gd-card);
  box-shadow: inset 0 1px 0 var(--gd-gloss);
}
.gd-work-item + .gd-work-item { margin-top: 6px; }
.gd-work-item:hover { background: var(--gd-raised); }
.gd-work-titlerow, .gd-work-meta { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
.gd-work-titlerow strong { font-size: 11.5px; font-weight: 820; }
.gd-work-titlerow svg { width: 14px; height: 14px; }
.gd-work-detail { font-size: 10.5px; line-height: 1.42; color: var(--gd-muted); }
.gd-work-meta { font-size: 9.5px; font-weight: 750; margin-top: 2px; color: var(--gd-muted); }

.gd-dock {
  position: absolute; z-index: 3;
  display: flex; align-items: center; gap: 3px; padding: 4px; border-radius: 999px;
}
.gd-dock-side { flex-direction: column; left: -24px; top: clamp(66px, 16vh, 153px); }
.gd-dock-bottom { left: 50%; bottom: -24px; translate: -50% 0; }
.gd-dock a {
  z-index: 1; position: relative; display: flex; gap: 6px; justify-content: center; align-items: center;
  min-inline-size: 44px; min-block-size: 44px; padding: 0 13px; border-radius: 999px;
  font-size: 11px; font-weight: 800; white-space: nowrap;
}
.gd-dock-side a { padding: 0; }
.gd-dock a svg { width: 16px; height: 16px; stroke-width: 1.9; }
.gd-dock a[aria-current="page"] { color: var(--gd-pick-ink); }
.gd-dock a:not([aria-current="page"]):hover { background: var(--gd-inner); }
.gd-dock-indicator {
  position: absolute; inset: 0 auto auto 0; pointer-events: none; visibility: hidden;
  border-radius: 999px; background: var(--gd-pick); box-shadow: inset 0 1px 0 white, 0 2px 7px rgb(var(--gd-dark-shadow) / 16%);
}
.gd-dock-indicator[data-ready="true"] { visibility: visible; transition: transform .36s cubic-bezier(.24, .89, .26, 1), width .36s cubic-bezier(.24, .89, .26, 1), height .36s cubic-bezier(.24, .89, .26, 1); }
.gd-dock-side .gd-dock-text, .gd-dock-short { display: none; }
.gd-dock-tip {
  display: none; position: absolute; left: calc(100% + 7px); z-index: 1; pointer-events: none;
  color: var(--gd-ink); background: var(--gd-surface); padding: 6px 9px; border: 1px solid var(--gd-rim);
  border-radius: 7px; box-shadow: 0 3px 8px rgb(var(--gd-dark-shadow) / 17%);
}
.gd-dock-side a:is(:hover, :focus-visible) .gd-dock-tip { display: inline; }
.gd-footer { padding: 33px 3px 1px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.gd-footer > * {
  border-radius: 999px; padding: 5px 8px; color: var(--gd-ink); font-size: 10px; font-weight: 740;
  background: var(--gd-raised); min-block-size: 24px; display: flex; align-items: center; gap: 4px;
}
.gd-footer a:hover { text-decoration: underline; }
.gd-footer a svg { width: 10px; height: 10px; }

.gd-dialog {
  max-inline-size: min(calc(100% - 26px), 485px); inline-size: 100%;
  border-radius: 23px; border: 1px solid var(--gd-rim); color: var(--gd-ink); padding: 0;
  background: var(--gd-surface); box-shadow: 0 20px 80px rgb(var(--gd-dark-shadow) / 38%);
}
.gd-dialog::backdrop { background: rgb(30 21 17 / 43%); backdrop-filter: blur(5px); }
.gd-dialog-inner { padding: 18px; }
.gd-dialog-inner > header { display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.gd-dialog-inner h2 { font-size: 24px; font-weight: 830; letter-spacing: -.045em; }
.gd-command-input { inline-size: 100%; padding-inline: 10px; margin-bottom: 8px; min-block-size: 44px; }
.gd-command-input input { min-block-size: 42px; font-size: 14px; }
.gd-quick-list { display: grid; gap: 5px; }
.gd-quick-list button {
  display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px;
  text-align: start; border: 1px solid var(--gd-line); border-radius: 10px; background: var(--gd-inner);
}
.gd-quick-list button:hover { background: var(--gd-raised); }
.gd-quick-list button svg { width: 16px; height: 16px; color: var(--gd-muted); }
.gd-quick-list button div { flex: 1; }
.gd-quick-list strong, .gd-quick-list small { display: block; }
.gd-quick-list small { color: var(--gd-muted); margin-top: 2px; font-size: 11px; }
.gd-work-dialog-description { margin: 12px 0; }
.gd-work-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.gd-work-facts div { border: 1px solid var(--gd-line); border-radius: 9px; padding: 8px; }
.gd-work-facts dt { font-size: 11px; color: var(--gd-muted); }
.gd-work-facts dd { margin: 4px 0 0; font-weight: 790; }

@media (max-width: 1060px) {
  .gd-surround { inline-size: calc(100% - 74px); }
  .gd-stage-scroll { padding-inline: 29px; }
  .gd-command-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .gd-command-grid > .gd-command-chart { grid-column: 1; }
  .gd-command-side { grid-column: 2; }
  .gd-command-grid > .gd-activity { grid-column: 1 / -1; }
}
@media (max-width: 760px) {
  .gd-surround { padding-top: 11px; padding-bottom: calc(73px + env(safe-area-inset-bottom)); inline-size: calc(100% - 24px); }
  .gd-top { grid-template-columns: minmax(0, 1fr) auto; padding: 7px 9px; gap: 6px 12px; border-radius: 21px; }
  .gd-brand { padding-inline-start: 3px; }
  .gd-ask { grid-area: 2 / 1 / 3 / -1; min-block-size: 41px; }
  .gd-top-actions { grid-area: 1 / 2; }
  .gd-top-actions .gd-icon-button { width: 41px; min-inline-size: 41px; min-block-size: 41px; }
  .gd-stage { border-radius: 23px; }
  .gd-stage-scroll { block-size: auto; padding: 15px 13px 17px; overflow: visible; }
  .gd-view-head { align-items: flex-start; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .gd-view-head p { font-size: 12px; margin-top: 6px; }
  .gd-view-actions { justify-content: flex-start; }
  .gd-command-grid, .gd-analytics-grid { grid-template-columns: minmax(0, 1fr); }
  .gd-command-side, .gd-command-grid > .gd-activity { grid-column: 1; }
  .gd-metric-grid, .gd-lanes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gd-dock-side { display: none; }
  .gd-dock-bottom { position: fixed; inset: auto 11px calc(9px + env(safe-area-inset-bottom)); translate: none; justify-content: space-between; }
  .gd-dock-bottom a { flex: 1; flex-direction: column; gap: 2px; padding: 3px 5px; min-block-size: 47px; line-height: 1.2; font-size: 9.5px; }
  .gd-dock-bottom a svg { width: 15px; height: 15px; }
  .gd-dock-bottom .gd-dock-text { display: none; }
  .gd-dock-bottom .gd-dock-short { display: inline; }
  .gd-footer { padding-top: 9px; }
  .gd-period button { min-block-size: 41px; }
  .gd-primary, .gd-secondary { min-block-size: 44px; }
}
@media (max-width: 420px) {
  .gd-panel { padding: 12px; }
  .gd-metric { padding: 9px; }
  .gd-summary { gap: 5px; padding: 5px; }
  .gd-chart-axis span:nth-child(even) { visibility: hidden; }
  .gd-chart-y { font-size: 9px; }
  .gd-stack-label { font-size: 8px; }
  .gd-lanes { grid-template-columns: 1fr; }
  .gd-table-scroll table { min-inline-size: 278px; }
  .gd-table-scroll th, .gd-table-scroll td { padding-inline: 6px; }
  .gd-table-scroll td { font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .gd-app *, .gd-app *::before, .gd-app *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active) {
  .gd-top, .gd-stage, .gd-dock, .gd-panel, .gd-metric, .gd-summary { background: var(--gd-surface); backdrop-filter: none; -webkit-backdrop-filter: none; }
  .gd-metric[data-tone="teal"] { background: var(--gd-surface); color: var(--gd-ink); --gd-muted: var(--gd-ink); --gd-teal: var(--gd-ink); }
}
@media (forced-colors: active) {
  .gd-app { --gd-ink: CanvasText; --gd-muted: CanvasText; --gd-focus: Highlight; --gd-coral: LinkText; --gd-teal: Highlight; --gd-graph-ink: CanvasText; --gd-surface: Canvas; }
  .gd-app :is(.gd-metric, .gd-panel, .gd-lane, .gd-dock, button, .gd-stage) { border: 1px solid CanvasText; }
  .gd-dock a[aria-current="page"] { border: 2px solid Highlight; }
}
`;

const periods = ["7 days", "30 days", "90 days"] as const;
type Period = typeof periods[number];

const analytics = {
  "7 days": {
    revenue: 11600, orders: 319, visitors: 2184, refunds: 14, automation: 304, subscribers: 1847,
    revenueChange: "+4.7%", orderChange: "+7.4%", visitorChange: "+5.2%", refundChange: "−8.0%",
    axis: ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"],
    collected: [1.2, 1.5, 1.35, 1.9, 1.59, 1.72, 2.34],
    costs: [.8, .92, .72, .85, 1.04, 1.01, .84],
    desktop: [58, 63, 61, 57, 59, 64, 60],
    devices: [54, 38, 8],
  },
  "30 days": {
    revenue: 47200, orders: 1328, visitors: 8344, refunds: 56, automation: 1284, subscribers: 1847,
    revenueChange: "+8.3%", orderChange: "+12.2%", visitorChange: "+9.0%", refundChange: "−3.4%",
    axis: ["Oct 19", "Oct 24", "Oct 29", "Nov 3", "Nov 8", "Nov 13", "Nov 17"],
    collected: [5.5, 6.4, 5.2, 7.6, 6.8, 7.1, 8.6],
    costs: [4.3, 4.85, 4.52, 4.2, 5.85, 5.15, 5.5],
    desktop: [66, 57, 64, 58, 60, 55, 61],
    devices: [56, 36, 8],
  },
  "90 days": {
    revenue: 126100, orders: 3728, visitors: 24132, refunds: 162, automation: 3562, subscribers: 1847,
    revenueChange: "+13.4%", orderChange: "+17.5%", visitorChange: "+11.6%", refundChange: "−5.2%",
    axis: ["Aug 20", "Sep 4", "Sep 19", "Oct 4", "Oct 19", "Nov 3", "Nov 7"],
    collected: [13.7, 16.2, 15.4, 16.8, 18.6, 20.4, 25],
    costs: [10.2, 11.2, 12.1, 11.16, 13.4, 13.1, 14.9],
    desktop: [64, 62, 59, 53, 56, 63, 57],
    devices: [58, 33, 9],
  },
} satisfies Record< Period, {
  revenue: number; orders: number; visitors: number; refunds: number; automation: number; subscribers: number;
  revenueChange: string; orderChange: string; visitorChange: string; refundChange: string;
  axis: string[]; collected: number[]; costs: number[]; desktop: number[]; devices: number[];
}>;

const automationActivity = [
  { label: "Tue", complete: 108, review: 10 },
  { label: "Wed", complete: 176, review: 11 },
  { label: "Thu", complete: 138, review: 14 },
  { label: "Fri", complete: 213, review: 19 },
  { label: "Sat", complete: 155, review: 12 },
  { label: "Sun", complete: 161, review: 15 },
  { label: "Mon", complete: 238, review: 14 },
];

type WorkStatus = "Needs review" | "Scheduled" | "Running" | "Exceptions";
const workStatuses: WorkStatus[] = ["Needs review", "Scheduled", "Running", "Exceptions"];

type WorkItem = {
  id: string;
  name: string;
  description: string;
  tool: string;
  owner: string;
  status: WorkStatus;
  timestamp: string;
};

const initialWork: WorkItem[] = [
  { id: "OP-241", name: "Refund approval", description: "A refund exception is ready for the owner to review.", tool: "Stripe", owner: "Finance", status: "Needs review", timestamp: "10:42" },
  { id: "OP-238", name: "Send cap review", description: "Review the first batch size for the renewal campaign.", tool: "HubSpot", owner: "Marketing", status: "Needs review", timestamp: "10:16" },
  { id: "OP-235", name: "Inventory check", description: "Review 23 low-stock items for the next supplier order.", tool: "Shopify", owner: "Operations", status: "Scheduled", timestamp: "15:00" },
  { id: "OP-234", name: "Executive summary", description: "Compile revenue, customer support and campaign performance.", tool: "Reports", owner: "Analytics", status: "Scheduled", timestamp: "Fri 09:00" },
  { id: "OP-232", name: "Sync 142 orders", description: "Update CRM and fulfillment records with validated orders.", tool: "Shopify", owner: "Operations", status: "Running", timestamp: "09:52" },
  { id: "OP-229", name: "Lead enrichment", description: "Match recent support requests to the sales pipeline.", tool: "HubSpot", owner: "Sales", status: "Running", timestamp: "09:23" },
  { id: "OP-227", name: "Duplicate account", description: "Two CRM entries share a billing address. Updates are on hold.", tool: "Salesforce", owner: "Operations", status: "Exceptions", timestamp: "09:06" },
  { id: "OP-223", name: "Calendar access", description: "The scheduling connector needs an owner to restore write access.", tool: "Google", owner: "Marketing", status: "Exceptions", timestamp: "08:41" },
];

const recentActivity = [
  { id: "ACT-108", event: "Order records validated", source: "Shopify", status: "Complete", time: "10:38" },
  { id: "ACT-107", event: "Refund sent to review", source: "Stripe", status: "Needs review", time: "10:24" },
  { id: "ACT-106", event: "Renewal sequence scheduled", source: "HubSpot", status: "Scheduled", time: "10:07" },
  { id: "ACT-105", event: "Support digest delivered", source: "Reports", status: "Complete", time: "09:51" },
  { id: "ACT-104", event: "Account match paused", source: "Salesforce", status: "Exceptions", time: "09:06" },
] as const;

const number = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format;
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format;

type ChartTone = "coral" | "ink" | "teal" | "ochre";
type CountFormat = "number" | "usd" | "compact" | "percent";

const formatCount: Record< CountFormat, (value: number) => string> = {
  number: value => number.format(Math.round(value)),
  usd,
  compact: usdCompact,
  percent: value => `${value.toFixed(1)}%`,
};

function Counter({ value, format = "number" }: { value: number; format?: CountFormat }) {
  const text = formatCount[format](value);
  return <>
    <span data-gd-count={value} data-format={format} aria-hidden="true">{text}</span>
    <span className="gd-sr">{text}</span>
  </>;
}

function Legend({ entries }: { entries: { label: string; tone: ChartTone }[] }) {
  return <div className="gd-legend">{entries.map(({ label, tone }) => (
    <span key={label}><i data-tone={tone} aria-hidden="true" />{label}</span>
  ))}</div>;
}

type Stack = { label: string; lower: number; upper: number };

function StackChart({ items, labels, tones, format, title }: {
  items: Stack[];
  labels: [string, string];
  tones: [ChartTone, ChartTone];
  format: (value: number) => string;
  title: string;
}) {
  const [active, setActive] = useState< number | null>(null);
  const max = Math.max(1, ...items.map(item => item.lower + item.upper)) * 1.11;
  const selected = active === null ? undefined : items[active];

  return <figure className="gd-stack" aria-label={title}>
    <div className="gd-stack-meta">
      <Legend entries={labels.map((label, index) => ({ label, tone: tones[index] }))} />
      {selected && <span className="gd-chart-readout">{selected.label} · {format(selected.lower + selected.upper)}</span>}
    </div>
    <div className="gd-stack-plot" style={{ "--gd-series-count": items.length } as CSSProperties} onMouseLeave={() => setActive(null)}>
      {items.map((item, index) => (
        <button type="button" className="gd-stack-column" key={item.label}
          aria-label={`${item.label}: ${format(item.lower)} ${labels[0]}, ${format(item.upper)} ${labels[1]}`}
          aria-pressed={active === index}
          onFocus={() => setActive(index)} onBlur={() => setActive(null)}
          onMouseEnter={() => setActive(index)} onClick={() => setActive(index)}>
          <span className="gd-stack-track" aria-hidden="true">
            <span className="gd-stack-bar" style={{ height: `${(item.lower + item.upper) / max * 100}%` }}>
              <i data-tone={tones[1]} style={{ flexGrow: item.upper }} />
              <i data-tone={tones[0]} style={{ flexGrow: item.lower }} />
            </span>
          </span>
          <span className="gd-stack-label" aria-hidden="true">{item.label}</span>
        </button>
      ))}
    </div>
  </figure>;
}

type Point = [number, number];

function curve(points: Point[]) {
  return points.reduce((path, [x, y], index) => {
    if (index === 0) return `M ${x} ${y}`;
    const [previousX, previousY] = points[index - 1];
    const midpoint = (x + previousX) / 2;
    return `${path} C ${midpoint} ${previousY}, ${midpoint} ${y}, ${x} ${y}`;
  }, "");
}

function RevenueChart({ labels, revenue, costs }: { labels: string[]; revenue: number[]; costs: number[] }) {
  const fillId = `revenue-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [active, setActive] = useState< number | null>(null);
  const plotHeight = 204;
  const width = 600;
  const max = Math.ceil(Math.max(...revenue, ...costs) * 1.14 / 2.5) * 2.5;
  const points = (values: number[]): Point[] => values.map((value, index) => [
    index * width / Math.max(1, values.length - 1),
    plotHeight - value / max * plotHeight,
  ]);
  const revenuePoints = points(revenue);
  const costPoints = points(costs);
  const revenueLine = curve(revenuePoints);
  const last = (revenuePoints.length - 1) * width / Math.max(1, revenuePoints.length - 1);
  const point = active === null ? undefined : revenuePoints[active];
  const costPoint = active === null ? undefined : costPoints[active];
  const ticks = [max, max * .75, max * .5, max * .25, 0];

  return <figure className="gd-revenue-chart" aria-label="Revenue and operating costs by date">
    <div className="gd-revenue-main">
      <div className="gd-chart-y" aria-hidden="true">{ticks.map(value => <span key={value}>{value === 0 ? "0" : `$${Number(value.toFixed(1))}k`}</span>)}</div>
      <div className="gd-line-plot" onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${width} ${plotHeight}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox">
              <stop offset="0" stopColor="var(--gd-coral)" stopOpacity=".30" />
              <stop offset="1" stopColor="var(--gd-coral)" stopOpacity=".025" />
            </linearGradient>
          </defs>
          {ticks.map((tick, index) => <line className="gd-grid-line" key={tick} x1="0" x2={width} y1={plotHeight * index / 4} y2={plotHeight * index / 4} />)}
          <g className="gd-line-reveal">
            <path d={`${revenueLine} L ${last} ${plotHeight} H 0 Z`} fill={`url(#${fillId})`} />
            <path className="gd-chart-path" data-tone="coral" d={revenueLine} />
            <path className="gd-chart-path" data-tone="ink" d={curve(costPoints)} />
          </g>
          {point && costPoint && <g>
            <line className="gd-line-cursor" x1={point[0]} x2={point[0]} y1="0" y2={plotHeight} />
            <circle cx={point[0]} cy={point[1]} r="4" fill="var(--gd-coral)" />
            <circle cx={costPoint[0]} cy={costPoint[1]} r="4" fill="var(--gd-graph-ink)" />
          </g>}
        </svg>
        <div className="gd-chart-zones">
          {labels.map((label, index) => <button type="button" key={label}
            aria-label={`${label}, revenue ${usd(revenue[index] * 1000)}, operating costs ${usd(costs[index] * 1000)}`}
            aria-pressed={active === index}
            onFocus={() => setActive(index)} onBlur={() => setActive(null)}
            onMouseEnter={() => setActive(index)} onClick={() => setActive(index)} />)}
        </div>
        {active !== null && <div className="gd-line-tooltip" style={{ "--gd-tooltip-x": `${active / (labels.length - 1) * 100}%` } as CSSProperties}>
          <strong>{labels[active]}</strong>
          <span>Revenue <b>{usd(revenue[active] * 1000)}</b></span>
          <span>Costs <b>{usd(costs[active] * 1000)}</b></span>
        </div>}
      </div>
    </div>
    <div className="gd-chart-axis" aria-hidden="true">{labels.map(label => <span key={label}>{label}</span>)}</div>
  </figure>;
}

const deviceLabels = ["Desktop", "Mobile", "Tablet"];
const deviceTones: ChartTone[] = ["coral", "ink", "teal"];

function DeviceChart({ mix, visitors }: { mix: number[]; visitors: number }) {
  const maskId = `gd-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [active, setActive] = useState< number | null>(null);
  return <div className="gd-device" aria-label="Visitors by device">
    <div className="gd-device-ring">
      <svg viewBox="0 0 124 124" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <circle className="gd-donut-draw" cx="62" cy="62" r="47" fill="none" stroke="white" strokeWidth="15"
              pathLength="100" strokeDasharray="100 0" transform="rotate(-90 62 62)" />
          </mask>
        </defs>
        <circle cx="62" cy="62" r="47" fill="none" stroke="var(--gd-track)" strokeWidth="14" />
        <g mask={`url(#${maskId})`} transform="rotate(-90 62 62)">
          {mix.map((ratio, index) => <circle key={deviceLabels[index]} cx="62" cy="62" r="47" pathLength="100"
            fill="none" strokeWidth="14" data-tone={deviceTones[index]} className="gd-device-segment"
            data-muted={active !== null && index !== active}
            strokeDasharray={`${Math.max(0, ratio - 1.1)} 100`}
            strokeDashoffset={-mix.slice(0, index).reduce((sum, value) => sum + value, 0)} />)}
        </g>
      </svg>
      <div className="gd-device-total">
        <strong>{active === null ? <Counter value={visitors} /> : number.format(Math.round(visitors * mix[active] / 100))}</strong>
        <span>{active === null ? "Visitors" : deviceLabels[active]}</span>
      </div>
    </div>
    <div className="gd-device-list">
      {mix.map((ratio, index) => (
        <button type="button" key={deviceLabels[index]} aria-pressed={active === index}
          aria-label={`${deviceLabels[index]}, ${ratio}% of visitors`}
          onClick={() => setActive(active === index ? null : index)}>
          <span><i data-tone={deviceTones[index]} aria-hidden="true" />{deviceLabels[index]}</span>
          <span className="gd-mix-track" aria-hidden="true"><i className="gd-fill" data-tone={deviceTones[index]} style={{ width: `${ratio}%` }} /></span>
          <strong>{ratio}%</strong>
        </button>
      ))}
    </div>
  </div>;
}

function Panel({ title, subtitle, action, className = "", children }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return <section className={`gd-panel ${className}`} data-gd-enter>
    <header className="gd-panel-head">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </header>
    {children}
  </section>;
}

type View = "command" | "trends" | "metrics" | "operations";

type MetricProps = {
  title: string;
  icon: ReactNode;
  value: number;
  format?: CountFormat;
  change?: string;
  detail?: string;
  tone?: "teal" | "coral";
};

function Metric({ title, icon, value, format, change, detail, tone }: MetricProps) {
  return <article className="gd-metric" data-tone={tone} data-gd-enter>
    <div className="gd-metric-head"><span>{title}</span><span className="gd-metric-icon" aria-hidden="true">{icon}</span></div>
    <strong className="gd-metric-value"><Counter value={value} format={format} /></strong>
    <div className="gd-metric-caption">
      {change && <span className="gd-delta" data-attention={tone === "coral"}>
        {change.startsWith("−") ? <ArrowDownRight aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}{change}
      </span>}
      <span>{detail ?? "vs prior period"}</span>
    </div>
  </article>;
}

function Badge({ status }: { status: string }) {
  const color = status === "Complete" || status === "Running" ? "teal"
    : status === "Needs review" || status === "Exceptions" ? "coral" : "ink";
  return <span className="gd-status" data-state={color}><i aria-hidden="true" />{status}</span>;
}

function Activity() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const show = recentActivity.filter(item => [item.event, item.source, item.status].join(" ").toLowerCase().includes(query.trim().toLowerCase())
    && (status === "All statuses" || item.status === status));

  return <Panel title="Recent activity" className="gd-activity" action={
    <div className="gd-table-tools">
      <label className="gd-search"><Search aria-hidden="true" /><input type="search" placeholder="Search activity" aria-label="Search activity" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="gd-filter"><Filter aria-hidden="true" /><select aria-label="Filter activity" value={status} onChange={event => setStatus(event.target.value)}>
        {["All statuses", "Complete", "Needs review", "Scheduled", "Exceptions"].map(item => <option key={item}>{item}</option>)}
      </select></label>
    </div>
  }>
    <div className="gd-table-scroll">
      <table><thead><tr><th scope="col">Activity</th><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Time</th></tr></thead>
        <tbody>{show.map(item => <tr key={item.id}><td>{item.event}</td><td>{item.source}</td><td><Badge status={item.status} /></td><td>{item.time}</td></tr>)}</tbody>
      </table>
    </div>
    {show.length === 0 && <p className="gd-empty" role="status">No matching activity.</p>}
  </Panel>;
}

function CommandView({ period, open }: { period: Period; open: (view: View) => void }) {
  const stats = analytics[period];
  const streams = [{ label: "Subscriptions", ratio: .686 }, { label: "Services", ratio: .208 }, { label: "Add-ons", ratio: .106 }];
  const sources = streams.map(({ label, ratio }) => ({ label, value: Math.round(stats.revenue * ratio) }));
  return <div className="gd-command-grid">
    <Panel title="Total revenue" className="gd-balance" action={<span className="gd-unit">USD</span>}>
      <div className="gd-balance-number"><Counter value={stats.revenue} format="usd" /></div>
      <div className="gd-balance-change"><span className="gd-delta"><ArrowUpRight aria-hidden="true" />{stats.revenueChange}</span><span>vs prior period</span></div>
      <div className="gd-balance-actions">
        <button type="button" className="gd-primary" onClick={() => open("trends")}>View trends <ArrowUpRight aria-hidden="true" /></button>
        <button type="button" className="gd-secondary" onClick={() => open("metrics")}>View metrics <ArrowRight aria-hidden="true" /></button>
      </div>
      <div className="gd-streams" aria-label="Revenue sources">{sources.map(item => (
        <div key={item.label}><span>{item.label}</span><strong>{usd(item.value)}</strong></div>
      ))}</div>
    </Panel>
    <div className="gd-summary">
      <Metric title="Automations run" icon={<Zap />} value={stats.automation} change="+9.6%" tone="teal" />
      <Metric title="Subscribers" icon={<Users />} value={stats.subscribers} change="+124" detail="this month" />
      <Metric title="Churn rate" icon={<ArrowDownRight />} value={4.2} format="percent" change="+0.6%" tone="coral" />
      <Metric title="Open tickets" icon={<ListChecks />} value={12} detail="9 resolved today" />
    </div>
    <Panel title="Automation activity" subtitle="Completed and sent to review · last 7 days" className="gd-command-chart">
      <StackChart items={automationActivity.map(item => ({ label: item.label, lower: item.complete, upper: item.review }))}
        labels={["Complete", "Review"]} tones={["ink", "teal"]} format={number.format} title="Automation runs by day" />
    </Panel>
    <div className="gd-command-side">
      <Panel title="Automation capacity" className="gd-capacity">
        <div className="gd-capacity-track" role="meter" aria-label="Monthly automation capacity" aria-valuenow={1284} aria-valuemin={0} aria-valuemax={2200}>
          <span className="gd-fill" style={{ width: `${1284 / 2200 * 100}%` }} />
        </div>
        <div className="gd-capacity-label"><span><strong>1,284</strong> used</span><span>2,200 monthly runs</span></div>
      </Panel>
      <Panel title="Approvals" subtitle="Decisions that need an owner" className="gd-approvals">
        <div className="gd-approval-content"><span className="gd-list-icon"><ShieldCheck aria-hidden="true" /></span>
          <div><strong>Owner review</strong><small>Refunds and renewal campaigns</small></div>
          <button type="button" className="gd-icon-button" aria-label="Open Premium Operations" onClick={() => open("operations")}><ArrowUpRight aria-hidden="true" /></button></div>
      </Panel>
    </div>
    <Activity />
  </div>;
}

function AnalyticsMetrics({ period, trend }: { period: Period; trend?: boolean }) {
  const stats = analytics[period];
  const costTotal = Math.round(stats.costs.reduce((total, cost) => total + cost, 0) * 1000);
  const margin = (stats.revenue - costTotal) / stats.revenue * 100;
  return <div className="gd-metric-grid">
    <Metric title="Revenue" icon={<CircleDollarSign />} value={stats.revenue} format="compact" change={stats.revenueChange} tone="teal" />
    {trend ? <>
      <Metric title="Operating costs" icon={<ArrowDownRight />} value={costTotal} format="compact" detail="in this period" />
      <Metric title="Net revenue" icon={<Box />} value={stats.revenue - costTotal} format="compact" detail="after operating costs" />
      <Metric title="Operating margin" icon={<CircleDollarSign />} value={margin} format="percent" detail="of revenue" />
    </> : <>
      <Metric title="Orders" icon={<ShoppingBag />} value={stats.orders} change={stats.orderChange} />
      <Metric title="Visitors" icon={<Eye />} value={stats.visitors} change={stats.visitorChange} />
      <Metric title="Refunds" icon={<ArrowDownRight />} value={stats.refunds} change={stats.refundChange} />
    </>}
  </div>;
}

function AnalyticsView({ period, type, download }: {
  period: Period;
  type: "trends" | "metrics";
  download: () => void;
}) {
  const stats = analytics[period];
  const trend = type === "trends";
  return <div className="gd-analytics">
    <AnalyticsMetrics period={period} trend={trend} />
    <div className="gd-analytics-grid">
      <Panel title={trend ? "Revenue vs operating costs" : "Revenue by device"}
        subtitle={trend ? "Compare revenue and costs across the selected period" : "Desktop and mobile revenue across the selected period"}
        action={trend && <Legend entries={[{ label: "Revenue", tone: "coral" }, { label: "Costs", tone: "ink" }]} />}>
        {trend ? <RevenueChart labels={stats.axis} revenue={stats.collected} costs={stats.costs} />
          : <StackChart title="Revenue by device and date" labels={["Desktop", "Mobile"]} tones={["ink", "coral"]} format={usd}
            items={stats.axis.map((label, index) => {
              const sum = stats.collected[index] * 1000;
              const lower = Math.round(sum * stats.desktop[index] / 100);
              return { label, lower, upper: sum - lower };
            })} />}
      </Panel>
      <Panel title="Traffic by device" className="gd-device-panel">
        <DeviceChart mix={stats.devices} visitors={stats.visitors} />
      </Panel>
    </div>
    {trend ? <Panel title="Reporting snapshot" className="gd-statement">
      <div className="gd-approval-content"><span className="gd-list-icon"><Clock3 aria-hidden="true" /></span>
        <div><strong>Revenue and operating costs</strong><small>{period} · {stats.axis[0]} to {stats.axis.at(-1)}</small></div>
        <button type="button" className="gd-icon-button" aria-label="Download revenue and expense CSV" onClick={download}><Download aria-hidden="true" /></button>
      </div>
    </Panel> : <Activity />}
  </div>;
}

const statusStyle: Record< WorkStatus, { icon: ReactNode; tone: "teal" | "coral" | "ochre" | "ink" }> = {
  "Needs review": { icon: <ListChecks />, tone: "coral" },
  "Scheduled": { icon: <Clock3 />, tone: "ochre" },
  "Running": { icon: <Zap />, tone: "teal" },
  "Exceptions": { icon: <TriangleAlert />, tone: "ink" },
};

function OperationsView({ work, inspect }: { work: WorkItem[]; inspect: (item: WorkItem) => void }) {
  const [filter, setFilter] = useState< WorkStatus | "All lanes">("All lanes");
  const review = work.filter(item => item.status === "Needs review").length;
  const tools = new Set(work.map(item => item.tool)).size;
  const lanes = filter === "All lanes" ? workStatuses : [filter];
  return <div className="gd-analytics">
    <div className="gd-metric-grid">
      <Metric title="Revenue at work" icon={<CircleDollarSign />} value={126100} format="compact" detail="last 90 days" tone="teal" />
      <Metric title="Active work items" icon={<Zap />} value={work.length} detail="in the operations queue" />
      <Metric title="Needs approval" icon={<ListChecks />} value={review} detail="waiting for an owner" />
      <Metric title="Connected systems" icon={<ShieldCheck />} value={tools} detail="represented in the queue" />
    </div>
    <Panel title="Active work board" subtitle="Track queued actions, approvals, and connector exceptions."
      className="gd-board" action={<label className="gd-filter"><Filter aria-hidden="true" />
        <select aria-label="Filter operations lanes" value={filter} onChange={event => setFilter(event.target.value as WorkStatus | "All lanes")}>
          {["All lanes", ...workStatuses].map(status => <option key={status}>{status}</option>)}
        </select></label>}>
      <div className="gd-lanes" data-filtered={filter !== "All lanes"}>
        {lanes.map(lane => {
          const items = work.filter(item => item.status === lane);
          return <section className="gd-lane" key={lane} aria-label={lane}>
            <header><i data-tone={statusStyle[lane].tone} aria-hidden="true">{statusStyle[lane].icon}</i><h3>{lane}</h3><span>{items.length}</span></header>
            {items.map(item => <button className="gd-work-item" type="button" onClick={() => inspect(item)} key={item.id}>
              <span className="gd-work-titlerow"><strong>{item.name}</strong><Ellipsis aria-hidden="true" /></span>
              <span className="gd-work-detail">{item.description}</span>
              <span className="gd-work-meta"><span>{item.tool}</span><span>{item.timestamp}</span></span>
            </button>)}
            {items.length === 0 && <p className="gd-empty">Queue clear.</p>}
          </section>;
        })}
      </div>
    </Panel>
  </div>;
}

function useNavigationReducedMotion(motion: boolean) {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced || !motion;
}

gsap.registerPlugin(useGSAP);

const views = [
  { id: "command", label: "Command Center", short: "Command", icon: LayoutDashboard, description: "Revenue, automations, and what needs your attention.", prompt: "Show me what needs attention." },
  { id: "trends", label: "Trends", short: "Trends", icon: TrendingUp, description: "Compare operating costs and revenue over time.", prompt: "How is revenue trending this month?" },
  { id: "metrics", label: "Metrics", short: "Metrics", icon: BarChart3, description: "Track orders, traffic, and device performance.", prompt: "Show me traffic by device." },
  { id: "operations", label: "Premium Operations", short: "Operations", icon: BriefcaseBusiness, description: "Manage approvals, schedules, and exceptions across systems.", prompt: "Which actions are waiting for review?" },
] as const;

const routeOrder: View[] = views.map(view => view.id);

function routeFromHash(): View {
  if (typeof location === "undefined") return "command";
  const id = location.hash.slice(1);
  return routeOrder.find(view => view === id) ?? "command";
}

function saveCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function Dock({ active, side = false, select }: {
  active: View;
  side?: boolean;
  select: (view: View) => void;
}) {
  const nav = useRef< HTMLElement>(null);
  const marker = useRef< HTMLSpanElement>(null);

  useEffect(() => {
    const container = nav.current;
    const indicator = marker.current;
    if (!container || !indicator) return;
    const adjust = () => {
      const current = container.querySelector< HTMLElement>('[aria-current="page"]');
      if (!current) return;
      indicator.style.width = `${current.offsetWidth}px`;
      indicator.style.height = `${current.offsetHeight}px`;
      indicator.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
      indicator.dataset.ready = "true";
    };
    const observer = new ResizeObserver(adjust);
    observer.observe(container);
    container.querySelectorAll("a").forEach(link => observer.observe(link));
    adjust();
    return () => observer.disconnect();
  }, [active]);

  const onSelect = (event: MouseEvent< HTMLAnchorElement>, id: View) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    select(id);
  };

  return <nav ref={nav} className={side ? "gd-dock gd-dock-side" : "gd-dock gd-dock-bottom"}
    aria-label={side ? "Workspace shortcuts" : "Workspace views"}>
    <span ref={marker} className="gd-dock-indicator" aria-hidden="true" />
    {views.map(({ id, label, short, icon: Icon }) => (
      <a href={`#${id}`} key={id} aria-label={label} aria-current={active === id ? "page" : undefined} onClick={event => onSelect(event, id)}>
        <Icon aria-hidden="true" />
        <span className="gd-dock-text" aria-hidden="true">{label}</span>
        <span className="gd-dock-short" aria-hidden="true">{short}</span>
        {side && <span className="gd-dock-tip" aria-hidden="true">{label}</span>}
      </a>
    ))}
  </nav>;
}

function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef< HTMLDialogElement>(null);
  const label = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector("input")?.focus();
  }, []);
  return <dialog className="gd-dialog" ref={ref} aria-labelledby={label} onClose={close}
    onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <section className="gd-dialog-inner">
      <header><h2 id={label}>{title}</h2><button type="button" className="gd-icon-button" aria-label="Close dialog" onClick={() => ref.current?.close()}><X aria-hidden="true" /></button></header>
      {children}
    </section>
  </dialog>;
}

function QuickActions({ workspaceName, select, close }: { workspaceName: string; select: (view: View) => void; close: () => void }) {
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = views.filter(view => terms.every(term =>
    `${view.label} ${view.description} ${view.prompt}`.toLowerCase().includes(term)));
  return <Dialog title={"Search " + workspaceName} close={close}>
    <label className="gd-search gd-command-input"><Search aria-hidden="true" />
      <input type="search" aria-label="Find a dashboard view" placeholder="Find a view or report" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
    <div className="gd-quick-list">
      {results.map(({ label, id, description, icon: Icon }) => <button key={id} type="button" onClick={() => { close(); select(id); }}>
        <Icon aria-hidden="true" /><div><strong>{label}</strong><small>{description}</small></div><ChevronRight aria-hidden="true" />
      </button>)}
      {results.length === 0 && <p className="gd-empty" role="status">No matching views.</p>}
    </div>
  </Dialog>;
}

type Modal = "search" | "notifications" | { itemId: string } | null;

function GlassyDashboard({
  backgroundImage = studioPhoto,
  backgroundCredit = backgroundImage === studioPhoto ? { label: "Photo by GoodLifeConstruction", href: "https://unsplash.com/photos/e0oJLc5FYsg" } : undefined,
  workspaceName = "ATLAS",
  panelFrost = 12,
  initialTheme = "light",
}: GlassyDashboardProps = {}) {
  const [view, setView] = useState< View>(routeFromHash);
  const [active, setActive] = useState(view);
  const [period, setPeriod] = useState< Period>("30 days");
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => setTheme(initialTheme), [initialTheme]);
  const [modal, setModal] = useState< Modal>(null);
  const [work, setWork] = useState(initialWork);
  const [readNotices, setReadNotices] = useState(false);
  const root = useRef< HTMLDivElement>(null);
  const scrollArea = useRef< HTMLDivElement>(null);
  const content = useRef< HTMLDivElement>(null);
  const pending = useRef< View>(view);
  const exit = useRef< gsap.core.Tween | null>(null);
  const reduced = useNavigationReducedMotion(true);
  const { contextSafe } = useGSAP({ scope: root });

  const changeView = contextSafe((next: View) => {
    if (pending.current === next) return;
    pending.current = next;
    setActive(next);
    exit.current?.kill();
    if (reduced || !content.current) {
      setView(next);
      return;
    }
    if (next === view) {
      exit.current = gsap.to(content.current, { opacity: 1, filter: "blur(0px)", duration: .18, clearProps: "opacity,filter" });
      return;
    }
    exit.current = gsap.to(content.current, { opacity: 0, filter: "blur(8px)", duration: .14, ease: "power1.in", onComplete: () => setView(next) });
  });

  function selectView(next: View) {
    if (location.hash !== `#${next}`) history.pushState(null, "", `#${next}`);
    changeView(next);
  }

  useEffect(() => {
    const restore = () => changeView(routeFromHash());
    addEventListener("popstate", restore);
    addEventListener("hashchange", restore);
    return () => {
      removeEventListener("popstate", restore);
      removeEventListener("hashchange", restore);
    };
  }, [changeView]);

  useEffect(() => {
    scrollArea.current?.scrollTo({ top: 0 });
    if (root.current && root.current.getBoundingClientRect().top < -20) root.current.scrollIntoView({ block: "start" });
  }, [view]);

  useGSAP(() => {
    const layer = content.current;
    if (!layer) return;
    const counts = layer.querySelectorAll< HTMLElement>("[data-gd-count]");
    gsap.set(layer, { clearProps: "opacity,filter" });
    if (reduced) {
      counts.forEach(el => { el.textContent = formatCount[el.dataset.format as CountFormat](Number(el.dataset.gdCount)); });
      return;
    }
    const animate = gsap.timeline({ defaults: { ease: "power3.out" } });
    animate.fromTo(layer, { opacity: .55, filter: "blur(5px)" }, { opacity: 1, filter: "blur(0px)", clearProps: "opacity,filter", duration: .32 }, 0);
    animate.from("[data-gd-enter]", { y: 18, opacity: 0, stagger: .045, duration: .50, clearProps: "transform,opacity" }, .035);
    const bars = layer.querySelectorAll(".gd-stack-bar");
    const line = layer.querySelector(".gd-line-reveal");
    const ring = layer.querySelector(".gd-donut-draw");
    const meters = layer.querySelectorAll(".gd-fill");
    if (bars.length) animate.from(bars, { scaleY: 0, stagger: .034, duration: .46, clearProps: "transform" }, .17);
    if (line) animate.fromTo(line, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: .74, clearProps: "clipPath" }, .14);
    if (ring) animate.fromTo(ring, { attr: { "stroke-dasharray": "0 100" } },
      { attr: { "stroke-dasharray": "100 0" }, duration: .76 }, .16);
    if (meters.length) animate.from(meters, { scaleX: 0, duration: .58, stagger: .045, clearProps: "transform" }, .18);
    counts.forEach((el, index) => {
      const value = Number(el.dataset.gdCount);
      const format = formatCount[el.dataset.format as CountFormat];
      const counter = { value: 0 };
      animate.to(counter, { value, duration: .75, onUpdate: () => { el.textContent = format(counter.value); } }, .09 + index * .02);
    });
  }, { scope: content, dependencies: [view, period, reduced], revertOnUpdate: true });

  const current = views.find(item => item.id === view)!;
  const workItem = typeof modal === "object" && modal ? work.find(item => item.id === modal.itemId) : undefined;
  const reviewCount = work.filter(item => item.status === "Needs review").length;
  const close = () => setModal(null);
  const inspect = (item: WorkItem) => setModal({ itemId: item.id });
  const downloadReport = () => {
    const stats = analytics[period];
    saveCsv(`atlas-trends-${period.replace(" ", "-")}.csv`, [
      ["Period ending", "Revenue (USD)", "Operating costs (USD)"],
      ...stats.axis.map((label, index) => [label, Math.round(stats.collected[index] * 1000), Math.round(stats.costs[index] * 1000)]),
    ]);
  };
  const downloadWork = () => saveCsv("atlas-operations.csv", [
    ["ID", "Workflow", "System", "Owner", "Status", "Time"],
    ...work.map(item => [item.id, item.name, item.tool, item.owner, item.status, item.timestamp]),
  ]);

  return <div className="gd-app" data-theme={theme} ref={root} style={{ "--gd-panel-frost": Math.max(0, Math.min(36, panelFrost)) + "px" } as CSSProperties}>
    <style>{dashboardStyles}</style>
    <img className="gd-background" src={backgroundImage} alt="" aria-hidden="true" fetchPriority="high" />
    <div className="gd-surround">
      <header className="gd-top">
        <div className="gd-brand"><span className="gd-logo" aria-hidden="true"><svg viewBox="0 0 28 28" fill="none"><path d="m5 22 7.4-16h3.2L23 22h-4l-5-11.4L9 22H5Z" fill="currentColor"/><path d="M10 18h8l1.4 3h-10.8l1.4-3Z" fill="currentColor"/></svg></span>
          <div><strong>{workspaceName}</strong><small>Workspace</small></div></div>
        <button type="button" className="gd-ask" aria-label={"Search " + workspaceName + " views"} onClick={() => setModal("search")}>
          <span className="gd-orb" aria-hidden="true" /><span className="gd-prompt" key={view}>{current.prompt}</span><Search aria-hidden="true" className="gd-ask-search" />
        </button>
        <div className="gd-top-actions">
          <button title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} type="button" className="gd-icon-button"
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
          <button type="button" className="gd-icon-button gd-notices" aria-label="Notifications" onClick={() => { setReadNotices(true); setModal("notifications"); }}>
            <Bell aria-hidden="true" />{!readNotices && reviewCount > 0 && <i aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="gd-stage-wrap">
        <Dock active={active} side select={selectView} />
        <main className="gd-stage">
          <div className="gd-stage-scroll" ref={scrollArea}>
            <header className="gd-view-head">
              <div>
                <h1>{current.label}</h1>
                <p>{current.description}</p>
              </div>
              <div className="gd-view-actions">
                {view !== "operations" && <div className="gd-period" role="group" aria-label="Reporting period">
                  {periods.map(item => <button type="button" key={item} aria-pressed={item === period} onClick={() => setPeriod(item)}>{item}</button>)}
                </div>}
                {(view === "operations" || view === "trends") && <button type="button" className="gd-primary gd-export" onClick={view === "operations" ? downloadWork : downloadReport}>
                  <ArrowDownToLine aria-hidden="true" />Export CSV
                </button>}
              </div>
            </header>
            <div className="gd-content" ref={content} key={view} data-view={view}>
              {view === "command" && <CommandView period={period} open={selectView} />}
              {(view === "trends" || view === "metrics") && <AnalyticsView period={period} type={view} download={downloadReport} />}
              {view === "operations" && <OperationsView work={work} inspect={inspect} />}
            </div>
          </div>
        </main>
        <Dock active={active} select={selectView} />
      </div>
      <footer className="gd-footer"><span>Sample workspace</span>{backgroundCredit &&
        <a href={backgroundCredit.href} target="_blank" rel="noreferrer">{backgroundCredit.label}<ArrowUpRight aria-hidden="true" /></a>}
      </footer>
    </div>

    {modal === "search" && <QuickActions workspaceName={workspaceName} select={selectView} close={close} />}
    {modal === "notifications" && <Dialog title="Notifications" close={close}>
      <div className="gd-quick-list">
        {work.filter(item => item.status === "Needs review").map(item => <button type="button" key={item.id}
          onClick={() => { selectView("operations"); inspect(item); }}>
          <Bell aria-hidden="true" /><div><strong>{item.name}</strong><small>{item.description}</small></div><ArrowRight aria-hidden="true" />
        </button>)}
        {reviewCount === 0 && <p className="gd-empty">You’re all caught up.</p>}
      </div>
    </Dialog>}
    {workItem && <Dialog key={workItem.id} title={workItem.name} close={close}>
      <Badge status={workItem.status} />
      <p className="gd-work-dialog-description">{workItem.description}</p>
      <dl className="gd-work-facts">
        <div><dt>System</dt><dd>{workItem.tool}</dd></div>
        <div><dt>Owner</dt><dd>{workItem.owner}</dd></div>
        <div><dt>Reference</dt><dd>{workItem.id}</dd></div>
      </dl>
      {workItem.status === "Needs review" && <button type="button" className="gd-primary" onClick={() => {
        setWork(items => items.map(item => item.id === workItem.id ? { ...item, status: "Scheduled" } : item));
        close();
      }}>Mark reviewed <Command aria-hidden="true" /></button>}
    </Dialog>}
  </div>;
}

export { GlassyDashboard };

export default GlassyDashboard;
