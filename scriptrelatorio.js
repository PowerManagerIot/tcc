import {auth, database} from "./auth.js"

// ========== CONFIGURAÇÃO GEMINI AI ==========
const GEMINI_API_KEY = 'AIzaSyDfhomKTh_2WhvVveb7KSfsY_9Ri1IrUyg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// No início do arquivo, após importar auth e database
const PROJECT_ID = auth.app.options.projectId;

// E na função, use assim:
const functionUrl = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/generateAIReport`;

// ========== VARIÁVEIS GLOBAIS ==========
let USER_ID = null;
let energyPrice = 0.80;
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

// Elementos da IA
const generateAIReportBtn = document.getElementById('generateAIReportBtn');
const aiAnalysisContainer = document.getElementById('aiAnalysisContainer');
const aiAnalysisContent = document.getElementById('aiAnalysisContent');
const aiLoadingContainer = document.getElementById('aiLoadingContainer');

// Elementos de análise por dispositivo
const deviceSelect = document.getElementById('deviceSelect');
const deviceViewHour = document.getElementById('deviceViewHour');
const deviceViewDay = document.getElementById('deviceViewDay');
const deviceViewMonth = document.getElementById('deviceViewMonth');
const deviceStatsContainer = document.getElementById('deviceStatsContainer');
const deviceChartContainer = document.getElementById('deviceChartContainer');
const devicePlaceholder = document.getElementById('devicePlaceholder');
const deviceTotalConsumption = document.getElementById('deviceTotalConsumption');
const deviceTotalCost = document.getElementById('deviceTotalCost');
const deviceTotalTime = document.getElementById('deviceTotalTime');
const devicePower = document.getElementById('devicePower');
const deviceChartInfo = document.getElementById('deviceChartInfo');

// Charts
let monthlyChart = null;
let dailyChart = null;
let hourlyChart = null;
let trendChart = null;
let deviceChart = null;

// Variáveis para dispositivos
let allDevices = {};
let selectedDevice = null;
let deviceViewMode = 'hour';

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

        // Carregar dispositivos
        await loadDevices();

        updateConnectionStatus('Dados carregados com sucesso!', true);
        
        // Processar e exibir dados
        processAndDisplayData();

    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        updateConnectionStatus('Erro ao carregar dados: ' + error.message, false);
    }
}

// ========== FUNÇÕES DE DISPOSITIVOS ==========

async function loadDevices() {
    try {
        const devicesRef = database.ref(`users/${USER_ID}/devices`);
        const snapshot = await devicesRef.once('value');
        allDevices = snapshot.val() || {};
        
        populateDeviceSelect();
        console.log('✅ Dispositivos carregados:', Object.keys(allDevices).length);
    } catch (error) {
        console.error('❌ Erro ao carregar dispositivos:', error);
    }
}

function populateDeviceSelect() {
    if (!deviceSelect) return;
    
    deviceSelect.innerHTML = '<option value="">Selecione um dispositivo</option>';
    
    Object.entries(allDevices).forEach(([key, device]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${device.name} (${device.number}W) - ${device.hasButton === 'yes' ? 'Inteligente' : 'Regular'}`;
        deviceSelect.appendChild(option);
    });
}

