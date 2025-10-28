import { api, API_BASE } from '../api.js';
import { renderTable } from '../ui/table.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';


export async function renderAppointments(root){
  root.innerHTML = `
    <div class="toolbar">
      <input id="q" class="input-inline" placeholder="Search..." />
      <select id="status" class="input-inline">
        <option value="">All</option>
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <button id="export" class="btn-secondary">Export CSV</button>
    </div>
    <div id="table"></div>
  `;

  const qEl  = document.getElementById('q');
  const stEl = document.getElementById('status');

  async function load(){
    const params = new URLSearchParams();
    if (qEl.value) params.set('q', qEl.value);
    if (stEl.value) params.set('status', stEl.value);

    const items = await api.get(`/api/appointments?${params.toString()}`);

    const columns = [
      { label:'Date',     render:r=> `${r.date||'-'} ${r.time||''}` },
      { label:'Service',  key:'serviceType' },
      { label:'Client',   render:r=> `${r.name}<br/><small>${r.email} • ${r.phone||''}</small>` },
      { label:'Pet',      key:'petName' },
      { label:'Status',   render:r=> `<span class="badge badge-${r.status}">${r.status}</span>` },
      { label:'Actions',  render:r=>{
          if (r.status === 'pending') {
            return `
              <button class="btn-success" data-act="confirm" data-id="${r._id}">Confirm</button>
              <button class="btn-danger"  data-act="cancel"  data-id="${r._id}">Cancel</button>`;
          }
          if (r.status === 'confirmed') {
            return `<button class="btn-danger" data-act="cancel" data-id="${r._id}">Cancel</button>`;
          }
          if (r.status === 'cancelled') {
            return `<button class="btn-success" data-act="confirm" data-id="${r._id}">Confirm</button>`;
          }
          return '';
        }
      }
    ];

    document.getElementById('table').innerHTML = renderTable({ columns, rows: items });

    document.querySelectorAll('[data-act]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id  = btn.dataset.id;
        const act = btn.dataset.act;
        const sure = await confirmDialog(`Mark this appointment as ${act}?`);
        if (!sure) return;

        btn.disabled = true;
        const old = btn.textContent;
        btn.textContent = 'Saving...';

        try {
          const status = act === 'confirm' ? 'confirmed' : 'cancelled';
          await api.patch(`/api/appointments/${id}`, { status });
          toast(`Appointment ${act}ed`);
          await load(); 
        } catch (e) {
          toast(e.message || 'Failed');
        } finally {
          btn.disabled = false;
          btn.textContent = old;
        }
      });
    });
  }

  qEl.addEventListener('input',  () => load());
  stEl.addEventListener('change',() => load());
  document.getElementById('export').addEventListener('click', ()=>{
    window.open(`${API_BASE}/api/appointments/export.csv`, '_blank');
  });

  load();
}
