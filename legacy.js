"use strict";

(() => {
  const body = document.body;
  const root = document.documentElement;
  const loader = document.querySelector(".loader");
  const menuButton = document.querySelector(".menu-button");
  const menuPanel = document.querySelector(".menu-panel");
  const spine = document.querySelector(".scroll-spine span");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Loading screen always exits, even if a remote font is slow. */
  body.classList.add("is-loading");
  let loaderFinished = false;
  function finishLoading() {
    if (loaderFinished) return;
    loaderFinished = true;
    loader?.classList.add("is-done");
    body.classList.remove("is-loading");
  }
  if (document.readyState === "complete") finishLoading();
  else {
    window.addEventListener("load", finishLoading, { once: true });
    window.setTimeout(finishLoading, 1800);
  }

  /* Split text while preserving existing inline structure and line breaks. */
  function splitText(element) {
    if (element.dataset.splitDone === "true") return;
    element.dataset.splitDone = "true";
    /* screen readers get the real heading text instead of one letter at a time */
    const clone = element.cloneNode(true);
    clone.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
    element.setAttribute("aria-label", clone.textContent.replace(/\s+/g, " ").trim());
    let index = 0;

    function walk(node) {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const fragment = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { fragment.appendChild(document.createTextNode(" ")); return; }
            const word = document.createElement("span"); /* keeps words from breaking mid-word on small screens */
            word.className = "split-word";
            word.setAttribute("aria-hidden", "true");
            for (const character of part) {
              const span = document.createElement("span");
              span.className = "char";
              span.style.setProperty("--char-index", Math.min(index++, 48));
              span.textContent = character;
              word.appendChild(span);
            }
            fragment.appendChild(word);
          });
          child.replaceWith(fragment);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
          walk(child);
        }
      });
    }
    walk(element);
  }

  function revealEverything() {
    document.querySelectorAll(".reveal, [data-split], .hero__title").forEach((element) => {
      element.classList.add("is-visible");
    });
  }

  try {
    document.querySelectorAll("[data-split]").forEach(splitText);
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEverything();
    } else {
      root.classList.add("js-ready");
      
      // Trigger hero reveal immediately on load
      const heroTitle = document.querySelector(".hero__title");
      if (heroTitle) heroTitle.classList.add("is-visible");

      const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });

      document.querySelectorAll(".reveal, [data-split]").forEach((element) => observer.observe(element));
      requestAnimationFrame(() => {
        document.querySelectorAll(".reveal, [data-split]").forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.94 && rect.bottom > 0) {
            element.classList.add("is-visible");
            observer.unobserve(element);
          }
        });
      });
    }
  } catch (error) {
    console.error("Animation initialization failed:", error);
    root.classList.remove("js-ready");
    revealEverything();
  }

  /* Scroll-linked ambience and progress indicator. */
  const parallaxElements = [...document.querySelectorAll(".parallax")];
  let targetScroll = window.scrollY;
  let currentScroll = targetScroll;
  let frame = 0;

  function updateMotion() {
    frame = 0;
    if (reduceMotion) return;
    currentScroll += (targetScroll - currentScroll) * 0.14;
    if (Math.abs(targetScroll - currentScroll) < 0.15) currentScroll = targetScroll;

    parallaxElements.forEach((element) => {
      const speed = Number(element.dataset.speed || 0);
      const rect = element.getBoundingClientRect();
      const distance = rect.top + rect.height / 2 - window.innerHeight / 2;
      element.style.transform = `translate3d(0, ${distance * speed}px, 0)`;
    });

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? currentScroll / maxScroll : 0;
    if (spine) spine.style.transform = `scaleY(${Math.max(0, Math.min(1, progress))})`;
    if (Math.abs(targetScroll - currentScroll) >= 0.15) frame = requestAnimationFrame(updateMotion);
  }

  function requestMotion() {
    targetScroll = window.scrollY;
    if (!reduceMotion && !frame) frame = requestAnimationFrame(updateMotion);
  }
  window.addEventListener("scroll", requestMotion, { passive: true });
  window.addEventListener("resize", () => {
    targetScroll = currentScroll = window.scrollY;
    if (frame) cancelAnimationFrame(frame);
    frame = reduceMotion ? 0 : requestAnimationFrame(updateMotion);
  });
  if (!reduceMotion) frame = requestAnimationFrame(updateMotion);

  /* Full-screen menu, including keyboard and focus-friendly state. */
  function closeMenu() {
    if (!menuButton || !menuPanel) return;
    menuPanel.classList.remove("is-open");
    menuButton.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    menuPanel.setAttribute("aria-hidden", "true");
    body.style.overflow = "";
    document.querySelectorAll("main, footer").forEach((el) => { el.inert = false; });
  }

  if (menuButton && menuPanel) {
    menuButton.addEventListener("click", () => {
      const open = !menuPanel.classList.contains("is-open");
      menuPanel.classList.toggle("is-open", open);
      menuButton.classList.toggle("is-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menuPanel.setAttribute("aria-hidden", String(!open));
      body.style.overflow = open ? "hidden" : "";
      document.querySelectorAll("main, footer").forEach((el) => { el.inert = open; });
      if (open) menuPanel.querySelector("a")?.focus({ preventScroll: true });
    });
    menuPanel.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  /* Light magnetic response on larger pointer devices only. */
  if (!reduceMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".magnetic").forEach((button) => {
      button.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.10;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.10;
        button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
      button.addEventListener("pointerleave", () => { button.style.transform = ""; });
    });
  }

  /* Application form: posts to Formspree when an endpoint is set; otherwise opens an email draft. */
  const applicationForm = document.querySelector("#application-form");
  if (applicationForm) {
    const status = document.querySelector("#form-status");
    const submitButton = applicationForm.querySelector('button[type="submit"]');
    const endpoint = applicationForm.dataset.endpoint || "";
    const hasEndpoint = endpoint !== "" && !endpoint.includes("YOUR_FORM_ID");
    const isAppsScript = /script\.google(usercontent)?\.com/.test(endpoint);
    const careersEmail = "studio@archcollectivegh.com";
    applicationForm.setAttribute("novalidate", ""); /* we show our own inline messages instead of browser pop-ups */
    if (hasEndpoint && submitButton) submitButton.textContent = "SUBMIT APPLICATION ↗";

    const style = document.createElement("style");
    style.textContent = ".field-error{color:#911700;font-size:13px;margin:6px 0 0}.form-field.has-error input,.form-field.has-error textarea,.form-field.has-error select{border-color:#911700}";
    document.head.appendChild(style);

    function setStatus(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle("is-error", Boolean(isError));
    }
    const fields = () => [...applicationForm.elements].filter((el) => el.name && el.name !== "_gotcha" && el.type !== "submit" && el.tagName !== "BUTTON");
    function errorFor(input) {
      const value = (input.value || "").trim();
      if (input.required && value === "") return "This field is required.";
      if (input.type === "email" && value !== "" && input.validity.typeMismatch) return "Please enter a valid email address.";
      if (value !== "" && !input.checkValidity()) return input.validationMessage;
      return "";
    }
    function showError(input, message) {
      const wrap = input.closest(".form-field") || input.parentElement;
      let el = wrap.querySelector(".field-error");
      if (!message) {
        if (el) el.remove();
        wrap.classList.remove("has-error");
        input.removeAttribute("aria-invalid");
        input.removeAttribute("aria-describedby");
        return;
      }
      if (!el) { el = document.createElement("p"); el.className = "field-error"; el.id = (input.id || input.name) + "-error"; wrap.appendChild(el); }
      el.textContent = message;
      wrap.classList.add("has-error");
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", el.id);
    }
    applicationForm.addEventListener("focusout", (e) => { if (e.target.name && e.target.name !== "_gotcha" && e.target.matches("input,textarea,select")) showError(e.target, errorFor(e.target)); });
    applicationForm.addEventListener("input", (e) => { const wrap = e.target.closest && e.target.closest(".form-field"); if (wrap && wrap.classList.contains("has-error")) showError(e.target, errorFor(e.target)); });

    function labelFor(key) {
      const el = applicationForm.elements[key];
      const label = el && ((el.labels && el.labels[0]) || (el.closest && el.closest(".form-field") && el.closest(".form-field").querySelector("label")));
      return label ? label.textContent.replace(/\s*\*+\s*$/, "").trim() : key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    }
    async function copyText(text) {
      try { await navigator.clipboard.writeText(text); return true; } catch (e) {
        try { const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch (e2) { return false; }
      }
    }

    applicationForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      let firstBad = null;
      fields().forEach((f) => { const m = errorFor(f); showError(f, m); if (m && !firstBad) firstBad = f; });
      if (firstBad) {
        firstBad.focus({ preventScroll: true });
        firstBad.scrollIntoView({ block: "center", behavior: "smooth" });
        setStatus("Please check the highlighted fields.", true);
        return;
      }
      const values = new FormData(applicationForm);
      if (values.get("_gotcha")) { setStatus("Thank you. Your application has been sent.", false); return; } /* honeypot: bots fill this, people never see it */
      values.delete("_gotcha");
      [...values.entries()].forEach(([k, v]) => { if (typeof v === "string") values.set(k, v.trim()); });
      const subject = `Host Team Application — ${values.get("firstName")} ${values.get("lastName")}`;

      if (hasEndpoint) {
        if (navigator.onLine === false) { setStatus("You seem to be offline. Please check your connection and try again.", true); return; }
        values.set("_subject", subject);
        if (submitButton) submitButton.disabled = true;
        setStatus("Sending your application…", false);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
          if (isAppsScript) { /* Google Apps Script: sends the email and saves a row in the client's Google Sheet */
            values.set("_labels", JSON.stringify(Object.fromEntries(fields().map((f) => [f.name, labelFor(f.name)]))));
            const response = await fetch(endpoint, { method: "POST", body: new URLSearchParams(values), signal: controller.signal });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data || data.ok !== true) throw new Error("Apps Script rejected the submission");
          } else {
            const response = await fetch(endpoint, { method: "POST", body: values, headers: { Accept: "application/json" }, signal: controller.signal });
            if (!response.ok) throw new Error(`Form service responded ${response.status}`);
          }
          applicationForm.reset();
          fields().forEach((f) => showError(f, ""));
          setStatus("Thank you. Your application has been sent.", false);
          if (status) status.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch (error) {
          console.error("Application submit failed:", error);
          setStatus(`Something went wrong, and your answers are still here. Please try again, or email ${careersEmail}.`, true);
        } finally {
          clearTimeout(timer);
          if (submitButton) submitButton.disabled = false;
        }
        return;
      }

      /* Fallback: no form service configured yet, so open a pre-filled email draft (full answers are also copied). */
      const text = [...values.entries()].filter(([, v]) => v !== "").map(([k, v]) => `${labelFor(k)}\n${v}`).join("\n\n");
      const mailto = (body) => `mailto:${careersEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const copied = await copyText(text);
      let url = mailto(text);
      if (url.length > 1800) url = mailto("Hello,\n\nMy full application is copied to my clipboard. I'm pasting it below.\n\n");
      setStatus(copied ? "Your email draft is opening. A copy of your answers is on your clipboard in case you need to paste them in." : `Your email draft is opening. If it does not, please email ${careersEmail}.`, false);
      window.location.href = url;
    });
  }

  /* Brief sections: each "read more" button opens its panel in place. Without JS everything stays visible. */
  const toggles = [...document.querySelectorAll(".more-toggle")];
  if (toggles.length) {
    root.classList.add("js-more");
    toggles.forEach((button) => {
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      const label = button.querySelector(".more-toggle__label");
      if (!panel) return;
      panel.inert = true;
      button.addEventListener("click", () => {
        const open = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(open));
        panel.classList.toggle("is-open", open);
        panel.inert = !open;
        if (label) label.textContent = open ? button.dataset.open : button.dataset.closed;
      });
    });
  }
})();
