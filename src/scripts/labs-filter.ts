// Client-side filtering for /labs/. Works on data-* attributes rendered at build time.
const form = document.querySelector<HTMLFormElement>('[data-lab-filters]');
const search = document.querySelector<HTMLInputElement>('[data-lab-search]');
const statusSelect = document.querySelector<HTMLSelectElement>('[data-lab-status]');
const categoryButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-lab-category]')];
const items = [...document.querySelectorAll<HTMLElement>('[data-lab-item]')];
const counter = document.querySelector<HTMLElement>('[data-lab-count]');
const empty = document.querySelector<HTMLElement>('[data-lab-empty]');

let category = '';

function apply() {
  const q = (search?.value ?? '').trim().toLowerCase();
  const status = statusSelect?.value ?? '';
  let visible = 0;
  for (const item of items) {
    const card = item.querySelector<HTMLElement>('[data-lab]');
    if (!card) continue;
    const ok =
      (!category || card.dataset.category === category) &&
      (!status || card.dataset.status === status) &&
      (!q || (card.dataset.search ?? '').includes(q));
    item.hidden = !ok;
    if (ok) visible++;
  }
  if (counter) counter.textContent = `Showing ${visible} of ${items.length} experiments`;
  empty?.classList.toggle('hidden', visible > 0);
}

form?.addEventListener('submit', (e) => e.preventDefault());
search?.addEventListener('input', apply);
statusSelect?.addEventListener('change', apply);
categoryButtons.forEach((button) =>
  button.addEventListener('click', () => {
    category = button.dataset.labCategory ?? '';
    categoryButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    apply();
  }));
document.querySelector('[data-lab-reset]')?.addEventListener('click', () => {
  if (search) search.value = '';
  if (statusSelect) statusSelect.value = '';
  categoryButtons[0]?.click();
});
