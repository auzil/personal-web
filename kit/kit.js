/*
  Prototype kit — shared behaviors + the edit panel. No visual style. See README.md.

  Behaviors (attributes in your HTML):
    data-reveal="lines|fade|photo" [data-reveal-load]   entrance animations (GSAP+SplitText for lines if loaded)
    data-ticker                                         marquee (content duplicated automatically)
    data-menu-open="<id>" / <div id data-menu hidden> / data-menu-close   full-screen menu
    form data-steps > [data-step]… [data-next] [data-back] [data-progress] [data-success]
    data-prefill="field=value"                           on a link/button: sets form fields (e.g. plan) before jumping to the form
    data-sticky-cta [data-mobile-only]                  shown after [data-hero] leaves the viewport
    data-count-to="1490" [data-locale] [data-currency]  counts up when visible
    Kit.animateNumber(el, value, {locale, currency, duration})  for calculators

  Edit panel: open with Shift+E, or add #edit to the URL. Disabled by <html data-kit-panel="off">.
    <html data-kit-panel="client"> is the visitor version: no shortcuts (open it from a [data-try-edit] button via
    Kit.openPanel()), and "Copy my changes" produces a plain message — no /revise, no tool names.
    Tokens — fonts, colors, type scale, any :root variable, live; saved in this browser.
    Text   — edit copy in place.
    Notes  — click any element and leave a comment.
    "Copy feedback" puts everything on the clipboard, ready to paste after /revise.
*/
(() => {
  "use strict";
  const Kit = (window.Kit = window.Kit || {});
  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) root.classList.add("kit-motion");

  const ready = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());
  const storage = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  function observeOnce(el, cb, opts = { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }) {
    if (!("IntersectionObserver" in window)) return cb();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.disconnect(); cb(); break; }
    }, opts);
    io.observe(el);
  }

  /* ---------------- reveal ---------------- */
  function initReveal() {
    document.querySelectorAll('[data-reveal="fade"], [data-reveal="photo"]').forEach((el) => {
      if (reduceMotion) return el.classList.add("is-in");
      observeOnce(el, () => el.classList.add("is-in"));
    });

    const lines = [...document.querySelectorAll('[data-reveal="lines"]')];
    if (!lines.length) return;
    const gsap = window.gsap;
    const Split = window.SplitText;
    const fallback = () => lines.forEach((el) => el.classList.add("is-split"));
    setTimeout(fallback, 3000); // never leave text hidden
    if (reduceMotion || !gsap || !Split) return fallback();
    try { gsap.registerPlugin(Split); } catch { /* already registered */ }
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      lines.forEach((el) => {
        if (el.classList.contains("is-split")) return;
        const onLoad = el.hasAttribute("data-reveal-load");
        const opts = { type: "lines", mask: "lines" };
        const split = typeof Split.create === "function" ? Split.create(el, opts) : new Split(el, opts);
        // SplitText masks are exactly one line-box tall (overflow: clip). With tight display
        // line-heights, descenders (g y p q j) and diacritics (Č Ř Ů Ö) stick out of the line box,
        // get clipped during the animation and then pop in when the split is reverted. Clip with a
        // clip-path that extends past the box instead: same mask effect, room for glyphs, no layout change.
        (split.masks || []).forEach((m) => {
          m.style.overflow = "visible";
          m.style.clipPath = "inset(-0.25em -0.1em -0.35em -0.1em)";
        });
        el.classList.add("is-split");
        const tween = gsap.from(split.lines, {
          // start each line fully below its (extended) mask: line height + bottom room + top overhang
          y: (i, line) => line.offsetHeight + parseFloat(getComputedStyle(line).fontSize) * 0.65,
          duration: 0.9, ease: "expo.out", stagger: 0.08, paused: !onLoad,
          onComplete: () => split.revert(), // restore plain DOM so the text stays editable
        });
        if (!onLoad) observeOnce(el, () => tween.play());
      });
    });
  }

  /* ---------------- ticker ---------------- */
  function initTicker() {
    document.querySelectorAll("[data-ticker]").forEach((el) => {
      if (el.querySelector(".k-ticker-track")) return;
      const track = document.createElement("div");
      track.className = "k-ticker-track";
      while (el.firstChild) track.appendChild(el.firstChild);
      const copy = track.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      const wrap = document.createElement("div");
      wrap.className = "k-ticker-track";
      [...track.childNodes, ...copy.childNodes].forEach((n) => wrap.appendChild(n));
      el.appendChild(wrap);
    });
  }

  /* ---------------- menu ---------------- */
  function initMenu() {
    let lastOpener = null;
    const focusables = (m) => [...m.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    const close = (m) => {
      if (!m || m.hidden) return;
      m.hidden = true;
      m.classList.remove("is-opening");
      root.classList.remove("k-locked");
      document.querySelectorAll(`[data-menu-open="${m.id}"]`).forEach((b) => b.setAttribute("aria-expanded", "false"));
      lastOpener?.focus();
    };
    const open = (m, opener) => {
      lastOpener = opener;
      m.hidden = false;
      m.classList.add("is-opening");
      root.classList.add("k-locked");
      opener?.setAttribute("aria-expanded", "true");
      focusables(m)[0]?.focus();
    };
    document.addEventListener("click", (e) => {
      const opener = e.target.closest("[data-menu-open]");
      if (opener) {
        const m = document.getElementById(opener.dataset.menuOpen);
        if (m) { e.preventDefault(); m.hidden ? open(m, opener) : close(m); }
        return;
      }
      const menu = e.target.closest("[data-menu]");
      if (menu && (e.target.closest("[data-menu-close]") || e.target.closest("a[href]"))) close(menu);
    });
    document.addEventListener("keydown", (e) => {
      const m = document.querySelector("[data-menu]:not([hidden])");
      if (!m) return;
      if (e.key === "Escape") close(m);
      if (e.key === "Tab") {
        const f = focusables(m);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ---------------- multi-step form ---------------- */
  function initSteps() {
    document.querySelectorAll("form[data-steps]").forEach((form) => {
      const steps = [...form.querySelectorAll("[data-step]")];
      const success = form.querySelector("[data-success]") || form.parentElement?.querySelector("[data-success]");
      const progress = form.querySelectorAll("[data-progress]");
      let i = 0;
      const show = (n) => {
        i = Math.max(0, Math.min(n, steps.length - 1));
        steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
        form.style.setProperty("--progress", String((i + 1) / steps.length));
        progress.forEach((p) => {
          const tpl = p.dataset.progress || "Step {n} of {total}";
          p.textContent = tpl.replace("{n}", i + 1).replace("{total}", steps.length);
        });
      };
      const valid = () => {
        const fields = [...steps[i].querySelectorAll("input, select, textarea")];
        for (const f of fields) if (!f.checkValidity()) { f.reportValidity(); f.focus(); return false; }
        return true;
      };
      form.addEventListener("click", (e) => {
        if (e.target.closest("[data-next]")) { e.preventDefault(); if (valid()) { show(i + 1); steps[i].querySelector("input, select, textarea, button")?.focus(); } }
        if (e.target.closest("[data-back]")) { e.preventDefault(); show(i - 1); }
      });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!valid()) return;
        steps.forEach((s) => s.classList.remove("is-active"));
        form.querySelectorAll("[data-next], [data-back], [type=submit]").forEach((b) => (b.hidden = true));
        if (success) { success.hidden = false; success.setAttribute("tabindex", "-1"); success.focus(); }
      });
      show(0);
    });

    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-prefill]");
      if (!el) return;
      for (const pair of el.dataset.prefill.split("&")) {
        const [name, value = ""] = pair.split("=").map(decodeURIComponent);
        document.querySelectorAll(`form [name="${CSS.escape(name)}"]`).forEach((f) => {
          if (f.type === "radio" || f.type === "checkbox") f.checked = f.value === value;
          else f.value = value;
          f.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }
    });
  }

  /* ---------------- sticky CTA ---------------- */
  function initSticky() {
    const bar = document.querySelector("[data-sticky-cta]");
    if (!bar) return;
    const hero = document.querySelector("[data-hero]") || document.querySelector("main section, section");
    if (!hero || !("IntersectionObserver" in window)) return bar.classList.add("is-visible");
    new IntersectionObserver(([e]) => bar.classList.toggle("is-visible", !e.isIntersecting)).observe(hero);
  }

  /* ---------------- numbers ---------------- */
  function fmt(value, { locale, currency, decimals = 0 } = {}) {
    const opts = currency ? { style: "currency", currency, maximumFractionDigits: decimals } : { maximumFractionDigits: decimals };
    try { return new Intl.NumberFormat(locale || document.documentElement.lang || "en", opts).format(value); }
    catch { return String(Math.round(value)); }
  }
  Kit.format = fmt;
  Kit.animateNumber = function animateNumber(el, to, opts = {}) {
    const from = Number(el.dataset.value ?? 0);
    el.dataset.value = String(to);
    if (reduceMotion || opts.duration === 0) { el.textContent = fmt(to, opts); return; }
    const dur = opts.duration ?? 450;
    const t0 = performance.now();
    cancelAnimationFrame(el._kitRaf);
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * eased, opts);
      if (p < 1) el._kitRaf = requestAnimationFrame(step);
    };
    el._kitRaf = requestAnimationFrame(step);
  };
  function initCounters() {
    document.querySelectorAll("[data-count-to]").forEach((el) => {
      const to = Number(el.dataset.countTo);
      const opts = { locale: el.dataset.locale, currency: el.dataset.currency, duration: 1200 };
      if (reduceMotion) return (el.textContent = fmt(to, opts));
      observeOnce(el, () => Kit.animateNumber(el, to, opts));
    });
  }

  /* =====================================================================
     Edit panel
     ===================================================================== */
  const FONTS = [
    // [family, weights, kind] — all with Latin Extended + Cyrillic on Google Fonts
    ["Onest", "300;400;500;600;700;800;900", "sans-serif"],
    ["Inter Tight", "300;400;500;600;700;800;900", "sans-serif"],
    ["Manrope", "300;400;500;600;700;800", "sans-serif"],
    ["Golos Text", "400;500;600;700;800;900", "sans-serif"],
    ["Geologica", "300;400;500;600;700;800;900", "sans-serif"],
    ["Commissioner", "300;400;500;600;700;800;900", "sans-serif"],
    ["Rubik", "300;400;500;600;700;800;900", "sans-serif"],
    ["Montserrat", "300;400;500;600;700;800;900", "sans-serif"],
    ["Jost", "300;400;500;600;700;800;900", "sans-serif"],
    ["Unbounded", "300;400;500;600;700;800;900", "sans-serif"],
    ["Oswald", "300;400;500;600;700", "sans-serif"],
    ["Tenor Sans", "400", "sans-serif"],
    ["Playfair Display", "400;500;600;700;800;900", "serif"],
    ["Cormorant Garamond", "300;400;500;600;700", "serif"],
    ["EB Garamond", "400;500;600;700;800", "serif"],
    ["Lora", "400;500;600;700", "serif"],
    ["Literata", "300;400;500;600;700;800;900", "serif"],
    ["Source Serif 4", "300;400;500;600;700;800;900", "serif"],
    ["Noto Serif Display", "300;400;500;600;700;800;900", "serif"],
    ["PT Serif", "400;700", "serif"],
    ["Prata", "400", "serif"],
    ["Forum", "400", "serif"],
  ];
  const loadedFonts = new Set();
  function loadFont(family) {
    const f = FONTS.find((x) => x[0] === family);
    if (!f || loadedFonts.has(family)) return;
    loadedFonts.add(family);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${f[1]}&display=swap`;
    document.head.appendChild(link);
  }
  const familyOf = (value) => (value.match(/^\s*["']?([^"',]+)["']?/) || [])[1]?.trim();

  const STORE_KEY = `kit-tweaks:${location.pathname}`;
  const NOTES_KEY = `kit-notes:${location.pathname}`;

  function readRootVars() {
    const vars = new Map();
    const visit = (rules) => {
      for (const r of rules) {
        if (r.cssRules && !r.selectorText) { visit(r.cssRules); continue; } // @media etc.
        if (r.selectorText && /(^|,)\s*:root\s*(,|$)/.test(r.selectorText)) {
          for (const name of r.style) if (name.startsWith("--") && !vars.has(name)) vars.set(name, r.style.getPropertyValue(name).trim());
        }
      }
    };
    for (const sheet of document.styleSheets) { try { visit(sheet.cssRules); } catch { /* cross-origin or file:// sheet */ } }
    // kit.css can't be read on file:// (unique origin) — add its knobs from computed style
    const cs = getComputedStyle(root);
    for (const name of ["--display-scale", "--heading-scale", "--body-scale"]) {
      const v = cs.getPropertyValue(name).trim();
      if (v && !vars.has(name)) vars.set(name, v);
    }
    return vars;
  }

  const isColor = (n, v) => /color/.test(n) || /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) || /^(rgb|hsl|oklch)a?\(/i.test(v);
  const groupOf = (n, v) =>
    n.startsWith("--font-") ? "Fonts" : n.endsWith("-scale") ? "Scale" : isColor(n, v) ? "Colors" : n.startsWith("--text-") ? "Type" : "Other";

  function cssPath(el) {
    const section = el.closest("[data-section], section, header, footer, nav, aside");
    const label = section?.dataset.section || section?.id || section?.tagName.toLowerCase() || "page";
    const parts = [];
    let n = el;
    while (n && n !== section && n !== document.body && parts.length < 4) {
      let s = n.tagName.toLowerCase();
      const cls = [...n.classList].find((c) => !/^(is-|kit-|k-)/.test(c));
      if (cls) s += "." + cls;
      const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [];
      if (same.length > 1) s += `:nth-of-type(${same.indexOf(n) + 1})`;
      parts.unshift(s);
      n = n.parentElement;
    }
    return `[${label}] ${parts.join(" > ") || el.tagName.toLowerCase()}`;
  }
  const snippet = (el) => (el.innerText || el.getAttribute("alt") || "").replace(/\s+/g, " ").trim().slice(0, 50);

  function applyTweaks(tweaks) {
    for (const [name, value] of Object.entries(tweaks || {})) {
      if (name.startsWith("--font-")) loadFont(familyOf(value));
      root.style.setProperty(name, value);
    }
  }

  const clientMode = root.dataset.kitPanel === "client"; // visitor-facing panel (see header)
  const state = {
    open: false,
    originals: new Map(),
    tweaks: storage.get(STORE_KEY) || {},
    texts: [],
    notes: storage.get(NOTES_KEY) || [],
    editing: false,
    pinning: false,
  };

  function initPanel() {
    // read the file's own values before saved tweaks are applied on top
    const vars = readRootVars();
    for (const [n, v] of vars) state.originals.set(n, v);
    // tweaks already applied to the file (e.g. by /revise) are no longer tweaks
    for (const [n, v] of Object.entries(state.tweaks)) if (state.originals.get(n) === v) delete state.tweaks[n];
    storage.set(STORE_KEY, state.tweaks);
    applyTweaks(state.tweaks);
    const host = document.createElement("div");
    host.id = "kit-panel-host";
    host.setAttribute("data-kit-ui", "");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  .chip, .panel, .pop { font: 13px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; color: #eee; }
  .chip { position: fixed; left: 12px; bottom: 12px; z-index: 2147483000; background: #222; border: 1px solid #444; border-radius: 99px; padding: 6px 10px; cursor: pointer; }
  .panel { position: fixed; right: 12px; top: 12px; bottom: 12px; width: 360px; z-index: 2147483001; background: #181818; border: 1px solid #333; border-radius: 10px; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgb(0 0 0 / .5); }
  @media (max-width: 600px) { .panel { left: 8px; right: 8px; top: auto; bottom: 8px; width: auto; height: 62vh; } }
  header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #333; }
  header b { flex: 1; font-size: 14px; }
  .tabs { display: flex; gap: 4px; padding: 8px 12px 0; }
  .tabs button { flex: 1; }
  button { font: inherit; color: #eee; background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 6px; padding: 6px 10px; cursor: pointer; min-height: 32px; }
  button:hover { background: #333; } button[aria-pressed="true"], .tabs button.on { background: #3b5bdb; border-color: #3b5bdb; }
  .body { flex: 1; overflow: auto; padding: 10px 12px; }
  h4 { margin: 14px 0 6px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #999; }
  .row { display: grid; grid-template-columns: 1fr 1.3fr; gap: 6px; align-items: center; margin: 4px 0; }
  .row label { color: #bbb; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row .ctl { display: flex; gap: 4px; align-items: center; min-width: 0; }
  .row.changed label { color: #8fb4ff; }
  input[type=text], select, textarea { width: 100%; min-width: 0; font: inherit; color: #eee; background: #111; border: 1px solid #3a3a3a; border-radius: 6px; padding: 5px 7px; }
  input[type=color] { width: 32px; height: 28px; padding: 0; border: 1px solid #3a3a3a; border-radius: 6px; background: none; flex: none; }
  input[type=range] { width: 100%; }
  .hint { color: #999; font-size: 12px; margin: 4px 0 8px; }
  .item { border: 1px solid #333; border-radius: 6px; padding: 6px 8px; margin: 6px 0; }
  .item .sel { color: #8fb4ff; font-size: 11px; word-break: break-all; }
  .item .x { float: right; min-height: 0; padding: 0 6px; }
  footer { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid #333; }
  footer button { flex: 1; }
  footer .primary { background: #3b5bdb; border-color: #3b5bdb; font-weight: 600; }
  .pop { position: absolute; z-index: 2147483002; width: 260px; background: #181818; border: 1px solid #444; border-radius: 8px; padding: 8px; box-shadow: 0 6px 24px rgb(0 0 0 / .5); }
  .pop textarea { height: 70px; resize: vertical; }
  .pop .acts { display: flex; gap: 6px; margin-top: 6px; } .pop .acts button { flex: 1; }
  .pin { position: absolute; z-index: 2147482999; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: #3b5bdb; color: #fff; font: 600 12px/22px system-ui, sans-serif; text-align: center; pointer-events: none; box-shadow: 0 0 0 2px #fff; }
  .out { width: 100%; height: 160px; margin-top: 8px; }
  .toast { color: #9fe0a8; font-size: 12px; min-height: 16px; }
</style>
<button class="chip" hidden>Tweaks on · edit</button>
<div class="panel" hidden role="dialog" aria-label="Design edit panel">
  <header><b>Edit design</b><button data-act="close" aria-label="Close">✕</button></header>
  <div class="tabs"><button data-tab="tokens" class="on">Tokens</button><button data-tab="text">Text</button><button data-tab="notes">Notes</button></div>
  <div class="body"></div>
  <footer><button data-act="reset">Reset all</button><button class="primary" data-act="copy">${clientMode ? "Copy my changes" : "Copy feedback"}</button></footer>
</div>
<div class="layer"></div>`;

    const $ = (s) => shadow.querySelector(s);
    const panel = $(".panel");
    const body = $(".body");
    const chip = $(".chip");
    const layer = $(".layer");
    let tab = "tokens";

    const current = (n) => state.tweaks[n] ?? state.originals.get(n) ?? "";

    const syncChip = () => {
      const edited = Object.keys(state.tweaks).length || state.notes.length || state.texts.length;
      chip.hidden = clientMode || state.open || !(Object.keys(state.tweaks).length || state.notes.length);
      document.querySelectorAll("[data-try-edit]").forEach((b) => b.toggleAttribute("data-edits", !!edited)); // lets the page's own button say "edits applied"
    };
    const save = () => { storage.set(STORE_KEY, state.tweaks); storage.set(NOTES_KEY, state.notes); syncChip(); };

    function setVar(name, value) {
      if (value === state.originals.get(name) || value === "") { delete state.tweaks[name]; root.style.removeProperty(name); }
      else { state.tweaks[name] = value; if (name.startsWith("--font-")) loadFont(familyOf(value)); root.style.setProperty(name, value); }
      save();
    }

    function renderTokens() {
      const groups = {};
      for (const [n, v] of vars) (groups[groupOf(n, v)] ||= []).push(n);
      const order = ["Fonts", "Scale", "Colors", "Type", "Other"];
      body.innerHTML = `<p class="hint">Changes apply live and are kept in this browser. ${clientMode ? 'Use "Copy my changes" to send them to me.' : 'Use "Copy feedback" to send them to /revise.'}</p>`;
      for (const g of order) {
        if (!groups[g]) continue;
        const h = document.createElement("h4");
        h.textContent = g;
        body.appendChild(h);
        for (const n of groups[g]) body.appendChild(tokenRow(n));
      }
    }

    function tokenRow(n) {
      const row = document.createElement("div");
      row.className = "row" + (n in state.tweaks ? " changed" : "");
      const label = document.createElement("label");
      label.textContent = n.replace(/^--/, "");
      label.title = `${n}: ${state.originals.get(n)}`;
      const ctl = document.createElement("div");
      ctl.className = "ctl";
      const val = current(n);
      const commit = (v) => { setVar(n, v); row.classList.toggle("changed", n in state.tweaks); };

      if (n.startsWith("--font-")) {
        const sel = document.createElement("select");
        const fam = familyOf(val);
        sel.innerHTML = `<option value="">${state.originals.get(n).slice(0, 28)} (original)</option>` +
          FONTS.map(([f, , kind]) => `<option value='"${f}", ${kind}' ${f === fam && n in state.tweaks ? "selected" : ""}>${f} · ${kind === "serif" ? "serif" : "sans"}</option>`).join("");
        sel.addEventListener("change", () => commit(sel.value || state.originals.get(n)));
        ctl.appendChild(sel);
      } else if (n.endsWith("-scale")) {
        const r = document.createElement("input");
        Object.assign(r, { type: "range", min: "0.6", max: "1.5", step: "0.02", value: val || "1" });
        const out = document.createElement("span");
        out.textContent = Number(r.value).toFixed(2);
        r.addEventListener("input", () => { out.textContent = Number(r.value).toFixed(2); commit(r.value); });
        ctl.append(r, out);
      } else {
        const t = document.createElement("input");
        Object.assign(t, { type: "text", value: val });
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val) || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(state.originals.get(n))) {
          const c = document.createElement("input");
          c.type = "color";
          const hex = /^#([0-9a-f]{3})$/i.test(val) ? "#" + [...val.slice(1)].map((x) => x + x).join("") : val;
          c.value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000";
          c.addEventListener("input", () => { t.value = c.value; commit(c.value); });
          ctl.appendChild(c);
        }
        t.addEventListener("change", () => commit(t.value.trim()));
        ctl.appendChild(t);
      }
      row.append(label, ctl);
      return row;
    }

    function renderText() {
      body.innerHTML = `
        <p class="hint">Turn on, click any text on the page and type. Links don't navigate while this is on.</p>
        <button data-act="edit" aria-pressed="${state.editing}">${state.editing ? "Editing text — click to stop" : "Edit text on page"}</button>
        <h4>Changed (${state.texts.length})</h4>`;
      state.texts.forEach((t, i) => {
        const d = document.createElement("div");
        d.className = "item";
        d.innerHTML = `<button class="x" data-undo="${i}" title="Undo">↺</button><div class="sel"></div><div></div>`;
        d.children[1].textContent = t.selector;
        d.children[2].textContent = `“${t.before.slice(0, 60)}” → “${t.after.slice(0, 60)}”`;
        body.appendChild(d);
      });
    }

    function renderNotes() {
      body.innerHTML = `
        <p class="hint">Turn on, click any element on the page and write what to change. Pins stay on the page.</p>
        <button data-act="pin" aria-pressed="${state.pinning}">${state.pinning ? "Click an element… (click here to stop)" : "Add notes on page"}</button>
        <h4>Notes (${state.notes.length})</h4>`;
      state.notes.forEach((n, i) => {
        const d = document.createElement("div");
        d.className = "item";
        d.innerHTML = `<button class="x" data-del="${i}" title="Delete">✕</button><div class="sel"></div><div></div>`;
        d.children[1].textContent = `${i + 1}. ${n.selector}${n.text ? ` (“${n.text}”)` : ""}`;
        d.children[2].textContent = n.note;
        body.appendChild(d);
      });
    }

    function renderPins() {
      layer.querySelectorAll(".pin").forEach((p) => p.remove());
      state.notes.forEach((n, i) => {
        const p = document.createElement("div");
        p.className = "pin";
        p.style.left = n.x + "px";
        p.style.top = n.y + "px";
        p.textContent = String(i + 1);
        layer.appendChild(p);
      });
    }

    const render = () => {
      shadow.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
      ({ tokens: renderTokens, text: renderText, notes: renderNotes })[tab]();
      renderPins();
      syncChip();
    };

    /* text editing */
    const TEXT_SEL = "h1,h2,h3,h4,h5,h6,p,li,a,button,label,summary,dt,dd,blockquote,figcaption,small,strong,em,span,td,th";
    const editables = () => [...document.body.querySelectorAll(TEXT_SEL)].filter((el) => !el.closest("[data-kit-ui]") && el.innerText?.trim() && ![...el.children].some((c) => c.matches("h1,h2,h3,p,li,div")));
    const before = new WeakMap();
    function setEditing(on) {
      state.editing = on;
      if (on) { setPinning(false); }
      root.classList.toggle("kit-editing", on);
      editables().forEach((el) => {
        if (on) { el.setAttribute("contenteditable", "true"); el.spellcheck = false; }
        else el.removeAttribute("contenteditable");
      });
      render();
    }
    document.addEventListener("focusin", (e) => { if (state.editing && e.target.isContentEditable && !before.has(e.target)) before.set(e.target, e.target.innerText); });
    document.addEventListener("focusout", (e) => {
      const el = e.target;
      if (!state.editing || !before.has(el)) return;
      const was = before.get(el).trim();
      const now = el.innerText.trim();
      const sel = cssPath(el);
      const existing = state.texts.findIndex((t) => t.el === el);
      if (now === was) { if (existing > -1) state.texts.splice(existing, 1); }
      else if (existing > -1) state.texts[existing].after = now;
      else state.texts.push({ el, selector: sel, before: was, after: now });
      if (tab === "text") render();
    });
    document.addEventListener("click", (e) => { if (state.editing && e.target.closest("a[href]") && !e.target.closest("[data-kit-ui]")) e.preventDefault(); }, true);

    /* notes */
    function setPinning(on) {
      state.pinning = on;
      if (on) state.editing && setEditing(false);
      root.style.cursor = on ? "crosshair" : "";
      render();
    }
    document.addEventListener("click", (e) => {
      if (!state.pinning || e.composedPath().includes(host)) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.target;
      const x = e.pageX, y = e.pageY;
      layer.querySelector(".pop")?.remove();
      const pop = document.createElement("div");
      pop.className = "pop";
      pop.style.left = Math.min(x + 8, window.scrollX + innerWidth - 276) + "px";
      pop.style.top = y + 8 + "px";
      pop.innerHTML = `<div class="sel"></div><textarea placeholder="What should change here?"></textarea><div class="acts"><button data-pop="cancel">Cancel</button><button data-pop="save" class="primary">Save note</button></div>`;
      pop.querySelector(".sel").textContent = cssPath(target);
      layer.appendChild(pop);
      const ta = pop.querySelector("textarea");
      ta.focus();
      pop.addEventListener("click", (ev) => {
        const act = ev.target.dataset.pop;
        if (act === "save" && ta.value.trim()) {
          state.notes.push({ selector: cssPath(target), text: snippet(target), note: ta.value.trim(), x, y });
          save();
        }
        if (act) { pop.remove(); render(); }
      });
      ta.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) pop.querySelector('[data-pop="save"]').click(); if (ev.key === "Escape") pop.remove(); });
    }, true);

    /* export */
    function feedbackText() {
      const meta = document.querySelector('meta[name="kit-source"]')?.content.trim().split(/\s+/); // set by export-final
      const m = meta?.length === 2 ? [null, ...meta] : location.pathname.match(/clients\/([^/]+)\/prototype\/([^/]+)\//);
      if (clientMode) return clientFeedbackText();
      const lines = [m ? `/revise ${m[1]} ${m[2]}` : "/revise <client> <variant>", "Apply exactly these changes from the edit panel (don't redesign anything else):", ""];
      const tw = Object.entries(state.tweaks);
      if (tw.length) {
        lines.push("TOKENS (:root):");
        for (const [n, v] of tw) lines.push(`  ${n}: ${v};   /* was: ${state.originals.get(n) ?? "unset"} */`);
        if (tw.some(([n]) => n.startsWith("--font-"))) lines.push("  (fonts are from Google Fonts — load them in <head> and keep a fallback)");
        lines.push("");
      }
      if (state.texts.length) {
        lines.push("TEXT:");
        for (const t of state.texts) lines.push(`  ${t.selector}: “${t.before}” → “${t.after}”`);
        lines.push("");
      }
      if (state.notes.length) {
        lines.push("NOTES:");
        state.notes.forEach((n, i) => lines.push(`  ${i + 1}. ${n.selector}${n.text ? ` (“${n.text}”)` : ""}: ${n.note}`));
        lines.push("");
      }
      if (lines.length === 3) lines.push("(no changes yet)");
      return lines.join("\n");
    }
    function clientFeedbackText() {
      const nice = (n) => n.replace(/^--/, "").replace(/-/g, " ");
      const lines = ["My changes to the design:", ""];
      const tw = Object.entries(state.tweaks);
      if (tw.length) {
        lines.push("Look:");
        for (const [n, v] of tw) lines.push(`  - ${nice(n)}: ${v} (was ${state.originals.get(n) ?? "default"})`);
        lines.push("");
      }
      if (state.texts.length) {
        lines.push("Text:");
        for (const t of state.texts) lines.push(`  - “${t.before}” → “${t.after}”`);
        lines.push("");
      }
      if (state.notes.length) {
        lines.push("Comments:");
        state.notes.forEach((n, i) => lines.push(`  ${i + 1}. ${n.text ? `“${n.text}”: ` : ""}${n.note}`));
        lines.push("");
      }
      if (lines.length === 2) lines.push("(no changes yet)");
      return lines.join("\n");
    }
    async function copyFeedback() {
      const text = feedbackText();
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch { /* fall through */ }
      if (!ok) {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand("copy"); } catch { /* ignore */ }
        ta.remove();
      }
      body.insertAdjacentHTML("afterbegin", `<p class="toast">${ok ? (clientMode ? "Copied — paste it into a message to me." : "Copied — paste it into Claude Code.") : "Copy failed — select the text below."}</p>`);
      if (!ok) { const out = document.createElement("textarea"); out.className = "out"; out.value = text; body.prepend(out); out.select(); }
      Kit._lastFeedback = text;
    }
    Kit.feedback = feedbackText;

    /* wiring */
    shadow.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; render(); }
      const act = b.dataset.act;
      if (act === "close") toggle(false);
      if (act === "copy") copyFeedback();
      if (act === "edit") setEditing(!state.editing);
      if (act === "pin") setPinning(!state.pinning);
      if (act === "reset" && confirmReset()) {
        state.tweaks = {}; state.notes = [];
        for (const n of state.originals.keys()) root.style.removeProperty(n);
        state.texts.forEach((t) => { if (t.el.isConnected) t.el.innerText = t.before; });
        state.texts = [];
        save(); render();
      }
      if (b.dataset.undo) { const t = state.texts.splice(Number(b.dataset.undo), 1)[0]; if (t?.el.isConnected) t.el.innerText = t.before; render(); }
      if (b.dataset.del) { state.notes.splice(Number(b.dataset.del), 1); save(); render(); }
    });
    let resetArmed = 0;
    function confirmReset() { // two clicks within 2 s, no browser dialog
      const now = Date.now();
      if (now - resetArmed < 2000) { resetArmed = 0; return true; }
      resetArmed = now;
      body.insertAdjacentHTML("afterbegin", `<p class="toast">Click "Reset all" again to confirm.</p>`);
      return false;
    }
    chip.addEventListener("click", () => toggle(true));

    function toggle(on) {
      state.open = on ?? !state.open;
      panel.hidden = !state.open;
      if (!state.open) { setEditing(false); setPinning(false); }
      layer.querySelector(".pop")?.remove();
      render();
    }
    Kit.openPanel = () => toggle(true);
    if (!clientMode) document.addEventListener("keydown", (e) => {
      if (e.shiftKey && (e.key === "E" || e.key === "e") && !e.target.isContentEditable && !/input|textarea|select/i.test(e.target.tagName)) toggle();
    });
    if (!clientMode) window.addEventListener("hashchange", () => { if (location.hash === "#edit") toggle(true); });
    if (!clientMode && (location.hash === "#edit" || /[?&]edit\b/.test(location.search))) toggle(true);
    render();
  }

  ready(() => {
    initTicker();
    initReveal();
    initMenu();
    initSteps();
    initSticky();
    initCounters();
    // <html data-kit-panel="off"> (export-final default) removes the edit panel entirely
    if (root.dataset.kitPanel !== "off") {
      try { initPanel(); } catch (err) { console.warn("Kit panel failed:", err); }
    }
  });
})();
