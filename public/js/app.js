/**
 * Invoice Generator — Single Page App
 * Hash-based router, API helper, and all page renderers
 */

// ════════════════════════════════════════════════════════════
// AUTH GUARD
// ════════════════════════════════════════════════════════════
const token = localStorage.getItem('invoice_token');
if (!token) {
  window.location.href = '/login.html';
}

const currentUser = JSON.parse(localStorage.getItem('invoice_user') || '{}');

// ════════════════════════════════════════════════════════════
// API HELPER
// ════════════════════════════════════════════════════════════
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    window.location.href = '/login.html';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════
let toastTimer;
function showToast(message, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ════════════════════════════════════════════════════════════
// CONFIRM DIALOG
// ════════════════════════════════════════════════════════════
function showConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    modal.style.display = 'flex';

    const yes = document.getElementById('confirmYes');
    const no  = document.getElementById('confirmNo');

    function close(result) {
      modal.style.display = 'none';
      yes.replaceWith(yes.cloneNode(true));
      no.replaceWith(no.cloneNode(true));
      resolve(result);
    }

    document.getElementById('confirmYes').addEventListener('click', () => close(true));
    document.getElementById('confirmNo').addEventListener('click', () => close(false));
    modal.addEventListener('click', (e) => { if (e.target === modal) close(false); });
  });
}

// ════════════════════════════════════════════════════════════
// CURRENCY & NUMBER HELPERS
// ════════════════════════════════════════════════════════════
let globalSettings = {};

async function loadSettings() {
  try {
    globalSettings = await api('/settings');
  } catch { globalSettings = {}; }
}

function cur() { return globalSettings.currency || '₹'; }

function fmt(n) {
  return `${cur()}${parseFloat(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })}`;
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function todayISO() { return new Date().toISOString().split('T')[0]; }

function dueDateISO(daysFromNow = 30) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

// ════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════
const routes = {
  'dashboard':     renderDashboard,
  'invoices':      renderInvoiceList,
  'invoices/new':  () => renderInvoiceForm(null),
  'clients':       renderClients,
  'settings':      renderSettings
};

function getRoute() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  return hash;
}

function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  // Match by data-route prefix
  const base = route.split('/')[0];
  const navEl = document.querySelector(`.nav-item[data-route="${base}"]`) ||
                document.querySelector(`.nav-item[data-route="${route}"]`);
  if (navEl) navEl.classList.add('active');
}

async function navigate(hash) {
  window.location.hash = hash;
}

async function handleRoute() {
  const hash = getRoute();
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>`;

  setActiveNav(hash);

  // Dynamic route: invoices/:id/edit
  if (/^invoices\/\d+\/edit$/.test(hash)) {
    const id = hash.split('/')[1];
    await renderInvoiceForm(id);
    return;
  }

  // Dynamic route: invoices/:id
  if (/^invoices\/\d+$/.test(hash)) {
    const id = hash.split('/')[1];
    await renderInvoiceDetail(id);
    return;
  }

  const fn = routes[hash];
  if (fn) {
    await fn();
  } else {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h2 class="empty-title">Page not found</h2><button class="btn btn-primary" onclick="navigate('dashboard')">Go to Dashboard</button></div>`;
  }
}

window.addEventListener('hashchange', handleRoute);

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
(async function init() {
  await loadSettings();

  // Set user display
  if (currentUser.username) {
    const u = currentUser.username;
    document.getElementById('userName').textContent = u;
    document.getElementById('userAvatar').textContent = u.charAt(0).toUpperCase();
  }

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/login.html';
  });

  // Mobile sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  function openSidebar() {
    sidebar.classList.add('open');
    if (overlay) { overlay.classList.add('active'); }
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    if (overlay) { overlay.classList.remove('active'); }
    document.body.style.overflow = '';
  }

  document.getElementById('hamburger').addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  if (overlay) { overlay.addEventListener('click', closeSidebar); }

  // Close sidebar when nav item tapped on mobile
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // PDF modal close
  document.getElementById('pdfCloseBtn').addEventListener('click', () => {
    document.getElementById('pdfModal').style.display = 'none';
    document.getElementById('pdfFrame').src = '';
  });

  document.getElementById('pdfModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('pdfModal')) {
      document.getElementById('pdfModal').style.display = 'none';
    }
  });

  await handleRoute();
})();

