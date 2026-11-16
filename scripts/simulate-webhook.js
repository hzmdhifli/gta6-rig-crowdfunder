/**
 * Simulate an authentic Lemon Squeezy webhook payload with HMAC-SHA256 signature
 *
 * Usage:
 *   node scripts/simulate-webhook.js [donor_name] [amount_in_dollars] [secret]
 * Example:
 *   node scripts/simulate-webhook.js "Elena Rostova" 50 "my_secret"
 */
const crypto = require('crypto');
const http = require('http');

const donorName = process.argv[2] || 'Guido van Rossum';
const amountDollars = parseFloat(process.argv[3]) || 50;
const secret = process.argv[4] || process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';

const amountCents = Math.round(amountDollars * 100);
const orderId = String(Math.floor(Date.now() / 1000));
const orderNumber = Math.floor(1000 + Math.random() * 9000);

const payload = {
  meta: {
    event_name: 'order_created',
    custom_data: {
      donor_message: 'Keep powering open-source software! 🚀'
    }
  },
  data: {
    id: orderId,
    type: 'orders',
    attributes: {
      store_id: 112233,
      customer_id: 445566,
      identifier: '01HJQ5V7Z5KTR6BZZ',
      order_number: orderNumber,
      user_name: donorName,
      user_email: `${donorName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      currency: 'USD',
      currency_rate: '1.0000',
      subtotal: amountCents,
      discount_total: 0,
      tax: 0,
      total: amountCents,
      subtotal_usd: amountCents,
      tax_usd: 0,
      total_usd: amountCents,
      status: 'paid',
      status_formatted: 'Paid',
      refunded: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }
};

const payloadString = JSON.stringify(payload);

// Generate HMAC SHA-256 signature if secret is present
let signatureHeader = '';
if (secret) {
  const hmac = crypto.createHmac('sha256', secret);
  signatureHeader = hmac.update(payloadString).digest('hex');
  console.log(`Generated HMAC SHA-256 signature using secret: ${signatureHeader}`);
} else {
  console.log('No secret provided; sending empty signature (works if secret is unset in server .env)');
}

const req = http.request(
  {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/webhook/lemonsqueezy',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadString),
      'x-signature': signatureHeader,
      'x-event-name': 'order_created'
    }
  },
  (res) => {
    let responseBody = '';
    res.on('data', (chunk) => (responseBody += chunk));
    res.on('end', () => {
      console.log(`\nResponse Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`Response Body: ${responseBody}\n`);
    });
  }
);

req.on('error', (err) => {
  console.error('Request failed:', err.message);
  console.log('Make sure the server is running on http://localhost:3000 (npm start)');
});

req.write(payloadString);
req.end();
