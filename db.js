const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'donations.json');

// GTA 6 Setup Hardware Roadmap & Budget breakdown
const HARDWARE_COMPONENTS = [
  { id: 'case_psu', name: 'High-Airflow Case + 850W Gold Modular PSU', costCents: 25000, icon: '🔌' },
  { id: 'ram_ssd', name: '32GB DDR5 6000MHz RAM + 2TB Gen4 NVMe SSD', costCents: 25000, icon: '⚡' },
  { id: 'cpu_mobo', name: 'AMD Ryzen 7 7800X3D + B650 Gaming Motherboard', costCents: 55000, icon: '🧠' },
  { id: 'monitor', name: '27" 1440p 165Hz HDR Gaming Monitor', costCents: 45000, icon: '🖥️' },
  { id: 'gpu', name: 'NVIDIA GeForce RTX 4080 Super 16GB (GTA VI Ready)', costCents: 100000, icon: '🎮' }
];

let getStore;
try {
  getStore = require('@netlify/blobs').getStore;
} catch (e) {}

class DonationDB {
  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  async syncNetlify() {
    if (getStore && process.env.NETLIFY) {
      try {
        const store = getStore({ name: 'donations-store', consistency: 'strong' });
        const remote = await store.getJSON('donations_data');
        if (remote && remote.totalRaisedCents !== undefined) {
          this.data = remote;
        }
      } catch (err) {
        // silent fallback
      }
    }
  }

  ensureDataDir() {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {}
  }

  loadData() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[DB] Failed to read database file, initializing empty store:', err.message);
    }
const DEFAULT_CHECKOUT_URL = 'https://hazemdhifli.lemonsqueezy.com/checkout/buy/c9b6e790-4766-45c5-b677-7c625443bc8a';

    const initial = {
      orders: [],
      totalRaisedCents: 0,
      totalCount: 0,
      currency: 'USD',
      goalCents: parseInt(process.env.DONATION_GOAL_CENTS || '50000', 10),
      checkoutUrl: process.env.LEMONSQUEEZY_CHECKOUT_URL || DEFAULT_CHECKOUT_URL
    };
    this.saveData(initial);
    return initial;
  }

  saveData(data = this.data) {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      // In serverless / read-only environment, local write may fail
    }

    if (getStore && process.env.NETLIFY) {
      try {
        const store = getStore({ name: 'donations-store', consistency: 'strong' });
        store.setJSON('donations_data', data).catch(() => {});
      } catch (e) {}
    }
  }

  formatCurrency(cents, currency = 'USD') {
    const val = cents / 100;
    const hasCents = cents % 100 !== 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2
    }).format(val);
  }

  updateSettings({ checkoutUrl, goalCents }) {
    if (checkoutUrl !== undefined) this.data.checkoutUrl = checkoutUrl.trim();
    if (goalCents !== undefined) this.data.goalCents = Number(goalCents);
    this.saveData();
    return this.getSummary();
  }

  getSummary() {
    const goalCents = this.data.goalCents || parseInt(process.env.DONATION_GOAL_CENTS || '50000', 10);
    const checkoutUrl = this.data.checkoutUrl || process.env.LEMONSQUEEZY_CHECKOUT_URL || DEFAULT_CHECKOUT_URL;

    // Calculate status of each hardware milestone
    let accumulated = 0;
    const components = HARDWARE_COMPONENTS.map((item) => {
      const milestoneStart = accumulated;
      const milestoneEnd = accumulated + item.costCents;
      accumulated = milestoneEnd;

      let status = 'locked'; // 'locked' | 'in_progress' | 'funded'
      let fundedInMilestone = 0;

      if (this.data.totalRaisedCents >= milestoneEnd) {
        status = 'funded';
        fundedInMilestone = item.costCents;
      } else if (this.data.totalRaisedCents > milestoneStart) {
        status = 'in_progress';
        fundedInMilestone = this.data.totalRaisedCents - milestoneStart;
      }

      const percentage = Math.min(100, Math.round((fundedInMilestone / item.costCents) * 100));

      return {
        ...item,
        costFormatted: this.formatCurrency(item.costCents, this.data.currency),
        status,
        percentage,
        fundedFormatted: this.formatCurrency(fundedInMilestone, this.data.currency)
      };
    });

    const progressPercentage = Math.min(100, Math.round((this.data.totalRaisedCents / goalCents) * 100));

    return {
      campaignTitle: 'GTA VI Battle Station Setup',
      goalCents,
      goalFormatted: this.formatCurrency(goalCents, this.data.currency),
      totalRaisedCents: this.data.totalRaisedCents,
      totalRaisedFormatted: this.formatCurrency(this.data.totalRaisedCents, this.data.currency),
      progressPercentage,
      totalCount: this.data.totalCount,
      currency: this.data.currency || 'USD',
      checkoutUrl,
      hardwareRoadmap: components,
      recentDonations: this.data.orders.slice(0, 25)
    };
  }

  /**
   * Adds an order idempotently (avoids duplicate counting if webhook is redelivered)
   */
  addOrder({
    orderId,
    orderNumber,
    donorName,
    donorEmail,
    amountCents,
    currency = 'USD',
    message = '',
    createdAt = new Date().toISOString(),
    status = 'paid'
  }) {
    // Check for duplicate webhook events
    const existing = this.data.orders.find((o) => String(o.orderId) === String(orderId));
    if (existing) {
      console.log(`[DB] Order ${orderId} already processed (idempotency check passed).`);
      return {
        isNew: false,
        order: existing,
        summary: this.getSummary()
      };
    }

    const newOrder = {
      orderId: String(orderId),
      orderNumber,
      donorName: donorName || 'Anonymous Supporter',
      donorEmail: donorEmail || '',
      amountCents: Number(amountCents),
      amountFormatted: this.formatCurrency(amountCents, currency),
      currency,
      message,
      createdAt,
      status
    };

    this.data.orders.unshift(newOrder);
    this.data.totalRaisedCents += Number(amountCents);
    this.data.totalCount += 1;
    this.data.currency = currency;

    this.saveData();

    return {
      isNew: true,
      order: newOrder,
      summary: this.getSummary()
    };
  }

  reset() {
    this.data.orders = [];
    this.data.totalRaisedCents = 0;
    this.data.totalCount = 0;
    this.saveData();
    return this.getSummary();
  }
}

module.exports = new DonationDB();
