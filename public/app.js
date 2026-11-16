// Configuration & State
let currentGoalCents = 250000; // Default $2,500.00 (updated from backend summary)
let currentCurrency = 'USD';
let currentCheckoutUrl = '';

// DOM Elements
const totalRaisedEl = document.getElementById('total-raised');
const goalProgressFillEl = document.getElementById('goal-progress-fill');
const goalPercentageEl = document.getElementById('goal-percentage');
const goalTargetEl = document.getElementById('goal-target');
const remainingTextEl = document.getElementById('remaining-text');
const budgetBadgeEl = document.getElementById('budget-badge');
const totalCountEl = document.getElementById('total-count');
const avgDonationEl = document.getElementById('avg-donation');
const latestAmountEl = document.getElementById('latest-amount');
const donationsListEl = document.getElementById('donations-list');
const emptyStateEl = document.getElementById('empty-state');
const hardwareRoadmapEl = document.getElementById('hardware-roadmap');
const streamStatusEl = document.getElementById('stream-status');
const toastContainerEl = document.getElementById('toast-container');
const simulateForm = document.getElementById('simulate-form');
const btnReset = document.getElementById('btn-reset');
const webhookUrlDisplay = document.getElementById('webhook-url-display');
const btnCopyUrl = document.getElementById('btn-copy-url');
const customCheckoutInput = document.getElementById('custom-checkout-input');
const btnSaveCheckout = document.getElementById('btn-save-checkout');
const customGoalInput = document.getElementById('custom-goal-input');
const btnSaveGoal = document.getElementById('btn-save-goal');
const mainDonateLink = document.getElementById('main-donate-link');
const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const sideDrawer = document.getElementById('side-drawer');

// Drawer Open / Close
function openDrawer() {
  if (sideDrawer) sideDrawer.classList.add('active');
  if (drawerOverlay) drawerOverlay.classList.add('active');
}
function closeDrawer() {
  if (sideDrawer) sideDrawer.classList.remove('active');
  if (drawerOverlay) drawerOverlay.classList.remove('active');
}
if (btnToggleDrawer) btnToggleDrawer.addEventListener('click', openDrawer);
if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

// Display current origin in webhook URL box
if (webhookUrlDisplay) {
  webhookUrlDisplay.textContent = `${window.location.origin}/api/webhook/lemonsqueezy`;
}

if (btnCopyUrl) {
  btnCopyUrl.addEventListener('click', () => {
    navigator.clipboard.writeText(webhookUrlDisplay.textContent).then(() => {
      btnCopyUrl.textContent = 'Copied!';
      setTimeout(() => {
        btnCopyUrl.textContent = 'Copy';
      }, 2000);
    });
  });
}

/**
 * Format cents to localized currency string (clean whole dollars e.g. $125, $500)
 */
function formatCurrency(cents, currency = currentCurrency) {
  const val = cents / 100;
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2
  }).format(val);
}

/**
 * Configure Donate Button behavior
 */
function setupDonateLinks() {
  const handleDonateClick = (e) => {
    if (!currentCheckoutUrl) {
      e.preventDefault();
      openDrawer();
      showToast('Connect Lemon Squeezy', 'Paste your checkout URL in the settings panel to activate donations.', '💡');
      if (customCheckoutInput) customCheckoutInput.focus();
      return;
    }

    // If Lemon.js is available and URL is a valid Lemon Squeezy checkout link, use overlay
    if (window.LemonSqueezy && typeof window.LemonSqueezy.Url?.Open === 'function' && currentCheckoutUrl.includes('lemonsqueezy.com')) {
      e.preventDefault();
      window.LemonSqueezy.Url.Open(currentCheckoutUrl);
    }
  };

  if (mainDonateLink) {
    mainDonateLink.href = currentCheckoutUrl || '#';
    mainDonateLink.onclick = handleDonateClick;
  }
}

/**
 * Update Dashboard Display
 */
function updateDashboardMetrics(summary) {
  currentCurrency = summary.currency || 'USD';
  currentGoalCents = summary.goalCents || 50000;
  currentCheckoutUrl = summary.checkoutUrl || '';

  // Total Raised (with bump animation)
  if (totalRaisedEl) {
    totalRaisedEl.textContent = formatCurrency(summary.totalRaisedCents, currentCurrency);
    totalRaisedEl.classList.add('bump');
    setTimeout(() => totalRaisedEl.classList.remove('bump'), 500);
  }

  // Goal Target
  if (goalTargetEl) {
    goalTargetEl.textContent = formatCurrency(currentGoalCents, currentCurrency);
  }

  // Progress Bar
  const percent = Math.min(100, Math.round((summary.totalRaisedCents / currentGoalCents) * 100));
  if (goalProgressFillEl) {
    goalProgressFillEl.style.width = `${percent}%`;
  }

  // Drawer Settings inputs
  if (customCheckoutInput && !customCheckoutInput.matches(':focus')) {
    customCheckoutInput.value = currentCheckoutUrl;
  }
  if (customGoalInput && !customGoalInput.matches(':focus')) {
    customGoalInput.value = Math.round(currentGoalCents / 100);
  }

  setupDonateLinks();
}


