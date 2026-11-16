// "Listen to this page": reads the page aloud with the browser's own text-to-speech.
// It only starts when the visitor presses a button, never by itself. It uses no microphone and sends nothing anywhere.
// Everything stays hidden when the browser has no speech synthesis.
//
// There are two ways to start it: the player (ListenPlayer.astro, on every page once the visitor has asked for it) and
// the "Listen to this post" button on a post. Both control the same reading.
import { OPTIONS, getPrefs, onChange, setPref } from './prefs';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : undefined;
const player = document.querySelector<HTMLElement>('[data-listen-player]');
const postButton = document.querySelector<HTMLButtonElement>('[data-listen]');

if (synth && player) {
  const mainButton = player.querySelector<HTMLButtonElement>('[data-listen-main]')!;
  const stopButton = player.querySelector<HTMLButtonElement>('[data-listen-stop]')!;
  const rateSelect = player.querySelector<HTMLSelectElement>('[data-listen-rate]')!;
  const status = player.querySelector<HTMLElement>('[data-listen-status]')!;
  const skipButton = document.querySelector<HTMLButtonElement>('[data-listen-skip]');

  type State = 'idle' | 'reading' | 'paused';
  let state: State = 'idle';
  let blocks: Element[] = [];
  let index = 0;
  // Cancelling makes the browser fire late "error"/"end" events for the old utterances.
  // Each run has a number, so those late events cannot stop a reading that started afterwards.
  let run = 0;

  const SPEAKABLE = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dt,dd,pre,table';

  /** The parts of the page to read, top to bottom: the post text on a post, otherwise the main content. */
  const collect = (): Element[] => {
    const root = document.querySelector('[data-listen-source]') ?? document.querySelector('main');
    if (!root) return [];
    return [...root.querySelectorAll(SPEAKABLE)].filter((el) => {
      if (el.parentElement?.closest('pre, table')) return false; // read as a whole, once
      if (el.tagName !== 'PRE' && el.querySelector(SPEAKABLE)) return false; // read its inner parts instead
      if (el.closest('[aria-hidden="true"], [hidden], form, nav')) return false;
      return el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0;
    });
  };

  /** Plain text of one block, without the screen-reader-only hints such as "(opens in a new tab)". */
  const textOf = (block: Element) => {
    if (block.tagName === 'PRE') return 'Code example skipped.';
    const copy = block.cloneNode(true) as Element;
    copy.querySelectorAll('.sr-only').forEach((el) => el.remove());
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  };

  const rate = () => Number(getPrefs().rate ?? OPTIONS.rate[0]);

  const mark = (block?: Element) => {
    document.querySelectorAll('[data-listen-current]').forEach((el) => el.removeAttribute('data-listen-current'));
    if (!block) return;
    block.setAttribute('data-listen-current', '');
    // Keep what is being read on screen. Only scroll when it is not already fully visible.
    const box = block.getBoundingClientRect();
    if (box.top < 0 || box.bottom > innerHeight) block.scrollIntoView({ block: 'center', behavior: 'auto' });
  };

  // The player is fixed at the bottom of the screen, and on a phone with large text it is a third of the screen tall.
  // Its height goes into --listen-player-space, so the page keeps that much room at the bottom, both at the end of the
  // page and when the browser scrolls to the focused element (WCAG 2.4.11). A CSS variable set from script is allowed by
  // the CSP; only style="" in the HTML is not.
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--listen-player-space', `${Math.ceil(player.getBoundingClientRect().height)}px`);
  }).observe(player);
  // The browser does not scroll to an element that is already partly on screen, even when it sits behind the player.
  // Scroll just enough to bring it out from under it.
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (player.hidden || !(target instanceof Element) || player.contains(target)) return;
    if (getComputedStyle(player).position !== 'fixed') return; // on a short screen the player scrolls with the page
    const covered = target.getBoundingClientRect().bottom - player.getBoundingClientRect().top;
    if (covered > 0 && target !== document.body) window.scrollBy({ top: covered + 16, behavior: 'instant' });
  });

  const show = () => {
    const wanted = state !== 'idle' || document.documentElement.dataset.aloud === 'on';
    player.hidden = !wanted;
    if (skipButton) skipButton.hidden = !wanted;
    document.body.classList.toggle('has-listen-player', wanted);
    mainButton.textContent = state === 'reading' ? 'Pause' : state === 'paused' ? 'Resume' : 'Listen to this page';
    stopButton.hidden = state === 'idle';
    if (postButton) postButton.setAttribute('aria-pressed', String(state !== 'idle'));
  };

  const say = (text: string) => { status.textContent = text; };

  /** Speaks every block from `from` to the end, one short utterance each (long ones are cut off by some browsers). */
  const speakFrom = (from: number) => {
    run += 1;
    synth.cancel();
    const current = run;
    const finish = () => { if (current === run) stop(); };
    const spoken = blocks.slice(from).map((block, offset) => ({ block, at: from + offset, text: textOf(block) })).filter((item) => item.text);
    if (!spoken.length) { stop(); return; }
    state = 'reading';
    spoken.forEach((item, position) => {
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = 'en-NZ';
      utterance.rate = rate();
      utterance.onstart = () => { if (current === run) { index = item.at; mark(item.block); } };
      if (position === spoken.length - 1) utterance.onend = finish;
      utterance.onerror = finish;
      synth.speak(utterance);
    });
    show();
  };

  function stop() {
    run += 1;
    synth!.cancel();
    state = 'idle';
    index = 0;
    mark();
    show();
  }

  const start = () => {
    blocks = collect();
    index = 0;
    say('Reading started.');
    speakFrom(0);
  };

  // Pause keeps the place by remembering which part was being read, then carries on from the start of that part.
  const pause = () => {
    run += 1;
    synth.cancel();
    state = 'paused';
    say('Paused.');
    show();
  };

  mainButton.addEventListener('click', () => {
    if (state === 'idle') start();
    else if (state === 'reading') pause();
    else { say('Reading resumed.'); speakFrom(index); }
  });
  stopButton.addEventListener('click', () => { say('Stopped.'); stop(); });
  postButton?.addEventListener('click', () => (state === 'idle' ? start() : (say('Stopped.'), stop())));

  rateSelect.value = String(rate());
  rateSelect.addEventListener('change', () => {
    setPref('rate', rateSelect.value);
    if (state === 'reading') speakFrom(index); // carry on at the new speed
  });

  // The fourth Tab stop (see BaseLayout.astro): a keyboard visitor jumps straight to the controls.
  skipButton?.addEventListener('click', () => mainButton.focus());

  // The welcome window asks for this after the visitor presses "Use my choices". Focus goes to Pause, because the
  // window has just closed and focus would otherwise be left at the top of the page, far from the controls.
  document.addEventListener('listen:start', () => {
    if (state !== 'idle') return;
    start();
    mainButton.focus();
  });

  onChange(show); // the Display settings panel can show or hide the player
  addEventListener('pagehide', () => synth.cancel());

  if (postButton) {
    postButton.classList.remove('hidden');
    postButton.classList.add('inline-flex');
  }
  show();
}
