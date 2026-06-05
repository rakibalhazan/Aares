/* ── State ── */
let product  = null;
let allMedia = [];
let activeMediaIndex = 0;
let selectedRating   = 0;
const productId = parseInt(getParam('id'));

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!productId) { window.location.href = '404.html'; return; }
  addRecentlyViewed(productId);
  Progress.start();

  try {
    product  = await Products.getById(productId);
    allMedia = buildMediaList(product);
    renderProduct(product);
    loadReviews(productId);
    loadRelated(product);
  } catch {
    document.getElementById('js-product-content').innerHTML = `
      <div class="empty-state" style="padding:var(--sp-20)">
        <div class="empty-state__icon"><i data-lucide="package-x"></i></div>
        <h2 class="empty-state__title">Product not found</h2>
        <a href="search.html" class="btn btn--primary" style="margin-top:var(--sp-4)">Back to Shop</a>
      </div>`;
    refreshUI();
  } finally {
    Progress.finish();
    if (Auth.isLoggedIn()) Cart.refreshCountCache();
  }
});

/* ── Build Media List ── */
function buildMediaList(p) {
  const list = [];
  if (p.main_image_url) list.push({ type: 'image', url: p.main_image_url });
  const extras = parseMediaUrls(p.extra_media_urls);
  extras.forEach(url => list.push({ type: isVideoUrl(url) ? 'video' : 'image', url }));
  return list;
}

