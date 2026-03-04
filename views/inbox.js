/* ============================================================
   views/inbox.js — Result review inbox with tabs
   ============================================================ */

let _inboxTab = 'labs';

function _inboxEncounterFilter(item) {
  const mode = getEncounterMode();
  if (!item.encounterId) return true; // Items without encounter show in both modes
  const enc = getEncounter(item.encounterId);
  return encounterMatchesMode(enc, mode);
}

function getFilteredLabsInbox() {
  return getAllLabResults().filter(l => !l.reviewedBy && _inboxEncounterFilter(l));
}

function getFilteredNotesInbox() {
  return getNotes().filter(n => !n.signed && _inboxEncounterFilter(n));
}

function getFilteredOrdersInbox() {
  return getOrders().filter(o => o.status === 'Pending' && _inboxEncounterFilter(o));
}

function getFilteredReferralsInbox() {
  return loadAll(KEYS.referrals).filter(r => (r.status === 'Pending' || r.status === 'Sent') && _inboxEncounterFilter(r));
}

function getInboxCounts() {
  const labs = getFilteredLabsInbox().length;
  const notes = getFilteredNotesInbox().length;
  const orders = getFilteredOrdersInbox().length;
  const referrals = getFilteredReferralsInbox().length;
  return { labs, notes, orders, referrals, total: labs + notes + orders + referrals };
}

function updateInboxBadge() {
  const badge = document.getElementById('inbox-badge');
  if (!badge) return;
  const counts = getInboxCounts();
  badge.textContent = counts.total > 0 ? counts.total : '';
}

function renderInbox() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  setTopbar({ title: 'Inbox', meta: '', actions: '' });
  setActiveNav('inbox');

  const counts = getInboxCounts();

  // Tab bar
  const tabs = document.createElement('div');
  tabs.className = 'inbox-tabs';

  const tabDefs = [
    { key: 'labs',      label: 'Unreviewed Labs', count: counts.labs },
    { key: 'notes',     label: 'Unsigned Notes',  count: counts.notes },
    { key: 'orders',    label: 'Pending Orders',  count: counts.orders },
    { key: 'referrals', label: 'Pending Referrals', count: counts.referrals },
  ];

  tabDefs.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'inbox-tab' + (_inboxTab === t.key ? ' active' : '');
    btn.textContent = t.label + ' ';

    const badge = document.createElement('span');
    badge.className = 'tab-badge';
    badge.textContent = t.count;
    btn.appendChild(badge);

    btn.addEventListener('click', () => { _inboxTab = t.key; renderInbox(); });
    tabs.appendChild(btn);
  });
  app.appendChild(tabs);

  // Content card
  const card = document.createElement('div');
  card.className = 'card';
  card.style.margin = '16px 20px';

  switch (_inboxTab) {
    case 'labs':      buildLabsInbox(card); break;
    case 'notes':     buildNotesInbox(card); break;
    case 'orders':    buildOrdersInbox(card); break;
    case 'referrals': buildReferralsInbox(card); break;
  }

  app.appendChild(card);
}

function buildLabsInbox(card) {
  const labs = getFilteredLabsInbox();

  if (labs.length === 0) {
    card.appendChild(buildEmptyState('🔬', 'No unreviewed labs', 'All lab results have been reviewed.'));
    return;
  }

  labs.forEach(lab => {
    const patient = getPatient(lab.patientId);
    const item = document.createElement('div');
    item.className = 'inbox-item';

    const body = document.createElement('div');
    body.className = 'inbox-item-body';
    const title = document.createElement('div');
    title.className = 'inbox-item-title';
    title.textContent = lab.panel;
    const meta = document.createElement('div');
    meta.className = 'inbox-item-meta';
    meta.textContent = (patient ? patient.lastName + ', ' + patient.firstName : 'Unknown') + ' · ' + formatDateTime(lab.resultDate);
    body.appendChild(title);
    body.appendChild(meta);

    // Flag summary
    const flags = (lab.tests || []).filter(t => t.flag && t.flag !== 'Normal');
    if (flags.length > 0) {
      const flagEl = document.createElement('div');
      flagEl.style.cssText = 'font-size:11px;color:var(--warning);margin-top:2px';
      flagEl.textContent = flags.length + ' abnormal result' + (flags.length !== 1 ? 's' : '');
      body.appendChild(flagEl);
    }

    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'btn btn-primary btn-sm';
    reviewBtn.textContent = 'Review';
    reviewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openLabReviewModal(lab.id);
    });

    item.appendChild(body);
    item.appendChild(reviewBtn);

    item.addEventListener('click', () => {
      if (patient) navigate('#chart/' + patient.id);
    });

    card.appendChild(item);
  });
}