/**
 * Format Relative Time (e.g. "Just now", "2 mins ago")
 */
function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

/**
 * Create a donor card element
 */
function createDonationElement(order) {
  const item = document.createElement('div');
  item.className = 'donation-item';

  // Get donor initials
  const initials = (order.donorName || 'A')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  item.innerHTML = `
    <div class="donor-avatar">${initials}</div>
    <div class="donor-content">
      <div class="donor-meta">
        <span class="donor-name">${escapeHtml(order.donorName)}</span>
        <span class="donor-amount">+${escapeHtml(order.amountFormatted)}</span>
      </div>
      ${order.message ? `<div class="donor-message">“${escapeHtml(order.message)}”</div>` : ''}
      <div class="donor-time">${timeAgo(order.createdAt)}</div>
    </div>
  `;
  return item;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Show a generic toast notification
 */
function showToast(title, message, icon = '🎉') {
  if (!toastContainerEl) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${message}</div>
    </div>
  `;
  toastContainerEl.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

/**
 * Show a toast notification when a new donation arrives
 */
function showDonationToast(order) {
  showToast(
    'New Donation Received! 🌴',
    `<strong>${escapeHtml(order.donorName)}</strong> donated <strong>${escapeHtml(order.amountFormatted)}</strong>${
      order.message ? `<div style="margin-top:4px;font-style:italic">“${escapeHtml(order.message)}”</div>` : ''
    }`
  );
}

/**
 * Fire colorful confetti with Vice City neon colors
 */
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#facc15', '#ec4899', '#06b6d4', '#10b981', '#a855f7']
    });
  }
}

/**
 * Set up Server-Sent Events (SSE) Live Connection
 */
function setupEventStream() {
  let pollInterval = null;
  let lastTotal = null;

  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/donations');
        if (res.ok) {
          const summary = await res.json();
          if (lastTotal !== null && summary.totalRaisedCents > lastTotal) {
            triggerConfetti();
            const latest = summary.recentDonations && summary.recentDonations[0];
            if (latest) showDonationToast(latest);
          }
          lastTotal = summary.totalRaisedCents;
          updateDashboardMetrics(summary);
          if (streamStatusEl) {
            streamStatusEl.classList.remove('error');
            streamStatusEl.querySelector('.status-text').textContent = 'Live';
          }
        }
      } catch (e) {}
    }, 4000);
  }

  evtSource.onopen = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (streamStatusEl) {
      streamStatusEl.classList.remove('error');
      streamStatusEl.querySelector('.status-text').textContent = 'Live';
    }
  };

  evtSource.onerror = () => {
    // On Netlify serverless, SSE times out, so switch to smart polling
    startPolling();
  };

  // Initial state received
  evtSource.addEventListener('init', (e) => {
    const summary = JSON.parse(e.data);
    updateDashboardMetrics(summary);

    donationsListEl.innerHTML = '';
    if (summary.recentDonations && summary.recentDonations.length > 0) {
      emptyStateEl.style.display = 'none';
      summary.recentDonations.forEach((order) => {
        donationsListEl.appendChild(createDonationElement(order));
      });
    } else {
      donationsListEl.appendChild(emptyStateEl);
      emptyStateEl.style.display = 'block';
    }
  });

  // Real-time new donation pushed by Lemon Squeezy webhook!
  evtSource.addEventListener('new_donation', (e) => {
    const { order, summary } = JSON.parse(e.data);

    // Update numbers
    updateDashboardMetrics(summary);

    // Remove empty state if present
    if (emptyStateEl && emptyStateEl.parentElement === donationsListEl) {
      emptyStateEl.remove();
    }

    // Insert new item at the very top of the feed
    const newEl = createDonationElement(order);
    donationsListEl.insertBefore(newEl, donationsListEl.firstChild);

    // Visual celebration & Toast alert
    triggerConfetti();
    showDonationToast(order);
  });
}

/**
 * Global Quick Donate function for one-click test presets
 */
window.quickDonate = async function (donorName, amount, message) {
  try {
    const res = await fetch('/api/simulate-donation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donorName, amount, currency: currentCurrency, message })
    });
    if (!res.ok) throw new Error('Simulation failed');
  } catch (err) {
    showToast('Simulation Error', err.message, '❌');
  }
};

// Handle Simulator Form Submission
if (simulateForm) {
  simulateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-simulate');
    if (btn) btn.disabled = true;

    const payload = {
      donorName: document.getElementById('sim-name').value,
      amount: document.getElementById('sim-amount').value,
      currency: document.getElementById('sim-currency').value,
      message: document.getElementById('sim-message').value
    };

    try {
      const res = await fetch('/api/simulate-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Simulation failed');
    } catch (err) {
      alert('Error sending simulation: ' + err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// Handle Save Checkout URL Button
if (btnSaveCheckout && customCheckoutInput) {
  btnSaveCheckout.addEventListener('click', async () => {
    const url = customCheckoutInput.value.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      alert('Please enter a valid URL starting with https://');
      return;
    }

    btnSaveCheckout.disabled = true;
    btnSaveCheckout.textContent = 'Saving...';

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkoutUrl: url })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      showToast('Checkout Link Saved! 🔗', 'Donation buttons now link to your Lemon Squeezy checkout page.', '✅');
    } catch (err) {
      alert('Failed to save checkout URL: ' + err.message);
    } finally {
      btnSaveCheckout.disabled = false;
      btnSaveCheckout.textContent = 'Save';
    }
  });
}

// Handle Save Goal Button
if (btnSaveGoal && customGoalInput) {
  btnSaveGoal.addEventListener('click', async () => {
    const goalDollars = parseFloat(customGoalInput.value) || 500;
    const goalCents = Math.round(goalDollars * 100);

    btnSaveGoal.disabled = true;
    btnSaveGoal.textContent = 'Updating...';

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalCents })
      });
      if (!res.ok) throw new Error('Goal update failed');
      showToast('Goal Updated! 🎯', 'Target goal set to ' + formatCurrency(goalCents), '✅');
    } catch (err) {
      alert('Failed to update goal: ' + err.message);
    } finally {
      btnSaveGoal.disabled = false;
      btnSaveGoal.textContent = 'Update';
    }
  });
}

// Handle Reset Button
if (btnReset) {
  btnReset.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset all donation data? (Your checkout URL will be kept)')) return;
    try {
      await fetch('/api/reset', { method: 'POST' });
      showToast('Data Reset', 'All demo donations have been cleared.', '🔄');
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  });
}

// ========================================================
// GTA VI LAUNCH COUNTDOWN LOGIC
// ========================================================
let countdownTargetDate = new Date('2026-11-19T00:00:00');

const cdDaysEl = document.getElementById('cd-days');
const cdHoursEl = document.getElementById('cd-hours');
const cdMinsEl = document.getElementById('cd-mins');
const cdSecsEl = document.getElementById('cd-secs');
const customDateInput = document.getElementById('custom-date-input');
const btnSaveDate = document.getElementById('btn-save-date');

function updateCountdown() {
  const now = new Date();
  const diff = countdownTargetDate - now;

  if (diff <= 0) {
    if (cdDaysEl) cdDaysEl.textContent = '00';
    if (cdHoursEl) cdHoursEl.textContent = '00';
    if (cdMinsEl) cdMinsEl.textContent = '00';
    if (cdSecsEl) cdSecsEl.textContent = '00';
    const tag = document.querySelector('.countdown-badge-title');
    if (tag) tag.textContent = 'OUT NOW! 🎮';
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  if (cdDaysEl) cdDaysEl.textContent = String(days).padStart(2, '0');
  if (cdHoursEl) cdHoursEl.textContent = String(hours).padStart(2, '0');
  if (cdMinsEl) cdMinsEl.textContent = String(mins).padStart(2, '0');
  if (cdSecsEl) cdSecsEl.textContent = String(secs).padStart(2, '0');
}

// Tick every second
setInterval(updateCountdown, 1000);
updateCountdown();

// Countdown Date Setting
if (btnSaveDate && customDateInput) {
  btnSaveDate.addEventListener('click', () => {
    const val = customDateInput.value;
    if (!val) return;
    countdownTargetDate = new Date(val + 'T00:00:00');
    localStorage.setItem('gta6_countdown_date', val);
    updateCountdown();
    showToast('Countdown Updated! ⏳', 'Target set to ' + countdownTargetDate.toLocaleDateString(), '✅');
  });

  const savedDate = localStorage.getItem('gta6_countdown_date');
  if (savedDate) {
    customDateInput.value = savedDate;
    countdownTargetDate = new Date(savedDate + 'T00:00:00');
    updateCountdown();
  }
}

// Initialize on page load
setupEventStream();
