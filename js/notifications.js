/* ───────────────────────────────────────────
   AARES — notifications.js
   Sends order alert email to admin via Resend.
   Requires RESEND_API_KEY + ADMIN_EMAIL in config.js
   Email failure never blocks order placement.
─────────────────────────────────────────── */

const Notifications = (() => {

  function buildEmailHTML(data) {
    const itemRows = data.items.map(item => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #E4E3E0;font-size:14px;color:#1A1A1A">
          ${item.name}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #E4E3E0;font-size:14px;color:#6B6B6B;text-align:center">
          x${item.quantity}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #E4E3E0;font-size:14px;color:#1A1A1A;text-align:right;font-weight:600">
          ${formatPrice(item.price_at_purchase * item.quantity)}
        </td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#FAF9F7;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E4E3E0">

    <!-- Header -->
    <div style="background:#1A1A1A;padding:28px 32px">
      <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#C9933A;font-weight:600">Aares</p>
      <h1 style="margin:8px 0 0;font-size:22px;color:#ffffff;font-weight:600">New Order Received</h1>
      <p style="margin:6px 0 0;font-size:16px;color:#C9933A;font-weight:700">${data.orderRef}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px">

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:#6B6B6B;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:10px;border-bottom:2px solid #1A1A1A">Product</th>
            <th style="text-align:center;font-size:11px;color:#6B6B6B;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:10px;border-bottom:2px solid #1A1A1A">Qty</th>
            <th style="text-align:right;font-size:11px;color:#6B6B6B;letter-spacing:0.1em;text-transform:uppercase;padding-bottom:10px;border-bottom:2px solid #1A1A1A">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Total -->
      <div style="text-align:right;margin-bottom:32px;padding:16px;background:#FAF9F7;border-radius:8px">
        <span style="font-size:13px;color:#6B6B6B;text-transform:uppercase;letter-spacing:0.1em">Order Total</span><br>
        <span style="font-size:24px;font-weight:700;color:#1A1A1A">${formatPrice(data.total)}</span>
      </div>

      <!-- Customer Info -->
      <h2 style="font-size:13px;color:#6B6B6B;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;font-weight:600">Customer Details</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6B6B6B;width:130px">Name</td>
          <td style="padding:6px 0;font-size:13px;color:#1A1A1A;font-weight:500">${data.customerName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6B6B6B">Mobile</td>
          <td style="padding:6px 0;font-size:13px;color:#1A1A1A;font-weight:500">${data.mobile}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6B6B6B">Address</td>
          <td style="padding:6px 0;font-size:13px;color:#1A1A1A">${data.address || 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6B6B6B">Payment</td>
          <td style="padding:6px 0;font-size:14px;color:#1A1A1A;font-weight:700">${data.paymentMethod}</td>
        </tr>
        ${data.transactionId ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6B6B6B">Transaction ID</td>
          <td style="padding:6px 0;font-size:14px;color:#C9933A;font-weight:700">${data.transactionId}</td>
        </tr>` : ''}
        ${data.notes ? `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#6B6B6B">Notes</td>
          <td style="padding:6px 0;font-size:13px;color:#1A1A1A">${data.notes}</td>
        </tr>` : ''}
      </table>

      <!-- CTA -->
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #E4E3E0;text-align:center">
        <a href="https://supabase.com/dashboard" style="display:inline-block;background:#C9933A;color:#ffffff;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:0.05em;text-decoration:none;text-transform:uppercase">
          Manage in Supabase Studio
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#FAF9F7;padding:16px 32px;text-align:center;border-top:1px solid #E4E3E0">
      <p style="margin:0;font-size:11px;color:#9E9E9E">Aares automated order notification</p>
    </div>

  </div>
</body>
</html>`;
  }

  async function sendOrderAlert(orderData) {
    if (!CONFIG.RESEND_API_KEY || !CONFIG.ADMIN_EMAIL) {
      console.warn('[Aares] Email not configured. Add RESEND_API_KEY and ADMIN_EMAIL to config.js');
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${CONFIG.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from:    'Aares Orders <orders@aares.store>',
          to:      [CONFIG.ADMIN_EMAIL],
          subject: `New Order ${orderData.orderRef} — ${formatPrice(orderData.total)}`,
          html:    buildEmailHTML(orderData),
        }),
      });

      if (!res.ok) throw new Error(`Resend responded with ${res.status}`);
    } catch (err) {
      // Email failure must NEVER block the order placement
      console.error('[Aares] Email notification failed:', err);
    }
  }

  return { sendOrderAlert };

})();
