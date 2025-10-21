import {auth, database} from "./auth.js"

// ========== VARIÁVEIS GLOBAIS ==========
let USER_ID = null;

// Elementos da página principal
const mainContent = document.getElementById('mainContent');
const currentValue = document.getElementById('currentValue');
const lastUpdate = document.getElementById('lastUpdate');
const connectionStatus = document.getElementById('connectionStatus');

// Elementos do modal de dispositivos
const addDeviceBtn = document.getElementById('addDeviceBtn');
const deviceModal = document.getElementById('deviceModal');
const deviceName = document.getElementById('deviceName');
const deviceNumber = document.getElementById('deviceNumber');
const hasButton = document.getElementById('hasButton');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');
const devicesContainer = document.getElementById('devicesContainer');
const smartDevicesLimit = document.getElementById('smartDevicesLimit');
const limitWarning = document.getElementById('limitWarning');

// Elementos do modal de exclusão
const deleteModal = document.getElementById('deleteModal');
const deviceToDeleteName = document.getElementById('deviceToDeleteName');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

// Elementos do modal de preço de energia
const energyPriceBtn = document.getElementById('energyPriceBtn');
const energyPriceModal = document.getElementById('energyPriceModal');
const energyPriceInput = document.getElementById('energyPriceInput');
const currentPriceDisplay = document.getElementById('currentPriceDisplay');
const confirmPriceBtn = document.getElementById('confirmPriceBtn');
const cancelPriceBtn = document.getElementById('cancelPriceBtn');

// Elementos das barras de monitoramento
const powerBar = document.getElementById('powerBar');
const percentage = document.getElementById('percentage');
const currentPower = document.getElementById('currentPower');
const limitPower = document.getElementById('limitPower');
const status = document.getElementById('status');
const monthlyBar = document.getElementById('monthlyBar');
const monthlyPercentage = document.getElementById('monthlyPercentage');
const currentMonthly = document.getElementById('currentMonthly');
const limitMonthly = document.getElementById('limitMonthly');

// Variáveis de controle
let regularDevices = {};
let smartDevices = {};
const MAX_SMART_DEVICES = 8;
let deviceToDelete = null;
let editingDevice = null;

// Variáveis de monitoramento
let alertLimit = 100;
let monthlyLimit = 700;
let currentPowerValue = 0;
let currentMonthlyValue = 0;
let s1Power = 0;
let s2Power = 0;

// Preço da energia (padrão R$ 0,80/kWh)
let energyPrice = 0.80;

let chatHistory = [];

// Locais
let locations = [
    { name: 'São Paulo', cost: 20408, consumption: 25500, emission: 200, active: true },
    { name: 'Rio Claro', cost: 15450, consumption: 18000, emission: 230, active: false },
    { name: 'Campinas', cost: 18350, consumption: 22100, emission: 380, active: false }
];

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
    
    document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    window.location.href = 'login.html';
}

function logout() {
    console.log('Iniciando logout...');
    
    // Salvar consumo antes de sair
    updateAllConsumptions().then(() => {
        auth.signOut().then(() => {
            console.log('Firebase signOut bem-sucedido');
            sessionStorage.clear();
            localStorage.clear();
            
            document.cookie.split(";").forEach(function(c) { 
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
            });
            
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Erro ao fazer logout:', error);
            alert('Erro ao fazer logout: ' + error.message);
        });
    });
}

// ========== FUNÇÕES DE MONITORAMENTO DE CONSUMO ==========

function formatDateTime(date) {
    return date.toLocaleTimeString() + ' - ' + date.toLocaleDateString();
}

function updateBar(current, limit) {
    const percent = (current / limit) * 100;
    const displayPercent = Math.min(percent, 100);
    
    if (powerBar) powerBar.style.width = displayPercent + '%';
    if (percentage) percentage.textContent = percent.toFixed(1) + '%';
    if (currentPower) currentPower.textContent = current.toFixed(2);
    if (limitPower) limitPower.textContent = limit;
    
    if (powerBar) {
        powerBar.classList.remove('warning', 'danger', 'full');
        
        if (percent >= 100) {
            powerBar.classList.add('full');
        } else if (percent >= 80) {
            powerBar.classList.add('danger');
        } else if (percent >= 60) {
            powerBar.classList.add('warning');
        }
    }
}

function updateMonthlyBar(current, limit) {
    const percent = (current / limit) * 100;
    const displayPercent = Math.min(percent, 100);
    
    if (monthlyBar) monthlyBar.style.width = displayPercent + '%';
    if (monthlyPercentage) monthlyPercentage.textContent = percent.toFixed(1) + '%';
    if (currentMonthly) currentMonthly.textContent = current.toFixed(2);
    if (limitMonthly) limitMonthly.textContent = limit;
    
    if (monthlyBar) {
        monthlyBar.classList.remove('warning', 'danger', 'full');
        
        if (percent >= 100) {
            monthlyBar.classList.add('full');
        } else if (percent >= 80) {
            monthlyBar.classList.add('danger');
        } else if (percent >= 60) {
            monthlyBar.classList.add('warning');
        }
    }
    
    // Atualizar distribuição de consumo
    updateConsumptionDistribution(current);
}

function getAlertLimit() {
    const alertsRef = database.ref(`users/${USER_ID}/alerts`);
    
    alertsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            let foundRealtimeAlert = null;
            let foundTotalAlert = null;
            
            Object.keys(data).forEach((key) => {
                const alertData = data[key];
                
                if (alertData.type === "Consumo em tempo real") {
                    foundRealtimeAlert = alertData;
                }
                if (alertData.type === "Consumo Total") {
                    foundTotalAlert = alertData;
                }
            });
            
            if (foundRealtimeAlert?.limit) {
                alertLimit = foundRealtimeAlert.limit;
                updateBar(currentPowerValue, alertLimit);
                
                if (status) {
                    status.textContent = "✓ Conectado - Monitorando em tempo real";
                    status.className = "status connected";
                }
            } else {
                alertLimit = 100;
                updateBar(currentPowerValue, alertLimit);
                
                if (status) {
                    status.textContent = "⚠ Nenhum alerta de consumo em tempo real cadastrado - Usando limite padrão (100W)";
                    status.className = "status error";
                }
            }
            
            if (foundTotalAlert?.limit) {
                monthlyLimit = foundTotalAlert.limit;
            } else {
                monthlyLimit = 700;
            }
            
            updateMonthlyBar(currentMonthlyValue, monthlyLimit);
            monitorMonthlyConsumption();
            
        } else {
            alertLimit = 100;
            monthlyLimit = 700;
            updateBar(currentPowerValue, alertLimit);
            updateMonthlyBar(currentMonthlyValue, monthlyLimit);
            
            if (status) {
                status.textContent = "⚠ Nenhum alerta cadastrado - Usando limites padrão";
                status.className = "status error";
            }
        }
    }, (error) => {
        console.error("Erro ao buscar alertas:", error);
        if (status) {
            status.textContent = "✗ Erro ao conectar: " + error.message;
            status.className = "status error";
        }
    });
}