function formatUptime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function calculateDeviceConsumptionByPeriod(device, isSmart) {
    const now = new Date();
    const data = {
        hour: {},
        day: {},
        month: {}
    };
    
    if (!isSmart) {
        // Dispositivo regular - sempre ligado
        const createdAt = new Date(device.createdAt || device.createdDate);
        const watts = device.number || 0;
        
        // Por hora (últimas 24h)
        for (let i = 23; i >= 0; i--) {
            const hourDate = new Date(now);
            hourDate.setHours(now.getHours() - i, 0, 0, 0);
            const hourKey = hourDate.getHours();
            
            if (hourDate >= createdAt) {
                const consumption = (watts * 1) / 1000;
                data.hour[hourKey] = consumption;
            } else {
                data.hour[hourKey] = 0;
            }
        }
        
        // Por dia (últimos 30 dias)
        for (let i = 29; i >= 0; i--) {
            const dayDate = new Date(now);
            dayDate.setDate(now.getDate() - i);
            dayDate.setHours(0, 0, 0, 0);
            const dayKey = dayDate.toISOString().split('T')[0];
            
            if (dayDate >= createdAt) {
                const consumption = (watts * 24) / 1000;
                data.day[dayKey] = consumption;
            } else {
                data.day[dayKey] = 0;
            }
        }
        
        // Por mês (últimos 12 meses)
        for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(now);
            monthDate.setMonth(now.getMonth() - i, 1);
            monthDate.setHours(0, 0, 0, 0);
            const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (monthDate >= createdAt) {
                const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
                const consumption = (watts * 24 * daysInMonth) / 1000;
                data.month[monthKey] = consumption;
            } else {
                data.month[monthKey] = 0;
            }
        }
        
    } else {
        // Dispositivo inteligente - usar stateHistory
        const watts = device.number || 0;
        const stateHistory = device.stateHistory || {};
        const historyArray = Object.values(stateHistory).sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        // Por hora (últimas 24h)
        for (let i = 23; i >= 0; i--) {
            const hourStart = new Date(now);
            hourStart.setHours(now.getHours() - i, 0, 0, 0);
            const hourEnd = new Date(hourStart);
            hourEnd.setHours(hourStart.getHours() + 1);
            
            let totalMs = 0;
            let isOn = false;
            let lastTime = hourStart;
            
            // Verificar estado no início do período
            for (let j = 0; j < historyArray.length; j++) {
                const entry = historyArray[j];
                const entryTime = new Date(entry.timestamp);
                
                if (entryTime <= hourStart) {
                    isOn = entry.state;
                } else {
                    break;
                }
            }
            
            // Calcular tempo ligado no período
            historyArray.forEach(entry => {
                const entryTime = new Date(entry.timestamp);
                
                if (entryTime >= hourStart && entryTime < hourEnd) {
                    if (isOn) {
                        totalMs += entryTime - lastTime;
                    }
                    isOn = entry.state;
                    lastTime = entryTime;
                }
            });
            
            // Se estava ligado no final do período
            if (isOn && lastTime < hourEnd) {
                const endTime = hourEnd > now ? now : hourEnd;
                totalMs += endTime - lastTime;
            }
            
            const hours = totalMs / (1000 * 60 * 60);
            const consumption = (watts * hours) / 1000;
            data.hour[hourStart.getHours()] = consumption;
        }
        
        // Por dia (últimos 30 dias)
        for (let i = 29; i >= 0; i--) {
            const dayStart = new Date(now);
            dayStart.setDate(now.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayStart.getDate() + 1);
            
            let totalMs = 0;
            let isOn = false;
            let lastTime = dayStart;
            
            for (let j = 0; j < historyArray.length; j++) {
                const entry = historyArray[j];
                const entryTime = new Date(entry.timestamp);
                
                if (entryTime <= dayStart) {
                    isOn = entry.state;
                } else {
                    break;
                }
            }
            
            historyArray.forEach(entry => {
                const entryTime = new Date(entry.timestamp);
                
                if (entryTime >= dayStart && entryTime < dayEnd) {
                    if (isOn) {
                        totalMs += entryTime - lastTime;
                    }
                    isOn = entry.state;
                    lastTime = entryTime;
                }
            });
            
            if (isOn && lastTime < dayEnd) {
                const endTime = dayEnd > now ? now : dayEnd;
                totalMs += endTime - lastTime;
            }
            
            const hours = totalMs / (1000 * 60 * 60);
            const consumption = (watts * hours) / 1000;
            data.day[dayStart.toISOString().split('T')[0]] = consumption;
        }
        
        // Por mês (últimos 12 meses)
        for (let i = 11; i >= 0; i--) {
            const monthStart = new Date(now);
            monthStart.setMonth(now.getMonth() - i, 1);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(monthStart);
            monthEnd.setMonth(monthStart.getMonth() + 1);
            
            let totalMs = 0;
            let isOn = false;
            let lastTime = monthStart;
            
            for (let j = 0; j < historyArray.length; j++) {
                const entry = historyArray[j];
                const entryTime = new Date(entry.timestamp);
                
                if (entryTime <= monthStart) {
                    isOn = entry.state;
                } else {
                    break;
                }
            }
            
            historyArray.forEach(entry => {
                const entryTime = new Date(entry.timestamp);
                
                if (entryTime >= monthStart && entryTime < monthEnd) {
                    if (isOn) {
                        totalMs += entryTime - lastTime;
                    }
                    isOn = entry.state;
                    lastTime = entryTime;
                }
            });
            
            if (isOn && lastTime < monthEnd) {
                const endTime = monthEnd > now ? now : monthEnd;
                totalMs += endTime - lastTime;
            }
            
            const hours = totalMs / (1000 * 60 * 60);
            const consumption = (watts * hours) / 1000;
            const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
            data.month[monthKey] = consumption;
        }
    }
    
    return data;
}

