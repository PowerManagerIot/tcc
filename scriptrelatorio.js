import {auth, database} from "./auth.js"

// ========== VARIÁVEIS GLOBAIS ==========
let USER_ID = null;
let energyPrice = 0.80; // Preço padrão do kWh
let allStatistics = {
    mensal: {},
    diario: {},
    horario: {}
};

// Elementos da página
const connectionStatus = document.getElementById('connectionStatus');
const periodFilter = document.getElementById('periodFilter');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const exportBtn = document.getElementById('exportBtn');

// Elementos de estatísticas
const totalConsumption = document.getElementById('totalConsumption');
const totalCost = document.getElementById('totalCost');
const dailyAverage = document.getElementById('dailyAverage');
const peakConsumption = document.getElementById('peakConsumption');
const peakDate = document.getElementById('peakDate');
const tableBody = document.getElementById('tableBody');

// Charts
let monthlyChart = null;
let dailyChart = null;
let hourlyChart = null;
let trendChart = null;

// ========== FUNÇÕES DE AUTENTICAÇÃO ==========

function verificarAutenticacao() {
    return new Promise((resolve, reject) => {
        const storedUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') || localStorage.getItem('isLoggedIn');
        
        if (storedUserId && isLoggedIn === 'true') {
            USER_ID = storedUserId;
            console.log('Usuário recuperado do storage:', USER_ID);
            resolve(USER_ID);
        } else {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    USER_ID = user.uid;
                    console.log('Usuário autenticado:', USER_ID);
                    
                    sessionStorage.setItem('userId', user.uid);
                    sessionStorage.setItem('userEmail', user.email);
                    sessionStorage.setItem('isLoggedIn', 'true');
                    
                    resolve(USER_ID);
                } else {
                    console.log('Nenhum usuário autenticado');
                    reject('Usuário não autenticado');
                }
            });
        }
    });
}

function redirecionarParaLogin() {
    alert('Sessão expirada. Por favor, faça login novamente.');
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'login.html';
}

function logout() {
    console.log('Iniciando logout...');
    
    auth.signOut().then(() => {
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao fazer logout: ' + error.message);
    });
}

// ========== FUNÇÕES DE CARREGAMENTO DE DADOS ==========

function loadEnergyPrice() {
    const savedPrice = localStorage.getItem('energyPrice');
    if (savedPrice) {
        energyPrice = parseFloat(savedPrice);
    }
}

function updateConnectionStatus(message, isConnected = true) {
    if (connectionStatus) {
        connectionStatus.innerHTML = `
            <div class="w-2 h-2 ${isConnected ? 'bg-accent-green' : 'bg-accent-red'} rounded-full ${isConnected ? 'animate-pulse' : ''}"></div>
            <span class="text-sm">${message}</span>
        `;
    }
}

async function loadStatistics() {
    if (!USER_ID) {
        console.error('USER_ID não definido');
        return;
    }

    updateConnectionStatus('Carregando estatísticas...', true);

    try {
        // Carregar dados mensais
        const monthlyRef = database.ref(`users/${USER_ID}/esp32/estatisticas/mensal`);
        const monthlySnapshot = await monthlyRef.once('value');
        allStatistics.mensal = monthlySnapshot.val() || {};

        // Carregar dados diários
        const dailyRef = database.ref(`users/${USER_ID}/esp32/estatisticas/diario`);
        const dailySnapshot = await dailyRef.once('value');
        allStatistics.diario = dailySnapshot.val() || {};

        // Carregar dados por hora
        const hourlyRef = database.ref(`users/${USER_ID}/esp32/estatisticas/horario`);
        const hourlySnapshot = await hourlyRef.once('value');
        allStatistics.horario = hourlySnapshot.val() || {};

        updateConnectionStatus('Dados carregados com sucesso!', true);
        
        // Processar e exibir dados
        processAndDisplayData();

    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        updateConnectionStatus('Erro ao carregar dados: ' + error.message, false);
    }
}

// ========== FUNÇÕES DE PROCESSAMENTO DE DADOS ==========

function getFilteredData(data, days) {
    if (days === 'all') return data;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const filtered = {};
    Object.keys(data).forEach(key => {
        const itemDate = new Date(key);
        if (itemDate >= cutoffDate) {
            filtered[key] = data[key];
        }
    });
    
    return filtered;
}

