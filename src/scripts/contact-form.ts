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
  const summary = form.querySelector<HTMLElement>('[data-error-summary]')!;
  const summaryList = summary.querySelector('ul')!;

  let token = '';
  let widgetId: string | undefined;
  let loading: Promise<void> | undefined;
  let widgetError = '';
  let waiter: (() => void) | undefined;

  const SPAM_CHECK_FAILED =
    'The spam check could not run, so the message was not sent. Reload the page and try again, or reach me on LinkedIn.';

  function setToken(value: string, error = '') {
    token = value;
    widgetError = error;
    if (value || error) waiter?.();
  }

  // Resolves once Turnstile hands back a token or reports an error, or after 20 s.
  function waitForToken(): Promise<void> {
    if (token || widgetError) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => { waiter = undefined; resolve(); }, 20_000);
      waiter = () => { clearTimeout(timer); waiter = undefined; resolve(); };
    });
  }

  // Pre-select the topic from ?topic=cv etc.
  const topic = new URLSearchParams(location.search).get('topic');
  const select = form.querySelector<HTMLSelectElement>('[data-topic]');
  if (topic && select && [...select.options].some((o) => o.value === topic)) select.value = topic;

  message.addEventListener('input', () => {
    if (counter) counter.textContent = `${message.value.length} / 5000`;
  });

  interface FormError { field?: string | undefined; message: string }

  /** Show or clear the message under one field, and its aria-invalid flag. */
  function setFieldError(name: string, message: string) {
    const input = form.elements.namedItem(name);
    const line = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    const text = line?.querySelector('[data-error-text]');
    if (input instanceof HTMLElement) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    if (line && text) {
      text.textContent = message;
      line.classList.toggle('hidden', !message);
    }
  }

  function clearErrors() {
    summary.classList.add('hidden');
    summaryList.replaceChildren();
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((line) => setFieldError(line.dataset.errorFor ?? '', ''));
  }

  /** GOV.UK-style error summary: it receives focus and links to each field with a problem. */
  function showErrors(errors: FormError[]) {
    clearErrors();
    statusEl.className = 'hidden';
    for (const { field, message: text } of errors) {
      const item = document.createElement('li');
      const input = field ? form.elements.namedItem(field) : null;
      if (field && input instanceof HTMLElement && input.id) {
        const link = document.createElement('a');
        link.href = `#${input.id}`;
        link.textContent = text;
        link.addEventListener('click', (event) => { event.preventDefault(); input.focus(); });
        item.append(link);
        setFieldError(field, text);
      } else {
        item.textContent = text;
      }
      summaryList.append(item);
    }
    summary.classList.remove('hidden');
    summary.focus();
  }

  /** Client-side checks: one message per field, in the order the fields appear. */
  function validate(): FormError[] {
    const errors: FormError[] = [];
    const value = (name: string) => String((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '').trim();
    if (!value('name')) errors.push({ field: 'name', message: 'Enter your name.' });
    if (!value('email')) errors.push({ field: 'email', message: 'Enter your email address.' });
    else if (!(form.elements.namedItem('email') as HTMLInputElement).checkValidity()) {
      errors.push({ field: 'email', message: 'Enter an email address in the format name@example.com.' });
    }
    if (!value('topic')) errors.push({ field: 'topic', message: 'Choose what your message is about.' });
    if (!value('message')) errors.push({ field: 'message', message: 'Enter your message.' });
    else if (value('message').length < 10) errors.push({ field: 'message', message: 'Write at least 10 characters so I have something to reply to.' });
    if (!(form.elements.namedItem('consent') as HTMLInputElement).checked) {
      errors.push({ field: 'consent', message: 'Tick the box to agree before sending.' });
    }
    return errors;
  }

  // Fixing a field clears its own message straight away; the summary is rebuilt on the next send.
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      if (target.getAttribute('aria-invalid') === 'true') setFieldError(target.name, '');
    }
  });

  // Used for messages that arrive on their own (not after pressing Send): the spam check loading or failing.
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
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(''),
          'error-callback': () => {
            setToken('', SPAM_CHECK_FAILED);
            show('error', SPAM_CHECK_FAILED);
            return true; // we've handled it; stops Turnstile logging to the console
          },
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
    clearErrors();

    const problems = validate();
    if (problems.length) { showErrors(problems); return; }
    if (!endpoint || !siteKey) { showErrors([{ message: 'The form is not connected in this build.' }]); return; }
    if (!token) {
      submit.disabled = true;
      show('info', 'Completing the spam check…');
      try {
        await loadTurnstile();
        await waitForToken();
      } catch {
        showErrors([{ message: 'The spam check could not load. Check your connection or content blocker, then reload the page.' }]);
        submit.disabled = false;
        return;
      }
      submit.disabled = false;
      if (!token) {
        showErrors([{ message: widgetError || 'The spam check did not finish, so the message was not sent. Wait a moment and press "Send message" again.' }]);
        return;
      }
      statusEl.className = 'hidden';
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
      if (res.status === 429) showErrors([{ message: 'Too many messages from this connection. Try again in an hour, or reach me on LinkedIn.' }]);
      else if (res.status === 400 && body?.field) {
        showErrors([{ field: String(body.field), message: body.error ?? 'Check this field and try again.' }]);
      } else if (res.status === 403) {
        showErrors([{ message: 'The message was not sent: this site is not allowed to use the form. Reach me on LinkedIn instead.' }]);
      } else showErrors([{ message: `The message was not sent (error ${res.status}). Try again in a few minutes, or reach me on LinkedIn.` }]);
    } catch {
      showErrors([{ message: 'The message was not sent: the connection failed. Check your internet connection and try again.' }]);
    } finally {
      token = '';
      if (window.turnstile) window.turnstile.reset(widgetId);
      submit.disabled = false;
      submitLabel.textContent = 'Send message';
    }
  });
}

export {};
