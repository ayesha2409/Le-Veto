/* ================== CONFIG ================== */
const API_BASE = "http://localhost:5000";
const TOKEN_KEY = "lv_jwt";
const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t);
const getToken   = ()  => localStorage.getItem(TOKEN_KEY);
const clearToken = ()  => localStorage.removeItem(TOKEN_KEY);

function toAbsolute(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? url : '/' + url}`;
}

async function jsonOrThrow(res){
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {
  throw new Error(`Server returned ${res.status} ${res.statusText}`);
  }
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

function paintAvatar(url){
  const src  = toAbsolute(url);
  const has  = !!src;
  const hero = document.querySelector('.hero-avatar');
  if (hero) hero.classList.toggle('has-photo', has);

  document.querySelectorAll('[data-avatar]').forEach(el=>{
    if (el.tagName === 'IMG') {
      if (has) { el.src = src; el.style.display = 'block'; }
      else { el.removeAttribute('src'); el.style.display = 'none'; }
    } else {
      el.style.backgroundImage = has ? `url(${src})` : 'none';
      el.classList.toggle('has-avatar', has);
      el.style.background = `center / cover no-repeat url("${toAbsolute(url)}")`;

    }
  });
}

/* SERVICES */
document.addEventListener('DOMContentLoaded', function () {
  try {
    const el = document.querySelector('.splide-services');
    if (!el || !window.Splide) return;

    const opts = {
      type: 'loop',
      drag: 'free',
      focus: 'center',
      perPage: 3,
      gap: '16px',
      autoScroll: { speed: 1 },
      arrows: true,
      pagination: true,
      breakpoints: { 1024: { perPage: 2 }, 768: { perPage: 1 } },
    };

    const splide = new Splide(el, opts);
    if (window.splide && window.splide.Extensions) {
      splide.mount(window.splide.Extensions);
    } else {
      splide.mount();
    }
  } catch (err) {
    console.error('Splide init failed:', err);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const ul = document.getElementById('reviewsList');
  const wrap = document.querySelector('.splide-reviews');
  if (!ul || !wrap) return;

  let reviews = [];
  try {
    const r = await fetch(`${API_BASE}/api/public/google-reviews`);
    const data = await r.json();
    if (r.ok && data?.success) reviews = data.reviews || [];
  } catch {}

  if (!reviews.length) {
    reviews = [
      { rating: 5, text: 'Lovely staff and quick appointment!', author: 'Happy client' },
      { rating: 5, text: 'Vet explained everything clearly.', author: 'Pet parent' },
    ];
  }

  const stars = n => '★'.repeat(Math.round(n || 0)).padEnd(5, '☆');
  ul.innerHTML = reviews.map(r => `
    <li class="splide__slide">
      <div class="review-card">
        <div class="review-stars">${stars(r.rating)}</div>
        <blockquote class="review-quote">“${(r.text || '').replace(/"/g, '&quot;')}”</blockquote>
        <div class="review-author">— ${r.author || 'Google user'}</div>
      </div>
    </li>
  `).join('');

const splideReviews = new Splide(wrap, {
  type: 'loop',
  perPage: 3,             // show 3 reviews at a time
  gap: '20px',            
  drag: false,            
  arrows: false,          
  pagination: false,      
  pauseOnHover: false,    
  pauseOnFocus: false,
  autoScroll: { speed: 1 },  
  breakpoints: {               
    1024: { perPage: 3 },
    640:  { perPage: 1 }
  }
  });
  splideReviews.mount();
});



/* =========================== APPOINTMENT FORM (LIVE SETTINGS) =========================== */
class AppointmentForm {
  constructor() {
    this.form = document.getElementById('appointmentForm');
    if (!this.form) return;

    this.timeSelect     = document.getElementById('time');
    this.loadingOverlay = document.getElementById('loading-overlay');

    this.businessHours = {}; // from server: { mon:{open,close}, ... }
    this.holidays = [];      // from server: ["YYYY-MM-DD", ...]

    this.cacheFields();
    this.bindEvents();
    this.initTimeSelect();
    this.loadSettings(); // <<< fetch live settings
  }

  cacheFields() {
    this.fields = {
      name:        document.getElementById('name'),
      email:       document.getElementById('email'),
      phone:       document.getElementById('phone'),
      petName:     document.getElementById('petName'),
      date:        document.getElementById('date'),
      time:        document.getElementById('time'),
      serviceType: document.getElementById('serviceType'),
      message:     document.getElementById('message'), // OPTIONAL
    };
  }

  async loadSettings() {
    try {
      const r = await fetch(`${API_BASE}/api/public/settings`);
      const data = await r.json();
      const s = data?.settings || data || {};

      this.businessHours = s.businessHours || {};
      this.holidays = Array.isArray(s.holidays) ? s.holidays : [];

      // If a date is already chosen, rebuild time options now
      if (this.fields.date?.value) this.onDateChange();
    } catch (e) {
      console.warn('Failed to load settings; using empty hours/holidays', e);
      this.businessHours = {};
      this.holidays = [];
    }
  }

  bindEvents() {
    Object.values(this.fields).forEach((f) => {
      if (!f) return;
      f.addEventListener('input', () => this.validateField(f));
      f.addEventListener('blur',  () => this.validateField(f));
    });

    if (this.fields.date) {
      this.fields.date.addEventListener('change', () => this.onDateChange());
    }

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.form?.requestSubmit) this.form.requestSubmit();
        else this.form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      });
    }
  }

  validateField(f) {
    if (f.name === 'message' && f.value.trim() === '') {
      f.classList.remove('error');
      const em = document.getElementById(`${f.name}-error`);
      if (em) em.classList.remove('show');
      return true;
    }
    const valid = f.checkValidity() && f.value.trim() !== '';
    const em = document.getElementById(`${f.name}-error`);
    if (!valid) {
      f.classList.add('error');
      if (em) em.classList.add('show');
    } else {
      f.classList.remove('error');
      if (em) em.classList.remove('show');
      f.classList.add('success');
    }
    return valid;
  }

  initTimeSelect() {
    if (!this.timeSelect) return;
    this.timeSelect.innerHTML = `<option value="">Select a date first</option>`;
    this.timeSelect.disabled = true;
  }

  onDateChange() {
    const dateStr = this.fields.date.value;
    if (!dateStr) {
      this.initTimeSelect();
      return;
    }

    // holiday? disable
    if (this.holidays.includes(dateStr)) {
      this.timeSelect.innerHTML = `<option value="">Closed (Holiday)</option>`;
      this.timeSelect.disabled = true;
      return;
    }

    const slots = this.generateSlotsForDate(dateStr);
    if (slots.length === 0) {
      this.timeSelect.innerHTML = `<option value="">Closed</option>`;
      this.timeSelect.disabled = true;
      return;
    }

    this.timeSelect.innerHTML = `<option value="">Select a time</option>`;
    for (const t of slots) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      this.timeSelect.appendChild(opt);
    }
    this.timeSelect.disabled = false;
  }

  generateSlotsForDate(isoDate) {
    // Map JS getDay() -> keys used by settings
    const dayKeyMap = ['sun','mon','tue','wed','thu','fri','sat'];
    const d = new Date(`${isoDate}T00:00:00`);
    const key = dayKeyMap[d.getDay()];

    const hours = this.businessHours?.[key];
    if (!hours || !hours.open || !hours.close) return [];

    const toMinutes = (t) => {
      let m = String(t).trim().toLowerCase();
      const ampm = m.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
      if (ampm) {
        let hh = (parseInt(ampm[1],10) % 12) + (ampm[3] === 'pm' ? 12 : 0);
        return hh * 60 + parseInt(ampm[2],10);
      }
      const hhmm = m.match(/^(\d{2}):(\d{2})$/);
      if (hhmm) return parseInt(hhmm[1],10)*60 + parseInt(hhmm[2],10);
      return NaN;
    };
    const toHHMM = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const start = toMinutes(hours.open);
    const end   = toMinutes(hours.close);
    if (Number.isNaN(start) || Number.isNaN(end) || start >= end) return [];

    const step  = 30; // minutes per slot
    const items = [];
    for (let t = start; t < end; t += step) items.push(toHHMM(t));
    return items;
  }

  async handleSubmit(e) {
    e.preventDefault();

    // basic validation
    let valid = true;
    Object.values(this.fields).forEach((f) => {
      if (!f) return;
      if (f.name === 'message' && f.value.trim() === '') {
        f.classList.remove('error');
        const em = document.getElementById(`${f.name}-error`);
        if (em) em.classList.remove('show');
        return;
      }
      if (!f.checkValidity() || f.value.trim() === '') {
        valid = false;
        f.classList.add('error');
        const em = document.getElementById(`${f.name}-error`);
        if (em) em.classList.add('show');
      } else {
        f.classList.remove('error');
        const em = document.getElementById(`${f.name}-error`);
        if (em) em.classList.remove('show');
      }
    });
    if (!valid) return;

    this.showLoading();

    try {
      // payload
      const payload = {
        name:        this.fields.name.value.trim(),
        email:       this.fields.email.value.trim(),
        phone:       this.fields.phone.value.trim(),
        petName:     this.fields.petName.value.trim(),
        serviceType: this.fields.serviceType.value,
        date:        this.fields.date.value,
        time:        this.fields.time.value,
        message:     (this.fields.message.value || '').trim(),
      };

      // if logged in, prefer server-side email for the user
      const token = getToken();
      if (token) {
        try {
          const meRes = await fetch(`${API_BASE}/api/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const meData = await meRes.json();
          if (meRes.ok && meData?.user?.email) {
            payload.email = meData.user.email;
          }
        } catch {}
      }

      const headers = { 'Content-Type': 'application/json' };
      if (getToken()) headers.Authorization = `Bearer ${getToken()}`;

      const res = await fetch(`${API_BASE}/api/appointments/book`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await jsonOrThrow(res);
      if (!data?.success) throw new Error(data?.error || 'Failed to submit');

      // reset UI
      this.form.reset();
      this.initTimeSelect();
      Object.values(this.fields).forEach((f) => f && f.classList.remove('success', 'error'));
      this.toast('success', 'Appointment submitted! We’ll confirm by email.');
    } catch (err) {
      console.error(err);
      this.toast('error', err.message || 'Something went wrong. Try again.');
    } finally {
      this.hideLoading();
    }
  }

  showLoading() { if (this.loadingOverlay) this.loadingOverlay.style.display = 'flex'; }
  hideLoading() { if (this.loadingOverlay) this.loadingOverlay.style.display = 'none'; }

  toast(type, msg) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${msg}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;
    c.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
    toast.querySelector('.toast-close')?.addEventListener('click', () => toast.remove());
  }
}

