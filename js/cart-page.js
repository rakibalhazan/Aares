/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  Progress.start();
  await renderCart();
  bindCartEvents();
  Progress.finish();
  if (Auth.isLoggedIn()) Cart.refreshCountCache();
});

/* ── Render Cart ── */
async function renderCart() {
  const itemsContainer = document.getElementById('js-cart-items');
  const layout         = document.getElementById('js-cart-layout');
  const emptyState     = document.getElementById('js-empty-cart');
  const subtotalEl     = document.getElementById('js-subtotal');
  const totalEl        = document.getElementById('js-total');

  const items = await Cart.getCart();

  if (!items.length) {
    layout.hidden     = true;
    emptyState.hidden = false;
    return;
  }

  layout.hidden     = false;
  emptyState.hidden = true;

  itemsContainer.innerHTML = items.map(item => Cart.buildCartItemHTML(item)).join('');

  const total = items.reduce((s, i) => s + i.current_price * i.quantity, 0);
  subtotalEl.textContent = formatPrice(total);
  totalEl.textContent    = formatPrice(total);

  refreshUI();
}

/* ── Bind Events ── */
function bindCartEvents() {
  const itemsContainer = document.getElementById('js-cart-items');
  const checkoutBtn    = document.getElementById('js-checkout-btn');

  // Delegate click events on cart items
  itemsContainer?.addEventListener('click', async e => {
    const removeBtn   = e.target.closest('.cart-remove');
    const decrementBtn = e.target.closest('.cart-decrement');
    const incrementBtn = e.target.closest('.cart-increment');

    if (removeBtn) {
      const id   = parseInt(removeBtn.dataset.id);
      const card = removeBtn.closest('.cart-item');
      card?.classList.add('removing');
      setTimeout(async () => {
        await Cart.remove(id);
        await renderCart();
      }, 250);
    }

    if (decrementBtn) {
      const id   = parseInt(decrementBtn.dataset.id);
      const card = decrementBtn.closest('.cart-item');
      const valEl = card?.querySelector('.qty-value');
      if (!valEl) return;
      const current = parseInt(valEl.textContent);
      if (current <= 1) {
        // Removing last unit removes the item
        if (confirm('Remove this item from your cart?')) {
          card.classList.add('removing');
          setTimeout(async () => { await Cart.remove(id); await renderCart(); }, 250);
        }
        return;
      }
      await Cart.updateQuantity(id, current - 1);
      await renderCart();
    }

    if (incrementBtn) {
      const id    = parseInt(incrementBtn.dataset.id);
      const card  = incrementBtn.closest('.cart-item');
      const valEl = card?.querySelector('.qty-value');
      if (!valEl) return;
      const current = parseInt(valEl.textContent);
      await Cart.updateQuantity(id, current + 1);
      await renderCart();
    }
  });

  // Checkout button
  checkoutBtn?.addEventListener('click', () => {
    if (!Auth.isLoggedIn()) {
      // Redirect to account page with redirect back to checkout
      window.location.href = 'account.html?redirect=checkout.html';
      return;
    }
    window.location.href = 'checkout.html';
  });
}
