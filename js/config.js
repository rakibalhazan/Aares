/* ───────────────────────────────────────────
   AARES — config.js
   Central configuration. Only file you need
   to touch if credentials or settings change.
─────────────────────────────────────────── */

const CONFIG = {

  /* ── Supabase ── */
  SUPABASE_URL:      'https://ztyfpbzjgkwdjrtusfam.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0eWZwYnpqZ2t3ZGpydHVzZmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzcyMjMsImV4cCI6MjA5NTgxMzIyM30.6dBBFH3i5u35XvgG5tkvMsHXQci6T0bKPXA6URAS4_U',

  /* ── Email Notifications (add your Resend key later) ── */
  RESEND_API_KEY: '',
  ADMIN_EMAIL:    '',

  /* ── App Settings ── */
  CURRENCY:              '৳',
  LOW_STOCK_THRESHOLD:   5,
  PRODUCTS_PER_PAGE:     24,
  RECENTLY_VIEWED_LIMIT: 10,
  TOAST_DURATION:        3500,

  /* ── Password Security ── */
  // Static app-level salt added before SHA-256 hashing.
  // Never change this after users have registered — it would
  // invalidate all existing passwords.
  PASSWORD_SALT: 'aares_2024_secure_salt',

  /* ── LocalStorage Keys ── */
  KEYS: {
    CART:            'aares_cart',
    SESSION:         'aares_session',
    RECENTLY_VIEWED: 'aares_recently_viewed',
    SCROLL_POS:      'aares_scroll_',
    RESET_TOKEN:     'aares_reset_',
  },

  /* ── Order Status Values ── */
  ORDER_STATUS: {
    PENDING:   'Pending',
    CONFIRMED: 'Confirmed',
    SHIPPED:   'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  },

  /* ── Payment Methods ── */
  PAYMENT: {
    COD:   'COD',
    BKASH: 'bKash',
  },

};
