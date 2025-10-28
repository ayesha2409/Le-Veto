import { api } from '../api.js';
import { renderTable } from '../ui/table.js';

export async function renderDashboard(root){
  root.innerHTML = `<div class="grid grid-3" id="stats"></div><div id="recent"></div>`;
  const statsEl = document.getElementById('stats');

  // summary
  try {
    const sum = await api.get('/api/appointments/summary?range=7');
    const total = Number(sum?.total || 0);
    const confirmed = Number(sum?.confirmed || 0);
    const cancelled = Number(sum?.cancelled || 0);
    statsEl.innerHTML = `
      <div class="stat"><div class="k">${total}</div><div class="s">Appointments (7d)</div></div>
      <div class="stat"><div class="k">${confirmed}</div><div class="s">Confirmed</div></div>
      <div class="stat"><div class="k">${cancelled}</div><div class="s">Cancelled</div></div>
    `;
  } catch (e) {
    statsEl.innerHTML = `
      <div class="stat"><div class="k">0</div><div class="s">Appointments (7d)</div></div>
      <div class="stat"><div class="k">0</div><div class="s">Confirmed</div></div>
      <div class="stat"><div class="k">0</div><div class="s">Cancelled</div></div>
    `;
    console.warn('summary unavailable', e);
  }

  // recent list
  try {
    const items = await api.get('/api/appointments?limit=10');
    const columns = [
      { label:'Created', render:r=> new Date(r.createdAt).toLocaleString() },
      { label:'Service', key:'serviceType' },
      { label:'Client',  render:r=> `${r.name}<br/><small>${r.email}</small>` },
      { label:'Pet',     key:'petName' },
      { label:'Status',  render:r=> `<span class="badge badge-${r.status}">${r.status}</span>` }
    ];
    document.getElementById('recent').innerHTML =
      `<h3>Recent appointments</h3>${renderTable({ columns, rows: items })}`;
  } catch (e) {
    document.getElementById('recent').innerHTML = `<p style="opacity:.8">Couldn’t load recent appointments.</p>`;
    console.error(e);
  }
}
