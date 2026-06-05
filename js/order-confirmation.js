/* ── order-confirmation.js ── */
document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('aares_last_order');
  if (!raw) { window.location.href = 'index.html'; return; }

  const order = JSON.parse(raw);
  document.getElementById('js-conf-order-id').textContent = `#${order.orderId}`;
  document.getElementById('js-conf-total').textContent    = formatPrice(order.total);
  document.getElementById('js-conf-payment').textContent  = order.paymentMethod;

  // Clear from session so refreshing redirects home
  sessionStorage.removeItem('aares_last_order');
});
