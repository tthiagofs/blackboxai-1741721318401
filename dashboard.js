// Dashboard v2 - simples e funcional
import { auth, db } from './config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { projectsService } from './services/projects.js';
import * as unitsService from './services/unitsService.js';

// Estado
let currentProjectId = null;
let currentMonth = null; // YYYY-MM
let allUnits = [];

// Util
function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function yyyymm(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthStartEnd(ym) {
  const [y, m] = ym.split('-').map(n => parseInt(n, 10));
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const s = start.toISOString().split('T')[0];
  const e = end.toISOString().split('T')[0];
  return { start: s, end: e };
}

// Autenticação e boot
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  await bootstrap();
});

async function bootstrap() {
  await populateProjects();
  populateMonths();
  document.getElementById('generateBtn').addEventListener('click', generateDashboard);
}

async function populateProjects() {
  const select = document.getElementById('projectSelect');
  select.innerHTML = '<option value="">Selecione...</option>';
  const projects = await projectsService.listProjects();
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
  // Tenta usar o último projeto usado
  const saved = localStorage.getItem('currentProject');
  if (saved && projects.find(p => p.id === saved)) {
    select.value = saved;
  }
  select.addEventListener('change', (e) => {
    currentProjectId = e.target.value || null;
    if (currentProjectId) localStorage.setItem('currentProject', currentProjectId);
  });
  currentProjectId = select.value || null;
}

function populateMonths() {
  const select = document.getElementById('monthSelect');
  select.innerHTML = '';
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = yyyymm(d);
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    if (i === 0) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', (e) => { currentMonth = e.target.value; });
  currentMonth = select.value;
}

async function generateDashboard() {
  if (!currentProjectId) { alert('Selecione um projeto'); return; }
  if (!currentMonth) { alert('Selecione um mês'); return; }

  // Loading simples
  document.getElementById('cardsSection').classList.add('hidden');
  document.getElementById('tableSection').classList.add('hidden');
  const empty = document.getElementById('emptyState');
  empty.classList.remove('hidden');
  empty.querySelector('h3').textContent = 'Gerando dashboard...';
  empty.querySelector('p').textContent = 'Calculando métricas a partir das planilhas das unidades.';

  // Carrega unidades do projeto
  allUnits = await unitsService.listUnits(currentProjectId);
  const { start, end } = monthStartEnd(currentMonth);

  // Calcula métricas
  const rows = allUnits.map(u => computeUnitMetrics(u, start, end));

  // Agrega totais
  const totals = rows.reduce((acc, r) => {
    acc.units += 1;
    acc.invested += r.invested;
    acc.sales += r.sales;
    acc.revenue += r.revenue;
    return acc;
  }, { units: 0, invested: 0, sales: 0, revenue: 0 });

  // Renderiza
  renderCards(totals);
  renderTable(rows);

  // Mostra
  empty.classList.add('hidden');
  document.getElementById('cardsSection').classList.remove('hidden');
  document.getElementById('tableSection').classList.remove('hidden');
}

function computeUnitMetrics(unit, startDate, endDate) {
  if (!unit || !unit.budgetData || !unit.budgetData.rawData) {
    return { id: unit?.id || '', name: unit?.name || '-', invested: 0, sales: 0, revenue: 0 };
  }
  const data = unit.budgetData.rawData.filter(item => item.date >= startDate && item.date <= endDate);

  let invested = 0;
  let sales = 0;
  let revenue = 0;
  for (const item of data) {
    if (item.budgetCompleted === 'Sim') {
      invested += Number(item.budgetValue || 0);
      revenue += Number(item.saleValue || 0);
      sales += 1;
    }
  }
  return { id: unit.id, name: unit.name, invested, sales, revenue };
}

function renderCards(totals) {
  document.getElementById('cardUnits').textContent = totals.units;
  document.getElementById('cardInvested').textContent = formatCurrency(totals.invested);
  document.getElementById('cardSales').textContent = totals.sales;
  document.getElementById('cardRevenue').textContent = formatCurrency(totals.revenue);
}

function renderTable(rows) {
  const tbody = document.getElementById('unitsTableBody');
  tbody.innerHTML = '';
  // Ordena por faturamento desc
  rows.sort((a, b) => b.revenue - a.revenue);

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-3 text-sm text-gray-900">${r.name}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${formatCurrency(r.invested)}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${r.sales}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${formatCurrency(r.revenue)}</td>
    `;
    tbody.appendChild(tr);
  }
}

