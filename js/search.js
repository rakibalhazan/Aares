/* ── State ── */
let state = {
  query:    getParam('q')        || '',
  sort:     getParam('sort')     || 'newest',
  category: getParam('category') || '',
  minPrice: getParam('min')      ? parseInt(getParam('min')) : null,
  maxPrice: getParam('max')      ? parseInt(getParam('max')) : null,
  page:     1,
  loading:  false,
  hasMore:  false,
};

const grid       = document.getElementById('js-product-grid');
const countEl    = document.getElementById('js-results-count');
const loadMoreWrap = document.getElementById('js-load-more-wrap');

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  const input = document.getElementById('js-search-input');
  if (input && state.query) {
    input.value = state.query;
    document.getElementById('js-search-clear').classList.remove('hidden');
  }

  applySortUI(state.sort);
  await loadCategories();
  await fetchProducts(true);
  bindEvents();

  if (Auth.isLoggedIn()) Cart.refreshCountCache();
});

/* ── Fetch Products ── */
async function fetchProducts(reset = false) {
  if (state.loading) return;
  state.loading = true;
  if (reset) { state.page = 1; showProductGridSkeletons(grid, 12); }
  Progress.start();

  try {
    const data = await Products.search({
      query:    state.query,
      sortBy:   state.sort,
      category: state.category,
      page:     state.page,
    });

    let filtered = data;
    if (state.minPrice !== null) filtered = filtered.filter(p => p.current_price >= state.minPrice);
    if (state.maxPrice !== null) filtered = filtered.filter(p => p.current_price <= state.maxPrice);

    if (reset) {
      grid.innerHTML = filtered.length
        ? filtered.map(p => buildProductCard(p)).join('')
        : `<div class="no-results empty-state">
             <div class="empty-state__icon"><i data-lucide="search-x"></i></div>
             <h3 class="empty-state__title">No results found</h3>
             <p class="empty-state__desc">Try different keywords or remove some filters.</p>
           </div>`;
    } else {
      grid.insertAdjacentHTML('beforeend', filtered.map(p => buildProductCard(p)).join(''));
    }

    state.hasMore = data.length === CONFIG.PRODUCTS_PER_PAGE;
    loadMoreWrap.hidden = !state.hasMore;
    updateResultsCount(filtered.length, reset);
    updateActiveFilters();
    refreshUI();
  } catch (err) {
    grid.innerHTML = `<p class="text-muted" style="grid-column:1/-1;padding:var(--sp-8)">Could not load products. Please try again.</p>`;
  } finally {
    state.loading = false;
    Progress.finish();
  }
}

/* ── Categories ── */
async function loadCategories() {
  const cats = await Products.getCategories().catch(() => []);
  const group = document.getElementById('js-category-filters');
  if (!group || !cats.length) return;

  const existingAll = group.querySelector('input[value=""]');
  if (existingAll) existingAll.closest('label').insertAdjacentHTML('afterend',
    cats.map(cat => `
      <label class="filter-check">
        <input type="checkbox" name="category" value="${sanitize(cat)}"
               ${state.category === cat ? 'checked' : ''}>
        ${sanitize(capitalize(cat))}
      </label>
    `).join('')
  );

  if (state.category) {
    const allInput = group.querySelector('input[value=""]');
    if (allInput) allInput.checked = false;
    const catInput = group.querySelector(`input[value="${state.category}"]`);
    if (catInput) catInput.checked = true;
  }
}

/* ── Apply Sort UI ── */
function applySortUI(sort) {
  const radios = document.querySelectorAll('[name="sort"]');
  radios.forEach(r => { r.checked = r.value === sort; });
}

/* ── Active Filter Tags ── */
function updateActiveFilters() {
  const container = document.getElementById('js-active-filters');
  if (!container) return;

  const tags = [];
  if (state.query)    tags.push({ label: `"${state.query}"`,   key: 'query' });
  if (state.category) tags.push({ label: capitalize(state.category), key: 'category' });
  if (state.sort !== 'newest') {
    const labels = { price_asc: 'Price: Low-High', price_desc: 'Price: High-Low', top_rated: 'Top Rated', popular: 'Most Popular' };
    tags.push({ label: labels[state.sort] || state.sort, key: 'sort' });
  }
  if (state.minPrice !== null) tags.push({ label: `Min: ${formatPrice(state.minPrice)}`, key: 'minPrice' });
  if (state.maxPrice !== null) tags.push({ label: `Max: ${formatPrice(state.maxPrice)}`, key: 'maxPrice' });

  container.innerHTML = tags.map(t => `
    <button class="filter-tag" data-key="${t.key}" aria-label="Remove ${t.label} filter">
      ${sanitize(t.label)} <i data-lucide="x"></i>
    </button>
  `).join('');

  lucide.createIcons({ nodes: [container] });

  const count = document.getElementById('js-filter-count');
  if (count) {
    const active = tags.length;
    count.textContent = active;
    count.classList.toggle('hidden', active === 0);
  }
}

/* ── Results Count ── */
function updateResultsCount(count, reset) {
  if (!countEl) return;
  if (!reset && state.page > 1) return;
  countEl.innerHTML = count
    ? `<strong>${count}</strong> product${count !== 1 ? 's' : ''} found`
    : '';
}

