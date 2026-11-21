(() => {
  const d = document, $ = (s) => d.querySelector(s);
  const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = $(".stage");
  let tick = 0;
  if (rm) d.documentElement.classList.add("rm");
  function frame() {
    tick = 0;
    const y = scrollY;
    if (stage) { /* the panel grows from a card to full screen as you scroll through the stage */
      const p = rm ? 1 : Math.min(1, Math.max(0, y / Math.max(1, (stage.offsetHeight - innerHeight) * 0.55))); /* fully open at 55% of the pinned scroll, then holds full screen */
      stage.style.setProperty("--p", (p * p * (3 - 2 * p)).toFixed(4));
    }
    d.body.classList.toggle("is-scrolled", y > 80);
  }
  addEventListener("scroll", () => { tick = tick || requestAnimationFrame(frame); }, { passive: true });
  addEventListener("resize", frame);
  addEventListener("orientationchange", frame);
  if (window.visualViewport) visualViewport.addEventListener("resize", frame);
  frame();

  const menuButton = $(".bar__menu"), menu = $("#menu");
  menu.inert = true;
  const setMenu = (open, refocus) => {
    menu.classList.toggle("is-open", open);
    menu.inert = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    d.body.style.overflow = open ? "hidden" : "";
    if (!open && refocus) menuButton.focus();
  };
  menuButton.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false, true); });

  /* Brief sections: buttons open their panel in place. Without JS everything stays visible. */
  const toggles = [...d.querySelectorAll(".more-toggle")];
  if (toggles.length) d.documentElement.classList.add("js-more");
  toggles.forEach((button) => {
    const panel = d.getElementById(button.getAttribute("aria-controls")), label = button.querySelector("em");
    panel.inert = true;
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      panel.classList.toggle("is-open", open);
      panel.inert = !open;
      label.textContent = open ? button.dataset.open : button.dataset.closed;
    });
  });

  /* Hero playlist: up to 7 clips play one after another and crossfade. Missing files are skipped. */
  const clips = [...d.querySelectorAll(".clip")], dotBox = $(".stage__dots");
  if (clips.length) {
    const alive = new Set(clips);
    let idx = 0;
    const dots = clips.map((clip, i) => {
      const b = d.createElement("button");
      b.type = "button"; b.setAttribute("aria-label", "Show clip " + (i + 1));
      b.addEventListener("click", () => { if (alive.has(clip)) show(i); });
      dotBox.appendChild(b); return b;
    });
    const next = (i) => { for (let k = 1; k <= clips.length; k++) { const j = (i + k) % clips.length; if (alive.has(clips[j])) return j; } return i; };
    function show(i) {
      idx = i;
      clips.forEach((c, n) => { c.classList.toggle("is-active", n === i); dots[n].classList.toggle("is-active", n === i); });
      const c = clips[i]; c.currentTime = 0;
      if (!rm) { const p = c.play(); if (p) p.catch(() => {}); }
      const n = clips[next(i)]; /* start fetching the next clip only now, to save data */
      if (n.preload !== "auto") { n.preload = "auto"; n.load(); }
    }
    clips.forEach((c, i) => {
      c.addEventListener("ended", () => show(next(i)));
      c.addEventListener("error", () => {
        alive.delete(c); dots[i].hidden = true; c.classList.remove("is-active");
        if (alive.size && idx === i) show(next(i));
      });
    });
    show(0);
    if (!rm && "IntersectionObserver" in window) new IntersectionObserver(([e]) => { /* pause when the hero is off screen */
      const c = clips[idx]; if (!c || !alive.has(c)) return;
      if (e.isIntersecting) { const p = c.play(); if (p) p.catch(() => {}); } else c.pause();
    }).observe(stage);
  }
})();
