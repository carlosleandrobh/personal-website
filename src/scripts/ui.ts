// Small progressive enhancements shared by every page. No tracking, no third parties.
import { currentTheme, onChange, setPref } from './prefs';

// The header button is a quick light/dark switch. The same choice is also in the Display settings panel.
const themeButtons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
const labelThemeButtons = () => {
  const label = currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  themeButtons.forEach((button) => button.setAttribute('aria-label', label));
};
labelThemeButtons();
onChange(labelThemeButtons);
themeButtons.forEach((button) => {
  button.addEventListener('click', () => setPref('theme', currentTheme() === 'dark' ? 'light' : 'dark'));
});

const menuButton = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
if (menuButton && menu) {
  const close = (returnFocus = false) => {
    menu.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open menu');
    if (returnFocus) menuButton.focus();
  };
  menuButton.addEventListener('click', () => {
    const open = menu.classList.toggle('hidden') === false;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => close()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.classList.contains('hidden')) close(true);
  });
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

// Scrollable tables in posts become keyboard-focusable regions only while they overflow, so the
// keyboard can scroll them without adding a useless tab stop to tables that fit.
const tableScrollers = document.querySelectorAll<HTMLElement>('.table-scroll');
if (tableScrollers.length) {
  const observer = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      const el = target as HTMLElement;
      if (el.scrollWidth > el.clientWidth) {
        el.tabIndex = 0;
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', el.querySelector('caption')?.textContent?.trim() || 'Scrollable table');
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
      }
    }
  });
  tableScrollers.forEach((el) => observer.observe(el));
}
