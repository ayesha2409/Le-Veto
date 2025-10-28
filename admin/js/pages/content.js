import { api, API_BASE } from '../api.js';
import { toast } from '../ui/toast.js';

export async function renderContent(root) {
  let settings = {};
  let images = {};

  try {
    const resp = await api.get('/api/settings');
    settings = resp?.settings || {};
    images = settings.images || {};
  } catch (e) {
    console.error(e);
    root.innerHTML = `
      <div class="toolbar"><h3>Content</h3></div>
      <p style="opacity:.8">Couldn't load Content settings.</p>`;
    return;
  }

  const bust = () => Date.now();

  root.innerHTML = `
    <div class="toolbar"><h3>Content</h3></div>

    <div class="grid">
      <!-- Hero Image -->
      <div class="card">
        <h3>Hero Image</h3>
        <div class="card-hero" style="display:flex; gap:16px; align-items:flex-start">
          <div class="info" style="flex:1">
            <p class="s">Shown on the website homepage hero section.</p>
            <input type="file" id="heroFile" />
            <button id="heroUpload" class="btn-primary" style="margin-top:8px">Upload</button>
          </div>
          <div style="min-width:240px">
            ${
              images.hero
                ? `<img src="${API_BASE}${images.hero}?v=${bust()}"
                        style="max-width:260px; border-radius:12px"
                        onerror="this.style.display='none'"/>`
                : `<div style="opacity:.7"><em>No hero set</em></div>`
            }
          </div>
        </div>
      </div>
    </div>
  `;

  const heroBtn = root.querySelector('#heroUpload');
  heroBtn?.addEventListener('click', async () => {
    try {
      const f = root.querySelector('#heroFile')?.files?.[0];
      if (!f) return toast('Choose a file first');
      await api.upload('/api/uploads/hero', 'file', f);
      toast('Hero image updated');
      renderContent(root); 
    } catch (e) {
      console.error(e);
      toast(e?.message || 'Upload failed');
    }
  });
}
