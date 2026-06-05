let cartItems = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Must be logged in
  if (!Auth.isLoggedIn()) {
    window.location.href = 'account.html?redirect=checkout.html';
    return;
  }

  Progress.start();
  await loadCheckoutData();
  bindCheckoutEvents();
  Progress.finish();
  Cart.refreshCountCache();
});

/* ── Load Cart + Pre-fill User Data ── */
async function loadCheckoutData() {
  const session = Auth.getSession();
  cartItems = await Cart.getCart();

  if (!cartItems.length) {
    window.location.href = 'cart.html';
    return;
  }

  // Pre-fill address and phone from account
  document.getElementById('co-address').value = session.address || '';
  document.getElementById('co-phone').value   = session.mobile_number || '';

  // Render order summary
  renderOrderSummary(cartItems);
}

/* ── Render Order Summary ── */
function renderOrderSummary(items) {
  const container = document.getElementById('js-order-items');
  const totalEl   = document.getElementById('js-order-total');
  if (!container) return;

  let total = 0;
  container.innerHTML = items.map(item => {
    const line = item.current_price * item.quantity;
    total += line;
    return `
      <div class="checkout-summary__item">
        <div class="checkout-summary__item-img">
          <img src="${sanitize(item.main_image_url || '')}" alt="${sanitize(item.name)}" loading="lazy">
        </div>
        <div class="checkout-summary__item-info">
          <div class="checkout-summary__item-name">${sanitize(item.name)}</div>
          <div class="checkout-summary__item-sub">Qty: ${item.quantity}</div>
        </div>
        <div class="checkout-summary__item-price">${formatPrice(line)}</div>
      </div>
    `;
  }).join('');

  if (totalEl) totalEl.textContent = formatPrice(total);
  refreshUI();
}

/* ── Bind Events ── */
function bindCheckoutEvents() {
  // Payment method toggle
  document.querySelectorAll('[name="payment"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const bkashField = document.getElementById('js-bkash-field');
      if (bkashField) {
        bkashField.classList.toggle('hidden', radio.value !== 'bKash');
      }
    });
  });

  // Place order
  document.getElementById('js-place-order')?.addEventListener('click', placeOrder);
}

/* ── Place Order ── */
async function placeOrder() {
  const session       = Auth.getSession();
  const address       = document.getElementById('co-address')?.value.trim();
  const phone         = document.getElementById('co-phone')?.value.trim();
  const paymentMethod = document.querySelector('[name="payment"]:checked')?.value;
  const txnId         = document.getElementById('co-txn-id')?.value.trim();
  const notes         = document.getElementById('co-notes')?.value.trim();
  const termsChecked  = document.getElementById('co-terms')?.checked;
  const btn           = document.getElementById('js-place-order');

  // Validate
  if (!address) { Toast.error('Please enter your delivery address.'); return; }
  if (!phone)   { Toast.error('Please enter your mobile number.'); return; }
  if (!isValidMobile(phone)) { Toast.error('Enter a valid Bangladeshi mobile number.'); return; }
  if (paymentMethod === 'bKash' && !txnId) { Toast.error('Please enter your bKash transaction ID.'); return; }
  if (!termsChecked) { Toast.warning('Please confirm your order details.'); return; }

  btn.classList.add('loading');
  Progress.start();

  try {
    // Update address if changed
    if (address !== session.address) {
      await Accounts.update(session.id, { address });
    }

    const total      = cartItems.reduce((s, i) => s + i.current_price * i.quantity, 0);
    const orderRef   = generateOrderRef();

    // Create order in Supabase
    const order = await Orders.create({
      user_id:        session.id,
      payment_method: paymentMethod,
      transaction_id: txnId || null,
      status:         CONFIG.ORDER_STATUS.PENDING,
      total_amount:   total,
    });

    // Create order items
    const orderItems = cartItems.map(item => ({
      order_id:          order.id,
      product_id:        item.product_id,
      quantity:          item.quantity,
      price_at_purchase: item.current_price,
    }));

    await OrderItems.createBatch(orderItems);

    // Send email notification to admin
    await Notifications.sendOrderAlert({
      orderRef,
      total,
      items:          orderItems.map((oi, i) => ({ ...oi, name: cartItems[i].name })),
      customerName:   session.full_name,
      mobile:         phone,
      address,
      paymentMethod,
      transactionId:  txnId || null,
      notes:          notes || null,
    });

    // Clear the cart
    await Cart.clear();

    // Redirect to confirmation page
    sessionStorage.setItem('aares_last_order', JSON.stringify({
      orderId:   order.id,
      orderRef,
      total,
      paymentMethod,
    }));

    Progress.finish();
    window.location.href = 'order-confirmation.html';

  } catch (err) {
    Toast.error('Could not place your order. Please try again.');
    console.error('Order error:', err);
    btn.classList.remove('loading');
    Progress.finish();
  }
}
