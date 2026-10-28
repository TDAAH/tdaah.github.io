// Side Effects Are WHAT?! page: the "Get Kickstarter Updates" buttons and the How to Play walkthrough.
// The signup form itself is handled by site.js.

// Buttons that go to the signup form: scroll there, then put the cursor in the email field.
(function () {
  const signup = document.getElementById('signup');
  const email = document.getElementById('signup-email');
  if (!signup) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-scroll-to-signup]');
    if (!link) return;
    e.preventDefault();
    signup.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#signup');
    // Focusing without scrolling keeps the smooth scroll going.
    const target = email && !email.closest('[hidden]') ? email : signup;
    window.setTimeout(() => target.focus({ preventScroll: true }), reduce.matches ? 0 : 500);
  });
})();

// The How to Play walkthrough. The page is built showing the finished round, so this rewinds it to
// step 1. The stage has classes has-1..has-N for the steps shown so far (which cards are laid out)
// and did-1..did-N for the steps that have played (which cards are flipped, placed or scored).
// Adding did-N a frame after has-N is what makes the newest step's cards animate in.
(function () {
  const root = document.getElementById('ht');
  const stage = document.getElementById('ht-stage');
  if (!root || !stage) return;
  const STEPS = 5;
  const panels = root.querySelectorAll('[data-panel]');
  const dots = root.querySelectorAll('[data-goto]');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  const replay = root.querySelector('[data-replay]');
  const count = root.querySelector('[data-count]');
  const progress = root.querySelector('.ht-progress');
  let step = 1;
  let played = 0;
  let timer = 0;

  const setClasses = (prefix, upTo) => {
    for (let k = 1; k <= STEPS; k++) stage.classList.toggle(prefix + k, k <= upTo);
  };

  // Show step n. animate is false only for the very first render.
  function go(n, animate) {
    step = Math.min(STEPS, Math.max(1, n));
    window.clearTimeout(timer);
    setClasses('has-', step);
    if (step < played || !animate) {
      played = Math.min(played, step);
      setClasses('did-', played);
    }
    if (animate) {
      // Two frames: the new cards must be laid out in their "before" state first.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        played = step;
        setClasses('did-', played);
      }));
    }
    panels.forEach((p) => p.classList.toggle('active', Number(p.dataset.panel) === step));
    dots.forEach((d) => {
      const k = Number(d.dataset.goto);
      if (k === step) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
      d.classList.toggle('done', k < step);
    });
    prev.disabled = step === 1;
    next.hidden = step === STEPS;
    replay.hidden = step !== STEPS;
    count.textContent = String(step);
  }

  // After a step change, keep the step's text in view (on phones the table is long).
  function revealText() {
    const top = progress.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      progress.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function userGo(n, focusTarget) {
    if (n === step) return;
    go(n, true);
    revealText();
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  function restart() {
    stage.classList.add('resetting');
    played = 0;
    setClasses('did-', 0);
    setClasses('has-', 1);
    void stage.offsetWidth; // apply the reset without animating it
    stage.classList.remove('resetting');
    go(1, true);
    revealText();
    next.focus({ preventScroll: true });
  }

  prev.addEventListener('click', () => userGo(step - 1, step - 1 === 1 ? next : prev));
  next.addEventListener('click', () => userGo(step + 1, step + 1 === STEPS ? replay : next));
  replay.addEventListener('click', restart);
  dots.forEach((d) => d.addEventListener('click', () => userGo(Number(d.dataset.goto))));
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight' && step < STEPS && e.target.closest('.ht-progress')) userGo(step + 1, dots[step]);
    if (e.key === 'ArrowLeft' && step > 1 && e.target.closest('.ht-progress')) userGo(step - 1, dots[step - 2]);
  });

  // Start face down; flip the Condition card when the table first scrolls into view.
  stage.classList.add('resetting');
  go(1, false);
  void stage.offsetWidth;
  stage.classList.remove('resetting');

  // Load every card on the table before it's needed, so no flip shows a blank face.
  const images = stage.querySelectorAll('img[loading="lazy"]');
  if ('IntersectionObserver' in window) {
    const preload = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      images.forEach((img) => { img.loading = 'eager'; });
      preload.disconnect();
    }, { rootMargin: '800px 0px' });
    preload.observe(stage);
    const start = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      if (played === 0 && step === 1) timer = window.setTimeout(() => go(1, true), 150);
      start.disconnect();
    }, { threshold: 0.35 });
    start.observe(stage);
  } else {
    images.forEach((img) => { img.loading = 'eager'; });
    go(1, true);
  }
})();
