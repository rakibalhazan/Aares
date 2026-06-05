let forgotUserId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn()) {
    showAccountView();
  } else {
    showAuthView();
  }
  Cart.refreshCountCache?.();
});

/* ══ SHOW/HIDE VIEWS ══ */

function showAuthView() {
  document.getElementById('js-auth-view').removeAttribute('hidden');
  document.getElementById('js-account-view').setAttribute('hidden', '');
  bindAuthEvents();

  // Auto-switch to register tab if ?tab=register
  if (getParam('tab') === 'register') switchAuthTab('register');
}

function showAccountView() {
  document.getElementById('js-auth-view').setAttribute('hidden', '');
  document.getElementById('js-account-view').removeAttribute('hidden');
  populateAccountView();
  bindAccountEvents();

  // Jump to orders tab if URL has #orders
  if (window.location.hash === '#orders') switchAccountTab('orders');
}

/* ══ AUTH EVENTS ══ */

function bindAuthEvents() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
  });

  // Login
  document.getElementById('js-login-btn')?.addEventListener('click', handleLogin);
  document.getElementById('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  // Register
  document.getElementById('js-register-btn')?.addEventListener('click', handleRegister);

  // Password toggles
  bindPasswordToggle('login-password',   'js-login-pw-toggle');
  bindPasswordToggle('reg-password',     'js-reg-pw-toggle');
  bindPasswordToggle('forgot-new-pw',    'js-new-pw-toggle');

  // Forgot password
  document.getElementById('js-show-forgot')?.addEventListener('click', () => switchAuthTab('forgot'));
  document.getElementById('js-back-to-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('js-forgot-next')?.addEventListener('click', handleForgotStep1);
  document.getElementById('js-forgot-verify')?.addEventListener('click', handleForgotStep2);
  document.getElementById('js-forgot-reset')?.addEventListener('click', handleForgotStep3);
}

function switchAuthTab(tab) {
  document.getElementById('js-login-form').classList.toggle('hidden',    tab !== 'login');
  document.getElementById('js-register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('js-forgot-form').classList.toggle('hidden',   tab !== 'forgot');
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('auth-tab--active', t.dataset.tab === tab);
  });
}

function bindPasswordToggle(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input || !btn) return;
  btn.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('svg')?.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
    lucide.createIcons({ nodes: [btn] });
  });
}

/* ── Login ── */
async function handleLogin() {
  const credential = document.getElementById('login-credential')?.value.trim();
  const password   = document.getElementById('login-password')?.value;
  const btn        = document.getElementById('js-login-btn');
  const errEl      = document.getElementById('js-login-error');

  errEl.classList.add('hidden');
  btn.classList.add('loading');

  try {
    await Auth.login(credential, password);
    const redirect = getParam('redirect');
    window.location.href = redirect || 'account.html';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    document.getElementById('login-credential')?.classList.add('anim-shake');
    setTimeout(() => document.getElementById('login-credential')?.classList.remove('anim-shake'), 500);
  } finally {
    btn.classList.remove('loading');
  }
}

/* ── Register ── */
async function handleRegister() {
  const btn   = document.getElementById('js-register-btn');
  const errEl = document.getElementById('js-reg-error');
  errEl.classList.add('hidden');
  btn.classList.add('loading');

  try {
    await Auth.register({
      full_name:         document.getElementById('reg-name')?.value,
      mobile_number:     document.getElementById('reg-mobile')?.value,
      email:             document.getElementById('reg-email')?.value,
      password:          document.getElementById('reg-password')?.value,
      address:           document.getElementById('reg-address')?.value,
      security_question: document.getElementById('reg-sec-q')?.value,
      security_answer:   document.getElementById('reg-sec-a')?.value,
    });
    const redirect = getParam('redirect');
    window.location.href = redirect || 'account.html';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('loading');
  }
}