function calculateStatistics(dailyData) {
    const values = Object.values(dailyData);
    
    if (values.length === 0) {
        return {
            total: 0,
            average: 0,
            peak: { value: 0, date: '--' }
        };
    }

    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    
    let peakValue = 0;
    let peakKey = '';
    
    Object.entries(dailyData).forEach(([key, value]) => {
        if (value > peakValue) {
            peakValue = value;
            peakKey = key;
        }
    });

    return {
        total: total,
        average: average,
        peak: {
            value: peakValue,
            date: peakKey ? formatDate(new Date(peakKey)) : '--'
        }
    };
}

function formatDate(date) {
    return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
    });
}

// ========== FUNÇÕES DE EXIBIÇÃO ==========

function processAndDisplayData() {
    const selectedPeriod = periodFilter.value;
    const days = selectedPeriod === 'all' ? 'all' : parseInt(selectedPeriod);
    
    // Filtrar dados diários
    const filteredDaily = getFilteredData(allStatistics.diario, days);
    
    // Calcular estatísticas
    const stats = calculateStatistics(filteredDaily);
    
    // Atualizar cards de estatísticas
    if (totalConsumption) {
        totalConsumption.textContent = `${stats.total.toFixed(2)} kWh`;
    }
    if (totalCost) {
        totalCost.textContent = `R$ ${formatCurrency(stats.total * energyPrice)}`;
    }
    if (dailyAverage) {
        dailyAverage.textContent = `${stats.average.toFixed(2)} kWh`;
    }
    if (peakConsumption) {
        peakConsumption.textContent = `${stats.peak.value.toFixed(2)} kWh`;
    }
    if (peakDate) {
        peakDate.textContent = stats.peak.date;
    }
    
    // Atualizar gráficos
    updateMonthlyChart();
    updateDailyChart(filteredDaily);
    updateHourlyChart();
    updateTrendChart(filteredDaily);
    
    // Atualizar tabela
    updateTable(filteredDaily);
}

// ========== FUNÇÕES DE GRÁFICOS ==========

function updateMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    // Preparar dados mensais
    const monthlyData = allStatistics.mensal;
    const sortedMonths = Object.keys(monthlyData).sort();
    
    const labels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleDateString('pt-BR', { 
            month: 'short', 
            year: '2-digit' 
        });
    });
    
    const data = sortedMonths.map(month => monthlyData[month]);

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Consumo (kWh)',
                data: data,
                backgroundColor: 'rgba(0, 255, 42, 0.2)',
                borderColor: '#00ff2a',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1e1e1e',
                    titleColor: '#00ff2a',
                    bodyColor: '#ffffff',
                    borderColor: '#333333',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(2)} kWh`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#333333'
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                }
            }
        }
    });
}

function updateDailyChart(dailyData) {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;

    const sortedDays = Object.keys(dailyData).sort();
    const labels = sortedDays.map(day => {
        const date = new Date(day);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });
    const data = sortedDays.map(day => dailyData[day]);

    if (dailyChart) {
        dailyChart.destroy();
    }

    dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Consumo Diário (kWh)',
                data: data,
                backgroundColor: 'rgba(238, 234, 16, 0.1)',
                borderColor: '#eeea10',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#eeea10',
                pointBorderColor: '#1a1a1a',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1e1e1e',
                    titleColor: '#eeea10',
                    bodyColor: '#ffffff',
                    borderColor: '#333333',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#333333'
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function updateHourlyChart() {
    const ctx = document.getElementById('hourlyChart');
    if (!ctx) return;

    const hourlyData = allStatistics.horario || {};
    const hours = Array.from({length: 24}, (_, i) => i);
    const data = hours.map(hour => hourlyData[hour] || 0);
    const labels = hours.map(h => `${h}:00`);

    if (hourlyChart) {
        hourlyChart.destroy();
    }

    hourlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Consumo Médio (kWh)',
                data: data,
                backgroundColor: data.map((value, index) => {
                    const max = Math.max(...data);
                    if (value === max && value > 0) return 'rgba(239, 68, 68, 0.6)';
                    if (value > max * 0.7) return 'rgba(238, 234, 16, 0.6)';
                    return 'rgba(0, 255, 42, 0.4)';
                }),
                borderColor: data.map((value, index) => {
                    const max = Math.max(...data);
                    if (value === max && value > 0) return '#ef4444';
                    if (value > max * 0.7) return '#eeea10';
                    return '#00ff2a';
                }),
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1e1e1e',
                    titleColor: '#00ff2a',
                    bodyColor: '#ffffff',
                    borderColor: '#333333',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#333333'
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxRotation: 90,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function updateTrendChart(dailyData) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    const sortedDays = Object.keys(dailyData).sort();
    const data = sortedDays.map(day => dailyData[day]);
    
    // Calcular média móvel de 7 dias
    const movingAverage = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - 6);
        const slice = data.slice(start, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
        movingAverage.push(avg);
    }

    const labels = sortedDays.map(day => {
        const date = new Date(day);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Consumo Real',
                    data: data,
                    borderColor: '#6b7280',
                    backgroundColor: 'rgba(107, 114, 128, 0.1)',
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.1
                },
                {
                    label: 'Média Móvel (7 dias)',
                    data: movingAverage,
                    borderColor: '#00ff2a',
                    backgroundColor: 'rgba(0, 255, 42, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#9ca3af',
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: '#1e1e1e',
                    titleColor: '#00ff2a',
                    bodyColor: '#ffffff',
                    borderColor: '#333333',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#333333'
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// ========== FUNÇÕES DE TABELA ==========

function updateTable(dailyData) {
    if (!tableBody) return;

    const sortedDays = Object.keys(dailyData).sort().reverse(); // Mais recente primeiro
    
    if (sortedDays.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-gray-500">Nenhum dado disponível para o período selecionado</td>
            </tr>
        `;
        return;
    }

    let html = '';
    sortedDays.forEach(day => {
        const consumption = dailyData[day];
        const cost = consumption * energyPrice;
        const avgPerHour = consumption / 24;
        const date = new Date(day);
        const formattedDate = formatDate(date);
        
        // Determinar status baseado no consumo
        let status = '';
        let statusClass = '';
        if (consumption < 10) {
            status = 'Baixo';
            statusClass = 'text-accent-green';
        } else if (consumption < 20) {
            status = 'Normal';
            statusClass = 'text-accent-yellow';
        } else {
            status = 'Alto';
            statusClass = 'text-accent-red';
        }
        
        html += `
            <tr class="border-b border-border-dark hover:bg-bg-secondary transition-colors">
                <td class="py-3 px-4 text-sm">${formattedDate}</td>
                <td class="py-3 px-4 text-sm text-right font-semibold">${consumption.toFixed(2)}</td>
                <td class="py-3 px-4 text-sm text-right">R$ ${formatCurrency(cost)}</td>
                <td class="py-3 px-4 text-sm text-right text-gray-400">${avgPerHour.toFixed(3)}</td>
                <td class="py-3 px-4 text-sm text-center">
                    <span class="${statusClass} font-semibold">${status}</span>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// ========== FUNÇÕES DE EXPORTAÇÃO ==========

function exportToCSV() {
    const selectedPeriod = periodFilter.value;
    const days = selectedPeriod === 'all' ? 'all' : parseInt(selectedPeriod);
    const filteredDaily = getFilteredData(allStatistics.diario, days);
    
    if (Object.keys(filteredDaily).length === 0) {
        alert('Não há dados para exportar no período selecionado.');
        return;
    }
    
    // Criar cabeçalho CSV
    let csv = 'Data,Consumo (kWh),Custo (R$),Média/Hora (kWh)\n';
    
    // Adicionar dados
    const sortedDays = Object.keys(filteredDaily).sort().reverse();
    sortedDays.forEach(day => {
        const consumption = filteredDaily[day];
        const cost = consumption * energyPrice;
        const avgPerHour = consumption / 24;
        const date = new Date(day);
        const formattedDate = formatDate(date);
        
        csv += `${formattedDate},${consumption.toFixed(2)},${cost.toFixed(2)},${avgPerHour.toFixed(3)}\n`;
    });
    
    // Criar e fazer download do arquivo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_consumo_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    updateConnectionStatus('Relatório exportado com sucesso!', true);
    setTimeout(() => {
        updateConnectionStatus('Conectado ao Firebase', true);
    }, 3000);
}

// ========== EVENT LISTENERS ==========

if (periodFilter) {
    periodFilter.addEventListener('change', () => {
        processAndDisplayData();
    });
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        loadStatistics();
    });
}

if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

// ========== INICIALIZAÇÃO ==========

async function inicializarRelatorios() {
    try {
        await verificarAutenticacao();
        console.log('Relatórios inicializados para usuário:', USER_ID);
        
        // Carregar preço da energia
        loadEnergyPrice();
        
        // Carregar estatísticas
        await loadStatistics();
        
        updateConnectionStatus('Conectado ao Firebase', true);
        
    } catch (error) {
        console.error('Erro ao inicializar relatórios:', error);
        redirecionarParaLogin();
    }
}

document.addEventListener('DOMContentLoaded', inicializarRelatorios);