// boot it
document.addEventListener('DOMContentLoaded', () => new AppointmentForm());


(function () {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  let lastY = window.scrollY;
  const SHOW_THRESHOLD = 100;
  const DELTA = 5;

  window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    if (Math.abs(currentY - lastY) < DELTA) return;
    if (currentY > lastY && currentY > SHOW_THRESHOLD) {
      navbar.classList.add('hide');
    } else {
      navbar.classList.remove('hide');
    }
    lastY = currentY;
  });
})();

/* NAVBAR */
(function () {
  const signInBtn      = document.getElementById('signInBtn');
  const userIcon       = document.getElementById('userIcon');
  const userMobileIcon = document.getElementById('userMobileIcon');
  const userDropdown   = document.getElementById('userDropdown');
  const menuToggle     = document.getElementById('menuToggle');
  const mobileMenu     = document.getElementById('mobileMenu');

  const navLinksHTML = `
    <a href="#home">HOME</a>
    <a href="#about">ABOUT</a>
    <a href="#services">SERVICES</a>
    <a href="#appointment">APPOINTMENT</a>
    <a href="#contact">CONTACT</a>
  `;

  function closeMenus(){
    if (mobileMenu) mobileMenu.style.display = 'none';
    if (userDropdown) userDropdown.style.display = 'none';
  }

  function updateUI(){
    const loggedIn = !!getToken();
    if (signInBtn)      signInBtn.style.display = loggedIn ? 'none' : (window.innerWidth > 800 ? 'inline-block' : 'none');
    if (userIcon)       userIcon.style.display = loggedIn && window.innerWidth > 800 ? 'block' : 'none';
    if (userMobileIcon) userMobileIcon.style.display = loggedIn && window.innerWidth <= 800 ? 'block' : 'none';
    closeMenus();
  }

(async () => {
  if (!getToken()) return;
  try {
    const r = await fetch(`${API_BASE}/api/me`, { headers:{ Authorization: `Bearer ${getToken()}` } });
    const data = await r.json();
    if (r.ok && data?.user) paintAvatar(data.user.photoUrl || '');
  } catch {}
})();

  function buildMobileMenu(){
    if (!mobileMenu) return;
    const loggedIn = !!getToken();
    mobileMenu.innerHTML = loggedIn
      ? `<a href="profile.html">PROFILE</a>${navLinksHTML}<a href="#" id="logoutLinkMobile"><strong>SIGN OUT</strong></a>`
      : `${navLinksHTML}<a href="#" id="openSignInMobile"><strong>SIGN IN</strong></a>`;
    document.getElementById('openSignInMobile')?.addEventListener('click', (e)=>{ e.preventDefault(); openAuth('signin'); });
    document.getElementById('logoutLinkMobile')?.addEventListener('click', (e)=>{ e.preventDefault(); clearToken(); updateUI(); });
  }

  menuToggle?.addEventListener('click', () => {
    const isOpen = mobileMenu && mobileMenu.style.display === 'flex';
    buildMobileMenu();
    if (mobileMenu) mobileMenu.style.display = isOpen ? 'none' : 'flex';
  });

  userIcon?.addEventListener('click', () => {
    if (!userDropdown) return;
    userDropdown.style.display = userDropdown.style.display === 'flex' ? 'none' : 'flex';
  });

  document.getElementById('logoutLink')?.addEventListener('click', (e)=>{
    e.preventDefault();
    clearToken();
    updateUI();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 800) closeMenus();
    updateUI();
  });

  window._refreshUI = updateUI;
  updateUI();
  signInBtn?.addEventListener('click', (e) => { e.preventDefault(); openAuth('signin'); });
})();

