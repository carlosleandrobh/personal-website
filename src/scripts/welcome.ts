// The welcome window (WelcomeDialog.astro). It opens once, on a first visit, and asks what would help.
//
// - Each tick shows its effect straight away (a preview), so a visitor with low vision can read the rest of the window.
// - "Use my choices" saves them. "Continue without changes", Esc and anything else that closes the window put the page
//   back as it was. Either way the window is remembered as answered and does not open again.
// - Nothing is detected, sent or logged. Reading aloud starts only from this button press, never by itself.
import { getPrefs, hasWelcomed, markWelcomed, previewPrefs, replacePrefs, type Prefs } from './prefs';

const dialog = document.querySelector<HTMLDialogElement>('[data-welcome]');

if (dialog && typeof dialog.showModal === 'function' && !hasWelcomed()) {
  const before = getPrefs();
  const form = dialog.querySelector('form')!;

  // What each tick changes. "easyread" is not a setting: it opens the Easy Read page.
  const SETTINGS: Record<string, Prefs> = {
    comfort: { text: '150', theme: 'high-contrast' },
    calm: { motion: 'reduce' },
    targets: { targets: 'large' },
    aloud: { aloud: 'on' },
  };

  // A browser without text-to-speech cannot read aloud, so the option is not offered.
  if (!('speechSynthesis' in window)) dialog.querySelector('[data-choice="aloud"]')?.remove();

  const checked = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.checked === true;
  const chosen = (): Prefs => Object.assign({}, before, ...Object.keys(SETTINGS).filter(checked).map((name) => SETTINGS[name]));

  form.addEventListener('change', () => previewPrefs(chosen()));

  dialog.addEventListener('close', () => {
    markWelcomed();
    if (dialog.returnValue !== 'apply') {
      previewPrefs(before);
      return;
    }
    replacePrefs(chosen());
    if (checked('easyread') && location.pathname !== '/about/easy-read/') {
      location.assign('/about/easy-read/'); // the Listen button is waiting there; speech cannot start on a new page by itself
    } else if (checked('aloud')) {
      document.dispatchEvent(new CustomEvent('listen:start')); // this click is the visitor's go-ahead
    }
  });

  dialog.showModal();
}
