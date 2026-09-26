/* =============================================
   Expense & Budget Visualizer — app.js
   Vanilla JS | LocalStorage | Chart.js
   Features: custom categories, monthly summary,
             sort, spending limit, dark/light mode
   ============================================= */
'use strict';

// ── Storage Keys ───────────────────────────────
const KEY_TX       = 'budget_transactions';
const KEY_CATS     = 'budget_custom_cats';
const KEY_LIMIT    = 'budget_limit';
const KEY_THEME    = 'budget_theme';
const KEY_SORT     = 'budget_sort';

// ── Built-in category colours ──────────────────
const BUILTIN_COLORS = {
  Food:      '#f97316',
  Transport: '#3b82f6',
  Fun:       '#a855f7',
};

// ── State ──────────────────────────────────────
let transactions  = load(KEY_TX,    []);
let customCats    = load(KEY_CATS,  []);   // [{ name, color }]
let spendingLimit = load(KEY_LIMIT, 0);
let sortOrder     = load(KEY_SORT,  'date-desc');
let viewYear      = new Date().getFullYear();
let viewMonth     = new Date().getMonth();  // 0-indexed

// ── DOM References ─────────────────────────────
const form             = document.getElementById('transactionForm');
const itemNameInput    = document.getElementById('itemName');
const amountInput      = document.getElementById('amount');
const categorySelect   = document.getElementById('category');
const totalBalanceEl   = document.getElementById('totalBalance');
const transactionList  = document.getElementById('transactionList');
const listEmptyEl      = document.getElementById('listEmpty');
const chartCanvas      = document.getElementById('spendingChart');
const chartEmptyEl     = document.getElementById('chartEmpty');
const limitInput       = document.getElementById('spendingLimit');
const limitWarning     = document.getElementById('limitWarning');
const themeToggle      = document.getElementById('themeToggle');
const themeIcon        = themeToggle.querySelector('.theme-icon');
const sortBySelect     = document.getElementById('sortBy');
const prevMonthBtn     = document.getElementById('prevMonth');
const nextMonthBtn     = document.getElementById('nextMonth');
const monthLabel       = document.getElementById('monthLabel');
const summaryGrid      = document.getElementById('summaryGrid');
const summaryEmptyEl   = document.getElementById('summaryEmpty');
const toggleCustomBtn  = document.getElementById('toggleCustomCat');
const customCatPanel   = document.getElementById('customCatPanel');
const newCatNameInput  = document.getElementById('newCatName');
const newCatColorInput = document.getElementById('newCatColor');
const addCustomCatBtn  = document.getElementById('addCustomCat');
const customCatError   = document.getElementById('customCatError');
const customCatList    = document.getElementById('customCatList');
const nameError        = document.getElementById('nameError');
const amountError      = document.getElementById('amountError');
const categoryError    = document.getElementById('categoryError');

// ── Chart ──────────────────────────────────────
let spendingChart = new Chart(chartCanvas, {
  type: 'pie',
  data: {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 8,
    }],
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 13, family: "'Segoe UI', system-ui, sans-serif" },
          padding: 14,
          usePointStyle: true,
          pointStyleWidth: 10,
          color: '#64748b',
        },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct   = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
            return ` $${ctx.parsed.toFixed(2)}  (${pct}%)`;
          },
        },
      },
    },
  },
});

// ── Utilities ──────────────────────────────────

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(value) {
  return '$' + Number(value).toFixed(2);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Return colour for any category name */
function categoryColor(name) {
  if (BUILTIN_COLORS[name]) return BUILTIN_COLORS[name];
  const custom = customCats.find(c => c.name === name);
  return custom ? custom.color : '#94a3b8';
}

/** All category names (built-in + custom) */
function allCategoryNames() {
  return ['Food', 'Transport', 'Fun', ...customCats.map(c => c.name)];
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Theme ──────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  // Update chart legend colour to match theme
  spendingChart.options.plugins.legend.labels.color =
    theme === 'dark' ? '#94a3b8' : '#64748b';
  spendingChart.update('none');
}

function initTheme() {
  const saved = load(KEY_THEME, 'light');
  applyTheme(saved);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  save(KEY_THEME, next);
  applyTheme(next);
});

// ── Spending Limit ─────────────────────────────

function initLimit() {
  if (spendingLimit > 0) limitInput.value = spendingLimit;
}

limitInput.addEventListener('change', () => {
  spendingLimit = Math.max(0, parseFloat(limitInput.value) || 0);
  save(KEY_LIMIT, spendingLimit);
  renderAll();
});

function checkLimit(total) {
  const active = spendingLimit > 0;
  const over   = active && total > spendingLimit;
  limitWarning.hidden = !over;
  // Highlight individual items that push past the limit cumulatively
  // (simpler UX: flag any single transaction whose amount > limit/3, or all when total exceeds limit)
}

// ── Sort ───────────────────────────────────────

function initSort() {
  sortBySelect.value = sortOrder;
}