/*AUTH MODAL*/
(function () {
  const overlay     = document.getElementById('authOverlay');
  if (!overlay) return;

  const closeBtn    = document.getElementById('authClose');
  const toSignUp    = document.getElementById('toSignUp');
  const toSignIn    = document.getElementById('toSignIn');
  const panelIn     = document.getElementById('panelSignIn');
  const panelUp     = document.getElementById('panelSignUp');
  const siEmail     = document.getElementById('siEmail');
  const siPassword  = document.getElementById('siPassword');
  const siSubmit    = document.getElementById('siSubmit');
  const suEmail     = document.getElementById('suEmail');
  const suPassword  = document.getElementById('suPassword');
  const suPassword2 = document.getElementById('suPassword2');
  const suSubmit    = document.getElementById('suSubmit');

  window.openAuth = (mode='signin') => {
    panelIn.hidden = mode !== 'signin';
    panelUp.hidden = mode !== 'signup';
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (mode === 'signin' ? siEmail : suEmail)?.focus(), 10);
  };
  const closeAuth = () => { overlay.classList.remove('show'); document.body.style.overflow = ''; };

  toSignUp?.addEventListener('click', (e)=>{ e.preventDefault(); openAuth('signup'); });
  toSignIn?.addEventListener('click', (e)=>{ e.preventDefault(); openAuth('signin'); });

  closeBtn?.addEventListener('click', closeAuth);
  overlay.addEventListener('click', (e)=>{ if (e.target === overlay) closeAuth(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && overlay.classList.contains('show')) closeAuth(); });

  function showAuthError(formEl, msg){
    if (!formEl) return;
    let box = formEl.querySelector('.auth-error');
    if (!box){ box = document.createElement('div'); box.className = 'auth-error'; formEl.appendChild(box); }
    box.textContent = msg || '';
    box.style.display = msg ? 'block' : 'none';
  }
  const controlEnable = () => { if (siSubmit) siSubmit.disabled = !(siEmail?.value.trim() && siPassword?.value.trim()); };
  const controlEnableUp = () => {
    if (!suSubmit) return;
    const ok = suEmail?.value.trim() && suPassword?.value && suPassword2?.value && (suPassword.value === suPassword2.value);
    suSubmit.disabled = !ok;
  };
  [siEmail, siPassword].forEach(el => el?.addEventListener('input', controlEnable));
  [suEmail, suPassword, suPassword2].forEach(el => el?.addEventListener('input', controlEnableUp));
  controlEnable(); controlEnableUp();

  document.getElementById('signInForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form = e.currentTarget;
    const email = (siEmail?.value || '').trim();
    const password = (siPassword?.value || '').trim();
    try {
      const r = await fetch(`${API_BASE}/api/auth/user-login`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!r.ok || !data?.accessToken) {
        showAuthError(form, data?.error || 'Login failed');
        return;
      }
      setToken(data.accessToken);
      showAuthError(form, '');
      window._refreshUI?.();
      closeAuth();
    } catch {
      showAuthError(form, 'Network error');
    }
try {
  const meRes = await fetch(`${API_BASE}/api/me`, { headers:{ Authorization: `Bearer ${getToken()}` } });
  const meData = await meRes.json();
  if (meRes.ok && meData?.user) paintAvatar(meData.user.photoUrl || '');
} catch {}


  });

  document.getElementById('signUpForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const form = e.currentTarget;
    const email = (suEmail?.value || '').trim();
    const pass1 = (suPassword?.value || '').trim();
    const pass2 = (suPassword2?.value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { showAuthError(form, 'Enter a valid email'); return; }
    if (pass1.length < 6) { showAuthError(form, 'Password must be at least 6 characters'); return; }
    if (pass1 !== pass2)  { showAuthError(form, 'Passwords do not match'); return; }

    try {
      const r = await fetch(`${API_BASE}/api/auth/register`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password: pass1 })
      });
      const data = await r.json();
      if (!r.ok || !data?.accessToken) {
        showAuthError(form, data?.error || 'Sign up failed');
        return;
      }
      setToken(data.accessToken); 
      showAuthError(form, '');
      window._refreshUI?.();
      closeAuth();
    } catch {
      showAuthError(form, 'Network error');
    }
    try {
  const meRes = await fetch(`${API_BASE}/api/me`, { headers:{ Authorization: `Bearer ${getToken()}` } });
  const meData = await meRes.json();
  if (meRes.ok && meData?.user) paintAvatar(meData.user.photoUrl || '');
} catch {}

  });
})();

