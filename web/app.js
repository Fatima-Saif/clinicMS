/**
 * ClinicMS — app.js
 * Vanilla JS SPA: New Patient · Search · Dashboard · Camera · Theme
 */
'use strict';

/* ════════════════════════════════════════════════════════════════════════════
   CLINIC CONFIGURATION  ← Change this to your clinic name
════════════════════════════════════════════════════════════════════════════ */
const CLINIC_NAME = 'ATTA HOMEOPATHIC MARKAZ';
const CLINIC_AREA = 'Multan';
const CLINIC_WHATSAPP = '0300-1234567';

const API = (window.location && window.location.origin && window.location.origin !== 'null') 
  ? `${window.location.origin}/api` 
  : 'http://localhost:8080/api';

/* ─── State ────────────────────────────────────────────────────────────────── */
const state = {
  currentPage: 'new-patient',
  currentPatientId: null,
  searchDebounceTimer: null,
  cameraStream: null,
  cameraTarget: null,   // 'patient' | 'defect' | 'av-defect'
  newPatientDraft: null,
  formMode: 'NEW_PATIENT', // 'NEW_PATIENT', 'EDIT_PATIENT', 'ADD_VISIT', 'REPEAT_PATIENT', 'EDIT_VISIT'
  editingVisitId: null,
};

window.toggleEditPatientForm = function() {
  if (!state.currentPatientId || !window._currentPatientData) return;
  
  resetPatientForm();
  state.formMode = 'EDIT_PATIENT';
  const p = window._currentPatientData;
  state.editingPatientId = p.id;
  
  moveFormToPanel();
  
  const titleEl = document.getElementById('form-main-title');
  if (titleEl) titleEl.textContent = 'Edit Patient Details';
  const subtitleEl = document.getElementById('form-main-subtitle');
  if (subtitleEl) subtitleEl.textContent = `Update demographics for ${p.first_name || p.name}`;
  
  const btn = document.getElementById('btn-submit-patient');
  if (btn) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M12 5v14M5 12h14"/></svg> <span>Update Patient</span>`;
  
  populateFormFromData(p);
  
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  // Ensure clinical fields are empty for patient edit
  setVal('f-symptoms', '');
  setVal('f-pulse-rate', '');
  setVal('f-blood-pressure', '');
  setVal('f-temperature', '');
  setVal('f-oxygen-level', '');
  setVal('f-medicines-text', '');
  setVal('f-consultation-fee', '');
  setVal('f-medicine-price', '');
  setVal('f-total-amount', '0');
  setVal('f-discount', '');
  setVal('f-final-amount', '0');
  setVal('f-amount-received', '');
  setVal('f-remaining-balance', '0');
  
  // Unfreeze demographics to allow editing!
  unfreezeDemographics();
  
  document.getElementById('section-patient-details').style.display = 'none';
  document.getElementById('section-visit-history').style.display = 'none';
}

/* ════════════════════════════════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════════════════════════════════ */

function getVal(id) { const el = document.getElementById(id); return el ? (el.value || '') : ''; }
function getHtml(id) { const el = document.getElementById(id); return el ? (el.innerHTML || '') : ''; }

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  return apiFetch(`${API}${path}`, { method: 'POST', body: JSON.stringify(body) });
}

async function apiGet(path) {
  return apiFetch(`${API}${path}`);
}

async function apiPut(path, body) {
  return apiFetch(`${API}${path}`, { method: 'PUT', body: JSON.stringify(body) });
}

async function apiDelete(path) {
  return apiFetch(`${API}${path}`, { method: 'DELETE' });
}

function isUrduText(s) {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s || '');
}

const DEFAULT_AVATARS = {
  male: 'avatar_male.png',
  female: 'avatar_female.png',
  other: 'avatar_male.png'
};

function getPatientAvatarSrc(patient) {
  if (!patient) return DEFAULT_AVATARS.male;
  const gender = String(patient.gender || '').trim().toLowerCase();
  if (gender === 'female') {
    return DEFAULT_AVATARS.female;
  } else {
    return DEFAULT_AVATARS.male;
  }
}

function getPatientAvatarHtml(patient, sizePx = 40, extraStyle = '') {
  const src = getPatientAvatarSrc(patient);
  const title = patient && patient.patient_image ? 'Uploaded Profile Picture' : `${patient?.gender || 'Patient'} Default Avatar`;
  return `<div class="patient-avatar" style="width:${sizePx}px;height:${sizePx}px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.12);${extraStyle}" title="${esc(title)}"><img src="${src}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`;
}

function formatGuardianRelationship(patient) {
  if (!patient) return '';
  const guardian = (patient.guardian_name || '').trim();
  if (!guardian) return '';
  const rel = (patient.guardian_relationship || '').trim();

  if (!rel) {
    const gender = (patient.gender || '').trim().toLowerCase();
    return gender === 'female' ? `D/O ${guardian}` : `S/O ${guardian}`;
  }

  if (rel.startsWith('S/O') || rel === 'Father' || rel === 'Son') {
    return `S/O ${guardian}`;
  } else if (rel.startsWith('D/O') || rel === 'Mother' || rel === 'Daughter') {
    return `D/O ${guardian}`;
  } else if (rel.startsWith('W/O') || rel === 'Husband') {
    return `W/O ${guardian}`;
  } else if (rel.startsWith('H/O') || rel === 'Wife') {
    return `H/O ${guardian}`;
  } else if (rel.startsWith('C/O')) {
    return `C/O ${guardian}`;
  } else if (rel === 'Guardian') {
    return `Guardian: ${guardian}`;
  } else if (rel === 'Other') {
    return `${guardian}`;
  } else {
    return `${rel} ${guardian}`;
  }
}

window.deleteVisit = async function(id) {
  if (!confirm('Are you sure you want to delete this visit?')) return;
  try {
    const res = await apiDelete('/visit/' + id);
    if (res.success) {
      showToast('success', 'Visit Deleted', 'The visit has been deleted.');
      const data = await apiGet('/patient/' + state.currentPatientId);
      renderVisitTimeline(data.visits || []);
      if (typeof invalidateDashboardCache === 'function') invalidateDashboardCache();
      if (typeof loadDashboard === 'function') loadDashboard();
    } else {
      showToast('error', 'Error', res.error || 'Failed to delete visit');
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
};


function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

const AVATAR_COLORS = [
  '#5B9BD5','#6DBFA7','#9B8EC4','#E895A8','#E8A87C',
  '#72B97A','#3A7DB5','#4CA089','#7B6FB5','#D85C7A',
];

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  const parts = (name || '—').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || '?').substring(0, 2).toUpperCase();
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Convert a File to a base64 data URL */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Validate image file: type + size (max 5 MB) */
function validateImageFile(file) {
  if (!file) return null;
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return 'Invalid file type. Please use JPG, PNG, or WEBP.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Image too large. Maximum size is 5 MB.';
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
════════════════════════════════════════════════════════════════════════════ */

function showToast(type, title, message, durationMs = 3400) {
  const container = document.getElementById('toast-container');
  const icons = {
    success: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>',
    info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    warning: '<path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">${icons[type] || icons.info}</svg>
    </div>
    <div class="toast-body">
      <div class="toast-title">${esc(title)}</div>
      ${message ? `<div class="toast-message">${esc(message)}</div>` : ''}
    </div>
    <div class="toast-progress"></div>`;
  container.appendChild(toast);
  const dismiss = () => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 320); };
  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, durationMs);
}

/* ════════════════════════════════════════════════════════════════════════════
   CLOCK
════════════════════════════════════════════════════════════════════════════ */

function startClock() {
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');
  if (!timeEl || !dateEl) return;
  function tick() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: true });
    dateEl.textContent = now.toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
  }
  tick();
  setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════════════════════════════ */

// Module-level medicine inventory state (guaranteed to always work from navigateTo)
let _medInvMeds = [];
let _medInvFilter = 'all';
let _medInvTableBody = null;

async function reloadMedicineInventory(query) {
  try {
    // Try the closure-based loader first (preferred, as it also updates its own closure state)
    if (state.loadInventory) {
      await state.loadInventory(query);
      return;
    }
    // Fallback: direct API call at module level
    const q = query !== undefined ? query : '';
    const data = await apiGet('/medicines?q=' + encodeURIComponent(q));
    _medInvMeds = Array.isArray(data) ? data : (data && data.medicines ? data.medicines : []);
    _medInvTableBody = _medInvTableBody || document.getElementById('med-inventory-table-body');
    if (!_medInvTableBody) return;
    const meds = _medInvMeds.filter(m => {
      if (_medInvFilter === 'all') return true;
      return (m.stock_status || 'In Stock').toLowerCase() === _medInvFilter.toLowerCase();
    });
    if (meds.length === 0) {
      _medInvTableBody.innerHTML = '<tr><td colspan="7" class="table-loading" style="text-align:center; padding:30px; color:var(--text-muted);">No medicines found.</td></tr>';
      return;
    }
    _medInvTableBody.innerHTML = meds.map(med => {
      const userStatus = med.stock_status || 'In Stock';
      const qty = parseInt(med.quantity_remaining, 10) || 0;
      const minAlert = parseInt(med.min_stock_alert, 10) || 0;
      let badgeClass = 'badge-in-stock', badgeLabel = '\uD83D\uDFE2 In Stock';
      if (userStatus === 'Out of Stock') { badgeClass = 'badge-out-of-stock'; badgeLabel = '\uD83D\uDD34 Out of Stock'; }
      else if (qty <= minAlert && qty > 0) { badgeClass = 'badge-low-stock'; badgeLabel = '\uD83D\uDFE1 Low Stock'; }
      return `<tr data-id="${med.id}"><td><div style="font-weight:600">${esc(med.code)}</div><div style="font-weight:600">${esc(med.name)}</div></td><td>${esc(med.category||'—')}</td><td>${qty}/${med.quantity_purchased||0}</td><td><span class="badge-status ${badgeClass}">${badgeLabel}</span></td><td>Rs.${med.selling_price||0}</td><td>${esc(med.expiry_date||'—')}</td><td><button type="button" class="btn btn-outline btn-edit-med" style="padding:4px 8px;font-size:11px;height:26px;width:auto;">Edit</button></td></tr>`;
    }).join('');
    _medInvTableBody.querySelectorAll('.btn-edit-med').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = this.closest('tr').dataset.id;
        const med = _medInvMeds.find(m => m.id == id);
        if (med && state.populateMedicineForm) state.populateMedicineForm(med);
      });
    });
  } catch(e) {
    console.error('[reloadMedicineInventory]', e);
    showToast('error', 'Error', 'Failed to load inventory.');
  }
}

const PAGE_META = {
  'new-patient': { title: 'New Patient', badge: 'Registration' },
  'search':      { title: 'Search Patients', badge: 'Patient Directory' },
  'dashboard':   { title: 'Dashboard', badge: 'Overview' },
  'inventory':   { title: 'Medicine Inventory', badge: 'Stock Management' },
  'backup':      { title: 'Backup & Restore', badge: 'Data Protection' },
  'all-records': { title: 'Clinic Directory', badge: 'All Patients & Medicines' },
};

function navigateTo(page) {
  const wasSamePage = state.currentPage === page;
  
  if (state.currentPage === 'new-patient') saveFormDraft();
  
  state.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(btn => {
    const active = btn.dataset.page === page;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });

  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.toggle('active', view.id === `page-${page}`);
  });

  const meta = PAGE_META[page] || { title: page, badge: '' };
  const titleEl = document.getElementById('page-title'); if (titleEl) titleEl.textContent = meta.title;
  const badgeEl = document.getElementById('page-badge'); if (badgeEl) badgeEl.textContent = meta.badge;

  if (page === 'new-patient') restoreFormDraft();
  if (page === 'search')    initSearchPage();
  if (page === 'dashboard') loadDashboard();
  if (page === 'inventory') {
    // Always reload — try closure-based loader first, fallback to module-level loader
    reloadMedicineInventory();
  }
  if (page === 'backup')    loadBackupPage();
  if (page === 'all-records') {
    // Reset data (not event listeners) so fresh data is always fetched
    allRecordsState.patients = [];
    allRecordsState.medicines = [];
    initAllRecordsPage();
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   THEME
════════════════════════════════════════════════════════════════════════════ */
function initTheme() {
  document.documentElement.setAttribute('data-theme', 'light');
}/* ════════════════════════════════════════════════════════════════════════════
   CLINIC NAME INJECTION
════════════════════════════════════════════════════════════════════════════ */

function injectClinicName() {
  const els = [
    document.getElementById('sidebar-clinic-name'),
    document.getElementById('topbar-clinic-name'),
  ];
  els.forEach(el => { if (el) el.textContent = CLINIC_NAME; });
  document.title = `${CLINIC_NAME} | Patient Management`;
}

/* ════════════════════════════════════════════════════════════════════════════
   SCREEN 1: NEW PATIENT FORM
════════════════════════════════════════════════════════════════════════════ */

function initNewPatientForm() {
  const dateEl = document.getElementById('f-registration-date');
  if (dateEl && !dateEl.value) dateEl.value = todayISO();

  // Auto-generate IRE ID
  const ireEl = document.getElementById('f-ire-id');
  if (ireEl && !ireEl.value) {
    apiFetch(`${API}/next-ire-id`).then(res => {
      if (res && res.ire_id) ireEl.value = res.ire_id;
    }).catch(() => {
      // Fallback: generate locally using timestamp
      const ts = Date.now().toString().slice(-6);
      ireEl.value = `IRE-${ts.padStart(6,'0')}`;
    });
  }

  // File upload → preview
  setupFilePreview('f-patient-image', 'f-patient-image-data', 'patient-img-preview', buildPatientPlaceholder());
  setupFilePreview('f-defect-image-1', 'f-defect-image-data-1', 'defect-img-preview-1', buildDefectPlaceholder());
  setupFilePreview('f-defect-image-2', 'f-defect-image-data-2', 'defect-img-preview-2', buildDefectPlaceholder());
  setupFilePreview('f-defect-image-3', 'f-defect-image-data-3', 'defect-img-preview-3', buildDefectPlaceholder());
  setupFilePreview('av-defect-image-1', 'av-defect-image-data-1', 'av-defect-img-preview-1', buildDefectPlaceholder(true));
  setupFilePreview('av-defect-image-2', 'av-defect-image-data-2', 'av-defect-img-preview-2', buildDefectPlaceholder(true));
  setupFilePreview('av-defect-image-3', 'av-defect-image-data-3', 'av-defect-img-preview-3', buildDefectPlaceholder(true));

  // Camera buttons
  document.getElementById('btn-open-camera-patient')?.addEventListener('click', () => openCamera('patient'));
  document.getElementById('btn-open-camera-defect-1')?.addEventListener('click',  () => openCamera('defect-1'));
  document.getElementById('btn-open-camera-defect-2')?.addEventListener('click',  () => openCamera('defect-2'));
  document.getElementById('btn-open-camera-defect-3')?.addEventListener('click',  () => openCamera('defect-3'));
  document.getElementById('btn-open-camera-av-defect')?.addEventListener('click', () => openCamera('av-defect'));

  // Medicines Table setup
  const medContainer = document.getElementById('medicine-rows-container');
  if (medContainer) {
    medContainer.innerHTML = '';
    addMedicineRow();
  }
  document.getElementById('btn-add-medicine-row')?.addEventListener('click', () => addMedicineRow());
  document.getElementById('btn-av-add-medicine-row')?.addEventListener('click', () => addMedicineRow(null, 'av-'));

  // Age <-> Date of Birth bidirectional calculation sync
  function calculateDobFromAge(age, targetDobEl) {
    const ageNum = parseInt(age, 10);
    if (!isNaN(ageNum) && ageNum >= 0 && targetDobEl) {
      const birthYear = new Date().getFullYear() - ageNum;
      const currentMonthDay = todayISO().substring(5); // -MM-DD
      targetDobEl.value = `${birthYear}-${currentMonthDay}`;
    }
  }

  function calculateAgeFromDob(dobValue, targetAgeEl) {
    if (dobValue && targetAgeEl) {
      const dob = new Date(dobValue);
      const diffMs = Date.now() - dob.getTime();
      const ageDate = new Date(diffMs);
      const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
      targetAgeEl.value = isNaN(calculatedAge) ? '' : calculatedAge;
    }
  }

  // Registration Form DOB & Age listeners
  const dobEl = document.getElementById('f-dob');
  const ageEl = document.getElementById('f-age');
  if (dobEl && ageEl) {
    dobEl.addEventListener('change', () => calculateAgeFromDob(dobEl.value, ageEl));
    ageEl.addEventListener('input', () => calculateDobFromAge(ageEl.value, dobEl));
  }

  // Edit Patient Form DOB & Age listeners
  const epDobEl = document.getElementById('ep-dob');
  const epAgeEl = document.getElementById('ep-age');
  if (epDobEl && epAgeEl) {
    epDobEl.addEventListener('change', () => calculateAgeFromDob(epDobEl.value, epAgeEl));
    epAgeEl.addEventListener('input', () => calculateDobFromAge(epAgeEl.value, epDobEl));
  }

  // Form submit
  document.getElementById('new-patient-form').addEventListener('submit', handlePatientSubmit);
  
  const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
  if (btnShareWhatsapp) {
    btnShareWhatsapp.addEventListener('click', handleWhatsAppShare);
  }
  
  const btnClear = document.getElementById('btn-clear-form');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      showConfirm('Clear Form', 'Are you sure you want to clear all data in the form?', () => {
        state.newPatientDraft = null;
        resetPatientForm();
      });
    });
  }

  const btnCancel = document.getElementById('btn-cancel-form');
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      showConfirm('Cancel', 'Discard all changes?', () => {
        resetPatientForm();
        if (state.formMode === 'ADD_VISIT' || state.formMode === 'EDIT_VISIT') {
          moveFormToPage();
        } else {
          navigateTo('dashboard');
        }
      });
    });
  }
  
  setupBillingCalculations();
}

function setupBillingCalculations() {
  // 1. Registration form calculations
  const feeEl = document.getElementById('f-consultation-fee');
  const priceEl = document.getElementById('f-medicine-price');
  const totalEl = document.getElementById('f-total-amount');
  const discEl = document.getElementById('f-discount');
  const finalEl = document.getElementById('f-final-amount');
  const recEl = document.getElementById('f-amount-received');
  const balEl = document.getElementById('f-remaining-balance');

  function calculateReg() {
    if (!feeEl || !priceEl || !totalEl || !discEl || !finalEl || !recEl || !balEl) return;
    const fee = parseFloat(feeEl.value) || 0;
    const price = parseFloat(priceEl.value) || 0;
    const total = fee + price;
    totalEl.value = total.toFixed(2);

    const disc = parseFloat(discEl.value) || 0;
    const finalAmt = Math.max(0, total - disc);
    finalEl.value = finalAmt.toFixed(2);

    const received = parseFloat(recEl.value) || 0;
    const balance = finalAmt - received;
    balEl.value = balance.toFixed(2);
  }

  [feeEl, priceEl, discEl, recEl].forEach(el => {
    el?.addEventListener('input', calculateReg);
    el?.addEventListener('change', calculateReg);
  });

  // 2. New Visit form calculations
  const avFeeEl = document.getElementById('av-consultation-fee');
  const avPriceEl = document.getElementById('av-medicine-price');
  const avTotalEl = document.getElementById('av-total-amount');
  const avDiscEl = document.getElementById('av-discount');
  const avFinalEl = document.getElementById('av-final-amount');
  const avRecEl = document.getElementById('av-amount-received');
  const avBalEl = document.getElementById('av-remaining-balance');

  function calculateVisit() {
    if (!avFeeEl || !avPriceEl || !avTotalEl || !avDiscEl || !avFinalEl || !avRecEl || !avBalEl) return;
    const fee = parseFloat(avFeeEl.value) || 0;
    const price = parseFloat(avPriceEl.value) || 0;
    const total = fee + price;
    avTotalEl.value = total.toFixed(2);

    const disc = parseFloat(avDiscEl.value) || 0;
    const finalAmt = Math.max(0, total - disc);
    avFinalEl.value = finalAmt.toFixed(2);

    const received = parseFloat(avRecEl.value) || 0;
    const balance = finalAmt - received;
    avBalEl.value = balance.toFixed(2);
  }

  [avFeeEl, avPriceEl, avDiscEl, avRecEl].forEach(el => {
    el?.addEventListener('input', calculateVisit);
    el?.addEventListener('change', calculateVisit);
  });
}

function buildPatientPlaceholder() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>No photo selected</span>`;
}
function buildDefectPlaceholder(small = false) {
  const size = small ? 24 : 40;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="${size}" height="${size}"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>No photo selected</span>`;
}

function setupFilePreview(inputId, hiddenId, previewId, placeholderHtml) {
  const input   = document.getElementById(inputId);
  const hidden  = document.getElementById(hiddenId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  input.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) {
      preview.innerHTML = `<div class="photo-placeholder">${placeholderHtml}</div>`;
      if (hidden) hidden.value = '';
      return;
    }
    // Validate
    const err = validateImageFile(file);
    if (err) {
      showToast('error', 'Invalid Image', err);
      this.value = '';
      return;
    }
    const b64 = await fileToBase64(file);
    preview.innerHTML = `<img src="${b64}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" alt="Preview" />`;
    if (hidden) hidden.value = b64;
  });
}

// ─── MEDICINES MANAGEMENT ───
function addMedicineRow(med = null, prefix = false) {
  let containerId = 'medicine-rows-container';
  if (prefix === true || prefix === 'av-') containerId = 'av-medicine-rows-container';
  else if (prefix === 'ev-') containerId = 'ev-medicine-rows-container';
  else if (typeof prefix === 'string' && prefix) containerId = prefix.endsWith('-') ? `${prefix}medicine-rows-container` : prefix;

  const container = document.getElementById(containerId);
  if (!container) return;

  const tr = document.createElement('tr');
  tr.className = 'medicine-row';
  tr.innerHTML = `
    <td><input type="text" class="field-input med-name" placeholder="e.g. Arnica Montana" value="${esc(med?.name)}" style="padding:6px 10px;" /></td>
    <td><input type="text" class="field-input med-dosage" placeholder="e.g. 30" value="${esc(med?.dosage)}" style="padding:6px 10px;" /></td>
    <td><input type="text" class="field-input med-frequency" placeholder="e.g. 5 drops" value="${esc(med?.frequency)}" style="padding:6px 10px;" /></td>
    <td><input type="text" class="field-input med-duration" placeholder="e.g. 5 days" value="${esc(med?.duration)}" style="padding:6px 10px;" /></td>
    <td><input type="text" class="field-input med-instructions" placeholder="e.g. after meals" value="${esc(med?.instructions)}" style="padding:6px 10px;" /></td>
    <td style="text-align: center; vertical-align: middle;">
      <button type="button" class="btn-remove-med" style="padding: 4px;" title="Remove Medicine">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </td>
  `;

  // Automatically append ' days' when a number is typed in duration input
  const durationInput = tr.querySelector('.med-duration');
  durationInput.addEventListener('blur', (e) => {
    const val = e.target.value.trim();
    if (val && /^\d+$/.test(val)) {
      e.target.value = val + ' days';
    }
  });

  tr.querySelector('.btn-remove-med').addEventListener('click', () => {
    tr.remove();
    if (container.querySelectorAll('.medicine-row').length === 0) {
      addMedicineRow(null, prefix); // Always keep at least one row
    }
  });
  container.appendChild(tr);
}

function serializeMedicines(prefix = false) {
  const textEl = document.getElementById('f-medicines-text');
  if (textEl && !prefix) {
    return textEl.value.trim();
  }

  let containerId = 'medicine-rows-container';
  if (prefix === true || prefix === 'av-') containerId = 'av-medicine-rows-container';
  else if (prefix === 'ev-') containerId = 'ev-medicine-rows-container';
  else if (typeof prefix === 'string' && prefix) containerId = prefix.endsWith('-') ? `${prefix}medicine-rows-container` : prefix;

  const rows = document.querySelectorAll(`#${containerId} .medicine-row`);
  if (rows.length === 0) {
    const textId = (prefix === true || prefix === 'av-') ? 'av-medicines-text' : (prefix === 'ev-' ? 'ev-medicines-text' : 'f-medicines-text');
    const fallbackText = document.getElementById(textId)?.value.trim() || document.getElementById('f-medicines-text')?.value.trim();
    if (fallbackText) return fallbackText;
  }
  const meds = [];
  rows.forEach(row => {
    const name = row.querySelector('.med-name').value.trim();
    const dosage = row.querySelector('.med-dosage').value.trim();
    const freq = row.querySelector('.med-frequency').value.trim();
    const dur = row.querySelector('.med-duration').value.trim();
    const inst = row.querySelector('.med-instructions').value.trim();
    if (name) {
      meds.push({ name, dosage, frequency: freq, duration: dur, instructions: inst });
    }
  });
  return meds.length > 0 ? JSON.stringify(meds) : (document.getElementById('f-medicines-text')?.value.trim() || '');
}

function deserializeMedicines(str, targetId) {
  if (!str) return '';
  let formatted = '';
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed) && parsed.length > 0) {
      formatted = parsed.map((m, idx) => {
        const parts = [m.name ? m.name : ''];
        if (m.dosage) parts.push(`Potency: ${m.dosage}`);
        if (m.frequency) parts.push(`Dosage: ${m.frequency}`);
        if (m.duration) parts.push(`Duration: ${m.duration}`);
        return `${idx + 1}. ${parts.join(' | ')}`;
      }).join('\n');
    } else {
      formatted = str;
    }
  } catch (_) {
    formatted = str;
  }

  if (targetId) {
    const el = document.getElementById(targetId);
    if (el) el.value = formatted;
  }
  return formatted;
}

function openPatientEditForm() {
  if (!state.currentPatientId || !window._currentPatientData) return;
  const p = window._currentPatientData;
  state.editingPatientId = p.id;
  
  closePanel();
  navigateTo('new-patient');
  
  const titleEl = document.querySelector('#page-new-patient h2');
  if (titleEl) titleEl.textContent = 'Edit Patient Registration';
  const btn = document.getElementById('btn-submit-patient');
  if (btn) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg> <span>Update Patient</span>`;
  
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('f-first-name', p.first_name || p.name);
  setVal('f-guardian-name', p.guardian_name);
  setVal('f-guardian-relationship', p.guardian_relationship || 'Father');
  setVal('f-dob', p.date_of_birth);
  setVal('f-age', p.age);
  setVal('f-blood', p.blood_group);
  setVal('f-weight', p.weight);
  setVal('f-whatsapp', p.whatsapp_number);
  setVal('f-city', p.city);
  setVal('f-address', p.address);
  setVal('f-medical-history', p.medical_history);
  setVal('f-ire-id', p.ire_id);
  
  if (p.gender) {
    const radio = document.querySelector(`input[name="f-gender"][value="${p.gender}"]`) || 
                  document.querySelector(`input[name="gender"][value="${p.gender}"]`);
    if (radio) radio.checked = true;
  }
}

async function handlePatientSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-patient');
  const firstNameEl = document.getElementById('f-first-name');
  const ageEl = document.getElementById('f-age');
  const dateEl = document.getElementById('f-registration-date');

  let valid = true;
  [firstNameEl, ageEl].forEach(el => {
    if (!el || !el.value.trim()) { el?.classList.add('error'); valid = false; }
    else el.classList.remove('error');
  });

  if (!valid) {
    showToast('warning', 'Required Fields Missing', 'Please fill in First Name and Age.');
    firstNameEl?.focus();
    return;
  }

  const payload = {
    first_name:               firstNameEl.value.trim(),
    last_name:                '',
    guardian_name:            document.getElementById('f-guardian-name').value.trim(),
    guardian_relationship:    document.getElementById('f-guardian-relationship')?.value || 'Father',
    registration_date:        dateEl.value,
    gender:                   (document.querySelector('input[name="f-gender"]:checked') || document.querySelector('input[name="gender"]:checked') || document.querySelector('input[name="ep-gender"]:checked') || {}).value || 'Male',
    date_of_birth:            getVal('f-dob'),
    age:                      parseInt(getVal('f-age'), 10) || null,
    blood_group:              getVal('f-blood'),
    weight:                   parseFloat(getVal('f-weight')) || null,
    whatsapp_number:          getVal('f-whatsapp').trim(),
    city:                     getVal('f-city').trim(),
    address:                  getVal('f-address').trim(),
    symptoms:                 getVal('f-symptoms').trim(),
    medical_history:          getVal('f-medical-history').trim(),
    current_medicines:        serializeMedicines(),
    patient_image:            getVal('f-patient-image-data'),
    defect_image:             getVal('f-defect-image-data-1'),
    defect_image_2:           getVal('f-defect-image-data-2'),
    defect_image_3:           getVal('f-defect-image-data-3'),
    patient_status:           'Active',
    ire_id:                   getVal('f-ire-id').trim(),
    // Vitals and initial visit date mapping
    visit_date:               dateEl ? dateEl.value : todayISO(),
    pulse_rate:               parseInt(getVal('f-pulse-rate'), 10) || null,
    blood_pressure:           getVal('f-blood-pressure').trim(),
    temperature:              parseFloat(getVal('f-temperature')) || null,
    oxygen_level:             parseInt(getVal('f-oxygen-level'), 10) || null,
    defected_area_image:      getVal('f-defect-image-data-1'),
    defected_area_image_2:    getVal('f-defect-image-data-2'),
    defected_area_image_3:    getVal('f-defect-image-data-3'),
    medicines:                serializeMedicines(),
    consultation_fee:         parseFloat(getVal('f-consultation-fee')) || 0.0,
    medicine_price:           parseFloat(getVal('f-medicine-price')) || 0.0,
    total_amount:             parseFloat(getVal('f-total-amount')) || 0.0,
    discount:                 parseFloat(getVal('f-discount')) || 0.0,
    final_amount:             parseFloat(getVal('f-final-amount')) || 0.0,
    payment_method:           getVal('f-payment-method') || 'Cash',
    payment_status:           getVal('f-payment-status') || 'Paid',
    amount_received:          parseFloat(getVal('f-amount-received')) || 0.0,
    remaining_balance:        parseFloat(getVal('f-remaining-balance')) || 0.0
  };

  btn.disabled = true;
  btn.innerHTML = `<div class="btn-spinner"></div><span>Saving…</span>`;

  try {
    const isEditing = !!state.editingPatientId;
    const url = isEditing ? `${API}/patient/${state.editingPatientId}` : `${API}/patient`;
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    // Duplicate handling removed as per user request

    if (result.success) {
      invalidateDashboardCache();
      if (isEditing) {
        showToast('success', '✅ Patient Updated!', `Patient #${state.editingPatientId} updated successfully.`);
        const pid = state.editingPatientId;
        state.editingPatientId = null;
        setTimeout(() => {
          resetPatientForm();
          navigateTo('search');
          openPatientPanel(pid);
        }, 400);
      } else {
        showToast('success', '✅ Patient Registered!', `ID #${result.patient_id} created successfully.`);
        setTimeout(() => resetPatientForm(), 400);
      }
    } else {
      showToast('error', 'Registration Failed', result.error || 'Unknown error');
    }
  } catch (err) {
    showToast('error', 'Connection Error', err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M5 13l4 4L19 7"/></svg><span>Register Patient</span>`;
  }
}

function resetPatientForm() {
  state.editingPatientId = null;
  const titleEl = document.querySelector('#page-new-patient h2');
  if (titleEl) titleEl.textContent = 'New Patient Registration';
  const btnSubmit = document.getElementById('btn-submit-patient');
  if (btnSubmit) btnSubmit.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M5 13l4 4L19 7"/></svg><span>Register Patient</span>`;

  document.getElementById('new-patient-form').reset();
  const dateEl = document.getElementById('f-registration-date');
  if (dateEl) dateEl.value = todayISO();
  (() => { const el = document.getElementById('f-patient-image-data'); if (el) el.value = ''; })();
  (() => { const el = document.getElementById('f-defect-image-data-1'); if (el) el.value = ''; })();
  (() => { const el = document.getElementById('f-defect-image-data-2'); if (el) el.value = ''; })();
  (() => { const el = document.getElementById('f-defect-image-data-3'); if (el) el.value = ''; })();
  (() => { const el = document.getElementById('patient-img-preview'); if (el) el.innerHTML = `<div class="photo-placeholder">${buildPatientPlaceholder()}</div>`; })();
  (() => { const el = document.getElementById('defect-img-preview-1'); if (el) el.innerHTML = `<div class="photo-placeholder">${buildDefectPlaceholder()}</div>`; })();
  (() => { const el = document.getElementById('defect-img-preview-2'); if (el) el.innerHTML = `<div class="photo-placeholder">${buildDefectPlaceholder()}</div>`; })();
  (() => { const el = document.getElementById('defect-img-preview-3'); if (el) el.innerHTML = `<div class="photo-placeholder">${buildDefectPlaceholder()}</div>`; })();
  
  const container = document.getElementById('medicine-rows-container');
  if (container) {
    container.innerHTML = '';
    addMedicineRow();
  }
  
  document.querySelectorAll('.field-input.error, .field-select.error, .field-textarea.error')
    .forEach(el => el.classList.remove('error'));
  state.newPatientDraft = null;
}

function saveFormDraft() {
  const getVal = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const getHtml = id => { const el = document.getElementById(id); return el ? el.innerHTML : ''; };

  state.newPatientDraft = {
    first_name: getVal('f-first-name'),
    guardian_name: getVal('f-guardian-name'),
    visit_date: getVal('f-registration-date'),
    gender: (document.querySelector('input[name="gender"]:checked') || {}).value || '',
    dob: getVal('f-dob'),
    age: getVal('f-age'),
    blood_group: getVal('f-blood'),
    weight: getVal('f-weight'),
    whatsapp_number: getVal('f-whatsapp'),
    city: getVal('f-city'),
    address: getVal('f-address'),
    symptoms: getVal('f-symptoms'),
    medical_history: getVal('f-medical-history'),
    pulse_rate: getVal('f-pulse-rate'),
    blood_pressure: getVal('f-blood-pressure'),
    temperature: getVal('f-temperature'),
    oxygen_level: getVal('f-oxygen-level'),
    ire_id: getVal('f-ire-id'),
    medicines: serializeMedicines(),
    patient_image_data: getVal('f-patient-image-data'),
    defect_image_data_1: getVal('f-defect-image-data-1'),
    defect_image_data_2: getVal('f-defect-image-data-2'),
    defect_image_data_3: getVal('f-defect-image-data-3'),
    patient_img_preview: getHtml('patient-img-preview'),
    defect_img_preview_1: getHtml('defect-img-preview-1'),
    defect_img_preview_2: getHtml('defect-img-preview-2'),
    defect_img_preview_3: getHtml('defect-img-preview-3'),
  };
}

function populateFormFromData(d) {
  if (!d) return;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  setVal('f-first-name', d.first_name || d.name || '');
  setVal('f-guardian-name', d.guardian_name || '');
  if (d.gender) {
    const r = document.querySelector(`input[name="gender"][value="${d.gender}"]`);
    if (r) r.checked = true;
  }
  setVal('f-dob', d.dob || d.date_of_birth || '');
  setVal('f-age', d.age || '');
  setVal('f-blood', d.blood_group || '');
  setVal('f-weight', d.weight || '');
  setVal('f-whatsapp', d.whatsapp_number || '');
  setVal('f-city', d.city || '');
  setVal('f-address', d.address || '');
  setVal('f-patient-status', d.patient_status || 'Active');
  setVal('f-ire-id', d.ire_id || '');
}

function freezeDemographics() {
  const fields = ['f-first-name', 'f-guardian-name', 'f-dob', 'f-age', 'f-blood', 'f-whatsapp', 'f-city', 'f-address'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.readOnly = true; el.style.backgroundColor = 'var(--bg-card)'; }
  });
  document.querySelectorAll('input[name="gender"]').forEach(el => el.disabled = true);
}

function unfreezeDemographics() {
  const fields = ['f-first-name', 'f-guardian-name', 'f-dob', 'f-age', 'f-blood', 'f-whatsapp', 'f-city', 'f-address'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.readOnly = false; el.style.backgroundColor = ''; }
  });
  document.querySelectorAll('input[name="gender"]').forEach(el => el.disabled = false);
}

function restoreFormDraft() {
  if (!state.newPatientDraft) {
    const dateEl = document.getElementById('f-registration-date');
    if (dateEl && !dateEl.value) dateEl.value = todayISO();
    return;
  }
  const d = state.newPatientDraft;
  (() => { const el = document.getElementById('f-first-name'); if (el) el.value = d.first_name || ''; })();
  (() => { const el = document.getElementById('f-guardian-name'); if (el) el.value = d.guardian_name || ''; })();
  (() => { const el = document.getElementById('f-registration-date'); if (el) el.value = d.visit_date || ''; })();
  
  if (d.gender) {
    const r = document.querySelector(`input[name="gender"][value="${d.gender}"]`);
    if (r) r.checked = true;
  }
  
  (() => { const el = document.getElementById('f-dob'); if (el) el.value = d.dob || ''; })();
  (() => { const el = document.getElementById('f-age'); if (el) el.value = d.age || ''; })();
  (() => { const el = document.getElementById('f-blood'); if (el) el.value = d.blood_group || ''; })();
  (() => { const el = document.getElementById('f-weight'); if (el) el.value = d.weight || ''; })();
  (() => { const el = document.getElementById('f-whatsapp'); if (el) el.value = d.whatsapp_number || ''; })();
  (() => { const el = document.getElementById('f-city'); if (el) el.value = d.city || ''; })();
  (() => { const el = document.getElementById('f-address'); if (el) el.value = d.address || ''; })();
  (() => { const el = document.getElementById('f-symptoms'); if (el) el.value = d.symptoms || ''; })();
  (() => { const el = document.getElementById('f-medical-history'); if (el) el.value = d.medical_history || ''; })();
  (() => { const el = document.getElementById('f-pulse-rate'); if (el) el.value = d.pulse_rate || ''; })();
  (() => { const el = document.getElementById('f-blood-pressure'); if (el) el.value = d.blood_pressure || ''; })();
  (() => { const el = document.getElementById('f-temperature'); if (el) el.value = d.temperature || ''; })();
  (() => { const el = document.getElementById('f-oxygen-level'); if (el) el.value = d.oxygen_level || ''; })();
  (() => { const el = document.getElementById('f-patient-status'); if (el) el.value = d.patient_status || 'Active'; })();
  (() => { const el = document.getElementById('f-ire-id'); if (el) el.value = d.ire_id || ''; })();
  
  deserializeMedicines(d.medicines);
  
  (() => { const el = document.getElementById('f-patient-image-data'); if (el) el.value = d.patient_image_data || ''; })();
  (() => { const el = document.getElementById('f-defect-image-data-1'); if (el) el.value = d.defect_image_data_1 || ''; })();
  (() => { const el = document.getElementById('f-defect-image-data-2'); if (el) el.value = d.defect_image_data_2 || ''; })();
  (() => { const el = document.getElementById('f-defect-image-data-3'); if (el) el.value = d.defect_image_data_3 || ''; })();
  (() => { const el = document.getElementById('patient-img-preview'); if (el) el.innerHTML = d.patient_img_preview || ''; })();
  (() => { const el = document.getElementById('defect-img-preview-1'); if (el) el.innerHTML = d.defect_img_preview_1 || ''; })();
  (() => { const el = document.getElementById('defect-img-preview-2'); if (el) el.innerHTML = d.defect_img_preview_2 || ''; })();
  (() => { const el = document.getElementById('defect-img-preview-3'); if (el) el.innerHTML = d.defect_img_preview_3 || ''; })();
}

async function handleWhatsAppShare() {
  const firstName = document.getElementById('f-first-name').value.trim();
  const whatsappRaw = document.getElementById('f-whatsapp')?.value.trim() || '';

  if (!firstName) { 
    showToast('warning', 'Missing Info', 'Please enter the patient name first.'); 
    return; 
  }

  const dummyPatient = {
    id: 'NEW',
    ire_id: document.getElementById('f-ire-id').value.trim() || 'NEW REGISTRATION',
    first_name: firstName,
    guardian_name: document.getElementById('f-guardian-name').value.trim(),
    registration_date: document.getElementById('f-registration-date').value || new Date().toISOString(),
    gender: (document.querySelector('input[name="gender"]:checked') || {}).value || 'Male',
    age: document.getElementById('f-age').value.trim(),
    date_of_birth: document.getElementById('f-dob').value,
    blood_group: document.getElementById('f-blood').value,
    weight: document.getElementById('f-weight').value.trim(),
    whatsapp_number: whatsappRaw,
    city: document.getElementById('f-city').value.trim(),
    address: document.getElementById('f-address').value.trim(),
    symptoms: document.getElementById('f-symptoms').value.trim(),
    medical_history: document.getElementById('f-medical-history').value.trim(),
    patient_image: document.getElementById('f-patient-image-data').value || '',
    defect_image: document.getElementById('f-defect-image-data-1').value || '',
    defect_image_2: document.getElementById('f-defect-image-data-2').value || '',
    defect_image_3: document.getElementById('f-defect-image-data-3').value || '',
    pulse_rate: document.getElementById('f-pulse-rate').value.trim(),
    blood_pressure: document.getElementById('f-blood-pressure').value.trim(),
    temperature: document.getElementById('f-temperature').value.trim(),
    medicines: serializeMedicines()
  };

  // We temporarily change the button to show generating state
  const btn = document.getElementById('btn-share-whatsapp');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<div class="btn-spinner"></div><span>Generating…</span>`;

  try {
    await sendPatientCardToWhatsApp(dummyPatient);
  } catch (err) {
    showToast('error', 'Failed', err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   CAMERA FEATURE
════════════════════════════════════════════════════════════════════════════ */

function openCamera(target) {
  state.cameraTarget = target;
  const modal = document.getElementById('camera-modal');
  const titles = {
    'patient':   '📷 Patient Profile Photo',
    'defect':    '📷 Defected Area Photo',
    'av-defect': '📷 Defected Area Photo (Visit)',
  };
  document.getElementById('camera-modal-title').textContent = titles[target] || 'Live Camera';

  const cameraBody = modal ? modal.querySelector('.camera-body') : null;
  if (cameraBody) {
    if (target === 'patient') {
      cameraBody.classList.add('camera-portrait-mode');
    } else {
      cameraBody.classList.remove('camera-portrait-mode');
    }
  }

  showCameraLiveView();
  modal.classList.add('open');
  startCameraStream();
}

function closeCameraModal() {
  stopCameraStream();
  const modal = document.getElementById('camera-modal');
  if (modal) modal.classList.remove('open');
  const cameraBody = modal ? modal.querySelector('.camera-body') : null;
  if (cameraBody) {
    cameraBody.classList.remove('camera-portrait-mode');
  }
  showCameraLiveView();
  state.cameraTarget = null;
}

function showCameraLiveView() {
  document.getElementById('camera-live-section').style.display = 'block';
  document.getElementById('camera-preview-section').style.display = 'none';
  document.getElementById('camera-live-actions').style.display = 'flex';
  document.getElementById('camera-preview-actions').style.display = 'none';
  document.getElementById('camera-permission-msg').style.display = 'none';
  document.getElementById('camera-video').style.display = 'block';
}

async function startCameraStream() {
  const video = document.getElementById('camera-video');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    state.cameraStream = stream;
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('camera-permission-msg').style.display = 'none';
  } catch (err) {
    video.style.display = 'none';
    document.getElementById('camera-permission-msg').style.display = 'flex';
    console.warn('Camera access denied:', err);
  }
}

function stopCameraStream() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(t => t.stop());
    state.cameraStream = null;
  }
  const video = document.getElementById('camera-video');
  video.srcObject = null;
}

function capturePhoto() {
  const video  = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!state.cameraStream || !video.videoWidth) {
    showToast('warning', 'Camera Not Ready', 'Please wait for the camera to load.');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (state.cameraTarget === 'patient') {
    // Crop center to 3:4 portrait ratio
    const videoRatio = video.videoWidth / video.videoHeight;
    if (videoRatio > 0.75) {
      // Landscape or square: crop the sides (width)
      const targetHeight = video.videoHeight;
      const targetWidth = Math.round(targetHeight * 0.75);
      const sourceX = Math.round((video.videoWidth - targetWidth) / 2);
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(video, sourceX, 0, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
    } else {
      // Narrow portrait: crop top and bottom (height)
      const targetWidth = video.videoWidth;
      const targetHeight = Math.round(targetWidth / 0.75);
      const sourceY = Math.round((video.videoHeight - targetHeight) / 2);
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(video, 0, sourceY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
    }
  } else {
    // Normal landscape capture for other targets
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  // Switch to preview mode
  document.getElementById('camera-live-section').style.display = 'none';
  document.getElementById('camera-preview-section').style.display = 'block';
  document.getElementById('camera-live-actions').style.display = 'none';
  document.getElementById('camera-preview-actions').style.display = 'flex';
}

function usePhoto() {
  const canvas = document.getElementById('camera-canvas');
  const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

  const target = state.cameraTarget;
  let previewId, hiddenId;

  if (target === 'patient') {
    previewId = 'patient-img-preview';
    hiddenId  = 'f-patient-image-data';
  } else if (target === 'defect-1') {
    previewId = 'defect-img-preview-1';
    hiddenId  = 'f-defect-image-data-1';
  } else if (target === 'defect-2') {
    previewId = 'defect-img-preview-2';
    hiddenId  = 'f-defect-image-data-2';
  } else if (target === 'defect-3') {
    previewId = 'defect-img-preview-3';
    hiddenId  = 'f-defect-image-data-3';
  } else if (target === 'av-defect-1') {
    previewId = 'av-defect-img-preview-1';
    hiddenId  = 'av-defect-image-data-1';
  } else if (target === 'av-defect-2') {
    previewId = 'av-defect-img-preview-2';
    hiddenId  = 'av-defect-image-data-2';
  } else if (target === 'av-defect-3') {
    previewId = 'av-defect-img-preview-3';
    hiddenId  = 'av-defect-image-data-3';
  }

  if (previewId) {
    const preview = document.getElementById(previewId);
    if (preview) preview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" alt="Camera capture" />`;
  }
  if (hiddenId) {
    const hidden = document.getElementById(hiddenId);
    if (hidden) hidden.value = dataUrl;
  }

  showToast('success', 'Photo Captured!', 'Camera photo applied successfully.');
  closeCameraModal();
}

function retakePhoto() {
  showCameraLiveView();
}

function setupCameraModal() {
  document.getElementById('btn-camera-close')?.addEventListener('click', closeCameraModal);
  document.getElementById('btn-camera-cancel')?.addEventListener('click', closeCameraModal);
  document.getElementById('btn-camera-cancel-2')?.addEventListener('click', closeCameraModal);
  document.getElementById('btn-capture-photo')?.addEventListener('click', capturePhoto);
  document.getElementById('btn-use-photo')?.addEventListener('click', usePhoto);
  document.getElementById('btn-retake-photo')?.addEventListener('click', retakePhoto);
  document.getElementById('btn-retry-camera')?.addEventListener('click', startCameraStream);

  // Close on overlay click
  document.getElementById('camera-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('camera-modal')) closeCameraModal();
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   SCREEN 2: SEARCH PATIENTS
════════════════════════════════════════════════════════════════════════════ */

function initSearchPage() {
  loadPatients('');
}

function setupSearchInput() {
  // --- 1. PATIENT RECORD PAGE SEARCH ---
  const searchInput = document.getElementById('search-input');
  const searchIdInput = document.getElementById('search-id-input');
  const searchSpinner = document.getElementById('search-spinner');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(state.searchDebounceTimer);
      if (searchIdInput) searchIdInput.value = '';
      const q = searchInput.value.trim();
      searchSpinner.style.display = 'block';
      state.searchDebounceTimer = setTimeout(async () => {
        await loadPatients(q, searchInput);
        searchSpinner.style.display = 'none';
      }, 300);
    });
  }
  if (searchIdInput) {
    searchIdInput.addEventListener('input', () => {
      clearTimeout(state.searchDebounceTimer);
      if (searchInput) searchInput.value = '';
      const idVal = searchIdInput.value.trim();
      searchSpinner.style.display = 'block';
      state.searchDebounceTimer = setTimeout(async () => {
        await loadPatients(idVal ? `id:${idVal}` : '', searchInput);
        searchSpinner.style.display = 'none';
      }, 300);
    });
  }

  // --- 2. DASHBOARD SEARCH ---
  const dashSearch = document.getElementById('dash-quick-search');
  const dashIdSearch = document.getElementById('dash-id-search');
  if (dashSearch) {
    dashSearch.addEventListener('input', () => {
      clearTimeout(state.dashDebounceTimer);
      if (dashIdSearch) dashIdSearch.value = '';
      state.dashDebounceTimer = setTimeout(() => {
        recentTableState.searchQuery = dashSearch.value.trim();
        recentTableState.currentPage = 1;
        refreshPatientDashboard();
      }, 300);
    });
  }
  if (dashIdSearch) {
    dashIdSearch.addEventListener('input', () => {
      clearTimeout(state.dashDebounceTimer);
      if (dashSearch) dashSearch.value = '';
      state.dashDebounceTimer = setTimeout(() => {
        const idVal = dashIdSearch.value.trim();
        recentTableState.searchQuery = idVal ? `id:${idVal}` : '';
        recentTableState.currentPage = 1;
        refreshPatientDashboard();
      }, 300);
    });
  }

  // --- 3. CLINIC DIRECTORY SEARCH ---
  const dirSearch = document.getElementById('dir-patients-search');
  const dirIdSearch = document.getElementById('dir-id-search');
  if (dirSearch) {
    dirSearch.addEventListener('input', () => {
      if (dirIdSearch) dirIdSearch.value = '';
      allRecordsState.patientsQuery = dirSearch.value.trim().toLowerCase();
      allRecordsState.patientsPage = 1;
      renderAllRecords();
    });
  }
  if (dirIdSearch) {
    dirIdSearch.addEventListener('input', () => {
      if (dirSearch) dirSearch.value = '';
      const idVal = dirIdSearch.value.trim();
      allRecordsState.patientsQuery = idVal ? `id:${idVal}` : '';
      allRecordsState.patientsPage = 1;
      renderAllRecords();
    });
  }

  // Dashboard premium quick search bar handler
  if (dashSearch) {
    dashSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = dashSearch.value.trim();
        if (query) {
          // Switch to search page
          navigateTo('search');
          // Fill search page input and trigger search
          const mainSearchInput = document.getElementById('search-input');
          if (mainSearchInput) {
            mainSearchInput.value = query;
            mainSearchInput.dispatchEvent(new Event('input'));
          }
          // Reset dashboard quick search field
          dashSearch.value = '';
        }
      }
    });
  }
}

async function loadPatients(query, sourceInput = document.getElementById('search-input')) {
  const grid    = document.getElementById('patients-grid');
  const label   = document.getElementById('search-results-label');
  const spinner = document.getElementById('search-spinner');
  spinner.style.display = 'block';
  grid.innerHTML = '';
  
  if (sourceInput) sourceInput.dispatchEvent(new CustomEvent('bee:searching'));

  try {
    const url = `${API}/patients${query ? `?q=${encodeURIComponent(query)}` : ''}`;
    const patients = await apiFetch(url);
    spinner.style.display = 'none';

    if (!Array.isArray(patients) || patients.length === 0) {
      label.textContent = query ? `No results for "${query}"` : 'No patients registered yet.';
      grid.innerHTML = buildEmptyState(
        query ? 'No patients found' : 'No patients yet',
        query ? 'Try a different name or WhatsApp number.' : 'Click "New Patient" to register the first one.'
      );
      if (sourceInput) sourceInput.dispatchEvent(new CustomEvent('bee:empty'));
      return;
    }

    label.textContent = query
      ? `${patients.length} result${patients.length !== 1 ? 's' : ''} for "${query}"`
      : `Showing all ${patients.length} registered patient${patients.length !== 1 ? 's' : ''}`;

    patients.forEach((p, i) => grid.appendChild(buildPatientCard(p, i)));
    if (sourceInput) sourceInput.dispatchEvent(new CustomEvent('bee:success'));
  } catch (err) {
    spinner.style.display = 'none';
    label.textContent = 'Error loading patients';
    grid.innerHTML = buildEmptyState('Connection Error', err.message);
    showToast('error', 'Load Error', err.message);
    if (sourceInput) sourceInput.dispatchEvent(new CustomEvent('bee:error'));
  }
}

function buildEmptyState(title, sub) {
  return `
    <div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </div>
      <h3>${esc(title)}</h3>
      <p>${esc(sub)}</p>
    </div>`;
}

function buildPatientCard(p, index) {
  const card = document.createElement('div');
  card.className = 'patient-card';
  card.style.animationDelay = `${index * 45}ms`;

  const avatarHtml = getPatientAvatarHtml(p, 44);

  card.innerHTML = `
    <div class="patient-card-top">
      ${avatarHtml}
      <div class="patient-info">
        <div class="patient-name">
          ${esc(p.name)}${p.surname ? ' ' + esc(p.surname) : ''}
          <span style="font-size: 10px; font-weight: 800; color: #0F8B6D; background: rgba(15,139,109,0.1); padding: 1px 6px; border-radius: 8px; display: inline-block; vertical-align: middle; margin-left: 4px;">#${p.id}</span>
        </div>
        <div class="patient-meta">
          ${p.age ? `${p.age} yrs` : ''}
          ${p.gender ? ` · ${esc(p.gender)}` : ''}
          ${p.blood_group ? `<span class="badge">${esc(p.blood_group)}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="patient-details">
      <div class="patient-detail-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Area: ${p.city ? esc(p.city) : (p.address ? esc(p.address) : '—')}
      </div>
      <div class="patient-detail-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Area: ${p.city ? esc(p.city) : (p.address ? esc(p.address) : '—')}
      </div>
      <div class="patient-detail-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 0112 19a19.5 19.5 0 01-3.91-2.61 19.79 19.79 0 01-2.61-3.91 19.79 19.79 0 01-2-8.82A2 2 0 015.18 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.91 9.09a16 16 0 006 6l.61-.61a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        ${p.whatsapp_number ? esc(p.whatsapp_number) : '<span style="color:var(--text-muted,#94a3b8); font-style:italic;">Not Provided</span>'}
      </div>
      <div class="patient-detail-row">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Last visit: ${formatDate(p.last_visit) || 'No visits'}
      </div>
    </div>
    <button class="btn-view" data-id="${p.id}">
      <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      View Record
    </button>`;

  card.querySelector('.btn-view').addEventListener('click', () => openPatientPanel(p.id));
  return card;
}

/* ════════════════════════════════════════════════════════════════════════════
   PATIENT RECORD PANEL
════════════════════════════════════════════════════════════════════════════ */

function setupPanel() {
  document.getElementById('panel-overlay')?.addEventListener('click', closePanel);
  document.getElementById('panel-close')?.addEventListener('click', closePanel);
  document.getElementById('btn-add-patient-action')?.addEventListener('click', () => { closePanel(); navigateTo('new-patient'); });
  document.getElementById('btn-repeat-patient-action')?.addEventListener('click', toggleAddVisitForm);
  document.getElementById('btn-patient-details-action')?.addEventListener('click', async () => {
    if (state.currentPatientId) await generatePatientDetailsCard(state.currentPatientId);
  });
  document.getElementById('btn-edit-patient-trigger')?.addEventListener('click', () => {
    openPatientEditForm();
  });
  document.getElementById('btn-cancel-visit')?.addEventListener('click', toggleAddVisitForm);
  document.getElementById('btn-repeat-visit')?.addEventListener('click', handleRepeatVisit);
  document.getElementById('btn-delete-patient')?.addEventListener('click', () => {
    if (!state.currentPatientId) return;
    const name = document.getElementById('panel-name').textContent;
    showConfirm('Delete Patient?', `This will permanently delete "${name}" and all their visit records.`,
      () => deletePatient(state.currentPatientId));
  });

  // Add visit camera
  document.getElementById('btn-open-camera-av-defect-1')?.addEventListener('click', () => openCamera('av-defect-1'));
  document.getElementById('btn-open-camera-av-defect-2')?.addEventListener('click', () => openCamera('av-defect-2'));
  document.getElementById('btn-open-camera-av-defect-3')?.addEventListener('click', () => openCamera('av-defect-3'));

  // Add visit file upload
  setupFilePreview('av-defect-image-1', 'av-defect-image-data-1', 'av-defect-img-preview-1', buildDefectPlaceholder(true));
  setupFilePreview('av-defect-image-2', 'av-defect-image-data-2', 'av-defect-img-preview-2', buildDefectPlaceholder(true));
  setupFilePreview('av-defect-image-3', 'av-defect-image-data-3', 'av-defect-img-preview-3', buildDefectPlaceholder(true));

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
}

async function openPatientPanel(patientId) {
  window.openPatientPanel = openPatientPanel;
  state.currentPatientId = patientId;
  const dateEl = document.getElementById('av-date');
  if (dateEl) dateEl.value = todayISO();
  const formEl = document.getElementById('add-visit-form');
  if (formEl) formEl.classList.remove('visible');
  ['av-pulse-rate','av-blood-pressure','av-temperature','av-symptoms','av-medicines','av-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['av-defect-image-data-1', 'av-defect-image-data-2', 'av-defect-image-data-3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['av-defect-img-preview-1', 'av-defect-img-preview-2', 'av-defect-img-preview-3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="photo-placeholder">${buildDefectPlaceholder(true)}</div>`;
  });

  try {
    const data = await apiFetch(`${API}/patient/${patientId}`);
    window._currentPatientData = data.patient || data;
    window._currentVisits = data.visits || [];
    renderPanel(window._currentPatientData, window._currentVisits);
    document.getElementById('panel-overlay').classList.add('visible');
    document.getElementById('record-panel').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    showToast('error', 'Load Failed', err.message);
  }
}

function renderPanel(patient, visits) {
  window._currentPatientData = patient;
  window._currentVisits = visits || [];

  const avatarEl = document.getElementById('panel-avatar');
  if (avatarEl) {
    avatarEl.innerHTML = `<img src="${getPatientAvatarSrc(patient)}" alt="Patient photo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />`;
    avatarEl.style.background = 'transparent';
  }

  const name = patient.first_name || patient.name || '—';
  const surname = patient.last_name || patient.surname || '';
  document.getElementById('panel-name').innerHTML = `${esc(name)}${surname ? ' ' + esc(surname) : ''} <span style="font-size: 12px; font-weight: 800; color: #0F8B6D; background: rgba(15,139,109,0.1); padding: 2px 8px; border-radius: 12px; display: inline-block; vertical-align: middle; margin-left: 8px;">ID #${patient.id}</span>`;
  const subParts = [
    patient.age    ? `${patient.age} yrs`    : '',
    patient.gender || '',
    patient.blood_group || '',
  ].filter(Boolean);
  document.getElementById('panel-sub').textContent   = subParts.join(' · ') || '—';
  if (document.getElementById('panel-phone')) document.getElementById('panel-phone').textContent = patient.whatsapp_number || '—';

  // Render initial details
  renderPanelDetails(patient, false);

  // Wire Edit Patient toggle button
  const editToggle = document.getElementById('btn-edit-patient-trigger');
  if (editToggle) {
    const newToggle = editToggle.cloneNode(true);
    editToggle.parentNode.replaceChild(newToggle, editToggle);
    newToggle.addEventListener('click', () => {
      toggleEditPatientForm();
    });
  }

  // Wire Edit Visit toggle button
  const editToggleVisit = document.getElementById('btn-edit-patient-toggle');
  if (editToggleVisit) {
    const newToggle = editToggleVisit.cloneNode(true);
    editToggleVisit.parentNode.replaceChild(newToggle, editToggleVisit);
    newToggle.addEventListener('click', () => {
      const editForm = document.getElementById('edit-patient-form');
      const isVisible = editForm && editForm.style.display !== 'none' && editForm.classList.contains('visible');
      renderPanelDetails(patient, !isVisible);
    });
  }

  // Wire Repeat Last Visit button (replaced Update Patient button in header)
  const repeatTrigger = document.getElementById('btn-repeat-last-visit');
  if (repeatTrigger) {
    const newRepeatTrigger = repeatTrigger.cloneNode(true);
    repeatTrigger.parentNode.replaceChild(newRepeatTrigger, repeatTrigger);
    newRepeatTrigger.addEventListener('click', () => {
      handleRepeatLastVisitHeader();
    });
  }

  renderVisitTimeline(visits);

  // Merge latest visit details for WhatsApp share card
  const patientForWhatsApp = {
    ...patient,
    symptoms: visits[0]?.symptoms || '',
    pulse_rate: visits[0]?.pulse_rate || '',
    blood_pressure: visits[0]?.blood_pressure || '',
    temperature: visits[0]?.temperature || '',
    oxygen_level: visits[0]?.oxygen_level || '',
    defect_image: visits[0]?.defected_area_image || '',
    defect_image_2: visits[0]?.defected_area_image_2 || '',
    defect_image_3: visits[0]?.defected_area_image_3 || '',
    medicines: visits[0]?.medicines || '',
    final_amount: visits[0]?.final_amount,
    payment_status: visits[0]?.payment_status || ''
  };

  // Wire WhatsApp send button
  const waBtn = document.getElementById('btn-send-patient-whatsapp');
  if (waBtn) {
    const newWaBtn = waBtn.cloneNode(true);
    waBtn.parentNode.replaceChild(newWaBtn, waBtn);
    newWaBtn.addEventListener('click', () => sendPatientCardToWhatsApp(patientForWhatsApp, 'whatsapp'));
  }

  // Wire manual copy buttons
  const copyClinicalBtn = document.getElementById('btn-patient-details-action');
  if (copyClinicalBtn) {
    const newBtn = copyClinicalBtn.cloneNode(true);
    copyClinicalBtn.parentNode.replaceChild(newBtn, copyClinicalBtn);
    newBtn.addEventListener('click', () => sendPatientCardToWhatsApp(patientForWhatsApp, 'clinical'));
  }

  const copyPrescriptionBtn = document.getElementById('btn-copy-prescription');
  if (copyPrescriptionBtn) {
    const newBtn = copyPrescriptionBtn.cloneNode(true);
    copyPrescriptionBtn.parentNode.replaceChild(newBtn, copyPrescriptionBtn);
    newBtn.addEventListener('click', () => sendPatientCardToWhatsApp(patientForWhatsApp, 'prescription'));
  }
}

function waitForImages(container) {
  const imgs = container.querySelectorAll('img');
  const promises = Array.from(imgs).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });
  return Promise.all(promises);
}

async function sendPatientCardToWhatsApp(patientData, mode = 'whatsapp', visitId = null) {
  // Merge the correct visit data into a localized patient object
  let patient = { ...patientData };
  let visit = null;
  if (visitId && window._currentVisits) {
    visit = window._currentVisits.find(v => v.id === visitId) || window._currentVisits[0] || {};
  } else {
    visit = (window._currentVisits && window._currentVisits[0]) || {};
  }

  // Populate patient with the chosen visit data so the card renders correctly
  patient.pulse_rate = patient.pulse_rate || visit.pulse_rate;
  patient.blood_pressure = patient.blood_pressure || visit.blood_pressure;
  patient.temperature = patient.temperature || visit.temperature;
  patient.oxygen_level = patient.oxygen_level || visit.oxygen_level;
  patient.defect_image = patient.defect_image || visit.defected_area_image;
  patient.defect_image_2 = patient.defect_image_2 || visit.defected_area_image_2;
  patient.defect_image_3 = patient.defect_image_3 || visit.defected_area_image_3;
  patient.medicines = patient.medicines || visit.medicines;
  patient.symptoms = patient.symptoms || visit.symptoms;
  
  patient.consultation_fee = (patient.consultation_fee !== undefined && patient.consultation_fee !== null) ? patient.consultation_fee : (visit.consultation_fee || 0);
  patient.medicine_price = (patient.medicine_price !== undefined && patient.medicine_price !== null) ? patient.medicine_price : (visit.medicine_price || 0);
  patient.discount = (patient.discount !== undefined && patient.discount !== null) ? patient.discount : (visit.discount || 0);
  patient.final_amount = (patient.final_amount !== undefined && patient.final_amount !== null) ? patient.final_amount : ((patient.total_amount !== undefined && patient.total_amount !== null) ? patient.total_amount : ((visit.final_amount !== undefined && visit.final_amount !== null) ? visit.final_amount : (visit.total_amount || 0)));
  patient.payment_status = patient.payment_status || visit.payment_status || 'Paid';
  let btnId = 'btn-send-patient-whatsapp';
  if (mode === 'clinical') btnId = 'btn-copy-clinical';
  else if (mode === 'prescription') btnId = 'btn-copy-prescription';
  else if (mode === 'billing') btnId = 'btn-copy-billing'; // dummy id

  const btn = document.getElementById(btnId) || document.getElementById('btn-share-whatsapp');
  let originalHtml = '';
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Generating…';
  }

  try {
    const rawPhone = (patient.whatsapp_number || '').replace(/[\s\-\(\)\+]/g, '');
    let waPhone = rawPhone;
    if (waPhone.startsWith('03')) waPhone = '92' + waPhone.substring(1);
    else if (waPhone.startsWith('3')) waPhone = '92' + waPhone;

    const guardianText = formatGuardianRelationship(patient);
    let name = (patient.first_name || patient.name || '').trim();
    if (guardianText) {
      name += ' ' + guardianText;
    }
    
    let defImg = '';
    if (patient.defect_image || patient.defect_image_2 || patient.defect_image_3) {
      defImg += `<div style="margin-top:12px;"><div style="font-weight:700;color:#128C7E;margin-bottom:6px;">Affected Area Photos</div><div style="display:flex;gap:8px;">`;
      if (patient.defect_image && (patient.defect_image.startsWith('data:') || patient.defect_image.startsWith('/uploads/'))) {
        defImg += `<img src="${patient.defect_image}" style="width:32%;object-fit:cover;border-radius:8px;border:2px solid #e2e8f0;" />`;
      }
      if (patient.defect_image_2 && (patient.defect_image_2.startsWith('data:') || patient.defect_image_2.startsWith('/uploads/'))) {
        defImg += `<img src="${patient.defect_image_2}" style="width:32%;object-fit:cover;border-radius:8px;border:2px solid #e2e8f0;" />`;
      }
      if (patient.defect_image_3 && (patient.defect_image_3.startsWith('data:') || patient.defect_image_3.startsWith('/uploads/'))) {
        defImg += `<img src="${patient.defect_image_3}" style="width:32%;object-fit:cover;border-radius:8px;border:2px solid #e2e8f0;" />`;
      }
      defImg += `</div></div>`;
    }

    const o2Val = patient.oxygen_level;

    // Database financial values
    const consultationFee = patient.consultation_fee;
    const medicinePrice = patient.medicine_price;
    const discountAmount = patient.discount;
    const totalPrice = patient.final_amount;
    const payStatus = patient.payment_status;

    let billingBlock = '';
    if (mode !== 'clinical') {
      billingBlock = `
      <!-- BOTTOM CARD: BILLING SUMMARY (Row 1: Consulting Fee / Medicine Fee, Row 2: Discount Centered, Row 3: Total Price / Status) -->
      <div style="background:white;border-radius:12px;padding:16px 20px;margin-bottom:12px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
        <div style="font-weight:800;color:#286848;margin-bottom:12px;font-size:13px;text-transform:uppercase;letter-spacing:.5px;text-align:center;border-bottom:1.5px solid #f1f5f9;padding-bottom:6px;">💳 BILLING SUMMARY</div>
        
        <!-- Row 1: Consulting Fee (Left) | Medicine Fee (Right) -->
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:10px;">
          <div><span style="color:#64748b;">Consulting Fee: </span><b style="color:#1e293b;">Rs. ${Number(consultationFee).toLocaleString()}</b></div>
          <div style="text-align:right;"><span style="color:#64748b;">Medicine Fee: </span><b style="color:#1e293b;">Rs. ${Number(medicinePrice).toLocaleString()}</b></div>
        </div>

        <!-- Row 2: Discount (Centered) -->
        <div style="text-align:center;font-size:13px;margin-bottom:10px;background:#f8fafc;padding:6px 12px;border-radius:8px;border:1px dashed #cbd5e1;">
          <span style="color:#64748b;">Discount: </span><b style="color:#059669;">Rs. ${Number(discountAmount).toLocaleString()}</b>
        </div>

        <!-- Row 3: Total Price (Left) | Status (Right) -->
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding-top:4px;">
          <div><span style="color:#64748b;">Total Price: </span><b style="color:#1b4a32;font-size:15px;">Rs. ${Number(totalPrice).toLocaleString()}</b></div>
          <div style="text-align:right;"><span style="color:#64748b;">Status: </span><b style="color:${payStatus === 'Unpaid' ? '#ef4444' : '#10b981'};font-size:14px;">${esc(payStatus)}</b></div>
        </div>
      </div>
      `;
    }

    let card1Html = '';
    if (mode === 'billing') {
      // Dedicated Billing Card Layout
      card1Html = `
      <div id="wa-card-capture" style="font-family:'Inter','Gulzar','Segoe UI',Arial,sans-serif;background:#f8faff;border-radius:16px;padding:24px;width:480px;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        <!-- HEADER -->
        <div style="background:linear-gradient(135deg, #1b4a32, #2d6a4f); border-radius:12px; padding:18px 20px; text-align:center; color:white; margin-bottom:20px; box-shadow: 0 4px 15px rgba(27, 74, 50, 0.2);">
          <div style="font-size:22px; font-weight:900; letter-spacing:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(CLINIC_NAME)}</div>
        </div>
        <!-- PATIENT INFO -->
        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px; margin-bottom:18px; text-align:center;">
          <div style="font-size:22px; font-weight:800; color:#1b4a32; margin-bottom:8px;">${esc(name)}</div>
          <div style="display:flex; justify-content:center; gap:20px; font-size:14px; color:#475569; font-weight:500;">
            <div><span style="color:#25D366; margin-right:4px;">📱</span>${esc(patient.whatsapp_number || '—')}</div>
            <div><span style="color:#64748b; margin-right:4px;">🆔</span>${esc(patient.ire_id || patient.reg_id || '#' + patient.id)}</div>
          </div>
        </div>
        <!-- VISIT INFO -->
        <div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:12px;border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
            <div><span style="color:#64748b;">Visit Date: </span><b style="color:#1b4a32;">${visit && visit.visit_date ? formatDate(visit.visit_date) : formatDate(new Date())}</b></div>
            <div><span style="color:#64748b;">Visit ID: </span><b style="color:#1b4a32;">${visitId ? '#' + visitId : 'Latest'}</b></div>
          </div>
        </div>
        ${billingBlock}
        <!-- FOOTER -->
        <div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;font-weight:600;">
          ${esc(CLINIC_NAME)}
        </div>
      </div>`;
    } else {
      // General Clinical Card Layout
      card1Html = `
      <div id="wa-card-capture" style="font-family:'Inter','Gulzar','Segoe UI',Arial,sans-serif;background:#f8faff;border-radius:16px;padding:24px;width:480px;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
        <!-- HEADER -->
        <div style="background:linear-gradient(135deg, #1b4a32, #2d6a4f); border-radius:12px; padding:18px 20px; text-align:center; color:white; margin-bottom:20px; box-shadow: 0 4px 15px rgba(27, 74, 50, 0.2);">
          <div style="font-size:22px; font-weight:900; letter-spacing:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(CLINIC_NAME)}</div>
        </div>
        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px; margin-bottom:18px; text-align:center;">
          <div style="font-size:22px; font-weight:800; color:#1b4a32; margin-bottom:8px;">${esc(name)}</div>
          <div style="display:flex; justify-content:center; gap:20px; font-size:14px; color:#475569; font-weight:500;">
            <div><span style="color:#25D366; margin-right:4px;">📱</span>${esc(patient.whatsapp_number || '—')}</div>
            <div><span style="color:#64748b; margin-right:4px;">🆔</span>${esc(patient.ire_id || patient.reg_id || '#' + patient.id)}</div>
          </div>
        </div>
        <div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:12px;border:1px solid #e2e8f0;">
          <div style="font-weight:800;color:#286848;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">📋 Registration</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;">
            <div><span style="color:#64748b;">IRN / IRE ID: </span><b style="color:#1b4a32;">${esc(patient.ire_id || patient.reg_id || '—')}</b></div>
            <div><span style="color:#64748b;">Reg Date: </span><b>${formatDate(patient.registration_date || patient.created_at)}</b></div>
          </div>
        </div>
        <div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:12px;border:1px solid #e2e8f0;">
          <div style="font-weight:800;color:#286848;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">👤 Personal & Contact Details</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;">
            <div><span style="color:#64748b;">Gender: </span><b>${patient.gender === 'Female' ? '♀ ' : (patient.gender === 'Male' ? '♂ ' : '')}${esc(patient.gender || '—')}</b></div>
            <div><span style="color:#64748b;">Age: </span><b>${patient.age ? patient.age + ' yrs' : '—'}</b></div>
            <div><span style="color:#64748b;">Blood Group: </span><b>${esc(patient.blood_group || '—')}</b></div>
            <div><span style="color:#64748b;">Weight: </span><b>${patient.weight ? patient.weight + ' kg' : '—'}</b></div>
            <div><span style="color:#64748b;">DOB: </span><b>${patient.date_of_birth ? formatDate(patient.date_of_birth) : '—'}</b></div>
            <div><span style="color:#64748b;">WhatsApp: </span><b>${esc(patient.whatsapp_number || '—')}</b></div>
            <div><span style="color:#64748b;">Area: </span><b>${esc(patient.city || patient.address || '—')}</b></div>
          </div>
          ${patient.address ? `<div style="margin-top:6px;font-size:13px;"><span style="color:#64748b;">Address: </span><b>${esc(patient.address)}</b></div>` : ''}
        </div>
        <div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:12px;border:1px solid #e2e8f0;">
          <div style="font-weight:800;color:#286848;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">🩺 Clinical Details</div>
          <div style="font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
            <div><span style="color:#64748b;">Pulse Rate: </span><b>${patient.pulse_rate ? patient.pulse_rate + '/m' : '—'}</b></div>
            <div><span style="color:#64748b;">Temperature: </span><b>${patient.temperature ? patient.temperature + ' °F' : '—'}</b></div>
            <div><span style="color:#64748b;">Blood Pressure: </span><b>${esc(patient.blood_pressure || '—')}</b></div>
            <div><span style="color:#64748b;">Oxygen Level: </span><b>${o2Val ? o2Val + '%' : '—'}</b></div>
          </div>
          <div style="font-size:13px;border-top:1px solid #f1f5f9;padding-top:6px;margin-top:6px;">
            ${patient.symptoms ? `<div style="margin-bottom:4px;"><span style="color:#64748b;">Symptoms &amp; Family Medical History: </span><b>${esc(patient.symptoms)}</b></div>` : ''}
            ${patient.medical_history && patient.medical_history !== patient.symptoms ? `<div><span style="color:#64748b;">Family History: </span><b>${esc(patient.medical_history)}</b></div>` : ''}
          </div>
          ${defImg}
        </div>
        ${billingBlock}
        <!-- FOOTER: Removed Time -->
        <div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;font-weight:600;">
          ${esc(CLINIC_NAME)}
        </div>
      </div>`;
    }

    let formattedMedsHtml = '';
    if (patient.medicines) {
      try {
        const parsed = JSON.parse(patient.medicines);
        if (Array.isArray(parsed) && parsed.length > 0) {
          formattedMedsHtml = parsed.map((m, idx) => `
            <div style="margin-bottom:8px; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">
              <b>${idx + 1}. ${esc(m.name)}</b><br/>
              <span style="font-size:12px; color:#64748b;">Potency: <b>${esc(m.dosage || '—')}</b> | Dosage: <b>${esc(m.frequency || '—')}</b> | Duration: <b>${esc(m.duration || '—')}</b></span>
            </div>`).join('');
        } else {
          formattedMedsHtml = `<div style="white-space:pre-wrap;">${esc(patient.medicines)}</div>`;
        }
      } catch { formattedMedsHtml = `<div style="white-space:pre-wrap;">${esc(patient.medicines)}</div>`; }
    } else { formattedMedsHtml = '<div style="color:#94a3b8; font-style:italic;">No medicines prescribed.</div>'; }

    const clinicAreaVal = patient.city || patient.address || CLINIC_AREA;
    const clinicWaVal = patient.whatsapp_number || CLINIC_WHATSAPP;

    const card2Html = `
    <div id="wa-card-capture-meds" style="font-family:'Inter','Gulzar','Segoe UI',Arial,sans-serif;background:#f8faff;border-radius:16px;padding:24px;width:480px;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <!-- PRESCRIPTION HEADER: Clinic Name (One line) + Area + Clinic WhatsApp Number -->
      <div style="background:linear-gradient(135deg, #1b4a32, #2d6a4f); border-radius:12px; padding:18px 20px; text-align:center; color:white; margin-bottom:20px; box-shadow: 0 4px 15px rgba(27, 74, 50, 0.2);">
        <div style="font-size:22px; font-weight:900; letter-spacing:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px;">${esc(CLINIC_NAME)}</div>
        <div style="display:flex; justify-content:center; gap:16px; font-size:12px; opacity:0.95; font-weight:600;">
          <div>📍 Area: <b>${esc(clinicAreaVal)}</b></div>
          <div>📱 WhatsApp: <b>${esc(clinicWaVal)}</b></div>
        </div>
      </div>
      <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px; margin-bottom:18px; text-align:center;">
        <div style="font-size:22px; font-weight:800; color:#1b4a32; margin-bottom:8px;">${esc(name)}</div>
        <div style="display:flex; justify-content:center; gap:16px; font-size:14px; color:#475569; font-weight:500;">
          <div><span style="color:#25D366; margin-right:4px;">📱</span>${esc(patient.whatsapp_number || '—')}</div>
          <div><span style="color:#64748b; margin-right:4px;">🆔</span>${esc(patient.ire_id || patient.reg_id || '#' + patient.id)}</div>
          <div><span style="color:#64748b; margin-right:4px;">📅</span>${formatDate(patient.registration_date || patient.created_at)}</div>
        </div>
      </div>
      <div style="background:white;border-radius:10px;padding:14px 16px;margin-bottom:12px;border:1px solid #e2e8f0;">
        <div style="font-weight:800;color:#286848;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.5px;">💊 Prescribed Medicines</div>
        <div style="font-size:13px;color:#1e293b;">${formattedMedsHtml}</div>
      </div>
      <!-- PRESCRIPTION FOOTER: Removed Time -->
      <div style="text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;font-weight:600;">
        ${esc(CLINIC_NAME)}
      </div>
    </div>`;

    let container = document.getElementById('wa-card-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'wa-card-container';
      container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;z-index:-1;';
      document.body.appendChild(container);
    }
    container.innerHTML = card1Html + card2Html;

    // Wait for photos to fully load in the DOM
    await waitForImages(container);

    const cardEl1 = document.getElementById('wa-card-capture');
    const cardEl2 = document.getElementById('wa-card-capture-meds');

    await new Promise(r => setTimeout(r, 50));
    const canvas1 = await html2canvas(cardEl1, { scale: 2, useCORS: true, backgroundColor: '#f8faff' });
    const dataUrl1 = canvas1.toDataURL('image/png');

    await new Promise(r => setTimeout(r, 50));
    const canvas2 = await html2canvas(cardEl2, { scale: 2, useCORS: true, backgroundColor: '#f8faff' });
    const dataUrl2 = canvas2.toDataURL('image/png');
    
    if (mode === 'whatsapp') {
      let copied = false;
      if (window.electronAPI && window.electronAPI.copyImageToClipboard) {
        copied = await window.electronAPI.copyImageToClipboard(dataUrl1); // Copy Clinical Card
      }
      
      if (copied) {
        showToast('success', '✅ Copied to Clipboard!', 'Clinical details card copied. Paste in WhatsApp (Ctrl+V).');
      } else {
        // Fallback: download
        const a1 = document.createElement('a');
        a1.href = canvas1.toDataURL('image/jpeg', 0.92);
        a1.download = `patient_${patient.id || 'new'}_clinical.jpg`;
        a1.click();
        showToast('success', '✅ Downloaded Card', 'Pasting was unavailable, so clinical card was downloaded.');
      }

      // Open WhatsApp
      setTimeout(() => {
        const waUrl = waPhone.match(/^92\d{10}$/) ? `https://wa.me/${waPhone}` : 'https://web.whatsapp.com';
        if (window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal(waUrl);
        } else {
          window.open(waUrl, '_blank');
        }
      }, 500);

    } else if (mode === 'clinical' || mode === 'billing') {
      let copied = false;
      if (window.electronAPI && window.electronAPI.copyImageToClipboard) {
        copied = await window.electronAPI.copyImageToClipboard(dataUrl1);
      }
      if (!copied && navigator.clipboard && navigator.clipboard.write) {
        try {
          const blob = await new Promise(res => canvas1.toBlob(res, 'image/png'));
          if (blob) {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            copied = true;
          }
        } catch(e) { console.warn('Clipboard write fallback failed:', e); }
      }
      const label = mode === 'billing' ? 'Billing Card' : 'Clinical Card';
      if (copied) {
        showToast('success', `✅ Copied ${label}`, `${label} copied to clipboard.`);
      } else {
        const a1 = document.createElement('a');
        a1.href = canvas1.toDataURL('image/jpeg', 0.92);
        a1.download = `patient_${patient.id || 'new'}_${mode}.jpg`;
        a1.click();
        showToast('success', `✅ Downloaded ${label}`, `${label} downloaded.`);
      }
    } else if (mode === 'prescription') {
      let copied = false;
      if (window.electronAPI && window.electronAPI.copyImageToClipboard) {
        copied = await window.electronAPI.copyImageToClipboard(dataUrl2);
      }
      if (!copied && navigator.clipboard && navigator.clipboard.write) {
        try {
          const blob = await new Promise(res => canvas2.toBlob(res, 'image/png'));
          if (blob) {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            copied = true;
          }
        } catch(e) { console.warn('Clipboard write fallback failed:', e); }
      }
      if (copied) {
        showToast('success', '✅ Copied Prescription Card', 'Prescription Card copied to clipboard.');
      } else {
        const a2 = document.createElement('a');
        a2.href = canvas2.toDataURL('image/jpeg', 0.92);
        a2.download = `patient_${patient.id || 'new'}_prescription.jpg`;
        a2.click();
        showToast('success', '✅ Downloaded Prescription Card', 'Prescription card downloaded.');
      }
    }

  } catch (err) {
    console.error('Card Generation Error:', err);
    showToast('error', 'Failed to Generate Card', (err && err.message) ? err.message : String(err));
  } finally {
    const container = document.getElementById('wa-card-container');
    if (container) container.innerHTML = '';
    
    if (btn) {
      btn.disabled = false;
      if (originalHtml) {
        btn.innerHTML = originalHtml;
      } else {
        btn.textContent = mode === 'clinical' ? '📋 Copy Clinical' : (mode === 'prescription' ? '💊 Copy Prescription' : 'Share on WhatsApp');
      }
    }
  }
}


function renderPanelDetails(patient, editMode = false) {
  const editForm = document.getElementById('edit-patient-form');
  const details = document.getElementById('panel-detail-grid');
  const addForm = document.getElementById('add-visit-form');
  const editToggleBtn = document.getElementById('btn-edit-patient-toggle');
  
  if (!editMode) {
    if (editForm) { editForm.classList.remove('visible'); editForm.style.display = 'none'; }
    if (addForm) { addForm.classList.remove('visible'); addForm.style.display = 'none'; }
    if (editToggleBtn) {
      editToggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Patient`;
      editToggleBtn.style.background = 'linear-gradient(135deg, #0F8B6D, #10b981)';
    }

    // Populate the read-only Patient Details card
    const grid = document.getElementById('panel-detail-grid');
    if (grid) {
      grid.style.display = 'grid';
      const visits = window._currentVisits || [];
      const latestVisit = visits[0] || null;

      // Payment info — from the most recent visit record
      const feeAmount = latestVisit
        ? ((latestVisit.final_amount !== null && latestVisit.final_amount !== undefined)
            ? latestVisit.final_amount
            : (latestVisit.total_amount || latestVisit.consultation_fee || 0))
        : null;
      const payStatus = latestVisit ? (latestVisit.payment_status || 'Paid') : null;
      const payMethod = latestVisit ? (latestVisit.payment_method || '') : null;
      const amtReceived = latestVisit ? (latestVisit.amount_received || 0) : null;
      const remaining = latestVisit ? (latestVisit.remaining_balance || 0) : null;
      const visitDate = latestVisit ? formatDate(latestVisit.visit_date) : null;

      const isPaid = payStatus === 'Paid';
      const payColor = isPaid ? '#10b981' : '#ef4444';
      const payBg = isPaid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)';
      const payBorder = isPaid ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)';

      const detailRow = (label, value, bold = false) =>
        value ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:12px;font-weight:600;color:#64748b;">${label}</span>
          <span style="font-size:13px;font-weight:${bold?'700':'600'};color:#1e293b;">${value}</span>
        </div>` : '';

      grid.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:stretch; width:100%;">

          <!-- Patient Information Card (Left) -->
          <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:16px 18px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
            <div>
              <div style="font-size:11.5px; font-weight:800; color:#0F8B6D; text-transform:uppercase; letter-spacing:.8px; margin-bottom:12px; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span>👤 Patient Information</span>
              </div>
              ${detailRow('IRE ID', esc(patient.ire_id || '—'), true)}
              ${detailRow('Reg. Date', formatDate(patient.registration_date || patient.created_at))}
              ${detailRow('Age', patient.age ? patient.age + ' yrs' : null)}
              ${detailRow('Gender', esc(patient.gender || '—'), true)}
              ${detailRow('Blood Group', esc(patient.blood_group || null))}
              ${detailRow('Weight', patient.weight ? patient.weight + ' kg' : null)}
              ${detailRow('WhatsApp', esc(patient.whatsapp_number || null))}
              ${detailRow('Area', esc(patient.city || null))}
            </div>
          </div>

          <!-- Latest Visit Payment Card (Right) -->
          ${latestVisit ? `
          <div style="background:${payBg}; border:1.5px solid ${payBorder}; border-radius:14px; padding:16px 18px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 2px 10px rgba(0,0,0,0.02);">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1.5px solid ${payBorder}; padding-bottom:8px;">
                <div style="font-size:11.5px; font-weight:800; color:#0F8B6D; text-transform:uppercase; letter-spacing:.8px;">💳 Latest Visit Payment</div>
                <span style="font-size:11px; font-weight:800; color:${payColor}; background:#ffffff; border:1px solid ${payBorder}; border-radius:20px; padding:2px 10px;">${esc(payStatus)}</span>
              </div>
              ${visitDate ? `<div style="font-size:11.5px; font-weight:600; color:#64748b; margin-bottom:12px;">Visit date: <b style="color:#1e293b;">${visitDate}</b></div>` : ''}
              <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                <div style="flex:1; min-width:90px; background:#ffffff; border-radius:10px; padding:10px 12px; border:1px solid #e2e8f0; text-align:center;">
                  <div style="font-size:10.5px; color:#64748b; font-weight:700; margin-bottom:4px; text-transform:uppercase;">Amount</div>
                  <div style="font-size:16px; font-weight:900; color:#0F8B6D;">Rs. ${Number(feeAmount).toLocaleString()}</div>
                </div>
                ${amtReceived > 0 ? `<div style="flex:1; min-width:90px; background:#ffffff; border-radius:10px; padding:10px 12px; border:1px solid #e2e8f0; text-align:center;">
                  <div style="font-size:10.5px; color:#64748b; font-weight:700; margin-bottom:4px; text-transform:uppercase;">Received</div>
                  <div style="font-size:16px; font-weight:900; color:#10b981;">Rs. ${Number(amtReceived).toLocaleString()}</div>
                </div>` : ''}
                ${remaining > 0 ? `<div style="flex:1; min-width:90px; background:#ffffff; border-radius:10px; padding:10px 12px; border:1.5px solid #fca5a5; text-align:center;">
                  <div style="font-size:10.5px; color:#ef4444; font-weight:700; margin-bottom:4px; text-transform:uppercase;">Balance Due</div>
                  <div style="font-size:16px; font-weight:900; color:#ef4444;">Rs. ${Number(remaining).toLocaleString()}</div>
                </div>` : ''}
              </div>
            </div>
            ${payMethod ? `<div style="font-size:12px; color:#64748b; border-top:1px solid ${payBorder}; padding-top:8px;">Payment method: <b style="color:#1e293b;">${esc(payMethod)}</b></div>` : ''}
          </div>` : `
          <div style="background:#ffffff; border:1.5px dashed #cbd5e1; border-radius:14px; padding:16px 18px; text-align:center; color:#64748b; font-size:13px; display:flex; align-items:center; justify-content:center; box-sizing:border-box;">
            No visits recorded yet. Payment info will appear after first visit.
          </div>`}

        </div>`;
    }
  } else {
    // Toggle Edit Mode
    if (addForm) addForm.classList.remove('visible');
    if (editForm) {
      editForm.style.display = 'block';
      editForm.classList.add('visible');
      editForm.scrollIntoView({ behavior: 'smooth' });
      
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      
      // Populate patient details
      setVal('ep-first-name', patient.first_name || patient.name);
      setVal('ep-guardian-name', patient.guardian_name);
      setVal('ep-guardian-relationship', patient.guardian_relationship || 'Father');
      setVal('ep-dob', patient.date_of_birth);
      setVal('ep-age', patient.age);
      setVal('ep-blood', patient.blood_group);
      setVal('ep-weight', patient.weight);
      setVal('ep-whatsapp', patient.whatsapp_number);
      setVal('ep-city', patient.city);
      setVal('ep-address', patient.address);
      setVal('ep-medical-history', patient.medical_history);
      setVal('ep-ire-id', patient.ire_id);
      if (patient.gender) {
        const radio = document.querySelector(`input[name="ep-gender"][value="${patient.gender}"]`);
        if (radio) radio.checked = true;
      }
      if (patient.gender) {
        const radio = document.querySelector(`input[name="ep-gender"][value="${patient.gender}"]`);
        if (radio) radio.checked = true;
      }
      
      // Get latest visit
      const latestVisit = (window._currentVisits || [])[0];
      if (latestVisit) {
        window._currentLatestVisitId = latestVisit.id;
        setVal('ep-registration-date', latestVisit.visit_date);
        setVal('ep-symptoms', latestVisit.symptoms);
        setVal('ep-pulse-rate', latestVisit.pulse_rate);
        setVal('ep-blood-pressure', latestVisit.blood_pressure);
        setVal('ep-temperature', latestVisit.temperature);
        setVal('ep-oxygen-level', latestVisit.oxygen_level);
        setVal('ep-notes', latestVisit.notes);
        
        setVal('ep-consultation-fee', latestVisit.consultation_fee);
        setVal('ep-medicine-price', latestVisit.medicine_price);
        setVal('ep-total-amount', latestVisit.total_amount);
        setVal('ep-discount', latestVisit.discount);
        setVal('ep-final-amount', latestVisit.final_amount);
        setVal('ep-amount-received', latestVisit.amount_received);
        setVal('ep-remaining-balance', latestVisit.remaining_balance);
        setVal('ep-payment-status', latestVisit.payment_status);
        setVal('ep-payment-method', latestVisit.payment_method);
        
        // Populate medicines textarea
        const epMedsTextarea = document.getElementById('ep-medicines-text');
        if (epMedsTextarea) {
          if (typeof deserializeMedicines === 'function') {
            epMedsTextarea.value = deserializeMedicines(latestVisit.medicines);
          } else {
            epMedsTextarea.value = latestVisit.medicines || '';
          }
        }
      } else {
        window._currentLatestVisitId = null;
      }
    }
  }
}


/* ════════════════════════════════════════════════════════════════════════════
   PATIENT EDIT — SAVE HANDLER
════════════════════════════════════════════════════════════════════════════ */

function renderVisitTimeline(visits) {
  const timeline = document.getElementById('visit-timeline');
  if (!timeline) return;

  if (!visits || visits.length === 0) {
    timeline.innerHTML = `
      <div class="empty-timeline">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="margin-bottom:8px; opacity:0.5;">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h4>No Visit Records Yet</h4>
        <p>Click "Add Visit" to record the first consultation.</p>
      </div>`;
    return;
  }

  timeline.innerHTML = '';
  visits.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = `visit-card ${i === 0 ? 'recent' : ''}`;
    card.style.animationDelay = `${i * 55}ms`;

    const vitals = [];
    if (v.pulse_rate)      vitals.push(`<span class="vital-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tag-icon" width="11" height="11"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>${v.pulse_rate} bpm</span>`);
    if (v.blood_pressure)  vitals.push(`<span class="vital-tag">BP: ${esc(v.blood_pressure)}</span>`);
    if (v.temperature)     vitals.push(`<span class="vital-tag">🌡 ${v.temperature}°F</span>`);
    if (v.oxygen_level)    vitals.push(`<span class="vital-tag">SpO₂: ${v.oxygen_level}%</span>`);
    if (v.weight || (i === 0 && window._currentPatientData && window._currentPatientData.weight)) {
      const wVal = v.weight || window._currentPatientData.weight;
      vitals.push(`<span class="vital-tag">Weight: ${wVal} kg</span>`);
    }

    let formattedMedsHtml = '';
    if (v.medicines) {
      try {
        const parsed = JSON.parse(v.medicines);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const medTextLines = parsed.map((m, idx) => {
            const parts = [m.name ? esc(m.name) : ''];
            if (m.dosage) parts.push(`Potency: ${esc(m.dosage)}`);
            if (m.frequency) parts.push(`Dosage: ${esc(m.frequency)}`);
            if (m.duration) parts.push(`Duration: ${esc(m.duration)}`);
            return `${idx + 1}. ${parts.join(' | ')}`;
          }).join('\n');
          const isMedsUrdu = isUrduText(medTextLines);
          const medsFontStyle = isMedsUrdu ? "font-family: 'Gulzar', serif; direction: rtl; font-size: 15px; text-align: right;" : "font-size: 13.5px;";

          formattedMedsHtml = `
            <div class="visit-field" style="margin-top:12px;">
              <div class="visit-field-label" style="color:#0F8B6D; font-weight:700; font-size:12px; display:flex; align-items:center; gap:6px; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
                Prescribed Medicines
              </div>
              <div class="visit-field-value" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.6; ${medsFontStyle}">
                ${medTextLines}
              </div>
            </div>`;
        } else if (v.medicines.trim()) {
          const isMedsUrdu = isUrduText(v.medicines);
          const medsFontStyle = isMedsUrdu ? "font-family: 'Gulzar', serif; direction: rtl; font-size: 15px; text-align: right;" : "font-size: 13.5px;";
          formattedMedsHtml = `
            <div class="visit-field" style="margin-top:12px;">
              <div class="visit-field-label" style="color:#0F8B6D; font-weight:700; font-size:12px; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Prescribed Medicines</div>
              <div class="visit-field-value" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.6; ${medsFontStyle}">${esc(v.medicines)}</div>
            </div>`;
        }
      } catch {
        const isMedsUrdu = isUrduText(v.medicines);
        const medsFontStyle = isMedsUrdu ? "font-family: 'Gulzar', serif; direction: rtl; font-size: 15px; text-align: right;" : "font-size: 13.5px;";
        formattedMedsHtml = `
          <div class="visit-field" style="margin-top:12px;">
            <div class="visit-field-label" style="color:#0F8B6D; font-weight:700; font-size:12px; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">Prescribed Medicines</div>
            <div class="visit-field-value" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.6; ${medsFontStyle}">${esc(v.medicines)}</div>
          </div>`;
      }
    } else if (v.prescription) {
      formattedMedsHtml = `<div style="margin-top:10px; font-size:13px; font-weight:600; color:#1e293b;">${esc(v.prescription)}</div>`;
    }

    const symFont = v.symptoms && isUrduText(v.symptoms) ? "font-family: 'Gulzar', serif; direction: rtl; font-size: 15px; white-space: pre-wrap;" : "white-space: pre-wrap;";

    const feeAmount = (v.final_amount !== null && v.final_amount !== undefined) ? v.final_amount : (v.total_amount || v.consultation_fee || 0);
    const payStatus = v.payment_status || 'Paid';
    const isPaid = payStatus === 'Paid';
    const payColor = isPaid ? '#10b981' : '#ef4444';
    const payBg = isPaid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';
    const payBorder = isPaid ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)';

    card.innerHTML = `
      <div class="visit-card-header" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:10px; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="visit-badge" style="background:#0F8B6D; color:white; font-weight:800; padding:3px 10px; border-radius:12px; font-size:12px;">Visit #${visits.length - i}</span>
          <div class="visit-date" style="font-weight:700; color:#1e293b; font-size:14px;">📅 ${formatDate(v.visit_date)}</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:11.5px; font-weight:700; color:${payColor}; background:${payBg}; border:1px solid ${payBorder}; border-radius:20px; padding:2px 10px;">${esc(payStatus)}</span>
          <button onclick="toggleEditVisitForm(${v.id})" title="Edit Visit" style="background:transparent; border:none; color:#0F8B6D; cursor:pointer; padding:4px; display:flex; align-items:center; justify-content:center; border-radius:4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button onclick="deleteVisit(${v.id})" title="Delete Visit" style="background:transparent; border:none; color:#ef4444; cursor:pointer; padding:4px; display:flex; align-items:center; justify-content:center; border-radius:4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      <!-- Visit Action Bar: Clinical Pad & Prescription Tools -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 12px; margin-bottom:10px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span style="font-size:11px; font-weight:800; color:#475569; margin-right:4px; text-transform:uppercase; letter-spacing:0.5px;">📋 Actions:</span>
        <button onclick="openClinicalPadModal(${v.id})" style="background:#0F8B6D; color:white; border:none; border-radius:6px; padding:4px 12px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="View Clinical Pad">
          📝 PAD
        </button>

        <button onclick="sendPatientCardToWhatsApp(window._currentPatientData, 'billing', ${v.id})" style="background:#d97706; color:white; border:none; border-radius:6px; padding:4px 12px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="Copy/Export Visit Billing">
          💳 BILLING
        </button>
        <button onclick="printVisitPrescription(${v.id})" style="background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:6px; padding:4px 12px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="Generate Prescription for this visit">
          💊 PRESCRIPTION / DISPENSARY
        </button>
      </div>

      <!-- Visit Action Bar: Clinical Pad & Prescription Tools -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 12px; margin-bottom:10px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span style="font-size:11px; font-weight:800; color:#475569; margin-right:4px; text-transform:uppercase; letter-spacing:0.5px;">📋 Actions:</span>
        <button onclick="openClinicalPadModal(${v.id})" style="background:#0F8B6D; color:white; border:none; border-radius:6px; padding:4px 12px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="View Clinical Pad & copy JPG to clipboard">
          👁️ View Pad
        </button>
        <button onclick="printClinicalPadDirect(${v.id})" style="background:#475569; color:white; border:none; border-radius:6px; padding:4px 12px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
          🖨️ Print A5
        </button>
        <button onclick="printVisitPrescription(${v.id})" style="background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; border-radius:6px; padding:4px 12px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="Generate Prescription for this visit">
          🌿 Prescription
        </button>
      </div>

      <!-- Visit Specific Billing Bar -->
      <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:8px 14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="font-size:12.5px; color:#64748b;">Consulting / Visit Fee: <b style="color:#0F8B6D; font-size:14px; font-weight:800;">Rs. ${Number(feeAmount).toLocaleString()}</b></div>
        <div style="font-size:12.5px; color:#64748b;">Payment Status: <b style="color:${payColor}; font-weight:800;">${esc(payStatus)}</b></div>
      </div>
      ${v.diagnosis ? `
        <div class="visit-field" style="margin-top:8px;">
          <div class="visit-field-label" style="font-weight:700; color:var(--clr-primary, #059669);">Diagnosis</div>
          <div class="visit-field-value" style="font-weight:600; color:var(--text-primary);">${esc(v.diagnosis)}</div>
        </div>` : ''}
      ${v.symptoms ? `
        <div class="visit-field" style="margin-top:10px; background:linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(245, 158, 11, 0.02)); border:1px solid rgba(245, 158, 11, 0.2); border-radius:8px; padding:10px 14px;">
          <div class="visit-field-label" style="color:#d97706; font-weight:700; font-size:12px; display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Symptoms
          </div>
          <div class="visit-field-value" style="color:var(--text-primary); ${symFont}">${esc(v.symptoms)}</div>
        </div>` : ''}
      ${formattedMedsHtml}
      ${v.notes ? `<div class="visit-field" style="margin-top:8px;"><div class="visit-field-label">Notes</div><div class="visit-field-value">${esc(v.notes)}</div></div>` : ''}
      ${(v.defected_area_image || v.defected_area_image_2 || v.defected_area_image_3) ? `
        <div class="visit-field" style="margin-top:8px;">
          <div class="visit-field-label">Defected Area Photos</div>
          <div class="visit-img-wrap" style="display:flex; gap:8px; overflow-x:auto;">
            ${v.defected_area_image ? `<img src="${v.defected_area_image}" class="visit-img-thumb" onclick="window.open(this.src)" title="Click to view full size" alt="Defected area 1" />` : ''}
            ${v.defected_area_image_2 ? `<img src="${v.defected_area_image_2}" class="visit-img-thumb" onclick="window.open(this.src)" title="Click to view full size" alt="Defected area 2" />` : ''}
            ${v.defected_area_image_3 ? `<img src="${v.defected_area_image_3}" class="visit-img-thumb" onclick="window.open(this.src)" title="Click to view full size" alt="Defected area 3" />` : ''}
          </div>
        </div>` : ''}`;
    timeline.appendChild(card);
  });
}

window.deleteVisit = async function(visitId) {
  if (!confirm('Are you sure you want to delete this visit record?')) return;
  try {
    const result = await apiFetch(`${API}/visit/${visitId}`, { method: 'DELETE' });
    if (result.success) {
      showToast('success', 'Visit Deleted', 'The visit has been deleted successfully.');
      const pId = state.currentPatientId || (window._currentPatientData ? window._currentPatientData.id : null);
      if (pId) {
        const data = await apiFetch(`${API}/patient/${pId}`);
        window._currentPatientData = data.patient || data;
        window._currentVisits = data.visits || [];
        renderPanel(window._currentPatientData, window._currentVisits);
      }
    } else {
      showToast('error', 'Delete Failed', result.error || 'Could not delete visit');
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
};


window.toggleEditPatientForm = function() {
  if (!state.currentPatientId || !window._currentPatientData) return;
  
  resetPatientForm();
  state.formMode = 'EDIT_PATIENT';
  const p = window._currentPatientData;
  state.editingPatientId = p.id;
  
  moveFormToPanel();
  
  const titleEl = document.getElementById('form-main-title');
  if (titleEl) titleEl.textContent = 'Edit Patient Details';
  const subtitleEl = document.getElementById('form-main-subtitle');
  if (subtitleEl) subtitleEl.textContent = `Update demographics for ${p.first_name || p.name}`;
  
  const btn = document.getElementById('btn-submit-patient');
  if (btn) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M12 5v14M5 12h14"/></svg> <span>Update Patient</span>`;
  
  populateFormFromData(p);
  
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  // Ensure clinical fields are empty for patient edit
  setVal('f-symptoms', '');
  setVal('f-pulse-rate', '');
  setVal('f-blood-pressure', '');
  setVal('f-temperature', '');
  setVal('f-oxygen-level', '');
  setVal('f-medicines-text', '');
  setVal('f-consultation-fee', '');
  setVal('f-medicine-price', '');
  setVal('f-total-amount', '0');
  setVal('f-discount', '');
  setVal('f-final-amount', '0');
  setVal('f-amount-received', '');
  setVal('f-remaining-balance', '0');
  
  // Unfreeze demographics to allow editing!
  unfreezeDemographics();
  
  document.getElementById('section-patient-details').style.display = 'none';
  document.getElementById('section-visit-history').style.display = 'none';
}


function toggleAddVisitForm() {
  const form = document.getElementById('add-visit-form');
  const editForm = document.getElementById('edit-patient-form');
  const details = document.getElementById('panel-detail-grid');
  
  if (form.classList.contains('visible')) {
    form.classList.remove('visible');
    form.style.display = 'none';
    document.getElementById('panel-section-title-details').style.display = 'block';
    details.style.display = 'grid';
  } else {
    // Hide edit form if open
    if (editForm) { editForm.classList.remove('visible'); editForm.style.display = 'none'; }
    
    // Show Add Visit form
    form.classList.add('visible');
    form.style.display = 'block';
    
    // Hide read-only details? Let's just scroll to form.
    document.getElementById('add-visit-form').scrollIntoView({ behavior: 'smooth' });

    // Populate baseline patient data into av- fields
    if (state.currentPatientId && window._currentPatientData) {
      const p = window._currentPatientData;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      
      setVal('av-first-name', p.first_name || p.name);
      setVal('av-guardian-name', p.guardian_name);
      if (p.gender) {
        const radio = document.querySelector(`input[name="av-gender"][value="${p.gender}"]`);
        if (radio) radio.checked = true;
      }
      setVal('av-dob', p.date_of_birth);
      setVal('av-age', p.age);
      setVal('av-blood', p.blood_group);
      setVal('av-weight', p.weight);
      setVal('av-whatsapp', p.whatsapp_number);
      setVal('av-city', p.city);
      setVal('av-address', p.address);
      setVal('av-medical-history', p.medical_history);
      setVal('av-ire-id', p.ire_id);
      
      // Clear visit specific fields
      setVal('av-symptoms', '');
      setVal('av-pulse-rate', '');
      setVal('av-blood-pressure', '');
      setVal('av-temperature', '');
      setVal('av-oxygen-level', '');
      setVal('av-notes', '');
      
      // Clear medicines
      const medContainer = document.getElementById('av-medicine-rows-container');
      if (medContainer) medContainer.innerHTML = '';
      if (typeof addMedicineRow === 'function') addMedicineRow(null, 'av-');
      
      // Set today's date
      const today = new Date();
      setVal('av-registration-date', today.toISOString().split('T')[0]); // Note: av- uses registration-date due to sync
    }
  }
}


async function handleRepeatLastVisitHeader() {
  const addForm = document.getElementById('add-visit-form');
  if (!addForm) return;

  // Open Add Visit form if not open
  if (!addForm.classList.contains('visible')) {
    toggleAddVisitForm();
  }

  // Populate data from last visit
  await handleRepeatVisit();
}

async function handleRepeatVisit() {
  if (!state.currentPatientId) return;

  const btnHeader = document.getElementById('btn-repeat-last-visit');
  const btnForm = document.getElementById('btn-repeat-visit');

  try {
    const data = await apiFetch(`${API}/patient/${state.currentPatientId}`);
    const visits = data.visits || [];
    if (visits.length === 0) {
      showToast('warning', 'No Previous Visit', 'No previous visit found for this patient to repeat.');
      return;
    }

    // Most recent visit (first item)
    const lastVisit = visits[0];

    const setField = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = (value !== null && value !== undefined) ? value : '';
    };

    // Copy ALL visit fields (clinical + fees + payment status)
    setField('av-symptoms', lastVisit.symptoms);
    setField('av-diagnosis', lastVisit.diagnosis);
    setField('av-pulse-rate', lastVisit.pulse_rate);
    setField('av-blood-pressure', lastVisit.blood_pressure);
    setField('av-temperature', lastVisit.temperature);
    setField('av-oxygen-level', lastVisit.oxygen_level);
    setField('av-weight', lastVisit.weight);
    setField('av-notes', lastVisit.notes);

    // Fresh Visit Date (Today)
    const todayStr = todayISO();
    setField('av-registration-date', todayStr);

    // Copy Billing & Payment info
    setField('av-consultation-fee', lastVisit.consultation_fee);
    setField('av-medicine-price', lastVisit.medicine_price);
    setField('av-total-amount', lastVisit.total_amount);
    setField('av-discount', lastVisit.discount);
    setField('av-final-amount', lastVisit.final_amount);
    setField('av-amount-received', lastVisit.amount_received);
    setField('av-remaining-balance', lastVisit.remaining_balance);

    const payStatusEl = document.getElementById('av-payment-status');
    if (payStatusEl) payStatusEl.value = lastVisit.payment_status || 'Paid';
    const payMethodEl = document.getElementById('av-payment-method');
    if (payMethodEl) payMethodEl.value = lastVisit.payment_method || 'Cash';

    // Copy Medicines into #av-medicines-text
    const avMedsTextarea = document.getElementById('av-medicines-text');
    if (avMedsTextarea) {
      if (typeof deserializeMedicines === 'function') {
        avMedsTextarea.value = deserializeMedicines(lastVisit.medicines);
      }
    }
    // Scroll to form and show indication banner
    const formEl = document.getElementById('add-visit-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }

    showToast('info', '🔄 Previous Visit Data Copied', 'Previous visit data copied — review and edit before saving.');
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}


async function handleSaveVisit() {
  const dateEl = document.getElementById('av-registration-date') || document.getElementById('av-date');
  if (!dateEl || !dateEl.value) {
    if(dateEl) dateEl.classList.add('error');
    showToast('warning', 'Date Required', 'Please select a visit date.');
    return;
  }
  
  const visitPayload = {
    patient_id: state.currentPatientId,
    visit_date: dateEl.value,
    weight: parseFloat(document.getElementById('av-weight')?.value) || null,
    diagnosis: document.getElementById('av-diagnosis')?.value.trim(),
    pulse_rate: document.getElementById('av-pulse-rate')?.value || null,
    blood_pressure: document.getElementById('av-blood-pressure')?.value || '',
    temperature: document.getElementById('av-temperature')?.value || null,
    oxygen_level: document.getElementById('av-oxygen-level')?.value || null,
    symptoms: document.getElementById('av-symptoms')?.value.trim(),
    notes: document.getElementById('av-notes')?.value.trim(),
    medicines: typeof serializeMedicines === 'function' ? serializeMedicines('av-') : (document.getElementById('av-medicines-text')?.value.trim() || ''),
    consultation_fee: parseFloat(document.getElementById('av-consultation-fee')?.value) || 0,
    medicine_price: parseFloat(document.getElementById('av-medicine-price')?.value) || 0,
    total_amount: parseFloat(document.getElementById('av-total-amount')?.value) || 0,
    discount: parseFloat(document.getElementById('av-discount')?.value) || 0,
    final_amount: parseFloat(document.getElementById('av-final-amount')?.value) || 0,
    payment_method: document.getElementById('av-payment-method')?.value || 'Cash',
    payment_status: document.getElementById('av-payment-status')?.value || 'Paid',
    amount_received: parseFloat(document.getElementById('av-amount-received')?.value) || 0,
    remaining_balance: parseFloat(document.getElementById('av-remaining-balance')?.value) || 0,
    defected_area_image: document.getElementById('av-defect-image-data-1')?.value || '',
    defected_area_image_2: document.getElementById('av-defect-image-data-2')?.value || '',
    defected_area_image_3: document.getElementById('av-defect-image-data-3')?.value || '',
  };

  const btn = document.getElementById('av-btn-save-visit') || document.getElementById('btn-save-visit');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    // Save Visit ONLY (Do not touch patient record or gender!)
    const result = await apiFetch(`${API}/visit`, { method: 'POST', body: JSON.stringify(visitPayload) });
    
    if (result.success) {
      showToast('success', 'Visit Added', 'The visit has been recorded.');
      const addForm = document.getElementById('add-visit-form');
      if (addForm) {
        addForm.classList.remove('visible');
        addForm.style.display = 'none';
      }
      const data = await apiFetch(`${API}/patient/${state.currentPatientId}`);
      window._currentPatientData = data.patient || data;
      window._currentVisits = data.visits || [];
      renderVisitTimeline(window._currentVisits);
      if (typeof invalidateDashboardCache === 'function') invalidateDashboardCache();
      if (typeof loadDashboard === 'function') loadDashboard();
    } else {
      showToast('error', 'Save Failed', result.error);
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Visit'; }
  }
}

window.toggleEditVisitForm = function(visitId) {
  const editVisitForm = document.getElementById('edit-visit-form');
  const addForm = document.getElementById('add-visit-form');
  const editPatientForm = document.getElementById('edit-patient-form');
  if (!editVisitForm) return;

  if (editVisitForm.style.display === 'block' && window._editingVisitId === visitId) {
    editVisitForm.style.display = 'none';
    editVisitForm.classList.remove('visible');
    window._editingVisitId = null;
    return;
  }

  // Hide other forms
  if (addForm) { addForm.style.display = 'none'; addForm.classList.remove('visible'); }
  if (editPatientForm) { editPatientForm.style.display = 'none'; editPatientForm.classList.remove('visible'); }

  const visits = window._currentVisits || [];
  const targetVisit = visits.find(v => v.id === visitId);
  if (!targetVisit) {
    showToast('error', 'Visit Not Found', 'Could not locate target visit record.');
    return;
  }

  window._editingVisitId = visitId;
  const p = window._currentPatientData || {};

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val !== null && val !== undefined) ? val : ''; };

  // Populate patient demographic fields
  setVal('ev-first-name', p.first_name || p.name);
  setVal('ev-guardian-name', p.guardian_name);
  setVal('ev-guardian-relationship', p.guardian_relationship || 'S/O (Son of)');
  setVal('ev-dob', p.date_of_birth);
  setVal('ev-age', p.age);
  setVal('ev-blood', p.blood_group);
  setVal('ev-weight', targetVisit.weight || p.weight);
  setVal('ev-whatsapp', p.whatsapp_number);
  setVal('ev-city', p.city);
  setVal('ev-address', p.address);
  setVal('ev-medical-history', p.medical_history);
  setVal('ev-ire-id', p.ire_id);

  if (p.gender) {
    const radio = document.querySelector(`input[name="ev-gender"][value="${p.gender}"]`);
    if (radio) radio.checked = true;
  }

  // Populate visit specific fields
  setVal('ev-registration-date', targetVisit.visit_date);
  setVal('ev-symptoms', targetVisit.symptoms);
  setVal('ev-pulse-rate', targetVisit.pulse_rate);
  setVal('ev-blood-pressure', targetVisit.blood_pressure);
  setVal('ev-temperature', targetVisit.temperature);
  setVal('ev-oxygen-level', targetVisit.oxygen_level);
  setVal('ev-notes', targetVisit.notes);

  setVal('ev-consultation-fee', targetVisit.consultation_fee);
  setVal('ev-medicine-price', targetVisit.medicine_price);
  setVal('ev-total-amount', targetVisit.total_amount);
  setVal('ev-discount', targetVisit.discount);
  setVal('ev-final-amount', targetVisit.final_amount);
  setVal('ev-amount-received', targetVisit.amount_received);
  setVal('ev-remaining-balance', targetVisit.remaining_balance);
  setVal('ev-payment-status', targetVisit.payment_status || 'Paid');
  setVal('ev-payment-method', targetVisit.payment_method || 'Cash');

  // Populate medicines textarea
  const evMedsTextarea = document.getElementById('ev-medicines-text');
  if (evMedsTextarea) {
    if (typeof deserializeMedicines === 'function') {
      evMedsTextarea.value = deserializeMedicines(targetVisit.medicines);
    } else {
      evMedsTextarea.value = targetVisit.medicines || '';
    }
  }

  editVisitForm.style.display = 'block';
  editVisitForm.classList.add('visible');
  editVisitForm.scrollIntoView({ behavior: 'smooth' });
};

window.cancelEditVisit = function() {
  const editVisitForm = document.getElementById('edit-visit-form');
  if (editVisitForm) {
    editVisitForm.style.display = 'none';
    editVisitForm.classList.remove('visible');
  }
  window._editingVisitId = null;
  // Restore read-only detail grid view
  const details = document.getElementById('panel-detail-grid');
  if (details) details.style.display = 'grid';
  showToast('info', 'Edit Cancelled', 'Edit mode closed. No changes were saved.');
};

window.cancelEditVisit = function() {
  const editVisitForm = document.getElementById('edit-visit-form');
  if (editVisitForm) {
    editVisitForm.style.display = 'none';
    editVisitForm.classList.remove('visible');
  }
  window._editingVisitId = null;
  // Restore read-only detail grid view
  const details = document.getElementById('panel-detail-grid');
  if (details) details.style.display = 'grid';
  showToast('info', 'Edit Cancelled', 'Edit mode closed. No changes were saved.');
};

async function handleSaveVisitEdit() {
  if (!window._editingVisitId) {
    showToast('error', 'No Visit Selected', 'Please select a visit to edit.');
    return;
  }

  const visitId = window._editingVisitId;
  const btn = document.getElementById('btn-save-edit-visit');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

  try {
    const visitPayload = {
      visit_date: document.getElementById('ev-registration-date')?.value || todayISO(),
      pulse_rate: parseInt(document.getElementById('ev-pulse-rate')?.value, 10) || null,
      blood_pressure: document.getElementById('ev-blood-pressure')?.value || '',
      temperature: parseFloat(document.getElementById('ev-temperature')?.value) || null,
      oxygen_level: parseInt(document.getElementById('ev-oxygen-level')?.value, 10) || null,
      weight: parseFloat(document.getElementById('ev-weight')?.value) || null,
      symptoms: document.getElementById('ev-symptoms')?.value.trim(),
      notes: document.getElementById('ev-notes')?.value.trim(),
      medicines: typeof serializeMedicines === 'function' ? serializeMedicines('ev-') : (document.getElementById('ev-medicines-text')?.value.trim() || ''),
      consultation_fee: parseFloat(document.getElementById('ev-consultation-fee')?.value) || 0,
      medicine_price: parseFloat(document.getElementById('ev-medicine-price')?.value) || 0,
      total_amount: parseFloat(document.getElementById('ev-total-amount')?.value) || 0,
      discount: parseFloat(document.getElementById('ev-discount')?.value) || 0,
      final_amount: parseFloat(document.getElementById('ev-final-amount')?.value) || 0,
      payment_method: document.getElementById('ev-payment-method')?.value || 'Cash',
      payment_status: document.getElementById('ev-payment-status')?.value || 'Paid',
      amount_received: parseFloat(document.getElementById('ev-amount-received')?.value) || 0,
      remaining_balance: parseFloat(document.getElementById('ev-remaining-balance')?.value) || 0
    };

    // Update Visit Record via PUT API
    const result = await apiFetch(`${API}/visit/${visitId}`, { method: 'PUT', body: JSON.stringify(visitPayload) });

    // Also update patient demographics if edited in form (without modifying gender)
    const patientPayload = {
      first_name: document.getElementById('ev-first-name')?.value.trim(),
      guardian_name: document.getElementById('ev-guardian-name')?.value.trim(),
      guardian_relationship: document.getElementById('ev-guardian-relationship')?.value || 'S/O (Son of)',
      whatsapp_number: document.getElementById('ev-whatsapp')?.value.trim(),
      age: parseInt(document.getElementById('ev-age')?.value, 10) || null,
      blood_group: document.getElementById('ev-blood')?.value || '',
      address: document.getElementById('ev-address')?.value.trim(),
      city: document.getElementById('ev-city')?.value.trim(),
      gender: window._currentPatientData ? window._currentPatientData.gender : undefined
    };

    if (state.currentPatientId && patientPayload.first_name) {
      await apiFetch(`${API}/patient/${state.currentPatientId}`, { method: 'PUT', body: JSON.stringify(patientPayload) });
    }

    if (result.success || result) {
      showToast('success', 'Visit Updated', 'The visit record has been updated successfully.');

      const editVisitForm = document.getElementById('edit-visit-form');
      if (editVisitForm) {
        editVisitForm.style.display = 'none';
        editVisitForm.classList.remove('visible');
      }
      window._editingVisitId = null;

      // Reload patient details & visit timeline
      const data = await apiFetch(`${API}/patient/${state.currentPatientId}`);
      window._currentPatientData = data.patient || data;
      window._currentVisits = data.visits || [];
      renderPanel(window._currentPatientData, window._currentVisits);

      if (typeof invalidateDashboardCache === 'function') invalidateDashboardCache();
      if (typeof loadDashboard === 'function') loadDashboard();
    } else {
      showToast('error', 'Update Failed', result.error || 'Could not update visit');
    }
  } catch (err) {
    showToast('error', 'Update Error', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Visit'; }
  }
}


async function deletePatient(id) {
  try {
    const result = await apiDelete(`/patient/${id}`);
    if (result.success) {
      showToast('success', 'Patient Deleted', 'The patient and all visits have been removed.');
      closePanel();
      if (state.currentPage === 'search') {
        loadPatients(document.getElementById('search-input').value.trim());
      } else if (state.currentPage === 'dashboard') {
        loadDashboard();
      } else if (state.currentPage === 'all-records') {
        initAllRecordsPage();
      }
    } else {
      showToast('error', 'Delete Failed', result.error);
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  }
}

function closePanel() {
  document.getElementById('record-panel').classList.remove('open');
  document.getElementById('panel-overlay').classList.remove('visible');
  document.body.style.overflow = '';
  state.currentPatientId = null;
}

/* ════════════════════════════════════════════════════════════════════════════
   SCREEN 4: BACKUP & RESTORE
════════════════════════════════════════════════════════════════════════════ */

async function loadBackupPage() {
  const tbody = document.getElementById('backups-table-body');
  const count = document.getElementById('backup-count');
  if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="table-loading">Loading backups…</td></tr>`;

  // Wire up the Create Backup button (only once)
  const createBtn = document.getElementById('btn-create-backup');
  if (createBtn && !createBtn.dataset.wired) {
    createBtn.dataset.wired = '1';
    createBtn.addEventListener('click', createBackup);
  }

  // ── Wire Email Config Save button (only once) ──
  const saveEmailBtn = document.getElementById('btn-save-email-config');
  if (saveEmailBtn && !saveEmailBtn.dataset.wired) {
    saveEmailBtn.dataset.wired = '1';
    saveEmailBtn.addEventListener('click', saveEmailBackupConfig);
  }

  // ── Wire Send Email Backup button (only once) ──
  const sendEmailBtn = document.getElementById('btn-send-email-backup');
  if (sendEmailBtn && !sendEmailBtn.dataset.wired) {
    sendEmailBtn.dataset.wired = '1';
    sendEmailBtn.addEventListener('click', sendEmailBackup);
  }

  // ── Wire Restore from File button (only once) ──
  const restoreFileBtn = document.getElementById('btn-restore-from-file');
  if (restoreFileBtn && !restoreFileBtn.dataset.wired) {
    restoreFileBtn.dataset.wired = '1';
    restoreFileBtn.addEventListener('click', restoreFromEmailBackup);
  }

  // ── Load saved email config and pre-fill form ──
  try {
    const cfgRes = await apiFetch(`${API}/backup/email-config`);
    if (cfgRes.success && cfgRes.config) {
      const cfg = cfgRes.config;
      const senderEl = document.getElementById('eb-sender');
      const recipEl  = document.getElementById('eb-recipient');
      const hostEl   = document.getElementById('eb-smtp-host');
      const passEl   = document.getElementById('eb-password');
      if (senderEl) senderEl.value = cfg.senderEmail || '';
      if (recipEl)  recipEl.value  = cfg.recipientEmail || '';
      if (hostEl)   hostEl.value   = cfg.smtpHost || 'smtp.gmail.com';
      if (passEl)   passEl.value   = cfg.password || ''; // will be '••••••••' if set
    }
  } catch (_) { /* Config not found, leave form blank */ }

  // ── Load local backups list ──
  try {
    const backups = await apiFetch(`${API}/backups`);
    if (count) count.textContent = `${backups.length} backup${backups.length !== 1 ? 's' : ''}`;
    if (!tbody) return;
    if (!backups || backups.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="table-loading">No backups found. Click "Backup Now" to create your first backup.</td></tr>`;
      return;
    }
    tbody.innerHTML = backups.map(b => `
      <tr>
        <td style="font-family:monospace;font-size:12px;">${esc(b.name)}</td>
        <td>${esc(b.formattedDate)}</td>
        <td>
          <button class="btn-view" style="width:auto;padding:0 14px;height:30px;font-size:12px;"
            onclick="restoreBackup('${esc(b.name)}')">Restore</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="table-loading" style="color:var(--clr-pink);">Error loading backups: ${esc(err.message)}</td></tr>`;
    showToast('error', 'Backup Load Error', err.message);
  }
}

async function saveEmailBackupConfig() {
  const btn = document.getElementById('btn-save-email-config');
  const statusEl = document.getElementById('eb-save-status');
  const senderEmail   = document.getElementById('eb-sender')?.value.trim();
  const password      = document.getElementById('eb-password')?.value;
  const recipientEmail = document.getElementById('eb-recipient')?.value.trim();
  const smtpHost      = document.getElementById('eb-smtp-host')?.value.trim() || 'smtp.gmail.com';

  if (!senderEmail || !recipientEmail) {
    showToast('warning', 'Missing Info', 'Please enter both sender and recipient email addresses.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  if (statusEl) statusEl.textContent = '';

  try {
    const result = await apiPost('/backup/email-config', { senderEmail, password, recipientEmail, smtpHost, smtpPort: 587 });
    if (result.success) {
      if (statusEl) statusEl.textContent = '✅ Settings saved!';
      showToast('success', 'Email Settings Saved', 'Your email configuration has been saved securely.');
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
    } else {
      showToast('error', 'Save Failed', result.error || 'Unknown error');
    }
  } catch (err) {
    showToast('error', 'Save Error', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Email Settings'; }
  }
}

async function sendEmailBackup() {
  const btn = document.getElementById('btn-send-email-backup');
  if (btn) { btn.disabled = true; btn.innerHTML = `<div class="btn-spinner"></div><span>Sending…</span>`; }
  try {
    const result = await apiPost('/backup/send-email', {});
    if (result.success) {
      showToast('success', '📧 Backup Email Sent!', `Backup sent to ${result.sentTo} at ${result.time}`);
      await loadBackupPage(); // Refresh local backup list too
    } else {
      showToast('error', 'Email Failed', result.error || 'Unknown error');
    }
  } catch (err) {
    showToast('error', 'Send Error', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="margin-right:6px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg><span>Send Backup by Email Now</span>`;
    }
  }
}

async function restoreFromEmailBackup() {
  const fileInput = document.getElementById('eb-restore-file');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('warning', 'No File Selected', 'Please select a .backup.json file first.');
    return;
  }
  const file = fileInput.files[0];
  showConfirm(
    '⚠️ Smart Merge Restore',
    `This will smartly merge the backup data from "${file.name}" with your current local database. Your existing records will not be deleted, and newer duplicate records will be kept. Do you want to proceed?`,
    async () => {
      const btn = document.getElementById('btn-restore-from-file');
      if (btn) { btn.disabled = true; btn.textContent = 'Restoring…'; }
      try {
        const fileContent = await file.text();
        const result = await apiPost('/backup/restore-from-file', { fileContent });
        if (result.success) {
          if (btn) { btn.disabled = false; btn.textContent = 'Restore Complete'; }
          
          if (result.metrics) {
            document.getElementById('summary-new').textContent = result.metrics.totalNew || 0;
            document.getElementById('summary-updated').textContent = result.metrics.totalUpdated || 0;
            document.getElementById('summary-skipped').textContent = result.metrics.totalSkipped || 0;
            document.getElementById('summary-total').textContent = result.metrics.totalRecords || 0;
            document.getElementById('backup-summary-modal').style.display = 'flex';
          } else {
            showToast('success', '✅ Restore Complete', `Database restored successfully. Reloading…`);
            setTimeout(() => window.location.reload(), 2000);
          }
        } else {
          showToast('error', 'Restore Failed', result.error || 'Unknown error');
          if (btn) { btn.disabled = false; btn.textContent = 'Restore from This File'; }
        }
      } catch (err) {
        showToast('error', 'Restore Error', err.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Restore from This File'; }
      }
    }
  );
}


async function createBackup() {
  const btn = document.getElementById('btn-create-backup');
  if (btn) { btn.disabled = true; btn.innerHTML = `<div class="btn-spinner"></div><span>Creating…</span>`; }
  try {
    const result = await apiPost('/backup', {});
    if (result.success) {
      showToast('success', '✅ Backup Created', `Saved as "${result.backup}" at ${result.time}`);
      await loadBackupPage(); // Refresh the list
    } else {
      showToast('error', 'Backup Failed', result.error || 'Unknown error');
    }
  } catch (err) {
    showToast('error', 'Backup Error', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="margin-right:6px;">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        <span>Backup Now</span>`;
    }
  }
}

async function restoreBackup(backupName) {
  showConfirm(
    '⚠️ Restore Backup?',
    `This will REPLACE your current database and files with "${backupName}". All data added after this backup will be LOST. Are you sure?`,
    async () => {
      const tbody = document.getElementById('backups-table-body');
      if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="table-loading">Restoring backup, please wait…</td></tr>`;
      try {
        const result = await apiPost('/restore', { backupName });
        if (result.success) {
          showToast('success', '✅ Restore Complete', 'Database and files have been restored. The app will reload in 3 seconds.');
          setTimeout(() => window.location.reload(), 3000);
        } else {
          showToast('error', 'Restore Failed', result.error || 'Unknown error');
          await loadBackupPage();
        }
      } catch (err) {
        showToast('error', 'Restore Error', err.message);
        await loadBackupPage();
      }
    }
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SCREEN 3: DASHBOARD
════════════════════════════════════════════════════════════════════════════ */

const dashCache = {
  stats: null,
  charts: null,
  timestamp: 0,
  duration: 30000 // 30 seconds cache duration
};

const recentTableState = {
  searchQuery: '',
  bloodFilter: '',
  currentPage: 1,
  pageSize: 5
};

function useFallbackStats() {
  dashCache.stats = {
    totalPatients: 148,
    visitsToday: 12,
    visitsThisMonth: 115,
    visitsThisWeek: 34,
    earningsThisMonth: 45000,
    totalMedicines: 85,
    stockInStock: 72,
    stockLowStock: 8,
    stockOutOfStock: 5,
    settings: {
      daily_patient_goal: '15',
      monthly_patient_goal: '250',
      monthly_revenue_goal: '60000'
    }
  };
  dashCache.charts = {
    dailyPatients: [],
    monthlyEarnings: [],
    medicineCategories: [],
    recentPatients: [
      { id: 1, name: 'Muhammad Ali', age: 34, phone: '0300-1234567', blood_group: 'O+', created_at: new Date().toISOString() },
      { id: 2, name: 'Ayesha Khan', age: 28, phone: '0321-7654321', blood_group: 'A+', created_at: new Date().toISOString() },
      { id: 3, name: 'John Doe', age: 45, phone: '0333-9876543', blood_group: 'B-', created_at: new Date().toISOString() }
    ],
    upcomingFollowUps: [
      { name: 'Muhammad Ali', appointment_date: new Date().toISOString() },
      { name: 'Ayesha Khan', appointment_date: new Date(Date.now() + 86400000).toISOString() }
    ],
    latestPayments: [
      { name: 'Muhammad Ali', final_amount: 1500 },
      { name: 'Ayesha Khan', final_amount: 850 }
    ],
    topPatients: [
      { name: 'Muhammad Ali', totalAmount: 4500 },
      { name: 'Ayesha Khan', totalAmount: 3200 }
    ],
    topDiseases: [
      { name: 'Flu / Cold', count: 24 },
      { name: 'Migraine', count: 15 }
    ]
  };
  dashCache.timestamp = Date.now();
}

async function getDashboardData(force = false) {
  const now = Date.now();
  if (force || !dashCache.stats || !dashCache.charts || (now - dashCache.timestamp > dashCache.duration)) {
    try {
      const [statsRes, chartsRes] = await Promise.all([
        apiGet('/dashboard-stats'),
        apiGet('/dashboard-charts')
      ]);
      if (statsRes && statsRes.success && chartsRes && chartsRes.success) {
        dashCache.stats = statsRes.stats;
        dashCache.charts = chartsRes.charts;
        dashCache.timestamp = now;
      } else {
        console.warn('Dashboard data success flag is false, loading fallbacks.');
        useFallbackStats();
      }
    } catch (err) {
      console.error('Failed to load dashboard data from backend:', err);
      useFallbackStats();
    }
  }
  return { stats: dashCache.stats, charts: dashCache.charts };
}

function animateValue(el, start, end, duration = 800) {
  if (!el) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    el.textContent = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      el.textContent = end;
    }
  };
  window.requestAnimationFrame(step);
}

function invalidateDashboardCache() {
  dashCache.stats = null;
  dashCache.charts = null;
  dashCache.timestamp = 0;
}

async function loadDashboard() {
  try {
    // Show clock / Date
    const now = new Date();
    const dateText = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dashDateEl = document.getElementById('dash-date');
    const dashTimeEl = document.getElementById('dash-time');
    if (dashDateEl) dashDateEl.textContent = dateText;
    if (dashTimeEl) dashTimeEl.textContent = timeText;

    // Load sub-modules independently
    await Promise.all([
      refreshPatientDashboard(true),
      refreshRevenueDashboard(true),
      refreshInventoryDashboard(true)
    ]);

    // Bind goals settings form submission
    const goalsForm = document.getElementById('dash-goals-form-new');
    if (goalsForm && !goalsForm.dataset.listenerBound) {
      goalsForm.dataset.listenerBound = 'true';
      goalsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dailyVal   = document.getElementById('goal-daily-patients-new').value.trim();
        const monthlyVal = document.getElementById('goal-monthly-revenue-new').value.trim();
        const totalTarget = (document.getElementById('goal-total-patients-target')?.value || '').trim();

        // Target Validation: positive numeric values only
        const isPositiveNum = (val) => /^\d+$/.test(val) && parseInt(val) > 0;
        if (!isPositiveNum(dailyVal) || !isPositiveNum(monthlyVal)) {
          showToast('error', 'Validation Error', 'Target goals must be positive integers only.');
          // Reset default target configurations
          (() => { const el = document.getElementById('goal-daily-patients-new'); if (el) el.value = 20; })();
          (() => { const el = document.getElementById('goal-monthly-revenue-new'); if (el) el.value = 100000; })();
          return;
        }
        if (totalTarget && !isPositiveNum(totalTarget)) {
          showToast('error', 'Validation Error', 'Total Patient Target must be a positive integer.');
          return;
        }

        const settings = {
          daily_patient_goal: dailyVal,
          monthly_revenue_goal: monthlyVal
        };
        if (totalTarget) settings.total_patient_target = totalTarget;

        try {
          const res = await apiPost('/settings', { settings });
          if (res.success) {
            showToast('success', 'Targets Updated', 'Goal target configurations successfully saved.');
            // Reset preFilled flag so inputs refresh with saved values on next load
            const inp = document.getElementById('goal-total-patients-target');
            if (inp) delete inp.dataset.preFilled;
            invalidateDashboardCache();
            loadDashboard();
          } else {
            showToast('error', 'Error', res.error || 'Failed to update settings');
          }
        } catch (err) {
          showToast('error', 'Error', 'Failed to submit target settings form.');
        }
      });

    }
  } catch (err) {
    showToast('error', 'Dashboard Error', err.message);
  }
}

async function refreshPatientDashboard(force = false) {
  try {
    const { stats, charts } = await getDashboardData(force);
    
    const kpiPat = document.getElementById('kpi-total-patients');
    if (kpiPat) {
      const prevVal = parseInt(kpiPat.textContent) || 0;
      animateValue(kpiPat, prevVal, stats.totalPatients || 0);
    }

    // Total Patients Milestone segment builder — uses saved setting (fallback: 500)
    const settings   = stats.settings || {};
    const patGoal    = parseInt(settings.total_patient_target) || 500;
    const patPercent = Math.min(100, Math.round(((stats.totalPatients || 0) / patGoal) * 100));
    const patPercentEl = document.getElementById('segmented-pat-percent');
    if (patPercentEl) patPercentEl.textContent = patPercent + '%';

    // Update the display label and pre-fill the input
    const displayPatTarget = document.getElementById('display-pat-target');
    if (displayPatTarget) displayPatTarget.textContent = patGoal;
    const totalPatTargetInput = document.getElementById('goal-total-patients-target');
    if (totalPatTargetInput && !totalPatTargetInput.dataset.preFilled) {
      totalPatTargetInput.value = patGoal;
      totalPatTargetInput.dataset.preFilled = '1';
    }

    const patValEl = document.getElementById('segmented-pat-val');
    if (patValEl) patValEl.textContent = `${stats.totalPatients} Patients Registered`;

    const patTrack = document.getElementById('track-patients-registered');
    if (patTrack) {
      let trackHtml = '';
      const totalSegs = 12;
      const filledSegs = Math.round((patPercent / 100) * totalSegs);
      for (let i = 0; i < totalSegs; i++) {
        const filled = i < filledSegs ? 'filled-pat' : '';
        trackHtml += `<div class="segmented-block ${filled}"></div>`;
      }
      patTrack.innerHTML = trackHtml;
    }

    // Recent Activity timeline widget values rendering
    const timeline = document.getElementById('dashboard-recent-activity');
    if (timeline && charts.recentActivity) {
      timeline.innerHTML = charts.recentActivity.map(act => `
        <div style="padding: 10px 14px; border-left: 3.5px solid var(--primary-color); margin-left: 10px; margin-bottom: 14px; background: var(--bg-card); border-radius: 6px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-primary); text-transform: capitalize;">${esc(act.action.replace(/_/g, ' '))}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Record ID: #${act.record_id} by ${esc(act.username)}</div>
          <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${formatDate(act.timestamp)}</div>
        </div>
      `).join('') || '<div style="font-size:12px; color:var(--text-muted); padding:10px;">No recent audit logs available.</div>';
    }

    // Top disease list
    const disList = document.getElementById('dashboard-top-diseases');
    if (disList && charts.topDiseases) {
      disList.innerHTML = charts.topDiseases.map(d => `
        <div class="top-item-row" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-page); border-radius:8px; border:1px solid var(--border); margin-bottom:6px;">
          <span class="top-item-name" style="font-weight:600; font-size:13px;">${esc(d.name)}</span>
          <span class="top-item-value" style="font-size:12px; background:var(--bg-card); padding:2px 8px; border-radius:4px; border:1px solid var(--border);">${d.count} occurrences</span>
        </div>
      `).join('') || '<div style="font-size:12px; color:var(--text-muted); padding:10px;">No disease data available.</div>';
    }

    // Recent Registered Patients Widget Table
    const tbody = document.getElementById('recent-table-body');
    const count = document.getElementById('table-count');
    const patients = charts.recentPatients || [];

    // Filter logic
    let filtered = patients;
    const query = recentTableState.searchQuery.toLowerCase().trim();
    if (query) {
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(query) ||
        (p.whatsapp_number || '').toLowerCase().includes(query) ||
        (p.reg_id || '').toLowerCase().includes(query)
      );
    }
    if (recentTableState.bloodFilter) {
      filtered = filtered.filter(p => p.blood_group === recentTableState.bloodFilter);
    }

    const totalEntries = filtered.length;
    const totalPages = Math.ceil(totalEntries / recentTableState.pageSize) || 1;
    if (recentTableState.currentPage > totalPages) {
      recentTableState.currentPage = totalPages;
    }
    const startIndex = (recentTableState.currentPage - 1) * recentTableState.pageSize;
    const endIndex = Math.min(startIndex + recentTableState.pageSize, totalEntries);
    const paginated = filtered.slice(startIndex, endIndex);

    if (count) count.textContent = `${totalEntries} entries`;

    // Update pagination labels
    const pagInfo = document.getElementById('recent-table-pagination-info');
    if (pagInfo) {
      pagInfo.textContent = totalEntries > 0 
        ? `Showing ${startIndex + 1} to ${endIndex} of ${totalEntries} entries`
        : `Showing 0 to 0 of 0 entries`;
    }

    // Bind event listeners once
    const inpSearch = document.getElementById('recent-table-search');
    const selFilter = document.getElementById('recent-table-filter');
    const btnPrev = document.getElementById('recent-table-prev');
    const btnNext = document.getElementById('recent-table-next');

    if (inpSearch && !inpSearch.dataset.listenerBound) {
      inpSearch.dataset.listenerBound = 'true';
      inpSearch.value = recentTableState.searchQuery;
      inpSearch.addEventListener('input', (e) => {
        recentTableState.searchQuery = e.target.value;
        recentTableState.currentPage = 1;
        refreshPatientDashboard();
      });
    }
    if (selFilter && !selFilter.dataset.listenerBound) {
      selFilter.dataset.listenerBound = 'true';
      selFilter.value = recentTableState.bloodFilter;
      selFilter.addEventListener('change', (e) => {
        recentTableState.bloodFilter = e.target.value;
        recentTableState.currentPage = 1;
        refreshPatientDashboard();
      });
    }
    if (btnPrev && !btnPrev.dataset.listenerBound) {
      btnPrev.dataset.listenerBound = 'true';
      btnPrev.addEventListener('click', () => {
        if (recentTableState.currentPage > 1) {
          recentTableState.currentPage--;
          refreshPatientDashboard();
        }
      });
    }
    if (btnNext && !btnNext.dataset.listenerBound) {
      btnNext.dataset.listenerBound = 'true';
      btnNext.addEventListener('click', () => {
        if (recentTableState.currentPage < totalPages) {
          recentTableState.currentPage++;
          refreshPatientDashboard();
        }
      });
    }

    if (!paginated || paginated.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="table-loading">No matching patient records found.</td></tr>`;
      return;
    }

    if (tbody) {
      tbody.innerHTML = paginated.map(p => {
        const fullName = p.name || '';
        const avatarHtml = getPatientAvatarHtml(p, 30);
        const regDisplay = p.reg_id || `#${p.id}`;
        return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:9px;">
              ${avatarHtml}
              <div>
                <div style="font-weight:700;">${esc(fullName.trim() || '—')}</div>
                <div style="font-size:11px;color:var(--text-muted);">${esc(regDisplay)}</div>
              </div>
            </div>
          </td>
          <td>${p.age || '—'}</td>
          <td>${esc(p.whatsapp_number) || '—'}</td>
          <td>${p.blood_group ? `<span style="font-weight:700;color:var(--clr-pink);background:var(--clr-pink-lt);padding:2px 8px;border-radius:6px;font-size:11.5px;">${esc(p.blood_group)}</span>` : '—'}</td>
          <td>${formatDate(p.created_at)}</td>
          <td><button class="btn-view" style="width:auto;padding:0 14px;height:30px;font-size:12px;" onclick="openPatientPanel(${p.id})">View</button></td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    console.error('Error refreshing Patient dashboard:', err);
  }
}

async function refreshRevenueDashboard(force = false) {
  try {
    const { stats, charts } = await getDashboardData(force);
    const settings = stats.settings || {};
    const monthlyPatientsGoal = parseInt(settings.monthly_patient_goal) || 400;

    const kpiVisits = document.getElementById('kpi-today-appointments');
    if (kpiVisits) {
      const prev = parseInt(kpiVisits.textContent) || 0;
      animateValue(kpiVisits, prev, stats.visitsToday || 0);
    }

    const kpiActive = document.getElementById('kpi-active-treatments');
    if (kpiActive) {
      const prev = parseInt(kpiActive.textContent) || 0;
      animateValue(kpiActive, prev, stats.visitsThisMonth || 0);
    }

    const kpiFollow = document.getElementById('kpi-pending-followups');
    if (kpiFollow) {
      const prev = parseInt(kpiFollow.textContent) || 0;
      animateValue(kpiFollow, prev, stats.visitsThisWeek || 0);
    }

    const animateCurrencyVal = (elId, targetVal) => {
      const el = document.getElementById(elId);
      if (!el) return;
      const prevStr = el.textContent.replace(/[^\d]/g, '');
      const prev = parseInt(prevStr) || 0;
      const target = targetVal || 0;
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / 800, 1);
        const val = Math.floor(progress * (target - prev) + prev);
        el.textContent = 'Rs. ' + val.toLocaleString();
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    };

    // 1st Visit Revenue Card Main KPI: Today's First Registrations Revenue
    const todayFvTarget = (stats.firstVisitRevenueToday !== undefined) ? stats.firstVisitRevenueToday : ((stats.revenueByVisit && stats.revenueByVisit.visit1) || 0);
    animateCurrencyVal('kpi-monthly-revenue', todayFvTarget);

    // Expandable Breakdown Values (Daily, Weekly, Monthly 1st Visit Revenue)
    animateCurrencyVal('fv-daily-revenue', todayFvTarget);
    animateCurrencyVal('fv-weekly-revenue', stats.firstVisitRevenueWeek || 0);
    animateCurrencyVal('fv-monthly-revenue', stats.firstVisitRevenueMonth || 0);

    // Bind Expand/Collapse Toggle Button Listener
    const btnFvToggle = document.getElementById('btn-toggle-first-visit-details');
    if (btnFvToggle && !btnFvToggle.dataset.listenerBound) {
      btnFvToggle.dataset.listenerBound = 'true';
      btnFvToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const details = document.getElementById('first-visit-revenue-details');
        const arrow = document.getElementById('first-visit-arrow');
        if (details) {
          const isHidden = details.style.display === 'none' || !details.style.display;
          details.style.display = isHidden ? 'flex' : 'none';
          if (arrow) {
            arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
          }
        }
      });
    }



    const btnToggle = document.getElementById('btn-toggle-followup');
    const chartContainer = document.getElementById('followup-chart-container');
    
    if (btnToggle && chartContainer) {
      // Toggle logic with smooth animation
      btnToggle.onclick = () => {
        if (chartContainer.style.display === 'none' || chartContainer.style.opacity === '0') {
          chartContainer.style.display = 'block';
          setTimeout(() => {
            chartContainer.style.opacity = '1';
            chartContainer.style.transform = 'translateY(0)';
          }, 10);
        } else {
          chartContainer.style.opacity = '0';
          chartContainer.style.transform = 'translateY(-10px)';
          setTimeout(() => {
            chartContainer.style.display = 'none';
          }, 400);
        }
      };

      // 1. First Visit Revenue (All-time First Registrations Only)
      const fvTotal = stats.totalFirstVisitRevenue !== undefined ? stats.totalFirstVisitRevenue : (stats.revenueByVisit?.visit1 || 0);
      animateCurrencyVal('coin-first-visit-total', fvTotal);

      // 2. Follow-up Revenue (All-time Visits Except 1st Registration)
      const fuTotal = stats.totalFollowupRevenue !== undefined ? stats.totalFollowupRevenue : (
        (stats.revenueByVisit?.visit2 || 0) + 
        (stats.revenueByVisit?.visit3 || 0) + 
        (stats.revenueByVisit?.visit4plus || 0)
      );
      animateCurrencyVal('followup-total-amount', fuTotal);

      // 3. Yearly Revenue Breakdown (First Visit + Follow-up Revenue Per Year)
      const yearlyContainer = document.getElementById('coin-yearly-revenue-list');
      if (yearlyContainer) {
        const yearlyList = stats.yearlyRevenueList || charts.yearlyRevenue || [];
        if (!yearlyList || yearlyList.length === 0) {
          yearlyContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center;">No revenue recorded yet</div>';
        } else {
          yearlyContainer.innerHTML = yearlyList.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; border-bottom: 1px dashed rgba(245, 158, 11, 0.25); padding: 4px 0;">
              <span style="font-weight: 700; color: var(--text-primary);">${item.yearLabel || item.year}:</span>
              <span style="font-weight: 800; color: #d97706;">Rs. ${(item.amount || 0).toLocaleString()}</span>
            </div>
          `).join('');
        }
      }
    }

    // Overall Target circular Donut Gauge (if present)
    const newCircle = document.getElementById('gauge-progress-circle-new');
    if (newCircle) {
      const overallTargetPercent = Math.min(100, Math.round(((stats.visitsThisMonth || 0) / monthlyPatientsGoal) * 100));
      const offset = 264 - (264 * overallTargetPercent) / 100;
      newCircle.style.strokeDashoffset = offset;
      const newPercentVal = document.getElementById('gauge-percent-val-new');
      if (newPercentVal) newPercentVal.textContent = overallTargetPercent + '%';
    }

    // Top Patient Billing and Recent Payments widgets
    const patList = document.getElementById('dashboard-top-patients');
    if (patList && charts.topPatients) {
      patList.innerHTML = charts.topPatients.map(p => `
        <div class="top-item-row" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-page); border-radius:8px; border:1px solid var(--border); margin-bottom:6px;">
          <span class="top-item-name" style="font-weight:600; font-size:13px;">${esc(p.name)}</span>
          <span class="top-item-value" style="font-size:12px; background:var(--bg-card); padding:2px 8px; border-radius:4px; border:1px solid var(--border);">Rs. ${parseFloat(p.totalAmount).toFixed(2)}</span>
        </div>
      `).join('') || '<div style="font-size:12px; color:var(--text-muted); padding:10px;">No patients billed yet.</div>';
    }

    // Populate widgets list items
    const todayContainer = document.getElementById('dashboard-today-appointments');
    if (todayContainer && charts.upcomingFollowUps) {
      todayContainer.innerHTML = charts.upcomingFollowUps.slice(0, 3).map(f => `
        <div style="font-size:11px; padding:6px; border-left:3px solid var(--primary-color); background:var(--bg-page); margin-bottom:4px; border-radius:4px;">
          <strong>${esc(f.name)}</strong> - Today
        </div>
      `).join('') || '<div style="font-size:11px; color:var(--text-muted); padding:4px;">No visits scheduled today.</div>';
    }

    const followUpsContainer = document.getElementById('dashboard-upcoming-followups');
    if (followUpsContainer && charts.upcomingFollowUps) {
      followUpsContainer.innerHTML = charts.upcomingFollowUps.slice(0, 3).map(f => `
        <div style="font-size:11px; padding:6px; border-left:3px solid var(--warning-color); background:var(--bg-page); margin-bottom:4px; border-radius:4px;">
          <strong>${esc(f.name)}</strong> on ${formatDate(f.appointment_date)}
        </div>
      `).join('') || '<div style="font-size:11px; color:var(--text-muted); padding:4px;">No upcoming follow-ups.</div>';
    }

    const prescContainer = document.getElementById('dashboard-recent-prescriptions');
    if (prescContainer && charts.recentPatients) {
      prescContainer.innerHTML = charts.recentPatients.slice(0, 3).map(p => `
        <div style="font-size:11px; padding:6px; border-left:3px solid var(--primary-color); background:var(--bg-page); margin-bottom:4px; border-radius:4px;">
          <strong>${esc(p.name)}</strong> - Case Details
        </div>
      `).join('') || '<div style="font-size:11px; color:var(--text-muted); padding:4px;">No recent prescriptions.</div>';
    }

        const paymentsContainer = document.getElementById('dashboard-latest-payments');
    if (paymentsContainer && charts.latestPayments) {
      paymentsContainer.innerHTML = charts.latestPayments.slice(0, 5).map(p => {
        const isUnpaid = p.payment_status !== 'Paid';
        const badgeHtml = isUnpaid ? `<span style="margin-left:6px; background:#fef2f2; color:#ef4444; border:1px solid #fecaca; font-size:10px; padding:2px 6px; border-radius:12px; font-weight:600;">${p.payment_status || 'Unpaid'}</span>` : '';
        return `
        <div style="font-size:11px; padding:6px; border-left:3px solid var(--${isUnpaid ? 'danger' : 'success'}-color); background:var(--bg-page); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center; border-radius:4px;">
          <span>${esc(p.name)}${badgeHtml}</span>
          <strong style="color:var(--${isUnpaid ? 'danger' : 'success'}-color);">Rs. ${parseFloat(p.final_amount).toFixed(2)}</strong>
        </div>
      `}).join('') || '<div style="font-size:11px; color:var(--text-muted); padding:4px;">No payments recorded.</div>';
    }

    // Lazy load the charts logic:
    if (typeof Chart !== 'undefined') {
      renderCharts(charts);
    }
  } catch (err) {
    console.error('Error refreshing Revenue dashboard:', err);
  }
}

async function refreshInventoryDashboard(force = false) {
  try {
    const { stats, charts } = await getDashboardData(force);

    const kpiInStock = document.getElementById('kpi-medicine-instock');
    if (kpiInStock) kpiInStock.textContent = stats.stockInStock || 0;

    const kpiOutStock = document.getElementById('kpi-medicine-outstock');
    if (kpiOutStock) kpiOutStock.textContent = stats.stockOutOfStock || 0;

    // Render stock depletion Segmented tracks
    const totalMeds = stats.totalMedicines || 1;
    const depletionPercent = Math.min(100, Math.round(((stats.stockLowStock + stats.stockOutOfStock) / totalMeds) * 100));
    const medPercentEl = document.getElementById('segmented-med-percent');

    // Populate inventory and alerts notifications widgets
    const inventorySummary = document.getElementById('dashboard-medicine-inventory-summary');
    if (inventorySummary) {
      inventorySummary.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Total Drugs:</span><strong>${stats.totalMedicines || 0}</strong></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>In Stock:</span><span style="color:var(--success-color); font-weight:700;">${stats.stockInStock || 0}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Low Stock:</span><span style="color:var(--warning-color); font-weight:700;">${stats.stockLowStock || 0}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Out of Stock:</span><span style="color:var(--danger-color); font-weight:700;">${stats.stockOutOfStock || 0}</span></div>
      `;
    }

    const notifContainer = document.getElementById('dashboard-recent-notifications');
    if (notifContainer) {
      let notifHtml = '';
      if (stats.stockOutOfStock > 0) {
        notifHtml += `<div style="font-size:11px; color:var(--danger-color); background:rgba(239,68,68,0.08); padding:6px; border-radius:4px; margin-bottom:4px;">⚠️ ${stats.stockOutOfStock} drugs out of stock!</div>`;
      }
      if (stats.stockLowStock > 0) {
        notifHtml += `<div style="font-size:11px; color:var(--warning-color); background:rgba(245,158,11,0.08); padding:6px; border-radius:4px; margin-bottom:4px;">⚠️ ${stats.stockLowStock} drugs running low!</div>`;
      }
      if (stats.stockOutOfStock === 0 && stats.stockLowStock === 0) {
        notifHtml += `<div style="font-size:11px; color:var(--success-color); background:rgba(15,139,109,0.08); padding:6px; border-radius:4px;">✔️ Supply chain stable.</div>`;
      }
      notifContainer.innerHTML = notifHtml;
    }
    
    let medColorClass = 'filled-med-green';
    let medStatusStr = 'Fully Supplied';
    if (depletionPercent > 40) {
      medColorClass = 'filled-med-red';
      medStatusStr = 'Critical Depletion';
    } else if (depletionPercent > 15) {
      medColorClass = 'filled-med-orange';
      medStatusStr = 'Low Stock Warnings';
    }

    if (medPercentEl) {
      medPercentEl.textContent = depletionPercent + '%';
      medPercentEl.style.color = medColorClass === 'filled-med-red' ? '#EF4444' : (medColorClass === 'filled-med-orange' ? '#F59E0B' : '#22C55E');
    }

    const medValEl = document.getElementById('segmented-med-val');
    if (medValEl) medValEl.textContent = `${stats.stockOutOfStock} Empty, ${stats.stockLowStock} Low Stock`;

    const medStatusEl = document.getElementById('segmented-med-status');
    if (medStatusEl) medStatusEl.textContent = `Status: ${medStatusStr}`;

    const medTrack = document.getElementById('track-medicines-stock');
    if (medTrack) {
      let trackHtml = '';
      const totalSegs = 12;
      const filledSegs = Math.round((depletionPercent / 100) * totalSegs);
      for (let i = 0; i < totalSegs; i++) {
        const filled = i < filledSegs ? medColorClass : '';
        trackHtml += `<div class="segmented-block ${filled}"></div>`;
      }
      medTrack.innerHTML = trackHtml;
    }

    // Render Low Stock Alert System list (RAG traffic light widget)
    const alertList = document.getElementById('rag-alert-list');
    if (alertList) {
      let alertHtml = '';
      if (stats.stockOutOfStock > 0) {
        alertHtml += `
          <div class="rag-alert-row">
            <div class="rag-alert-dot red"></div>
            <div style="font-size:12px;">
              <strong>Critical Alert:</strong> ${stats.stockOutOfStock} medicines are completely out of stock. Immediate replenishment required.
            </div>
          </div>
        `;
      }
      if (stats.stockLowStock > 0) {
        alertHtml += `
          <div class="rag-alert-row">
            <div class="rag-alert-dot amber"></div>
            <div style="font-size:12px;">
              <strong>Warning Alert:</strong> ${stats.stockLowStock} medicines have fallen below safety limits.
            </div>
          </div>
        `;
      }
      if (stats.stockOutOfStock === 0 && stats.stockLowStock === 0) {
        alertHtml += `
          <div class="rag-alert-row">
            <div class="rag-alert-dot green"></div>
            <div style="font-size:12px;">
              <strong>System Stable:</strong> All pharmacy stocks are fully supplied. No current warnings.
            </div>
          </div>
        `;
      }
      alertList.innerHTML = alertHtml;
    }

    // Top medicines list
    const medList = document.getElementById('dashboard-top-medicines');
    if (medList && charts.topMedicines) {
      medList.innerHTML = charts.topMedicines.map(m => `
        <div class="top-item-row" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-page); border-radius:8px; border:1px solid var(--border); margin-bottom:6px;">
          <span class="top-item-name" style="font-weight:600; font-size:13px;">${esc(m.name)}</span>
          <span class="top-item-value" style="font-size:12px; background:var(--bg-card); padding:2px 8px; border-radius:4px; border:1px solid var(--border);">${m.count || 0} dispensed</span>
        </div>
      `).join('') || '<div style="font-size:12px; color:var(--text-muted); padding:10px;">No medicine data available.</div>';
    }
  } catch (err) {
    console.error('Error refreshing Inventory dashboard:', err);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   CONFIRM DIALOG
════════════════════════════════════════════════════════════════════════════ */

function showConfirm(title, message, onOk) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  overlay.classList.add('visible');

  const okBtn     = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');
  const close = () => overlay.classList.remove('visible');

  const newOk     = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newOk.addEventListener('click', () => { close(); onOk(); });
  newCancel.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); }, { once: true });
}

/* ════════════════════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════════════════════ */

function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const appEl = document.getElementById('app') || document.body;

    if (window.innerWidth <= 768) {
      appEl.classList.toggle('mobile-nav-open');
    } else {
      appEl.classList.toggle('sidebar-collapsed');
    }
  });

  // Close mobile drawer when clicking any nav item
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const appEl = document.getElementById('app') || document.body;
      appEl.classList.remove('mobile-nav-open');
    });
  });

  // Close mobile drawer when clicking outside topbar/sidebar
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      const topbar = document.getElementById('topbar');
      const sidebar = document.querySelector('.sidebar');
      if (topbar && !topbar.contains(e.target) && sidebar && !sidebar.contains(e.target)) {
        const appEl = document.getElementById('app') || document.body;
        appEl.classList.remove('mobile-nav-open');
      }
    }
  });
}

function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const appEl = document.getElementById('app') || document.body;

    if (window.innerWidth <= 768) {
      appEl.classList.toggle('mobile-nav-open');
    } else {
      appEl.classList.toggle('sidebar-collapsed');
    }
  });

  // Close mobile drawer when clicking any nav item
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const appEl = document.getElementById('app') || document.body;
      appEl.classList.remove('mobile-nav-open');
    });
  });

  // Close mobile drawer when clicking outside topbar/sidebar
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      const topbar = document.getElementById('topbar');
      const sidebar = document.querySelector('.sidebar');
      if (topbar && !topbar.contains(e.target) && sidebar && !sidebar.contains(e.target)) {
        const appEl = document.getElementById('app') || document.body;
        appEl.classList.remove('mobile-nav-open');
      }
    }
  });
}

function init() {
  injectClinicName();
  initTheme();
  initSidebarToggle();
  initSidebarToggle();
  startClock();

  // Navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Pages
  try { initNewPatientForm(); } catch(e) { console.error("initNewPatientForm", e); }
  setupSearchInput();
  setupPanel();
  setupCameraModal();
  try { setupMedicineInventory(); } catch(e) { console.error("setupMedicineInventory", e); }
  setupScrollNavigation();
  setupInteractiveLinks();
  navigateTo('dashboard');
}

function setupInteractiveLinks() {
  const cardPatients = document.getElementById('kpi-card-patients');
  if (cardPatients) {
    cardPatients.addEventListener('click', () => {
      navigateTo('all-records');
      const tabPatients = document.getElementById('btn-tab-patients');
      if (tabPatients) tabPatients.click();
    });
  }


  const btnInvToDir = document.getElementById('btn-inventory-to-dir');
  if (btnInvToDir) {
    btnInvToDir.addEventListener('click', () => {
      navigateTo('all-records');
      // Wait for data to load before switching to medicines tab
      setTimeout(() => {
        const tabMedicines = document.getElementById('btn-tab-medicines');
        if (tabMedicines) tabMedicines.click();
      }, 500);
    });
  }

  const btnDirToInv = document.getElementById('btn-dir-to-inventory');
  if (btnDirToInv) {
    btnDirToInv.addEventListener('click', () => {
      navigateTo('inventory');
    });
  }
}

function setupMedicineInventory() {
  const form = document.getElementById('med-inventory-form');
  const searchInput = document.getElementById('med-search-input');
  const tableBody = document.getElementById('med-inventory-table-body');
  const btnClear = document.getElementById('btn-clear-medicine');
  const formTitle = document.getElementById('med-form-title');
  const btnSave = document.getElementById('btn-save-medicine');

  if (!form) return;

  let currentMedStockFilter = 'all';
  let currentInventoryMeds = [];

  async function loadInventory(query = '') {
    try {
      const data = await apiGet(`/medicines?q=${encodeURIComponent(query)}`);
      currentInventoryMeds = Array.isArray(data) ? data : (data && data.medicines ? data.medicines : []);
      window.currentInventoryMeds = currentInventoryMeds;
      renderInventoryTable();
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'Failed to load inventory.');
    }
  }

  function renderInventoryTable() {
    if (!tableBody) return;

    // Filter meds by selected stock status filter pill + search term
    const meds = currentInventoryMeds.filter(med => {
      if (currentMedStockFilter === 'all') return true;
      const status = med.stock_status || 'In Stock';
      return status.toLowerCase() === currentMedStockFilter.toLowerCase();
    });

    if (!meds || meds.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="table-loading" style="text-align:center; padding:30px; color:var(--text-muted);">No medicines found for the selected criteria.</td></tr>`;
      return;
    }

    tableBody.innerHTML = meds.map(med => {
      let badgeClass = 'badge-in-stock';
      let badgeLabel = '🟢 In Stock';
      
      const userStatus = med.stock_status || 'In Stock';
      const qty = parseInt(med.quantity_remaining, 10) || 0;
      const minAlert = parseInt(med.min_stock_alert, 10) || 0;

      // Primary Status = User's Manual stock_status
      if (userStatus === 'Out of Stock') {
        badgeClass = 'badge-out-of-stock';
        badgeLabel = '🔴 Out of Stock';
      } else if (qty <= minAlert && qty > 0) {
        // Preserved Low Stock visual indicator if in stock but quantity is low
        badgeClass = 'badge-low-stock';
        badgeLabel = '🟡 Low Stock';
      } else {
        badgeClass = 'badge-in-stock';
        badgeLabel = '🟢 In Stock';
      }

      return `
        <tr data-id="${med.id}">
          <td>
            <div style="font-weight: 600;">${esc(med.code)}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${esc(med.name)}</div>
          </td>
          <td>
            <div>${esc(med.category || '—')}</div>
          </td>
          <td>
            <span class="badge-status ${badgeClass}">${badgeLabel}</span>
          </td>
          <td style="display:none;" class="td-required-qty">
            <!-- For out-of-stock items, input for required qty -->
            ${userStatus === 'Out of Stock' ? `<input type="number" class="req-qty-input" data-id="${med.id}" value="${med.required_quantity || ''}" style="width: 60px; padding: 4px; border: 1px solid #ccc; border-radius: 4px;" />` : '—'}
          </td>
          <td>
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="btn btn-outline btn-edit-med" style="padding: 4px 8px; font-size: 11px; height: 26px; width: auto; display:inline-flex; align-items:center; gap:4px;">
                Edit
              </button>
              <button type="button" class="btn btn-outline btn-delete-med" style="padding: 4px 8px; font-size: 11px; height: 26px; width: auto; color:#ef4444; border-color:#fca5a5; display:inline-flex; align-items:center; gap:4px;" title="Delete Medicine">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind edit buttons
    tableBody.querySelectorAll('.btn-edit-med').forEach(btn => {
      btn.addEventListener('click', function() {
        const row = this.closest('tr');
        const id = row.dataset.id;
        const med = currentInventoryMeds.find(m => m.id == id);
        if (med) populateMedicineForm(med);
      });
    });

    // Bind delete buttons with confirmation modal
    tableBody.querySelectorAll('.btn-delete-med').forEach(btn => {
      btn.addEventListener('click', function() {
        const row = this.closest('tr');
        const id = row.dataset.id;
        const med = currentInventoryMeds.find(m => m.id == id);
        if (med) confirmDeleteMedicine(med);
      });
    });
  }

  window.filterMedicines = function(status) {
    const btnAll = document.getElementById('btn-filter-all');
    const btnInStock = document.getElementById('btn-filter-in-stock');
    const btnOutOfStock = document.getElementById('btn-filter-out-of-stock');
    const btnRestock = document.getElementById('btn-generate-restock');
    
    // Reset buttons
    [btnAll, btnInStock, btnOutOfStock].forEach(b => {
      if(b) b.style.background = 'transparent';
    });
    
    if (status === 'All') {
      currentMedStockFilter = 'all';
      if(btnAll) btnAll.style.background = '#e2e8f0';
      if(btnRestock) btnRestock.style.display = 'none';
      if(document.getElementById('th-required-qty')) document.getElementById('th-required-qty').style.display = 'none';
    } else if (status === 'In Stock') {
      currentMedStockFilter = 'In Stock';
      if(btnInStock) btnInStock.style.background = '#e2e8f0';
      if(btnRestock) btnRestock.style.display = 'none';
      if(document.getElementById('th-required-qty')) document.getElementById('th-required-qty').style.display = 'none';
    } else if (status === 'Out of Stock') {
      currentMedStockFilter = 'Out of Stock';
      if(btnOutOfStock) btnOutOfStock.style.background = '#e2e8f0';
      if(btnRestock) btnRestock.style.display = 'inline-block';
      if(document.getElementById('th-required-qty')) document.getElementById('th-required-qty').style.display = 'table-cell';
    }
    
    renderInventoryTable();
    
    // Update req-qty column visibility dynamically after rendering
    if (status === 'Out of Stock') {
      document.querySelectorAll('.td-required-qty').forEach(td => td.style.display = 'table-cell');
    }
  };

  function confirmDeleteMedicine(med) {
    const overlay = document.getElementById('confirm-overlay');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const btnCancel = document.getElementById('confirm-cancel');
    const btnOk = document.getElementById('confirm-ok');

    if (!overlay || !titleEl || !msgEl || !btnOk || !btnCancel) return;

    titleEl.textContent = `Delete Medicine: ${med.name}?`;
    msgEl.innerHTML = `Are you sure you want to delete <strong>${esc(med.name)}</strong> (Code: ${esc(med.code)}) from inventory?<br/><span style="color:#ef4444; font-size:12px;">This action cannot be undone.</span>`;
    
    overlay.style.display = 'flex';
    overlay.classList.add('visible');

    const handleCancel = () => {
      overlay.style.display = 'none';
      overlay.classList.remove('visible');
      cleanup();
    };

    const handleOk = async () => {
      overlay.style.display = 'none';
      overlay.classList.remove('visible');
      cleanup();
      try {
        const res = await apiFetch(`${API}/medicine/${med.id}`, { method: 'DELETE' });
        if (res.success) {
          showToast('success', 'Medicine Deleted', `"${med.name}" has been deleted from inventory.`);
          const searchInput = document.getElementById('med-search-input');
          loadInventory(searchInput ? searchInput.value.trim() : '');
        } else {
          showToast('error', 'Delete Failed', res.error || 'Could not delete medicine.');
        }
      } catch (err) {
        showToast('error', 'Delete Error', err.message);
      }
    };

    const cleanup = () => {
      btnCancel.removeEventListener('click', handleCancel);
      btnOk.removeEventListener('click', handleOk);
    };

    btnCancel.addEventListener('click', handleCancel);
    btnOk.addEventListener('click', handleOk);
  }

  function populateMedicineForm(med) {
    (() => { const el = document.getElementById('med-id'); if (el) el.value = med.id; })();
    (() => { const el = document.getElementById('med-name'); if (el) el.value = med.name; })();
    (() => { const el = document.getElementById('med-code'); if (el) el.value = med.code; })();
    (() => { const el = document.getElementById('med-category'); if (el) el.value = med.category || ''; })();
    (() => { const el = document.getElementById('med-company'); if (el) el.value = med.company || ''; })();
    (() => { const el = document.getElementById('med-batch'); if (el) el.value = med.batch_no || ''; })();
    
    // Format dates correctly for input[type="date"] (YYYY-MM-DD)
    (() => { const el = document.getElementById('med-created-date'); if (el) el.value = med.created_at ? med.created_at.split('T')[0] : ''; })();
    (() => { const el = document.getElementById('med-purchase-date'); if (el) el.value = med.purchase_date ? med.purchase_date.split('T')[0] : ''; })();
    (() => { const el = document.getElementById('med-expiry-date'); if (el) el.value = med.expiry_date ? med.expiry_date.split('T')[0] : ''; })();

    (() => { const el = document.getElementById('med-purchase-price'); if (el) el.value = med.purchase_price || ''; })();
    (() => { const el = document.getElementById('med-selling-price'); if (el) el.value = med.selling_price || ''; })();
    (() => { const el = document.getElementById('med-qty-purchased'); if (el) el.value = med.quantity_purchased || ''; })();
    (() => { const el = document.getElementById('med-qty-remaining'); if (el) el.value = med.quantity_remaining || ''; })();
    (() => { const el = document.getElementById('med-min-alert'); if (el) el.value = med.min_stock_alert || ''; })();
    if (document.getElementById('med-stock-status')) {
      (() => { const el = document.getElementById('med-stock-status'); if (el) el.value = med.stock_status || 'In Stock'; })();
    }
    (() => { const el = document.getElementById('med-supplier-name'); if (el) el.value = med.supplier_name || ''; })();
    (() => { const el = document.getElementById('med-supplier-contact'); if (el) el.value = med.supplier_contact || ''; })();
    (() => { const el = document.getElementById('med-notes'); if (el) el.value = med.notes || ''; })();

    formTitle.textContent = 'Update Medicine Details';
    btnSave.textContent = 'Update Medicine';
  }

  function resetMedForm() {
    form.reset();
    (() => { const el = document.getElementById('med-id'); if (el) el.value = ''; })();
    const today = new Date().toISOString().split('T')[0];
    (() => { const el = document.getElementById('med-created-date'); if (el) el.value = today; })();
    (() => { const el = document.getElementById('med-purchase-date'); if (el) el.value = today; })();
    if (document.getElementById('med-stock-status')) {
      (() => { const el = document.getElementById('med-stock-status'); if (el) el.value = 'In Stock'; })();
    }
    formTitle.textContent = 'Add New Medicine';
    btnSave.textContent = 'Add Medicine';
  }

  btnClear.addEventListener('click', resetMedForm);

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('med-id').value;
    const getVal = (id) => (document.getElementById(id)?.value || '').trim();
    const payload = {
      name: getVal('med-name'),
      code: getVal('med-code'),
      category: getVal('med-category'),
      company: getVal('med-company'),
      batch_no: getVal('med-batch'),
      created_at: document.getElementById('med-created-date')?.value || '',
      purchase_date: document.getElementById('med-purchase-date')?.value || '',
      expiry_date: document.getElementById('med-expiry-date')?.value || '',
      purchase_price: parseFloat(document.getElementById('med-purchase-price')?.value) || 0.0,
      selling_price: parseFloat(document.getElementById('med-selling-price')?.value) || 0.0,
      quantity_purchased: parseInt(document.getElementById('med-qty-purchased')?.value, 10) || 0,
      quantity_remaining: parseInt(document.getElementById('med-qty-remaining')?.value, 10) || 0,
      min_stock_alert: parseInt(document.getElementById('med-min-alert')?.value, 10) || 0,
      stock_status: document.getElementById('med-stock-status') ? document.getElementById('med-stock-status').value : 'In Stock',
      supplier_name: getVal('med-supplier-name'),
      supplier_contact: getVal('med-supplier-contact'),
      notes: getVal('med-notes'),
    };

    btnSave.disabled = true;
    try {
      let result;
      if (id) {
        result = await apiPut(`/medicine/${id}`, payload);
      } else {
        result = await apiPost('/medicine', payload);
      }
      if (result && result.success) {
        invalidateDashboardCache();
        showToast('success', id ? '✅ Medicine Updated' : '✅ Medicine Added', id ? 'Medicine updated successfully.' : 'Medicine added successfully.');
        resetMedForm();
        loadInventory();
        if (allRecordsState.initialized) {
          apiGet('/medicines').then(data => {
            allRecordsState.medicines = Array.isArray(data) ? data : (data && data.medicines ? data.medicines : []);
            if (typeof renderAllRecords === 'function') renderAllRecords();
          }).catch(console.error);
        }
        if (state.loadDashboardStats) state.loadDashboardStats();
      } else {
        showToast('error', 'Error', (result && result.error) || 'Failed to save medicine.');
      }
    } catch (err) {
      console.error('[MED] Save error:', err);
      showToast('error', 'Error', 'Server connection failure: ' + (err.message || err));
    } finally {
      btnSave.disabled = false;
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(state.medsDebounceTimer);
      state.medsDebounceTimer = setTimeout(() => {
        loadInventory(searchInput.value.trim());
      }, 300);
    });
  }

  // Initial load
  loadInventory();
  resetMedForm(); // auto-fill today's date

  state.loadInventory = loadInventory;
  state.loadDashboardStats = loadDashboard;
  state.populateMedicineForm = populateMedicineForm;
}

function renderCharts(data) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js library is not loaded. Skipping chart rendering.');
    return;
  }
  // Destroy old charts to prevent redraw bugs
  const chartNames = [
    'patient-reg-trend',
    'appointment-analytics',
    'monthly-revenue-area',
    'treatment-success',
    'medicine-usage',
    'earnings-waterfall',
    'capacity-stacked',
    'patient-area',
    'blood-group',
    'growth-analytics',
    'monthly-revenue-tab',
    'yearly-revenue',
    'monthly-growth',
    'yearly-growth'
  ];
  chartNames.forEach(name => {
    if (state.charts && state.charts[name]) {
      state.charts[name].destroy();
    }
  });
  if (!state.charts) state.charts = {};

  // Check if clinical statistics lists are empty
  const isEmptyReg = !data.dailyPatients || data.dailyPatients.length === 0;
  const isEmptyEarn = !data.monthlyEarnings || data.monthlyEarnings.length === 0;
  const isEmptyMeds = !data.medicineCategories || data.medicineCategories.length === 0;
  const isGlobalEmpty = isEmptyReg && isEmptyEarn && isEmptyMeds;

  // Toggle visual notice elements
  document.querySelectorAll('.chart-waiting-notice').forEach(el => {
    el.style.display = isGlobalEmpty ? 'block' : 'none';
  });

  const dailyPatients = !isEmptyReg ? data.dailyPatients : [
    { dateLabel: 'Mon', count: 3 },
    { dateLabel: 'Tue', count: 8 },
    { dateLabel: 'Wed', count: 5 },
    { dateLabel: 'Thu', count: 12 },
    { dateLabel: 'Fri', count: 7 },
    { dateLabel: 'Sat', count: 9 },
    { dateLabel: 'Sun', count: 2 }
  ];

  const monthlyEarnings = !isEmptyEarn ? data.monthlyEarnings : [
    { monthLabel: 'Jan', amount: 25000 },
    { monthLabel: 'Feb', amount: 38000 },
    { monthLabel: 'Mar', amount: 35000 },
    { monthLabel: 'Apr', amount: 50000 },
    { monthLabel: 'May', amount: 48000 },
    { monthLabel: 'Jun', amount: 65000 }
  ];

  const medicineCategories = !isEmptyMeds ? data.medicineCategories : [
    { category: 'Dilutions', count: 35 },
    { category: 'Mother Tinctures', count: 24 },
    { category: 'Trituration Tablets', count: 15 },
    { category: 'Bio-combination', count: 20 },
    { category: 'Drops/Syrups', count: 18 }
  ];

  const weeklyEarnings = data.weeklyEarningsCurrentMonth || [];
  const monthlyPatientGrowth = data.monthlyPatientGrowth || [];
  const yearlyPatientGrowth = data.yearlyPatientGrowth || [];
  const monthlyVisitsGrowth = data.monthlyVisitsGrowth || [];
  const yearlyVisitsGrowth = data.yearlyVisitsGrowth || [];
  const monthlyTotalRevenue = data.monthlyTotalRevenue || [];
  const yearlyRevenue = data.yearlyRevenue || [];

  const colors = {
    primary: '#0F8B6D',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    primaryLight: 'rgba(15, 139, 109, 0.15)',
    border: '#E2E8F0'
  };


  // 2. Appointment Analytics (Line Chart)
  const ctxAppt = document.getElementById('chart-appointment-analytics')?.getContext('2d');
  if (ctxAppt) {
    if (state.charts['appointment-analytics']) state.charts['appointment-analytics'].destroy();
    state.charts['appointment-analytics'] = new Chart(ctxAppt, {
      type: 'line',
      data: {
        labels: dailyPatients.map(d => d.dateLabel),
        datasets: [{
          label: 'Daily Visits',
          data: dailyPatients.map(d => Math.round(d.count * 1.5 + 2)), // Dynamic appointments proxy
          borderColor: colors.warning,
          backgroundColor: 'transparent',
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }


  // 4. Patient Traffic by Area (Horizontal Bar Chart — with Gulzar font for Urdu labels)
  const ctxArea = document.getElementById('chart-patient-area')?.getContext('2d');
  if (ctxArea) {
    const rawData = data.patientAreaDistribution || [];

    // Fall back to demo data if empty
    let areaData = rawData.length > 0 ? [...rawData] : [
      { area: 'Rajana', count: 12 },
      { area: 'Shorkot', count: 8 },
      { area: 'Chiniot', count: 5 },
      { area: 'Unknown', count: 3 }
    ];
    areaData.sort((a, b) => b.count - a.count);
    areaData = areaData.slice(0, 10);

    // Detect Urdu/Arabic script in a label
    const isUrduText = s => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s || '');

    const labels = areaData.map(d => d.area || 'Unknown');
    const counts = areaData.map(d => d.count);

    const barColors = [
      '#0F8B6D', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
      '#14B8A6', '#EC4899', '#22C55E', '#F97316', '#6366F1'
    ];

    if (state.charts['patient-area']) state.charts['patient-area'].destroy();
    state.charts['patient-area'] = new Chart(ctxArea, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Patients',
          data: counts,
          backgroundColor: labels.map((_, i) => barColors[i % barColors.length]),
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.x} patient${ctx.parsed.x !== 1 ? 's' : ''}`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          y: {
            ticks: {
              font: ctx => {
                const label = labels[ctx.index] || '';
                return isUrduText(label)
                  ? { size: 12, family: 'Gulzar, serif' }
                  : { size: 10, family: 'Inter, sans-serif' };
              },
              color: '#1E293B'
            },
            grid: { display: false }
          }
        }
      }
    });

    // ── Custom HTML legend with Gulzar font for Urdu area names ──
    const legendEl = document.getElementById('area-chart-legend');
    if (legendEl) {
      legendEl.innerHTML = areaData.map((d, i) => {
        const color = barColors[i % barColors.length];
        const fontStyle = isUrduText(d.area) ? 'font-family:Gulzar,serif; font-size:13px; direction:rtl;' : '';
        return '<span style="display:inline-flex; align-items:center; gap:4px;">' +
          '<span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:' + color + '; flex-shrink:0;"></span>' +
          '<span style="' + fontStyle + '">' + esc(d.area) + '</span>' +
          '<span style="color:#64748b;">(' + d.count + ')</span>' +
        '</span>';
      }).join('');
    }
  }

  // ── 5. Blood Group Distribution (Doughnut Chart) ──
  const ctxBlood = document.getElementById('chart-blood-group')?.getContext('2d');
  if (ctxBlood) {
    const rawBlood = data.bloodGroupDistribution || [];
    const bgMap = {};
    if (Array.isArray(rawBlood) && rawBlood.length > 0) {
      rawBlood.forEach(item => {
        const bg = (item.blood_group || item.bg || 'Unknown').trim();
        if (bg) bgMap[bg] = (bgMap[bg] || 0) + (item.count || 1);
      });
    }
    if (Object.keys(bgMap).length === 0 && data.recentPatients && data.recentPatients.length > 0) {
      data.recentPatients.forEach(p => {
        const bg = (p.blood_group || 'Unknown').trim();
        bgMap[bg] = (bgMap[bg] || 0) + 1;
      });
    }
    if (Object.keys(bgMap).length === 0) {
      bgMap['B+'] = 12;
      bgMap['O+'] = 9;
      bgMap['A+'] = 6;
      bgMap['AB+'] = 4;
      bgMap['Unknown'] = 2;
    }

    const bloodLabels = Object.keys(bgMap);
    const bloodCounts = Object.values(bgMap);
    const bloodColors = [
      '#0F8B6D', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'
    ];

    if (state.charts['blood-group']) state.charts['blood-group'].destroy();
    state.charts['blood-group'] = new Chart(ctxBlood, {
      type: 'doughnut',
      data: {
        labels: bloodLabels,
        datasets: [{
          data: bloodCounts,
          backgroundColor: bloodColors.slice(0, bloodLabels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.label + ': ' + ctx.parsed + ' patient' + (ctx.parsed !== 1 ? 's' : '')
            }
          }
        }
      }
    });

    const bloodLegendEl = document.getElementById('blood-chart-legend');
    if (bloodLegendEl) {
      bloodLegendEl.innerHTML = bloodLabels.map((bg, i) =>
        '<span style="display:inline-flex; align-items:center; gap:4px; margin-right:8px;">' +
          '<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:' + bloodColors[i % bloodColors.length] + '; flex-shrink:0;"></span>' +
          '<span style="font-weight:600; color:#334155; font-size:12px;">' + esc(bg) + '</span>' +
          '<span style="color:#64748b; font-size:11px;">(' + bloodCounts[i] + ')</span>' +
        '</span>'
      ).join('');
    }
  }

  // ── 6. Growth Analytics (Tabbed Line Chart) ──
  const ctxGrowth = document.getElementById('chart-growth-analytics')?.getContext('2d');
  if (ctxGrowth) {
    window._lastChartData = data;
    
    const metricBtns = document.querySelectorAll('.growth-metric-btn');
    metricBtns.forEach(btn => {
      if (!btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', (e) => {
          metricBtns.forEach(b => {
            b.classList.remove('active');
            b.style.borderBottom = '2px solid transparent';
            b.style.color = '#64748b';
            b.style.fontWeight = '500';
          });
          const targetBtn = e.currentTarget;
          targetBtn.classList.add('active');
          targetBtn.style.borderBottom = '2px solid #3b82f6';
          targetBtn.style.color = '#0f172a';
          targetBtn.style.fontWeight = '600';
          
          window._activeGrowthMetric = targetBtn.dataset.metric;
          renderGrowthAnalyticsCanvas(window._lastChartData || data);
        });
      }
    });

    const rangeSelector = document.getElementById('growth-range-selector');
    if (rangeSelector && !rangeSelector.dataset.bound) {
      rangeSelector.dataset.bound = 'true';
      rangeSelector.addEventListener('change', (e) => {
        window._activeGrowthRange = e.target.value;
        const customContainer = document.getElementById('growth-custom-dates');
        if (customContainer) {
          customContainer.style.display = e.target.value === 'custom' ? 'flex' : 'none';
        }
        renderGrowthAnalyticsCanvas(window._lastChartData || data);
      });
    }

    renderGrowthAnalyticsCanvas(data);
  }

    // 6. Growth & Revenue Analytics (Tabbed Charts)
  const ctxEarnings = document.getElementById('chart-earnings-waterfall')?.getContext('2d');
  if (ctxEarnings) {
    if (state.charts['earnings-waterfall']) state.charts['earnings-waterfall'].destroy();
    state.charts['earnings-waterfall'] = new Chart(ctxEarnings, {
      type: 'bar',
      data: {
        labels: weeklyEarnings.length ? weeklyEarnings.map(w => 'Week ' + w.weekLabel) : ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
          label: 'Weekly Earnings (Rs)',
          data: weeklyEarnings.length ? weeklyEarnings.map(w => w.amount) : [12000, 15000, 10000, 18000],
          backgroundColor: colors.primary,
          borderRadius: 6
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }


  // Custom plugin for Chart.js to draw arrowheads on X and Y axes like the reference image
  const axisArrowsPlugin = {
    id: 'axisArrows',
    afterDraw: (chart) => {
      const { ctx, chartArea: { left, bottom, right, top }, scales: { x, y } } = chart;
      ctx.save();
      ctx.fillStyle = '#1e3a40';
      
      // Y-axis arrow pointing up
      const yX = left;
      const yY = top - 8;
      ctx.beginPath();
      ctx.moveTo(yX, yY);
      ctx.lineTo(yX - 6, yY + 12);
      ctx.lineTo(yX + 6, yY + 12);
      ctx.closePath();
      ctx.fill();

      // X-axis arrow pointing right
      const xX = right + 8;
      const xY = bottom;
      ctx.beginPath();
      ctx.moveTo(xX, xY);
      ctx.lineTo(xX - 12, xY - 6);
      ctx.lineTo(xX - 12, xY + 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  };

  const ctxMonGro = document.getElementById('chart-monthly-growth')?.getContext('2d');
  if (ctxMonGro) {
    if (state.charts['monthly-growth']) state.charts['monthly-growth'].destroy();

    const allLabelsSet = new Set();
    monthlyPatientGrowth.forEach(d => allLabelsSet.add(d.monthLabel));
    monthlyVisitsGrowth.forEach(d => allLabelsSet.add(d.monthLabel));
    monthlyTotalRevenue.forEach(d => allLabelsSet.add(d.monthLabel));
    let mLabels = Array.from(allLabelsSet).sort();
    if (mLabels.length === 0) {
      mLabels = ['2023-01', '2023-02', '2023-03', '2023-04', '2023-05', '2023-06'];
    }

    const formattedMLabels = mLabels.map(l => {
      if (l.includes('-')) {
        const d = new Date(l + '-01');
        return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      }
      return l;
    });

    const mPatientsData = mLabels.map(label => {
      const match = monthlyPatientGrowth.find(m => m.monthLabel === label);
      return match ? match.count : 0;
    });

    const mVisitsData = mLabels.map(label => {
      const match = monthlyVisitsGrowth.find(m => m.monthLabel === label);
      return match ? match.count : 0;
    });

    const mRevenueData = mLabels.map(label => {
      const match = monthlyTotalRevenue.find(m => m.monthLabel === label);
      return match ? match.amount : 0;
    });

    state.charts['monthly-growth'] = new Chart(ctxMonGro, {
      type: 'line',
      data: {
        labels: formattedMLabels,
        datasets: [
          {
            label: 'Visits',
            data: mVisitsData,
            borderColor: '#3b82f6',
            borderWidth: 3,
            backgroundColor: (context) => {
              const chartCtx = context.chart.ctx;
              const gradient = chartCtx.createLinearGradient(0, 0, 0, 240);
              gradient.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
              gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#3b82f6',
            pointBorderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Patients',
            data: mPatientsData,
            borderColor: '#10b981',
            borderWidth: 3,
            backgroundColor: (context) => {
              const chartCtx = context.chart.ctx;
              const gradient = chartCtx.createLinearGradient(0, 0, 0, 240);
              gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
              gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#10b981',
            pointBorderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Revenue',
            data: mRevenueData,
            borderColor: '#8b5cf6',
            borderWidth: 3,
            backgroundColor: (context) => {
              const chartCtx = context.chart.ctx;
              const gradient = chartCtx.createLinearGradient(0, 0, 0, 240);
              gradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
              gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#8b5cf6',
            pointBorderWidth: 2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: {
          padding: { top: 15, right: 15, bottom: 5, left: 5 }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: { family: "'Inter', sans-serif", weight: '600', size: 12 },
              color: '#334155'
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleFont: { weight: 'bold' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.dataset.yAxisID === 'y1') {
                  label += 'Rs ' + context.parsed.y.toLocaleString();
                } else {
                  label += context.parsed.y;
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#64748b', font: { weight: '500', size: 11 }, padding: 10 }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false, lineWidth: 1 },
            border: { display: false },
            ticks: { color: '#64748b', font: { weight: '500', size: 11 }, padding: 10, precision: 0 }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            border: { display: false },
            ticks: {
              color: '#64748b', font: { weight: '500', size: 11 }, padding: 10,
              callback: function(value) { return 'Rs ' + (value > 999 ? (value/1000).toFixed(1) + 'k' : value); }
            }
          }
        }
      }
    });
  }

  const ctxYearGro = document.getElementById('chart-yearly-growth')?.getContext('2d');
  if (ctxYearGro) {
    if (state.charts['yearly-growth']) state.charts['yearly-growth'].destroy();

    const allYearLabelsSet = new Set();
    yearlyPatientGrowth.forEach(d => allYearLabelsSet.add(d.yearLabel));
    yearlyVisitsGrowth.forEach(d => allYearLabelsSet.add(d.yearLabel));
    yearlyRevenue.forEach(d => allYearLabelsSet.add(d.yearLabel));
    let yLabels = Array.from(allYearLabelsSet).sort();
    if (yLabels.length === 0) {
      yLabels = ['2023', '2024', '2025', '2026'];
    }

    const yPatientsData = yLabels.map(label => {
      const match = yearlyPatientGrowth.find(m => m.yearLabel === label);
      return match ? match.count : 0;
    });

    const yVisitsData = yLabels.map(label => {
      const match = yearlyVisitsGrowth.find(m => m.yearLabel === label);
      return match ? match.count : 0;
    });

    const yRevenueData = yLabels.map(label => {
      const match = yearlyRevenue.find(m => m.yearLabel === label);
      return match ? match.amount : 0;
    });

    state.charts['yearly-growth'] = new Chart(ctxYearGro, {
      type: 'line',
      data: {
        labels: yLabels,
        datasets: [
          {
            label: 'Visits',
            data: yVisitsData,
            borderColor: '#3b82f6',
            borderWidth: 3,
            backgroundColor: (context) => {
              const chartCtx = context.chart.ctx;
              const gradient = chartCtx.createLinearGradient(0, 0, 0, 240);
              gradient.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
              gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#3b82f6',
            pointBorderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Patients',
            data: yPatientsData,
            borderColor: '#10b981',
            borderWidth: 3,
            backgroundColor: (context) => {
              const chartCtx = context.chart.ctx;
              const gradient = chartCtx.createLinearGradient(0, 0, 0, 240);
              gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
              gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#10b981',
            pointBorderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Revenue',
            data: yRevenueData,
            borderColor: '#8b5cf6',
            borderWidth: 3,
            backgroundColor: (context) => {
              const chartCtx = context.chart.ctx;
              const gradient = chartCtx.createLinearGradient(0, 0, 0, 240);
              gradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
              gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#8b5cf6',
            pointBorderWidth: 2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: {
          padding: { top: 15, right: 15, bottom: 5, left: 5 }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: { family: "'Inter', sans-serif", weight: '600', size: 12 },
              color: '#334155'
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleFont: { weight: 'bold' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.dataset.yAxisID === 'y1') {
                  label += 'Rs ' + context.parsed.y.toLocaleString();
                } else {
                  label += context.parsed.y;
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#64748b', font: { weight: '500', size: 11 }, padding: 10 }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false, lineWidth: 1 },
            border: { display: false },
            ticks: { color: '#64748b', font: { weight: '500', size: 11 }, padding: 10, precision: 0 }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            border: { display: false },
            ticks: {
              color: '#64748b', font: { weight: '500', size: 11 }, padding: 10,
              callback: function(value) { return 'Rs ' + (value > 999 ? (value/1000).toFixed(1) + 'k' : value); }
            }
          }
        }
      }
    });
  }

  // 7. Staff/Clinic Capacity Grid (Stacked column chart using Green, Terracotta, Sand blocks)
  
  if (ctxCapacity) {
    if (state.charts['capacity-stacked']) state.charts['capacity-stacked'].destroy();
    state.charts['capacity-stacked'] = new Chart(ctxCapacity, {
      type: 'bar',
      data: {
        labels: ['Morning Shift', 'Afternoon Shift', 'Evening Shift'],
        datasets: [
          {
            label: 'Phase 1: Medical',
            data: [80, 60, 95],
            backgroundColor: '#0F8B6D'
          },
          {
            label: 'Phase 2: Pharmacy',
            data: [50, 75, 40],
            backgroundColor: '#BA6A4C'
          },
          {
            label: 'Phase 3: Admin',
            data: [30, 45, 20],
            backgroundColor: '#bca380'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, max: 200 } }
      }
    });
  }
}

let passwordOkHandler = null;
let passwordCancelHandler = null;
let passwordKeyHandler = null;

function promptAdminPassword(onSuccess) {
  const overlay = document.getElementById('password-overlay');
  const input = document.getElementById('admin-password-input');
  const btnOk = document.getElementById('password-ok');
  const btnCancel = document.getElementById('password-cancel');

  if (!overlay || !input || !btnOk || !btnCancel) {
    onSuccess();
    return;
  }

  input.value = '';
  overlay.style.display = 'flex';
  overlay.classList.add('visible');
  input.focus();

  if (passwordOkHandler) btnOk.removeEventListener('click', passwordOkHandler);
  if (passwordCancelHandler) btnCancel.removeEventListener('click', passwordCancelHandler);
  if (passwordKeyHandler) input.removeEventListener('keydown', passwordKeyHandler);

  passwordCancelHandler = () => {
    overlay.style.display = 'none';
    overlay.classList.remove('visible');
  };

  passwordOkHandler = () => {
    const pwd = input.value;
    if (pwd === 'admin123' || pwd === 'admin') {
      overlay.style.display = 'none';
      overlay.classList.remove('visible');
      onSuccess();
    } else {
      showToast('error', 'Access Denied', 'Invalid Admin Password.');
      overlay.style.display = 'none';
      overlay.classList.remove('visible');
    }
  };
  
  passwordKeyHandler = (e) => {
    if (e.key === 'Enter') {
      passwordOkHandler();
    }
  };

  btnCancel.addEventListener('click', passwordCancelHandler);
  btnOk.addEventListener('click', passwordOkHandler);
  input.addEventListener('keydown', passwordKeyHandler);
}

function setupScrollNavigation() {
  const container = document.getElementById('content-area');
  const btnTop = document.getElementById('scroll-btn-top');
  const btnBottom = document.getElementById('scroll-btn-bottom');

  if (!container || !btnTop || !btnBottom) return;

  container.addEventListener('scroll', () => {
    const sTop = container.scrollTop;
    const sHeight = container.scrollHeight;
    const cHeight = container.clientHeight;

    // Scroll to Top visibility
    if (sTop > 200) {
      btnTop.classList.remove('hidden');
    } else {
      btnTop.classList.add('hidden');
    }

    // Scroll to Bottom visibility
    if (sTop + cHeight >= sHeight - 20) {
      btnBottom.classList.add('hidden');
    } else {
      btnBottom.classList.remove('hidden');
    }
  });

  btnTop.addEventListener('click', () => {
    container.scrollTo({ top: 0, behavior: 'smooth' });
  });

  btnBottom.addEventListener('click', () => {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   CLINIC DIRECTORY PAGE (ALL PATIENTS & MEDICINES)
   ════════════════════════════════════════════════════════════════════════════ */

let allRecordsState = {
  patients: [],
  medicines: [],
  patientsPage: 1,
  medicinesPage: 1,
  pageSize: 10,
  patientsQuery: '',
  medicinesQuery: '',
  medicinesSortCol: '',
  medicinesSortDir: 'asc',
  activeTab: 'patients',
  initialized: false
};

async function initAllRecordsPage() {
  const tabPatients = document.getElementById('btn-tab-patients');
  const tabMedicines = document.getElementById('btn-tab-medicines');
  const secPatients = document.getElementById('dir-section-patients');
  const secMedicines = document.getElementById('dir-section-medicines');
  
  if (!tabPatients || !tabMedicines) return;

  if (!allRecordsState.initialized) {
    allRecordsState.initialized = true;

    // Tab switching handlers
    tabPatients.addEventListener('click', () => {
    tabPatients.classList.add('btn-submit');
    tabPatients.classList.remove('btn-outline');
    tabMedicines.classList.add('btn-outline');
    tabMedicines.classList.remove('btn-submit');
    secPatients.style.display = 'block';
    secMedicines.style.display = 'none';
    allRecordsState.activeTab = 'patients';
    renderAllRecords();
  });

  tabMedicines.addEventListener('click', () => {
    tabMedicines.classList.add('btn-submit');
    tabMedicines.classList.remove('btn-outline');
    tabPatients.classList.add('btn-outline');
    tabPatients.classList.remove('btn-submit');
    secMedicines.style.display = 'block';
    secPatients.style.display = 'none';
    allRecordsState.activeTab = 'medicines';
    renderAllRecords();
  });

  // Search input handlers
  const searchPatients = document.getElementById('dir-patients-search');
  const searchMedicines = document.getElementById('dir-medicines-search');

  searchPatients.addEventListener('input', () => {
    allRecordsState.patientsQuery = searchPatients.value.trim().toLowerCase();
    allRecordsState.patientsPage = 1;
    renderAllRecords();
  });

  searchMedicines.addEventListener('input', () => {
    allRecordsState.medicinesQuery = searchMedicines.value.trim().toLowerCase();
    allRecordsState.medicinesPage = 1;
    renderAllRecords();
  });

  const filterOutOfStock = document.getElementById('filter-out-of-stock');
  if (filterOutOfStock) {
    filterOutOfStock.addEventListener('change', () => {
      allRecordsState.filterOutOfStock = filterOutOfStock.checked;
      allRecordsState.medicinesPage = 1;
      renderAllRecords();
    });
  }

  document.querySelectorAll('#dir-section-medicines th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (allRecordsState.medicinesSortCol === col) {
        allRecordsState.medicinesSortDir = allRecordsState.medicinesSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        allRecordsState.medicinesSortCol = col;
        allRecordsState.medicinesSortDir = 'asc';
      }
      renderAllRecords();
    });
  });
  } // end if (!initialized)

  // Fetch ALL patients + medicines for the directory
  try {
    const [patientsData, medicinesData] = await Promise.all([
      apiGet('/patients?all=true'),
      apiGet('/medicines')
    ]);
    allRecordsState.patients = Array.isArray(patientsData) ? patientsData : (patientsData && patientsData.patients ? patientsData.patients : []);
    allRecordsState.medicines = Array.isArray(medicinesData) ? medicinesData : (medicinesData && medicinesData.medicines ? medicinesData.medicines : []);
  } catch (err) {
    console.error('Failed to load clinic directories:', err);
    showToast('error', 'Error', 'Failed to load clinic directory data.');
  }

  renderAllRecords();
}

function renderAllRecords() {
  if (allRecordsState.activeTab === 'patients') {
    renderPatientsDirectory();
  } else {
    renderMedicinesDirectory();
  }
}

function renderPatientsDirectory() {
  const tableBody = document.getElementById('dir-patients-table-body');
  const countBadge = document.getElementById('dir-patients-count');
  const pagInfo = document.getElementById('dir-patients-pagination-info');
  const pagControls = document.getElementById('dir-patients-pagination-controls');

  if (!tableBody) return;

  // Filter
  const filtered = allRecordsState.patients.filter(p => {
    const name = (p.name || '').toLowerCase();
    const whatsapp = (p.whatsapp_number || '').toLowerCase();
    const regNo = String(p.registration_no || p.reg_id || '').toLowerCase();
    const address = (p.address || p.city || '').toLowerCase();
    const query = allRecordsState.patientsQuery || '';
    return name.includes(query) || whatsapp.includes(query) || regNo.includes(query) || address.includes(query);
  });

  countBadge.textContent = `${filtered.length} patients`;

  // Paginate
  const total = filtered.length;
  const size = allRecordsState.pageSize;
  const pages = Math.ceil(total / size) || 1;
  if (allRecordsState.patientsPage > pages) allRecordsState.patientsPage = pages;
  const start = (allRecordsState.patientsPage - 1) * size;
  const end = Math.min(start + size, total);
  const chunk = filtered.slice(start, end);

  // Render Table
  if (chunk.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color: var(--text-muted);">No patients found.</td></tr>`;
  } else {
    tableBody.innerHTML = chunk.map(p => `
      <tr>
        <td style="font-weight: 600; color: #0F8B6D;">${p.registration_no || p.reg_id || p.ire_id || 'N/A'}</td>
        <td style="font-weight: 500;">${p.name || (p.first_name + ' ' + p.last_name)}</td>
        <td><span class="badge ${p.gender === 'Male' ? 'badge-primary' : 'badge-danger'}">${p.gender || 'N/A'}</span></td>
        <td>${p.age || 'N/A'} yrs</td>
        <td><span class="badge" style="background: rgba(15, 139, 109, 0.1); color: #0F8B6D;">${p.blood_group || 'N/A'}</span></td>
        <td>${p.whatsapp_number ? esc(p.whatsapp_number) : '<span style="color:var(--text-muted,#94a3b8); font-style:italic;">Not Provided</span>'}</td>
        <td>${p.address || p.city || 'N/A'}</td>
        <td>${p.registration_date || (p.created_at ? p.created_at.split(' ')[0] : 'N/A')}</td>
      </tr>
    `).join('');
  }

  // Render Pagination Info & Controls
  pagInfo.textContent = total > 0
    ? `Showing ${start + 1} to ${end} of ${total} entries`
    : `Showing 0 to 0 of 0 entries`;

  renderPaginationControls(pagControls, allRecordsState.patientsPage, pages, (p) => {
    allRecordsState.patientsPage = p;
    renderPatientsDirectory();
  });
}

function renderMedicinesDirectory() {
  const tableBody = document.getElementById('dir-medicines-table-body');
  const countBadge = document.getElementById('dir-medicines-count');
  const pagInfo = document.getElementById('dir-medicines-pagination-info');
  const pagControls = document.getElementById('dir-medicines-pagination-controls');

  if (!tableBody) return;

  // Filter
  const filtered = allRecordsState.medicines.filter(m => {
    if (allRecordsState.filterOutOfStock && m.stock_status !== 'Out of Stock') {
      return false;
    }
    const name = (m.name || '').toLowerCase();
    const code = (m.code || '').toLowerCase();
    const category = (m.category || '').toLowerCase();
    const company = (m.company || '').toLowerCase();
    const query = allRecordsState.medicinesQuery || '';
    return name.includes(query) || code.includes(query) || category.includes(query) || company.includes(query);
  });

  // Sort
  if (allRecordsState.medicinesSortCol) {
    filtered.sort((a, b) => {
      let valA = a[allRecordsState.medicinesSortCol] || '';
      let valB = b[allRecordsState.medicinesSortCol] || '';
      if (allRecordsState.medicinesSortCol === 'qty') {
        valA = parseInt(a.quantity_remaining, 10) || 0;
        valB = parseInt(b.quantity_remaining, 10) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      if (valA < valB) return allRecordsState.medicinesSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return allRecordsState.medicinesSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  countBadge.textContent = `${filtered.length} medicines`;

  // Paginate
  const total = filtered.length;
  const size = allRecordsState.pageSize;
  const pages = Math.ceil(total / size) || 1;
  if (allRecordsState.medicinesPage > pages) allRecordsState.medicinesPage = pages;
  const start = (allRecordsState.medicinesPage - 1) * size;
  const end = Math.min(start + size, total);
  const chunk = filtered.slice(start, end);

  // Render Table
  if (chunk.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color: var(--text-muted);">No medicines found.</td></tr>`;
  } else {
    tableBody.innerHTML = chunk.map(m => {
      const isOutOfStock = m.stock_status === 'Out of Stock';
      let statusHtml = '';
      if (isOutOfStock) {
        statusHtml = `<span class="badge badge-danger">Out of Stock</span>`;
      } else {
        statusHtml = `<span class="badge badge-success">In Stock</span>`;
      }

      return `
        <tr data-id="${m.id}">
          <td style="font-weight: 600; color: #0F8B6D;">${m.code || '-'}</td>
          <td style="font-weight: 500;">${m.name || '-'}</td>
          <td>${m.category || '-'}</td>
          <td>${m.company || '-'}</td>
          <td>Rs. ${m.purchase_price || 0} / Rs. ${m.selling_price || 0}</td>
          <td style="font-weight: 600; color: ${isOutOfStock ? 'red' : 'inherit'}">${m.quantity_remaining || 0} units</td>
          <td>${m.min_stock_alert || 0} units</td>
          <td>${statusHtml}</td>
          <td>
            <button type="button" class="btn btn-outline btn-edit-med-dir" style="padding: 4px 8px; font-size: 11px; height: 26px; width: auto; display:inline-flex; align-items:center; gap:4px;">
              Edit
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Bind edit buttons
  tableBody.querySelectorAll('.btn-edit-med-dir').forEach(btn => {
    btn.addEventListener('click', function() {
      const row = this.closest('tr');
      const id = row.dataset.id;
      const med = allRecordsState.medicines.find(m => m.id == id);
      if (med && state.populateMedicineForm) {
        navigateTo('inventory');
        state.populateMedicineForm(med);
      }
    });
  });

  // Render Pagination Info & Controls
  pagInfo.textContent = total > 0
    ? `Showing ${start + 1} to ${end} of ${total} entries`
    : `Showing 0 to 0 of 0 entries`;

  renderPaginationControls(pagControls, allRecordsState.medicinesPage, pages, (p) => {
    allRecordsState.medicinesPage = p;
    renderMedicinesDirectory();
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   CLINIC DIRECTORY PDF EXPORT FUNCTIONS
   ════════════════════════════════════════════════════════════════════════════ */

window.exportPatientListPDF = function() {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      showToast('error', 'PDF Error', 'jsPDF library not loaded.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Header
    doc.setFillColor(15, 139, 109); // #0F8B6D
    doc.rect(0, 0, 297, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('ATTA HOMEOPATHIC CLINIC', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Patients Directory Report • Date: ${todayStr}`, 14, 18);

    const filtered = allRecordsState.patients.filter(p => {
      const name = (p.name || '').toLowerCase();
      const whatsapp = (p.whatsapp_number || '').toLowerCase();
      const regNo = String(p.registration_no || p.reg_id || '').toLowerCase();
      const address = (p.address || p.city || '').toLowerCase();
      const query = allRecordsState.patientsQuery || '';
      return name.includes(query) || whatsapp.includes(query) || regNo.includes(query) || address.includes(query);
    });

    const tableRows = filtered.map(p => [
      p.registration_no || p.reg_id || p.ire_id || 'N/A',
      p.name || (p.first_name + ' ' + (p.last_name || '')),
      p.gender || 'N/A',
      p.age ? `${p.age} yrs` : 'N/A',
      p.blood_group || 'N/A',
      p.whatsapp_number || 'Not Provided',
      p.address || p.city || 'N/A',
      p.registration_date || (p.created_at ? p.created_at.split(' ')[0] : 'N/A')
    ]);

    doc.autoTable({
      startY: 28,
      head: [['Reg No.', 'Patient Name', 'Gender', 'Age', 'Blood Group', 'WhatsApp', 'Address / City', 'Reg Date']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 139, 109], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 28, left: 14, right: 14 }
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`ATTA HOMEOPATHIC CLINIC • Page ${i} of ${totalPages}`, 147, 203, { align: 'center' });
    }

    doc.save(`Patients_Directory_${todayStr.replace(/\s+/g, '_')}.pdf`);
    showToast('success', '📄 PDF Exported', 'Patients Directory PDF generated successfully.');
  } catch (err) {
    console.error('Export Patients PDF error:', err);
    showToast('error', 'Export Failed', err.message);
  }
};

window.exportMedicineListPDF = function() {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      showToast('error', 'PDF Error', 'jsPDF library not loaded.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Header
    doc.setFillColor(15, 139, 109); // #0F8B6D
    doc.rect(0, 0, 297, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('ATTA HOMEOPATHIC CLINIC', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Medicine Inventory Directory Report • Date: ${todayStr}`, 14, 18);

    const filtered = allRecordsState.medicines.filter(m => {
      if (allRecordsState.filterOutOfStock && m.stock_status !== 'Out of Stock') {
        return false;
      }
      const name = (m.name || '').toLowerCase();
      const code = (m.code || '').toLowerCase();
      const category = (m.category || '').toLowerCase();
      const company = (m.company || '').toLowerCase();
      const query = allRecordsState.medicinesQuery || '';
      return name.includes(query) || code.includes(query) || category.includes(query) || company.includes(query);
    });

    const tableRows = filtered.map((m, idx) => [
      String(idx + 1),
      m.name || '-',
      m.category || '-',
      m.company || '-',
      `Buy: Rs.${m.purchase_price || 0} / Sell: Rs.${m.selling_price || 0}`,
      `${m.quantity_remaining || 0} units`,
      `${m.min_stock_alert || 0} units`,
      m.stock_status || 'In Stock'
    ]);

    doc.autoTable({
      startY: 28,
      head: [['Serial No.', 'Medicine Name', 'Category', 'Company', 'Price (Buy/Sell)', 'Remaining Stock', 'Alert Min', 'Stock Status']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 139, 109], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 28, left: 14, right: 14 }
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`ATTA HOMEOPATHIC CLINIC • Page ${i} of ${totalPages}`, 147, 203, { align: 'center' });
    }

    doc.save(`Medicine_Inventory_${todayStr.replace(/\s+/g, '_')}.pdf`);
    showToast('success', '📄 PDF Exported', 'Medicine Directory PDF generated successfully.');
  } catch (err) {
    console.error('Export Medicines PDF error:', err);
    showToast('error', 'Export Failed', err.message);
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   CLINIC DIRECTORY PDF EXPORT FUNCTIONS
   ════════════════════════════════════════════════════════════════════════════ */

window.exportPatientListPDF = function() {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      showToast('error', 'PDF Error', 'jsPDF library not loaded.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Header
    doc.setFillColor(15, 139, 109); // #0F8B6D
    doc.rect(0, 0, 297, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('ATTA HOMEOPATHIC CLINIC', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Patients Directory Report • Date: ${todayStr}`, 14, 18);

    const filtered = allRecordsState.patients.filter(p => {
      const name = (p.name || '').toLowerCase();
      const whatsapp = (p.whatsapp_number || '').toLowerCase();
      const regNo = String(p.registration_no || p.reg_id || '').toLowerCase();
      const address = (p.address || p.city || '').toLowerCase();
      const query = allRecordsState.patientsQuery || '';
      return name.includes(query) || whatsapp.includes(query) || regNo.includes(query) || address.includes(query);
    });

    const tableRows = filtered.map(p => [
      p.registration_no || p.reg_id || p.ire_id || 'N/A',
      p.name || (p.first_name + ' ' + (p.last_name || '')),
      p.gender || 'N/A',
      p.age ? `${p.age} yrs` : 'N/A',
      p.blood_group || 'N/A',
      p.whatsapp_number || 'Not Provided',
      p.address || p.city || 'N/A',
      p.registration_date || (p.created_at ? p.created_at.split(' ')[0] : 'N/A')
    ]);

    doc.autoTable({
      startY: 28,
      head: [['Reg No.', 'Patient Name', 'Gender', 'Age', 'Blood Group', 'WhatsApp', 'Address / City', 'Reg Date']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 139, 109], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 28, left: 14, right: 14 }
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`ATTA HOMEOPATHIC CLINIC • Page ${i} of ${totalPages}`, 147, 203, { align: 'center' });
    }

    doc.save(`Patients_Directory_${todayStr.replace(/\s+/g, '_')}.pdf`);
    showToast('success', '📄 PDF Exported', 'Patients Directory PDF generated successfully.');
  } catch (err) {
    console.error('Export Patients PDF error:', err);
    showToast('error', 'Export Failed', err.message);
  }
};

window.exportMedicineListPDF = function() {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      showToast('error', 'PDF Error', 'jsPDF library not loaded.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Header
    doc.setFillColor(15, 139, 109); // #0F8B6D
    doc.rect(0, 0, 297, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('ATTA HOMEOPATHIC CLINIC', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Medicine Inventory Directory Report • Date: ${todayStr}`, 14, 18);

    const filtered = allRecordsState.medicines.filter(m => {
      if (allRecordsState.filterOutOfStock && m.stock_status !== 'Out of Stock') {
        return false;
      }
      const name = (m.name || '').toLowerCase();
      const code = (m.code || '').toLowerCase();
      const category = (m.category || '').toLowerCase();
      const company = (m.company || '').toLowerCase();
      const query = allRecordsState.medicinesQuery || '';
      return name.includes(query) || code.includes(query) || category.includes(query) || company.includes(query);
    });

    const tableRows = filtered.map(m => [
      m.code || '-',
      m.name || '-',
      m.category || '-',
      m.company || '-',
      `Buy: Rs.${m.purchase_price || 0} / Sell: Rs.${m.selling_price || 0}`,
      `${m.quantity_remaining || 0} units`,
      `${m.min_stock_alert || 0} units`,
      m.stock_status || 'In Stock'
    ]);

    doc.autoTable({
      startY: 28,
      head: [['Code', 'Medicine Name', 'Category', 'Company', 'Price (Buy/Sell)', 'Remaining Stock', 'Alert Min', 'Stock Status']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 139, 109], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 28, left: 14, right: 14 }
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`ATTA HOMEOPATHIC CLINIC • Page ${i} of ${totalPages}`, 147, 203, { align: 'center' });
    }

    doc.save(`Medicine_Inventory_${todayStr.replace(/\s+/g, '_')}.pdf`);
    showToast('success', '📄 PDF Exported', 'Medicine Directory PDF generated successfully.');
  } catch (err) {
    console.error('Export Medicines PDF error:', err);
    showToast('error', 'Export Failed', err.message);
  }
};

function renderPaginationControls(container, currentPage, totalPages, onPageClick) {
  if (!container) return;
  
  let html = '';
  
  // Previous button
  html += `
    <button class="btn btn-outline" ${currentPage === 1 ? 'disabled' : ''} style="height:32px; padding:0 12px; margin:0;" data-action="prev">
      Prev
    </button>
  `;

  // Page numbers
  const maxPagesToShow = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  if (endPage - startPage < maxPagesToShow - 1) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="btn ${i === currentPage ? 'btn-submit' : 'btn-outline'}" style="height:32px; width:32px; padding:0; margin:0;" data-page="${i}">
        ${i}
      </button>
    `;
  }

  // Next button
  html += `
    <button class="btn btn-outline" ${currentPage === totalPages ? 'disabled' : ''} style="height:32px; padding:0 12px; margin:0;" data-action="next">
      Next
    </button>
  `;

  container.innerHTML = html;

  // Add event listeners
  container.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      onPageClick(parseInt(btn.dataset.page));
    });
  });

  const prevBtn = container.querySelector('button[data-action="prev"]');
  if (prevBtn && currentPage > 1) {
    prevBtn.addEventListener('click', () => {
      onPageClick(currentPage - 1);
    });
  }

  const nextBtn = container.querySelector('button[data-action="next"]');
  if (nextBtn && currentPage < totalPages) {
    nextBtn.addEventListener('click', () => {
      onPageClick(currentPage + 1);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function initTabs() {
  const tabs = document.querySelectorAll('.btn-tab-analytics');
  const canvases = document.querySelectorAll('.analytics-canvas-item');
  const descEl = document.getElementById('analytics-tab-description');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const btn = e.currentTarget || e.target;
      // Reset all tabs to unselected pill state
      tabs.forEach(t => {
        t.classList.remove('active');
        t.style.background = 'transparent';
        t.style.color = '#475569';
        t.style.fontWeight = '600';
        t.style.boxShadow = 'none';
      });
      
      // Hide all canvases
      canvases.forEach(c => c.style.display = 'none');

      // Set clicked tab to active gradient state
      const targetId = btn.dataset.target;
      btn.classList.add('active');
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      btn.style.color = 'white';
      btn.style.fontWeight = '700';
      btn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';

      // Update dynamic description text
      if (descEl && btn.dataset.desc) {
        descEl.textContent = btn.dataset.desc;
      }

      // Show target canvas
      const targetCanvas = document.getElementById(targetId);
      if (targetCanvas) {
        targetCanvas.style.display = 'block';
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTabs);
} else {
  initTabs();
}

window.exportPatientListPDF = async function() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('error', 'PDF library not loaded yet.', '');
    return;
  }

  // ── Show loading toast ──
  showToast('info', 'Generating Directory PDF…', 'Fetching patient data, please wait.');

  // ── Fetch patients with their latest visit in one query ──
  let patients = [];
  try {
    patients = await apiFetch(`${API}/patients/with-latest-visit`);
    if (!Array.isArray(patients)) patients = [];
  } catch (e) {
    showToast('error', 'Fetch Error', 'Could not load patient data: ' + e.message);
    return;
  }

  // Apply any active directory search filter
  const q = (allRecordsState.patientsQuery || '').toLowerCase();
  if (q) {
    patients = patients.filter(p => {
      const name = (p.name || p.first_name || '').toLowerCase();
      const whatsapp = (p.whatsapp_number || '').toLowerCase();
      const reg = String(p.reg_id || p.ire_id || p.registration_no || '').toLowerCase();
      const city = (p.city || '').toLowerCase();
      return name.includes(q) || whatsapp.includes(q) || reg.includes(q) || city.includes(q);
    });
  }

  if (patients.length === 0) {
    showToast('warning', 'No Patients', 'No patients found to export.');
    return;
  }

  // ── jsPDF setup ──
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, ML = 12, MR = 12, CW = PW - ML - MR;
  const pH = doc.internal.pageSize.getHeight(); // 297

  // Colour palette
  const GREEN   = [15, 139, 109];
  const GREEN_D = [10, 100, 78];
  const GREEN_LT= [232, 248, 244];
  const GRAY    = [100, 116, 139];
  const DARK    = [30, 41, 59];
  const WHITE   = [255, 255, 255];
  const STRIPE1 = [248, 252, 250];
  const STRIPE2 = [255, 255, 255];

  // ── Try to load Gulzar font (Google Fonts CDN) for Urdu text ──
  let gulzarLoaded = false;
  try {
    const fontUrl = 'https://fonts.gstatic.com/s/gulzar/v14/Wnz6HAc9eB3HB2ILYQ.ttf';
    const response = await fetch(fontUrl);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const uint8  = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const b64 = btoa(binary);
      doc.addFileToVFS('Gulzar-Regular.ttf', b64);
      doc.addFont('Gulzar-Regular.ttf', 'Gulzar', 'normal', 'Identity-H');
      gulzarLoaded = true;
    }
  } catch (_) { /* Offline – fall back to Helvetica */ }

  // Detect if text contains Urdu/Arabic characters
  const isUrdu = text => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text || '');

  // Draw Urdu-aware text using Google Gulzar Font
  function drawText(d, text, x, y, opts = {}) {
    if (!text || text === '—') { d.text('—', x, y, opts); return; }
    if (isUrdu(text) && gulzarLoaded) {
      d.setFont('Gulzar', 'normal');
      d.text(text, x, y, { ...opts, isInputVisual: false, isInputRtl: true, isOutputRtl: true });
      d.setFont('helvetica', opts.fontStyle || 'normal');
    } else {
      d.text(text, x, y, opts);
    }
  }

  // ── Page header (drawn on every page) ──
  let pageNum = 1;
  function drawPageHeader() {
    doc.setFillColor(...GREEN_D);
    doc.rect(0, 0, PW, 16, 'F');

    doc.setTextColor(...WHITE);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(CLINIC_NAME, PW / 2, 7, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Clinical Patient Directory', PW / 2, 12.5, { align: 'center' });

    doc.setFontSize(7);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, PW - MR, 5.5, { align: 'right' });
    doc.text(`Page ${pageNum}`, PW - MR, 10, { align: 'right' });

    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.5);
    doc.line(0, 16, PW, 16);

    doc.setTextColor(...DARK);
  }

  function newPage() {
    doc.addPage();
    pageNum++;
    drawPageHeader();
    return 22;
  }

  // Column definitions (Simplified: Patient Name, Phone / WhatsApp, Medicines)
  const COL = {
    sNo:   { x: ML,       w: 12 },
    name:  { x: ML + 12,  w: 58 },
    phone: { x: ML + 70,  w: 45 },
    meds:  { x: ML + 115, w: 71 }
  };

  function drawColHeaders(y) {
    doc.setFillColor(...GREEN);
    doc.rect(ML, y, CW, 7, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const cy = y + 4.8;
    doc.text('#',                     COL.sNo.x + 1,   cy);
    doc.text('Patient Name',          COL.name.x + 1,  cy);
    doc.text('Phone / WhatsApp',      COL.phone.x + 1, cy);
    doc.text('Prescribed Medicines',  COL.meds.x + 1,  cy);
    doc.setTextColor(...DARK);
    return y + 7;
  }

  // ── Main PDF Construction ──
  drawPageHeader();
  let y = 20;

  // Summary bar
  doc.setFillColor(...GREEN_LT);
  doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN_D);
  doc.text(`Total Patients: ${patients.length}`, ML + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Simplified Directory View`, PW - MR, y + 5.5, { align: 'right' });
  doc.setTextColor(...DARK);
  y += 10;

  y = drawColHeaders(y);

  // ── Patient rows ──
  patients.forEach((p, idx) => {
    const patName = p.name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || 'Unknown';
    const phone = p.phone || p.whatsapp_number || '—';

    // Medicines (JSON parsed or plain text)
    let medText = 'No medicines prescribed';
    if (p.medicines) {
      try {
        const meds = JSON.parse(p.medicines);
        if (Array.isArray(meds) && meds.length > 0) {
          medText = meds.map((m, mi) => {
            const parts = [m.name || ''];
            if (m.dosage) parts.push(m.dosage);
            if (m.frequency) parts.push(m.frequency);
            if (m.duration) parts.push(m.duration);
            return `${mi + 1}. ${parts.join(' | ')}`;
          }).join('\n');
        } else if (typeof p.medicines === 'string' && p.medicines.trim()) {
          medText = p.medicines.trim();
        }
      } catch (_) {
        if (p.medicines.trim()) medText = p.medicines.trim();
      }
    }

    const nameLines = doc.splitTextToSize(patName, COL.name.w - 2);
    const phoneLines = doc.splitTextToSize(phone, COL.phone.w - 2);
    const medLines = doc.splitTextToSize(medText, COL.meds.w - 2);

    const maxLineCount = Math.max(nameLines.length, phoneLines.length, medLines.length, 1);
    const rowH = Math.max(8, maxLineCount * 5 + 4);

    if (y + rowH + 4 > pH - 14) {
      y = newPage();
      y = drawColHeaders(y);
    }

    // Alternating stripe
    doc.setFillColor(...(idx % 2 === 0 ? STRIPE1 : STRIPE2));
    doc.rect(ML, y, CW, rowH, 'F');

    // Light border
    doc.setDrawColor(220, 232, 228);
    doc.setLineWidth(0.15);
    doc.rect(ML, y, CW, rowH, 'S');

    const ty = y + 4.8;

    // Serial #
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(String(idx + 1), COL.sNo.x + 1, ty);

    // Patient name
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    nameLines.forEach((nl, nli) => {
      drawText(doc, nl, COL.name.x + 1, ty + nli * 5, { fontStyle: 'bold' });
    });

    // Phone / WhatsApp
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    phoneLines.forEach((pl, pli) => {
      drawText(doc, pl, COL.phone.x + 1, ty + pli * 5);
    });

    // Medicines
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 60, 50);
    medLines.forEach((ml, mli) => {
      drawText(doc, ml, COL.meds.x + 1, ty + mli * 5);
    });

    y += rowH;
  });

  // Footer
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(ML, pH - 10, ML + CW, pH - 10);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  doc.text(
    `${CLINIC_NAME}  •  Total ${patients.length} patient(s)  •  Printed ${new Date().toLocaleString()}`,
    PW / 2, pH - 6, { align: 'center' }
  );

  const fileName = `Clinical_Directory_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
  showToast('success', '✅ PDF Exported', `Saved as ${fileName}`);
};


window.exportMedicineListPDF = function() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('Error', 'PDF library not loaded yet.', 3000);
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const filtered = allRecordsState.medicines.filter(m => {
    if (allRecordsState.filterOutOfStock && m.stock_status !== 'Out of Stock') {
      return false;
    }
    const name = (m.name || '').toLowerCase();
    const code = (m.code || '').toLowerCase();
    const category = (m.category || '').toLowerCase();
    const company = (m.company || '').toLowerCase();
    const query = allRecordsState.medicinesQuery || '';
    return name.includes(query) || code.includes(query) || category.includes(query) || company.includes(query);
  });

  doc.setFontSize(18);
  doc.text("Clinic Medicine Inventory", 14, 22);
  doc.setFontSize(11);
  doc.text("Generated on " + new Date().toLocaleDateString(), 14, 30);

  const tableData = filtered.map(m => [
    (m && m.name) ? m.name : '-',
    (m && m.category) ? m.category : '-',
    (m && m.company) ? m.company : '-',
    (m && m.quantity_remaining !== undefined) ? m.quantity_remaining.toString() : '-'
  ]);

  doc.autoTable({
    head: [['Medicine Name', 'Category', 'Company', 'In Stock']],
    body: tableData,
    startY: 36,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [15, 139, 109] }
  });

  doc.save('Medicine_Inventory.pdf');
};

/* ════════════════════════════════════════════════════════════════════════════
   BULK PRINT FEATURE
════════════════════════════════════════════════════════════════════════════ */

window.openBulkPrintModal = function() {
  const modal = document.getElementById('bulk-print-modal');
  if (!modal) return;
  document.getElementById('bulk-print-progress').style.display = 'none';
  document.getElementById('bulk-print-progress-bar').style.width = '0%';
  document.getElementById('bulk-print-status').textContent = 'Preparing...';
  const btn = document.getElementById('btn-start-bulk-print');
  btn.disabled = false;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:6px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Generate PDF`;
  modal.style.display = 'flex';
};

window.closeBulkPrintModal = function() {
  const modal = document.getElementById('bulk-print-modal');
  if (modal) modal.style.display = 'none';
};

window.startBulkPrint = async function() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('error', 'PDF library not loaded', 'Please wait and try again.');
    return;
  }
  const fromVal = parseInt(document.getElementById('bulk-from').value, 10);
  const toVal   = parseInt(document.getElementById('bulk-to').value, 10);
  if (isNaN(fromVal) || isNaN(toVal) || fromVal < 1 || toVal < fromVal) {
    showToast('warning', 'Invalid Range', 'Please enter a valid From and To registration number.');
    return;
  }
  const btn = document.getElementById('btn-start-bulk-print');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  const progressWrap = document.getElementById('bulk-print-progress');
  const progressBar  = document.getElementById('bulk-print-progress-bar');
  const statusEl     = document.getElementById('bulk-print-status');
  progressWrap.style.display = 'block';

  let allPatients = [];
  try {
    const res = await apiFetch(`${API}/patients/all`);
    allPatients = Array.isArray(res) ? res : (res.patients || []);
  } catch (e) {
    showToast('error', 'Fetch Error', 'Could not load patient list: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Generate PDF';
    return;
  }

  const inRange = allPatients.filter(p => {
    const regNo = parseInt(p.reg_id || p.registration_no || p.ire_id || p.id, 10);
    return regNo >= fromVal && regNo <= toVal;
  });

  if (inRange.length === 0) {
    showToast('warning', 'No Patients Found', `No patients with registration numbers ${fromVal}–${toVal}.`);
    btn.disabled = false;
    btn.textContent = 'Generate PDF';
    progressWrap.style.display = 'none';
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, ML = 14, MR = 14, CW = PW - ML - MR;
  const GREEN = [15, 139, 109], GREEN_LT = [232, 248, 244], GRAY = [100, 116, 139];
  const DARK = [30, 41, 59], WHITE = [255, 255, 255];

  // ── Try to load Gulzar font (Google Fonts CDN) for Urdu text ──
  let gulzarLoaded = false;
  try {
    const fontUrl = 'https://fonts.gstatic.com/s/gulzar/v11/PbykFmXiEBPT4ITbgNA5Rg.ttf';
    const response = await fetch(fontUrl);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const b64 = btoa(binary);
      doc.addFileToVFS('Gulzar-Regular.ttf', b64);
      doc.addFont('Gulzar-Regular.ttf', 'Gulzar', 'normal');
      gulzarLoaded = true;
    }
  } catch (_) { /* Offline fallback */ }

  const isUrdu = text => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text || '');

  function drawText(d, text, x, y, opts = {}) {
    if (!text || text === '—') { d.text('—', x, y, opts); return; }
    if (isUrdu(text) && gulzarLoaded) {
      d.setFont('Gulzar', 'normal');
      d.text(text, x, y, { ...opts, isInputVisual: false, isInputRtl: true, isOutputRtl: true });
      d.setFont('helvetica', opts.fontStyle || 'normal');
    } else {
      d.text(text, x, y, opts);
    }
  }

  function sectionHeader(d, y, label, color) {
    d.setFillColor(...color);
    d.roundedRect(ML, y, CW, 7, 1.5, 1.5, 'F');
    d.setTextColor(...WHITE);
    d.setFontSize(8.5);
    d.setFont('helvetica', 'bold');
    d.text(label, ML + 3, y + 4.8);
    d.setTextColor(...DARK);
    return y + 9;
  }

  async function renderPatient(d, patient, visits, isFirst) {
    const pH = d.internal.pageSize.getHeight();
    if (!isFirst) d.addPage();
    let y = 14;

    const addPage = () => {
      d.addPage();
      d.setFillColor(...GREEN);
      d.rect(0, 0, PW, 8, 'F');
      d.setTextColor(...WHITE);
      d.setFontSize(8);
      d.setFont('helvetica', 'bold');
      d.text(CLINIC_NAME, PW / 2, 5.5, { align: 'center' });
      d.setTextColor(...DARK);
      y = 14;
    };

    // Clinic header
    d.setFillColor(...GREEN);
    d.rect(0, 0, PW, 12, 'F');
    d.setTextColor(...WHITE);
    d.setFontSize(11);
    d.setFont('helvetica', 'bold');
    d.text(CLINIC_NAME, PW / 2, 8, { align: 'center' });
    d.setTextColor(...DARK);
    y = 16;

    const patName = patient.name || ((patient.first_name || '') + ' ' + (patient.last_name || '')).trim() || 'Unknown';
    const phone = patient.whatsapp_number || '-';

    // Patient Info Banner
    d.setFillColor(...GREEN_LT);
    d.roundedRect(ML, y, CW, 16, 2, 2, 'F');
    d.setFontSize(12); d.setFont('helvetica', 'bold'); d.setTextColor(...GREEN);
    drawText(d, patName, ML + 4, y + 7, { fontStyle: 'bold' });

    d.setFontSize(8.5); d.setFont('helvetica', 'normal'); d.setTextColor(...GRAY);
    d.text('WhatsApp: ' + phone, ML + 4, y + 13);
    d.text('Printed: ' + new Date().toLocaleDateString('en-GB'), PW - MR, y + 13, { align: 'right' });
    y += 20;

    // Prescribed Medicines Section
    y = sectionHeader(d, y, '  PRESCRIBED MEDICINES', GREEN);

    // Extract all medicines across visits or patient record
    let medList = [];
    if (visits && visits.length > 0) {
      visits.forEach(v => {
        if (v.medicines) {
          try {
            const parsed = JSON.parse(v.medicines);
            if (Array.isArray(parsed)) medList.push(...parsed);
            else medList.push({ name: v.medicines });
          } catch (_) {
            medList.push({ name: v.medicines });
          }
        }
      });
    }

    if (medList.length === 0 && patient.medicines) {
      try {
        const parsed = JSON.parse(patient.medicines);
        if (Array.isArray(parsed)) medList.push(...parsed);
        else medList.push({ name: patient.medicines });
      } catch (_) {
        medList.push({ name: patient.medicines });
      }
    }

    if (medList.length === 0) {
      d.setFontSize(9); d.setFont('helvetica', 'italic'); d.setTextColor(...GRAY);
      d.text('No medicines recorded for this patient.', ML + 4, y + 5);
      y += 10;
    } else {
      medList.forEach((m, mi) => {
        if (y + 10 > pH - 20) { addPage(); }
        const mName = m.name || '';
        const parts = [mName];
        if (m.dosage) parts.push(`Potency: ${m.dosage}`);
        if (m.frequency) parts.push(`Dosage: ${m.frequency}`);
        if (m.duration) parts.push(`Duration: ${m.duration}`);
        if (m.instructions) parts.push(`(${m.instructions})`);

        const lineText = `${mi + 1}. ${parts.join('  |  ')}`;
        const lines = d.splitTextToSize(lineText, CW - 8);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK);

        lines.forEach((line, li) => {
          drawText(d, line, ML + 4, y + 4 + li * 5);
        });

        y += lines.length * 5 + 3;
      });
    }

    // Footer
    d.setFontSize(7); d.setFont('helvetica', 'italic'); d.setTextColor(...GRAY);
    d.text(`${CLINIC_NAME}  •  Printed: ${new Date().toLocaleString()}`, PW / 2, pH - 6, { align: 'center' });
    d.setDrawColor(...GREEN); d.setLineWidth(0.4);
    d.line(ML, pH - 10, ML + CW, pH - 10);
  }

  // Main loop
  let isFirst = true;
  for (let i = 0; i < inRange.length; i++) {
    const summary = inRange[i];
    progressBar.style.width = Math.round(((i) / inRange.length) * 100) + '%';
    statusEl.textContent = `Processing ${i + 1} of ${inRange.length}: ${summary.name || summary.first_name || ''}…`;
    try {
      const data = await apiFetch(`${API}/patient/${summary.id}`);
      const patient = data.patient || data;
      const visits  = data.visits || [];
      await renderPatient(doc, patient, visits, isFirst);
      isFirst = false;
    } catch (e) {
      console.warn('Could not load patient', summary.id, e.message);
    }
  }


  progressBar.style.width = '100%';
  statusEl.textContent = 'Done! Saving PDF…';
  const fileName = `Bulk_Records_${fromVal}-${toVal}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(fileName);
  setTimeout(() => {
    closeBulkPrintModal();
    showToast('success', 'Bulk Print Complete', `PDF saved: ${fileName}`);
  }, 600);
};

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD CLINICAL UTILITIES (STOPWATCH, CALCULATOR & SCRATCHPAD)
════════════════════════════════════════════════════════════════════════════ */

const _swDial = {
  running: false,
  startTime: 0,
  elapsed: 0,
  lapElapsed: 0,
  laps: [],
  animId: null
};

function _swFormatDial(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const milli = ms % 1000;
  
  const mmStr = String(m).padStart(2, '0');
  const ssStr = String(s).padStart(2, '0');
  const mmmStr = String(milli).padStart(3, '0');

  return { mmStr, ssStr, mmmStr, text: `${mmStr}:${ssStr}.${mmmStr}`, secVal: s + (milli / 1000) };
}

function _swTickDial() {
  if (!_swDial.running) return;
  const currentTotal = _swDial.elapsed + (Date.now() - _swDial.startTime);
  const fmt = _swFormatDial(currentTotal);

  const dispEl = document.getElementById('sw-digital-display');
  if (dispEl) {
    dispEl.innerHTML = `${fmt.mmStr}:<span style="color: #38bdf8;">${fmt.ssStr}</span>.<span style="font-size: 26px; color: #38bdf8;">${fmt.mmmStr}</span>`;
  }

  // Rotate green second hand (360 degrees = 60 seconds -> 6 deg per second)
  const handEl = document.getElementById('sw-sec-hand');
  if (handEl) {
    const degrees = (fmt.secVal / 60) * 360;
    handEl.style.transform = `rotate(${degrees}deg)`;
  }

  _swDial.animId = requestAnimationFrame(_swTickDial);
}

window.stopwatchToggleDial = function() {
  const btnIcon = document.getElementById('sw-toggle-icon');
  if (_swDial.running) {
    // Pause
    _swDial.elapsed += Date.now() - _swDial.startTime;
    _swDial.running = false;
    if (_swDial.animId) cancelAnimationFrame(_swDial.animId);
    if (btnIcon) btnIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; // Play icon
  } else {
    // Start
    _swDial.startTime = Date.now();
    _swDial.running = true;
    if (_swDial.animId) cancelAnimationFrame(_swDial.animId);
    _swDial.animId = requestAnimationFrame(_swTickDial);
    if (btnIcon) btnIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; // Pause icon
  }
};

window.stopwatchResetDial = function() {
  _swDial.running = false;
  _swDial.elapsed = 0;
  _swDial.lapElapsed = 0;
  _swDial.laps = [];
  if (_swDial.animId) cancelAnimationFrame(_swDial.animId);

  const dispEl = document.getElementById('sw-digital-display');
  if (dispEl) {
    dispEl.innerHTML = `00:<span style="color: #38bdf8;">00</span>.<span style="font-size: 26px; color: #38bdf8;">000</span>`;
  }

  const handEl = document.getElementById('sw-sec-hand');
  if (handEl) {
    handEl.style.transform = `rotate(0deg)`;
  }

  const btnIcon = document.getElementById('sw-toggle-icon');
  if (btnIcon) btnIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';

  const lapsList = document.getElementById('sw-laps-list');
  if (lapsList) lapsList.innerHTML = '';
};

window.stopwatchLapDial = function() {
  if (!_swDial.running) return;
  const total = _swDial.elapsed + (Date.now() - _swDial.startTime);
  const split = total - _swDial.lapElapsed;
  _swDial.lapElapsed = total;

  _swDial.laps.push({ lap: _swDial.laps.length + 1, total, split });
  const lapsList = document.getElementById('sw-laps-list');
  if (lapsList) {
    const row = document.createElement('div');
    row.style.cssText = 'padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #94a3b8; display: flex; justify-content: space-between; align-items: center;';
    const splitFmt = _swFormatDial(split).text;
    const totalFmt = _swFormatDial(total).text;
    row.innerHTML = `<span style="font-weight:700; color:#e2e8f0;">Lap ${_swDial.laps.length}</span><span style="color:#38bdf8;">${splitFmt}</span><span>${totalFmt}</span>`;
    lapsList.prepend(row);
  }
};

/* ─── DASHBOARD MEDICAL CALCULATOR ─── */
const _dashCalc = { expr: '', hasResult: false };

window.dashCalcInput = function(key) {
  const display = document.getElementById('dash-calc-display');
  const exprEl = document.getElementById('dash-calc-expr');
  if (!display || !exprEl) return;

  if (key === 'C') {
    _dashCalc.expr = '';
    _dashCalc.hasResult = false;
    display.textContent = '0';
    exprEl.textContent = '';
    return;
  }

  if (key === 'DEL') {
    if (_dashCalc.expr.length > 0) {
      _dashCalc.expr = _dashCalc.expr.slice(0, -1);
      display.textContent = _dashCalc.expr || '0';
    }
    return;
  }

  if (key === '=') {
    try {
      let evalStr = _dashCalc.expr.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');
      if (!/^[0-9+\-*/.%() ]+$/.test(evalStr)) throw new Error('Invalid');
      evalStr = evalStr.replace(/(\d+(\.\d+)?)%/g, '($1/100)');
      let result = Function('"use strict"; return (' + evalStr + ')')();
      result = parseFloat(result.toPrecision(12));
      exprEl.textContent = _dashCalc.expr + ' =';
      display.textContent = result;
      _dashCalc.expr = String(result);
      _dashCalc.hasResult = true;
    } catch {
      display.textContent = 'Error';
      exprEl.textContent = _dashCalc.expr;
      _dashCalc.expr = '';
      _dashCalc.hasResult = false;
    }
    return;
  }

  if (_dashCalc.hasResult && /[0-9.]/.test(key)) {
    _dashCalc.expr = '';
    _dashCalc.hasResult = false;
  }
  if (_dashCalc.hasResult && /[+\-*/%÷×−]/.test(key)) {
    _dashCalc.hasResult = false;
  }

  const keyMap = { '/': '÷', '*': '×', '-': '−' };
  _dashCalc.expr += keyMap[key] || key;

  display.textContent = _dashCalc.expr || '0';
  exprEl.textContent = _dashCalc.expr.length > 14 ? _dashCalc.expr.slice(0, -14) + '…' : '';
};

// Keyboard shortcut support for Dashboard Calculator
document.addEventListener('keydown', (e) => {
  const activePage = document.querySelector('.page-view.active');
  if (!activePage || activePage.id !== 'page-dashboard') return;

  const targetTag = e.target ? e.target.tagName.toUpperCase() : '';
  if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;

  if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
    dashCalcInput(e.key);
  } else if (['+', '-', '*', '/'].includes(e.key)) {
    dashCalcInput(e.key);
  } else if (e.key === 'Enter' || e.key === '=') {
    e.preventDefault();
    dashCalcInput('=');
  } else if (e.key === 'Backspace') {
    dashCalcInput('DEL');
  } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
    dashCalcInput('C');
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   AZAN ALARM FEATURE
   Continuous 1-Second Time Evaluator with Persistent DB Sync & Audio Autoplay
════════════════════════════════════════════════════════════════════════════ */

const AzanAlarmEngine = {
  prayers: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
  prayerNames: {
    fajr: 'فجر',
    dhuhr: 'ظہر',
    asr: 'عصر',
    maghrib: 'مغرب',
    isha: 'عشاء'
  },
  settings: {
    fajr:    { enabled: true, time: '05:00', audio: 'azan1.mp3' },
    dhuhr:   { enabled: true, time: '13:30', audio: 'azan1.mp3' },
    asr:     { enabled: true, time: '17:00', audio: 'azan1.mp3' },
    maghrib: { enabled: true, time: '18:45', audio: 'azan1.mp3' },
    isha:    { enabled: true, time: '20:15', audio: 'azan1.mp3' }
  },
  // Format: "prayer_YYYY-MM-DD_HH:mm" to ensure alarm fires once per day
  triggeredToday: new Set(),
  audioObj: null,
  audioCtx: null,

  async init() {
    await this.loadSettings();
    this.bindDOMEvents();
    this.setupAudio();
    this.startScheduler();
  },

  async loadSettings() {
    // 1. Try loading from SQLite Database via Backend API
    try {
      const res = await apiFetch('/azan-settings');
      if (res && res.success && res.settings) {
        this.prayers.forEach(p => {
          if (res.settings[p]) {
            this.settings[p] = { ...this.settings[p], ...res.settings[p] };
          }
        });
        console.log('[Azan Alarm] Loaded saved alarms from DB');
      } else {
        // Fallback to localStorage
        const saved = localStorage.getItem('clinic_azan_settings_v4');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.prayers.forEach(p => {
            if (parsed[p]) this.settings[p] = { ...this.settings[p], ...parsed[p] };
          });
          console.log('[Azan Alarm] Loaded saved alarms from LocalStorage');
        }
      }
    } catch (e) {
      console.warn('[Azan Alarm] Failed to load DB settings, using defaults:', e);
    }
    this.syncUI();
    this.logScheduledTimes();
  },

  logScheduledTimes() {
    this.prayers.forEach(p => {
      if (this.settings[p] && this.settings[p].enabled) {
        console.log(`[Azan Alarm] ${this.prayerNames[p]} scheduled for ${this.settings[p].time}`);
      }
    });
  },

  async saveSettings() {
    this.syncFromUI();
    try {
      localStorage.setItem('clinic_azan_settings_v4', JSON.stringify(this.settings));
      await apiPost('/azan-settings', { settings: this.settings });
      showToast('success', '💾 Azan Settings Saved', 'Prayer alarm schedule updated.');
      console.log('[Azan Alarm] Updated alarm settings saved');
    } catch(e) {
      console.error('[Azan Alarm] Save settings error:', e);
    }
  },

  syncFromUI() {
    this.prayers.forEach(p => {
      const tInput = document.getElementById(`azan-time-${p}`);
      const cbInput = document.getElementById(`azan-toggle-${p}`);
      if (!this.settings[p]) this.settings[p] = { enabled: true, time: '00:00', audio: 'azan1.mp3' };
      if (tInput) this.settings[p].time = tInput.value;
      if (cbInput) this.settings[p].enabled = cbInput.checked;
    });
  },

  syncUI() {
    this.prayers.forEach(p => {
      const tInput = document.getElementById(`azan-time-${p}`);
      const cbInput = document.getElementById(`azan-toggle-${p}`);
      if (tInput && this.settings[p].time) tInput.value = this.settings[p].time;
      if (cbInput) cbInput.checked = Boolean(this.settings[p].enabled);
    });
  },

  bindDOMEvents() {
    // Unlock AudioContext on first user interaction so autoplay is never blocked
    const unlock = () => {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    };
    ['click', 'keydown', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, unlock, { once: true });
    });
  },

  setupAudio() {
    try {
      this.audioObj = new Audio('azan1.mp3');
      this.audioObj.preload = 'auto';
    } catch(e) {
      console.warn('[Azan Alarm] Audio init note:', e);
    }
  },

  startScheduler() {
    // Evaluate alarms every 1 second (1000ms) continuously
    setInterval(() => this.evaluateAlarms(), 1000);
  },

  evaluateAlarms() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hh}:${mm}`;
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;

    this.prayers.forEach(p => {
      const config = this.settings[p];
      if (config && config.enabled && config.time === currentTimeStr) {
        const occurrenceKey = `${p}_${todayDateStr}_${currentTimeStr}`;
        if (!this.triggeredToday.has(occurrenceKey)) {
          this.triggeredToday.add(occurrenceKey);
          this.triggerAlarm(p);
        }
      }
    });

    // Cleanup keys older than today
    if (this.triggeredToday.size > 20) {
      this.triggeredToday.forEach(key => {
        if (!key.includes(todayDateStr)) {
          this.triggeredToday.delete(key);
        }
      });
    }
  },

  triggerAlarm(prayerKey) {
    const urduName = this.prayerNames[prayerKey] || prayerKey;
    console.log(`[Azan Alarm] Alarm triggered: ${urduName}`);
    console.log(`[Azan Alarm] Playing azan1.mp3`);

    // 1. Dashboard Announcement Banner
    const banner = document.getElementById('azan-announcement-banner');
    const title = document.getElementById('azan-banner-title');
    if (banner && title) {
      title.textContent = `${urduName} کا وقت ہو گیا ہے`;
      banner.style.display = 'flex';
    }

    // 2. High Priority Urdu Notification Toast
    showToast('info', '🕌 Azan Alarm', `${urduName} کا وقت ہو گیا ہے`);

    // 3. Audio Autoplay Execution
    this.playAudio('azan1.mp3');
  },

  playAudio(filename = 'azan1.mp3') {
    if (!this.audioObj) {
      this.audioObj = new Audio(filename);
    } else {
      this.audioObj.src = filename;
    }
    this.audioObj.currentTime = 0;

    const playPromise = this.audioObj.play();

    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('[Azan Alarm] HTML5 Audio playback started successfully');
      }).catch(err => {
        console.warn('[Azan Alarm] HTML5 play deferred, launching Web Audio buffer:', err);
        this.playWebAudioFallback(filename);
      });
    }

    this.audioObj.onended = () => {
      this.stopAudio();
    };
  },

  playWebAudioFallback(filename) {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!this.audioCtx) this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      fetch(filename)
        .then(res => res.arrayBuffer())
        .then(buf => this.audioCtx.decodeAudioData(buf))
        .then(audioBuffer => {
          if (!audioBuffer) return;
          const src = this.audioCtx.createBufferSource();
          src.buffer = audioBuffer;
          src.connect(this.audioCtx.destination);
          src.start(0);
          src.onended = () => this.stopAudio();
        })
        .catch(e => {
          console.error('[Azan Alarm] Web Audio fallback error:', e);
        });
    } catch(e) {}
  },

  stopAudio() {
    if (this.audioObj) {
      try {
        this.audioObj.pause();
        this.audioObj.currentTime = 0;
      } catch(e) {}
    }
    const banner = document.getElementById('azan-announcement-banner');
    if (banner) banner.style.display = 'none';
  }
};

// Global Exposed Functions
window.saveAzanPrayerSetting = function(prayerKey) {
  AzanAlarmEngine.saveSettings();
};

window.stopAzanAudio = function() {
  AzanAlarmEngine.stopAudio();
  showToast('info', 'Azan Muted', 'Audio playback stopped.');
};

document.addEventListener('DOMContentLoaded', () => {
  initScratchpad();
  AzanAlarmEngine.init();
});



window.handleSavePatientEdit = async function(patientId) {
  if (!patientId) return;
  const payload = {
    first_name: document.getElementById('ep-first-name')?.value.trim() || '',
    guardian_name: document.getElementById('ep-guardian-name')?.value.trim() || '',
    guardian_relationship: document.getElementById('ep-guardian-relationship')?.value || 'Father',
    gender: (document.querySelector('input[name="ep-gender"]:checked') || {}).value || 'Male',
    date_of_birth: document.getElementById('ep-dob')?.value || '',
    age: parseInt(document.getElementById('ep-age')?.value, 10) || null,
    blood_group: document.getElementById('ep-blood')?.value || '',
    weight: parseFloat(document.getElementById('ep-weight')?.value) || null,
    whatsapp_number: document.getElementById('ep-whatsapp')?.value.trim() || '',
    city: document.getElementById('ep-city')?.value.trim() || '',
    address: document.getElementById('ep-address')?.value.trim() || '',
    allergies: document.getElementById('ep-allergies')?.value.trim() || '',
    symptoms: document.getElementById('ep-symptoms')?.value.trim() || '',
    medical_history: document.getElementById('ep-medical-history')?.value.trim() || '',
    patient_image: document.getElementById('ep-patient-image-data')?.value || ''
  };

  const btn = document.getElementById('btn-update-patient') || document.getElementById('btn-save-patient-edit') || document.getElementById('ep-btn-save-patient-edit');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const result = await apiFetch(`${API}/patient/${patientId}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (result.success) {
      showToast('success', 'Patient Updated', 'The patient record was successfully updated.');
      const editForm = document.getElementById('form-edit-patient') || document.getElementById('edit-patient-form');
      if (editForm) {
        editForm.style.display = 'none';
        editForm.classList.remove('visible');
        editForm.style.display = 'none';
      }
      if (typeof fetchPatients === 'function') fetchPatients();
      if (state.currentPatientId === patientId && typeof renderPanelDetails !== 'undefined' && window._currentPatientData) {
         // Optionally refresh the panel
         const data = await apiFetch(`${API}/patient/${patientId}`);
         window._currentPatientData = data.patient || data;
         renderPanelDetails(window._currentPatientData, true);
      }
    } else {
      showToast('error', 'Update Failed', result.error || 'Failed to update patient.');
    }
  } catch (err) {
    console.error(err);
    showToast('error', 'Error', 'An error occurred while updating.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Update Patient'; }
  }
};

window.enterSlidingEditMode = function(id) {
  promptAdminPassword(() => {
    if (window._currentPatientData) {
      renderPanelDetails(window._currentPatientData, true);
    }
  });
};


// New Global Bindings for Edit Patient Form
document.addEventListener('DOMContentLoaded', () => {

  const btnCancelEdit = document.getElementById('ep-btn-cancel') || document.getElementById('btn-cancel-patient-edit');
  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('edit-patient-form').classList.remove('visible');
      document.getElementById('edit-patient-form').style.display = 'none';
    });
  }
});


window._currentEditVisitId = null;

function bindEditVisitFeeCalculations() {
  const cFee = document.getElementById('ev-consultation-fee');
  const mPrice = document.getElementById('ev-medicine-price');
  const total = document.getElementById('ev-total-amount');
  const disc = document.getElementById('ev-discount');
  const finalAmt = document.getElementById('ev-final-amount');
  const amtRec = document.getElementById('ev-amount-received');
  const remBal = document.getElementById('ev-remaining-balance');

  const recalculate = () => {
    const fee = parseFloat(cFee?.value) || 0;
    const med = parseFloat(mPrice?.value) || 0;
    const tot = fee + med;
    if (total) total.value = tot.toFixed(2);

    const d = parseFloat(disc?.value) || 0;
    const fin = Math.max(0, tot - d);
    if (finalAmt) finalAmt.value = fin.toFixed(2);

    const rec = parseFloat(amtRec?.value) || 0;
    const rem = fin - rec;
    if (remBal) remBal.value = rem.toFixed(2);
  };

  [cFee, mPrice, disc, amtRec].forEach(el => {
    if (el) {
      el.removeEventListener('input', recalculate);
      el.addEventListener('input', recalculate);
      el.removeEventListener('change', recalculate);
      el.addEventListener('change', recalculate);
    }
  });
}

window.toggleEditVisitForm = async function(visitId) {
  const form = document.getElementById('edit-visit-form');
  const addForm = document.getElementById('add-visit-form');
  const editPatientForm = document.getElementById('edit-patient-form');
  
  if (addForm) { addForm.style.display = 'none'; addForm.classList.remove('visible'); }
  if (editPatientForm) { editPatientForm.style.display = 'none'; editPatientForm.classList.remove('visible'); }
  
  if (form) {
    form.style.display = 'block';
    form.classList.add('visible');
    form.scrollIntoView({ behavior: 'smooth' });
    window._currentEditVisitId = visitId;
    
    let visit = (window._currentVisits || []).find(v => String(v.id) === String(visitId));
    let p = window._currentPatientData || {};

    if (!visit && (state.currentPatientId || p.id)) {
      const pId = state.currentPatientId || p.id;
      try {
        const data = await apiFetch(`${API}/patient/${pId}`);
        if (data) {
          window._currentPatientData = data.patient || data;
          window._currentVisits = data.visits || [];
          p = window._currentPatientData;
          visit = window._currentVisits.find(v => String(v.id) === String(visitId));
        }
      } catch (err) {
        console.error('Failed to fetch patient visits:', err);
      }
    }

    if (!visit) {
      showToast('error', 'Visit Not Found', 'Could not locate the requested visit record.');
      return;
    }

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val != null ? val : ''; };
    
    // Baseline patient data
    setVal('ev-first-name', p.first_name || p.name);
    setVal('ev-guardian-name', p.guardian_name);
    setVal('ev-guardian-relationship', p.guardian_relationship || 'Father');
    setVal('ev-dob', p.date_of_birth);
    setVal('ev-age', p.age);
    setVal('ev-blood', p.blood_group);
    setVal('ev-weight', visit.weight || p.weight);
    setVal('ev-whatsapp', p.whatsapp_number);
    setVal('ev-city', p.city);
    setVal('ev-address', p.address);
    setVal('ev-medical-history', p.medical_history);
    setVal('ev-diagnosis', visit.diagnosis || p.diagnosis);
    setVal('ev-ire-id', p.ire_id);
    if (p.gender) {
      const radio = document.querySelector(`input[name="ev-gender"][value="${p.gender}"]`);
      if (radio) radio.checked = true;
    }
    
    // Visit specific fields
    setVal('ev-registration-date', visit.visit_date);
    setVal('ev-symptoms', visit.symptoms);
    setVal('ev-diagnosis', visit.diagnosis);
    setVal('ev-pulse-rate', visit.pulse_rate);
    setVal('ev-blood-pressure', visit.blood_pressure);
    setVal('ev-temperature', visit.temperature);
    setVal('ev-oxygen-level', visit.oxygen_level);
    setVal('ev-notes', visit.notes);
    
    setVal('ev-consultation-fee', visit.consultation_fee);
    setVal('ev-medicine-price', visit.medicine_price);
    setVal('ev-total-amount', visit.total_amount);
    setVal('ev-discount', visit.discount);
    setVal('ev-final-amount', visit.final_amount);
    setVal('ev-amount-received', visit.amount_received);
    setVal('ev-remaining-balance', visit.remaining_balance);
    setVal('ev-payment-status', visit.payment_status || 'Paid');
    setVal('ev-payment-method', visit.payment_method || 'Cash');
    
    // Defect images
    setVal('ev-defect-image-data-1', visit.defected_area_image);
    setVal('ev-defect-image-data-2', visit.defected_area_image_2);
    setVal('ev-defect-image-data-3', visit.defected_area_image_3);
    
    // Render images in preview boxes
    const setImg = (id, data) => {
      const el = document.getElementById(id);
      if (el) {
         if (data) el.innerHTML = `<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`;
         else el.innerHTML = '<div class="photo-placeholder"><span>No img</span></div>';
      }
    };
    setImg('ev-defect-img-preview-1', visit.defected_area_image);
    setImg('ev-defect-img-preview-2', visit.defected_area_image_2);
    setImg('ev-defect-img-preview-3', visit.defected_area_image_3);
    
    // Populate medicines textarea
    const evMedsTextarea = document.getElementById('ev-medicines-text');
    if (evMedsTextarea) {
      if (typeof deserializeMedicines === 'function') {
        evMedsTextarea.value = deserializeMedicines(visit.medicines);
      } else {
        evMedsTextarea.value = visit.medicines || '';
      }
    }

    bindEditVisitFeeCalculations();
  }
};

window.handleSaveVisitEdit = async function() {
  if (!window._currentEditVisitId) {
    showToast('error', 'Update Error', 'No active visit selected for editing.');
    return;
  }
  const visitId = window._currentEditVisitId;
  
  const payload = {
    visit_date: document.getElementById('ev-registration-date')?.value || todayISO(),
    weight: parseFloat(document.getElementById('ev-weight')?.value) || null,
    diagnosis: document.getElementById('ev-diagnosis')?.value.trim() || '',
    pulse_rate: document.getElementById('ev-pulse-rate')?.value || null,
    blood_pressure: document.getElementById('ev-blood-pressure')?.value || '',
    temperature: document.getElementById('ev-temperature')?.value || null,
    oxygen_level: document.getElementById('ev-oxygen-level')?.value || null,
    symptoms: document.getElementById('ev-symptoms')?.value.trim() || '',
    notes: document.getElementById('ev-notes')?.value.trim() || '',
    medicines: typeof serializeMedicines === 'function' ? serializeMedicines('ev-') : (document.getElementById('ev-medicines-text')?.value.trim() || ''),
    consultation_fee: parseFloat(document.getElementById('ev-consultation-fee')?.value) || 0,
    medicine_price: parseFloat(document.getElementById('ev-medicine-price')?.value) || 0,
    total_amount: parseFloat(document.getElementById('ev-total-amount')?.value) || 0,
    discount: parseFloat(document.getElementById('ev-discount')?.value) || 0,
    final_amount: parseFloat(document.getElementById('ev-final-amount')?.value) || 0,
    payment_method: document.getElementById('ev-payment-method')?.value || 'Cash',
    payment_status: document.getElementById('ev-payment-status')?.value || 'Paid',
    amount_received: parseFloat(document.getElementById('ev-amount-received')?.value) || 0,
    remaining_balance: parseFloat(document.getElementById('ev-remaining-balance')?.value) || 0,
    defected_area_image: document.getElementById('ev-defect-image-data-1')?.value || '',
    defected_area_image_2: document.getElementById('ev-defect-image-data-2')?.value || '',
    defected_area_image_3: document.getElementById('ev-defect-image-data-3')?.value || '',
  };
  
  const btn = document.getElementById('btn-save-visit-edit') || document.getElementById('btn-save-edit-visit');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const result = await apiFetch(`${API}/visit/${visitId}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (result.success) {
      showToast('success', 'Visit Updated', 'The visit record was successfully updated.');
      const editForm = document.getElementById('edit-visit-form');
      if (editForm) {
        editForm.style.display = 'none';
        editForm.classList.remove('visible');
      }
      window._currentEditVisitId = null;
      
      const pId = state.currentPatientId || (window._currentPatientData ? window._currentPatientData.id : null);
      if (pId) {
        const data = await apiFetch(`${API}/patient/${pId}`);
        window._currentPatientData = data.patient || data;
        window._currentVisits = data.visits || [];
        renderPanel(window._currentPatientData, window._currentVisits);
      }
      if (typeof invalidateDashboardCache === 'function') invalidateDashboardCache();
      if (typeof loadDashboard === 'function') loadDashboard();
    } else {
      showToast('error', 'Update Failed', result.error || 'Could not update visit');
    }
  } catch (err) {
    showToast('error', 'Error', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const formEditVisit = document.getElementById('form-edit-visit');
  if (formEditVisit) {
    formEditVisit.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSaveVisitEdit();
    });
  }
  
  const btnCancelEdit = document.getElementById('ev-btn-cancel');
  if (btnCancelEdit) {
    btnCancelEdit.addEventListener('click', (e) => {
      e.preventDefault();
      const form = document.getElementById('edit-visit-form');
      if (form) {
        form.style.display = 'none';
        form.classList.remove('visible');
      }
    });
  }
  
  // File uploads
  if (typeof setupFilePreview === 'function' && typeof buildDefectPlaceholder === 'function') {
      setupFilePreview('ev-defect-image-1', 'ev-defect-image-data-1', 'ev-defect-img-preview-1', buildDefectPlaceholder(true));
      setupFilePreview('ev-defect-image-2', 'ev-defect-image-data-2', 'ev-defect-img-preview-2', buildDefectPlaceholder(true));
      setupFilePreview('ev-defect-image-3', 'ev-defect-image-data-3', 'ev-defect-img-preview-3', buildDefectPlaceholder(true));
  }
  
  // Cameras
  document.getElementById('btn-open-camera-ev-defect-1')?.addEventListener('click', () => { if(typeof openCamera === 'function') openCamera('ev-defect-1'); });
  document.getElementById('btn-open-camera-ev-defect-2')?.addEventListener('click', () => { if(typeof openCamera === 'function') openCamera('ev-defect-2'); });
  document.getElementById('btn-open-camera-ev-defect-3')?.addEventListener('click', () => { if(typeof openCamera === 'function') openCamera('ev-defect-3'); });
});

/* ══════════════════════════════════════════════════════════════════════
   A5 CLINICAL PAD — PER VISIT RENDERING, IMAGE GEN, COPY & PRINT
══════════════════════════════════════════════════════════════════════ */

let currentPadVisitId = null;

function renderClinicalPadHtml(patient, visit, visitNumber, totalVisits) {
  const pName = (patient.first_name || patient.name || '').trim();
  const ireId = patient.ire_id || patient.reg_id || (`#${patient.id}`);
  const guardianText = formatGuardianRelationship(patient) || (patient.guardian_name || '—');
  const dateStr = formatDate(visit.visit_date);
  
  const ageStr = patient.age ? `${patient.age}` : '—';
  const genderStr = patient.gender || '—';
  const phoneStr = patient.whatsapp_number || patient.phone_number || '—';
  const addressStr = patient.address || patient.city || '—';

  const bpStr = visit.blood_pressure || '—';
  const pulseStr = visit.pulse_rate ? `${visit.pulse_rate}` : '—';
  const weightStr = (visit.weight || patient.weight) ? `${visit.weight || patient.weight}` : '—';
  const tempStr = visit.temperature ? `${visit.temperature}` : '—';

  // Format Medicines List for Right Side (Centered)
  let medsTableHtml = '';
  if (visit.medicines) {
    try {
      const parsed = JSON.parse(visit.medicines);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let itemsHtml = parsed.map((m) => {
          const medUrdu = isUrduText(m.name || '') || isUrduText(m.dosage || '') || isUrduText(m.frequency || '');
          const mFont = medUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:14px;" : "font-size:12px; font-weight:700;";
          
          return `
            <div style="margin-bottom:8px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; page-break-inside:avoid; width:100%;">
              ${m.dosage ? `<div style="font-size:12px; font-weight:800; color:#0f172a; text-align:center;">${esc(m.dosage)}</div>` : ''}
              <div style="font-weight:700; color:#0f172a; text-align:center; ${mFont}">${esc(m.name || '—')}</div>
              ${m.frequency ? `<div style="font-size:11.5px; font-weight:600; color:#334155; text-align:center; font-family:'Gulzar',serif; direction:rtl;">${esc(m.frequency)}</div>` : ''}
              ${m.duration ? `<div style="font-size:10.5px; color:#64748b; text-align:center;">${esc(m.duration)}</div>` : ''}
            </div>`;
        }).join('');

        medsTableHtml = `<div style="display:flex; flex-direction:column; gap:3px; align-items:center; text-align:center; width:100%;">${itemsHtml}</div>`;
      } else if (typeof visit.medicines === 'string' && visit.medicines.trim()) {
        medsTableHtml = `<div style="font-size:12px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.4; font-family:'Gulzar',serif; direction:rtl; text-align:center; width:100%;">${esc(visit.medicines)}</div>`;
      }
    } catch(e) {
      if (typeof visit.medicines === 'string' && visit.medicines.trim()) {
        medsTableHtml = `<div style="font-size:12px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.4; font-family:'Gulzar',serif; direction:rtl; text-align:center; width:100%;">${esc(visit.medicines)}</div>`;
      }
    }
  }

  if (!medsTableHtml && visit.prescription) {
    medsTableHtml = `<div style="font-size:12px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.4; font-family:'Gulzar',serif; direction:rtl; text-align:center; width:100%;">${esc(visit.prescription)}</div>`;
  }

  const symptomsText = visit.symptoms || patient.symptoms || '—';
  const historyText = patient.medical_history || '';
  const diagnosisText = visit.diagnosis || '';

  const symUrdu = isUrduText(symptomsText);
  const symFont = symUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:13px;" : "font-size:11.5px;";

  const pillStyle = "display:inline-flex; align-items:center; justify-content:center; border:1px solid #475569; border-radius:12px; padding:1px 8px; font-weight:700; color:#0f172a; background:#ffffff; min-height:20px; box-sizing:border-box; font-size:11px; white-space:nowrap;";

  return `
    <div id="a5-pad-printable" style="width:148mm; height:210mm; max-height:210mm; background:#ffffff; color:#0f172a; font-family:'Inter',sans-serif; box-sizing:border-box; margin:0 auto; padding:0; position:relative; display:flex; flex-direction:column; justify-content:space-between; border:1px solid #000000; box-shadow:0 12px 35px rgba(0,0,0,0.1); overflow:hidden;">
      
      <!-- Top Clinic Header Banner Image -->
      <div style="width:100%; border-bottom:2px solid #000000; overflow:hidden; flex-shrink:0;">
        <img src="clinical_pad_header.png" style="width:100%; height:auto; display:block;" alt="Clinic Header" />
      </div>

      <!-- Main Body Container -->
      <div style="padding:8px 12px; flex:1; display:flex; flex-direction:column; background:#ffffff; overflow:hidden;">
        
        <!-- Metadata Fields Header matching exact wireframe layout -->
        <div style="padding-bottom:6px; font-size:11px; font-weight:800; display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
          
          <!-- Row 1: P/ID | Name | Guardian | Date -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="display:flex; align-items:center; gap:4px;">
              <span>P/ID:</span>
              <span style="${pillStyle}">${esc(ireId)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Name:</span>
              <span style="${pillStyle}">${esc(pName)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Guardian:</span>
              <span style="${pillStyle}">${esc(guardianText)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Date:</span>
              <span style="${pillStyle}">${dateStr}</span>
            </div>
          </div>

          <!-- Row 2: Age | Gender | Visit# | Whatsapp -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Age:</span>
              <span style="${pillStyle}">${esc(ageStr)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Gender:</span>
              <span style="${pillStyle}">${esc(genderStr)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Visit#:</span>
              <span style="${pillStyle}">${visitNumber}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Whatsapp:</span>
              <span style="${pillStyle}">${esc(phoneStr)}</span>
            </div>
          </div>

          <!-- Row 3: Address -->
          <div style="display:flex; align-items:center; gap:4px;">
            <span>Address:</span>
            <span style="${pillStyle} flex:1; justify-content:flex-start;">${esc(addressStr)}</span>
          </div>

        </div>

        <!-- Top Solid Horizontal Separator Line -->
        <div style="border-top:2px solid #000000; margin-top:2px; margin-bottom:0px; flex-shrink:0;"></div>

        <!-- Middle Split Column Layout -->
        <div style="display:grid; grid-template-columns: 165px 1fr; flex:1; align-items:stretch; overflow:hidden;">
          
          <!-- LEFT COLUMN: Vitals & Symptoms / History -->
          <div style="border-right:2px solid #000000; padding:6px 8px 6px 0; display:flex; flex-direction:column; overflow:hidden;">
            
            <!-- Vitals Block with Box Borders and Solid Bottom Divider Line -->
            <div style="font-size:11px; font-weight:800; display:flex; flex-direction:column; gap:5px; padding-bottom:6px; border-bottom:2px solid #000000; flex-shrink:0;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:3px;">
                  <span>BP:</span>
                  <span style="${pillStyle}">${esc(bpStr)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:3px;">
                  <span>Pulse:</span>
                  <span style="${pillStyle}">${esc(pulseStr)}</span>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:3px;">
                  <span>Wt:</span>
                  <span style="${pillStyle}">${esc(weightStr)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:3px;">
                  <span>Temp:</span>
                  <span style="${pillStyle}">${esc(tempStr)}</span>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <span>Allergies:</span>
                <span style="${pillStyle} flex:1;">NiL</span>
              </div>
            </div>

            <!-- Symptoms / History Section -->
            <div style="padding-top:6px; flex:1; display:flex; flex-direction:column; overflow:hidden;">
              <div style="font-weight:800; font-size:11.5px; margin-bottom:4px; color:#0f172a; flex-shrink:0;">
                Symptoms / History:
              </div>
              
              <div style="flex:1; color:#0f172a; font-weight:600; line-height:1.4; white-space:pre-wrap; overflow-y:auto; ${symFont}">
                ${esc(symptomsText)}
                ${diagnosisText ? `\n\nDiagnosis: ${esc(diagnosisText)}` : ''}
                ${historyText ? `\n\nHistory: ${esc(historyText)}` : ''}
              </div>
            </div>

          </div>

          <!-- RIGHT COLUMN: Prescription Rx & Medicines -->
          <div style="padding:6px 0 6px 12px; display:flex; flex-direction:column; overflow:hidden;">
            
            <!-- Rx Symbol -->
            <div style="font-size:22px; font-weight:900; font-family:'Georgia', serif; color:#000000; margin-bottom:6px; flex-shrink:0;">
              R<sub>x</sub>
            </div>

            <!-- Medicines Content -->
            <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-start; overflow-y:auto;">
              ${medsTableHtml}
            </div>

          </div>

        </div>

      </div>

      <!-- Bottom Clinic Footer Image Banner -->
      <div style="width:100%; border-top:2px solid #000000; overflow:hidden; flex-shrink:0; margin-top:auto;">
        <img src="clinical_pad_footer.png" style="width:100%; height:auto; display:block;" alt="Clinic Footer" />
      </div>

    </div>`;
}

async function getVisitDataForPad(visitId) {
  if (!state.currentPatientId) throw new Error('No active patient selected');
  const data = await apiFetch(`${API}/patient/${state.currentPatientId}`);
  const visits = data.visits || [];
  
  // Find target visit
  const targetVisit = visits.find(v => Number(v.id) === Number(visitId));
  if (!targetVisit) throw new Error('Target visit not found');

  // Chronological index (Visit #1 is earliest)
  const sortedAsc = [...visits].sort((a, b) => new Date(a.visit_date || a.created_at) - new Date(b.visit_date || b.created_at));
  const visitIndex = sortedAsc.findIndex(v => Number(v.id) === Number(visitId));
  const visitNumber = visitIndex >= 0 ? (visitIndex + 1) : 1;

  return {
    patient: data.patient || window._currentPatientData,
    visit: targetVisit,
    visitNumber,
    totalVisits: visits.length
  };
}

async function openClinicalPadModal(visitId) {
  try {
    currentPadVisitId = visitId;
    const { patient, visit, visitNumber, totalVisits } = await getVisitDataForPad(visitId);

    const titleEl = document.getElementById('cp-modal-visit-title');
    if (titleEl) titleEl.textContent = `Visit #${visitNumber} (${formatDate(visit.visit_date)})`;

    const container = document.getElementById('clinical-pad-container');
    if (container) {
      container.innerHTML = renderClinicalPadHtml(patient, visit, visitNumber, totalVisits);
    }

    const modal = document.getElementById('clinical-pad-modal');
    if (modal) modal.style.display = 'block';

    // Auto Copy JPG image of pad to clipboard upon clicking View Pad
    setTimeout(() => {
      copyClinicalPadToClipboard(visitId, 'jpeg');
    }, 300);
  } catch(err) {
    showToast('error', 'Error Loading Pad', err.message);
  }
}

function closeClinicalPadModal() {
  const modal = document.getElementById('clinical-pad-modal');
  if (modal) modal.style.display = 'none';
}

function renderPrescriptionCardHtml(patient, visit) {
  const pName = (patient.first_name || patient.name || '').trim();
  const guardianText = formatGuardianRelationship(patient);
  const fullPatientName = guardianText ? `${pName} ${guardianText}` : pName;
  const isPatientUrdu = isUrduText(fullPatientName);
  const patientNameFont = isPatientUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:24px;" : "font-size:22px; font-weight:800;";

  const phoneStr = patient.whatsapp_number || patient.phone_number || '—';
  const ireId = patient.ire_id || patient.reg_id || (`#${patient.id}`);
  const dateStr = formatDate(visit.visit_date);
  
  let nowTimeStr = '';
  try {
    const d = new Date();
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    nowTimeStr = `${dateStr}, ${timePart}`;
  } catch(e) {
    nowTimeStr = dateStr;
  }

  // Format Medicines
  let medsContentHtml = '';
  if (visit.medicines) {
    try {
      const parsed = JSON.parse(visit.medicines);
      if (Array.isArray(parsed) && parsed.length > 0) {
        medsContentHtml = parsed.map((m, idx) => {
          const isUrdu = isUrduText(m.name || '') || isUrduText(m.dosage || '') || isUrduText(m.frequency || '') || isUrduText(m.duration || '');
          const fontStyle = isUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:17px; font-weight:600;" : "font-size:14px; font-weight:700;";
          const freqStyle = isUrduText(m.frequency || '') || isUrduText(m.duration || '') ? "font-family:'Gulzar',serif; direction:rtl; font-size:14px;" : "font-size:12px;";
          
          return `
            <div style="border-bottom: 1px solid #e2e8f0; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="color: #0f172a; ${fontStyle}">${idx + 1}. ${esc(m.name || '—')}</div>
                ${m.frequency || m.duration ? `<div style="color: #64748b; margin-top: 2px; ${freqStyle}">${esc(m.frequency || '')} ${m.duration ? `(${esc(m.duration)})` : ''}</div>` : ''}
              </div>
              ${m.dosage ? `<span style="background: #e6f4f1; color: #0F8B6D; font-weight: 800; font-size: 12px; padding: 3px 10px; border-radius: 6px;">${esc(m.dosage)}</span>` : ''}
            </div>`;
        }).join('');
      } else if (typeof visit.medicines === 'string' && visit.medicines.trim()) {
        const isUrdu = isUrduText(visit.medicines);
        const fontStyle = isUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:16px;" : "font-size:14px; font-weight:600;";
        medsContentHtml = `<div style="color:#1e293b; white-space:pre-wrap; line-height:1.5; ${fontStyle}">${esc(visit.medicines)}</div>`;
      }
    } catch(e) {
      if (typeof visit.medicines === 'string' && visit.medicines.trim()) {
        const isUrdu = isUrduText(visit.medicines);
        const fontStyle = isUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:16px;" : "font-size:14px; font-weight:600;";
        medsContentHtml = `<div style="color:#1e293b; white-space:pre-wrap; line-height:1.5; ${fontStyle}">${esc(visit.medicines)}</div>`;
      }
    }
  }

  if (!medsContentHtml && visit.prescription) {
    const isUrdu = isUrduText(visit.prescription);
    const fontStyle = isUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:16px;" : "font-size:14px; font-weight:600;";
    medsContentHtml = `<div style="color:#1e293b; white-space:pre-wrap; line-height:1.5; ${fontStyle}">${esc(visit.prescription)}</div>`;
  }

  if (!medsContentHtml) {
    medsContentHtml = `<div style="font-size:14px; font-style:italic; color:#94a3b8;">No medicines prescribed.</div>`;
  }

  return `
    <div id="prescription-card-printable" style="width: 520px; background: #f8fafc; font-family: 'Inter', sans-serif; padding: 20px; border-radius: 20px; box-sizing: border-box;">
      
      <!-- Top Banner -->
      <div style="background: linear-gradient(135deg, #1b5e3f, #14472f); color: #ffffff; border-radius: 18px; padding: 24px 20px; text-align: center; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(27,94,63,0.15);">
        <div style="font-size: 26px; font-weight: 900; letter-spacing: 1px; line-height: 1.2;">ATTA HOMEOPATHIC MARKAZ</div>
      </div>

      <!-- Patient Info Box -->
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; margin-bottom: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
        <div style="color: #1b5e3f; margin-bottom: 10px; ${patientNameFont}">${esc(fullPatientName)}</div>
        <div style="display: flex; justify-content: center; align-items: center; gap: 18px; font-size: 14px; font-weight: 700; color: #475569;">
          <span>📱 ${esc(phoneStr)}</span>
          <span style="color: #6b21a8; background: #f3e8ff; padding: 2px 8px; border-radius: 6px;">ID ${esc(ireId)}</span>
          <span>📅 ${dateStr}</span>
        </div>
      </div>

      <!-- Prescribed Medicines Box -->
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; margin-bottom: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
        <div style="font-size: 14px; font-weight: 800; color: #1b5e3f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <span>💊</span> PRESCRIBED MEDICINES
        </div>
        <div style="display: flex; flex-direction: column;">
          ${medsContentHtml}
        </div>
      </div>

      <!-- Footer Note -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 0.3px;">
        ATTA HOMEOPATHIC MARKAZ • Generated ${nowTimeStr}
      </div>

    </div>`;
}

async function printVisitPrescription(visitId) {
  try {
    showToast('info', '🌿 Prescription', 'Generating prescription card image…');
    const { patient, visit } = await getVisitDataForPad(visitId);

    // Create offscreen container for rendering exact prescription card
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.innerHTML = renderPrescriptionCardHtml(patient, visit);
    document.body.appendChild(tempDiv);

    const targetEl = tempDiv.querySelector('#prescription-card-printable');

    const canvas = await html2canvas(targetEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: null
    });

    document.body.removeChild(tempDiv);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        showToast('success', '📋 Copied to Clipboard', `Prescription card for ${patient.first_name || 'patient'} copied as PNG!`);
      } catch(e) {
        showToast('error', 'Clipboard Error', 'Failed to copy image to clipboard.');
      }
    }, 'image/png');

  } catch(err) {
    showToast('error', 'Prescription Error', err.message);
  }
}

async function generatePadCanvas(visitId) {
  let targetEl = document.getElementById('a5-pad-printable');
  
  // If modal is not open for this visit, temporarily render in hidden container
  let tempDiv = null;
  if (!targetEl || Number(currentPadVisitId) !== Number(visitId)) {
    const { patient, visit, visitNumber, totalVisits } = await getVisitDataForPad(visitId);
    tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.innerHTML = renderClinicalPadHtml(patient, visit, visitNumber, totalVisits);
    document.body.appendChild(tempDiv);
    targetEl = tempDiv.querySelector('#a5-pad-printable');
  }

  // Ensure images inside canvas element are loaded
  const imgs = targetEl.querySelectorAll('img');
  await Promise.all(Array.from(imgs).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(res => { img.onload = res; img.onerror = res; });
  }));

  const canvas = await html2canvas(targetEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  if (tempDiv) {
    document.body.removeChild(tempDiv);
  }

  return canvas;
}

async function downloadClinicalPadImage(visitId, format = 'png') {
  try {
    showToast('info', 'Generating Image…', 'Preparing A5 Clinical Pad image.');
    const canvas = await generatePadCanvas(visitId);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const dataUrl = canvas.toDataURL(mimeType, 0.95);

    const link = document.createElement('a');
    link.download = `Clinical_Pad_Visit_${visitId}.${ext}`;
    link.href = dataUrl;
    link.click();

    showToast('success', 'Image Saved', `Clinical Pad downloaded as ${ext.toUpperCase()}`);
  } catch(err) {
    showToast('error', 'Download Failed', err.message);
  }
}

async function copyClinicalPadToClipboard(visitId, format = 'jpeg') {
  try {
    const canvas = await generatePadCanvas(visitId);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        // ClipboardItem in standard browsers usually requires image/png
        const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
        await navigator.clipboard.write([item]);
        showToast('success', '📋 Copied to Clipboard', `A5 Clinical Pad image copied to clipboard. You can paste directly in WhatsApp or Word.`);
      } catch (clipErr) {
        try {
          const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          if (pngBlob) {
            const item = new ClipboardItem({ 'image/png': pngBlob });
            await navigator.clipboard.write([item]);
            showToast('success', '📋 Copied to Clipboard', `A5 Clinical Pad image copied to clipboard. You can paste directly in WhatsApp or Word.`);
          }
        } catch(e) {
          console.log('Clipboard fallback muted:', e);
        }
      }
    }, mimeType, 0.95);
  } catch(err) {
    console.log('Copy pad error:', err);
  }
}

async function printClinicalPadDirect(visitId) {
  try {
    await openClinicalPadModal(visitId);
    setTimeout(() => {
      window.print();
    }, 250);
  } catch(err) {
    showToast('error', 'Print Error', err.message);
  }
}

function triggerPadDownload(format) {
  if (currentPadVisitId) downloadClinicalPadImage(currentPadVisitId, format);
}

function triggerPadCopy() {
  if (currentPadVisitId) copyClinicalPadToClipboard(currentPadVisitId);
}

function triggerPadPrint() {
  if (currentPadVisitId) window.print();
}


/* ══════════════════════════════════════════════════════════════════════
   A5 CLINICAL PAD — PER VISIT RENDERING, IMAGE GEN, COPY & PRINT
══════════════════════════════════════════════════════════════════════ */



function renderClinicalPadHtml(patient, visit, visitNumber, totalVisits) {
  const pName = (patient.first_name || patient.name || '').trim();
  const ireId = patient.ire_id || patient.reg_id || (`#${patient.id}`);
  const guardianText = formatGuardianRelationship(patient) || (patient.guardian_name || '—');
  const dateStr = formatDate(visit.visit_date);
  
  const ageStr = patient.age ? `${patient.age}` : '—';
  const genderStr = patient.gender || '—';
  const phoneStr = patient.whatsapp_number || patient.phone_number || '—';
  const addressStr = patient.address || patient.city || '—';

  const bpStr = visit.blood_pressure || '—';
  const pulseStr = visit.pulse_rate ? `${visit.pulse_rate}` : '—';
  const weightStr = (visit.weight || patient.weight) ? `${visit.weight || patient.weight}` : '—';
  const tempStr = visit.temperature ? `${visit.temperature}` : '—';

  // Format Medicines List for Right Side (Centered)
  let medsTableHtml = '';
  if (visit.medicines) {
    try {
      const parsed = JSON.parse(visit.medicines);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let itemsHtml = parsed.map((m) => {
          const medUrdu = isUrduText(m.name || '') || isUrduText(m.dosage || '') || isUrduText(m.frequency || '');
          const mFont = medUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:14px;" : "font-size:12px; font-weight:700;";
          
          return `
            <div style="margin-bottom:8px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; page-break-inside:avoid; width:100%;">
              ${m.dosage ? `<div style="font-size:12px; font-weight:800; color:#0f172a; text-align:center;">${esc(m.dosage)}</div>` : ''}
              <div style="font-weight:700; color:#0f172a; text-align:center; ${mFont}">${esc(m.name || '—')}</div>
              ${m.frequency ? `<div style="font-size:11.5px; font-weight:600; color:#334155; text-align:center; font-family:'Gulzar',serif; direction:rtl;">${esc(m.frequency)}</div>` : ''}
              ${m.duration ? `<div style="font-size:10.5px; color:#64748b; text-align:center;">${esc(m.duration)}</div>` : ''}
            </div>`;
        }).join('');

        medsTableHtml = `<div style="display:flex; flex-direction:column; gap:3px; align-items:center; text-align:center; width:100%;">${itemsHtml}</div>`;
      } else if (typeof visit.medicines === 'string' && visit.medicines.trim()) {
        medsTableHtml = `<div style="font-size:12px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.4; font-family:'Gulzar',serif; direction:rtl; text-align:center; width:100%;">${esc(visit.medicines)}</div>`;
      }
    } catch(e) {
      if (typeof visit.medicines === 'string' && visit.medicines.trim()) {
        medsTableHtml = `<div style="font-size:12px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.4; font-family:'Gulzar',serif; direction:rtl; text-align:center; width:100%;">${esc(visit.medicines)}</div>`;
      }
    }
  }

  if (!medsTableHtml && visit.prescription) {
    medsTableHtml = `<div style="font-size:12px; font-weight:600; color:#1e293b; white-space:pre-wrap; line-height:1.4; font-family:'Gulzar',serif; direction:rtl; text-align:center; width:100%;">${esc(visit.prescription)}</div>`;
  }

  const symptomsText = visit.symptoms || patient.symptoms || '—';
  const historyText = patient.medical_history || '';
  const diagnosisText = visit.diagnosis || '';

  const symUrdu = isUrduText(symptomsText);
  const symFont = symUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:13px;" : "font-size:11.5px;";

  const pillStyle = "display:inline-flex; align-items:center; justify-content:center; border:1px solid #475569; border-radius:12px; padding:1px 8px; font-weight:700; color:#0f172a; background:#ffffff; min-height:20px; box-sizing:border-box; font-size:11px; white-space:nowrap;";

  return `
    <div id="a5-pad-printable" style="width:148mm; height:210mm; max-height:210mm; background:#ffffff; color:#0f172a; font-family:'Inter',sans-serif; box-sizing:border-box; margin:0 auto; padding:0; position:relative; display:flex; flex-direction:column; justify-content:space-between; border:1px solid #000000; box-shadow:0 12px 35px rgba(0,0,0,0.1); overflow:hidden;">
      
      <!-- Top Clinic Header Banner Image -->
      <div style="width:100%; border-bottom:2px solid #000000; overflow:hidden; flex-shrink:0;">
        <img src="clinical_pad_header.png" style="width:100%; height:auto; display:block;" alt="Clinic Header" />
      </div>

      <!-- Main Body Container -->
      <div style="padding:8px 12px; flex:1; display:flex; flex-direction:column; background:#ffffff; overflow:hidden;">
        
        <!-- Metadata Fields Header matching exact wireframe layout -->
        <div style="padding-bottom:6px; font-size:11px; font-weight:800; display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
          
          <!-- Row 1: P/ID | Name | Guardian | Date -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="display:flex; align-items:center; gap:4px;">
              <span>P/ID:</span>
              <span style="${pillStyle}">${esc(ireId)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Name:</span>
              <span style="${pillStyle}">${esc(pName)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Guardian:</span>
              <span style="${pillStyle}">${esc(guardianText)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Date:</span>
              <span style="${pillStyle}">${dateStr}</span>
            </div>
          </div>

          <!-- Row 2: Age | Gender | Visit# | Whatsapp -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Age:</span>
              <span style="${pillStyle}">${esc(ageStr)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Gender:</span>
              <span style="${pillStyle}">${esc(genderStr)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Visit#:</span>
              <span style="${pillStyle}">${visitNumber}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span>Whatsapp:</span>
              <span style="${pillStyle}">${esc(phoneStr)}</span>
            </div>
          </div>

          <!-- Row 3: Address -->
          <div style="display:flex; align-items:center; gap:4px;">
            <span>Address:</span>
            <span style="${pillStyle} flex:1; justify-content:flex-start;">${esc(addressStr)}</span>
          </div>

        </div>

        <!-- Top Solid Horizontal Separator Line -->
        <div style="border-top:2px solid #000000; margin-top:2px; margin-bottom:0px; flex-shrink:0;"></div>

        <!-- Middle Split Column Layout -->
        <div style="display:grid; grid-template-columns: 165px 1fr; flex:1; align-items:stretch; overflow:hidden;">
          
          <!-- LEFT COLUMN: Vitals & Symptoms / History -->
          <div style="border-right:2px solid #000000; padding:6px 8px 6px 0; display:flex; flex-direction:column; overflow:hidden;">
            
            <!-- Vitals Block with Box Borders and Solid Bottom Divider Line -->
            <div style="font-size:11px; font-weight:800; display:flex; flex-direction:column; gap:5px; padding-bottom:6px; border-bottom:2px solid #000000; flex-shrink:0;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:3px;">
                  <span>BP:</span>
                  <span style="${pillStyle}">${esc(bpStr)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:3px;">
                  <span>Pulse:</span>
                  <span style="${pillStyle}">${esc(pulseStr)}</span>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:3px;">
                  <span>Wt:</span>
                  <span style="${pillStyle}">${esc(weightStr)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:3px;">
                  <span>Temp:</span>
                  <span style="${pillStyle}">${esc(tempStr)}</span>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <span>Allergies:</span>
                <span style="${pillStyle} flex:1;">NiL</span>
              </div>
            </div>

            <!-- Symptoms / History Section -->
            <div style="padding-top:6px; flex:1; display:flex; flex-direction:column; overflow:hidden;">
              <div style="font-weight:800; font-size:11.5px; margin-bottom:4px; color:#0f172a; flex-shrink:0;">
                Symptoms / History:
              </div>
              
              <div style="flex:1; color:#0f172a; font-weight:600; line-height:1.4; white-space:pre-wrap; overflow-y:auto; ${symFont}">
                ${esc(symptomsText)}
                ${diagnosisText ? `\n\nDiagnosis: ${esc(diagnosisText)}` : ''}
                ${historyText ? `\n\nHistory: ${esc(historyText)}` : ''}
              </div>
            </div>

          </div>

          <!-- RIGHT COLUMN: Prescription Rx & Medicines -->
          <div style="padding:6px 0 6px 12px; display:flex; flex-direction:column; overflow:hidden;">
            
            <!-- Rx Symbol -->
            <div style="font-size:22px; font-weight:900; font-family:'Georgia', serif; color:#000000; margin-bottom:6px; flex-shrink:0;">
              R<sub>x</sub>
            </div>

            <!-- Medicines Content -->
            <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-start; overflow-y:auto;">
              ${medsTableHtml}
            </div>

          </div>

        </div>

      </div>

      <!-- Bottom Clinic Footer Image Banner -->
      <div style="width:100%; border-top:2px solid #000000; overflow:hidden; flex-shrink:0; margin-top:auto;">
        <img src="clinical_pad_footer.png" style="width:100%; height:auto; display:block;" alt="Clinic Footer" />
      </div>

    </div>`;
}

async function getVisitDataForPad(visitId) {
  if (!state.currentPatientId) throw new Error('No active patient selected');
  const data = await apiFetch(`${API}/patient/${state.currentPatientId}`);
  const visits = data.visits || [];
  
  // Find target visit
  const targetVisit = visits.find(v => Number(v.id) === Number(visitId));
  if (!targetVisit) throw new Error('Target visit not found');

  // Chronological index (Visit #1 is earliest)
  const sortedAsc = [...visits].sort((a, b) => new Date(a.visit_date || a.created_at) - new Date(b.visit_date || b.created_at));
  const visitIndex = sortedAsc.findIndex(v => Number(v.id) === Number(visitId));
  const visitNumber = visitIndex >= 0 ? (visitIndex + 1) : 1;

  return {
    patient: data.patient || window._currentPatientData,
    visit: targetVisit,
    visitNumber,
    totalVisits: visits.length
  };
}

async function openClinicalPadModal(visitId) {
  try {
    currentPadVisitId = visitId;
    const { patient, visit, visitNumber, totalVisits } = await getVisitDataForPad(visitId);

    const titleEl = document.getElementById('cp-modal-visit-title');
    if (titleEl) titleEl.textContent = `Visit #${visitNumber} (${formatDate(visit.visit_date)})`;

    const container = document.getElementById('clinical-pad-container');
    if (container) {
      container.innerHTML = renderClinicalPadHtml(patient, visit, visitNumber, totalVisits);
    }

    const modal = document.getElementById('clinical-pad-modal');
    if (modal) modal.style.display = 'block';

    // Auto Copy JPG image of pad to clipboard upon clicking View Pad
    setTimeout(() => {
      copyClinicalPadToClipboard(visitId, 'jpeg');
    }, 300);
  } catch(err) {
    showToast('error', 'Error Loading Pad', err.message);
  }
}

function closeClinicalPadModal() {
  const modal = document.getElementById('clinical-pad-modal');
  if (modal) modal.style.display = 'none';
}

function renderPrescriptionCardHtml(patient, visit) {
  const pName = (patient.first_name || patient.name || '').trim();
  const guardianText = formatGuardianRelationship(patient);
  const fullPatientName = guardianText ? `${pName} ${guardianText}` : pName;
  const isPatientUrdu = isUrduText(fullPatientName);
  const patientNameFont = isPatientUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:24px;" : "font-size:22px; font-weight:800;";

  const phoneStr = patient.whatsapp_number || patient.phone_number || '—';
  const ireId = patient.ire_id || patient.reg_id || (`#${patient.id}`);
  const dateStr = formatDate(visit.visit_date);
  
  let nowTimeStr = '';
  try {
    const d = new Date();
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    nowTimeStr = `${dateStr}, ${timePart}`;
  } catch(e) {
    nowTimeStr = dateStr;
  }

  // Format Medicines
  let medsContentHtml = '';
  if (visit.medicines) {
    try {
      const parsed = JSON.parse(visit.medicines);
      if (Array.isArray(parsed) && parsed.length > 0) {
        medsContentHtml = parsed.map((m, idx) => {
          const isUrdu = isUrduText(m.name || '') || isUrduText(m.dosage || '') || isUrduText(m.frequency || '') || isUrduText(m.duration || '');
          const fontStyle = isUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:17px; font-weight:600;" : "font-size:14px; font-weight:700;";
          const freqStyle = isUrduText(m.frequency || '') || isUrduText(m.duration || '') ? "font-family:'Gulzar',serif; direction:rtl; font-size:14px;" : "font-size:12px;";
          
          return `
            <div style="border-bottom: 1px solid #e2e8f0; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="color: #0f172a; ${fontStyle}">${idx + 1}. ${esc(m.name || '—')}</div>
                ${m.frequency || m.duration ? `<div style="color: #64748b; margin-top: 2px; ${freqStyle}">${esc(m.frequency || '')} ${m.duration ? `(${esc(m.duration)})` : ''}</div>` : ''}
              </div>
              ${m.dosage ? `<span style="background: #e6f4f1; color: #0F8B6D; font-weight: 800; font-size: 12px; padding: 3px 10px; border-radius: 6px;">${esc(m.dosage)}</span>` : ''}
            </div>`;
        }).join('');
      } else if (typeof visit.medicines === 'string' && visit.medicines.trim()) {
        const isUrdu = isUrduText(visit.medicines);
        const fontStyle = isUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:16px;" : "font-size:14px; font-weight:600;";
        medsContentHtml = `<div style="color:#1e293b; white-space:pre-wrap; line-height:1.5; ${fontStyle}">${esc(visit.medicines)}</div>`;
      }
    } catch(e) {
      if (typeof visit.medicines === 'string' && visit.medicines.trim()) {
        const isUrdu = isUrduText(visit.medicines);
        const fontStyle = isUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:16px;" : "font-size:14px; font-weight:600;";
        medsContentHtml = `<div style="color:#1e293b; white-space:pre-wrap; line-height:1.5; ${fontStyle}">${esc(visit.medicines)}</div>`;
      }
    }
  }

  if (!medsContentHtml && visit.prescription) {
    const isUrdu = isUrduText(visit.prescription);
    const fontStyle = isUrdu ? "font-family:'Gulzar',serif; direction:rtl; font-size:16px;" : "font-size:14px; font-weight:600;";
    medsContentHtml = `<div style="color:#1e293b; white-space:pre-wrap; line-height:1.5; ${fontStyle}">${esc(visit.prescription)}</div>`;
  }

  if (!medsContentHtml) {
    medsContentHtml = `<div style="font-size:14px; font-style:italic; color:#94a3b8;">No medicines prescribed.</div>`;
  }

  return `
    <div id="prescription-card-printable" style="width: 520px; background: #f8fafc; font-family: 'Inter', sans-serif; padding: 20px; border-radius: 20px; box-sizing: border-box;">
      
      <!-- Top Banner -->
      <div style="background: linear-gradient(135deg, #1b5e3f, #14472f); color: #ffffff; border-radius: 18px; padding: 24px 20px; text-align: center; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(27,94,63,0.15);">
        <div style="font-size: 26px; font-weight: 900; letter-spacing: 1px; line-height: 1.2;">ATTA HOMEOPATHIC MARKAZ</div>
      </div>

      <!-- Patient Info Box -->
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; margin-bottom: 16px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
        <div style="color: #1b5e3f; margin-bottom: 10px; ${patientNameFont}">${esc(fullPatientName)}</div>
        <div style="display: flex; justify-content: center; align-items: center; gap: 18px; font-size: 14px; font-weight: 700; color: #475569;">
          <span>📱 ${esc(phoneStr)}</span>
          <span style="color: #6b21a8; background: #f3e8ff; padding: 2px 8px; border-radius: 6px;">ID ${esc(ireId)}</span>
          <span>📅 ${dateStr}</span>
        </div>
      </div>

      <!-- Prescribed Medicines Box -->
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; margin-bottom: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
        <div style="font-size: 14px; font-weight: 800; color: #1b5e3f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <span>💊</span> PRESCRIBED MEDICINES
        </div>
        <div style="display: flex; flex-direction: column;">
          ${medsContentHtml}
        </div>
      </div>

      <!-- Footer Note -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 0.3px;">
        ATTA HOMEOPATHIC MARKAZ • Generated ${nowTimeStr}
      </div>

    </div>`;
}

async function printVisitPrescription(visitId) {
  try {
    showToast('info', '🌿 Prescription', 'Generating prescription card image…');
    const { patient, visit } = await getVisitDataForPad(visitId);

    // Create offscreen container for rendering exact prescription card
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.innerHTML = renderPrescriptionCardHtml(patient, visit);
    document.body.appendChild(tempDiv);

    const targetEl = tempDiv.querySelector('#prescription-card-printable');

    const canvas = await html2canvas(targetEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: null
    });

    document.body.removeChild(tempDiv);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        showToast('success', '📋 Copied to Clipboard', `Prescription card for ${patient.first_name || 'patient'} copied as PNG!`);
      } catch(e) {
        showToast('error', 'Clipboard Error', 'Failed to copy image to clipboard.');
      }
    }, 'image/png');

  } catch(err) {
    showToast('error', 'Prescription Error', err.message);
  }
}

async function generatePadCanvas(visitId) {
  let targetEl = document.getElementById('a5-pad-printable');
  
  // If modal is not open for this visit, temporarily render in hidden container
  let tempDiv = null;
  if (!targetEl || Number(currentPadVisitId) !== Number(visitId)) {
    const { patient, visit, visitNumber, totalVisits } = await getVisitDataForPad(visitId);
    tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.innerHTML = renderClinicalPadHtml(patient, visit, visitNumber, totalVisits);
    document.body.appendChild(tempDiv);
    targetEl = tempDiv.querySelector('#a5-pad-printable');
  }

  // Ensure images inside canvas element are loaded
  const imgs = targetEl.querySelectorAll('img');
  await Promise.all(Array.from(imgs).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(res => { img.onload = res; img.onerror = res; });
  }));

  const canvas = await html2canvas(targetEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  if (tempDiv) {
    document.body.removeChild(tempDiv);
  }

  return canvas;
}

async function downloadClinicalPadImage(visitId, format = 'png') {
  try {
    showToast('info', 'Generating Image…', 'Preparing A5 Clinical Pad image.');
    const canvas = await generatePadCanvas(visitId);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const dataUrl = canvas.toDataURL(mimeType, 0.95);

    const link = document.createElement('a');
    link.download = `Clinical_Pad_Visit_${visitId}.${ext}`;
    link.href = dataUrl;
    link.click();

    showToast('success', 'Image Saved', `Clinical Pad downloaded as ${ext.toUpperCase()}`);
  } catch(err) {
    showToast('error', 'Download Failed', err.message);
  }
}

async function copyClinicalPadToClipboard(visitId, format = 'jpeg') {
  try {
    const canvas = await generatePadCanvas(visitId);
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        // ClipboardItem in standard browsers usually requires image/png
        const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
        await navigator.clipboard.write([item]);
        showToast('success', '📋 Copied to Clipboard', `A5 Clinical Pad image copied to clipboard. You can paste directly in WhatsApp or Word.`);
      } catch (clipErr) {
        try {
          const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          if (pngBlob) {
            const item = new ClipboardItem({ 'image/png': pngBlob });
            await navigator.clipboard.write([item]);
            showToast('success', '📋 Copied to Clipboard', `A5 Clinical Pad image copied to clipboard. You can paste directly in WhatsApp or Word.`);
          }
        } catch(e) {
          console.log('Clipboard fallback muted:', e);
        }
      }
    }, mimeType, 0.95);
  } catch(err) {
    console.log('Copy pad error:', err);
  }
}

async function printClinicalPadDirect(visitId) {
  try {
    await openClinicalPadModal(visitId);
    setTimeout(() => {
      window.print();
    }, 250);
  } catch(err) {
    showToast('error', 'Print Error', err.message);
  }
}

function triggerPadDownload(format) {
  if (currentPadVisitId) downloadClinicalPadImage(currentPadVisitId, format);
}

function triggerPadCopy() {
  if (currentPadVisitId) copyClinicalPadToClipboard(currentPadVisitId);
}

function triggerPadPrint() {
  if (currentPadVisitId) window.print();
}



document.addEventListener('DOMContentLoaded', () => {
  const formAddVisit = document.getElementById('form-add-visit');
  if (formAddVisit) {
    formAddVisit.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSaveVisit();
    });
  }

  const formEditPatient = document.getElementById('form-edit-patient');
  if (formEditPatient) {
    formEditPatient.addEventListener('submit', (e) => {
      e.preventDefault();
      if (state.currentPatientId) handleSavePatientEdit(state.currentPatientId);
    });
  }

  const btnUpdatePatient = document.getElementById('btn-update-patient');
  if (btnUpdatePatient) {
    btnUpdatePatient.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.currentPatientId) handleSavePatientEdit(state.currentPatientId);
    });
  }

  const btnSaveVisit = document.getElementById('btn-save-visit');
  if (btnSaveVisit) {
    btnSaveVisit.addEventListener('click', (e) => {
      e.preventDefault();
      handleSaveVisit();
    });
  }


  const scratchPatientName = document.getElementById('dash-scratchpad-patient-name');
  if (scratchPatientName) {
    const savedName = localStorage.getItem('dash_scratchpad_patient_name');
    if (savedName) scratchPatientName.value = savedName;
    scratchPatientName.addEventListener('input', () => {
      localStorage.setItem('dash_scratchpad_patient_name', scratchPatientName.value);
    });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   DASHBOARD NOTEPAD -> A5 CLINICAL PAD IMAGE GENERATOR & COPY TO CLIPBOARD
════════════════════════════════════════════════════════════════════════════ */

function getNotepadPatientTitle() {
  const inputEl = document.getElementById('dash-scratchpad-patient-name');
  const typedName = inputEl ? inputEl.value.trim() : '';
  if (typedName) return typedName;
  const activePatient = window._currentPatientData || null;
  if (activePatient && activePatient.name) return activePatient.name;
  return 'Clinical Note';
}

window.copyNotepadAsA5PadImage = async function() {
  const textarea = document.getElementById('dash-quick-scratchpad');
  const textContent = textarea ? textarea.value.trim() : '';

  if (!textContent) {
    showToast('warning', 'Empty Note', 'Please type some notes in the Notepad before copying.');
    return;
  }

  const patientTitle = getNotepadPatientTitle();

  const btn = document.getElementById('btn-copy-pad-scratch');
  const originalText = btn ? btn.innerHTML : '📋 Copy Pad';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="font-size:11px;">⏳ Generating…</span>`;
  }

  try {
    showToast('info', 'Generating A5 Pad…', 'Formatting notes on Clinical Pad.');

    const isUrdu = isUrduText(textContent);
    const textStyle = isUrdu
      ? "font-family:'Gulzar',serif; direction:rtl; font-size:16px; line-height:1.8; text-align:right;"
      : "font-family:'Inter',sans-serif; font-size:13.5px; line-height:1.6; color:#0f172a;";

    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Render raw user text properly without table-like boxes
    const formattedNotesHtml = `
      <div style="white-space: pre-wrap; text-align: center; ${textStyle}">
        ${esc(textContent)}
      </div>
    `;

    // Render A5 Clinical Pad structure in offscreen container
    const padContainer = document.createElement('div');
    padContainer.style.position = 'fixed';
    padContainer.style.left = '-9999px';
    padContainer.style.top = '-9999px';
    padContainer.style.zIndex = '-9999';

    padContainer.innerHTML = `
      <div id="scratch-a5-pad-printable" style="width:148mm; min-height:210mm; background:#ffffff; color:#0f172a; font-family:'Inter',sans-serif; box-sizing:border-box; margin:0 auto; padding:0; position:relative; display:flex; flex-direction:column; justify-content:space-between; border:1.5px solid #cbd5e1; border-radius:16px; box-shadow:0 12px 35px rgba(0,0,0,0.08); overflow:hidden;">
        
        <!-- Top Image Header (Exact Clinical Pad Header) -->
        <div style="width:100%; border-bottom:2px solid #0F8B6D; overflow:hidden;">
          <img src="clinical_pad_header.png" style="width:100%; height:auto; display:block;" alt="Atta Homeopathic Center Header" />
        </div>

        <!-- Main Pad Body -->
        <div style="padding:14px 18px; flex:1; display:flex; flex-direction:column; gap:14px; background:#ffffff;">
          
          <!-- Note Metadata Header Box -->
          <div style="border:1.5px solid #0F8B6D; border-radius:12px; padding:10px 14px; background:#f0fdf4; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:14px; color:#0F8B6D; display:flex; align-items:center; gap:6px;">
              <span>📝 ${esc(patientTitle)}</span>
            </div>
            <div style="font-size:12px; font-weight:700; color:#475569;">
              Date: <span style="color:#0f172a;">${esc(todayStr)}</span>
            </div>
          </div>

          <!-- Notepad Content Section Box -->
          <div style="border:1.5px solid #10b981; border-radius:12px; padding:14px 16px; background:#ffffff; flex:1; display:flex; flex-direction:column; justify-content: center; align-items: center;">
            <div style="flex:1; width:100%; display:flex; justify-content:center; align-items:center;">
              ${formattedNotesHtml}
            </div>
          </div>

        </div>

        <!-- Bottom Image Footer (Exact Clinical Pad Footer) -->
        <div style="width:100%; border-top:2px solid #0F8B6D; overflow:hidden; margin-top:auto;">
          <img src="clinical_pad_footer.png" style="width:100%; height:auto; display:block;" alt="Atta Homeopathic Center Footer" />
        </div>

      </div>`;

    document.body.appendChild(padContainer);
    const padEl = padContainer.querySelector('#scratch-a5-pad-printable');

    // Ensure header & footer images load before canvas rendering
    const imgs = padEl.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => { img.onload = res; img.onerror = res; });
    }));

    // Render high-definition A5 Canvas
    const canvas = await html2canvas(padEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    document.body.removeChild(padContainer);

    // Copy generated image blob to system clipboard
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    let copied = false;

    if (window.electronAPI && window.electronAPI.copyImageToClipboard) {
      copied = await window.electronAPI.copyImageToClipboard(dataUrl);
    }

    if (!copied) {
      // Standard Browser Clipboard API Fallback
      await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
              await navigator.clipboard.write([item]);
              copied = true;
            } catch(clipErr) {
              console.warn('Clipboard write warning:', clipErr);
            }
          }
          resolve();
        }, 'image/png');
      });
    }

    showToast('success', '📋 A5 Pad Copied!', 'A5 Clinical Pad image copied to clipboard. Ready to paste in WhatsApp, Word, or messages.');

  } catch (err) {
    console.error('Copy Pad error:', err);
    showToast('error', 'Failed to Copy Pad', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   AZAN ALARM SYSTEM
════════════════════════════════════════════════════════════════════════════ */

let azanAudioPlayer = null;
const AZAN_PRAYERS = [
  { key: 'fajr', urdu: 'فجر', defaultTime: '05:00' },
  { key: 'dhuhr', urdu: 'ظہر', defaultTime: '13:30' },
  { key: 'asr', urdu: 'عصر', defaultTime: '17:00' },
  { key: 'maghrib', urdu: 'مغرب', defaultTime: '18:45' },
  { key: 'isha', urdu: 'عشاء', defaultTime: '20:15' }
];

window.saveAzanPrayerSetting = function(prayerKey) {
  const timeInput = document.getElementById(`azan-time-${prayerKey}`);
  const toggleInput = document.getElementById(`azan-toggle-${prayerKey}`);
  if (!timeInput || !toggleInput) return;

  const timeVal = timeInput.value;
  const enabled = toggleInput.checked;

  localStorage.setItem(`azan_time_${prayerKey}`, timeVal);
  localStorage.setItem(`azan_enabled_${prayerKey}`, enabled ? 'true' : 'false');

  const pObj = AZAN_PRAYERS.find(p => p.key === prayerKey);
  const pName = pObj ? pObj.urdu : prayerKey;
  showToast('success', 'Azan Alarm Saved', `${pName} alarm set for ${timeVal} (${enabled ? 'ON' : 'OFF'}).`);
};

window.stopAzanAudio = function() {
  if (azanAudioPlayer) {
    azanAudioPlayer.pause();
    azanAudioPlayer.currentTime = 0;
  }
  const banner = document.getElementById('azan-announcement-banner');
  if (banner) banner.style.display = 'none';
  showToast('info', 'Azan Stopped', 'Azan playback stopped.');
};

function playAzan(prayerUrduName) {
  try {
    if (!azanAudioPlayer) {
      azanAudioPlayer = new Audio('azan1.mp3');
    } else {
      azanAudioPlayer.pause();
      azanAudioPlayer.currentTime = 0;
    }

    const banner = document.getElementById('azan-announcement-banner');
    const bannerTitle = document.getElementById('azan-banner-title');
    if (banner && bannerTitle) {
      bannerTitle.textContent = `${prayerUrduName} کا وقت ہو گیا ہے`;
      banner.style.display = 'flex';
    }

    azanAudioPlayer.play().catch(err => {
      console.warn('Azan audio play blocked or missing file:', err);
    });
    showToast('info', '🕌 Azan Time', `${prayerUrduName} ka Azan time ho gaya hai!`, 10000);
  } catch(e) {
    console.error('Play Azan error:', e);
  }
}

function initAzanAlarmSystem() {
  AZAN_PRAYERS.forEach(p => {
    const savedTime = localStorage.getItem(`azan_time_${p.key}`);
    const savedEnabled = localStorage.getItem(`azan_enabled_${p.key}`);

    const timeInput = document.getElementById(`azan-time-${p.key}`);
    const toggleInput = document.getElementById(`azan-toggle-${p.key}`);

    if (timeInput && savedTime) timeInput.value = savedTime;
    if (toggleInput && savedEnabled !== null) toggleInput.checked = (savedEnabled === 'true');
  });

  let lastCheckedMin = '';

  setInterval(() => {
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (currentHHMM === lastCheckedMin) return;
    lastCheckedMin = currentHHMM;

    AZAN_PRAYERS.forEach(p => {
      const enabled = (localStorage.getItem(`azan_enabled_${p.key}`) ?? 'true') === 'true';
      const timeVal = localStorage.getItem(`azan_time_${p.key}`) || p.defaultTime;

      if (enabled && timeVal === currentHHMM) {
        playAzan(p.urdu);
      }
    });
  }, 10000);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initAzanAlarmSystem, 500);
});

window.generateRestockPDF = function() {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      showToast('error', 'PDF Error', 'jsPDF library not loaded.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // HEADER
    doc.setFillColor(15, 139, 109); // #0F8B6D
    doc.rect(0, 0, 210, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('MEDICINE RESTOCK REQUEST', 14, 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated Date: ${todayStr}`, 14, 18);

    // Filter Out of Stock only
    let currentInventoryMeds = window.currentInventoryMeds || [];
    if (currentInventoryMeds.length === 0 && window.allRecordsState && window.allRecordsState.medicines) {
      currentInventoryMeds = window.allRecordsState.medicines;
    }
    
    if (currentInventoryMeds.length === 0) {
      // Need a way to fetch if not cached, but it should be available in the table 
      showToast('error', 'Data Error', 'Inventory data not loaded yet.');
      return;
    }

    const outOfStockMeds = currentInventoryMeds.filter(m => (m.stock_status || '') === 'Out of Stock');

    // Also get the Required Qty from the dom inputs
    const reqQtyInputs = document.querySelectorAll('.req-qty-input');
    const reqQtyMap = {};
    reqQtyInputs.forEach(input => {
      reqQtyMap[input.dataset.id] = input.value;
    });

    const tableRows = outOfStockMeds.map((m, idx) => [
      String(idx + 1),
      m.name || '-',
      m.category || '-',
      reqQtyMap[m.id] || '-'
    ]);

    doc.autoTable({
      startY: 28,
      head: [['Serial No.', 'Medicine Name', 'Category', 'Required Quantity']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 139, 109], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 28, left: 14, right: 14 }
    });

    doc.save('Medicine_Restock_Request.pdf');
  } catch (err) {
    showToast('error', 'PDF Error', err.message);
  }
};

window.copyScratchpad = async function() {
  const textarea = document.getElementById('dash-quick-scratchpad');
  const textContent = textarea ? textarea.value.trim() : '';

  if (!textContent) {
    showToast('warning', 'Empty Note', 'Nothing to copy in the Notepad.');
    return;
  }

  const patientTitle = getNotepadPatientTitle();
  const fullCopyText = `${patientTitle}\n------------------------------\n${textContent}\n------------------------------\nClinical Notes raise kar do`;

  try {
    await navigator.clipboard.writeText(fullCopyText);
    showToast('success', 'Copied Text', 'Clinical note text copied to clipboard.');
  } catch (err) {
    showToast('error', 'Copy Failed', err.message);
  }
};

window.printNotepad = function() {
  const textarea = document.getElementById('dash-quick-scratchpad');
  const textContent = textarea ? textarea.value.trim() : '';

  if (!textContent) {
    showToast('warning', 'Empty Note', 'Please type some notes in the Notepad before printing.');
    return;
  }

  const patientTitle = getNotepadPatientTitle();
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const formattedLinesHtml = `
    <div style="white-space: pre-wrap; text-align: center; font-size: 14px; line-height: 1.6; color: #1e293b;">
      ${esc(textContent)}
    </div>
  `;

  const printWindow = window.open('', '_blank', 'width=700,height=800');
  if (!printWindow) {
    showToast('error', 'Print Blocked', 'Pop-up window was blocked. Please allow pop-ups for this app to print.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Notepad - ${esc(patientTitle)}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 24px; color: #0f172a; background: #ffffff; }
        .print-header { border-bottom: 2px solid #0F8B6D; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .print-title { font-size: 18px; font-weight: 800; color: #0F8B6D; }
        .print-date { font-size: 13px; color: #64748b; font-weight: 600; }
        .print-footer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 12px; color: #94a3b8; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="print-header">
        <div class="print-title">${esc(patientTitle)}</div>
        <div class="print-date">Date: ${esc(todayStr)}</div>
      </div>
      <div class="print-body" style="display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1;">
        ${formattedLinesHtml}
      </div>
      <script>
        window.onload = function() { window.print(); window.close(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};




function renderGrowthAnalyticsCanvas(data) {
  const ctxGrowth = document.getElementById('chart-growth-analytics')?.getContext('2d');
  if (!ctxGrowth) return;

  const metric = window._activeGrowthMetric || 'visits';
  const range = window._activeGrowthRange || 'last-28-days';

  let labels = [];
  let values = [];
  let labelName = 'Visits';
  let color = '#3b82f6';
  let isCurrency = false;

  if (metric === 'patients') {
    labelName = 'Patients Registered';
    color = '#10b981';
    const list = (range.includes('year') ? data.yearlyPatientGrowth : data.monthlyPatientGrowth) || data.dailyPatients || [];
    if (list.length > 0) {
      labels = list.map(d => d.monthLabel || d.yearLabel || d.dateLabel || d.regDate);
      values = list.map(d => d.count || 0);
    } else {
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      values = [12, 19, 15, 25, 22, 30];
    }
  } else if (metric === 'revenue') {
    labelName = 'Revenue';
    color = '#8b5cf6';
    isCurrency = true;
    const list = (range.includes('year') ? data.yearlyRevenue : (data.monthlyTotalRevenue || data.monthlyEarnings)) || data.weeklyEarningsCurrentMonth || [];
    if (list.length > 0) {
      labels = list.map(d => d.monthLabel || d.yearLabel || d.dateLabel || ('Week ' + d.weekLabel));
      values = list.map(d => d.amount || d.count || 0);
    } else {
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      values = [25000, 38000, 31000, 45000, 42000, 58000];
    }
  } else {
    // Visits
    labelName = 'Visits';
    color = '#3b82f6';
    const list = (range.includes('year') ? data.yearlyVisitsGrowth : (data.monthlyVisitsGrowth || data.dailyPatients)) || [];
    if (list.length > 0) {
      labels = list.map(d => d.monthLabel || d.yearLabel || d.dateLabel);
      values = list.map(d => d.count || 0);
    } else {
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      values = [18, 28, 24, 35, 30, 42];
    }
  }

  labels = labels.map(l => {
    if (typeof l === 'string' && l.match(/^\d{4}-\d{2}$/)) {
      const parts = l.split('-');
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return monthNames[mIdx] + " '" + parts[0].slice(2);
    }
    return l;
  });

  if (state.charts['growth-analytics']) state.charts['growth-analytics'].destroy();
  state.charts['growth-analytics'] = new Chart(ctxGrowth, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: labelName,
        data: values,
        borderColor: color,
        borderWidth: 3,
        backgroundColor: (context) => {
          const chartCtx = context.chart.ctx;
          const gradient = chartCtx.createLinearGradient(0, 0, 0, 240);
          gradient.addColorStop(0, color + '33');
          gradient.addColorStop(1, color + '00');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: color,
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          callbacks: {
            label: (ctx) => ` ${labelName}: ${isCurrency ? 'Rs ' + ctx.parsed.y.toLocaleString() : ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 11, weight: '500' } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.6)' },
          ticks: {
            color: '#64748b',
            font: { size: 11, weight: '500' },
            callback: (val) => isCurrency ? 'Rs ' + (val >= 1000 ? (val/1000).toFixed(0) + 'k' : val) : val
          }
        }
      }
    }
  });
}