function openLabReviewModal(labId) {
  const lab = getAllLabResults().find(l => l.id === labId);
  if (!lab) return;

  const patient = getPatient(lab.patientId);
  const patName = patient ? patient.firstName + ' ' + patient.lastName : 'Unknown';

  let testsHTML = '<table class="table" style="font-size:13px"><thead><tr><th>Test</th><th>Value</th><th>Unit</th><th>Ref Range</th><th>Flag</th></tr></thead><tbody>';
  (lab.tests || []).forEach(t => {
    const flagClass = t.flag === 'Normal' ? 'flag-normal' : (t.flag === 'High' ? 'flag-high' : (t.flag === 'Low' ? 'flag-low' : ''));
    testsHTML += '<tr><td>' + esc(t.name) + '</td><td style="font-weight:600">' + esc(t.value) + '</td><td>' + esc(t.unit) + '</td><td>' + esc(t.referenceRange) + '</td><td class="' + flagClass + '">' + esc(t.flag) + '</td></tr>';
  });
  testsHTML += '</tbody></table>';

  const bodyHTML = `
    <div style="margin-bottom:12px">
      <strong>Patient:</strong> <span id="lab-rev-patient"></span><br>
      <strong>Panel:</strong> <span id="lab-rev-panel"></span><br>
      <strong>Date:</strong> <span id="lab-rev-date"></span><br>
      <strong>Notes:</strong> <span id="lab-rev-notes"></span>
    </div>
    <div class="table-wrap">${testsHTML}</div>
  `;

  openModal({
    title: 'Lab Review',
    bodyHTML,
    footerHTML: '<button class="btn btn-secondary" id="lab-rev-close">Close</button><button class="btn btn-primary" id="lab-rev-mark">Mark Reviewed</button>',
    size: 'lg',
  });

  document.getElementById('lab-rev-patient').textContent = patName;
  document.getElementById('lab-rev-panel').textContent = lab.panel;
  document.getElementById('lab-rev-date').textContent = formatDateTime(lab.resultDate);
  document.getElementById('lab-rev-notes').textContent = lab.notes || '—';

  document.getElementById('lab-rev-close').addEventListener('click', closeModal);
  document.getElementById('lab-rev-mark').addEventListener('click', () => {
    const currentProv = getCurrentProvider();
    saveLabResult({
      id: lab.id,
      reviewedBy: currentProv || 'Current User',
      reviewedAt: new Date().toISOString(),
    });
    closeModal();
    showToast('Lab result marked as reviewed.', 'success');
    updateInboxBadge();
    renderInbox();
  });
}

function buildNotesInbox(card) {
  const unsignedNotes = getFilteredNotesInbox();

  if (unsignedNotes.length === 0) {
    card.appendChild(buildEmptyState('📝', 'No unsigned notes', 'All notes have been signed.'));
    return;
  }

  unsignedNotes.forEach(note => {
    const enc = getEncounter(note.encounterId);
    const patient = enc ? getPatient(enc.patientId) : null;

    const item = document.createElement('div');
    item.className = 'inbox-item';

    const body = document.createElement('div');
    body.className = 'inbox-item-body';
    const title = document.createElement('div');
    title.className = 'inbox-item-title';
    title.textContent = note.chiefComplaint || 'Untitled Note';
    const meta = document.createElement('div');
    meta.className = 'inbox-item-meta';
    meta.textContent = (patient ? patient.lastName + ', ' + patient.firstName : 'Unknown') + ' · ' + formatDateTime(note.lastModified);
    body.appendChild(title);
    body.appendChild(meta);

    const goBtn = document.createElement('button');
    goBtn.className = 'btn btn-secondary btn-sm';
    goBtn.textContent = 'Open';
    goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate('#encounter/' + note.encounterId);
    });

    item.appendChild(body);
    item.appendChild(goBtn);
    item.addEventListener('click', () => navigate('#encounter/' + note.encounterId));
    card.appendChild(item);
  });
}

function buildOrdersInbox(card) {
  const pendingOrders = getFilteredOrdersInbox();

  if (pendingOrders.length === 0) {
    card.appendChild(buildEmptyState('📋', 'No pending orders', 'All orders have been processed.'));
    return;
  }

  pendingOrders.forEach(order => {
    const patient = getPatient(order.patientId);
    const item = document.createElement('div');
    item.className = 'inbox-item';

    const body = document.createElement('div');
    body.className = 'inbox-item-body';
    const title = document.createElement('div');
    title.className = 'inbox-item-title';
    title.textContent = order.type + ': ' + (order.detail.drug || order.detail.panel || order.detail.modality || order.detail.service || 'Order');
    const meta = document.createElement('div');
    meta.className = 'inbox-item-meta';
    meta.textContent = (patient ? patient.lastName + ', ' + patient.firstName : 'Unknown') + ' · ' + order.priority + ' · ' + formatDateTime(order.dateTime);
    body.appendChild(title);
    body.appendChild(meta);

    const goBtn = document.createElement('button');
    goBtn.className = 'btn btn-secondary btn-sm';
    goBtn.textContent = 'View';
    goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate('#orders/' + order.encounterId);
    });

    item.appendChild(body);
    item.appendChild(goBtn);
    item.addEventListener('click', () => navigate('#orders/' + order.encounterId));
    card.appendChild(item);
  });
}

function buildReferralsInbox(card) {
  const pendingRefs = getFilteredReferralsInbox()
    .sort((a, b) => new Date(b.referralDate) - new Date(a.referralDate));

  if (pendingRefs.length === 0) {
    card.appendChild(buildEmptyState('🔗', 'No pending referrals', 'All referrals have been resolved.'));
    return;
  }

  pendingRefs.forEach(ref => {
    const patient = getPatient(ref.patientId);
    const item = document.createElement('div');
    item.className = 'inbox-item';

    const body = document.createElement('div');
    body.className = 'inbox-item-body';
    const title = document.createElement('div');
    title.className = 'inbox-item-title';
    title.textContent = ref.specialty + ' — ' + (ref.providerName || 'TBD');
    const meta = document.createElement('div');
    meta.className = 'inbox-item-meta';
    meta.textContent = (patient ? patient.lastName + ', ' + patient.firstName : 'Unknown') + ' · ' + ref.status + ' · ' + formatDate(ref.referralDate);
    body.appendChild(title);
    body.appendChild(meta);

    const goBtn = document.createElement('button');
    goBtn.className = 'btn btn-secondary btn-sm';
    goBtn.textContent = 'View';
    goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (patient) navigate('#chart/' + patient.id);
    });

    item.appendChild(body);
    item.appendChild(goBtn);
    item.addEventListener('click', () => { if (patient) navigate('#chart/' + patient.id); });
    card.appendChild(item);
  });
}