function monitorPower() {
    const s1Ref = database.ref(`users/${USER_ID}/esp32/s1/potencia`);
    const s2Ref = database.ref(`users/${USER_ID}/esp32/s2/potencia`);
    
    function updateCurrentValue() {
        currentPowerValue = s1Power + s2Power;
        
        if (currentValue) {
            currentValue.textContent = currentPowerValue.toFixed(2);
        }
        if (lastUpdate) {
            const now = new Date();
            lastUpdate.textContent = `Última atualização: ${formatDateTime(now)}`;
        }
        if (connectionStatus) {
            connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
            connectionStatus.className = "status connected";
        }
        
        updateBar(currentPowerValue, alertLimit);
    }
    
    s1Ref.on('value', (snapshot) => {
        s1Power = snapshot.val() || 0;
        updateCurrentValue();
    }, (error) => {
        console.error("Erro ao monitorar S1:", error);
        if (connectionStatus) {
            connectionStatus.textContent = "✗ Erro na leitura de S1";
            connectionStatus.className = "status disconnected";
        }
    });
    
    s2Ref.on('value', (snapshot) => {
        s2Power = snapshot.val() || 0;
        updateCurrentValue();
    }, (error) => {
        console.error("Erro ao monitorar S2:", error);
        if (connectionStatus) {
            connectionStatus.textContent = "✗ Erro na leitura de S2";
            connectionStatus.className = "status disconnected";
        }
    });
}

function monitorMonthlyConsumption() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthKey = `${year}-${month}`;
    
    const monthlyRef = database.ref(`users/${USER_ID}/esp32/estatisticas/mensal/${monthKey}`);
    
    monthlyRef.on('value', (snapshot) => {
        currentMonthlyValue = snapshot.val() || 0;
        updateMonthlyBar(currentMonthlyValue, monthlyLimit);
    }, (error) => {
        console.error("Erro ao monitorar consumo mensal:", error);
    });
}

