// "Listen to this post": reads the article aloud with the browser's own text-to-speech.
// It is a normal button, never starts by itself, uses no microphone and sends nothing anywhere.
// The button stays hidden when the browser has no speech synthesis.

const button = document.querySelector<HTMLButtonElement>('[data-listen]');
const source = document.querySelector<HTMLElement>('[data-listen-source]');

if (button && source && 'speechSynthesis' in window) {
  const synth = window.speechSynthesis;
  button.classList.remove('hidden');
  button.classList.add('inline-flex');

  /** Plain text of one block, without the screen-reader-only hints such as "(opens in a new tab)". */
  const textOf = (block: Element) => {
    const copy = block.cloneNode(true) as Element;
    copy.querySelectorAll('.sr-only').forEach((el) => el.remove());
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  };

  // Cancelling makes the browser fire late "error"/"end" events for the old utterances.
  // Each run has a number, so those late events cannot stop a reading that started afterwards.
  let run = 0;

  const stop = () => {
    run += 1;
    synth.cancel();
    button.setAttribute('aria-pressed', 'false');
  };

  const start = () => {
    stop();
    const current = run;
    const finished = () => { if (current === run) stop(); };
    const blocks = [...source.children];
    // One short utterance per block: long utterances are cut off by some browsers.
    const utterances = blocks.flatMap((block) => {
      const text = block.tagName === 'PRE' ? 'Code example skipped.' : textOf(block);
      return text ? [text] : [];
    }).map((text, index, all) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-NZ';
      if (index === all.length - 1) utterance.onend = finished;
      utterance.onerror = finished;
      return utterance;
    });
    if (!utterances.length) return;
    button.setAttribute('aria-pressed', 'true');
    utterances.forEach((utterance) => synth.speak(utterance));
  };

  button.addEventListener('click', () => (button.getAttribute('aria-pressed') === 'true' ? stop() : start()));
  addEventListener('pagehide', () => synth.cancel());
}
