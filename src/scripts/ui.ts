// Small progressive enhancements shared by every page. No tracking, no third parties.

function setTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* storage disabled: keep for this page only */ }
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) =>
    b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'));
}

document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  button.setAttribute('aria-label', current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  button.addEventListener('click', () =>
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
});

const menuButton = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
if (menuButton && menu) {
  const close = () => {
    menu.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open menu');
  };
  menuButton.addEventListener('click', () => {
    const open = menu.classList.toggle('hidden') === false;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// "Copy link" buttons
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const label = button.querySelector('[data-copy-label]');
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? location.href);
      if (label) label.textContent = 'Link copied';
    } catch {
      if (label) label.textContent = 'Copy failed — use the address bar';
    }
    setTimeout(() => { if (label) label.textContent = 'Copy link'; }, 2500);
  });
});

// Email addresses are assembled at runtime so they never appear in the HTML.
document.querySelectorAll<HTMLAnchorElement>('[data-mail-user][data-mail-domain]').forEach((a) => {
  const address = `${a.dataset.mailUser}@${a.dataset.mailDomain}`;
  a.href = `mailto:${address}`;
  const text = a.querySelector('[data-mail-text]');
  if (text) text.textContent = address;
});
