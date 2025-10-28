export const API_BASE = "https://le-veto-production.up.railway.app";
const TOKEN_KEY = 'lv_admin_jwt';

export const token = {
  get(){ return localStorage.getItem(TOKEN_KEY); },
  set(t){ localStorage.setItem(TOKEN_KEY, t); },
  clear(){ localStorage.removeItem(TOKEN_KEY); }
};

export const api = {
  async req(path, options = {}) {
    const headers = { ...(options.headers||{}) };
    if (!(options.body instanceof FormData)) headers['Content-Type']='application/json';
    const t = token.get(); if (t) headers.Authorization = `Bearer ${t}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await res.text(); let data=null; try{ data = text? JSON.parse(text):null }catch{}
    if (!res.ok) throw new Error(data?.error || res.statusText);
    return data;
  },
  get(path){ return this.req(path); },
  post(path, body){ return this.req(path, { method:'POST', body: JSON.stringify(body) }); },
  patch(path, body){ return this.req(path, { method:'PATCH', body: JSON.stringify(body) }); },
  upload(path, fileField='file', file){
    const fd = new FormData(); fd.append(fileField, file);
    return this.req(path, { method:'POST', body: fd });
  }
};
