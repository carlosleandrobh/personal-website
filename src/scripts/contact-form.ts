// Contact form: lazy-loads Cloudflare Turnstile on first interaction, posts JSON
// to the `contact` Edge Function. No third-party request happens before the
// visitor starts filling in the form.
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
if (form) init(form);

function init(form: HTMLFormElement) {
  const endpoint = form.dataset.endpoint ?? '';
  const siteKey = form.dataset.sitekey ?? '';
  const statusEl = form.querySelector<HTMLElement>('[data-status]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const submitLabel = form.querySelector<HTMLElement>('[data-submit-label]')!;
  const widget = form.querySelector<HTMLElement>('[data-turnstile]')!;
  const success = document.querySelector<HTMLElement>('[data-success]');
  const message = form.elements.namedItem('message') as HTMLTextAreaElement;
  const counter = form.querySelector<HTMLElement>('[data-counter]');

  let token = '';
  let widgetId: string | undefined;
  let loading: Promise<void> | undefined;

  // Pre-select the topic from ?topic=cv etc.
  const topic = new URLSearchParams(location.search).get('topic');
  const select = form.querySelector<HTMLSelectElement>('[data-topic]');
  if (topic && select && [...select.options].some((o) => o.value === topic)) select.value = topic;

  message.addEventListener('input', () => {
    if (counter) counter.textContent = `${message.value.length} / 5000`;
  });

  function show(kind: 'error' | 'info', text: string) {
    statusEl.textContent = text;
    statusEl.className = `rounded-lg p-4 text-sm ${kind === 'error' ? 'border border-red-700/30 bg-red-700/10 text-fg' : 'bg-accent-tint text-fg'}`;
  }

  function loadTurnstile() {
    if (!siteKey || loading) return loading;
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => {
        widgetId = window.turnstile?.render(widget, {
          sitekey: siteKey,
          action: 'contact',
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
          callback: (t: string) => { token = t; },
          'expired-callback': () => { token = ''; },
          'error-callback': () => { token = ''; },
        });
        resolve();
      };
      s.onerror = () => reject(new Error('turnstile'));
      document.head.append(s);
    });
    return loading;
  }

  form.addEventListener('focusin', () => { loadTurnstile()?.catch(() => show('error', 'The spam check could not load. Check your connection or content blocker, then reload the page.')); }, { once: true });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.className = 'hidden';
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

    const invalid = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[required], textarea[required], select[required]')]
      .filter((el) => !el.checkValidity());
    if (invalid.length) {
      invalid.forEach((el) => el.setAttribute('aria-invalid', 'true'));
      invalid[0]!.focus();
      show('error', 'Fill in your name, a valid email and a message of at least 10 characters, and tick the consent box.');
      return;
    }
    if (!endpoint || !siteKey) { show('error', 'The form is not connected in this build.'); return; }
    if (!token) {
      await loadTurnstile()?.catch(() => undefined);
      show('info', 'Completing the spam check… press "Send message" again in a moment.');
      return;
    }

    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      topic: String(data.get('topic') ?? 'other'),
      message: String(data.get('message') ?? '').trim(),
      consent: data.get('consent') === 'on',
      privacy_version: form.dataset.privacyVersion,
      company_website: String(data.get('company_website') ?? ''),
      turnstile_token: token,
    };

    submit.disabled = true;
    submitLabel.textContent = 'Sending…';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'omit',
        referrerPolicy: 'strict-origin',
      });
      if (res.ok) {
        form.reset();
        form.classList.add('hidden');
        success?.classList.remove('hidden');
        success?.focus();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) show('error', 'Too many messages from this connection. Try again in an hour, or reach me on LinkedIn.');
      else if (res.status === 400 && body?.field) {
        form.querySelector(`[name="${body.field}"]`)?.setAttribute('aria-invalid', 'true');
        show('error', body.error ?? 'Check the highlighted field and try again.');
      } else show('error', 'The message was not sent. Try again in a few minutes, or reach me on LinkedIn.');
    } catch {
      show('error', 'The message was not sent: the connection failed. Check your internet connection and try again.');
    } finally {
      token = '';
      if (window.turnstile) window.turnstile.reset(widgetId);
      submit.disabled = false;
      submitLabel.textContent = 'Send message';
    }
  });
}

export {};