/* PROFILE PAGE */
document.addEventListener('DOMContentLoaded', async () => {
  if (document.body?.dataset?.page !== 'profile') return;

  if (!getToken()) { location.href = 'index.html'; return; }

  try {
    const r = await fetch(`${API_BASE}/api/me`, { headers:{ Authorization: `Bearer ${getToken()}` } });
    const data = await r.json();
    if (!r.ok || !data?.user) { clearToken(); location.href = 'index.html'; return; }

    const h1 = document.querySelector('.profile-hero .hero-text h1');
    if (h1) h1.textContent = `Hi, ${data.user.name || 'User'}!`;
    const ps = document.querySelectorAll('.profile-hero .muted');
    if (ps[0]) ps[0].textContent = data.user.phone || 'Phone Number';
    if (ps[1]) ps[1].textContent = data.user.email || 'Email';
  } catch {
    clearToken();
    location.href = 'index.html';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  if (document.body?.dataset?.page !== 'profile') return;
  const accountModal = document.getElementById('accountModal');
  const petModal     = document.getElementById('petModal');
  const profileMore  = document.getElementById('profileMore');
  const upcomingWrap = document.getElementById('tab-upcoming');
  const pastWrap     = document.getElementById('tab-past');
  const segBtns      = document.querySelectorAll('.seg');
  const petCards     = document.querySelectorAll('.pet-card');

  const open = (el) => { if (!el) return; el.classList.add('show'); el.setAttribute('aria-hidden','false'); };
  const close = (el) => { if (!el) return; el.classList.remove('show'); el.setAttribute('aria-hidden','true'); };
  const closeAll = () => { close(accountModal); close(petModal); };

  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeAll));
  [accountModal, petModal].forEach(ov => {
    ov?.addEventListener('click', (e) => { if (e.target === ov) close(ov); });
  });

profileMore?.addEventListener('click', () => open(accountModal));

function setActiveTab(which){
  segBtns.forEach(b => {
    const active = b.dataset.tab === which;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  upcomingWrap.hidden = (which !== 'upcoming');
  pastWrap.hidden     = (which !== 'past');
}
segBtns.forEach(b => b.addEventListener('click', () => setActiveTab(b.dataset.tab)));
setActiveTab('upcoming'); 
loadMyAppointments();

});

async function loadMyAppointments() {
  try {
    const r = await fetch(`${API_BASE}/api/me/appointments`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || 'Failed to load appointments');
    renderMyAppointments(Array.isArray(data.items) ? data.items : []);
  } catch (e) {
    document.getElementById('tab-upcoming').innerHTML =
      `<p class="empty">Couldn’t load appointments.</p>`;
    document.getElementById('tab-past').innerHTML =
      `<p class="empty">Couldn’t load appointments.</p>`;
  }
}

function toDT(a) {
  const d = (a?.date || '').trim();           
  let  t = (a?.time || '').trim();            

  const m = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (m) {
    let hh = parseInt(m[1], 10) % 12;
    const mm = parseInt(m[2], 10);
    if (m[3].toLowerCase() === 'pm') hh += 12;
    t = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  }

  if (!/^\d{2}:\d{2}$/.test(t)) t = '12:00';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return new Date(`${d}T${t}:00`);
  }
  const dt = new Date(`${d} ${t}`);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

function renderMyAppointments(items) {
  const upcomingEl = document.getElementById('tab-upcoming');
  const pastEl     = document.getElementById('tab-past');
  const now = new Date();
  const upcoming = [];
  const past = [];

  for (const a of (items || [])) {
    const when = toDT(a);
    const status = String(a?.status || 'pending').toLowerCase();
    const isPast = (status === 'cancelled' || status === 'completed' || when < now);
    (isPast ? past : upcoming).push(a);
  }

  const asTS = (x) => toDT(x).getTime();
  upcoming.sort((a, b) => asTS(a) - asTS(b));
  past.sort((a, b) => asTS(b) - asTS(a));

  const card = (a) => {
    const d = toDT(a);
    const dateStr = d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = a.time ? a.time : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const pet     = a.petName ? ` • ${a.petName}` : '';
    const svc     = a.serviceType || 'Appointment';
    const status  = (a.status || 'pending').toLowerCase();
    const icon    = status === 'confirmed' ? 'fa-calendar-check'
                    : status === 'cancelled' ? 'fa-calendar-xmark'
                    : 'fa-calendar';

    return `
      <div class="appt-card">
        <i class="fa-regular ${icon}"></i>
        <div>
          <strong>${svc}${pet}</strong>
          <p class="muted">${dateStr}${a.time ? ` • ${timeStr}` : ''} • ${status}</p>
        </div>
      </div>`;
  };

  upcomingEl.innerHTML = upcoming.length
    ? upcoming.map(card).join('')
    : `<p class="empty"></p>`;

  pastEl.innerHTML = past.length
    ? past.map(card).join('')
    : `<p class="empty"></p>`;
}



  const petView     = document.getElementById('petView');
  const petEdit     = document.getElementById('petEdit');
  const petEditBtn  = document.getElementById('petEditBtn');
  const petDeleteBtn= document.getElementById('petDeleteBtn');

  petEditBtn?.addEventListener('click', () => {
    if (petView) petView.hidden = true;
    if (petEdit) petEdit.hidden = false;
  });

  petEdit?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (petEdit) petEdit.hidden = true;
    if (petView) petView.hidden = false;
  });

  petDeleteBtn?.addEventListener('click', () => {
    close(petModal);
  });

