import { api, API_BASE } from '../api.js';
import { renderTable } from '../ui/table.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';

export async function renderPets(root) {

  let items = [];
  try {
    items = await api.get('/api/pets');
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="toolbar"><h3>Pets</h3></div><p style="opacity:.8">Couldn’t load pets.</p>`;
    return;
  }

  const columns = [
    {
      label: 'Pet',
      render: r =>
        `<strong>${r.name}</strong><br/><small>${r.species || ''} • ${r.breed || ''}</small>`
    },
    {
      label: 'Owner',
      render: r =>
        `${r.ownerName || ''}<br/><small>${r.ownerEmail || ''} • ${r.ownerPhone || ''}</small>`
    },
    { label: 'DOB', key: 'dob' },
    { label: 'Reports', key: 'reports' },
    { label: 'Actions', render: r => `<button class="btn-secondary" data-open="${r.id}">Open</button>` }
  ];

  root.innerHTML = `<div class="toolbar"><h3>Pets</h3></div>${renderTable({ columns, rows: items })}`;


  if (!root._petsDelegated) {
    root._petsDelegated = true;

    root.addEventListener('click', async (evt) => {
      const openBtn = evt.target.closest('[data-open]');
      if (!openBtn) return;

      const id = openBtn.dataset.open;
      try {
  
        const p = await api.get(`/api/pets/${id}`);

        const listHTML =
          (p.reports || []).map(r => `
            <li>
              ${r.originalName || r.fileId}
              <small>(${Math.round((r.size || 0) / 1024)} KB)</small>
              <div style="display:flex; gap:8px; margin-top:6px">
                <a class="btn-secondary"
                   href="${API_BASE}/api/pets/${id}/reports/${r.fileId}"
                   target="_blank" rel="noopener">Download</a>
                <button class="btn-danger"
                        data-del="${r.fileId}" data-id="${id}">Delete</button>
              </div>
            </li>
          `).join('') || '<li><em>No reports yet</em></li>';

        const { el, close } = openModal({
          title: `Pet • ${p.name}`,
          content: `
  <div style="display:grid; grid-template-columns: 160px 1fr; gap:16px; align-items:start">
    <div>
      ${
        p.avatarUrl
          ? `<img src="${API_BASE}${p.avatarUrl}"
                   alt="Pet avatar"
                   style="width:160px;height:160px;object-fit:cover;border-radius:12px;border:1px solid rgba(148,163,184,.2)"
                   onerror="this.style.display='none'">`
          : `<div style="width:160px;height:160px;border-radius:12px;border:1px dashed rgba(148,163,184,.35);display:flex;align-items:center;justify-content:center;opacity:.7">
               <span>No photo</span>
             </div>`
      }
    </div>
    <div class="grid">
      <div><strong>Owner:</strong> ${p.owner?.name || ''} <small>(${p.owner?.email || ''})</small></div>
      <div><strong>Species:</strong> ${p.species || ''}</div>
      <div><strong>Breed:</strong> ${p.breed || ''}</div>
      <div><strong>DOB:</strong> ${p.dob || ''}</div>
    </div>
  </div>
  <hr style="margin:14px 0"/>
  <div>
    <h4>Medical Reports</h4>
    <ul id="rep-list">${listHTML}</ul>
    <div style="margin-top:10px">
      <input id="file" type="file" />
      <button id="upload" class="btn-primary">Upload</button>
    </div>
  </div>
`

        });

        

        el.querySelector('#upload')?.addEventListener('click', async () => {
          const f = el.querySelector('#file')?.files?.[0];
          if (!f) return toast('Choose a file first');
          try {
            await api.upload(`/api/pets/${id}/reports`, 'file', f);
            toast('Uploaded');
            close();
            renderPets(root); 
          } catch (e) {
            console.error(e);
            toast(e?.message || 'Upload failed');
          }
        });

        el.querySelectorAll('[data-del]').forEach(d => {
          d.addEventListener('click', async () => {
            const sure = await confirmDialog('Delete this report?');
            if (!sure) return;
            try {
              await api.req(`/api/pets/${d.dataset.id}/reports/${d.dataset.del}`, { method: 'DELETE' });
              toast('Deleted');
              close();
              renderPets(root);
            } catch (e) {
              console.error(e);
              toast(e?.message || 'Delete failed');
            }
          });
        });

      } catch (err) {
        console.error(err);
        toast(err?.message || 'Failed to open pet');
      }
    });
  }
}
