(() => {
  const cfg = window.ARCH_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---- mobile menu ---- */
  const header = $("header"), menuBtn = $(".menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => menuBtn.setAttribute("aria-expanded", String(header.classList.toggle("open"))));
    header.addEventListener("click", (e) => { if (e.target.closest(".nav-all a")) { header.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); } });
  }

  /* ---- enquiry pop-up (only appears when a button is clicked) ---- */
  const dlg = $("#enquiry");
  if (dlg) {
    const open = () => { if (!dlg.open) { dlg.showModal(); document.body.style.overflow = "hidden"; } };
    dlg.addEventListener("close", () => { document.body.style.overflow = ""; if (location.hash === "#enquiry") history.replaceState(null, "", location.pathname + location.search); });
    document.addEventListener("click", (e) => { if (e.target.closest("[data-enquire]")) { e.preventDefault(); header && header.classList.remove("open"); open(); } });
    $(".enq-close", dlg).addEventListener("click", () => dlg.close());
    if (location.hash === "#enquiry") open();
  }

  /* ---- What we do: tabs + gallery (content comes from portfolio.js) ---- */
  const data = window.ARCH_PORTFOLIO || [], list = $("#serviceList"), detail = $("#serviceDetail");
  if (list && detail && data.length) {
    const pad = (n) => String(n).padStart(2, "0");
    const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
    let cat = 0, idx = 0;
    const buttons = data.map((c, i) => {
      const b = el("button", "service-button", `<span class="num">${pad(i + 1)}</span><span class="name"></span><span class="arrow">↗</span>`);
      b.type = "button"; b.setAttribute("role", "tab"); $(".name", b).textContent = c.title;
      b.addEventListener("click", () => { select(i); if (matchMedia("(max-width:760px)").matches) detail.scrollIntoView({ behavior: "smooth", block: "start" }); });
      list.appendChild(b); return b;
    });
    detail.innerHTML = `<div class="detail-media"><div class="detail-image" id="stage"></div><div class="thumbs" id="thumbs"></div></div><div class="detail-copy"><span class="number" id="dNum"></span><h3 id="dTitle"></h3><p id="dText"></p><div class="detail-caption" id="dCap"></div></div>`;
    const stage = $("#stage"), thumbs = $("#thumbs");
    function show(k) {
      const items = data[cat].items; idx = (k + items.length) % items.length; const it = items[idx];
      stage.innerHTML = "";
      if (it.video) { const v = el("video"); v.controls = true; v.playsInline = true; v.preload = "none"; v.poster = it.poster || ""; v.setAttribute("aria-label", it.alt || ""); v.innerHTML = `<source src="${it.video}" type="video/mp4">`; stage.appendChild(v); }
      else { const im = el("img"); im.src = it.src; im.alt = it.alt || ""; stage.appendChild(im); }
      if (items.length > 1) for (const [cls, label, ch, d] of [["prev", "Previous", "‹", -1], ["next", "Next", "›", 1]]) { const a = el("button", "arrow-btn " + cls, ch); a.type = "button"; a.setAttribute("aria-label", label); a.addEventListener("click", () => show(idx + d)); stage.appendChild(a); }
      $$(".thumb", thumbs).forEach((t, n) => t.setAttribute("aria-current", String(n === idx)));
    }
    function select(i) {
      cat = i; const c = data[i];
      buttons.forEach((b, n) => b.setAttribute("aria-selected", String(n === i)));
      $("#dNum").textContent = `${pad(i + 1)} / ${pad(data.length)}`; $("#dTitle").textContent = c.title; $("#dText").textContent = c.description; $("#dCap").textContent = c.caption || "";
      thumbs.innerHTML = ""; thumbs.hidden = c.items.length < 2;
      c.items.forEach((it, n) => { const t = el("button", "thumb"); t.type = "button"; t.setAttribute("aria-label", "Show item " + (n + 1)); t.innerHTML = `<img src="${it.poster || it.src}" alt="" loading="lazy">` + (it.video ? "<i>▶</i>" : ""); t.addEventListener("click", () => show(n)); thumbs.appendChild(t); });
      show(0);
    }
    select(0);
  }

  /* ---- forms: save to the Google Sheet + email (or open an email draft if no endpoint is set yet) ---- */
  async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } }
  function bindForm(form, sheet, subject) {
    const status = $(".form-status", form), btn = $('button[type="submit"]', form);
    const say = (m, err) => { status.textContent = m; status.classList.toggle("err", Boolean(err)); };
    const labelOf = (n) => { const f = form.elements[n]; const l = f && f.labels && f.labels[0]; return l ? l.textContent.replace(/\s*\*\s*$/, "").trim() : n; };
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const v = new FormData(form);
      if (v.get("_gotcha")) { say("Thank you. We have received your details."); return; } /* spam trap */
      v.delete("_gotcha");
      [...v.entries()].forEach(([k, x]) => { if (typeof x === "string") v.set(k, x.trim()); });
      const subj = subject(v), ep = cfg.formEndpoint;
      if (ep) {
        if (navigator.onLine === false) { say("You seem to be offline. Please check your connection and try again.", true); return; }
        v.set("_sheet", sheet); v.set("_subject", subj);
        v.set("_labels", JSON.stringify(Object.fromEntries([...new Set([...v.keys()])].filter((k) => k[0] !== "_").map((k) => [k, labelOf(k)]))));
        btn.disabled = true; say("Sending…");
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
        try {
          const r = await fetch(ep, { method: "POST", body: new URLSearchParams(v), signal: ctl.signal });
          const d = await r.json().catch(() => null);
          if (!r.ok || !d || d.ok !== true) throw new Error("Not accepted");
          form.reset(); say("Thank you. We have your details and will be in touch soon.");
        } catch (e) { console.error(e); say(`Something went wrong, and your answers are still here. Please try again, or email ${cfg.email}.`, true); }
        finally { clearTimeout(tm); btn.disabled = false; }
        return;
      }
      const text = [...v.entries()].filter(([, x]) => x !== "").map(([k, x]) => `${labelOf(k)}\n${x}`).join("\n\n");
      const copied = await copyText(text);
      const mail = (b) => `mailto:${cfg.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(b)}`;
      let url = mail(text);
      if (url.length > 1800) url = mail("Hello,\n\nMy details are copied to my clipboard. I am pasting them below.\n\n");
      say(copied ? "Your email draft is opening. A copy of your details is on your clipboard too." : `Your email draft is opening. If it does not, please email ${cfg.email}.`);
      location.href = url;
    });
  }
  const enq = $("#enquiryForm"); if (enq) bindForm(enq, "Enquiries", (v) => `New enquiry: ${v.get("name")} (${v.get("service")})`);
  const app = $("#applicationForm"); if (app) bindForm(app, "Applications", (v) => `Application: ${v.get("position")} - ${v.get("firstName")} ${v.get("lastName")}`);

  /* ---- application page: the role comes from the link (?role=art-director) and can be changed ---- */
  const role = $("#position");
  if (role) {
    const names = { "host-team": "Host Team", "art-director": "Art Director", strategist: "Strategist", other: "Other" };
    const q = new URLSearchParams(location.search).get("role"); if (names[q]) role.value = names[q];
    const upd = () => { const n = role.value || "Open application"; $("#roleName").textContent = n; document.title = `Careers / ${n} | The Arch Collective`; };
    role.addEventListener("change", upd); upd();
  }
})();