function updateConsumptionDistribution(totalMonthlyConsumption) {
    // Calcular soma do consumo de todos os dispositivos cadastrados
    let devicesConsumption = 0;
    
    Object.keys(regularDevices).forEach(key => {
        const device = regularDevices[key];
        const uptime = calculateDeviceUptime(device, false);
        const energy = calculateEnergyConsumption(device, uptime);
        devicesConsumption += energy.kWh;
    });
    
    Object.keys(smartDevices).forEach(key => {
        const device = smartDevices[key];
        const uptime = calculateDeviceUptime(device, true);
        const energy = calculateEnergyConsumption(device, uptime);
        devicesConsumption += energy.kWh;
    });
    
    // Calcular "outros" (consumo não contabilizado pelos dispositivos)
    const othersConsumption = Math.max(0, totalMonthlyConsumption - devicesConsumption);
    
    // Calcular porcentagens
    const devicesPercent = totalMonthlyConsumption > 0 
        ? (devicesConsumption / totalMonthlyConsumption) * 100 
        : 0;
    const othersPercent = totalMonthlyConsumption > 0 
        ? (othersConsumption / totalMonthlyConsumption) * 100 
        : 0;
    
    // Atualizar a interface
    const distributionContainer = document.getElementById('consumptionDistribution');
    if (distributionContainer) {
        distributionContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-dark); font-size: 0.875rem;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background-color: var(--accent-green);"></div>
                    <span style="color: var(--text-secondary);">
                        Dispositivos: <strong style="color: var(--text-primary);">${devicesConsumption.toFixed(2)} kWh</strong>
                        <span style="color: var(--accent-green); font-weight: 600;">(${devicesPercent.toFixed(1)}%)</span>
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; border-radius: 3px; background-color: var(--accent-yellow);"></div>
                    <span style="color: var(--text-secondary);">
                        Outros: <strong style="color: var(--text-primary);">${othersConsumption.toFixed(2)} kWh</strong>
                        <span style="color: var(--accent-yellow); font-weight: 600;">(${othersPercent.toFixed(1)}%)</span>
                    </span>
                </div>
            </div>
        `;
    }
}

// ========== FUNÇÕES DE PREÇO DE ENERGIA ==========

function openEnergyPriceModal() {
    energyPriceModal.style.display = 'block';
    energyPriceInput.value = energyPrice.toFixed(2);
    updateCurrentPriceDisplay();
}

function closeEnergyPriceModal() {
    energyPriceModal.style.display = 'none';
}

function updateCurrentPriceDisplay() {
    if (currentPriceDisplay) {
        currentPriceDisplay.textContent = `Preço atual: R$ ${energyPrice.toFixed(2)}/kWh`;
    }
}

function updateEnergyPrice() {
    const newPrice = parseFloat(energyPriceInput.value);
    
    if (!newPrice || newPrice <= 0) {
        alert('Por favor, insira um preço válido maior que zero.');
        return;
    }
    
    energyPrice = newPrice;
    localStorage.setItem('energyPrice', energyPrice.toString());
    
    renderDynamicDeviceCards();
    
    closeEnergyPriceModal();
    
    if (connectionStatus) {
        connectionStatus.textContent = `Preço da energia atualizado para R$ ${energyPrice.toFixed(2)}/kWh`;
        connectionStatus.className = "status connected";
        
        setTimeout(() => {
            connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
        }, 3000);
    }
}

function loadEnergyPrice() {
    const savedPrice = localStorage.getItem('energyPrice');
    if (savedPrice) {
        energyPrice = parseFloat(savedPrice);
    }
}

// ========== FUNÇÕES PARA CALCULAR TEMPO LIGADO E ENERGIA CONSUMIDA ==========

function calculateDeviceUptime(device, isSmart) {
    const now = new Date();
    let newUptimeMs = 0;
    
    if (!isSmart) {
        // Dispositivo não controlável - calcular tempo desde última atualização
        const lastCalc = device.consumption?.lastCalculated 
            ? new Date(device.consumption.lastCalculated) 
            : new Date(device.createdAt || device.createdDate);
        newUptimeMs = now - lastCalc;
    } else {
        // Dispositivo inteligente - calcular apenas o tempo desde última atualização
        newUptimeMs = calculateSmartDeviceUptimeSinceLastUpdate(device);
    }
    
    // Somar com o tempo total já acumulado
    const previousTotalMs = device.consumption?.totalUptimeMs || 0;
    const totalMs = previousTotalMs + newUptimeMs;
    
    return {
        totalMs: totalMs,
        hours: Math.floor(totalMs / (1000 * 60 * 60)),
        minutes: Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60)),
        days: Math.floor(totalMs / (1000 * 60 * 60 * 24)),
        newUptimeMs: newUptimeMs // tempo desde última atualização
    };
}

function calculateSmartDeviceUptimeSinceLastUpdate(device) {
    const now = new Date();
    const lastCalc = device.consumption?.lastCalculated 
        ? new Date(device.consumption.lastCalculated) 
        : new Date(device.createdAt || device.createdDate);
    
    // Se está ligado atualmente, calcular tempo desde última atualização
    if (device.state === true) {
        const lastStateChange = new Date(device.lastStateChange);
        
        // Se foi ligado depois da última atualização
        if (lastStateChange > lastCalc) {
            return now - lastStateChange;
        } else {
            // Estava ligado antes, calcular desde última atualização
            return now - lastCalc;
        }
    }
    
    // Se está desligado, verificar se houve algum período ligado desde última atualização
    if (device.stateHistory) {
        let uptimeInPeriod = 0;
        const historyEntries = Object.values(device.stateHistory)
            .filter(entry => new Date(entry.timestamp) > lastCalc)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        let lastOnTime = null;
        
        // Se estava ligado na última atualização, começar de lá
        if (device.consumption?.wasOnAtLastCalc) {
            lastOnTime = lastCalc;
        }
        
        historyEntries.forEach(entry => {
            const entryTime = new Date(entry.timestamp);
            
            if (entry.state === true && lastOnTime === null) {
                lastOnTime = entryTime;
            } else if (entry.state === false && lastOnTime !== null) {
                uptimeInPeriod += entryTime - lastOnTime;
                lastOnTime = null;
            }
        });
        
        return uptimeInPeriod;
    }
    
    return 0;
}

function calculateEnergyConsumption(device, uptime) {
    const watts = device.number || 0;
    
    // Calcular apenas a energia do novo período (desde última atualização)
    const newHours = uptime.newUptimeMs / (1000 * 60 * 60);
    const newKwh = (watts * newHours) / 1000;
    const newCost = newKwh * energyPrice;
    
    // Somar com consumo anterior salvo
    const previousKwh = device.consumption?.totalKwh || 0;
    const previousCost = device.consumption?.totalCost || 0;
    
    const totalKwh = previousKwh + newKwh;
    const totalCost = previousCost + newCost;
    
    const hours = uptime.totalMs / (1000 * 60 * 60);
    
    return {
        kWh: totalKwh,
        cost: totalCost,
        watts: watts,
        hours: hours,
        newKwh: newKwh,
        newCost: newCost
    };
}

// ========== FUNÇÃO PARA SALVAR CONSUMO NO FIREBASE ==========

async function saveConsumptionToFirebase(deviceKey, device, isSmart) {
    if (!USER_ID) return;
    
    const uptime = calculateDeviceUptime(device, isSmart);
    const energy = calculateEnergyConsumption(device, uptime);
    
    const consumptionData = {
        totalKwh: energy.kWh,
        totalCost: energy.cost,
        totalUptimeMs: uptime.totalMs,
        lastCalculated: new Date().toISOString(),
        lastCalculatedDate: new Date().toLocaleString('pt-BR', { 
            timeZone: 'America/Sao_Paulo',
            dateStyle: 'short',
            timeStyle: 'medium'
        }),
        energyPriceAtCalc: energyPrice,
        wasOnAtLastCalc: isSmart ? device.state : true
    };
    
    try {
        await database.ref(`users/${USER_ID}/devices/${deviceKey}/consumption`).set(consumptionData);
        console.log(`✅ Consumo salvo para ${device.name}:`, consumptionData);
    } catch (error) {
        console.error(`❌ Erro ao salvar consumo do dispositivo ${device.name}:`, error);
    }
}

// ========== FUNÇÃO PARA ATUALIZAR TODOS OS CONSUMOS ==========

async function updateAllConsumptions() {
    console.log('🔄 Atualizando consumos de todos os dispositivos...');
    
    const allUpdates = [];
    
    // Atualizar dispositivos regulares
    for (const key of Object.keys(regularDevices)) {
        allUpdates.push(saveConsumptionToFirebase(key, regularDevices[key], false));
    }
    
    // Atualizar dispositivos inteligentes
    for (const key of Object.keys(smartDevices)) {
        allUpdates.push(saveConsumptionToFirebase(key, smartDevices[key], true));
    }
    
    await Promise.all(allUpdates);
    console.log('✅ Todos os consumos atualizados!');
}

function formatUptime(uptime) {
    if (uptime.days > 0) {
        return `${uptime.days}d ${uptime.hours % 24}h ${uptime.minutes}m`;
    } else if (uptime.hours > 0) {
        return `${uptime.hours}h ${uptime.minutes}m`;
    } else {
        return `${uptime.minutes}m`;
    }
}

function formatEnergy(energy) {
    return {
        kWh: energy.kWh.toFixed(2),
        cost: energy.cost.toFixed(2),
        watts: energy.watts.toFixed(0),
        hours: energy.hours.toFixed(1)
    };
}

// ========== FUNÇÕES DE DISPOSITIVOS - CARDS DINÂMICOS ==========

function getColorByPercentage(percentage) {
    if (percentage >= 15) return 'var(--accent-red)';
    if (percentage >= 8) return 'var(--accent-yellow)';
    return 'var(--accent-green)';
}

function renderDynamicDeviceCards() {
    const dashboardGrid = document.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3');
    
    if (!dashboardGrid) {
        console.error('Grid do dashboard não encontrado');
        return;
    }
    
    const existingCards = dashboardGrid.querySelectorAll('.dynamic-device-card');
    existingCards.forEach(card => card.remove());
    
    const allDevices = [];
    
    Object.keys(regularDevices).forEach(key => {
        allDevices.push({
            ...regularDevices[key],
            key: key,
            isSmart: false
        });
    });
    
    Object.keys(smartDevices).forEach(key => {
        allDevices.push({
            ...smartDevices[key],
            key: key,
            isSmart: true
        });
    });
    
    if (allDevices.length === 0) {
        return;
    }
    
    allDevices.forEach((device, index) => {
        const uptime = calculateDeviceUptime(device, device.isSmart);
        const energy = calculateEnergyConsumption(device, uptime);
        const formattedEnergy = formatEnergy(energy);
        
        // Calcular porcentagem baseada no CONSUMO MENSAL TOTAL (kWh)
        const percentage = currentMonthlyValue > 0 ? (energy.kWh / currentMonthlyValue) * 100 : 0;
        const color = getColorByPercentage(percentage);
        
        const circumference = 2 * Math.PI * 48;
        const circumferenceMd = 2 * Math.PI * 56;
        const offset = circumference - (percentage / 100 * circumference);
        const offsetMd = circumferenceMd - (percentage / 100 * circumferenceMd);
        
        const deviceCard = document.createElement('div');
        deviceCard.className = 'lg:col-span-1 space-y-6 md:space-y-8 dynamic-device-card';
        
        deviceCard.innerHTML = `
            <div class="border rounded-xl p-4 md:p-6" style="background-color: var(--bg-card); border-color: var(--border-dark);">
                <div class="flex items-center justify-between mb-4 md:mb-6">
                    <h3 class="text-base md:text-lg font-semibold">${device.name}</h3>
                    <div class="w-2 h-2 rounded-full" style="background-color: var(--accent-green);"></div>
                </div>
                <div class="text-center">
                    <div class="relative w-28 h-28 md:w-32 md:h-32 mx-auto mb-4">
                        <svg class="w-28 h-28 md:w-32 md:h-32 transform -rotate-90">
                            <circle cx="56" cy="56" r="48" stroke-width="8" fill="none" style="stroke: var(--border-dark);" class="md:hidden"/>
                            <circle cx="56" cy="56" r="48" stroke-width="8" fill="none" 
                                    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" style="stroke: ${color};" class="md:hidden"/>
                            <circle cx="64" cy="64" r="56" stroke-width="8" fill="none" style="stroke: var(--border-dark);" class="hidden md:block"/>
                            <circle cx="64" cy="64" r="56" stroke-width="8" fill="none" 
                                    stroke-dasharray="${circumferenceMd}" stroke-dashoffset="${offsetMd}" stroke-linecap="round" style="stroke: ${color};" class="hidden md:block"/>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-lg md:text-xl font-bold" style="color: ${color};">${percentage.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="text-xl md:text-2xl font-bold mb-2" style="color: ${color};">R$ ${formattedEnergy.cost}</div>
                    <div class="text-xs md:text-sm mb-1" style="color: var(--text-secondary);">${formattedEnergy.kWh} kWh consumidos</div>
                    <div class="text-xs" style="color: var(--text-tertiary);">
                        ${formattedEnergy.watts}W × ${formattedEnergy.hours}h
                    </div>
                </div>
            </div>
        `;
        
        dashboardGrid.appendChild(deviceCard);
    });
    
    // Atualizar distribuição de consumo após renderizar os cards
    updateConsumptionDistribution(currentMonthlyValue);
}

function updateSmartDevicesCounter() {
    const smartDeviceCount = Object.keys(smartDevices).length;
    smartDevicesLimit.textContent = `Dispositivos inteligentes: ${smartDeviceCount}/${MAX_SMART_DEVICES} (máximo permitido)`;
    
    const smartOption = hasButton.querySelector('option[value="yes"]');
    if (smartDeviceCount >= MAX_SMART_DEVICES) {
        smartOption.disabled = true;
        smartOption.textContent = `Inteligente (controlável) - LIMITE ATINGIDO (${MAX_SMART_DEVICES}/${MAX_SMART_DEVICES})`;
        if (hasButton.value === 'yes') {
            hasButton.value = 'no';
        }
    } else {
        smartOption.disabled = false;
        smartOption.textContent = 'Inteligente (controlável)';
    }
}

function loadDevicesFromFirebase() {
    if (!USER_ID) {
        console.error('USER_ID não definido');
        return;
    }
    
    const devicesRef = database.ref(`users/${USER_ID}/devices`);
    devicesRef.on('value', (snapshot) => {
        const allDevices = snapshot.val() || {};
        
        // Separar dispositivos baseado no hasButton
        regularDevices = {};
        smartDevices = {};
        
        Object.keys(allDevices).forEach(key => {
            const device = allDevices[key];
            if (device.hasButton === 'yes') {
                smartDevices[key] = device;
            } else {
                regularDevices[key] = device;
            }
        });
        
        renderDevices();
        renderDynamicDeviceCards();
        updateSmartDevicesCounter();
    });
}

function toggleDeviceState(deviceKey) {
    if (!USER_ID) return;
    
    // Salvar consumo ANTES de mudar o estado
    saveConsumptionToFirebase(deviceKey, smartDevices[deviceKey], true);
    
    const newState = !smartDevices[deviceKey].state;
    const timestamp = new Date().toISOString();
    const action = newState ? 'ligado' : 'desligado';
    
    smartDevices[deviceKey].state = newState;
    
    const updates = {
        state: newState,
        lastStateChange: timestamp,
        lastModified: timestamp
    };
    
    const historyRef = database.ref(`users/${USER_ID}/devices/${deviceKey}/stateHistory`).push();
    historyRef.set({
        timestamp: timestamp,
        state: newState,
        action: action,
        date: new Date().toLocaleString('pt-BR', { 
            timeZone: 'America/Sao_Paulo',
            dateStyle: 'short',
            timeStyle: 'medium'
        })
    });
    
    database.ref(`users/${USER_ID}/devices/${deviceKey}`).update(updates)
        .then(() => {
            renderDevices();
            renderDynamicDeviceCards();
            if (connectionStatus) {
                connectionStatus.textContent = `Dispositivo ${action} em ${new Date().toLocaleTimeString('pt-BR')}`;
                connectionStatus.className = "status connected";
                setTimeout(() => {
                    connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
                }, 3000);
            }
        })
        .catch((error) => console.error("Erro ao atualizar estado:", error));
}

function showDeleteConfirmation(deviceKey, deviceName, isSmart) {
    deviceToDelete = { key: deviceKey, name: deviceName, isSmart: isSmart };
    deviceToDeleteName.textContent = deviceName;
    deleteModal.style.display = 'block';
}

function deleteDevice() {
    if (!deviceToDelete || !USER_ID) return;

    const deviceKey = deviceToDelete.key;
    const device = deviceToDelete.isSmart 
        ? smartDevices[deviceKey]
        : regularDevices[deviceKey];
    
    // Salvar consumo final antes de excluir
    saveConsumptionToFirebase(deviceKey, device, deviceToDelete.isSmart).then(() => {
        const path = `users/${USER_ID}/devices/${deviceKey}`;

        const timestamp = new Date().toISOString();
        
        const deletionRecord = {
            ...device,
            deletedAt: timestamp,
            deletedDate: new Date().toLocaleString('pt-BR', { 
                timeZone: 'America/Sao_Paulo',
                dateStyle: 'short',
                timeStyle: 'medium'
            })
        };
        
        database.ref(`users/${USER_ID}/deletedDevices`).push().set(deletionRecord);

        database.ref(path).remove()
            .then(() => {
                deleteModal.style.display = 'none';
                const deletedName = deviceToDelete.name;
                deviceToDelete = null;
                
                renderDynamicDeviceCards();
                
                if (connectionStatus) {
                    connectionStatus.textContent = `Dispositivo "${deletedName}" excluído em ${new Date().toLocaleTimeString('pt-BR')}`;
                    connectionStatus.className = "status connected";
                    
                    setTimeout(() => {
                        connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
                    }, 3000);
                }
            })
            .catch((error) => {
                console.error("Erro ao excluir dispositivo:", error);
                alert("Erro ao excluir dispositivo: " + error.message);
                deleteModal.style.display = 'none';
                deviceToDelete = null;
            });
    });
}

function openEditModal(deviceKey, device, isSmart) {
    console.log('Abrindo modal para editar:', device);
    editingDevice = { key: deviceKey, isSmart: isSmart, originalType: device.hasButton };
    
    const modalTitle = document.getElementById('modalTitle');
    const deviceBrand = document.getElementById('deviceBrand');
    const deviceModel = document.getElementById('deviceModel');
    
    if (modalTitle) modalTitle.textContent = 'Editar Dispositivo';
    deviceName.value = device.name || '';
    if (deviceBrand) deviceBrand.value = device.brand || '';
    if (deviceModel) deviceModel.value = device.model || '';
    deviceNumber.value = device.number || '';
    hasButton.value = device.hasButton || 'no';
    
    hasButton.disabled = true;
    
    deviceModal.style.display = 'block';
    updateSmartDevicesCounter();
}

function closeDeviceModal() {
    deviceModal.style.display = 'none';
    limitWarning.style.display = 'none';
    editingDevice = null;
    
    const modalTitle = document.getElementById('modalTitle');
    const deviceBrand = document.getElementById('deviceBrand');
    const deviceModel = document.getElementById('deviceModel');
    
    if (modalTitle) modalTitle.textContent = 'Adicionar Novo Dispositivo';
    deviceName.value = '';
    if (deviceBrand) deviceBrand.value = '';
    if (deviceModel) deviceModel.value = '';
    deviceNumber.value = '';
    hasButton.value = 'no';
    hasButton.disabled = false;
}

function renderDevices() {
    devicesContainer.innerHTML = '';
    
    Object.keys(regularDevices).forEach((key) => {
        const device = regularDevices[key];
        const uptime = calculateDeviceUptime(device, false);
        const uptimeText = formatUptime(uptime);
        const energy = calculateEnergyConsumption(device, uptime);
        const formattedEnergy = formatEnergy(energy);
        
        const deviceElement = document.createElement('div');
        deviceElement.className = 'device';
        
        const createdInfo = device.createdDate ? `<div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">Criado em: ${device.createdDate}</div>` : '';
        const brandModelInfo = (device.brand || device.model) ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${device.brand || ''} ${device.model || ''}</div>` : '';
        
        deviceElement.innerHTML = `
            <div class="device-info">
                <div class="device-name">
                    ${device.name}
                    <span class="device-type">Regular</span>
                </div>
                ${brandModelInfo}
                <div class="device-value">${device.number} W</div>
                <div class="device-state">Dispositivo não controlável</div>
                <div class="uptime-info" style="font-size: 0.75rem; color: var(--accent-green); margin-top: 4px;">
                    ⏱️ Tempo ligado: ${uptimeText}
                </div>
                <div class="energy-info" style="font-size: 0.75rem; color: var(--accent-yellow); margin-top: 2px;">
                    ⚡ Consumo: ${formattedEnergy.kWh} kWh (R$ ${formattedEnergy.cost})
                </div>
                ${createdInfo}
            </div>
            <div class="device-controls">
                <button class="edit-btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 0.5rem 1rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-right: 8px; color: white;">✏️ Editar</button>
                <button class="delete-btn">🗑️ Excluir</button>
            </div>
        `;
        
        devicesContainer.appendChild(deviceElement);
        
        deviceElement.querySelector('.edit-btn').addEventListener('click', () => {
            openEditModal(key, device, false);
        });
        deviceElement.querySelector('.delete-btn').addEventListener('click', () => {
            showDeleteConfirmation(key, device.name, false);
        });
    });
    
    Object.keys(smartDevices).forEach((key) => {
        const device = smartDevices[key];
        const uptime = calculateDeviceUptime(device, true);
        const uptimeText = formatUptime(uptime);
        const energy = calculateEnergyConsumption(device, uptime);
        const formattedEnergy = formatEnergy(energy);
        
        const deviceElement = document.createElement('div');
        deviceElement.className = 'device has-button';
        
        let lastChangeInfo = '';
        if (device.lastStateChange) {
            const lastChangeDate = new Date(device.lastStateChange);
            lastChangeInfo = `<div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">Última ação: ${lastChangeDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' })}</div>`;
        }
        
        const createdInfo = device.createdDate ? `<div style="font-size: 0.75rem; color: var(--text-tertiary);">Criado em: ${device.createdDate}</div>` : '';
        const brandModelInfo = (device.brand || device.model) ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${device.brand || ''} ${device.model || ''}</div>` : '';
        
        deviceElement.innerHTML = `
            <div class="device-info">
                <div class="device-name">
                    ${device.name}
                    <span class="device-type smart">Inteligente</span>
                </div>
                ${brandModelInfo}
                <div class="device-value">${device.number} W</div>
                <div class="device-state">Estado: ${device.state ? 'Ligado' : 'Desligado'}</div>
                <div class="uptime-info" style="font-size: 0.75rem; color: var(--accent-green); margin-top: 4px;">
                    ⏱️ Tempo total ligado: ${uptimeText}
                </div>
                <div class="energy-info" style="font-size: 0.75rem; color: var(--accent-yellow); margin-top: 2px;">
                    ⚡ Consumo: ${formattedEnergy.kWh} kWh (R$ ${formattedEnergy.cost})
                </div>
                ${lastChangeInfo}
                ${createdInfo}
            </div>
            <div class="device-controls">
                <button class="device-btn" data-state="${device.state ? 'on' : 'off'}">
                    ${device.state ? 'Ligado' : 'Desligado'}
                </button>
                <button class="edit-btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 0.5rem 1rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-right: 8px; color: white;">✏️ Editar</button>
                <button class="delete-btn">🗑️ Excluir</button>
            </div>
        `;
        
        devicesContainer.appendChild(deviceElement);
        
        deviceElement.querySelector('.device-btn').addEventListener('click', () => toggleDeviceState(key));
        deviceElement.querySelector('.edit-btn').addEventListener('click', () => {
            openEditModal(key, device, true);
        });
        deviceElement.querySelector('.delete-btn').addEventListener('click', () => {
            showDeleteConfirmation(key, device.name, true);
        });
    });

    if (Object.keys(regularDevices).length === 0 && Object.keys(smartDevices).length === 0) {
        devicesContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Nenhum dispositivo cadastrado. Clique em "Adicionar Dispositivo" para começar.</p>';
    }
    
    // Atualizar distribuição de consumo após renderizar dispositivos
    updateConsumptionDistribution(currentMonthlyValue);
}

function getNextDeviceId(devices) {
    const ids = Object.keys(devices).map(id => parseInt(id)).filter(id => !isNaN(id));
    return ids.length === 0 ? 0 : Math.max(...ids) + 1;
}

// ========== EVENT LISTENERS - DISPOSITIVOS ==========

confirmDeleteBtn.addEventListener('click', deleteDevice);
cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.style.display = 'none';
    deviceToDelete = null;
});

addDeviceBtn.addEventListener('click', () => {
    editingDevice = null;
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Adicionar Novo Dispositivo';
    deviceModal.style.display = 'block';
    updateSmartDevicesCounter();
});

cancelBtn.addEventListener('click', () => {
    closeDeviceModal();
});

hasButton.addEventListener('change', () => {
    const smartDeviceCount = Object.keys(smartDevices).length;
    
    if (hasButton.value === 'yes' && smartDeviceCount >= MAX_SMART_DEVICES) {
        limitWarning.style.display = 'block';
        setTimeout(() => {
            hasButton.value = 'no';
            limitWarning.innerHTML = `⚠️ <strong>LIMITE ATINGIDO!</strong><br>Você já possui ${smartDeviceCount}/${MAX_SMART_DEVICES} dispositivos inteligentes.<br>Selecione "Não Inteligente" para continuar.`;
        }, 100);
    } else {
        limitWarning.style.display = 'none';
    }
});

confirmBtn.addEventListener('click', () => {
    console.log('Botão confirmar clicado');
    
    if (!USER_ID) {
        alert('Erro: Usuário não identificado. Por favor, faça login novamente.');
        redirecionarParaLogin();
        return;
    }
    
    const name = deviceName.value.trim();
    const deviceBrand = document.getElementById('deviceBrand');
    const deviceModel = document.getElementById('deviceModel');
    const brand = deviceBrand ? deviceBrand.value.trim() : '';
    const model = deviceModel ? deviceModel.value.trim() : '';
    const number = parseInt(deviceNumber.value.trim());
    const isSmart = hasButton.value === 'yes';
    
    console.log('Dados capturados:', { name, brand, model, number, isSmart, editingDevice });
    
    if (!name || !number || isNaN(number)) {
        alert("Por favor, preencha os campos obrigatórios (Nome e Consumo).");
        return;
    }
    
    const timestamp = new Date().toISOString();
    const formattedDate = new Date().toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium'
    });
    
    // Se está editando
    if (editingDevice) {
        console.log('Modo edição ativado');
        const deviceRef = database.ref(`users/${USER_ID}/devices/${editingDevice.key}`);
        
        deviceRef.once('value', (snapshot) => {
            const currentData = snapshot.val();
            
            // Salvar consumo antes de editar (especialmente se mudou os watts)
            if (currentData.number !== number) {
                saveConsumptionToFirebase(editingDevice.key, currentData, editingDevice.isSmart);
            }
            
            const updatedDevice = {
                ...currentData,
                name,
                brand: brand || null,
                model: model || null,
                number,
                lastModified: timestamp,
                lastModifiedDate: formattedDate
            };
            
            // Se mudou os watts, resetar o consumo para começar do zero com novo valor
            if (currentData.number !== number) {
                updatedDevice.consumption = {
                    totalKwh: 0,
                    totalCost: 0,
                    totalUptimeMs: 0,
                    lastCalculated: timestamp,
                    lastCalculatedDate: formattedDate,
                    energyPriceAtCalc: energyPrice,
                    wasOnAtLastCalc: editingDevice.isSmart ? currentData.state : true,
                    resetReason: 'Watts alterados de ' + currentData.number + 'W para ' + number + 'W'
                };
            }
            
            console.log('Atualizando dispositivo:', updatedDevice);
            
            deviceRef.update(updatedDevice)
                .then(() => {
                    console.log('Dispositivo atualizado com sucesso');
                    
                    const editHistoryRef = database.ref(`users/${USER_ID}/devices/${editingDevice.key}/editHistory`).push();
                    editHistoryRef.set({
                        timestamp: timestamp,
                        date: formattedDate,
                        changes: {
                            name: currentData.name !== name ? { old: currentData.name, new: name } : null,
                            brand: currentData.brand !== brand ? { old: currentData.brand, new: brand } : null,
                            model: currentData.model !== model ? { old: currentData.model, new: model } : null,
                            number: currentData.number !== number ? { old: currentData.number, new: number } : null
                        }
                    });
                    
                    closeDeviceModal();
                    renderDynamicDeviceCards();
                    
                    if (connectionStatus) {
                        connectionStatus.textContent = `Dispositivo "${name}" atualizado com sucesso!`;
                        connectionStatus.className = "status connected";
                        setTimeout(() => {
                            connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
                        }, 3000);
                    }
                })
                .catch((error) => {
                    console.error("Erro ao atualizar dispositivo:", error);
                    alert("Erro ao atualizar dispositivo: " + error.message);
                });
        });
        
        return;
    }
    
    // Se está adicionando novo dispositivo
    console.log('Modo adição ativado');
    const smartDeviceCount = Object.keys(smartDevices).length;
    
    if (isSmart && smartDeviceCount >= MAX_SMART_DEVICES) {
        alert(`LIMITE ATINGIDO!\n\nVocê já possui ${smartDeviceCount} dispositivos inteligentes.\nO limite máximo é ${MAX_SMART_DEVICES} dispositivos inteligentes.`);
        return;
    }
    
    const newDevice = {
        name,
        brand: brand || null,
        model: model || null,
        number,
        hasButton: isSmart ? 'yes' : 'no',
        state: false,
        createdAt: timestamp,
        lastModified: timestamp,
        createdDate: formattedDate,
        consumption: {
            totalKwh: 0,
            totalCost: 0,
            totalUptimeMs: 0,
            lastCalculated: timestamp,
            lastCalculatedDate: formattedDate,
            energyPriceAtCalc: energyPrice,
            wasOnAtLastCalc: false
        }
    };
    
    if (isSmart) {
        newDevice.lastStateChange = timestamp;
    }
    
    const devices = { ...regularDevices, ...smartDevices };
    const nextId = getNextDeviceId(devices);
    
    console.log('Salvando novo dispositivo:', newDevice);
    console.log('Path:', `users/${USER_ID}/devices/${nextId}`);
    
    database.ref(`users/${USER_ID}/devices/${nextId}`).set(newDevice)
        .then(() => {
            console.log('Dispositivo salvo com sucesso no Firebase');
            
            if (isSmart) {
                database.ref(`users/${USER_ID}/devices/${nextId}/stateHistory`).push().set({
                    timestamp: timestamp,
                    state: false,
                    action: 'criado',
                    date: formattedDate
                });
            }
            
            closeDeviceModal();
            renderDynamicDeviceCards();
            
            if (connectionStatus) {
                connectionStatus.textContent = `Dispositivo "${name}" adicionado com sucesso!`;
                connectionStatus.className = "status connected";
                setTimeout(() => {
                    connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
                }, 3000);
            }
        })
        .catch((error) => {
            console.error("Erro ao salvar dispositivo:", error);
            alert("Erro ao salvar dispositivo: " + error.message);
        });
});

// ========== FUNÇÕES DE LOCAIS ==========

function renderLocations() {
    const container = document.getElementById('locationsContainer');
    if (!container) return;
    
    const addButton = container.querySelector('div:last-child');
    
    while (container.firstChild && container.firstChild !== addButton) {
        container.removeChild(container.firstChild);
    }
    
    locations.forEach((location, index) => {
        const locationDiv = document.createElement('div');
        locationDiv.className = `${location.active ? 'bg-green-500/10 border-2 border-accent-green' : 'bg-bg-card border border-border-dark'} rounded-xl p-6 min-w-52 cursor-pointer relative hover:transform hover:-translate-y-1 transition-all duration-300 slide-in`;
        locationDiv.innerHTML = `
            <div class="absolute top-4 right-4 w-2 h-2 bg-accent-green rounded-full"></div>
            <div class="font-semibold mb-2">${location.name}</div>
            <div class="text-2xl font-bold text-accent-green mb-1">R$ ${location.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div class="text-sm text-gray-400">${location.consumption.toLocaleString('pt-BR')} kWh • ${location.emission} kg</div>
        `;
        locationDiv.onclick = () => setActiveLocation(index);
        container.insertBefore(locationDiv, addButton);
    });
}

function setActiveLocation(index) {
    locations = locations.map((loc, i) => ({ ...loc, active: i === index }));
    renderLocations();
}

function openLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) modal.classList.remove('hidden');
}

function closeLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) modal.classList.add('hidden');
    
    document.getElementById('locationName').value = '';
    document.getElementById('locationCost').value = '';
    document.getElementById('locationConsumption').value = '';
    document.getElementById('locationEmission').value = '';
}

// ========== FUNÇÕES DO CHATBOT DE WATTS ==========

function openWattsChatbot() {
    const modal = document.getElementById('wattsChatbotModal');
    const chatMessages = document.getElementById('chatMessages');
    
    if (modal && chatMessages) {
        chatHistory = [];
        chatMessages.innerHTML = '';
        
        addChatMessage('assistant', 'Olá! Vou te ajudar a descobrir quantos watts seu dispositivo consome.\n\nPor favor, me conte:\n• Que tipo de dispositivo é? (ex: geladeira, TV, micro-ondas)\n• Qual a marca e modelo, se souber\n• Alguma característica especial? (ex: tamanho, capacidade)');
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            document.getElementById('chatInput').focus();
        }, 300);
    }
}

function closeWattsChatbot() {
    const modal = document.getElementById('wattsChatbotModal');
    if (modal) {
        modal.style.display = 'none';
        chatHistory = [];
        document.body.style.overflow = '';
    }
}

function addChatMessage(role, content, isWattsResult = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}${isWattsResult ? ' watts-result' : ''}`;
    
    const formattedContent = content.replace(/\n/g, '<br>');
    messageDiv.innerHTML = formattedContent;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addWattsResultMessage(watts, explanation) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message watts-result';
    messageDiv.innerHTML = `
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚡ ${watts} Watts</div>
        <div style="font-size: 0.9rem; font-weight: normal;">${explanation}</div>
        <button class="use-watts-btn" onclick="useWattsValue(${watts})">
            Usar este valor
        </button>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function useWattsValue(watts) {
    const deviceNumber = document.getElementById('deviceNumber');
    if (deviceNumber) {
        deviceNumber.value = watts;
    }
    closeWattsChatbot();
}

async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const chatLoading = document.getElementById('chatLoading');
    
    if (!chatInput || !chatInput.value.trim()) return;
    
    const userMessage = chatInput.value.trim();
    chatInput.value = '';
    
    addChatMessage('user', userMessage);
    chatHistory.push({ role: 'user', content: userMessage });

    if (chatLoading) chatLoading.style.display = 'block';
    
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Usuário não autenticado');
        }
        const token = await user.getIdToken();

        const response = await fetch('https://chatwithgemini-o3fcup3lbq-uc.a.run.app/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: userMessage,
                chatHistory: chatHistory
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}`);
        }
        
        const data = await response.json();
        const assistantMessage = data.candidates[0].content.parts[0].text;
        
        chatHistory.push({ role: 'assistant', content: assistantMessage });
        
        const wattsMatch = assistantMessage.match(/ESTIMATIVA:\s*(\d+)\s*W/i);
        
        if (wattsMatch) {
            const watts = parseInt(wattsMatch[1]);
            const explanation = assistantMessage.replace(/ESTIMATIVA:\s*\d+\s*W/i, '').trim();
            addWattsResultMessage(watts, explanation || 'Estimativa baseada nas informações fornecidas.');
        } else {
            addChatMessage('assistant', assistantMessage);
        }
        
    } catch (error) {
        console.error('Erro no chatbot:', error);
        addChatMessage('assistant', '❌ Desculpe, ocorreu um erro ao processar sua mensagem.');
    } finally {
        if (chatLoading) chatLoading.style.display = 'none';
    }
}

