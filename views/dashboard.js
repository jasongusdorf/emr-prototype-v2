/* ============================================================
   views/dashboard.js — Patient list + search + New Patient modal
   + Summary bar, alerts, upcoming appointments, My Patients
   ============================================================ */

let _dashMyPatientsOnly = false;

function renderDashboard() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const mode = getEncounterMode();
  const isInpatient = mode === 'inpatient';

  setTopbar({
    title:   isInpatient ? 'Inpatient Census' : 'Patient Dashboard',
    meta:    '',
    actions: isInpatient
      ? '<button class="btn btn-primary btn-sm" id="btn-new-patient">+ Admit Patient</button>'
      : '<button class="btn btn-primary btn-sm" id="btn-new-patient">+ New Patient</button>',
  });
  setActiveNav('dashboard');

  const allPatients = isInpatient
    ? getPatientsWithActiveInpatientEncounters().sort((a, b) =>
        (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName))
    : getPatients().sort((a, b) =>
        (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName));

  // ===== Summary Bar =====
  const summaryBar = document.createElement('div');
  summaryBar.className = 'dashboard-summary-bar';

  let stats;
  if (isInpatient) {
    const inpatientEncs = getEncounters().filter(e =>
      (e.visitType || '').toLowerCase() === 'inpatient' && e.status !== 'Signed' && e.status !== 'Cancelled');
    const inpatientEncIds = new Set(inpatientEncs.map(e => e.id));
    const unsignedCount = getNotes().filter(n => !n.signed && inpatientEncIds.has(n.encounterId)).length;
    const pendingOrdersCount = getOrders().filter(o => o.status === 'Pending' && inpatientEncIds.has(o.encounterId)).length;
    stats = [
      { value: allPatients.length, label: 'Census Count', cls: '' },
      { value: inpatientEncs.length, label: 'Active Admissions', cls: '' },
      { value: unsignedCount, label: 'Unsigned Notes', cls: unsignedCount > 0 ? 'stat-warning' : '' },
      { value: pendingOrdersCount, label: 'Pending Orders', cls: pendingOrdersCount > 0 ? 'stat-warning' : '' },
    ];
  } else {
    const overdueCount = allPatients.reduce((sum, p) => sum + getOverdueScreeningsCount(p), 0);
    const unsignedCount = getNotes().filter(n => !n.signed).length;
    const pendingOrdersCount = getOrders().filter(o => o.status === 'Pending').length;
    stats = [
      { value: allPatients.length, label: 'Total Patients', cls: '' },
      { value: overdueCount,       label: 'Overdue Screenings', cls: overdueCount > 0 ? 'stat-danger' : '' },
      { value: unsignedCount,      label: 'Unsigned Notes', cls: unsignedCount > 0 ? 'stat-warning' : '' },
      { value: pendingOrdersCount, label: 'Pending Orders', cls: pendingOrdersCount > 0 ? 'stat-warning' : '' },
    ];
  }

  stats.forEach(s => {
    const stat = document.createElement('div');
    stat.className = 'summary-stat';
    const val = document.createElement('div');
    val.className = 'summary-stat-value' + (s.cls ? ' ' + s.cls : '');
    val.textContent = s.value;
    const lbl = document.createElement('div');
    lbl.className = 'summary-stat-label';
    lbl.textContent = s.label;
    stat.appendChild(val);
    stat.appendChild(lbl);
    summaryBar.appendChild(stat);
  });
  app.appendChild(summaryBar);

  // ===== Upcoming Appointments Card (outpatient only) =====
  if (!isInpatient) {
    const now = new Date();
    const upcomingAppts = getAppointments()
      .filter(a => new Date(a.dateTime) >= now && a.status !== 'Cancelled' && a.status !== 'No-Show')
      .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
      .slice(0, 10);

    if (upcomingAppts.length > 0) {
      const apptCard = document.createElement('div');
      apptCard.className = 'card';
      apptCard.style.marginBottom = '16px';
      const apptHdr = document.createElement('div');
      apptHdr.className = 'card-header';
      const apptTitle = document.createElement('span');
      apptTitle.className = 'card-title';
      apptTitle.textContent = 'Upcoming Appointments';
      apptHdr.appendChild(apptTitle);
      apptCard.appendChild(apptHdr);

      upcomingAppts.forEach(appt => {
        const patient = getPatient(appt.patientId);
        const provider = getProvider(appt.providerId);
        const item = document.createElement('div');
        item.className = 'upcoming-appt-item';
        item.addEventListener('click', () => navigate('#schedule'));

        const time = document.createElement('span');
        time.className = 'upcoming-appt-time';
        time.textContent = formatDateTime(appt.dateTime);
        const name = document.createElement('span');
        name.className = 'upcoming-appt-patient';
        name.textContent = patient ? patient.lastName + ', ' + patient.firstName : 'Unknown';
        const type = document.createElement('span');
        type.className = 'upcoming-appt-type';
        type.textContent = appt.visitType;
        const prov = document.createElement('span');
        prov.className = 'upcoming-appt-provider';
        prov.textContent = provider ? provider.lastName + ', ' + provider.firstName : '—';

        item.appendChild(time);
        item.appendChild(name);
        item.appendChild(type);
        item.appendChild(prov);
        apptCard.appendChild(item);
      });
      app.appendChild(apptCard);
    }
  }

  // ===== Search bar + My Patients/Census toggle =====
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap';

  const searchBar = document.createElement('div');
  searchBar.className = 'search-bar';
  searchBar.style.maxWidth = '400px';
  searchBar.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input type="text" id="patient-search" placeholder="Search by name or MRN…" autocomplete="off" />
  `;
  searchWrap.appendChild(searchBar);

  // My Patients toggle
  const currentProv = getCurrentProvider();
  const myPatientsToggle = document.createElement('label');
  myPatientsToggle.className = 'my-patients-toggle';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'my-patients-checkbox';
  checkbox.checked = _dashMyPatientsOnly;
  checkbox.disabled = !currentProv;
  myPatientsToggle.appendChild(checkbox);
  const toggleLabel = document.createTextNode(isInpatient ? ' My Census' : ' My Patients');
  myPatientsToggle.appendChild(toggleLabel);
  if (!currentProv) {
    const hint = document.createElement('span');
    hint.style.cssText = 'font-size:11px;color:var(--text-muted);margin-left:4px';
    hint.textContent = '(select provider first)';
    myPatientsToggle.appendChild(hint);
  }
  searchWrap.appendChild(myPatientsToggle);
  app.appendChild(searchWrap);

  // ===== Patient Table =====
  const card = document.createElement('div');
  card.className = 'card';

  const header = document.createElement('div');
  header.className = 'card-header';
  const cardTitle = document.createElement('span');
  cardTitle.className = 'card-title';
  cardTitle.textContent = isInpatient ? 'All Census' : 'All Patients';
  const countEl = document.createElement('span');
  countEl.className = 'text-muted text-sm';
  countEl.id = 'patient-count';
  const countUnit = isInpatient ? 'patient' : 'patient';
  countEl.textContent = allPatients.length + ' ' + countUnit + (allPatients.length !== 1 ? 's' : '');
  header.appendChild(cardTitle);
  header.appendChild(countEl);
  card.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'table';
  const colCount = isInpatient ? 7 : 8;

  if (isInpatient) {
    table.innerHTML = `<thead><tr>
      <th>Name</th><th>MRN</th><th>Admission Date</th><th>Attending</th><th>Status</th><th>Alerts</th><th></th>
    </tr></thead>`;
  } else {
    table.innerHTML = `<thead><tr>
      <th>Name</th><th>MRN</th><th>DOB</th><th>Sex</th><th>Phone</th><th>Insurance</th><th>Alerts</th><th></th>
    </tr></thead>`;
  }

  const tbody = document.createElement('tbody');
  tbody.id = 'patient-tbody';

  function getFilteredPatients() {
    let list = allPatients;
    if (_dashMyPatientsOnly && currentProv) {
      list = list.filter(p => (p.panelProviders || []).includes(currentProv));
    }
    const q = (document.getElementById('patient-search')?.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.firstName + ' ' + p.lastName).toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q)
      );
    }
    return list;
  }

  function renderRows(list) {
    tbody.innerHTML = '';
    if (list.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = colCount;
      td.style.textAlign = 'center';
      td.style.padding = '32px';
      td.style.color = 'var(--text-muted)';
      td.textContent = isInpatient ? 'No inpatient admissions.' : 'No patients found.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    list.forEach(pat => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      const nameBtn = document.createElement('button');
      nameBtn.className = 'table-link';
      nameBtn.textContent = pat.lastName + ', ' + pat.firstName;
      nameBtn.onclick = () => navigate('#chart/' + pat.id);
      tdName.appendChild(nameBtn);

      const tdMrn = createTd(pat.mrn);

      if (isInpatient) {
        // Find the active inpatient encounter for this patient
        const ipEnc = getEncountersByPatient(pat.id).find(e =>
          (e.visitType || '').toLowerCase() === 'inpatient' && e.status !== 'Signed' && e.status !== 'Cancelled');
        const admitDate = ipEnc ? formatDateTime(ipEnc.dateTime) : '—';
        const attending = ipEnc && ipEnc.providerId ? getProvider(ipEnc.providerId) : null;
        const attendingName = attending ? attending.lastName + ', ' + attending.firstName : '—';
        const encStatus = ipEnc ? ipEnc.status : '—';

        const tdAdmit = createTd(admitDate);
        const tdAttending = createTd(attendingName);
        const tdStatus = createTd(encStatus);

        // Alerts
        const tdAlerts = document.createElement('td');
        const badges = document.createElement('div');
        badges.className = 'alert-badges';
        const unsigned = getUnsignedNotesCount(pat.id);
        if (unsigned > 0) {
          const b = document.createElement('span');
          b.className = 'alert-badge alert-badge-amber';
          b.textContent = unsigned + ' unsigned';
          b.onclick = () => navigate('#chart/' + pat.id);
          badges.appendChild(b);
        }
        const pendingOrd = getOrdersByPatient(pat.id).filter(o => o.status === 'Pending').length;
        if (pendingOrd > 0) {
          const b = document.createElement('span');
          b.className = 'alert-badge alert-badge-blue';
          b.textContent = pendingOrd + ' pending';
          b.onclick = () => navigate('#chart/' + pat.id);
          badges.appendChild(b);
        }
        tdAlerts.appendChild(badges);

        // Actions
        const tdActions = document.createElement('td');
        tdActions.style.textAlign = 'right';
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-secondary btn-sm';
        viewBtn.textContent = 'View';
        viewBtn.onclick = () => navigate('#chart/' + pat.id);
        tdActions.appendChild(viewBtn);

        tr.appendChild(tdName);
        tr.appendChild(tdMrn);
        tr.appendChild(tdAdmit);
        tr.appendChild(tdAttending);
        tr.appendChild(tdStatus);
        tr.appendChild(tdAlerts);
        tr.appendChild(tdActions);
      } else {
        const tdDob  = createTd(formatDate(pat.dob));
        const tdSex  = createTd(pat.sex);
        const tdPhone = createTd(pat.phone);
        const tdIns  = createTd(pat.insurance);

        // Alerts column
        const tdAlerts = document.createElement('td');
        const badges = document.createElement('div');
        badges.className = 'alert-badges';

        const overdues = getOverdueScreeningsCount(pat);
        if (overdues > 0) {
          const b = document.createElement('span');
          b.className = 'alert-badge alert-badge-red';
          b.textContent = overdues + ' overdue';
          b.onclick = () => navigate('#chart/' + pat.id);
          badges.appendChild(b);
        }

        const unsigned = getUnsignedNotesCount(pat.id);
        if (unsigned > 0) {
          const b = document.createElement('span');
          b.className = 'alert-badge alert-badge-amber';
          b.textContent = unsigned + ' unsigned';
          b.onclick = () => navigate('#chart/' + pat.id);
          badges.appendChild(b);
        }

        const pendingOrd = getOrdersByPatient(pat.id).filter(o => o.status === 'Pending').length;
        if (pendingOrd > 0) {
          const b = document.createElement('span');
          b.className = 'alert-badge alert-badge-blue';
          b.textContent = pendingOrd + ' pending';
          b.onclick = () => navigate('#chart/' + pat.id);
          badges.appendChild(b);
        }

        tdAlerts.appendChild(badges);

        // Actions
        const tdActions = document.createElement('td');
        tdActions.style.textAlign = 'right';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-sm';
        editBtn.setAttribute('data-action', 'edit');
        editBtn.setAttribute('data-id', pat.id);
        editBtn.textContent = 'Edit';
        tdActions.appendChild(editBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm';
        delBtn.style.marginLeft = '6px';
        delBtn.setAttribute('data-action', 'delete');
        delBtn.setAttribute('data-id', pat.id);
        delBtn.textContent = 'Delete';
        tdActions.appendChild(delBtn);

        tr.appendChild(tdName);
        tr.appendChild(tdMrn);
        tr.appendChild(tdDob);
        tr.appendChild(tdSex);
        tr.appendChild(tdPhone);
        tr.appendChild(tdIns);
        tr.appendChild(tdAlerts);
        tr.appendChild(tdActions);
      }
      tbody.appendChild(tr);
    });
  }

  function refreshTable() {
    const list = getFilteredPatients();
    renderRows(list);
    document.getElementById('patient-count').textContent =
      list.length + ' patient' + (list.length !== 1 ? 's' : '');
    cardTitle.textContent = _dashMyPatientsOnly
      ? (isInpatient ? 'My Census' : 'My Patients')
      : (isInpatient ? 'All Census' : 'All Patients');
  }

  renderRows(getFilteredPatients());
  table.appendChild(tbody);
  wrap.appendChild(table);
  card.appendChild(wrap);
  app.appendChild(card);

  // Event delegation for edit/delete
  tbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'delete') {
      confirmDeletePatient(id, () => renderDashboard());
    }
    if (btn.dataset.action === 'edit') {
      const pat = getPatient(id);
      if (pat) openEditPatientModal(pat, () => renderDashboard());
    }
  });

  // Search
  document.getElementById('patient-search').addEventListener('input', refreshTable);

  // My Patients toggle
  checkbox.addEventListener('change', () => {
    _dashMyPatientsOnly = checkbox.checked;
    refreshTable();
  });

  // Topbar new patient
  document.getElementById('btn-new-patient').addEventListener('click', () => openNewPatientModal());
}

/* ============================================================
   Helper: Overdue screenings count for a patient
   ============================================================ */
function getOverdueScreeningsCount(patient) {
  if (!patient.dob) return 0;
  const today = new Date();
  const dob = new Date(patient.dob + 'T00:00:00');
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

  const records = getScreeningRecords(patient.id);
  let count = 0;

  (typeof SCREENING_RULES !== 'undefined' ? SCREENING_RULES : []).forEach(rule => {
    if (rule.sex && rule.sex !== patient.sex) return;
    if (age < rule.minAge) return;
    if (rule.maxAge && age > rule.maxAge) return;

    const rec = records.find(r => r.screening === rule.id);
    if (!rec) { count++; return; }
    if (rule.intervalYears) {
      const lastDate = new Date(rec.completedDate || rec.nextDue);
      const nextDue = new Date(lastDate);
      nextDue.setFullYear(nextDue.getFullYear() + rule.intervalYears);
      if (nextDue < today) count++;
    }
  });
  return count;
}

function getUnsignedNotesCount(patientId) {
  const encs = getEncountersByPatient(patientId);
  return encs.reduce((sum, enc) => {
    const note = getNoteByEncounter(enc.id);
    return sum + (note && !note.signed ? 1 : 0);
  }, 0);
}

/* ============================================================
   New Patient Modal (expanded with all fields)
   ============================================================ */
function openNewPatientModal() {
  const bodyHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">First Name *</label>
        <input class="form-control" id="np-first" placeholder="First name" />
      </div>
      <div class="form-group">
        <label class="form-label">Last Name *</label>
        <input class="form-control" id="np-last" placeholder="Last name" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Date of Birth *</label>
        <input class="form-control" id="np-dob" type="date" />
      </div>
      <div class="form-group">
        <label class="form-label">Sex</label>
        <select class="form-control" id="np-sex">
          <option value="">— Select —</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
          <option>Unknown</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-control" id="np-phone" placeholder="(555) 000-0000" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-control" id="np-email" type="email" placeholder="email@example.com" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Insurance</label>
        <input class="form-control" id="np-insurance" placeholder="Carrier / plan" />
      </div>
    </div>
    <h4 style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:12px 0 6px">Address</h4>
    <div class="form-group">
      <label class="form-label">Street</label>
      <input class="form-control" id="np-street" placeholder="123 Main St" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">City</label>
        <input class="form-control" id="np-city" placeholder="City" />
      </div>
      <div class="form-group">
        <label class="form-label">State</label>
        <input class="form-control" id="np-state" placeholder="ST" maxlength="2" style="max-width:80px" />
      </div>
      <div class="form-group">
        <label class="form-label">ZIP</label>
        <input class="form-control" id="np-zip" placeholder="00000" maxlength="10" style="max-width:100px" />
      </div>
    </div>
    <h4 style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:12px 0 6px">Emergency Contact</h4>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-control" id="np-ec-name" placeholder="Contact name" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-control" id="np-ec-phone" placeholder="(555) 000-0000" />
      </div>
      <div class="form-group">
        <label class="form-label">Relationship</label>
        <input class="form-control" id="np-ec-rel" placeholder="e.g. Spouse" />
      </div>
    </div>
    <h4 style="font-size:13px;font-weight:600;color:var(--text-secondary);margin:12px 0 6px">Preferred Pharmacy</h4>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Pharmacy Name</label>
        <input class="form-control" id="np-pharm-name" placeholder="Pharmacy name" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-control" id="np-pharm-phone" placeholder="(555) 000-0000" />
      </div>
      <div class="form-group">
        <label class="form-label">Fax</label>
        <input class="form-control" id="np-pharm-fax" placeholder="(555) 000-0000" />
      </div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-secondary" id="np-cancel">Cancel</button>
    <button class="btn btn-primary" id="np-save">Register Patient</button>
  `;

  openModal({ title: 'New Patient', bodyHTML, footerHTML, size: 'lg' });

  document.getElementById('np-cancel').addEventListener('click', closeModal);
  document.getElementById('np-save').addEventListener('click', () => {
    const firstName = document.getElementById('np-first').value.trim();
    const lastName  = document.getElementById('np-last').value.trim();
    const dob       = document.getElementById('np-dob').value;

    if (!firstName || !lastName || !dob) {
      showToast('First name, last name, and date of birth are required.', 'error');
      return;
    }

    const patient = savePatient({
      firstName,
      lastName,
      dob,
      sex:       document.getElementById('np-sex').value,
      phone:     document.getElementById('np-phone').value.trim(),
      email:     document.getElementById('np-email').value.trim(),
      insurance: document.getElementById('np-insurance').value.trim(),
      addressStreet: document.getElementById('np-street').value.trim(),
      addressCity:   document.getElementById('np-city').value.trim(),
      addressState:  document.getElementById('np-state').value.trim(),
      addressZip:    document.getElementById('np-zip').value.trim(),
      emergencyContactName:         document.getElementById('np-ec-name').value.trim(),
      emergencyContactPhone:        document.getElementById('np-ec-phone').value.trim(),
      emergencyContactRelationship: document.getElementById('np-ec-rel').value.trim(),
      pharmacyName:  document.getElementById('np-pharm-name').value.trim(),
      pharmacyPhone: document.getElementById('np-pharm-phone').value.trim(),
      pharmacyFax:   document.getElementById('np-pharm-fax').value.trim(),
    });

    closeModal();
    showToast('Patient registered — MRN: ' + patient.mrn, 'success');
    navigate('#chart/' + patient.id);
  });
}

function confirmDeletePatient(id, onDone) {
  const pat = getPatient(id);
  if (!pat) return;

  const encCount = getEncountersByPatient(id).length;
  confirmAction({
    title: 'Delete Patient',
    message: `Delete ${pat.firstName} ${pat.lastName} (${pat.mrn})? This will also remove ${encCount} encounter(s), all notes, and all orders. This cannot be undone.`,
    confirmLabel: 'Delete Patient',
    danger: true,
    onConfirm: () => {
      deletePatient(id);
      showToast('Patient deleted.', 'default');
      if (onDone) onDone();
    },
  });
}

/* ---------- Helpers ---------- */
function createTd(text) {
  const td = document.createElement('td');
  td.textContent = text || '—';
  return td;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
