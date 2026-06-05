/* ───────────────────────────────────────────
   AARES — index.js
   Home page logic:
   - Skeleton → product grid rendering
   - Category chips
   - Recently viewed
   - Product count in hero
─────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {

  // Set footer year
  const yearEl = document.getElementById('js-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Show skeleton placeholders immediately
  showProductGridSkeletons(document.getElementById('js-new-arrivals'), 8);
  showProductGridSkeletons(document.getElementById('js-popular'), 8);
  showProductGridSkeletons(document.getElementById('js-top-rated'), 8);

  // Load all sections in parallel
  const [newArrivals, popular, topRated, categories] = await Promise.allSettled([
    Products.getNew(8),
    Products.getPopular(8),
    Products.getTopRated(8),
    Products.getCategories(),
  ]);

  // Render each section
  renderGrid('js-new-arrivals', newArrivals);
  renderGrid('js-popular',      popular);
  renderGrid('js-top-rated',    topRated);

  // Render category chips
  if (categories.status === 'fulfilled') {
    renderCategoryChips(categories.value);
  }

  // Update hero product count
  updateHeroCount();

  // Load recently viewed (from localStorage — no DB call needed)
  loadRecentlyViewed();

  // Refresh logged-in cart badge count
  if (Auth.isLoggedIn()) {
    Cart.refreshCountCache();
  }

});

/* ── Render Product Grid ── */

function renderGrid(containerId, result) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (result.status === 'rejected' || !result.value?.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state__icon">
          <i data-lucide="package-x"></i>
        </div>
        <p class="empty-state__desc">No products here yet.</p>
      </div>
    `;
    refreshUI();
    return;
  }

  container.innerHTML = result.value.map(p => buildProductCard(p)).join('');
  refreshUI();
}

/* ── Category Chips ── */

function renderCategoryChips(categories) {
  const container = document.getElementById('js-category-chips');
  if (!container || !categories.length) return;

  const chips = categories.map(cat => `
    <button class="chip" data-category="${sanitize(cat)}" role="listitem">
      ${sanitize(capitalize(cat))}
    </button>
  `).join('');

  // Insert after the existing "All" chip
  const allChip = container.querySelector('[data-category=""]');
  if (allChip) {
    allChip.insertAdjacentHTML('afterend', chips);
  }

  // Click handler — navigate to search with category pre-selected
  container.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    // Update active state
    container.querySelectorAll('.chip').forEach(c => c.classList.remove('chip--active'));
    chip.classList.add('chip--active');

    const category = chip.dataset.category;
    const dest     = category
      ? `search.html?category=${encodeURIComponent(category)}`
      : 'search.html';

    // Small delay so user sees the active state before navigating
    setTimeout(() => { window.location.href = dest; }, 120);
  });
}

/* ── Hero Product Count ── */

async function updateHeroCount() {
  const el = document.getElementById('js-product-count');
  if (!el) return;
  try {
    const all   = await Products.getAll();
    const count = all.length;
    el.textContent = count > 0 ? count + '+' : '—';
  } catch {
    el.textContent = '—';
  }
}

/* ── Recently Viewed ── */

async function loadRecentlyViewed() {
  const ids     = getRecentlyViewedIds();
  const section = document.getElementById('js-recently-viewed-section');
  const grid    = document.getElementById('js-recently-viewed');

  if (!ids.length || !section || !grid) return;

  try {
    // Fetch up to 4 recently viewed products
    const results = await Promise.allSettled(
      ids.slice(0, 4).map(id => Products.getById(id))
    );

    const products = results
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    if (!products.length) return;

    grid.innerHTML = products.map(p => buildProductCard(p)).join('');
    section.removeAttribute('hidden');
    refreshUI();
  } catch {
    // Silent — recently viewed is non-critical
  }
}
