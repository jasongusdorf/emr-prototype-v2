/* ============================================================
   views/admin.js — Admin Panel (Approvals, Users, Audit Log)
   ============================================================ */

function renderAdmin() {
  if (!isAdmin()) {
    navigate('#dashboard');
    return;
  }

  setTopbar({ title: 'Admin Panel', meta: 'System Administration' });
  setActiveNav('admin');

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="admin-tabs">
      <button class="admin-tab active" data-tab="approvals">Pending Approvals</button>
      <button class="admin-tab" data-tab="users">User Management</button>
      <button class="admin-tab" data-tab="audit">System Audit Log</button>
    </div>
    <div id="admin-content"></div>
  `;

  const tabs = app.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      const container = document.getElementById('admin-content');
      if (target === 'approvals') renderApprovalsTab(container);
      else if (target === 'users') renderUsersTab(container);
      else if (target === 'audit') renderAuditTab(container);
    });
  });

  renderApprovalsTab(document.getElementById('admin-content'));
}

function renderApprovalsTab(container) {
  const pending = getPendingUsers();

  if (pending.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 16px;color:var(--text-muted);">
        <p style="font-size:1.1rem;">No pending approval requests.</p>
        <p>New user registrations will appear here for review.</p>
      </div>
    `;
    return;
  }

  let html = '<div class="admin-cards">';
  pending.forEach(u => {
    const name = (u.firstName || '') + ' ' + (u.lastName || '');
    const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—';
    html += `
      <div class="admin-card">
        <div class="admin-card-header">
          <strong>${escapeHTML(name.trim() || 'Unknown')}</strong>
          <span class="user-status-badge status-pending">Pending</span>
        </div>
        <div class="admin-card-body">
          <div><strong>Email:</strong> ${escapeHTML(u.email || '')}</div>
          <div><strong>Degree:</strong> ${escapeHTML(u.degree || '—')}</div>
          <div><strong>Registered:</strong> ${created}</div>
        </div>
        <div class="admin-card-actions">
          <button class="btn btn-primary btn-sm" onclick="handleApproveUser('${u.id}')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="handleDenyUser('${u.id}')">Deny</button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function handleApproveUser(targetUserId) {
  const admin = getSessionUser();
  if (!admin) return;
  approveUser(targetUserId, admin.id);
  showToast('User approved.', 'success');
  renderApprovalsTab(document.getElementById('admin-content'));
  if (typeof updateAdminBadge === 'function') updateAdminBadge();
}

function handleDenyUser(targetUserId) {
  const admin = getSessionUser();
  if (!admin) return;
  confirmAction({
    title: 'Deny User',
    message: 'Are you sure you want to deny this user? They will not be able to access the system.',
    confirmLabel: 'Deny',
    danger: true,
    onConfirm: () => {
      denyUser(targetUserId, admin.id);
      showToast('User denied.', 'success');
      renderApprovalsTab(document.getElementById('admin-content'));
      if (typeof updateAdminBadge === 'function') updateAdminBadge();
    }
  });
}

function renderUsersTab(container) {
  const users = getUsers();
  const currentUser = getSessionUser();

  let html = `
    <div style="overflow-x:auto;">
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Degree</th>
          <th>Role</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  users.forEach(u => {
    const name = (u.firstName || '') + ' ' + (u.lastName || '');
    const status = u.status || 'active';
    const role = u.role || 'user';
    const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—';
    const isSelf = currentUser && currentUser.id === u.id;
    const statusClass = 'status-' + status;
    const roleLabel = role === 'admin' ? 'Admin' : 'User';

    let actions = '';
    if (!isSelf) {
      if (status === 'active') {
        actions += `<button class="btn btn-secondary btn-sm" onclick="handleDeactivateUser('${u.id}')">Deactivate</button> `;
      } else if (status === 'deactivated' || status === 'denied') {
        actions += `<button class="btn btn-primary btn-sm" onclick="handleReactivateUser('${u.id}')">Activate</button> `;
      }
      if (role === 'user' && status === 'active') {
        actions += `<button class="btn btn-secondary btn-sm" onclick="handlePromoteUser('${u.id}')">Promote</button> `;
      } else if (role === 'admin' && status === 'active') {
        actions += `<button class="btn btn-secondary btn-sm" onclick="handleDemoteUser('${u.id}')">Demote</button> `;
      }
      actions += `<button class="btn btn-secondary btn-sm" onclick="handleAdminResetPassword('${u.id}')">Reset PW</button>`;
    } else {
      actions = '<span style="color:var(--text-muted);font-size:0.85rem;">You</span>';
    }

    html += `
      <tr>
        <td>${escapeHTML(name.trim() || 'Unknown')}</td>
        <td>${escapeHTML(u.email || '')}</td>
        <td>${escapeHTML(u.degree || '—')}</td>
        <td>${roleLabel}</td>
        <td><span class="user-status-badge ${statusClass}">${status}</span></td>
        <td>${created}</td>
        <td>${actions}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function handleDeactivateUser(targetUserId) {
  const admin = getSessionUser();
  if (!admin) return;
  confirmAction({
    title: 'Deactivate User',
    message: 'This user will be blocked from logging in. Continue?',
    confirmLabel: 'Deactivate',
    danger: true,
    onConfirm: () => {
      deactivateUser(targetUserId, admin.id);
      showToast('User deactivated.', 'success');
      renderUsersTab(document.getElementById('admin-content'));
    }
  });
}

async function handleAdminResetPassword(targetUserId) {
  const admin = getSessionUser();
  if (!admin) return;
  const target = getUser(targetUserId);
  if (!target) return;
  confirmAction({
    title: 'Reset Password',
    message: 'Generate a temporary password for ' + (target.email || 'this user') + '? They will be required to change it on next login.',
    confirmLabel: 'Reset Password',
    onConfirm: async () => {
      const tempPw = await resetPasswordForUser(targetUserId, admin.id);
      if (tempPw) {
        openModal({
          title: 'Temporary Password',
          bodyHTML: `
            <p>A temporary password has been generated for <strong>${escapeHTML(target.email)}</strong>.</p>
            <div style="margin:16px 0;padding:12px 16px;background:var(--success-light);border-radius:6px;font-size:18px;letter-spacing:1.5px;text-align:center;font-family:monospace;color:var(--success);">
              ${escapeHTML(tempPw)}
            </div>
            <p style="font-size:12px;color:var(--text-muted);">Share this password securely. The user will be required to change it on next login.</p>
          `,
          footerHTML: '<button class="btn btn-primary" onclick="closeModal()">Done</button>',
        });
        renderUsersTab(document.getElementById('admin-content'));
      }
    }
  });
}

function handleReactivateUser(targetUserId) {
  const admin = getSessionUser();
  if (!admin) return;
  reactivateUser(targetUserId, admin.id);
  showToast('User reactivated.', 'success');
  renderUsersTab(document.getElementById('admin-content'));
}

function handlePromoteUser(targetUserId) {
  const admin = getSessionUser();
  if (!admin) return;
  confirmAction({
    title: 'Promote to Admin',
    message: 'This user will gain full admin privileges. Continue?',
    confirmLabel: 'Promote',
    onConfirm: () => {
      promoteToAdmin(targetUserId, admin.id);
      showToast('User promoted to admin.', 'success');
      renderUsersTab(document.getElementById('admin-content'));
    }
  });
}

function handleDemoteUser(targetUserId) {
  const admin = getSessionUser();
  if (!admin) return;
  confirmAction({
    title: 'Demote from Admin',
    message: 'This user will lose admin privileges. Continue?',
    confirmLabel: 'Demote',
    danger: true,
    onConfirm: () => {
      demoteFromAdmin(targetUserId, admin.id);
      showToast('User demoted from admin.', 'success');
      renderUsersTab(document.getElementById('admin-content'));
    }
  });
}

function renderAuditTab(container) {
  const entries = getSystemAuditLog();

  if (entries.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 16px;color:var(--text-muted);">
        <p>No audit log entries yet.</p>
      </div>
    `;
    return;
  }

  let html = `
    <div style="overflow-x:auto;max-height:600px;overflow-y:auto;">
    <table class="data-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Action</th>
          <th>User</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
  `;

  const actionColors = {
    'LOGIN': 'audit-login',
    'LOGIN_FAILED': 'audit-failed',
    'LOGOUT': 'audit-logout',
    'USER_APPROVED': 'audit-approved',
    'USER_DENIED': 'audit-denied',
    'USER_DEACTIVATED': 'audit-denied',
    'USER_REACTIVATED': 'audit-approved',
    'USER_PROMOTED': 'audit-approved',
    'USER_DEMOTED': 'audit-logout',
    'PASSWORD_CHANGED': 'audit-login',
    'SESSION_TIMEOUT': 'audit-logout',
  };

  entries.slice(0, 200).forEach(e => {
    const ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : '—';
    const cls = actionColors[e.action] || '';
    html += `
      <tr>
        <td style="white-space:nowrap;">${ts}</td>
        <td><span class="audit-action-badge ${cls}">${escapeHTML(e.action || '')}</span></td>
        <td>${escapeHTML(e.email || '—')}</td>
        <td>${escapeHTML(e.details || '')}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/* ---------- Utility: escape HTML ---------- */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