/* ── Forgot Password ── */
async function handleForgotStep1() {
  const credential = document.getElementById('forgot-credential')?.value.trim();
  const errEl      = document.getElementById('js-forgot-error');
  const btn        = document.getElementById('js-forgot-next');
  errEl.classList.add('hidden');
  btn.classList.add('loading');

  try {
    const { userId, question } = await Auth.getSecurityQuestion(credential);
    forgotUserId = userId;
    document.getElementById('js-forgot-question').textContent = question;
    document.getElementById('js-forgot-step1').classList.add('hidden');
    document.getElementById('js-forgot-step2').classList.remove('hidden');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('loading');
  }
}

async function handleForgotStep2() {
  const answer = document.getElementById('forgot-answer')?.value.trim();
  const errEl  = document.getElementById('js-forgot-answer-error');
  const btn    = document.getElementById('js-forgot-verify');
  errEl.classList.add('hidden');
  btn.classList.add('loading');

  try {
    const credential = document.getElementById('forgot-credential')?.value.trim();
    await Auth.verifySecurityAnswer(credential, answer);
    document.getElementById('js-forgot-step2').classList.add('hidden');
    document.getElementById('js-forgot-step3').classList.remove('hidden');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('loading');
  }
}

async function handleForgotStep3() {
  const newPw  = document.getElementById('forgot-new-pw')?.value;
  const errEl  = document.getElementById('js-forgot-pw-error');
  const btn    = document.getElementById('js-forgot-reset');
  errEl.classList.add('hidden');
  btn.classList.add('loading');

  try {
    await Auth.resetPassword(forgotUserId, newPw);
    Toast.success('Password reset successfully. Please log in.', 'Done');
    setTimeout(() => switchAuthTab('login'), 1000);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('loading');
  }
}

/* ══ ACCOUNT VIEW ══ */

function populateAccountView() {
  const session = Auth.getSession();
  document.getElementById('js-account-name').textContent   = session.full_name;
  document.getElementById('js-account-mobile').textContent = session.mobile_number;
  renderProfileView(session);
  loadOrders();
}

function renderProfileView(session) {
  const view = document.getElementById('js-profile-view');
  if (!view) return;
  view.innerHTML = `
    <div class="profile-row"><span class="profile-row__label">Full Name</span><span class="profile-row__value">${sanitize(session.full_name)}</span></div>
    <div class="profile-row"><span class="profile-row__label">Mobile</span><span class="profile-row__value">${sanitize(session.mobile_number)}</span></div>
    <div class="profile-row"><span class="profile-row__label">Email</span><span class="profile-row__value">${session.email ? sanitize(session.email) : '<span class="text-light">Not provided</span>'}</span></div>
    <div class="profile-row"><span class="profile-row__label">Address</span><span class="profile-row__value">${session.address ? sanitize(session.address) : '<span class="text-light">Not provided</span>'}</span></div>
  `;
}

function bindAccountEvents() {
  // Tab switching
  document.querySelectorAll('.account-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAccountTab(tab.dataset.tab));
  });

  // Logout
  document.getElementById('js-logout-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) Auth.logout();
  });

  // Edit profile
  document.getElementById('js-edit-profile-btn')?.addEventListener('click', () => {
    const session = Auth.getSession();
    document.getElementById('edit-name').value    = session.full_name || '';
    document.getElementById('edit-email').value   = session.email    || '';
    document.getElementById('edit-address').value = session.address  || '';
    document.getElementById('js-profile-view').classList.add('hidden');
    document.getElementById('js-profile-edit').classList.remove('hidden');
  });

  document.getElementById('js-cancel-edit')?.addEventListener('click', () => {
    document.getElementById('js-profile-view').classList.remove('hidden');
    document.getElementById('js-profile-edit').classList.add('hidden');
  });

  document.getElementById('js-save-profile')?.addEventListener('click', async () => {
    const btn   = document.getElementById('js-save-profile');
    const errEl = document.getElementById('js-profile-error');
    errEl.classList.add('hidden');
    btn.classList.add('loading');
    try {
      await Auth.updateProfile({
        full_name: document.getElementById('edit-name').value,
        email:     document.getElementById('edit-email').value,
        address:   document.getElementById('edit-address').value,
      });
      Toast.success('Profile updated successfully.');
      renderProfileView(Auth.getSession());
      document.getElementById('js-account-name').textContent = Auth.getSession().full_name;
      document.getElementById('js-profile-view').classList.remove('hidden');
      document.getElementById('js-profile-edit').classList.add('hidden');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.classList.remove('loading');
    }
  });

  // Change password
  document.getElementById('js-change-pw-btn')?.addEventListener('click', async () => {
    const btn    = document.getElementById('js-change-pw-btn');
    const errEl  = document.getElementById('js-pw-error');
    errEl.classList.add('hidden');
    btn.classList.add('loading');
    try {
      await Auth.changePassword(
        document.getElementById('sec-current-pw').value,
        document.getElementById('sec-new-pw').value
      );
      Toast.success('Password changed successfully.');
      document.getElementById('sec-current-pw').value = '';
      document.getElementById('sec-new-pw').value     = '';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.classList.remove('loading');
    }
  });
}

