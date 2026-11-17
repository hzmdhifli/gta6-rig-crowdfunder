// Default Permanent Configuration
const DEFAULT_CHECKOUT_URL = 'https://hazemdhifli.lemonsqueezy.com/checkout/buy/c9b6e790-4766-45c5-b677-7c625443bc8a';
const DEFAULT_GOAL_CENTS = 450000; // $4,500.00 Target Goal

// Configuration & State
let currentCurrency = 'USD';
let currentGoalCents = DEFAULT_GOAL_CENTS;
let currentCheckoutUrl = DEFAULT_CHECKOUT_URL;

// Clear any stale local storage from older tests
localStorage.removeItem('ls_goal_cents');

// DOM Elements
const totalRaisedEl = document.getElementById('total-raised');
const goalProgressFillEl = document.getElementById('goal-progress-fill');
const goalTargetEl = document.getElementById('goal-target');
const streamStatusEl = document.getElementById('stream-status');
const toastContainerEl = document.getElementById('toast-container');
const mainDonateLink = document.getElementById('main-donate-link');

// Set Initial Goal Display immediately
if (goalTargetEl) {
  goalTargetEl.textContent = '$4,500';
}

/**
 * Format cents to localized currency string (clean whole dollars e.g. $0, $4,500)
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
  if (mainDonateLink) {
    mainDonateLink.href = DEFAULT_CHECKOUT_URL;
    mainDonateLink.target = '_blank';
    mainDonateLink.rel = 'noopener noreferrer';
  }
}

// Immediately set up links on load!
setupDonateLinks();

/**
 * Update Dashboard Display in Real-Time
 */
function updateDashboardMetrics(summary) {
  if (!summary) return;
  currentCurrency = summary.currency || currentCurrency || 'USD';
  currentGoalCents = summary.goalCents || DEFAULT_GOAL_CENTS;

  // Total Raised (with bump animation)
  if (totalRaisedEl && summary.totalRaisedCents !== undefined) {
    totalRaisedEl.textContent = formatCurrency(summary.totalRaisedCents, currentCurrency);
    totalRaisedEl.classList.add('bump');
    setTimeout(() => totalRaisedEl.classList.remove('bump'), 500);
  }

  // Goal Target
  if (goalTargetEl) {
    goalTargetEl.textContent = formatCurrency(currentGoalCents, currentCurrency);
  }

  // Progress Bar
  const raised = summary.totalRaisedCents || 0;
  const percent = Math.min(100, Math.round((raised / currentGoalCents) * 100));
  if (goalProgressFillEl) {
    goalProgressFillEl.style.width = `${percent}%`;
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
 * Set up Server-Sent Events (SSE) Live Connection with Smart Polling fallback
 */
function setupEventStream() {
  let pollInterval = null;
  let lastTotal = null;
  let evtSource = null;

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

  // Fetch initial summary immediately so there is ZERO waiting time on refresh!
  fetch('/api/donations')
    .then((r) => (r.ok ? r.json() : null))
    .then((summary) => {
      if (summary) {
        lastTotal = summary.totalRaisedCents;
        updateDashboardMetrics(summary);
      }
    })
    .catch(() => {});

  // Try real-time Server-Sent Events
  try {
    evtSource = new EventSource('/api/donations/stream');

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
      startPolling();
    };

    // Initial state received via SSE
    evtSource.addEventListener('init', (e) => {
      try {
        const summary = JSON.parse(e.data);
        updateDashboardMetrics(summary);

        if (donationsListEl) {
          donationsListEl.innerHTML = '';
          if (summary.recentDonations && summary.recentDonations.length > 0) {
            if (emptyStateEl) emptyStateEl.style.display = 'none';
            summary.recentDonations.forEach((order) => {
              donationsListEl.appendChild(createDonationElement(order));
            });
          } else if (emptyStateEl) {
            donationsListEl.appendChild(emptyStateEl);
            emptyStateEl.style.display = 'block';
          }
        }
      } catch (err) {}
    });

    // Real-time new donation pushed by Lemon Squeezy webhook!
    evtSource.addEventListener('new_donation', (e) => {
      try {
        const { order, summary } = JSON.parse(e.data);
        updateDashboardMetrics(summary);

        if (emptyStateEl && emptyStateEl.parentElement === donationsListEl) {
          emptyStateEl.remove();
        }

        if (donationsListEl) {
          const newEl = createDonationElement(order);
          donationsListEl.insertBefore(newEl, donationsListEl.firstChild);
        }

        triggerConfetti();
        showDonationToast(order);
      } catch (err) {}
    });
  } catch (err) {
    startPolling();
  }
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