// ════════════════════════════════════════════════════════════
// ── DASHBOARD ────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
async function renderDashboard() {
  try {
    const stats = await api('/invoices/stats');
    const content = document.getElementById('pageContent');

    const recentRows = stats.recent.map(inv => `
      <tr>
        <td data-label="Invoice #" class="td-bold">${inv.invoice_number}</td>
        <td data-label="Client">${inv.client_name}</td>
        <td data-label="Date">${fmtDate(inv.date)}</td>
        <td data-label="Amount" class="td-right td-bold">${fmt(inv.grand_total)}</td>
        <td data-label="Status"><span class="badge badge-${inv.status}">${inv.status}</span></td>
        <td data-label="Actions" class="td-center">
          <div class="dropdown">
            <button class="btn btn-outline btn-sm dropdown-btn">Actions ▼</button>
            <div class="dropdown-menu">
              <button onclick="navigate('invoices/${inv.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </button>
              <button onclick="openPDF(${inv.id}, '${inv.invoice_number}')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </button>
            </div>
          </div>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><p class="empty-subtitle">No invoices yet</p></div></td></tr>`;

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back, ${currentUser.username}! Here's your overview.</p>
        </div>
        <button class="btn btn-primary btn-lg" onclick="navigate('invoices/new')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Invoice
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card total">
          <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg></div>
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total Invoices</div>
        </div>
        <div class="stat-card paid">
          <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div class="stat-value">${stats.paid.count}</div>
          <div class="stat-label">Paid Invoices</div>
          <div class="stat-amount">${fmt(stats.paid.amount)}</div>
        </div>
        <div class="stat-card unpaid">
          <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div class="stat-value">${stats.unpaid.count}</div>
          <div class="stat-label">Unpaid Invoices</div>
          <div class="stat-amount">${fmt(stats.unpaid.amount)}</div>
        </div>
        <div class="stat-card draft">
          <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <div class="stat-value">${stats.draft}</div>
          <div class="stat-label">Draft Invoices</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Recent Invoices</span>
          <button class="btn btn-ghost btn-sm" onclick="navigate('invoices')">View All</button>
        </div>
        <div class="table-container responsive-table">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th><th>Client</th><th>Date</th>
                <th class="td-right">Amount</th><th>Status</th><th class="td-center">Actions</th>
              </tr>
            </thead>
            <tbody>${recentRows}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
// ── INVOICE LIST ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
let invoiceFilters = { search: '', status: 'all', from_date: '', to_date: '', page: 1 };

async function renderInvoiceList() {
  const content = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Invoices</h1>
        <p class="page-subtitle">Manage and track all your invoices</p>
      </div>
      <button class="btn btn-primary btn-lg" onclick="navigate('invoices/new')">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Invoice
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="filters-bar" style="margin:0;flex:1;">
          <div class="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="invSearch" placeholder="Search invoices..." value="${invoiceFilters.search}"/>
          </div>
          <select class="filter-select" id="invStatus">
            <option value="all" ${invoiceFilters.status==='all'?'selected':''}>All Status</option>
            <option value="paid" ${invoiceFilters.status==='paid'?'selected':''}>Paid</option>
            <option value="unpaid" ${invoiceFilters.status==='unpaid'?'selected':''}>Unpaid</option>
            <option value="draft" ${invoiceFilters.status==='draft'?'selected':''}>Draft</option>
            <option value="cancelled" ${invoiceFilters.status==='cancelled'?'selected':''}>Cancelled</option>
          </select>
          <input type="date" class="filter-select" id="invFrom" value="${invoiceFilters.from_date}" title="From date"/>
          <input type="date" class="filter-select" id="invTo"   value="${invoiceFilters.to_date}"   title="To date"/>
          <button class="btn btn-ghost btn-sm" id="invReset">Reset</button>
        </div>
      </div>

      <div id="invTableArea">
        <div class="loading-screen"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  await fetchAndRenderInvoices();

  // Filter listeners
  let debounce;
  document.getElementById('invSearch').addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      invoiceFilters.search = e.target.value;
      invoiceFilters.page = 1;
      fetchAndRenderInvoices();
    }, 350);
  });

  ['invStatus', 'invFrom', 'invTo'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      const key = { invStatus: 'status', invFrom: 'from_date', invTo: 'to_date' }[id];
      invoiceFilters[key] = e.target.value;
      invoiceFilters.page = 1;
      fetchAndRenderInvoices();
    });
  });

  document.getElementById('invReset').addEventListener('click', () => {
    invoiceFilters = { search: '', status: 'all', from_date: '', to_date: '', page: 1 };
    document.getElementById('invSearch').value = '';
    document.getElementById('invStatus').value = 'all';
    document.getElementById('invFrom').value = '';
    document.getElementById('invTo').value = '';
    fetchAndRenderInvoices();
  });
}

