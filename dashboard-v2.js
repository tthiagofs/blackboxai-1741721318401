import { auth } from './config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { projectsService } from './services/projects.js';
import * as unitsService from './services/unitsService.js';
import { fbAuth } from './auth.js';
import { googleAuth } from './authGoogle.js';

let currentProjectId = null;
let currentMonth = null;
let allUnits = [];

function formatCurrency(v) { 
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); 
}

function yyyymm(d) { 
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
}

function monthStartEnd(ym) {
  const [y, m] = ym.split('-').map(n=>parseInt(n,10));
  const s = new Date(y, m-1, 1).toISOString().split('T')[0];
  const e = new Date(y, m, 0).toISOString().split('T')[0];
  return { start: s, end: e };
}

onAuthStateChanged(auth, async (user) => { 
  if (!user) { 
    window.location.href = '/login.html'; 
    return; 
  } 
  await bootstrap(); 
});

async function bootstrap() {
  try {
    await populateProjects();
    populateMonths();
    document.getElementById('generateBtn').addEventListener('click', generateDashboard);
  } catch (error) {
    console.error('Erro ao inicializar dashboard:', error);
  }
}

async function populateProjects() {
  try {
    const select = document.getElementById('projectSelect');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    const projects = await projectsService.listProjects();
    projects.forEach(p => { 
      const o = document.createElement('option'); 
      o.value = p.id; 
      o.textContent = p.name; 
      select.appendChild(o); 
    });
    
    const saved = localStorage.getItem('currentProject');
    if (saved && projects.find(p => p.id === saved)) {
      select.value = saved;
    }
    
    currentProjectId = select.value || null;
    select.addEventListener('change', e => { 
      currentProjectId = e.target.value; 
      localStorage.setItem('currentProject', currentProjectId || ''); 
    });
  } catch (error) {
    console.error('Erro ao carregar projetos:', error);
    document.getElementById('projectSelect').innerHTML = '<option value="">Erro ao carregar projetos</option>';
  }
}

function populateMonths() {
  try {
    const select = document.getElementById('monthSelect'); 
    select.innerHTML = '';
    const now = new Date();
    
    for (let i = 0; i < 12; i++) { 
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1); 
      const ym = yyyymm(d); 
      const label = d.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'}); 
      const o = document.createElement('option'); 
      o.value = ym; 
      o.textContent = label.charAt(0).toUpperCase() + label.slice(1); 
      if (i === 0) o.selected = true; 
      select.appendChild(o);
    } 
    
    currentMonth = select.value; 
    select.addEventListener('change', e => { 
      currentMonth = e.target.value; 
    });
  } catch (error) {
    console.error('Erro ao popular meses:', error);
  }
}

async function generateDashboard() {
  if (!currentProjectId) { 
    alert('Selecione um projeto'); 
    return; 
  }
  if (!currentMonth) { 
    alert('Selecione um mês'); 
    return; 
  }
  
  const empty = document.getElementById('emptyState');
  document.getElementById('cardsSection').classList.add('hidden');
  document.getElementById('tableSection').classList.add('hidden');
  empty.classList.remove('hidden');
  empty.querySelector('h3').textContent = 'Gerando dashboard...';
  empty.querySelector('p').textContent = 'Calculando métricas...';

  try {
    allUnits = await unitsService.listUnits(currentProjectId);
    const { start, end } = monthStartEnd(currentMonth);

    // Calcula métricas da planilha por unidade
    const rows = allUnits.map(u => {
      const plan = computeUnitMetricsFromSpreadsheet(u, start, end);
      return {
        id: u?.id || '',
        name: u?.name || '-',
        invested: plan.invested,
        sales: plan.sales,
        revenue: plan.revenue
      };
    });

    const totals = rows.reduce((a, r) => ({
      units: a.units + 1, 
      invested: a.invested + r.invested, 
      sales: a.sales + r.sales, 
      revenue: a.revenue + r.revenue 
    }), { units: 0, invested: 0, sales: 0, revenue: 0 });

    renderCards(totals); 
    renderTable(rows);
    
    empty.classList.add('hidden'); 
    document.getElementById('cardsSection').classList.remove('hidden'); 
    document.getElementById('tableSection').classList.remove('hidden');
  } catch (error) {
    console.error('Erro ao gerar dashboard:', error);
    empty.querySelector('h3').textContent = 'Erro ao gerar dashboard';
    empty.querySelector('p').textContent = 'Tente novamente ou verifique sua conexão.';
  }
}

function normalizeStr(v) { 
  return String(v ?? '').trim().toLowerCase(); 
}

function computeUnitMetricsFromSpreadsheet(unit, startDate, endDate) {
  if (!unit.budgetData || !unit.budgetData.rawData) {
    return { invested: 0, sales: 0, revenue: 0 };
  }
  
  const filteredData = filterUnitDataByPeriod(unit.budgetData.rawData, startDate, endDate);
  
  return {
    invested: filteredData.totalBudgets * 100, // Assumindo R$ 100 por orçamento como exemplo
    sales: filteredData.totalSales,
    revenue: filteredData.totalRevenue
  };
}

// Filtrar dados da unidade por período (mesma lógica do RelatorioCompleto.js)
function filterUnitDataByPeriod(rawData, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const filtered = rawData.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
  
  return {
    totalBudgets: filtered.length,
    totalSales: filtered.filter(r => r.status === "APPROVED").length,
    totalRevenue: filtered.filter(r => r.status === "APPROVED")
                        .reduce((sum, r) => sum + (r.value || 0), 0)
  };
}

function renderCards(t) {
  document.getElementById('cardUnits').textContent = t.units;
  document.getElementById('cardInvested').textContent = formatCurrency(t.invested);
  document.getElementById('cardSales').textContent = t.sales;
  document.getElementById('cardRevenue').textContent = formatCurrency(t.revenue);
}

function renderTable(rows) {
  const tbody = document.getElementById('unitsTableBody'); 
  tbody.innerHTML = '';
  rows.sort((a, b) => b.revenue - a.revenue);
  
  for (const r of rows) { 
    const tr = document.createElement('tr'); 
    tr.innerHTML = `
      <td class="px-6 py-3 text-sm text-gray-900">${r.name}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${formatCurrency(r.invested)}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${r.sales}</td>
      <td class="px-6 py-3 text-sm text-right text-gray-900">${formatCurrency(r.revenue)}</td>`; 
    tbody.appendChild(tr); 
  }
}