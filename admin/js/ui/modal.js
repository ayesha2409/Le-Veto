export function openModal({ title, content, actions = [] }) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal">
      <div class="hd">
        <strong>${title || ''}</strong>
        <button id="x" class="btn-ghost">Close</button>
      </div>
      <div class="bd">${content || ''}</div>
      <div class="ft">${actions.map(a => `<button class="${a.class || 'btn-secondary'}" data-k="${a.key}">${a.label}</button>`).join('')}</div>
    </div>`;
  root.appendChild(wrap);
  wrap.addEventListener('click', (e)=>{ if(e.target===wrap) close(); });
  wrap.querySelector('#x').addEventListener('click', close);
  actions.forEach(a => wrap.querySelector(`[data-k="${a.key}"]`)?.addEventListener('click', a.onClick || (()=>{})));
  function close(){ wrap.remove(); }
  return { close, el: wrap };
}