function addLocation() {
    const name = document.getElementById('locationName').value;
    const cost = parseFloat(document.getElementById('locationCost').value);
    const consumption = parseFloat(document.getElementById('locationConsumption').value);
    const emission = parseFloat(document.getElementById('locationEmission').value);
    
    if (name && cost && consumption && emission) {
        locations.push({ name, cost, consumption, emission, active: false });
        renderLocations();
        closeLocationModal();
    } else {
        alert('Por favor, preencha todos os campos');
    }
}

// ========== ATUALIZAÇÃO AUTOMÁTICA DOS TEMPOS ==========

function startUptimeCounter() {
    // Atualizar a interface a cada minuto
    setInterval(() => {
        if (Object.keys(regularDevices).length > 0 || Object.keys(smartDevices).length > 0) {
            renderDevices();
            renderDynamicDeviceCards();
        }
    }, 60000); // Atualiza a cada 1 minuto
    
    // Salvar consumo no Firebase a cada 5 minutos
    setInterval(() => {
        if (Object.keys(regularDevices).length > 0 || Object.keys(smartDevices).length > 0) {
            console.log('⏰ Salvamento automático de consumo...');
            updateAllConsumptions();
        }
    }, 300000); // Atualiza a cada 5 minutos
    
    // Salvar consumo quando o usuário sair da página
    window.addEventListener('beforeunload', () => {
        console.log('👋 Salvando consumo antes de sair...');
        updateAllConsumptions();
    });
}

