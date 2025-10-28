export function renderTable({ columns, rows }) {
  const thead = `<thead><tr>${columns.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${
    (rows||[]).map(r=>`<tr>${columns.map(c=>`<td>${(c.render?c.render(r): (r[c.key] ?? ''))}</td>`).join('')}</tr>`).join('')
  }</tbody>`;
  return `<table class="table">${thead}${tbody}</table>`;
}
