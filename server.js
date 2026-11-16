require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '';

// Track connected Server-Sent Events (SSE) clients
const sseClients = new Set();

// Enable CORS
app.use(cors());

// Capture raw body for Lemon Squeezy HMAC SHA-256 signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Sync with Netlify Blobs if running on Netlify serverless
app.use(async (req, res, next) => {
  if (process.env.NETLIFY) {
    await db.syncNetlify();
  }
  next();
});

/**
 * Broadcast event and payload to all connected SSE browser clients
 */
function broadcast(eventType, data) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(message);
  }
}

/**
 * Verify HMAC SHA-256 signature from Lemon Squeezy
 * Lemon Squeezy sends hex-encoded HMAC in 'x-signature' header.
 */
function verifySignature(req) {
  if (!WEBHOOK_SECRET) {
    console.warn(
      '[WARNING] LEMONSQUEEZY_WEBHOOK_SECRET is not configured in .env. Skipping signature verification in dev mode.'
    );
    return true;
  }

  const signature = req.headers['x-signature'];
  if (!signature) {
    console.error('[Auth Error] Missing x-signature header from webhook request.');
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const computedDigest = hmac.update(req.rawBody).digest('hex');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const digestBuffer = Buffer.from(computedDigest, 'utf8');

    if (signatureBuffer.length !== digestBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, digestBuffer);
  } catch (err) {
    console.error('[Auth Error] Signature verification exception:', err.message);
    return false;
  }
}

// ==========================================
// 1. LEMON SQUEEZY WEBHOOK ENDPOINT
// ==========================================
app.post('/api/webhook/lemonsqueezy', (req, res) => {
  // 1. Verify HMAC Signature
  if (!verifySignature(req)) {
    console.error('[Webhook] Unauthorized: Invalid HMAC SHA-256 signature.');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const payload = req.body;
  const eventName = req.headers['x-event-name'] || payload.meta?.event_name;

  console.log(`[Webhook Received] Event: "${eventName}" at ${new Date().toISOString()}`);

  // We are primarily interested in 'order_created' for donations
  if (eventName === 'order_created') {
    const data = payload.data;
    const attributes = data?.attributes;

    if (!attributes) {
      return res.status(400).json({ error: 'Malformed webhook payload attributes' });
    }

    // Lemon Squeezy amounts are in cents (e.g. 1500 = $15.00)
    const orderId = data.id;
    const orderNumber = attributes.order_number;
    const donorName = attributes.user_name || 'Generous Supporter';
    const donorEmail = attributes.user_email || '';
    const amountCents = attributes.total || 0;
    const currency = attributes.currency || 'USD';
    const status = attributes.status || 'paid';
    const createdAt = attributes.created_at || new Date().toISOString();

    // Custom fields passed via checkout (e.g., custom donor message)
    const customData = payload.meta?.custom_data || {};
    const message = customData.donor_message || customData.message || '';

    // Only record if order is paid
    if (status === 'paid') {
      const result = db.addOrder({
        orderId,
        orderNumber,
        donorName,
        donorEmail,
        amountCents,
        currency,
        message,
        createdAt,
        status
      });

      if (result.isNew) {
        console.log(
          `[New Donation] ${donorName} donated ${result.order.amountFormatted}! Total now: ${result.summary.totalRaisedFormatted}`
        );

        // Real-time Push: notify all connected frontends
        broadcast('new_donation', {
          order: result.order,
          summary: result.summary
        });
      } else {
        console.log(`[Webhook] Duplicate order #${orderNumber} ignored.`);
      }
    } else {
      console.log(`[Webhook] Order #${orderNumber} has status '${status}' - ignored.`);
    }

    return res.status(200).json({ received: true, event: eventName });
  }

  // Acknowledge other events (e.g. subscription_created, license_key_created)
  console.log(`[Webhook] Unhandled event type: ${eventName}`);
  return res.status(200).json({ received: true, ignored: true });
});

// ==========================================
// 2. REAL-TIME SERVER-SENT EVENTS (SSE)
// ==========================================
app.get('/api/donations/stream', (req, res) => {
  // Set headers for long-lived SSE connection
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial data immediately upon connection
  res.write(`event: init\ndata: ${JSON.stringify(db.getSummary())}\n\n`);

  sseClients.add(res);
  console.log(`[SSE] Client connected. Active clients: ${sseClients.size}`);

  // Heartbeat to keep connection alive across reverse proxies / cloud load balancers
  const heartbeatTimer = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected. Active clients: ${sseClients.size}`);
  });
});

// ==========================================
// 3. REST API ENDPOINTS
// ==========================================

// Get current donation summary and recent donations list
app.get('/api/donations', (req, res) => {
  res.json(db.getSummary());
});

// Development / Testing simulation endpoint
app.post('/api/simulate-donation', (req, res) => {
  const { donorName, amount, currency = 'USD', message } = req.body;
  const amountCents = Math.round((parseFloat(amount) || 10) * 100);

  const mockOrderId = 'sim_' + Date.now();
  const mockOrderNumber = Math.floor(1000 + Math.random() * 9000);

  const result = db.addOrder({
    orderId: mockOrderId,
    orderNumber: mockOrderNumber,
    donorName: donorName || 'Friendly Tester',
    donorEmail: 'test@example.com',
    amountCents,
    currency,
    message: message || 'Keep up the great work! 🎉',
    createdAt: new Date().toISOString(),
    status: 'paid'
  });

  broadcast('new_donation', {
    order: result.order,
    summary: result.summary
  });

  res.json({
    success: true,
    message: 'Simulated donation received and broadcasted',
    order: result.order,
    summary: result.summary
  });
});

// Reset demo database
app.post('/api/reset', (req, res) => {
  const summary = db.reset();
  broadcast('init', summary);
  res.json({ success: true, summary });
});

// Settings configuration (Checkout link & Goal)
app.get('/api/settings', (req, res) => {
  const summary = db.getSummary();
  res.json({
    checkoutUrl: summary.checkoutUrl,
    goalCents: summary.goalCents,
    goalFormatted: summary.goalFormatted
  });
});

app.post('/api/settings', (req, res) => {
  const { checkoutUrl, goalCents } = req.body;
  const summary = db.updateSettings({ checkoutUrl, goalCents });
  broadcast('init', summary);
  res.json({ success: true, summary });
});

// Export app for Netlify Functions / Serverless
module.exports = app;

// Start Server if run directly
if (require.main === module && !process.env.NETLIFY) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Lemon Squeezy Donation Webhook Server Running!   `);
    console.log(`====================================================`);
    console.log(`- Local URL:         http://localhost:${PORT}`);
    console.log(`- Webhook Endpoint:  http://localhost:${PORT}/api/webhook/lemonsqueezy`);
    console.log(`- SSE Live Stream:   http://localhost:${PORT}/api/donations/stream`);
    console.log(`- Webhook Secret:    ${WEBHOOK_SECRET ? 'Configured ✅' : 'NOT SET (Dev Mode) ⚠️'}`);
    console.log(`====================================================\n`);
  });
}
