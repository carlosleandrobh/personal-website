// The "Display settings" dialog. Everything works without it: every opener stays hidden until this script runs.
import { OPTIONS, getPrefs, isPrefKey, resetPrefs, setPref, type PrefKey } from './prefs';

const dialog = document.querySelector<HTMLDialogElement>('[data-display-settings]');
const openers = document.querySelectorAll<HTMLButtonElement>('[data-display-settings-open]');

if (dialog && typeof dialog.showModal === 'function' && openers.length) {
  let lastOpener: HTMLButtonElement | undefined;

  // A browser without text-to-speech cannot read aloud, so that setting is not offered.
  if (!('speechSynthesis' in window)) dialog.querySelector('[data-group="aloud"]')?.remove();

  const sync = () => {
    const prefs = getPrefs();
    for (const key of Object.keys(OPTIONS) as PrefKey[]) {
      const value = prefs[key] ?? OPTIONS[key][0];
      const input = dialog.querySelector<HTMLInputElement>(`input[name="${key}"][value="${value}"]`);
      if (input) input.checked = true;
    }
  };

  openers.forEach((opener) => {
    // `data-reveal` lists the classes that show this opener (each place it appears looks different).
    opener.classList.remove('hidden');
    opener.classList.add(...(opener.dataset.reveal ?? 'grid').split(/\s+/).filter(Boolean));
    opener.addEventListener('click', () => {
      lastOpener = opener;
      sync();
      dialog.showModal();
    });
  });

  dialog.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.checked && isPrefKey(input.name)) setPref(input.name, input.value);
  });

  dialog.querySelector('[data-reset]')?.addEventListener('click', () => {
    resetPrefs();
    sync();
  });

  // A click on the dimmed backdrop closes the dialog. The content sits in an inner form, so only the backdrop hits the dialog itself.
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => lastOpener?.focus());
}