/* ── Render Product ── */
function renderProduct(p) {
  const discount = calcDiscount(p.current_price, p.original_price);
  const isOOS    = p.inventory_count <= 0;
  const isLow    = !isOOS && p.inventory_count <= CONFIG.LOW_STOCK_THRESHOLD;

  document.title = `${p.name} — Aares`;
  document.getElementById('page-desc').content   = truncate(p.description, 155);
  document.getElementById('js-breadcrumb-name').textContent = p.name;
  if (p.category) {
    document.getElementById('js-breadcrumb').insertAdjacentHTML('beforeend',
      `<span class="breadcrumb__sep"><i data-lucide="chevron-right"></i></span>
       <a href="search.html?category=${encodeURIComponent(p.category)}">${sanitize(capitalize(p.category))}</a>
       <span class="breadcrumb__sep"><i data-lucide="chevron-right"></i></span>`
    );
    document.getElementById('js-breadcrumb-name').remove();
    document.getElementById('js-breadcrumb').insertAdjacentHTML('beforeend',
      `<span class="breadcrumb__current">${sanitize(p.name)}</span>`
    );
  }

  const stockHTML = isOOS
    ? `<span class="product-info__stock product-info__stock--out"><i data-lucide="x-circle"></i> Out of stock</span>`
    : isLow
    ? `<span class="product-info__stock product-info__stock--low"><i data-lucide="alert-triangle"></i> Only ${p.inventory_count} left</span>`
    : `<span class="product-info__stock product-info__stock--in"><i data-lucide="check-circle"></i> In stock</span>`;

  document.getElementById('js-product-content').innerHTML = `
    <div class="product-layout">

      <!-- Gallery -->
      <div class="gallery" id="js-gallery">
        <div class="gallery__main" id="js-gallery-main">
          <img class="gallery__main-img" id="js-main-img"
               src="${sanitize(allMedia[0]?.url || '')}"
               alt="${sanitize(p.name)}" loading="eager">
          <button class="gallery__zoom-btn" id="js-zoom-btn" aria-label="Zoom image">
            <i data-lucide="zoom-in"></i>
          </button>
        </div>
        ${allMedia.length > 1 ? `
          <div class="gallery__thumbs" id="js-thumbs">
            ${allMedia.map((m, i) => `
              <button class="gallery__thumb ${i === 0 ? 'gallery__thumb--active' : ''} ${m.type === 'video' ? 'gallery__thumb--video' : ''}"
                      data-index="${i}" aria-label="View image ${i + 1}">
                ${m.type === 'video'
                  ? `<img src="${sanitize(m.url)}" alt="" loading="lazy" onerror="this.src='assets/logo.webp'">
                     <span class="gallery__thumb-play"><i data-lucide="play"></i></span>`
                  : `<img src="${sanitize(m.url)}" alt="" loading="lazy">`
                }
              </button>
            `).join('')}
          </div>` : ''}
      </div>

      <!-- Info -->
      <div class="product-info">
        ${p.category ? `<div class="product-info__category">${sanitize(capitalize(p.category))}</div>` : ''}
        <h1 class="product-info__name">${sanitize(p.name)}</h1>

        ${p.rating_average > 0 ? `
          <div class="product-info__rating-row">
            ${buildStars(p.rating_average)}
            <span class="product-info__rating-count">${p.rating_average.toFixed(1)} rating</span>
          </div>` : ''}

        <div class="product-info__price-block">
          <span class="product-info__price">${formatPrice(p.current_price)}</span>
          ${p.original_price ? `<span class="product-info__original">${formatPrice(p.original_price)}</span>` : ''}
          ${discount > 0 ? `<span class="badge badge--discount">${discount}% off</span>` : ''}
        </div>

        ${stockHTML}

        <div class="product-info__divider"></div>

        ${p.description ? `<p class="product-info__description">${sanitize(p.description)}</p>` : ''}

        <div class="product-info__cart-row">
          <div class="qty-stepper" id="js-qty-stepper">
            <button class="qty-btn" id="js-qty-dec" aria-label="Decrease quantity" ${isOOS ? 'disabled' : ''}>
              <i data-lucide="minus"></i>
            </button>
            <span class="qty-value" id="js-qty-val">1</span>
            <button class="qty-btn" id="js-qty-inc" aria-label="Increase quantity" ${isOOS || p.inventory_count <= 1 ? 'disabled' : ''}>
              <i data-lucide="plus"></i>
            </button>
          </div>

          <button class="btn btn--primary btn--lg" id="js-add-to-cart" ${isOOS ? 'disabled' : ''}>
            <i data-lucide="${isOOS ? 'package-x' : 'shopping-cart'}"></i>
            <span class="btn__text">${isOOS ? 'Out of Stock' : 'Add to Cart'}</span>
          </button>

          <div class="product-info__actions">
            <button class="product-info__share-btn" id="js-share-btn" aria-label="Share this product">
              <i data-lucide="share-2"></i>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  refreshUI();
  bindProductEvents(p);
}

/* ── Product Events ── */
function bindProductEvents(p) {
  let qty = 1;
  const maxQty = p.inventory_count;

  const decBtn  = document.getElementById('js-qty-dec');
  const incBtn  = document.getElementById('js-qty-inc');
  const qtyVal  = document.getElementById('js-qty-val');
  const addBtn  = document.getElementById('js-add-to-cart');
  const zoomBtn = document.getElementById('js-zoom-btn');
  const thumbs  = document.getElementById('js-thumbs');
  const shareBtn = document.getElementById('js-share-btn');

  // Quantity
  decBtn?.addEventListener('click', () => {
    if (qty > 1) { qty--; qtyVal.textContent = qty; incBtn.disabled = false; }
    if (qty <= 1) decBtn.disabled = true;
  });

  incBtn?.addEventListener('click', () => {
    if (qty < maxQty) { qty++; qtyVal.textContent = qty; decBtn.disabled = false; }
    if (qty >= maxQty) incBtn.disabled = true;
  });

  // Add to cart
  addBtn?.addEventListener('click', async () => {
    if (p.inventory_count <= 0) return;
    addBtn.classList.add('loading');
    await Cart.add(p, qty);
    addBtn.classList.remove('loading');
  });

  // Thumbnail gallery
  thumbs?.addEventListener('click', e => {
    const btn = e.target.closest('.gallery__thumb');
    if (!btn) return;
    const idx  = parseInt(btn.dataset.index);
    const media = allMedia[idx];
    if (!media) return;

    activeMediaIndex = idx;
    thumbs.querySelectorAll('.gallery__thumb').forEach((t, i) =>
      t.classList.toggle('gallery__thumb--active', i === idx)
    );

    const mainImg = document.getElementById('js-main-img');
    if (mainImg) {
      mainImg.src = media.url;
      mainImg.style.animation = 'none';
      requestAnimationFrame(() => { mainImg.style.animation = 'fadeIn 0.3s ease'; });
    }
  });

  // Zoom
  zoomBtn?.addEventListener('click', () => openLightbox(activeMediaIndex));
  document.getElementById('js-gallery-main')?.addEventListener('click', e => {
    if (e.target.closest('.gallery__zoom-btn')) return;
    openLightbox(activeMediaIndex);
  });

  // Share
  shareBtn?.addEventListener('click', async () => {
    const url   = window.location.href;
    const title = p.name;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      Toast.success('Link copied to clipboard.');
    }
  });

  // Lightbox nav
  document.getElementById('js-lightbox-close')?.addEventListener('click',    closeLightbox);
  document.getElementById('js-lightbox-backdrop')?.addEventListener('click', closeLightbox);
  document.getElementById('js-lightbox-prev')?.addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('js-lightbox-next')?.addEventListener('click', () => navigateLightbox(1));
  document.addEventListener('keydown', e => {
    if (!document.getElementById('js-lightbox').hidden) {
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowLeft')  navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    }
  });
}

/* ── Lightbox ── */
function openLightbox(index) {
  const lb    = document.getElementById('js-lightbox');
  const img   = document.getElementById('js-lightbox-img');
  const prev  = document.getElementById('js-lightbox-prev');
  const next  = document.getElementById('js-lightbox-next');
  if (!lb || !allMedia.length) return;

  activeMediaIndex  = index;
  img.src           = allMedia[index]?.url || '';
  img.alt           = product?.name || '';
  prev.disabled     = index === 0;
  next.disabled     = index === allMedia.length - 1;
  lb.hidden         = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('js-lightbox').hidden = true;
  document.body.style.overflow = '';
}

function navigateLightbox(dir) {
  const newIdx = clamp(activeMediaIndex + dir, 0, allMedia.length - 1);
  openLightbox(newIdx);
}

/* ── Reviews ── */
async function loadReviews(id) {
  const section = document.getElementById('js-reviews-section');
  const list    = document.getElementById('js-reviews-list');
  const summary = document.getElementById('js-reviews-summary');
  if (!section || !list) return;

  try {
    const reviews = await Reviews.getByProduct(id);
    section.removeAttribute('hidden');

    if (reviews.length) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      summary.innerHTML = `
        <span class="reviews-summary__avg">${avg.toFixed(1)}</span>
        <div class="reviews-summary__meta">
          ${buildStars(avg, 'lg')}
          <span class="reviews-summary__count">${reviews.length} review${reviews.length !== 1 ? 's' : ''}</span>
        </div>`;

      list.innerHTML = reviews.map(r => `
        <div class="review-card reveal">
          <div class="review-card__header">
            <div class="review-card__author">
              <span class="review-card__name">${sanitize(r.accounts?.full_name || 'Customer')}</span>
              <span class="review-card__date">${timeAgo(r.created_at)}</span>
            </div>
            ${buildStars(r.rating)}
          </div>
          <p class="review-card__comment">${sanitize(r.comment || '')}</p>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<p class="reviews-empty">No reviews yet. Be the first to review this product.</p>';
    }

    refreshUI();
    await checkReviewEligibility(id);
  } catch { /* silent */ }
}