function switchAccountTab(tab) {
  document.querySelectorAll('.account-tab').forEach(t => t.classList.toggle('account-tab--active', t.dataset.tab === tab));
  document.getElementById('js-tab-profile').classList.toggle('hidden',   tab !== 'profile');
  document.getElementById('js-tab-orders').classList.toggle('hidden',    tab !== 'orders');
  document.getElementById('js-tab-security').classList.toggle('hidden',  tab !== 'security');
}

/* ── Load Orders ── */
async function loadOrders() {
  const session = Auth.getSession();
  const list    = document.getElementById('js-orders-list');
  if (!list) return;

  list.innerHTML = `<div style="padding:var(--sp-8);text-align:center"><div class="spinner spinner--lg"></div></div>`;

  try {
    const orders = await Orders.getByUser(session.id);

    if (!orders.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon"><i data-lucide="package"></i></div>
          <h3 class="empty-state__title">No orders yet</h3>
          <p class="empty-state__desc">Your orders will appear here once you place one.</p>
          <a href="search.html" class="btn btn--primary" style="margin-top:var(--sp-4)">Start Shopping</a>
        </div>`;
      refreshUI();
      return;
    }

    // Fetch items for each order
    const ordersWithItems = await Promise.all(orders.map(async o => {
      const items = await OrderItems.getByOrder(o.id).catch(() => []);
      return { ...o, items };
    }));

    list.innerHTML = ordersWithItems.map(o => buildOrderCard(o)).join('');
    refreshUI();
  } catch {
    list.innerHTML = `<p class="text-muted" style="padding:var(--sp-8)">Could not load orders.</p>`;
  }
}

function buildOrderCard(order) {
  const statusClass = {
    Pending:   'order-status--pending',
    Confirmed: 'order-status--confirmed',
    Shipped:   'order-status--shipped',
    Delivered: 'order-status--delivered',
    Cancelled: 'order-status--cancelled',
  }[order.status] || 'order-status--pending';

  const itemsHTML = order.items.map(i => `
    <div class="order-card__item">
      <span>${sanitize(i.products?.name || 'Product')} x${i.quantity}</span>
      <span>${formatPrice(i.price_at_purchase * i.quantity)}</span>
    </div>
  `).join('');

  return `
    <div class="order-card">
      <div class="order-card__header">
        <div>
          <div class="order-card__id">Order #${order.id}</div>
          <div class="order-card__date">${formatDate(order.order_date)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--sp-3)">
          <span class="badge badge--${order.payment_method === 'COD' ? 'new' : 'accent'}">${sanitize(order.payment_method)}</span>
          <span class="order-status ${statusClass}">${sanitize(order.status)}</span>
        </div>
      </div>
      <div class="order-card__body">
        ${itemsHTML}
        <div class="order-card__total">
          <span>Total</span>
          <span class="order-card__total-val">${formatPrice(order.total_amount)}</span>
        </div>
      </div>
    </div>
  `;
}