document.addEventListener('DOMContentLoaded', () => {
  if (document.body?.dataset?.page !== 'profile') return;
  if (!getToken()) return;


  const accountModal   = document.getElementById('accountModal');
  const accountForm    = document.getElementById('accountForm');
  const accName        = document.getElementById('accName');
  const accPhone       = document.getElementById('accPhone');
  const accEmail       = document.getElementById('accEmail');
  const accPhoto       = document.getElementById('accPhoto');
  const accPhotoPrev   = document.getElementById('accPhotoPreview');
  const accPhotoRemove = document.getElementById('accPhotoRemove');

const heroName  = document.querySelector('.profile-hero .hero-text h1');
const heroMuted = document.querySelectorAll('.profile-hero .muted');


  async function loadMe() {
    const r = await fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await r.json();
    if (!r.ok || !data?.user) throw new Error(data?.error || 'Failed to load profile');

    const u = data.user;
    if (heroName) heroName.textContent = `Hi, ${u.name || 'User'}!`;
    if (heroMuted[0]) heroMuted[0].textContent = u.phone || 'Phone Number';
    if (heroMuted[1]) heroMuted[1].textContent = u.email || 'Email';
    if (accName)  accName.value  = u.name  || '';
    if (accPhone) accPhone.value = u.phone || '';
    if (accEmail) accEmail.value = u.email || '';

    paintAvatar(u.photoUrl || '');
    if (accPhotoPrev) {
     const src = toAbsolute(u.photoUrl);
     if (src) { accPhotoPrev.src = src; accPhotoPrev.style.display = 'block'; }
     else { accPhotoPrev.removeAttribute('src'); accPhotoPrev.style.display = 'none'; }
}

  }
  loadMe().catch(() => { });

  accountForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = (accName?.value  || '').trim();
    const phone = (accPhone?.value || '').trim();

    const btn = accountForm.querySelector('#accSave');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      const r = await fetch(`${API_BASE}/api/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ name, phone })
      });
      const data = await r.json();
      if (!r.ok || !data?.user) throw new Error(data?.error || 'Save failed');

      await loadMe();

      accountModal?.classList.remove('show');
      accountModal?.setAttribute('aria-hidden', 'true');
    } catch (err) {
      alert(err.message || 'Save failed');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
    }
  });

  accPhoto?.addEventListener('change', async () => {
    const file = accPhoto.files?.[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append('file', file);

      const r = await fetch(`${API_BASE}/api/me/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd
      });
      const data = await r.json();
      if (!r.ok || !data?.url) throw new Error(data?.error || 'Upload failed');

      const abs = toAbsolute(data.url);
      if (accPhotoPrev) { accPhotoPrev.src = abs; accPhotoPrev.style.display = 'block'; }
      paintAvatar(abs);

    } catch (err) {
      alert(err.message || 'Upload failed');
    } finally {
      accPhoto.value = ''; 
    }
  });

  accPhotoRemove?.addEventListener('click', async () => {
    if (!confirm('Remove your profile picture?')) return;
    try {
      const r = await fetch(`${API_BASE}/api/me/photo`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await r.json();
      if (!r.ok || !data?.success) throw new Error(data?.error || 'Remove failed');

      if (accPhotoPrev) { accPhotoPrev.removeAttribute('src'); accPhotoPrev.style.display = 'none'; }
      paintAvatar('');
    } catch (err) {
      alert(err.message || 'Remove failed');
    }
  });
});

