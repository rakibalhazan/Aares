/* ───────────────────────────────────────────
   AARES — utils.js
   Pure helper functions. No DOM, no Supabase.
─────────────────────────────────────────── */

/* ── Price & Currency ── */

function formatPrice(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return `${CONFIG.CURRENCY}0`;
  return `${CONFIG.CURRENCY}${num.toLocaleString('en-BD')}`;
}

function calcDiscount(current, original) {
  if (!original || original <= current) return 0;
  return Math.round(((original - current) / original) * 100);
}

/* ── Dates ── */

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-BD', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  });
}

function formatDateShort(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-BD', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

function timeAgo(dateString) {
  const now  = Date.now();
  const then = new Date(dateString).getTime();
  const diff = now - then;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)    return 'Just now';
  if (mins < 60)   return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days < 7)    return `${days}d ago`;
  return formatDateShort(dateString);
}

/* ── Password Hashing (SHA-256 + static salt) ── */

async function hashPassword(password) {
  const salted  = CONFIG.PASSWORD_SALT + password;
  const encoder = new TextEncoder();
  const data    = encoder.encode(salted);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ── URL Params ── */

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function setParam(key, value) {
  const params = new URLSearchParams(window.location.search);
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

/* ── String Helpers ── */

function truncate(text, length = 80) {
  if (!text) return '';
  return text.length > length ? text.slice(0, length).trimEnd() + '...' : text;
}

// Prevent XSS: sanitize user-provided strings before injecting into innerHTML
function sanitize(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ── Star Rating HTML ── */

function buildStars(rating, size = '') {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const cls   = size ? ` stars--${size}` : '';

  let html = `<span class="stars${cls}" aria-label="${rating} out of 5 stars">`;
  for (let i = 0; i < full;  i++) html += `<i data-lucide="star"      class="star-filled"></i>`;
  if (half)                        html += `<i data-lucide="star-half" class="star-half"></i>`;
  for (let i = 0; i < empty; i++) html += `<i data-lucide="star"      class="star-empty"></i>`;
  html += '</span>';
  return html;
}

/* ── Order Reference ── */

function generateOrderRef() {
  return 'ARS-' + Date.now().toString(36).toUpperCase();
}

/* ── Media URL Helpers ── */

// Split comma-separated media URLs into array, filter empty strings
function parseMediaUrls(urlString) {
  if (!urlString) return [];
  return urlString.split(',').map(u => u.trim()).filter(Boolean);
}

// Check if a URL is a video (basic check)
function isVideoUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('youtube')   ||
    lower.includes('youtu.be')  ||
    lower.includes('vimeo')     ||
    lower.match(/\.(mp4|webm|ogg|mov)(\?|$)/)
  );
}

/* ── Validation ── */

function isValidMobile(mobile) {
  // Bangladesh mobile: 11 digits starting with 01
  return /^01[3-9]\d{8}$/.test(mobile.replace(/\s/g, ''));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return password && password.length >= 6;
}

/* ── Recently Viewed ── */

function addRecentlyViewed(productId) {
  const key  = CONFIG.KEYS.RECENTLY_VIEWED;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  const filtered = list.filter(id => id !== productId);
  filtered.unshift(productId);
  localStorage.setItem(
    key,
    JSON.stringify(filtered.slice(0, CONFIG.RECENTLY_VIEWED_LIMIT))
  );
}

function getRecentlyViewedIds() {
  return JSON.parse(localStorage.getItem(CONFIG.KEYS.RECENTLY_VIEWED) || '[]');
}

/* ── Scroll Position Memory ── */

function saveScrollPos(pageKey) {
  sessionStorage.setItem(
    CONFIG.KEYS.SCROLL_POS + pageKey,
    window.scrollY.toString()
  );
}

function restoreScrollPos(pageKey) {
  const y = sessionStorage.getItem(CONFIG.KEYS.SCROLL_POS + pageKey);
  if (y) {
    window.scrollTo({ top: parseInt(y, 10), behavior: 'instant' });
    sessionStorage.removeItem(CONFIG.KEYS.SCROLL_POS + pageKey);
  }
}

/* ── Misc ── */

function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get YouTube embed URL from watch URL
function getYouTubeEmbed(url) {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}
