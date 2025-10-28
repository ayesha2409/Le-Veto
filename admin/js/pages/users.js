import { api } from '../api.js';
import { renderTable } from '../ui/table.js';

export async function renderUsers(root){
  const users = await api.get('/api/users');
  const columns = [
    { label:'Name', key:'name' },
    { label:'Email', key:'email' },
    { label:'Phone', key:'phone' },
    { label:'Joined', render:r=> new Date(r.createdAt).toLocaleDateString() }
  ];
  root.innerHTML = `<div class="toolbar"><h3>Users</h3></div>${renderTable({ columns, rows: users })}`;
}
