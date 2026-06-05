/* ───────────────────────────────────────────
   AARES — cart.js
   Cart logic.
   - Guest: localStorage array of
     { product_id, quantity, name, price, image }
   - Logged-in: Supabase cart table
   - On login: merge localStorage → Supabase
─────────────────────────────────────────── */

const Cart = (() => {

  /* ── LocalStorage Guest Cart ── */

  function getGuestCart() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.KEYS.CART) || '[]');
    } catch {
      return [];
    }
  }

  function saveGuestCart(items) {
    localStorage.setItem(CONFIG.KEYS.CART, JSON.stringify(items));
  }

  function clearGuestCart() {
    localStorage.removeItem(CONFIG.KEYS.CART);
  }

  /* ── Get Full Cart ── */
  // Returns array of { product_id, quantity, name, current_price, original_price, main_image_url, inventory_count }

  async function getCart() {
    const session = Auth.getSession();

    if (session) {
      // Logged-in: fetch from Supabase
      try {
        const rows = await CartDB.getByUser(session.id);
        return rows
          .filter(row => row.products && row.products.is_active)
          .map(row => ({
            product_id:      row.products.id,
            quantity:        row.quantity,
            name:            row.products.name,
            current_price:   row.products.current_price,
            original_price:  row.products.original_price,
            main_image_url:  row.products.main_image_url,
            inventory_count: row.products.inventory_count,
          }));
      } catch (err) {
        console.error('Cart fetch error:', err);
        return [];
      }
    } else {
      // Guest: localStorage (only basic fields stored)
      return getGuestCart();
    }
  }

  /* ── Add to Cart ── */

  async function add(product, quantity = 1) {
    if (!product || product.inventory_count <= 0) {
      Toast.error('This product is out of stock.');
      return false;
    }

    const session = Auth.getSession();
    const qty = Math.max(1, parseInt(quantity, 10));

    if (session) {
      // Logged-in: upsert in Supabase
      try {
        // Get current quantity if already in cart
        const current = await getCart();
        const existing = current.find(i => i.product_id === product.id);
        const newQty = Math.min(
          (existing ? existing.quantity : 0) + qty,
          product.inventory_count
        );
        await CartDB.upsert(session.id, product.id, newQty);
      } catch (err) {
        Toast.error('Could not add to cart. Please try again.');
        return false;
      }
    } else {
      // Guest: localStorage
      const items    = getGuestCart();
      const existing = items.findIndex(i => i.product_id === product.id);

      if (existing >= 0) {
        items[existing].quantity = Math.min(
          items[existing].quantity + qty,
          product.inventory_count
        );
      } else {
        items.push({
          product_id:      product.id,
          quantity:        qty,
          name:            product.name,
          current_price:   product.current_price,
          original_price:  product.original_price,
          main_image_url:  product.main_image_url,
          inventory_count: product.inventory_count,
        });
      }
      saveGuestCart(items);
    }

    updateCartBadge();
    Toast.success(`${sanitize(product.name)} added to cart.`, 'Added');
    return true;
  }

  /* ── Remove from Cart ── */

  async function remove(productId) {
    const session = Auth.getSession();

    if (session) {
      try {
        await CartDB.remove(session.id, productId);
      } catch (err) {
        Toast.error('Could not remove item. Please try again.');
        return;
      }
    } else {
      const items = getGuestCart().filter(i => i.product_id !== productId);
      saveGuestCart(items);
    }

    updateCartBadge();
  }

  /* ── Update Quantity ── */

  async function updateQuantity(productId, quantity) {
    if (quantity < 1) { await remove(productId); return; }

    const session = Auth.getSession();

    if (session) {
      try {
        await CartDB.upsert(session.id, productId, quantity);
      } catch (err) {
        Toast.error('Could not update quantity.');
      }
    } else {
      const items = getGuestCart();
      const idx   = items.findIndex(i => i.product_id === productId);
      if (idx >= 0) {
        items[idx].quantity = Math.max(1, quantity);
        saveGuestCart(items);
      }
    }

    updateCartBadge();
  }

  /* ── Get Count (total items) ── */

  function getCount() {
    const session = Auth.getSession();
    // For badge display we always read localStorage (fast, synchronous).
    // After login, localStorage is also updated in syncGuestCartToSupabase.
    if (!session) {
      return getGuestCart().reduce((s, i) => s + i.quantity, 0);
    }
    // For logged-in users, we keep a count cache in localStorage
    try {
      const cache = JSON.parse(localStorage.getItem('aares_cart_count') || '0');
      return parseInt(cache, 10) || 0;
    } catch {
      return 0;
    }
  }

  // Update count cache for logged-in users
  async function refreshCountCache() {
    const session = Auth.getSession();
    if (!session) return;
    try {
      const items = await getCart();
      const count = items.reduce((s, i) => s + i.quantity, 0);
      localStorage.setItem('aares_cart_count', count.toString());
      updateCartBadge();
    } catch { /* silent */ }
  }

  /* ── Get Total Price ── */

  async function getTotal() {
    const items = await getCart();
    return items.reduce((s, i) => s + (i.current_price * i.quantity), 0);
  }

  /* ── Clear Cart ── */

  async function clear() {
    const session = Auth.getSession();
    if (session) {
      try {
        await CartDB.clear(session.id);
        localStorage.setItem('aares_cart_count', '0');
      } catch { /* silent */ }
    } else {
      clearGuestCart();
    }
    updateCartBadge();
  }

  /* ── Sync Guest Cart to Supabase on Login ── */

  async function syncGuestCartToSupabase(userId) {
    const guestItems = getGuestCart();
    if (!guestItems.length) return;

    try {
      for (const item of guestItems) {
        // Get what's already in Supabase to merge quantities
        await CartDB.upsert(userId, item.product_id, item.quantity);
      }
      clearGuestCart();
      await refreshCountCache();
    } catch (err) {
      console.warn('Cart sync error:', err);
      // Not critical — user can still proceed
    }
  }

  /* ── Build Cart Item HTML ── */

  function buildCartItemHTML(item) {
    const discount   = calcDiscount(item.current_price, item.original_price);
    const lineTotal  = formatPrice(item.current_price * item.quantity);
    const isOOS      = item.inventory_count <= 0;

    return `
      <div class="cart-item" data-product-id="${item.product_id}">
        <a href="product.html?id=${item.product_id}" class="cart-item__img-link">
          <div class="cart-item__img img-zoom">
            <img src="${sanitize(item.main_image_url || '')}"
                 alt="${sanitize(item.name)}" loading="lazy">
          </div>
        </a>
        <div class="cart-item__details">
          <a href="product.html?id=${item.product_id}" class="cart-item__name">
            ${sanitize(item.name)}
          </a>
          <div class="cart-item__price-row">
            <span class="cart-item__price">${formatPrice(item.current_price)}</span>
            ${item.original_price
              ? `<span class="cart-item__original">${formatPrice(item.original_price)}</span>`
              : ''}
            ${discount > 0
              ? `<span class="badge badge--discount">${discount}% off</span>`
              : ''}
          </div>
          ${isOOS
            ? `<span class="badge badge--oos">Out of stock</span>`
            : item.inventory_count <= CONFIG.LOW_STOCK_THRESHOLD
              ? `<span class="badge badge--warning">Only ${item.inventory_count} left</span>`
              : ''}
        </div>
        <div class="cart-item__actions">
          <div class="qty-stepper">
            <button class="qty-btn cart-decrement"
                    data-id="${item.product_id}"
                    aria-label="Decrease quantity"
                    ${item.quantity <= 1 ? '' : ''}>
              <i data-lucide="minus"></i>
            </button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn cart-increment"
                    data-id="${item.product_id}"
                    aria-label="Increase quantity"
                    ${item.quantity >= item.inventory_count ? 'disabled' : ''}>
              <i data-lucide="plus"></i>
            </button>
          </div>
          <div class="cart-item__line-total">${lineTotal}</div>
          <button class="btn btn--icon btn--ghost cart-remove"
                  data-id="${item.product_id}"
                  aria-label="Remove item">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `;
  }

  /* ── Public API ── */
  return {
    getCart,
    add,
    remove,
    updateQuantity,
    getCount,
    getTotal,
    clear,
    syncGuestCartToSupabase,
    refreshCountCache,
    buildCartItemHTML,
  };

})();