async function fetchAndRenderInvoices() {
  const area = document.getElementById('invTableArea');
  if (!area) return;

  const params = new URLSearchParams({
    page: invoiceFilters.page,
    limit: 15,
    ...(invoiceFilters.search   && { search:    invoiceFilters.search }),
    ...(invoiceFilters.status !== 'all' && { status: invoiceFilters.status }),
    ...(invoiceFilters.from_date && { from_date: invoiceFilters.from_date }),
    ...(invoiceFilters.to_date   && { to_date:   invoiceFilters.to_date })
  });

  try {
    const data = await api(`/invoices?${params}`);
    const rows = data.invoices.map(inv => `
      <tr>
        <td data-label="Invoice #" class="td-bold" style="color:var(--primary)">${inv.invoice_number}</td>
        <td data-label="Client">
          <div style="text-align: right;">
            <div style="font-weight:600;">${inv.client_name}</div>
            <div class="td-muted" style="font-size:12px;">${inv.client_email || ''}</div>
          </div>
        </td>
        <td data-label="Date">${fmtDate(inv.date)}</td>
        <td data-label="Due Date">${fmtDate(inv.due_date)}</td>
        <td data-label="Amount" class="td-right td-bold">${fmt(inv.grand_total)}</td>
        <td data-label="Status"><span class="badge badge-${inv.status}">${inv.status}</span></td>
        <td data-label="Actions">
          <div class="dropdown">
            <button class="btn btn-outline btn-sm dropdown-btn">Actions ▼</button>
            <div class="dropdown-menu">
              <button onclick="navigate('invoices/${inv.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </button>
              <button onclick="navigate('invoices/${inv.id}/edit')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <button onclick="openPDF(${inv.id}, '${inv.invoice_number}')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </button>
              <button onclick="duplicateInvoice(${inv.id})">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Duplicate
              </button>
              <button class="text-danger" onclick="deleteInvoice(${inv.id}, '${inv.invoice_number}')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete
              </button>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    const emptyState = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
          <div class="empty-title">No invoices found</div>
          <div class="empty-subtitle">Try adjusting your filters or create a new invoice.</div>
          <button class="btn btn-primary" onclick="navigate('invoices/new')">Create Invoice</button>
        </div>
      </td></tr>`;

    // Pagination
    const pages = Array.from({ length: data.pages }, (_, i) => i + 1).map(p => `
      <button class="page-btn ${p === data.page ? 'active' : ''}"
              onclick="invoiceFilters.page=${p};fetchAndRenderInvoices();">${p}</button>
    `).join('');

    area.innerHTML = `
      <div class="table-container responsive-table">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th><th>Client</th><th>Date</th><th>Due Date</th>
              <th class="td-right">Amount</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || emptyState}</tbody>
        </table>
      </div>
      ${data.pages > 1 ? `<div class="pagination">${pages}</div>` : ''}
      <div style="padding:12px 20px;border-top:1px solid var(--border);font-size:12px;color:var(--text-muted);">
        Showing ${data.invoices.length} of ${data.total} invoices
      </div>
    `;
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><p class="empty-subtitle" style="color:var(--danger)">Error: ${err.message}</p></div>`;
  }
}

// ════════════════════════════════════════════════════════════
// ── INVOICE DETAIL ────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
async function renderInvoiceDetail(id) {
  try {
    const inv = await api(`/invoices/${id}`);
    const content = document.getElementById('pageContent');

    const hasGST = inv.items.some(i => parseFloat(i.tax_pct) > 0);

    const itemRows = inv.items.map((item, i) => {
      const showTax = parseFloat(item.tax_pct) > 0;
      return `
      <tr>
        <td class="td-center" style="color:var(--text-muted);font-size:12px;">${i+1}</td>
        <td class="td-bold">${item.name}</td>
        <td class="td-center">${item.quantity}</td>
        <td class="td-right">${fmt(item.unit_price)}</td>
        ${hasGST ? `<td class="td-center">${showTax ? item.tax_pct+'%' : '<span style="color:var(--text-muted)">—</span>'}</td>` : ''}
        <td class="td-right td-bold" style="color:var(--primary);">${fmt(item.total)}</td>
      </tr>
      `;
    }).join('');

    content.innerHTML = `
      <div class="page-header">
        <div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('invoices')" style="margin-bottom:8px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg> Back</button>
          <h1 class="page-title">Invoice ${inv.invoice_number}</h1>
          <p class="page-subtitle">${inv.client_name} · ${fmtDate(inv.date)}</p>
        </div>
        <div class="action-btns">
          <select class="filter-select" id="statusSelect" style="font-weight:600;">
            ${['paid','unpaid','draft','cancelled'].map(s =>
              `<option value="${s}" ${inv.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
            ).join('')}
          </select>
          <button class="btn btn-outline" onclick="navigate('invoices/${id}/edit')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
          <button class="btn btn-outline" onclick="downloadPDFDirect(${id})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>
          <button class="btn btn-primary" onclick="openPDF(${id}, '${inv.invoice_number}')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Preview</button>
          <button class="btn btn-ghost" onclick="duplicateInvoice(${id})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Duplicate</button>
        </div>
      </div>

      <div class="inv-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
        <div class="card">
          <div class="card-header"><span class="card-title">Billed To</span></div>
          <div class="card-body">
            <p style="font-size:17px;font-weight:700;margin-bottom:6px;">${inv.client_name}</p>
            <p style="color:var(--text-muted);white-space:pre-line;">${inv.client_address || ''}</p>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Invoice Info</span></div>
          <div class="card-body">
            <table style="width:100%;font-size:13px;">
              <tr><td style="color:var(--text-muted);padding:4px 0;">Invoice No.</td><td style="font-weight:600;text-align:right;">${inv.invoice_number}</td></tr>
              <tr><td style="color:var(--text-muted);padding:4px 0;">Date</td><td style="font-weight:600;text-align:right;">${fmtDate(inv.date)}</td></tr>
              <tr><td style="color:var(--text-muted);padding:4px 0;">Due Date</td><td style="font-weight:600;text-align:right;">${fmtDate(inv.due_date)}</td></tr>
              <tr><td style="color:var(--text-muted);padding:4px 0;">Status</td><td style="text-align:right;"><span class="badge badge-${inv.status}">${inv.status}</span></td></tr>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header"><span class="card-title">Invoice Items</span></div>
        <div class="table-container">
          <table>
            <thead><tr>
              <th class="td-center" style="width:50px;">Sr. No.</th><th>Service / Product</th>
              <th class="td-center" style="width:80px;">Qty</th><th class="td-right" style="width:120px;">Unit Price</th>
              ${hasGST ? `<th class="td-center" style="width:90px;">${globalSettings.tax_label||'GST'}%</th>` : ''}
              <th class="td-right" style="width:120px;">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;padding:20px;">
          <div class="totals-panel">
            <div class="totals-row"><span class="t-label">Subtotal</span><span class="t-value">${fmt(inv.subtotal)}</span></div>
            ${parseFloat(inv.tax_total)>0 ? `<div class="totals-row"><span class="t-label">${globalSettings.tax_label||'GST'} Total</span><span class="t-value">${fmt(inv.tax_total)}</span></div>` : ''}
            ${parseFloat(inv.discount_amount)>0 ? `<div class="totals-row"><span class="t-label">Discount</span><span class="t-value" style="color:var(--danger)">- ${fmt(inv.discount_amount)}</span></div>` : ''}
            <div class="totals-row grand-total-row"><span class="t-label">Grand Total</span><span class="t-value">${fmt(inv.grand_total)}</span></div>
          </div>
        </div>
      </div>
    `;

    // Status change
    document.getElementById('statusSelect').addEventListener('change', async (e) => {
      try {
        await api(`/invoices/${id}/status`, { method: 'PATCH', body: { status: e.target.value } });
        showToast('Status updated', 'success');
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
      }
    });

  } catch (err) {
    showToast('Failed to load invoice', 'error');
  }
}

// ════════════════════════════════════════════════════════════
// ── INVOICE FORM (Create / Edit) ──────────────────────────────
// ════════════════════════════════════════════════════════════
let invoiceItems = [];

async function renderInvoiceForm(editId) {
  const isEdit = !!editId;
  const content = document.getElementById('pageContent');

  // Load existing invoice if editing
  let inv = null;
  let nextNumber = '';

  try {
    if (isEdit) {
      inv = await api(`/invoices/${editId}`);
    } else {
      const res = await api('/invoices/next-number');
      nextNumber = res.invoice_number;
    }
  } catch (err) {
    showToast('Failed to load data', 'error');
    return;
  }

  // Load clients for dropdown
  let clients = [];
  try { clients = await api('/clients'); } catch {}

  invoiceItems = inv ? [...inv.items] : [newItem()];

  const clientOpts = clients.map(c =>
    `<option value="${c.id}" data-address="${escAttr(c.address||'')} ${escAttr(c.city||'')} ${escAttr(c.state||'')}" data-name="${escAttr(c.name)}">${c.name}</option>`
  ).join('');

  content.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-ghost btn-sm" onclick="history.back()" style="margin-bottom:8px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg> Back</button>
        <h1 class="page-title">${isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
        <p class="page-subtitle">${isEdit ? 'Update the invoice details below' : 'Fill in the details below to create a new invoice'}</p>
      </div>
      <div class="action-btns">
        <button class="btn btn-ghost" onclick="saveInvoice('${isEdit ? editId : ''}', 'draft')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save as Draft
        </button>
        <button class="btn btn-primary btn-lg" onclick="saveInvoice('${isEdit ? editId : ''}', '${isEdit ? (inv?.status||'unpaid') : 'unpaid'}')">
          ${isEdit ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg> Update Invoice' : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg> Create Invoice'}
        </button>
      </div>
    </div>

    <!-- ── SECTION 1: Invoice Details ─────────────────────── -->
    <div class="inv-form-section">
      <div class="inv-form-section-header">
        <div class="inv-form-section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <span>Invoice Details</span>
      </div>
      <div class="inv-form-section-body">
        <div class="form-grid form-grid-4">
          <div class="form-group">
            <label>Invoice Number</label>
            <input type="text" class="form-control" id="fInvNumber" value="${inv ? inv.invoice_number : nextNumber}" placeholder="INV-1001"/>
          </div>
          <div class="form-group">
            <label>Invoice Date</label>
            <input type="date" class="form-control" id="fDate" value="${inv ? inv.date : todayISO()}"/>
          </div>
          <div class="form-group">
            <label>Due Date</label>
            <input type="date" class="form-control" id="fDueDate" value="${inv ? inv.due_date : dueDateISO(30)}"/>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select class="form-control" id="fStatus">
              ${['unpaid','paid','draft','cancelled'].map(s =>
                `<option value="${s}" ${(inv?inv.status:'unpaid')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 2: Client Details ──────────────────────── -->
    <div class="inv-form-section">
      <div class="inv-form-section-header">
        <div class="inv-form-section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <span>Client Details</span>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="openClientModal(null, true)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add New Client
        </button>
      </div>
      <div class="inv-form-section-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Select Existing Client</label>
            <select class="form-control" id="fClientSelect" onchange="onClientSelect(this)">
              <option value="">— Select a client —</option>
              ${clientOpts}
            </select>
          </div>
          <div class="form-group">
            <label>Client Name *</label>
            <input type="text" class="form-control" id="fClientName" value="${inv ? escVal(inv.client_name) : ''}" placeholder="Client / Company name" required/>
          </div>
          <div class="form-group full-width">
            <label>Client Address</label>
            <textarea class="form-control" id="fClientAddress" rows="3" placeholder="Full address...">${inv ? escVal(inv.client_address) : ''}</textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- ── SECTION 3: Invoice Items ────────────────────────── -->
    <div class="inv-form-section">
      <div class="inv-form-section-header">
        <div class="inv-form-section-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </div>
        <span>Invoice Items</span>
        <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="addItem()">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Item
        </button>
      </div>
      <div class="items-table-wrapper responsive-table">
        <table class="invoice-items-table">
          <thead>
            <tr>
              <th style="width:52px;text-align:center;">Sr. No.</th>
              <th style="min-width:200px;">Service / Product</th>
              <th style="width:90px;text-align:center;">Qty</th>
              <th style="width:130px;text-align:right;">Unit Price</th>
              <th style="width:100px;text-align:center;">${globalSettings.tax_label||'GST'}%</th>
              <th style="width:130px;text-align:right;">Total</th>
              <th style="width:44px;"></th>
            </tr>
          </thead>
          <tbody id="itemsBody"></tbody>
        </table>
      </div>
    </div>

    <!-- ── SECTION 4: Discount & Totals ───────────────────── -->
    <div class="inv-totals-layout">
      <div class="inv-form-section" style="flex:1;min-width:0;">
        <div class="inv-form-section-header">
          <div class="inv-form-section-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span>Discount</span>
        </div>
        <div class="inv-form-section-body">
          <div class="discount-inline">
            <label class="discount-inline-label">Discount Type</label>
            <select id="discType" class="form-control" style="max-width:160px;" onchange="recalc()">
              <option value="percentage" ${(!inv||inv.discount_type==='percentage')?'selected':''}>Percentage (%)</option>
              <option value="fixed" ${(inv&&inv.discount_type==='fixed')?'selected':''}>Fixed Amount</option>
            </select>
            <label class="discount-inline-label" style="margin-left:16px;">Value</label>
            <input type="number" id="discValue" class="form-control" value="${inv ? inv.discount_value : 0}" min="0" step="0.01" oninput="recalc()" style="max-width:120px;"/>
          </div>
        </div>
      </div>

      <div class="totals-panel" style="min-width:300px;">
        <div class="totals-row">
          <span class="t-label">Subtotal</span>
          <span class="t-value" id="tSubtotal">${fmt(0)}</span>
        </div>
        <div class="totals-row" id="tGstRow" style="display:none;">
          <span class="t-label" id="tGstLabel">${globalSettings.tax_label||'GST'} Total</span>
          <span class="t-value" id="tTax">${fmt(0)}</span>
        </div>
        <div class="totals-row" id="tDiscountRow" style="display:none;">
          <span class="t-label">Discount</span>
          <span class="t-value" id="tDiscount" style="color:var(--danger);">- ${fmt(0)}</span>
        </div>
        <div class="totals-row grand-total-row">
          <span class="t-label">Grand Total</span>
          <span class="t-value" id="tGrand">${fmt(0)}</span>
        </div>
      </div>
    </div>

    <!-- ── Bottom Actions ─────────────────────────────────── -->
    <div class="inv-form-actions">
      <button class="btn btn-ghost" onclick="history.back()">Cancel</button>
      <button class="btn btn-ghost btn-lg" onclick="saveInvoice('${isEdit ? editId : ''}', 'draft')">
        Save as Draft
      </button>
      <button class="btn btn-outline btn-lg" onclick="saveInvoice('${isEdit ? editId : ''}', '${isEdit ? (inv?.status||'unpaid') : 'unpaid'}')">
        ${isEdit ? 'Update Only' : 'Create Only'}
      </button>
      <button class="btn btn-primary btn-lg" onclick="saveInvoice('${isEdit ? editId : ''}', '${isEdit ? (inv?.status||'unpaid') : 'unpaid'}', true)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        ${isEdit ? 'Update & Download PDF' : 'Save & Download PDF'}
      </button>
    </div>
  `;

  renderItemsTable();
  recalc();

  // Pre-select client if editing
  if (inv && inv.client_id) {
    document.getElementById('fClientSelect').value = inv.client_id;
  }
}

function newItem() {
  return { name: '', quantity: 1, unit_price: 0, tax_pct: 0 };
}

function addItem() {
  invoiceItems.push(newItem());
  renderItemsTable();
  recalc();
}

function removeItem(idx) {
  invoiceItems.splice(idx, 1);
  renderItemsTable();
  recalc();
}

function renderItemsTable() {
  const tbody = document.getElementById('itemsBody');
  if (!tbody) return;

  tbody.innerHTML = invoiceItems.map((item, idx) => {
    const lineBase = (parseFloat(item.quantity)||0) * (parseFloat(item.unit_price)||0);
    const taxAmt   = lineBase * ((parseFloat(item.tax_pct)||0) / 100);
    const total    = lineBase + taxAmt;

    return `
      <tr data-idx="${idx}">
        <td data-label="Sr. No." style="text-align:center;color:var(--text-muted);font-size:12px;font-weight:600;">${idx+1}</td>
        <td data-label="Service / Product"><input type="text" placeholder="Service / Product name" value="${escVal(item.name)}"
              oninput="invoiceItems[${idx}].name=this.value"/></td>
        <td data-label="Qty" style="text-align:center;">
          <input type="number" min="0.01" step="0.01" value="${item.quantity}"
              style="text-align:center;"
              oninput="invoiceItems[${idx}].quantity=parseFloat(this.value)||0;updateRowTotal(${idx});recalc();"/>
        </td>
        <td data-label="Unit Price">
          <input type="number" min="0" step="0.01" value="${item.unit_price}"
              style="text-align:right;"
              oninput="invoiceItems[${idx}].unit_price=parseFloat(this.value)||0;updateRowTotal(${idx});recalc();"/>
        </td>
        <td data-label="${globalSettings.tax_label||'GST'}%" style="text-align:center;">
          <input type="number" min="0" max="100" step="0.01" value="${item.tax_pct||0}"
              style="text-align:center;"
              oninput="invoiceItems[${idx}].tax_pct=parseFloat(this.value)||0;updateRowTotal(${idx});recalc();"/>
        </td>
        <td data-label="Total" class="item-total-cell" id="row-total-${idx}">${fmt(total)}</td>
        <td data-label="Remove" style="text-align:center;">
          <button class="btn-remove-item" onclick="removeItem(${idx})" title="Remove item">×</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Update only the total cell of a single row (fast, no full re-render)
function updateRowTotal(idx) {
  const item = invoiceItems[idx];
  if (!item) return;
  const base  = (parseFloat(item.quantity)||0) * (parseFloat(item.unit_price)||0);
  const tax   = base * ((parseFloat(item.tax_pct)||0) / 100);
  const total = base + tax;
  const cell  = document.getElementById(`row-total-${idx}`);
  if (cell) cell.textContent = fmt(total);
}

function recalc() {
  let subtotal = 0, taxTotal = 0;

  for (const item of invoiceItems) {
    const base = (parseFloat(item.quantity)||0) * (parseFloat(item.unit_price)||0);
    const tax  = base * ((parseFloat(item.tax_pct)||0) / 100);
    subtotal += base;
    taxTotal += tax;
  }

  const discTypeEl  = document.getElementById('discType');
  const discValueEl = document.getElementById('discValue');
  const discType    = discTypeEl ? discTypeEl.value : 'percentage';
  const discVal     = parseFloat(discValueEl ? discValueEl.value : 0) || 0;

  let discAmount = discType === 'percentage' ? subtotal * (discVal / 100) : discVal;
  const grand = subtotal + taxTotal - discAmount;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const show = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; };

  set('tSubtotal', fmt(subtotal));
  set('tTax',      fmt(taxTotal));
  set('tDiscount', `- ${fmt(discAmount)}`);
  set('tGrand',    fmt(grand));

  // Conditional GST row — only show if there is any tax
  show('tGstRow',      taxTotal > 0);
  // Conditional Discount row — only show if there is a discount
  show('tDiscountRow', discAmount > 0);
}

function onClientSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt.value) return;
  document.getElementById('fClientName').value = opt.dataset.name || '';
  document.getElementById('fClientAddress').value = (opt.dataset.address || '').trim();
}

async function saveInvoice(editId, statusOverride, autoDownload = false) {
  const getValue = (id) => document.getElementById(id)?.value || '';

  const payload = {
    invoice_number: getValue('fInvNumber').trim(),
    date:           getValue('fDate'),
    due_date:       getValue('fDueDate'),
    client_id:      getValue('fClientSelect') || null,
    client_name:    getValue('fClientName').trim(),
    client_address: getValue('fClientAddress').trim(),
    status:         statusOverride || getValue('fStatus'),
    discount_type:  getValue('discType'),
    discount_value: parseFloat(getValue('discValue')) || 0,
    notes:          '',
    items:          invoiceItems
  };

  if (!payload.client_name) { showToast('Client name is required', 'error'); return; }
  if (!payload.date)        { showToast('Invoice date is required', 'error'); return; }
  if (!payload.due_date)    { showToast('Due date is required', 'error'); return; }
  if (invoiceItems.length === 0) { showToast('Add at least one item', 'error'); return; }

  // Validate items
  const hasEmptyName = invoiceItems.some(i => !i.name?.trim());
  if (hasEmptyName) { showToast('All items must have a service / product name', 'error'); return; }

  try {
    let saved;
    if (editId) {
      saved = await api(`/invoices/${editId}`, { method: 'PUT', body: payload });
      showToast('Invoice updated successfully!', 'success');
    } else {
      saved = await api('/invoices', { method: 'POST', body: payload });
      showToast('Invoice created successfully!', 'success');
    }
    if (autoDownload) {
      downloadPDFDirect(saved.id);
    }
    navigate(`invoices/${saved.id}`);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
// ── PDF / PRINT ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function openPDF(id, number) {
  const modal = document.getElementById('pdfModal');
  const frame = document.getElementById('pdfFrame');
  document.getElementById('pdfModalTitle').textContent = `Invoice ${number}`;

  // Preview loads the rendered HTML (no auth needed — same origin)
  frame.src = `/api/invoices/${id}/preview?t=${Date.now()}`;
  modal.style.display = 'flex';

  // "Download PDF" opens the print view in a new tab — user saves as PDF via Ctrl+P
  document.getElementById('pdfDownloadBtn').onclick = () => {
    window.open(`/api/invoices/${id}/print`, '_blank');
  };

  // "Print" button triggers print inside the iframe
  document.getElementById('pdfPrintBtn').onclick = () => {
    try {
      frame.contentWindow.print();
    } catch {
      window.open(`/api/invoices/${id}/print`, '_blank');
    }
  };
}

// ════════════════════════════════════════════════════════════
// ── CLIENT MANAGEMENT ────────────────────────────────────────
// ════════════════════════════════════════════════════════════
async function renderClients() {
  let clients = [];
  try { clients = await api('/clients'); } catch {}

  const content = document.getElementById('pageContent');

  const cards = clients.map(c => `
    <div class="card" style="padding:20px;transition:transform 0.2s,box-shadow 0.2s;" onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='var(--shadow-lg)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:44px;height:44px;background:linear-gradient(135deg,var(--primary),var(--primary-light));border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:700;">${c.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-weight:700;font-size:15px;">${c.name}</div>
            <div style="font-size:12px;color:var(--text-muted);">${c.email||'—'}</div>
          </div>
        </div>
        <div class="action-btns">
          <button class="btn btn-icon btn-outline" title="Edit" onclick="openClientModal(${JSON.stringify(c).replace(/"/g,'&quot;')})">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-icon" style="background:#fee2e2;color:#ef4444;" title="Delete" onclick="deleteClient(${c.id}, '${escAttr(c.name)}')">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.7;">
        ${c.address ? `<div style="display:flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${c.address}${c.city ? ', ' + c.city : ''}</div>` : ''}
        ${c.phone   ? `<div style="display:flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="flex-shrink:0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.29 6.29l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${c.phone}</div>` : ''}
        ${c.gstin   ? `<div style="display:flex;align-items:center;gap:5px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="flex-shrink:0"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> GSTIN: ${c.gstin}</div>` : ''}
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Clients</h1>
        <p class="page-subtitle">${clients.length} client${clients.length !== 1 ? 's' : ''} saved</p>
      </div>
      <button class="btn btn-primary btn-lg" onclick="openClientModal(null)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Client</button>
    </div>

    ${clients.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <div class="empty-title">No clients yet</div>
        <div class="empty-subtitle">Add your first client to quickly fill invoice details.</div>
        <button class="btn btn-primary" onclick="openClientModal(null)">Add Client</button>
      </div>` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">${cards}</div>`}

    <!-- Client Modal -->
    <div id="clientModal" class="modal-overlay" style="display:none;">
      <div class="modal-box modal-client">
        <div class="modal-header">
          <h3 id="clientModalTitle">Add Client</h3>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('clientModal').style.display='none'">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="cId"/>
          <div class="form-grid">
            <div class="form-group full-width"><label>Name *</label><input type="text" class="form-control" id="cName" placeholder="Client or company name"/></div>
            <div class="form-group full-width"><label>Address</label><textarea class="form-control" id="cAddress" rows="2" placeholder="Street address"></textarea></div>
            <div class="form-group"><label>City</label><input type="text" class="form-control" id="cCity" placeholder="City"/></div>
            <div class="form-group"><label>State</label><input type="text" class="form-control" id="cState" placeholder="State"/></div>
            <div class="form-group"><label>Pincode</label><input type="text" class="form-control" id="cPincode" placeholder="Pincode"/></div>
            <div class="form-group"><label>Phone</label><input type="tel" class="form-control" id="cPhone" placeholder="Phone number"/></div>
            <div class="form-group"><label>Email</label><input type="email" class="form-control" id="cEmail" placeholder="email@example.com"/></div>
            <div class="form-group"><label>GSTIN</label><input type="text" class="form-control" id="cGstin" placeholder="GST number"/></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="document.getElementById('clientModal').style.display='none'">Cancel</button>
          <button class="btn btn-primary" onclick="saveClient()">Save Client</button>
        </div>
      </div>
    </div>
  `;
}

function openClientModal(clientData, refreshAfter = false) {
  const modal = document.getElementById('clientModal') || document.querySelector('#clientModal');
  if (!modal) { navigate('clients'); return; }

  document.getElementById('cId').value         = clientData?.id || '';
  document.getElementById('cName').value       = clientData?.name || '';
  document.getElementById('cAddress').value    = clientData?.address || '';
  document.getElementById('cCity').value       = clientData?.city || '';
  document.getElementById('cState').value      = clientData?.state || '';
  document.getElementById('cPincode').value    = clientData?.pincode || '';
  document.getElementById('cPhone').value      = clientData?.phone || '';
  document.getElementById('cEmail').value      = clientData?.email || '';
  document.getElementById('cGstin').value      = clientData?.gstin || '';
  document.getElementById('clientModalTitle').textContent = clientData ? 'Edit Client' : 'Add Client';
  modal.style.display = 'flex';
  window._clientRefreshAfter = refreshAfter;
}

async function saveClient() {
  const id   = document.getElementById('cId').value;
  const name = document.getElementById('cName').value.trim();
  if (!name) { showToast('Client name is required', 'error'); return; }

  const payload = {
    name,
    address:  document.getElementById('cAddress').value.trim(),
    city:     document.getElementById('cCity').value.trim(),
    state:    document.getElementById('cState').value.trim(),
    pincode:  document.getElementById('cPincode').value.trim(),
    phone:    document.getElementById('cPhone').value.trim(),
    email:    document.getElementById('cEmail').value.trim(),
    gstin:    document.getElementById('cGstin').value.trim()
  };

  try {
    if (id) {
      await api(`/clients/${id}`, { method: 'PUT', body: payload });
      showToast('Client updated!', 'success');
    } else {
      await api('/clients', { method: 'POST', body: payload });
      showToast('Client added!', 'success');
    }
    document.getElementById('clientModal').style.display = 'none';
    if (window._clientRefreshAfter) {
      // Reload client select in invoice form
      const sel = document.getElementById('fClientSelect');
      if (sel) {
        const clients = await api('/clients');
        sel.innerHTML = '<option value="">— Select a client —</option>' +
          clients.map(c => `<option value="${c.id}" data-address="${escAttr((c.address||'')+' '+(c.city||'')+' '+(c.state||''))}" data-name="${escAttr(c.name)}">${c.name}</option>`).join('');
      }
    } else {
      navigate('clients');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function deleteClient(id, name) {
  const confirmed = await showConfirm('Delete Client', `Delete "${name}"? This will not delete their invoices.`);
  if (!confirmed) return;
  try {
    await api(`/clients/${id}`, { method: 'DELETE' });
    showToast('Client deleted', 'success');
    renderClients();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
// ── SETTINGS ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
async function renderSettings() {
  const s = await api('/settings');
  const content = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Settings</h1><p class="page-subtitle">Configure company details and invoice preferences</p></div>
      <button class="btn btn-primary btn-lg" onclick="saveSettings()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Settings</button>
    </div>

    <div class="settings-grid">
      <!-- Company Info -->
      <div class="card">
        <div class="card-header"><span class="card-title" style="display:flex;align-items:center;gap:8px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Company Information</span></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:16px;">
          <div class="form-group">
            <label>Company / Owner Name</label>
            <input class="form-control" id="s_company_name" value="${escVal(s.company_name||'')}"/>
          </div>
          <div class="form-group">
            <label>Tagline / Sub-title</label>
            <input class="form-control" id="s_company_tagline" value="${escVal(s.company_tagline||'')}"/>
          </div>
          <div class="form-group">
            <label>Address</label>
            <input class="form-control" id="s_company_address" value="${escVal(s.company_address||'')}"/>
          </div>
          <div class="form-group">
            <label>City & State</label>
            <input class="form-control" id="s_company_city" value="${escVal(s.company_city||'')}"/>
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input class="form-control" id="s_company_phone" value="${escVal(s.company_phone||'')}"/>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input class="form-control" id="s_company_email" value="${escVal(s.company_email||'')}"/>
          </div>
          <div class="form-group">
            <label>Website</label>
            <input class="form-control" id="s_company_website" value="${escVal(s.company_website||'')}"/>
          </div>
          <div class="form-group">
            <label>GSTIN</label>
            <input class="form-control" id="s_company_gstin" value="${escVal(s.company_gstin||'')}"/>
          </div>
        </div>
      </div>

      <!-- Bank & Invoice -->
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div class="card">
          <div class="card-header"><span class="card-title" style="display:flex;align-items:center;gap:8px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="10" width="18" height="11" rx="1"/><path d="M12 2L2 7h20L12 2z"/><line x1="7" y1="10" x2="7" y2="21"/><line x1="12" y1="10" x2="12" y2="21"/><line x1="17" y1="10" x2="17" y2="21"/></svg> Bank Details</span></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:16px;">
            <div class="form-group"><label>Bank Name</label><input class="form-control" id="s_bank_name" value="${escVal(s.bank_name||'')}"/></div>
            <div class="form-group"><label>Account Number</label><input class="form-control" id="s_bank_account" value="${escVal(s.bank_account||'')}"/></div>
            <div class="form-group"><label>IFSC Code</label><input class="form-control" id="s_bank_ifsc" value="${escVal(s.bank_ifsc||'')}"/></div>
            <div class="form-group"><label>Branch</label><input class="form-control" id="s_bank_branch" value="${escVal(s.bank_branch||'')}"/></div>
            <div class="form-group"><label>UPI ID</label><input class="form-control" id="s_bank_upi" value="${escVal(s.bank_upi||'')}"/></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title" style="display:flex;align-items:center;gap:8px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M12 2a10 10 0 0 1 0 20A10 10 0 0 1 2 12 10 10 0 0 1 12 2"/></svg> Invoice Preferences</span></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:16px;">
            <div class="form-group">
              <label>Currency Symbol</label>
              <select class="form-control" id="s_currency">
                ${[['₹','INR'],['$','USD'],['€','EUR'],['£','GBP']].map(([sym,code])=>
                  `<option value="${sym}" ${s.currency===sym?'selected':''}>${sym} — ${code}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group"><label>Tax Label (GST / VAT / Tax)</label><input class="form-control" id="s_tax_label" value="${escVal(s.tax_label||'GST')}"/></div>
            <div class="form-group"><label>Invoice Prefix (e.g. INV)</label><input class="form-control" id="s_invoice_prefix" value="${escVal(s.invoice_prefix||'INV')}"/></div>
            <div class="form-group"><label>Invoice Start Number</label><input class="form-control" type="number" id="s_invoice_start" value="${escVal(s.invoice_start||'1001')}"/></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title" style="display:flex;align-items:center;gap:8px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Company Logo</span></div>
          <div class="card-body">
            <div class="logo-preview" id="logoPreview">
              ${s.logo_data ? `<img src="${s.logo_data}" alt="Logo"/>` : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" stroke-width="1.5" width="36" height="36"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'}
            </div>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">PNG or SVG, max 2MB. Appears in PDF header.</p>
            <input type="file" id="logoFile" accept="image/*" style="display:none;" onchange="uploadLogo(this)"/>
            <button class="btn btn-outline" onclick="document.getElementById('logoFile').click()">Upload Logo</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title" style="display:flex;align-items:center;gap:8px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Change Password</span></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:14px;">
            <div class="form-group"><label>Current Password</label><input type="password" class="form-control" id="pwCurrent" placeholder="Current password"/></div>
            <div class="form-group"><label>New Password</label><input type="password" class="form-control" id="pwNew" placeholder="New password (min 6 chars)"/></div>
            <button class="btn btn-outline" onclick="changePassword()">Change Password</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function saveSettings() {
  const ids = ['company_name','company_tagline','company_address','company_city',
    'company_phone','company_email','company_website','company_gstin',
    'bank_name','bank_account','bank_ifsc','bank_branch','bank_upi',
    'currency','tax_label','invoice_prefix','invoice_start'];

  const payload = {};
  for (const key of ids) {
    const el = document.getElementById(`s_${key}`);
    if (el) payload[key] = el.value;
  }
  // currency_code mapping
  const cur = payload.currency;
  payload.currency_code = {
    '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP'
  }[cur] || 'INR';

  try {
    await api('/settings', { method: 'PUT', body: payload });
    await loadSettings();
    showToast('Settings saved!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function uploadLogo(input) {
  if (!input.files.length) return;
  const form = new FormData();
  form.append('logo', input.files[0]);
  try {
    const res = await fetch('/api/settings/logo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('logoPreview').innerHTML = `<img src="${data.logo_data}" alt="Logo"/>`;
    globalSettings.logo_data = data.logo_data;
    showToast('Logo uploaded!', 'success');
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  }
}

async function changePassword() {
  const current = document.getElementById('pwCurrent').value;
  const newPw   = document.getElementById('pwNew').value;
  try {
    await api('/auth/change-password', { method: 'POST', body: { current_password: current, new_password: newPw } });
    showToast('Password changed!', 'success');
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
// ── SHARED ACTIONS ────────────────────────────────════════════
// ════════════════════════════════════════════════════════════
async function deleteInvoice(id, number) {
  const confirmed = await showConfirm('Delete Invoice', `Delete invoice "${number}"? This cannot be undone.`);
  if (!confirmed) return;
  try {
    await api(`/invoices/${id}`, { method: 'DELETE' });
    showToast('Invoice deleted', 'success');
    fetchAndRenderInvoices();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function duplicateInvoice(id) {
  try {
    const dup = await api(`/invoices/${id}/duplicate`, { method: 'POST' });
    showToast(`Duplicated as ${dup.invoice_number}`, 'success');
    navigate(`invoices/${dup.id}/edit`);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
// ── UTILITY ───────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function escVal(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '').replace(/'/g, '');
}

// Fix iframe preview auth: embed token in URL for preview route
// The preview route needs token support — add query token check
(function patchPreviewAuth() {
  window.downloadPDFDirect = function(id) {
    const printUrl = `/api/invoices/${id}/print`;
    const a = document.createElement('a');
    a.href = printUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Print dialog will open. Use "Save as PDF" to download.', 'info');
  };

  // Override openPDF to include token in preview iframe URL
  window.openPDF = function(id, number) {
    const modal = document.getElementById('pdfModal');
    const frame = document.getElementById('pdfFrame');
    document.getElementById('pdfModalTitle').textContent = `Invoice ${number}`;
    frame.src = `/api/invoices/${id}/preview?_t=${Date.now()}`;
    modal.style.display = 'flex';

    // "Download PDF" — Opens the print view in a new tab so the user can Save as PDF.
    document.getElementById('pdfDownloadBtn').onclick = () => downloadPDFDirect(id);

    // "Print" button — tries iframe print first, falls back to new tab
    document.getElementById('pdfPrintBtn').onclick = () => {
      try {
        const fw = frame.contentWindow;
        if (fw) { fw.focus(); fw.print(); }
        else throw new Error('no frame');
      } catch {
        window.open(`/api/invoices/${id}/print`, '_blank');
      }
    };
  };
})();