sortBySelect.addEventListener('change', () => {
  sortOrder = sortBySelect.value;
  save(KEY_SORT, sortOrder);
  renderList();
});

function sortedTransactions() {
  const arr = [...transactions];
  switch (sortOrder) {
    case 'date-asc':      return arr.sort((a, b) => a.ts - b.ts);
    case 'date-desc':     return arr.sort((a, b) => b.ts - a.ts);
    case 'amount-asc':    return arr.sort((a, b) => a.amount - b.amount);
    case 'amount-desc':   return arr.sort((a, b) => b.amount - a.amount);
    case 'category-asc':  return arr.sort((a, b) => a.category.localeCompare(b.category));
    default:              return arr.sort((a, b) => b.ts - a.ts);
  }
}

// ── Validation ─────────────────────────────────

function setFieldError(input, errorEl, hasError) {
  input.classList.toggle('invalid', hasError);
  errorEl.classList.toggle('visible', hasError);
}

function validateForm() {
  const name     = itemNameInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const category = categorySelect.value;

  const nameInvalid     = name === '';
  const amountInvalid   = isNaN(amount) || amount <= 0;
  const categoryInvalid = category === '';

  setFieldError(itemNameInput,  nameError,     nameInvalid);
  setFieldError(amountInput,    amountError,   amountInvalid);
  setFieldError(categorySelect, categoryError, categoryInvalid);

  return !nameInvalid && !amountInvalid && !categoryInvalid;
}

// ── Render: Balance ────────────────────────────

function renderBalance() {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  totalBalanceEl.textContent = fmt(total);
  checkLimit(total);
}

// ── Render: Category <select> options ──────────

function renderCategoryOptions() {
  // Keep the placeholder and built-ins, remove old custom options
  const currentVal = categorySelect.value;
  // Remove any options after the 4th (index 3 = last built-in)
  while (categorySelect.options.length > 4) {
    categorySelect.remove(4);
  }
  customCats.forEach(c => {
    const opt  = document.createElement('option');
    opt.value  = c.name;
    opt.textContent = `🏷️ ${c.name}`;
    categorySelect.appendChild(opt);
  });
  // Restore selection if still valid
  if ([...categorySelect.options].some(o => o.value === currentVal)) {
    categorySelect.value = currentVal;
  }
}

// ── Render: Custom Category List ───────────────

function renderCustomCatList() {
  customCatList.innerHTML = '';
  if (customCats.length === 0) return;

  customCats.forEach((c, i) => {
    const li = document.createElement('li');
    li.className = 'custom-cat-item';
    li.innerHTML = `
      <span class="cat-swatch" style="background:${escapeHtml(c.color)}"></span>
      <span class="cat-label">${escapeHtml(c.name)}</span>
      <button class="btn-cat-delete" data-index="${i}" aria-label="Delete ${escapeHtml(c.name)}">✕</button>
    `;
    customCatList.appendChild(li);
  });
}

// ── Render: Transaction List ───────────────────

function renderList() {
  transactionList.innerHTML = '';
  const sorted = sortedTransactions();

  if (sorted.length === 0) {
    listEmptyEl.style.display = 'block';
    return;
  }
  listEmptyEl.style.display = 'none';

  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const isOverLimit = spendingLimit > 0 && total > spendingLimit;

  sorted.forEach(t => {
    const color   = categoryColor(t.category);
    const overCls = isOverLimit ? ' over-limit' : '';
    const li      = document.createElement('li');
    li.className  = `transaction-item${overCls}`;
    li.dataset.id = t.id;

    li.innerHTML = `
      <span class="category-dot" style="background:${escapeHtml(color)}" title="${escapeHtml(t.category)}"></span>
      <div class="item-info">
        <div class="item-name">${escapeHtml(t.name)}</div>
        <div class="item-category">${escapeHtml(t.category)}</div>
      </div>
      <span class="item-amount">${fmt(t.amount)}</span>
      <button class="btn-delete" aria-label="Delete ${escapeHtml(t.name)}">✕</button>
    `;
    transactionList.appendChild(li);
  });
}

// ── Render: Chart ──────────────────────────────

function renderChart() {
  const totals = {};
  allCategoryNames().forEach(n => { totals[n] = 0; });
  transactions.forEach(t => {
    if (totals[t.category] !== undefined) totals[t.category] += t.amount;
    else totals[t.category] = t.amount; // safety for orphaned categories
  });

  const labels = [], data = [], colors = [];
  Object.entries(totals).forEach(([cat, val]) => {
    if (val > 0) {
      labels.push(cat);
      data.push(parseFloat(val.toFixed(2)));
      colors.push(categoryColor(cat));
    }
  });

  const hasData = data.length > 0;
  chartCanvas.style.display  = hasData ? 'block' : 'none';
  chartEmptyEl.style.display = hasData ? 'none'  : 'block';

  spendingChart.data.labels                      = labels;
  spendingChart.data.datasets[0].data            = data;
  spendingChart.data.datasets[0].backgroundColor = colors;
  spendingChart.update();
}