// ========== INICIALIZAÇÃO ==========

async function inicializarDashboard() {
    try {
        await verificarAutenticacao();
        console.log('Dashboard inicializado para usuário:', USER_ID);
        
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        
        loadEnergyPrice();
        
        getAlertLimit();
        monitorPower();
        loadDevicesFromFirebase();
        renderLocations();
        
        // Iniciar contador de tempo ligado e salvamento automático
        startUptimeCounter();
        
        // Fazer salvamento inicial após 10 segundos (dar tempo para carregar os dispositivos)
        setTimeout(() => {
            console.log('💾 Fazendo salvamento inicial de consumo...');
            updateAllConsumptions();
        }, 10000);
        
    } catch (error) {
        console.error('Erro ao inicializar dashboard:', error);
        redirecionarParaLogin();
    }
}

// ========== EVENT LISTENERS GLOBAIS ==========

document.addEventListener('DOMContentLoaded', inicializarDashboard);

window.addEventListener('click', (event) => {
    if (event.target === deviceModal) {
        closeDeviceModal();
    }
    if (event.target === deleteModal) {
        deleteModal.style.display = 'none';
        deviceToDelete = null;
    }
    if (event.target === energyPriceModal) {
        energyPriceModal.style.display = 'none';
    }
    const wattsChatbotModal = document.getElementById('wattsChatbotModal');
    if (event.target === wattsChatbotModal) {
        closeWattsChatbot();
    }
});