function updateDeviceChart() {
    if (!selectedDevice || !allDevices[selectedDevice]) return;
    
    const device = allDevices[selectedDevice];
    const isSmart = device.hasButton === 'yes';
    const consumptionData = calculateDeviceConsumptionByPeriod(device, isSmart);
    
    let labels = [];
    let data = [];
    let chartTitle = '';
    let infoText = '';
    
    if (deviceViewMode === 'hour') {
        const hourData = consumptionData.hour;
        labels = Object.keys(hourData).sort((a, b) => a - b).map(h => `${h}:00`);
        data = labels.map(label => {
            const hour = parseInt(label.split(':')[0]);
            return hourData[hour] || 0;
        });
        chartTitle = 'Consumo por Hora (Últimas 24h)';
        infoText = isSmart 
            ? 'Gráfico mostra consumo real. Quando o dispositivo está desligado, o consumo é zero.'
            : 'Dispositivo regular (sempre ligado). Consumo constante de ' + device.number + 'W por hora.';
    } else if (deviceViewMode === 'day') {
        const dayData = consumptionData.day;
        const sortedDays = Object.keys(dayData).sort();
        labels = sortedDays.map(day => {
            const date = new Date(day);
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        });
        data = sortedDays.map(day => dayData[day] || 0);
        chartTitle = 'Consumo Diário (Últimos 30 dias)';
        infoText = isSmart
            ? 'Consumo acumulado por dia. Dias sem uso aparecem zerados.'
            : 'Dispositivo regular (sempre ligado). Consumo diário: ' + ((device.number * 24) / 1000).toFixed(2) + ' kWh.';
    } else {
        const monthData = consumptionData.month;
        const sortedMonths = Object.keys(monthData).sort();
        labels = sortedMonths.map(month => {
            const [year, monthNum] = month.split('-');
            return new Date(year, monthNum - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        });
        data = sortedMonths.map(month => monthData[month] || 0);
        chartTitle = 'Consumo Mensal (Últimos 12 meses)';
        infoText = isSmart
            ? 'Consumo mensal acumulado. Variação indica padrão de uso.'
            : 'Dispositivo regular (sempre ligado). Variação mensal conforme dias do mês.';
    }
    
    // Atualizar info
    if (deviceChartInfo) {
        deviceChartInfo.textContent = infoText;
    }
    
    // Destruir gráfico anterior
    if (deviceChart) {
        deviceChart.destroy();
    }
    
    // Criar novo gráfico
    const ctx = document.getElementById('deviceChart');
    if (!ctx) return;
    
    // Determinar cor baseado se é smart ou regular
    const lineColor = isSmart ? '#eeea10' : '#00ff2a';
    const fillColor = isSmart ? 'rgba(238, 234, 16, 0.1)' : 'rgba(0, 255, 42, 0.1)';
    
    deviceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: chartTitle,
                data: data,
                backgroundColor: fillColor,
                borderColor: lineColor,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: lineColor,
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
                    titleColor: lineColor,
                    bodyColor: '#ffffff',
                    borderColor: '#333333',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const cost = value * energyPrice;
                            return [
                                `Consumo: ${value.toFixed(3)} kWh`,
                                `Custo: R$ ${cost.toFixed(2)}`
                            ];
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
                        color: '#9ca3af',
                        callback: function(value) {
                            return value.toFixed(2) + ' kWh';
                        }
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

function updateDeviceStats() {
    if (!selectedDevice || !allDevices[selectedDevice]) return;
    
    const device = allDevices[selectedDevice];
    const consumption = device.consumption || {};
    
    // Atualizar estatísticas
    if (deviceTotalConsumption) {
        deviceTotalConsumption.textContent = `${(consumption.totalKwh || 0).toFixed(2)} kWh`;
    }
    if (deviceTotalCost) {
        deviceTotalCost.textContent = `R$ ${(consumption.totalCost || 0).toFixed(2)}`;
    }
    if (deviceTotalTime) {
        deviceTotalTime.textContent = formatUptime(consumption.totalUptimeMs || 0);
    }
    if (devicePower) {
        devicePower.textContent = `${device.number || 0} W`;
    }
}

function handleDeviceSelection() {
    selectedDevice = deviceSelect.value;
    
    if (!selectedDevice) {
        // Nenhum dispositivo selecionado
        deviceStatsContainer.classList.add('hidden');
        deviceChartContainer.classList.add('hidden');
        devicePlaceholder.classList.remove('hidden');
        return;
    }
    
    // Mostrar seção
    devicePlaceholder.classList.add('hidden');
    deviceStatsContainer.classList.remove('hidden');
    deviceChartContainer.classList.remove('hidden');
    
    // Atualizar dados
    updateDeviceStats();
    updateDeviceChart();
}

function setDeviceViewMode(mode) {
    deviceViewMode = mode;
    
    // Atualizar botões
    [deviceViewHour, deviceViewDay, deviceViewMonth].forEach(btn => {
        if (btn) {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = 'var(--text-secondary)';
        }
    });
    
    const activeBtn = mode === 'hour' ? deviceViewHour : 
                      mode === 'day' ? deviceViewDay : 
                      deviceViewMonth;
    
    if (activeBtn) {
        activeBtn.style.backgroundColor = 'var(--accent-yellow)';
        activeBtn.style.color = '#000';
    }
    
    // Atualizar gráfico
    if (selectedDevice) {
        updateDeviceChart();
    }
}

// ========== FUNÇÕES DE IA - GEMINI ==========

async function generateAIAnalysis() {
    console.log('🔍 Iniciando análise com IA...');

    aiAnalysisContainer.classList.add('hidden');
    aiLoadingContainer.classList.remove('hidden');
    generateAIReportBtn.disabled = true;

    try {
        const analysisData = prepareDataForAI();
        const prompt = createAIPrompt(analysisData);
        
        // Usar a variável PROJECT_ID que você definiu no início do arquivo
        const functionUrl = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/generateAIReport`;
        
        console.log('📡 Chamando função:', functionUrl);
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt })
        });

        console.log('📥 Status da resposta:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(errorData.error || `HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.text) {
            throw new Error('Resposta inválida da IA');
        }
        
        console.log('✅ Análise gerada com sucesso!');
        displayAIAnalysis(data.text);
        
    } catch (error) {
        console.error('❌ Erro na análise com IA:', error);
        showAIError(error.message || 'Erro ao conectar com o servidor');
    } finally {
        aiLoadingContainer.classList.add('hidden');
        generateAIReportBtn.disabled = false;
    }
}

function prepareDataForAI() {
    const selectedPeriod = periodFilter.value;
    const days = selectedPeriod === 'all' ? 'all' : parseInt(selectedPeriod);
    const filteredDaily = getFilteredData(allStatistics.diario, days);
    const stats = calculateStatistics(filteredDaily);
    
    const hourlyData = allStatistics.horario || {};
    const hourlyValues = Object.values(hourlyData);
    const peakHour = Object.entries(hourlyData).reduce((max, [hour, value]) => 
        value > (max.value || 0) ? { hour: parseInt(hour), value } : max, 
        { hour: 0, value: 0 }
    );
    
    const monthlyData = allStatistics.mensal || {};
    const monthlyValues = Object.values(monthlyData);
    const monthlyAvg = monthlyValues.length > 0 
        ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length 
        : 0;
    
    const sortedDays = Object.keys(filteredDaily).sort();
    let trend = 'estável';
    if (sortedDays.length >= 14) {
        const recent7 = sortedDays.slice(-7).reduce((sum, day) => sum + filteredDaily[day], 0) / 7;
        const previous7 = sortedDays.slice(-14, -7).reduce((sum, day) => sum + filteredDaily[day], 0) / 7;
        const change = ((recent7 - previous7) / previous7) * 100;
        
        if (change > 10) trend = 'crescente';
        else if (change < -10) trend = 'decrescente';
    }
    
    // ========== NOVO: ANÁLISE DETALHADA POR DISPOSITIVO ==========
    const devicesAnalysis = [];
    let totalDevicesCost = 0;
    let smartDevicesCount = 0;
    let regularDevicesCount = 0;
    
    Object.entries(allDevices).forEach(([deviceId, device]) => {
        const isSmart = device.hasButton === 'yes';
        const consumption = device.consumption || {};
        const power = device.number || 0;
        const totalKwh = consumption.totalKwh || 0;
        const totalCost = consumption.totalCost || 0;
        const uptime = consumption.totalUptimeMs || 0;
        
        // Calcular consumo mensal estimado
        const hoursPerDay = isSmart 
            ? (uptime / (1000 * 60 * 60)) / 30 // Média de horas por dia
            : 24; // Dispositivo regular sempre ligado
        
        const monthlyKwh = (power * hoursPerDay * 30) / 1000;
        const monthlyCost = monthlyKwh * energyPrice;
        
        // Calcular percentual do consumo total
        const percentOfTotal = stats.total > 0 ? (totalKwh / stats.total) * 100 : 0;
        
        devicesAnalysis.push({
            nome: device.name,
            marca: device.brand || 'Não especificada',
            tipo: isSmart ? 'Inteligente' : 'Regular (24/7)',
            potencia: power,
            consumoTotal: totalKwh.toFixed(2),
            custoTotal: totalCost.toFixed(2),
            tempoUso: formatUptime(uptime),
            consumoMensalEstimado: monthlyKwh.toFixed(2),
            custoMensalEstimado: monthlyCost.toFixed(2),
            percentualDoTotal: percentOfTotal.toFixed(1),
            mediaHorasDia: hoursPerDay.toFixed(1)
        });
        
        totalDevicesCost += totalCost;
        
        if (isSmart) smartDevicesCount++;
        else regularDevicesCount++;
    });
    
    // Ordenar dispositivos por consumo (maior para menor)
    devicesAnalysis.sort((a, b) => parseFloat(b.consumoTotal) - parseFloat(a.consumoTotal));
    
    // Top 5 maiores consumidores
    const topConsumers = devicesAnalysis.slice(0, 5);
    
    return {
        // Dados gerais (já existiam)
        periodo: selectedPeriod === '7' ? '7 dias' : 
                 selectedPeriod === '30' ? '30 dias' : 
                 selectedPeriod === '90' ? '90 dias' : 
                 selectedPeriod === '365' ? '1 ano' : 'todos os registros',
        consumoTotal: stats.total.toFixed(2),
        custoTotal: (stats.total * energyPrice).toFixed(2),
        mediaDiaria: stats.average.toFixed(2),
        picoConsumo: stats.peak.value.toFixed(2),
        picoData: stats.peak.date,
        horaPico: peakHour.hour,
        consumoHoraPico: peakHour.value.toFixed(2),
        mediaHoraria: hourlyValues.length > 0 
            ? (hourlyValues.reduce((a, b) => a + b, 0) / hourlyValues.length).toFixed(2) 
            : '0',
        mediaMensal: monthlyAvg.toFixed(2),
        tendencia: trend,
        precokWh: energyPrice,
        
        // NOVOS dados de dispositivos
        totalDispositivos: devicesAnalysis.length,
        dispositivosInteligentes: smartDevicesCount,
        dispositivosRegulares: regularDevicesCount,
        topConsumidores: topConsumers,
        todosDispositivos: devicesAnalysis
    };
}

function createAIPrompt(data) {
    // Criar lista formatada dos top consumidores
    let topDevicesList = '';
    data.topConsumidores.forEach((device, index) => {
        topDevicesList += `
${index + 1}. ${device.nome} (${device.marca})
   - Tipo: ${device.tipo}
   - Potência: ${device.potencia}W
   - Consumo: ${device.consumoTotal} kWh (${device.percentualDoTotal}% do total)
   - Custo: R$ ${device.custoTotal}
   - Uso: ${device.mediaHorasDia}h/dia em média
   - Estimativa mensal: ${device.consumoMensalEstimado} kWh (R$ ${device.custoMensalEstimado})`;
    });
    
    return `Você é um especialista em eficiência energética residencial. Analise os dados detalhados e forneça um relatório PRÁTICO e ACIONÁVEL em português do Brasil.

=== DADOS GERAIS DO PERÍODO ===
- Período analisado: ${data.periodo}
- Consumo total: ${data.consumoTotal} kWh (R$ ${data.custoTotal})
- Média diária: ${data.mediaDiaria} kWh
- Pico de consumo: ${data.picoConsumo} kWh (${data.picoData})
- Hora crítica: ${data.horaPico}:00 (${data.consumoHoraPico} kWh)
- Tendência: ${data.tendencia}
- Tarifa: R$ ${data.precokWh}/kWh

=== DISPOSITIVOS CADASTRADOS ===
- Total: ${data.totalDispositivos} dispositivos
- Inteligentes: ${data.dispositivosInteligentes}
- Regulares (24/7): ${data.dispositivosRegulares}

=== TOP 5 MAIORES CONSUMIDORES ===
${topDevicesList}

=== INSTRUÇÕES PARA O RELATÓRIO ===

Forneça um relatório com NO MÁXIMO 1000 palavras contendo:

1. **DIAGNÓSTICO GERAL** (2-3 parágrafos)
   - Avalie o consumo total comparado com padrões residenciais brasileiros típicos
   - Identifique o principal problema (se houver)
   - Comente sobre a distribuição do consumo entre os dispositivos

2. **ANÁLISE DOS DISPOSITIVOS** (3-5 itens)
   - Analise os TOP consumidores individualmente
   - Identifique dispositivos com consumo suspeito ou excessivo
   - Verifique dispositivos regulares (24/7) que poderiam ser inteligentes
   - Compare consumo real vs esperado baseado na potência
   - Identifique oportunidades de troca por modelos mais eficientes

3. **AÇÕES PRIORITÁRIAS DE ECONOMIA** (liste 5 ações específicas)
   Para cada ação, forneça:
   - Dispositivo ou hábito específico
   - Ação recomendada (seja MUITO específico)
   - Economia estimada em kWh/mês e R$/mês
   - Dificuldade de implementação (baixa/média/alta)

4. **META E ECONOMIA ESPERADA**
   - Meta de redução percentual realista
   - Economia mensal em R$ se seguir as recomendações
   - Prazo para atingir a meta

REGRAS IMPORTANTES:
- Seja ESPECÍFICO: mencione dispositivos pelo nome
- Use dados REAIS dos dispositivos cadastrados
- Não invente dispositivos que não estão na lista
- Foque em ações PRÁTICAS e VIÁVEIS
- Use negrito APENAS para números importantes (kWh, R$, %)
- Máximo de 1000 palavras
- Se identificar dispositivo regular com alto consumo, sugira torná-lo inteligente

Formate com markdown simples (##, -, **apenas para números**).`;
}

function displayAIAnalysis(aiResponse) {
    let formattedHTML = aiResponse
        .replace(/\*\*(\d+[.,]?\d*\s*(?:kWh|R\$|%)?)\*\*/g, '<strong style="color: var(--accent-green); font-weight: 600;">$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/###\s(.*?)$/gm, '<h3 style="color: var(--text-primary); font-size: 1.1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem;">$1</h3>')
        .replace(/##\s(.*?)$/gm, '<h2 style="color: var(--accent-green); font-size: 1.35rem; font-weight: 600; margin-top: 1.75rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-dark);">$1</h2>')
        .replace(/^-\s(.*?)$/gm, '<li style="margin-left: 1.5rem; margin-bottom: 0.4rem; color: var(--text-primary); line-height: 1.5;">$1</li>')
        .replace(/^\d+\.\s(.*?)$/gm, '<li style="margin-left: 1.5rem; margin-bottom: 0.4rem; list-style-type: decimal; color: var(--text-primary); line-height: 1.5;">$1</li>')
        .replace(/\n\n/g, '</p><p style="margin-bottom: 1rem; line-height: 1.6; color: var(--text-secondary);">');
    
    if (!formattedHTML.startsWith('<h2>') && !formattedHTML.startsWith('<h3>')) {
        formattedHTML = '<p style="margin-bottom: 1rem; line-height: 1.6; color: var(--text-secondary);">' + formattedHTML + '</p>';
    }
    
    aiAnalysisContent.innerHTML = `
        <div class="space-y-3" style="color: var(--text-primary);">
            ${formattedHTML}
        </div>
        <div class="mt-6 p-3 rounded-lg" style="background-color: rgba(0, 255, 42, 0.08); border-left: 3px solid var(--accent-green);">
            <p style="color: var(--text-secondary); font-size: 0.875rem;">
                <i class="ph ph-info"></i> 
                Análise gerada por IA. Para alterações significativas, consulte um profissional qualificado.
            </p>
        </div>
    `;
    
    aiLoadingContainer.classList.add('hidden');
    aiAnalysisContainer.classList.remove('hidden');
    aiAnalysisContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showAIError(message) {
    aiLoadingContainer.classList.add('hidden');
    aiAnalysisContainer.classList.remove('hidden');
    aiAnalysisContent.innerHTML = `
        <div class="p-4 rounded-lg" style="background-color: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--accent-red);">
            <p style="color: var(--accent-red); font-weight: 600;">
                <i class="ph ph-warning"></i> Erro ao gerar análise
            </p>
            <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                ${message}
            </p>
        </div>
    `;
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
    
    const filteredDaily = getFilteredData(allStatistics.diario, days);
    const stats = calculateStatistics(filteredDaily);
    
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
    
    updateMonthlyChart();
    updateDailyChart(filteredDaily);
    updateHourlyChart();
    updateTrendChart(filteredDaily);
    updateTable(filteredDaily);
}

// ========== FUNÇÕES DE GRÁFICOS ==========

function updateMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

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
                legend: { display: false },
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
                    grid: { color: '#333333' },
                    ticks: { color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9ca3af' }
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
                legend: { display: false },
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
                    grid: { color: '#333333' },
                    ticks: { color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
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
                backgroundColor: data.map((value) => {
                    const max = Math.max(...data);
                    if (value === max && value > 0) return 'rgba(239, 68, 68, 0.6)';
                    if (value > max * 0.7) return 'rgba(238, 234, 16, 0.6)';
                    return 'rgba(0, 255, 42, 0.4)';
                }),
                borderColor: data.map((value) => {
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
                legend: { display: false },
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
                    grid: { color: '#333333' },
                    ticks: { color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
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
                    grid: { color: '#333333' },
                    ticks: { color: '#9ca3af' }
                },
                x: {
                    grid: { display: false },
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

    const sortedDays = Object.keys(dailyData).sort().reverse();
    
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
    
    let csv = 'Data,Consumo (kWh),Custo (R$),Média/Hora (kWh)\n';
    
    const sortedDays = Object.keys(filteredDaily).sort().reverse();
    sortedDays.forEach(day => {
        const consumption = filteredDaily[day];
        const cost = consumption * energyPrice;
        const avgPerHour = consumption / 24;
        const date = new Date(day);
        const formattedDate = formatDate(date);
        
        csv += `${formattedDate},${consumption.toFixed(2)},${cost.toFixed(2)},${avgPerHour.toFixed(3)}\n`;
    });
    
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

if (generateAIReportBtn) {
    generateAIReportBtn.addEventListener('click', generateAIAnalysis);
}

// Event listeners para análise por dispositivo
if (deviceSelect) {
    deviceSelect.addEventListener('change', handleDeviceSelection);
}

if (deviceViewHour) {
    deviceViewHour.addEventListener('click', () => setDeviceViewMode('hour'));
}

if (deviceViewDay) {
    deviceViewDay.addEventListener('click', () => setDeviceViewMode('day'));
}

if (deviceViewMonth) {
    deviceViewMonth.addEventListener('click', () => setDeviceViewMode('month'));
}

// ========== INICIALIZAÇÃO ==========

async function inicializarRelatorios() {
    try {
        await verificarAutenticacao();
        console.log('✅ Relatórios inicializados para usuário:', USER_ID);
        
        loadEnergyPrice();
        await loadStatistics();
        
        updateConnectionStatus('Conectado ao Firebase', true);
        
    } catch (error) {
        console.error('❌ Erro ao inicializar relatórios:', error);
        redirecionarParaLogin();
    }
}

document.addEventListener('DOMContentLoaded', inicializarRelatorios);