/* ── Event Binding ── */
function bindEvents() {
  const searchInput = document.getElementById('js-search-input');
  const searchClear = document.getElementById('js-search-clear');

  // Search input
  if (searchInput) {
    const debouncedSearch = debounce(async () => {
      state.query = searchInput.value.trim();
      searchClear.classList.toggle('hidden', !state.query);
      setParam('q', state.query);
      await fetchProducts(true);
    }, 400);
    searchInput.addEventListener('input', debouncedSearch);
  }

  // Clear search
  if (searchClear) {
    searchClear.addEventListener('click', async () => {
      searchInput.value = '';
      state.query = '';
      searchClear.classList.add('hidden');
      setParam('q', '');
      await fetchProducts(true);
    });
  }

  // Sort radios (desktop)
  document.querySelectorAll('[name="sort"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      state.sort = radio.value;
      setParam('sort', state.sort);
      await fetchProducts(true);
    });
  });

  // Category checkboxes
  document.getElementById('js-category-filters')?.addEventListener('change', async e => {
    const cb = e.target;
    if (cb.value === '') {
      document.querySelectorAll('[name="category"]').forEach(c => c.checked = c.value === '');
      state.category = '';
    } else {
      document.querySelector('[name="category"][value=""]').checked = false;
      state.category = cb.checked ? cb.value : '';
    }
    setParam('category', state.category);
    await fetchProducts(true);
  });

  // Price range apply
  document.getElementById('js-apply-price')?.addEventListener('click', async () => {
    const min = document.getElementById('js-price-min').value;
    const max = document.getElementById('js-price-max').value;
    state.minPrice = min ? parseInt(min) : null;
    state.maxPrice = max ? parseInt(max) : null;
    setParam('min', state.minPrice);
    setParam('max', state.maxPrice);
    await fetchProducts(true);
  });

  // Clear all filters
  document.getElementById('js-clear-filters')?.addEventListener('click', clearAllFilters);

  // Active filter tag removal
  document.getElementById('js-active-filters')?.addEventListener('click', async e => {
    const tag = e.target.closest('.filter-tag');
    if (!tag) return;
    const key = tag.dataset.key;
    if (key === 'query')    { state.query = '';    setParam('q', '');        if (searchInput) { searchInput.value = ''; searchClear.classList.add('hidden'); } }
    if (key === 'category') { state.category = ''; setParam('category', ''); }
    if (key === 'sort')     { state.sort = 'newest'; setParam('sort', '');   applySortUI('newest'); }
    if (key === 'minPrice') { state.minPrice = null; setParam('min', '');    const el = document.getElementById('js-price-min'); if (el) el.value = ''; }
    if (key === 'maxPrice') { state.maxPrice = null; setParam('max', '');    const el = document.getElementById('js-price-max'); if (el) el.value = ''; }
    await fetchProducts(true);
  });

  // Load more
  document.getElementById('js-load-more')?.addEventListener('click', async () => {
    state.page++;
    await fetchProducts(false);
  });

  // Mobile filter drawer
  const drawerToggle  = document.getElementById('js-filter-toggle');
  const drawer        = document.getElementById('js-filter-drawer');
  const drawerClose   = document.getElementById('js-filter-close');
  const drawerBackdrop = document.getElementById('js-filter-backdrop');

  function openDrawer()  { drawer.hidden = false; document.body.style.overflow = 'hidden'; populateDrawer(); }
  function closeDrawer() { drawer.hidden = true;  document.body.style.overflow = ''; }

  drawerToggle?.addEventListener('click',  openDrawer);
  drawerClose?.addEventListener('click',   closeDrawer);
  drawerBackdrop?.addEventListener('click', closeDrawer);

  document.getElementById('js-drawer-apply')?.addEventListener('click', () => { closeDrawer(); fetchProducts(true); });
  document.getElementById('js-drawer-clear')?.addEventListener('click', () => { clearAllFilters(); closeDrawer(); });
}

/* ── Populate Mobile Drawer ── */
function populateDrawer() {
  const body = document.querySelector('.filter-drawer__body');
  if (!body) return;
  body.innerHTML = document.querySelector('.filter-sidebar__inner').innerHTML;
  lucide.createIcons({ nodes: [body] });

  // Sync state to drawer inputs
  body.querySelectorAll('[name="sort"]').forEach(r => { r.checked = r.value === state.sort; });
  if (state.category) {
    body.querySelector('[name="category"][value=""]').checked = false;
    const catInput = body.querySelector(`[name="category"][value="${state.category}"]`);
    if (catInput) catInput.checked = true;
  }
  if (state.minPrice) { const el = body.querySelector('#js-price-min'); if (el) el.value = state.minPrice; }
  if (state.maxPrice) { const el = body.querySelector('#js-price-max'); if (el) el.value = state.maxPrice; }

  body.querySelectorAll('[name="sort"]').forEach(r => {
    r.addEventListener('change', () => { state.sort = r.value; setParam('sort', r.value); applySortUI(r.value); });
  });

  body.querySelectorAll('[name="category"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.value === '') { state.category = ''; }
      else { state.category = cb.checked ? cb.value : ''; }
      setParam('category', state.category);
    });
  });

  body.querySelector('#js-apply-price')?.addEventListener('click', () => {
    const min = body.querySelector('#js-price-min')?.value;
    const max = body.querySelector('#js-price-max')?.value;
    state.minPrice = min ? parseInt(min) : null;
    state.maxPrice = max ? parseInt(max) : null;
    setParam('min', state.minPrice); setParam('max', state.maxPrice);
  });
}

/* ── Clear All Filters ── */
async function clearAllFilters() {
  state = { ...state, query: '', sort: 'newest', category: '', minPrice: null, maxPrice: null, page: 1 };
  ['q','sort','category','min','max'].forEach(k => setParam(k, ''));
  const input = document.getElementById('js-search-input');
  if (input) { input.value = ''; document.getElementById('js-search-clear').classList.add('hidden'); }
  applySortUI('newest');
  document.querySelectorAll('[name="category"]').forEach(c => c.checked = c.value === '');
  document.getElementById('js-price-min') && (document.getElementById('js-price-min').value = '');
  document.getElementById('js-price-max') && (document.getElementById('js-price-max').value = '');
  await fetchProducts(true);
}
