// Two Dudes and a Hamster company pages: the mobile menu and the email signup form.
document.documentElement.classList.replace('no-js', 'js');

// The copyright year in the footer.
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

// Mobile menu: a button that shows and hides the nav links.
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
  });
})();

// The email signup form. It posts to the API, which saves the address; the page only says
// "You're on the list" after the API confirms it.
(function () {
  const form = document.getElementById('signup-form');
  if (!form) return;
  const status = document.getElementById('signup-status');
  const email = form.elements.namedItem('email');
  const button = form.querySelector('button[type="submit"]');
  const CONTACT = form.dataset.contact;
  const UNAVAILABLE = 'Sorry, signups are not working right now and your email was not saved. Please try again later, or email ' + CONTACT + ' and we will add you.';

  const show = (kind, text) => {
    status.className = 'form-status ' + kind;
    status.textContent = text;
  };

  email.addEventListener('input', () => email.removeAttribute('aria-invalid'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!email.value.trim() || !email.checkValidity()) {
      email.setAttribute('aria-invalid', 'true');
      show('error', 'Please enter a valid email address.');
      email.focus();
      return;
    }
    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Signing you up…';
    show('', '');
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.value.trim(),
          firstName: form.elements.namedItem('firstName').value.trim() || undefined,
          source: form.dataset.source,
          website: form.elements.namedItem('website').value,
        }),
      });
      if (res.ok) {
        form.reset();
        form.querySelectorAll('.field, button[type="submit"], .privacy-note').forEach((el) => { el.hidden = true; });
        // The form's data-success-title and data-success-text are the page's own wording.
        status.className = 'form-status success';
        status.replaceChildren();
        const title = document.createElement('strong');
        title.className = 'success-title';
        title.textContent = form.dataset.successTitle || "You're on the list!";
        status.append(title, ' ', form.dataset.successText || "Thanks for joining us. We'll keep you updated.");
        status.focus();
        return;
      }
      let message = '';
      try { message = (await res.json()).message || ''; } catch { /* not JSON */ }
      if (res.status === 400 && message) {
        if (/email/i.test(message)) email.setAttribute('aria-invalid', 'true');
        show('error', message);
      } else if (res.status === 429) {
        show('error', message || 'Too many signups from this connection. Please try again in a little while.');
      } else {
        show('error', UNAVAILABLE);
      }
    } catch {
      show('error', UNAVAILABLE);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
})();