async function checkReviewEligibility(productId) {
  const session = Auth.getSession();
  const wrap    = document.getElementById('js-review-form-wrap');
  if (!wrap || !session) return;

  try {
    const [hasPurchased, hasReviewed] = await Promise.all([
      OrderItems.userHasOrdered(session.id, productId),
      Reviews.hasReviewed(session.id, productId),
    ]);

    if (hasPurchased && !hasReviewed) {
      wrap.removeAttribute('hidden');
      bindReviewForm(productId, session.id);
    }
  } catch { /* silent */ }
}

function bindReviewForm(productId, userId) {
  const picker = document.getElementById('js-star-picker');
  const submit = document.getElementById('js-submit-review');

  picker?.querySelectorAll('.star-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.value);
      picker.querySelectorAll('.star-pick').forEach((s, i) => {
        s.classList.toggle('selected', i < selectedRating);
        s.querySelector('svg').style.fill = i < selectedRating ? 'var(--clr-accent)' : 'none';
      });
    });
  });

  submit?.addEventListener('click', async () => {
    const comment = document.getElementById('js-review-comment').value.trim();
    if (!selectedRating) { Toast.warning('Please select a star rating.'); return; }
    if (!comment)        { Toast.warning('Please write a short review.'); return; }

    submit.classList.add('loading');
    try {
      await Reviews.create({ product_id: productId, user_id: userId, rating: selectedRating, comment });
      Toast.success('Review submitted. It will appear after approval.', 'Thank you');
      document.getElementById('js-review-form-wrap').hidden = true;
    } catch {
      Toast.error('Could not submit review. Please try again.');
    } finally {
      submit.classList.remove('loading');
    }
  });
}

/* ── Related Products ── */
async function loadRelated(p) {
  if (!p.category) return;
  const section = document.getElementById('js-related-section');
  const grid    = document.getElementById('js-related-grid');
  if (!section || !grid) return;

  try {
    const results = await Products.search({ category: p.category, sortBy: 'popular' });
    const filtered = results.filter(r => r.id !== p.id).slice(0, 4);
    if (!filtered.length) return;
    section.removeAttribute('hidden');
    grid.innerHTML = filtered.map(r => buildProductCard(r)).join('');
    refreshUI();
  } catch { /* silent */ }
}