(function(){
  if (document.body.dataset.page !== 'profile') return;

  const grid        = document.getElementById('petGrid');
  const addBtnTop   = document.getElementById('addPetBtn');
  const petModal        = document.getElementById('petModal');
  const petForm         = document.getElementById('petForm');
  const petIdEl         = document.getElementById('petId');
  const nameEl          = document.getElementById('petNameInput');
  const speciesEl       = document.getElementById('petSpeciesInput');
  const breedEl         = document.getElementById('petBreedInput');
  const sexEl           = document.getElementById('petSexInput');
  const dobEl           = document.getElementById('petDobInput');
  const avatarPreviewEl = document.getElementById('petAvatarPreview');
  const avatarFileEl    = document.getElementById('petAvatarFile');
  const avatarRemoveEl  = document.getElementById('petAvatarRemove');
  const deleteBtn       = document.getElementById('petDeleteBtn');

  async function api(path, opts={}){
    const headers = { ...(opts.headers||{}) };
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    return jsonOrThrow(res);
  }
  function openModal(){ petModal.classList.add('show'); document.body.style.overflow = 'hidden'; }
  function closeModal(){ petModal.classList.remove('show'); document.body.style.overflow = ''; }
  petModal?.addEventListener('click', (e)=>{ if (e.target === petModal) closeModal(); });
  petModal?.querySelectorAll('[data-close]').forEach(b=> b.addEventListener('click', closeModal));

  function renderPets(list){
    if (!grid) return;
    if (!Array.isArray(list) || list.length === 0){
      grid.innerHTML = `
        <div class="add-pet-card" id="addPetCard"><span>+</span></div>
      `;
      document.getElementById('addPetCard')?.addEventListener('click', ()=> openPetModal());
      return;
    }
    grid.innerHTML = list.map(p => `
      <article class="pet-card" data-id="${p._id}">
        <div class="img" style="background-image:url('${toAbsolute(p.avatarUrl||"")}')"></div>
        <div class="meta">
          <div class="title">${p.name}</div>
          <div class="sub">${[p.species, p.breed].filter(Boolean).join(', ') || '&nbsp;'}</div>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.pet-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        const pet = list.find(x => x._id === card.dataset.id);
        openPetModal(pet);
      });
    });
  }

  async function loadPets(){
    try {
      const rows = await api('/api/me/pets');
      renderPets(rows);
    } catch(err){
      console.error(err);
      renderPets([]);
    }
  }

  function fillForm(p=null){
    petIdEl.value = p?._id || '';
    nameEl.value = p?.name || '';
    speciesEl.value = p?.species || '';
    breedEl.value = p?.breed || '';
    sexEl.value = p?.sex || '';
    dobEl.value = p?.dob || '';
    avatarFileEl.value = '';

    const url = p?.avatarUrl ? toAbsolute(p.avatarUrl) : '';
    avatarPreviewEl.style.backgroundImage = url ? `url("${url}")` : 'none';
  }

  function openPetModal(p=null){
    fillForm(p);
    deleteBtn.style.display = p ? 'inline-block' : 'none';
    openModal();
  }

  addBtnTop?.addEventListener('click', ()=> openPetModal());

  avatarRemoveEl?.addEventListener('click', async ()=>{
    avatarPreviewEl.style.backgroundImage = 'none';
    avatarFileEl.value = '';
  });

  petForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if (!nameEl.checkValidity() || !speciesEl.checkValidity()) return;

    const id = petIdEl.value || '';
    const payload = {
      name: nameEl.value.trim(),
      species: speciesEl.value.trim(),
      breed: (breedEl.value||'').trim(),
      sex: (sexEl.value||'').trim(),
      dob: dobEl.value || ''
    };

    try {
    const pet = id
  ? await api(`/api/me/pets/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
  : await api('/api/me/pets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });

      if (avatarFileEl.files[0]) {
        const fd = new FormData();
        fd.append('file', avatarFileEl.files[0]);
        await api(`/api/me/pets/${pet._id}/avatar`, { method:'POST', body: fd });

      }

      await loadPets();
      closeModal();
    } catch (err){
      alert(err.message || 'Save failed');
    }
  });

  deleteBtn?.addEventListener('click', async ()=>{
    const id = petIdEl.value;
    if (!id) return closeModal();
    if (!confirm('Remove this pet?')) return;
    try {
      await api(`/api/me/pets/${id}`, { method:'DELETE' });
      await loadPets();
      closeModal();
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  });
  loadPets();
})();


document.addEventListener('DOMContentLoaded', async () => {
  if (document.body?.dataset?.page !== 'home') return;

  try {
    let data = await fetch(`${API_BASE}/api/public/settings`).then(r => r.json()).catch(() => ({}));
    let heroPath = data?.images?.hero || data?.settings?.images?.hero || '';

    if (!heroPath) {
      const alt = await fetch(`${API_BASE}/api/settings`).then(r => r.json()).catch(() => ({}));
      heroPath = alt?.settings?.images?.hero || '';
    }
    if (!heroPath) return; 

    const url = `${API_BASE}${heroPath}?v=${Date.now()}`;

    const heroImg = document.getElementById('heroImg');
    if (heroImg) heroImg.src = url;

    const heroSection = document.querySelector('.hero');
    if (heroSection) heroSection.style.backgroundImage = `url('${url}')`;
  } catch (e) {
    console.error('Failed to load hero from settings', e);
  }
});