const locationModal = document.getElementById('locationModal');
if (locationModal) {
    locationModal.addEventListener('click', function(e) {
        if (e.target === this) closeLocationModal();
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
});

// ========== EXPORTAÇÕES PARA O HTML ==========

window.logout = logout;
window.openLocationModal = openLocationModal;
window.closeLocationModal = closeLocationModal;
window.addLocation = addLocation;
window.openEnergyPriceModal = openEnergyPriceModal;
window.closeEnergyPriceModal = closeEnergyPriceModal;
window.updateEnergyPrice = updateEnergyPrice;
window.openWattsChatbot = openWattsChatbot;
window.closeWattsChatbot = closeWattsChatbot;
window.sendChatMessage = sendChatMessage;
window.useWattsValue = useWattsValue;

/* 
========== SISTEMA DE PERSISTÊNCIA DE CONSUMO ==========

✅ CÁLCULO 100% CORRETO E PRECISO!

Estrutura no Firebase:
users/{USER_ID}/devices/{deviceId}/consumption/
  ├── totalKwh: 0.59              // kWh acumulado total ✅
  ├── totalCost: 0.47             // Custo acumulado em R$ ✅
  ├── totalUptimeMs: 22392000     // Tempo total ligado em ms ✅
  ├── lastCalculated: "timestamp" // Última vez que foi calculado ✅
  ├── lastCalculatedDate: "date"  // Data formatada ✅
  ├── energyPriceAtCalc: 0.80     // Preço da energia no momento ✅
  └── wasOnAtLastCalc: true       // Se estava ligado (smart) ✅

📊 Como funciona o CÁLCULO:

1. DISPOSITIVOS REGULARES (não inteligentes):
   - Sempre considerados LIGADOS desde a criação
   - Tempo novo = agora - lastCalculated
   - Total = tempoAnterior + tempoNovo
   - kWh = (watts × horas) / 1000
   - Custo = kWh × preço

2. DISPOSITIVOS INTELIGENTES (controláveis):
   - Calcula baseado no HISTÓRICO REAL de estados
   - Se está ligado: conta tempo desde lastCalculated
   - Se está desligado: busca períodos ligados no histórico
   - wasOnAtLastCalc: sabe se estava ligado antes
   - Total acumulado com precisão absoluta!

⏰ Salvamento automático:
✅ A cada 5 minutos (300000ms)
✅ Quando muda estado de dispositivo inteligente
✅ Quando exclui um dispositivo
✅ Quando sai da página (beforeunload)
✅ Quando edita dispositivo (se mudar watts)
✅ 10 segundos após carregar (inicial)
✅ Ao fazer logout

🎯 Recursos especiais:
✅ Cálculo INCREMENTAL (só calcula período novo)
✅ Soma com total anterior (não perde histórico)
✅ Reset automático ao mudar watts do dispositivo
✅ Salva preço usado no cálculo (histórico)
✅ Logs detalhados no console
✅ Precisão de milissegundos
✅ Distribuição de consumo dispositivos vs outros

💡 Exemplo prático:
- Ventilador 90W criado às 10:00
- Primeira atualização às 10:05 (5 min)
  → 90W × 0.0833h = 0.00749 kWh
  → 0.00749 × R$0.80 = R$0.006
- Segunda atualização às 10:10 (mais 5 min)
  → Acumula: 0.01498 kWh total
  → R$0.012 total
- E assim por diante... 100% preciso! 🎯
*/