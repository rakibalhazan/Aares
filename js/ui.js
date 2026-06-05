/* ───────────────────────────────────────────
   AARES — ui.js
   Shared UI components and DOM helpers.
   Runs on every page.
─────────────────────────────────────────── */

/* ══════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════ */

const Toast = (() => {
  let container;

  function getContainer() {
    if (!container) {
      container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function show(message, type = 'info', title = '') {
    const c = getContainer();

    const iconMap = {
      success: 'check-circle',
      error:   'x-circle',
      warning: 'alert-triangle',
      info:    'info',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <div class="toast__icon">
        <i data-lucide="${iconMap[type] || 'info'}"></i>
      </div>
      <div class="toast__body">
        ${title ? `<div class="toast__title">${sanitize(title)}</div>` : ''}
        <div class="toast__msg">${sanitize(message)}</div>
      </div>
      <button class="toast__close" aria-label="Close">
        <i data-lucide="x"></i>
      </button>
    `;

    c.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });

    // Close button
    toast.querySelector('.toast__close').addEventListener('click', () => dismiss(toast));

    // Auto-dismiss
    const timer = setTimeout(() => dismiss(toast), CONFIG.TOAST_DURATION);
    toast._timer = timer;

    return toast;
  }

  function dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(toast._timer);
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  return {
    success: (msg, title = 'Success')  => show(msg, 'success', title),
    error:   (msg, title = 'Error')    => show(msg, 'error',   title),
    warning: (msg, title = 'Warning')  => show(msg, 'warning', title),
    info:    (msg, title = '')         => show(msg, 'info',    title),
  };
})();

/* ══════════════════════════════════════════
   PROGRESS BAR
══════════════════════════════════════════ */

const Progress = (() => {
  let bar;
  let width = 0;
  let interval;

  function getBar() {
    if (!bar) {
      bar = document.getElementById('progress-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'progress-bar';
        document.body.appendChild(bar);
      }
    }
    return bar;
  }

  function start() {
    const b = getBar();
    width = 0;
    b.style.width = '0%';
    b.classList.add('active');
    clearInterval(interval);
    interval = setInterval(() => {
      width += Math.random() * 12;
      if (width >= 85) { width = 85; clearInterval(interval); }
      b.style.width = width + '%';
    }, 200);
  }

  function finish() {
    const b = getBar();
    clearInterval(interval);
    b.style.width = '100%';
    setTimeout(() => {
      b.classList.remove('active');
      b.style.width = '0%';
    }, 400);
  }

  return { start, finish };
})();

/* ══════════════════════════════════════════
   BACK TO TOP
══════════════════════════════════════════ */

function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ══════════════════════════════════════════
   OFFLINE DETECTION
══════════════════════════════════════════ */

function initOfflineDetection() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  function update() {
    banner.classList.toggle('visible', !navigator.onLine);
  }

  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

/* ══════════════════════════════════════════
   SCROLL REVEAL
══════════════════════════════════════════ */

function initScrollReveal() {
  const items = document.querySelectorAll(
    '.reveal, .reveal-left, .reveal-right, .reveal-scale'
  );
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  items.forEach(el => observer.observe(el));
}

/* ══════════════════════════════════════════
   NAVBAR BEHAVIOUR
══════════════════════════════════════════ */

function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  // Scroll shadow
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // Set active link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar__link, .bottom-nav__item').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ══════════════════════════════════════════
   CART BADGE
══════════════════════════════════════════ */

function updateCartBadge() {
  const count = Cart.getCount();
  const badges = document.querySelectorAll('.cart-badge, .bottom-nav__badge');

  badges.forEach(badge => {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
      badge.classList.add('anim-badge-pop');
      badge.addEventListener('animationend', () => {
        badge.classList.remove('anim-badge-pop');
      }, { once: true });
    } else {
      badge.classList.add('hidden');
    }
  });
}

/* ══════════════════════════════════════════
   SKELETON HELPERS
══════════════════════════════════════════ */

function buildProductCardSkeleton() {
  return `
    <div class="product-card-skeleton">
      <div class="product-card-skeleton__image skeleton"></div>
      <div class="product-card-skeleton__body">
        <div class="product-card-skeleton__line skeleton" style="width:80%"></div>
        <div class="product-card-skeleton__line skeleton" style="width:55%"></div>
        <div class="product-card-skeleton__line skeleton" style="width:40%; height:18px;"></div>
      </div>
    </div>
  `;
}

function showProductGridSkeletons(container, count = CONFIG.PRODUCTS_PER_PAGE) {
  if (!container) return;
  container.innerHTML = Array(count).fill(buildProductCardSkeleton()).join('');
}

/* ══════════════════════════════════════════
   PRODUCT CARD BUILDER
══════════════════════════════════════════ */

function buildProductCard(product) {
  const discount = calcDiscount(product.current_price, product.original_price);
  const isOOS    = product.inventory_count <= 0;

  return `
    <a href="product.html?id=${product.id}" class="product-card reveal">
      <div class="product-card__image-wrap img-zoom">
        <img
          src="${sanitize(product.main_image_url || '')}"
          alt="${sanitize(product.name)}"
          loading="lazy"
        >
        <div class="product-card__badges">
          ${discount > 0 ? `<span class="badge badge--discount">${discount}% off</span>` : ''}
          ${isOOS ? '' : product.inventory_count <= CONFIG.LOW_STOCK_THRESHOLD && product.inventory_count > 0
            ? `<span class="badge badge--warning">Low stock</span>`
            : ''}
        </div>
        ${isOOS ? `
          <div class="product-card__oos-overlay">
            <span>Out of stock</span>
          </div>
        ` : ''}
      </div>
      <div class="product-card__body">
        <h3 class="product-card__name">${sanitize(product.name)}</h3>
        ${product.rating_average > 0 ? `
          <div class="product-card__rating">
            ${buildStars(product.rating_average, 'sm')}
            <span class="product-card__rating-count text-xs text-light">
              (${product.rating_average.toFixed(1)})
            </span>
          </div>
        ` : ''}
        <div class="product-card__price-row">
          <span class="product-card__price">${formatPrice(product.current_price)}</span>
          ${product.original_price ? `
            <span class="product-card__original-price">${formatPrice(product.original_price)}</span>
          ` : ''}
        </div>
      </div>
    </a>
  `;
}

/* ══════════════════════════════════════════
   PAGE INIT (runs on every page)
══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Init Lucide icons
  lucide.createIcons();

  // Init all shared UI
  initNavbar();
  initBackToTop();
  initOfflineDetection();
  initScrollReveal();
  updateCartBadge();

  // Reveal page
  document.body.classList.add('page-loaded');
});

// Re-run scroll reveal and lucide after dynamic content is injected
function refreshUI() {
  lucide.createIcons();
  initScrollReveal();
}
