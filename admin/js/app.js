import { api, token } from './api.js';
import { toast } from './ui/toast.js';
import { renderDashboard }    from './pages/dashboard.js';
import { renderAppointments } from './pages/appointments.js';
import { renderUsers }        from './pages/users.js';
import { renderPets }         from './pages/pets.js';
import { renderContent }      from './pages/content.js';
import { renderSettings }     from './pages/settings.js';

const loginView = document.getElementById('login-view');
const appShell  = document.getElementById('app-shell');
const content   = document.getElementById('content');
const titleEl   = document.getElementById('page-title');

function showLogin(){ appShell.classList.add('hidden'); loginView.classList.remove('hidden'); }
function showApp(){ loginView.classList.add('hidden'); appShell.classList.remove('hidden'); renderRoute(); }

document.getElementById('login-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  try{
    const res = await api.post('/api/admin/login', { email, password });
    token.set(res.accessToken);
    toast('Signed in');
    showApp();
  }catch(err){ toast(err.message || 'Login failed'); }
});

document.getElementById('signout')?.addEventListener('click', ()=>{ token.clear(); toast('Signed out'); showLogin(); });

function routeName(){
  const h = location.hash || '#/dashboard';
  return h.split('?')[0];
}
function setActiveNav(){
  const name = routeName();
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === name);
  });
  titleEl.textContent = name.replace('#/','').replace(/^\w/, s=>s.toUpperCase());
}
async function renderRoute(){
  if (!token.get()) return showLogin();
  setActiveNav();
  const name = routeName();
  if      (name==='#/dashboard')    await renderDashboard(content);
  else if (name==='#/appointments') await renderAppointments(content);
  else if (name==='#/users')        await renderUsers(content);
  else if (name==='#/pets')         await renderPets(content);
  else if (name==='#/content')      await renderContent(content);
  else if (name==='#/settings')     await renderSettings(content);
  else                              await renderDashboard(content);
}
window.addEventListener('hashchange', renderRoute);
if (token.get()) showApp(); else showLogin();