// ── Render: Monthly Summary ────────────────────

function renderMonthlySummary() {
  monthLabel.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  const inView = transactions.filter(t => {
    const d = new Date(t.ts);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });

  summaryGrid.innerHTML = '';

  if (inView.length === 0) {
    summaryEmptyEl.style.display = 'block';
    return;
  }
  summaryEmptyEl.style.display = 'none';

  const monthTotal = inView.reduce((s, t) => s + t.amount, 0);

  // Total tile
  const totalTile = document.createElement('div');
  totalTile.className = 'summary-tile summary-total';
  totalTile.innerHTML = `
    <div>
      <div class="summary-tile-label">Month Total</div>
      <div class="summary-tile-count">${inView.length} transaction${inView.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="summary-tile-amount">${fmt(monthTotal)}</div>
  `;
  summaryGrid.appendChild(totalTile);

  // Per-category tiles
  const catMap = {};
  inView.forEach(t => {
    if (!catMap[t.category]) catMap[t.category] = { total: 0, count: 0 };
    catMap[t.category].total += t.amount;
    catMap[t.category].count += 1;
  });

  Object.entries(catMap)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([cat, { total, count }]) => {
      const tile = document.createElement('div');
      tile.className = 'summary-tile';
      tile.style.borderLeftColor = categoryColor(cat);
      tile.innerHTML = `
        <div class="summary-tile-label">${escapeHtml(cat)}</div>
        <div class="summary-tile-amount">${fmt(total)}</div>
        <div class="summary-tile-count">${count} item${count !== 1 ? 's' : ''}</div>
      `;
      summaryGrid.appendChild(tile);
    });
}

// ── renderAll ──────────────────────────────────

function renderAll() {
  renderBalance();
  renderList();
  renderChart();
  renderMonthlySummary();
}

// ── Event: Add Transaction ─────────────────────

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!validateForm()) return;

  transactions.push({
    id:       generateId(),
    name:     itemNameInput.value.trim(),
    amount:   parseFloat(parseFloat(amountInput.value).toFixed(2)),
    category: categorySelect.value,
    ts:       Date.now(),
  });
  save(KEY_TX, transactions);
  renderAll();

  form.reset();
  setFieldError(itemNameInput,  nameError,     false);
  setFieldError(amountInput,    amountError,   false);
  setFieldError(categorySelect, categoryError, false);
});

// ── Event: Delete Transaction ──────────────────

transactionList.addEventListener('click', e => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const id = btn.closest('.transaction-item')?.dataset.id;
  if (!id) return;
  transactions = transactions.filter(t => t.id !== id);
  save(KEY_TX, transactions);
  renderAll();
});

// ── Event: Clear field errors on input ─────────

itemNameInput.addEventListener('input',   () => setFieldError(itemNameInput,  nameError,     false));
amountInput.addEventListener('input',     () => setFieldError(amountInput,    amountError,   false));
categorySelect.addEventListener('change', () => setFieldError(categorySelect, categoryError, false));

// ── Event: Month navigation ────────────────────

prevMonthBtn.addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderMonthlySummary();
});

nextMonthBtn.addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderMonthlySummary();
});

// ── Event: Toggle custom category panel ────────

toggleCustomBtn.addEventListener('click', () => {
  const open = customCatPanel.hidden;
  customCatPanel.hidden = !open;
  toggleCustomBtn.setAttribute('aria-expanded', String(open));
  toggleCustomBtn.textContent = open
    ? '▲ Manage custom categories'
    : '＋ Manage custom categories';
});

// ── Event: Add custom category ─────────────────

addCustomCatBtn.addEventListener('click', () => {
  const name  = newCatNameInput.value.trim();
  const color = newCatColorInput.value;

  const taken = [...Object.keys(BUILTIN_COLORS), ...customCats.map(c => c.name)]
    .map(n => n.toLowerCase());

  if (!name || taken.includes(name.toLowerCase())) {
    customCatError.classList.add('visible');
    newCatNameInput.focus();
    return;
  }

  customCatError.classList.remove('visible');
  customCats.push({ name, color });
  save(KEY_CATS, customCats);

  newCatNameInput.value = '';
  newCatColorInput.value = '#10b981';

  renderCustomCatList();
  renderCategoryOptions();
  renderChart();
});

newCatNameInput.addEventListener('input', () => {
  customCatError.classList.remove('visible');
});

// ── Event: Delete custom category ──────────────

customCatList.addEventListener('click', e => {
  const btn = e.target.closest('.btn-cat-delete');
  if (!btn) return;
  const idx = parseInt(btn.dataset.index, 10);
  customCats.splice(idx, 1);
  save(KEY_CATS, customCats);
  renderCustomCatList();
  renderCategoryOptions();
  renderChart();
});

// ── Init ───────────────────────────────────────

initTheme();
initLimit();
initSort();
renderCategoryOptions();
renderCustomCatList();
renderAll();
