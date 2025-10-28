// admin/js/pages/settings.js
import { api } from '../api.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';

const DAY_LABEL = { sun:'SUNDAY', mon:'MONDAY', tue:'TUESDAY', wed:'WEDNESDAY', thu:'THURSDAY', fri:'FRIDAY', sat:'SATURDAY' };
const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];

export async function renderSettings(root){
  try {
    const resp = await api.get('/api/settings');
    const settings = resp?.settings || {};
    const businessHours = settings.businessHours || { sun:{},mon:{},tue:{},wed:{},thu:{},fri:{},sat:{} };
    settings.holidays = settings.holidays || [];

    root.innerHTML = `
      <div class="toolbar"><h3>Settings</h3></div>

      <div class="card">
        <h3>Business Hours</h3>
        <form id="hoursForm" class="stack">
          ${DAYS.map(d=>{
            const day = businessHours[d] || {};
            const isClosed = !!day.closed;
            return `
            <div class="hours-grid">
              <div class="day">${DAY_LABEL[d]}</div>
              <div class="times">
                <label class="time-field">Open
                  <input class="time-input" name="${d}-open" type="time" value="${day.open || ''}" ${isClosed ? 'disabled' : ''} />
                </label>
                <label class="time-field">Close
                  <input class="time-input" name="${d}-close" type="time" value="${day.close || ''}" ${isClosed ? 'disabled' : ''} />
                </label>
                <label class="time-field" style="grid-column:1/-1">
                  <input type="checkbox" name="${d}-closed" ${isClosed ? 'checked' : ''} />
                  Closed
                </label>
              </div>
            </div>`;
          }).join('')}
          <p class="s">Tip: If "Closed" is ticked, the day is blocked regardless of times.</p>
          <button class="btn-primary" type="submit">Save Hours</button>
        </form>
      </div>

      <div class="card" style="margin-top:16px">
        <h3>Holidays</h3>
        <div id="holi" class="badges" style="display:flex; flex-wrap:wrap; gap:6px"></div>
        <div style="margin-top:10px; display:flex; gap:8px; align-items:center">
          <input type="date" id="hDate" />
          <button id="addH" class="btn-secondary">Add holiday</button>
        </div>
      </div>
    `;

    // Toggle enable/disable on "Closed"
    const hoursForm = document.getElementById('hoursForm');
    hoursForm.addEventListener('change', (e) => {
      const tgt = e.target;
      if (tgt.name && tgt.name.endsWith('-closed')) {
        const key = tgt.name.replace('-closed','');
        const open = hoursForm.querySelector(`[name="${key}-open"]`);
        const close = hoursForm.querySelector(`[name="${key}-close"]`);
        if (open && close) {
          open.disabled = tgt.checked;
          close.disabled = tgt.checked;
        }
      }
    });

    // Save hours
    hoursForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(hoursForm);
      const next = {};
      for (const d of DAYS) {
        const closed = fd.get(`${d}-closed`) === 'on';
        const open = closed ? '' : (fd.get(`${d}-open`) || '');
        const close = closed ? '' : (fd.get(`${d}-close`) || '');
        next[d] = { open, close, closed };
      }
      try {
        await api.patch('/api/settings', { businessHours: next });
        toast('Hours saved');
      } catch (err) {
        console.error(err);
        toast(err?.message || 'Failed to save hours');
      }
    });

    // Holidays UI
    const holiEl = document.getElementById('holi');
    const renderH = () => {
      const arr = settings.holidays || [];
      holiEl.innerHTML = arr.length
        ? arr.map(d => `
            <span class="badge" data-date="${d}" style="display:inline-flex; align-items:center; gap:6px; background:#223; color:#cbd5e1">
              ${d}
              <button type="button" class="btn-ghost s" data-del="${d}" aria-label="Remove ${d}" title="Remove ${d}">×</button>
            </span>
          `).join('')
        : '<em>No holidays</em>';
    };
    renderH();

    document.getElementById('addH').addEventListener('click', async ()=>{
      const v = (document.getElementById('hDate').value || '').trim();
      if (!v) return toast('Pick a date');
      const set = new Set([...(settings.holidays||[]), v]);
      const out = Array.from(set).sort();
      try {
        const r = await api.patch('/api/settings', { holidays: out });
        settings.holidays = r?.settings?.holidays || out;
        renderH();
        toast('Holiday added');
      } catch (err) {
        console.error(err);
        toast(err?.message || 'Failed to add holiday');
      }
    });

    holiEl.addEventListener('click', async (evt) => {
      const btn = evt.target.closest('[data-del]');
      if (!btn) return;
      const date = btn.dataset.del;
      const ok = await confirmDialog(`Remove holiday ${date}?`);
      if (!ok) return;
      try {
        const out = (settings.holidays || []).filter(d => d !== date);
        const r = await api.patch('/api/settings', { holidays: out });
        settings.holidays = r?.settings?.holidays || out;
        renderH();
        toast('Holiday removed');
      } catch (err) {
        console.error(err);
        toast(err?.message || 'Failed to remove holiday');
      }
    });

  } catch (e) {
    root.innerHTML = `<p style="opacity:.8">Couldn’t load Settings.</p>`;
    console.error(e);
  }
}
