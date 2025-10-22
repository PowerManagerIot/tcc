import {auth, database} from "./auth.js"

let USER_ID = null;

const mainContent = document.getElementById('mainContent');
const currentValue = document.getElementById('currentValue');
const lastUpdate = document.getElementById('lastUpdate');
const connectionStatus = document.getElementById('connectionStatus');

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

const deleteModal = document.getElementById('deleteModal');
const deviceToDeleteName = document.getElementById('deviceToDeleteName');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

const energyPriceBtn = document.getElementById('energyPriceBtn');
const energyPriceModal = document.getElementById('energyPriceModal');
const energyPriceInput = document.getElementById('energyPriceInput');
const currentPriceDisplay = document.getElementById('currentPriceDisplay');
const confirmPriceBtn = document.getElementById('confirmPriceBtn');
const cancelPriceBtn = document.getElementById('cancelPriceBtn');

const powerBar = document.getElementById('powerBar');
const percentage = document.getElementById('percentage');
const currentPower = document.getElementById('currentPower');
const limitPower = document.getElementById('limitPower');
const status = document.getElementById('status');
const monthlyBar = document.getElementById('monthlyBar');
const monthlyPercentage = document.getElementById('monthlyPercentage');
const currentMonthly = document.getElementById('currentMonthly');
const limitMonthly = document.getElementById('limitMonthly');

let regularDevices = {};
let smartDevices = {};
const MAX_SMART_DEVICES = 8;
let deviceToDelete = null;
let editingDevice = null;

let alertLimit = 100;
let monthlyLimit = 700;
let currentPowerValue = 0;
let currentMonthlyValue = 0;
let s1Power = 0;
let s2Power = 0;

let energyPrice = 0.80;
let chatHistory = [];

let locations = [
    { name: 'São Paulo', cost: 20408, consumption: 25500, emission: 200, active: true },
    { name: 'Rio Claro', cost: 15450, consumption: 18000, emission: 230, active: false },
    { name: 'Campinas', cost: 18350, consumption: 22100, emission: 380, active: false }
];

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

async function loadEnergyPrice() {
    try {
        const snapshot = await database.ref(`users/${USER_ID}/settings/energyPrice`).once('value');
        const savedPrice = snapshot.val();
        
        if (savedPrice !== null) {
            energyPrice = parseFloat(savedPrice);
            console.log('Preço carregado do Firebase:', energyPrice);
        } else {
            const localPrice = localStorage.getItem('energyPrice');
            if (localPrice) {
                energyPrice = parseFloat(localPrice);
                await database.ref(`users/${USER_ID}/settings/energyPrice`).set(energyPrice);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar preço do Firebase:', error);
        const localPrice = localStorage.getItem('energyPrice');
        if (localPrice) {
            energyPrice = parseFloat(localPrice);
        }
    }
    
    updateCurrentPriceDisplay();
}

function monitorEnergyPriceChanges() {
    if (!USER_ID) return;
    
    database.ref(`users/${USER_ID}/settings/energyPrice`).on('value', (snapshot) => {
        const newPrice = snapshot.val();
        if (newPrice !== null && newPrice !== energyPrice) {
            console.log('Preço da energia atualizado em tempo real:', newPrice);
            energyPrice = parseFloat(newPrice);
            
            recalculateAllConsumptions().then(() => {
                renderDevices();
                renderDynamicDeviceCards();
                updateCurrentPriceDisplay();
                
                const statsRef = database.ref(`users/${USER_ID}/esp32/estatisticas`);
                statsRef.once('value', (snapshot) => {
                    const statsData = snapshot.val();
                    if (statsData) {
                        updateMonthlyCard(statsData);
                        updateWeeklyCard(statsData);
                        updateDailyCard(statsData);
                    }
                });
            });
        }
    });
}

async function recalculateAllConsumptions() {
    console.log('Recalculando consumos com novo preço...');
    
    const allUpdates = [];
    const now = new Date().toISOString();
    
    for (const key of Object.keys(regularDevices)) {
        const device = regularDevices[key];
        if (device.consumption) {
            const newCost = device.consumption.totalKwh * energyPrice;
            
            const updates = {
                'consumption/totalCost': newCost,
                'consumption/energyPriceAtCalc': energyPrice,
                'consumption/lastCalculated': now
            };
            
            allUpdates.push(
                database.ref(`users/${USER_ID}/devices/${key}`).update(updates)
            );
        }
    }
    
    for (const key of Object.keys(smartDevices)) {
        const device = smartDevices[key];
        if (device.consumption) {
            const newCost = device.consumption.totalKwh * energyPrice;
            
            const updates = {
                'consumption/totalCost': newCost,
                'consumption/energyPriceAtCalc': energyPrice,
                'consumption/lastCalculated': now
            };
            
            allUpdates.push(
                database.ref(`users/${USER_ID}/devices/${key}`).update(updates)
            );
        }
    }
    
    await Promise.all(allUpdates);
    console.log('Todos os consumos recalculados com novo preço!');
}

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
        currentPriceDisplay.textContent = `Preço atual: R$ ${energyPrice.toFixed(2).replace('.', ',')}/kWh`;
    }
    
    if (energyPriceInput) {
        energyPriceInput.placeholder = `Ex: ${energyPrice.toFixed(2)}`;
    }
}

async function updateEnergyPrice() {
    const newPrice = parseFloat(energyPriceInput.value);
    
    if (!newPrice || newPrice <= 0) {
        alert('Por favor, insira um preço válido maior que zero.');
        return;
    }
    
    energyPrice = newPrice;
    
    try {
        await database.ref(`users/${USER_ID}/settings/energyPrice`).set(energyPrice);
        console.log('Preço da energia salvo no Firebase:', energyPrice);
    } catch (error) {
        console.error('Erro ao salvar preço no Firebase:', error);
        localStorage.setItem('energyPrice', energyPrice.toString());
    }
    
    await recalculateAllConsumptions();
    
    renderDevices();
    renderDynamicDeviceCards();
    
    closeEnergyPriceModal();
    
    if (connectionStatus) {
        connectionStatus.textContent = `Preço da energia atualizado para R$ ${energyPrice.toFixed(2).replace('.', ',')}/kWh`;
        connectionStatus.className = "status connected";
        
        setTimeout(() => {
            connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
        }, 3000);
    }
}

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
    
    const othersConsumption = Math.max(0, totalMonthlyConsumption - devicesConsumption);
    
    const devicesPercent = totalMonthlyConsumption > 0 
        ? (devicesConsumption / totalMonthlyConsumption) * 100 
        : 0;
    const othersPercent = totalMonthlyConsumption > 0 
        ? (othersConsumption / totalMonthlyConsumption) * 100 
        : 0;
    
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

function calculateDeviceUptime(device, isSmart) {
    const now = new Date();
    let newUptimeMs = 0;
    
    if (!isSmart) {
        const lastCalc = device.consumption?.lastCalculated 
            ? new Date(device.consumption.lastCalculated) 
            : new Date(device.createdAt || device.createdDate);
        newUptimeMs = now - lastCalc;
    } else {
        newUptimeMs = calculateSmartDeviceUptimeSinceLastUpdate(device);
    }
    
    const previousTotalMs = device.consumption?.totalUptimeMs || 0;
    const totalMs = previousTotalMs + newUptimeMs;
    
    return {
        totalMs: totalMs,
        hours: Math.floor(totalMs / (1000 * 60 * 60)),
        minutes: Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60)),
        days: Math.floor(totalMs / (1000 * 60 * 60 * 24)),
        newUptimeMs: newUptimeMs
    };
}

function calculateSmartDeviceUptimeSinceLastUpdate(device) {
    const now = new Date();
    const lastCalc = device.consumption?.lastCalculated 
        ? new Date(device.consumption.lastCalculated) 
        : new Date(device.createdAt || device.createdDate);
    
    if (device.state === true) {
        const lastStateChange = new Date(device.lastStateChange);
        
        if (lastStateChange > lastCalc) {
            return now - lastStateChange;
        } else {
            return now - lastCalc;
        }
    }
    
    if (device.stateHistory) {
        let uptimeInPeriod = 0;
        const historyEntries = Object.values(device.stateHistory)
            .filter(entry => new Date(entry.timestamp) > lastCalc)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        let lastOnTime = null;
        
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
    
    // CORREÇÃO: Calcular o consumo total baseado no tempo total de uso
    // Em vez de usar newUptimeMs (incremental), agora usa totalMs (total)
    const totalHours = uptime.totalMs / (1000 * 60 * 60);
    const totalKwh = (watts * totalHours) / 1000;
    const totalCost = totalKwh * energyPrice;
    
    return {
        kWh: totalKwh,
        cost: totalCost,
        watts: watts,
        hours: totalHours
    };
}

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
        console.log(`Consumo salvo para ${device.name}:`, consumptionData);
    } catch (error) {
        console.error(`Erro ao salvar consumo do dispositivo ${device.name}:`, error);
    }
}

async function updateAllConsumptions() {
    console.log('Atualizando consumos de todos os dispositivos...');
    
    const allUpdates = [];
    
    for (const key of Object.keys(regularDevices)) {
        allUpdates.push(saveConsumptionToFirebase(key, regularDevices[key], false));
    }
    
    for (const key of Object.keys(smartDevices)) {
        allUpdates.push(saveConsumptionToFirebase(key, smartDevices[key], true));
    }
    
    await Promise.all(allUpdates);
    console.log('Todos os consumos atualizados!');
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
        updateActiveDevicesCount();
    });
}

function toggleDeviceState(deviceKey) {
    if (!USER_ID) return;
    
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
                    Tempo ligado: ${uptimeText}
                </div>
                <div class="energy-info" style="font-size: 0.75rem; color: var(--accent-yellow); margin-top: 2px;">
                    Consumo: ${formattedEnergy.kWh} kWh (R$ ${formattedEnergy.cost})
                </div>
                ${createdInfo}
            </div>
            <div class="device-controls">
                <button class="edit-btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 0.5rem 1rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-right: 8px; color: white;">Editar</button>
                <button class="delete-btn">Excluir</button>
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
                    Tempo total ligado: ${uptimeText}
                </div>
                <div class="energy-info" style="font-size: 0.75rem; color: var(--accent-yellow); margin-top: 2px;">
                    Consumo: ${formattedEnergy.kWh} kWh (R$ ${formattedEnergy.cost})
                </div>
                ${lastChangeInfo}
                ${createdInfo}
            </div>
            <div class="device-controls">
                <button class="device-btn" data-state="${device.state ? 'on' : 'off'}">
                    ${device.state ? 'Ligado' : 'Desligado'}
                </button>
                <button class="edit-btn" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 0.5rem 1rem; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-right: 8px; color: white;">Editar</button>
                <button class="delete-btn">Excluir</button>
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
    
    updateConsumptionDistribution(currentMonthlyValue);
}

function getNextDeviceId(devices) {
    const ids = Object.keys(devices).map(id => parseInt(id)).filter(id => !isNaN(id));
    return ids.length === 0 ? 0 : Math.max(...ids) + 1;
}

async function loadStatisticsData() {
    if (!USER_ID) return;
    
    try {
        const statsRef = database.ref(`users/${USER_ID}/esp32/estatisticas`);
        
        statsRef.on('value', (snapshot) => {
            const statsData = snapshot.val();
            
            if (statsData) {
                updateStatisticsCards(statsData);
            } else {
                console.log('Nenhum dado de estatísticas encontrado');
                setDefaultStatistics();
            }
        }, (error) => {
            console.error('Erro ao carregar estatísticas:', error);
            setDefaultStatistics();
        });
        
        monitorBigCardsRealtime();
        
    } catch (error) {
        console.error('Erro no carregamento de estatísticas:', error);
        setDefaultStatistics();
    }
}

function monitorBigCardsRealtime() {
    if (!USER_ID) return;
    
    const monthlyRef = database.ref(`users/${USER_ID}/esp32/estatisticas/mensal`);
    monthlyRef.on('value', (snapshot) => {
        const monthlyData = snapshot.val();
        if (monthlyData) {
            updateMonthlyCard({ mensal: monthlyData });
        }
    });
    
    const dailyRef = database.ref(`users/${USER_ID}/esp32/estatisticas/diario`);
    dailyRef.on('value', (snapshot) => {
        const dailyData = snapshot.val();
        if (dailyData) {
            updateWeeklyCard({ diario: dailyData });
            updateDailyCard({ diario: dailyData });
        }
    });
}

function updateStatisticsCards(statsData) {
    updateMonthlyCard(statsData);
    updateWeeklyCard(statsData);
    updateDailyCard(statsData);
    updateMonthlyCostAverage(statsData);
    updateDailyCostAverage(statsData);
    updateCurrentPower();
    updateActiveDevicesCount();
}

function updateMonthlyCard(statsData) {
    const monthlyCardElements = document.querySelectorAll('.border.rounded-xl.p-4.md\\:p-6 .text-center');
    
    if (monthlyCardElements.length >= 1) {
        const cardElement = monthlyCardElements[0].closest('.border.rounded-xl');
        
        try {
            if (statsData.mensal) {
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                
                // CORREÇÃO: Pegar o valor correto do Firebase
                const monthlyConsumption = statsData.mensal[monthKey] || 0;
                const monthlyCost = monthlyConsumption * energyPrice;
                
                // LOG para debug
                console.log('📊 Card Mensal:', {
                    monthKey,
                    monthlyConsumption,
                    energyPrice,
                    monthlyCost,
                    rawData: statsData.mensal[monthKey]
                });
                
                const monthlyLimitKwh = monthlyLimit || 700;
                const percentage = monthlyLimitKwh > 0 ? (monthlyConsumption / monthlyLimitKwh) * 100 : 0;
                
                let color = 'var(--accent-green)';
                if (percentage >= 80) {
                    color = 'var(--accent-red)';
                } else if (percentage >= 60) {
                    color = 'var(--accent-yellow)';
                }
                
                const circles = cardElement.querySelectorAll('circle');
                if (circles.length >= 2) {
                    const circumference = 2 * Math.PI * 48;
                    const circumferenceMd = 2 * Math.PI * 56;
                    const offset = circumference - (Math.min(percentage, 100) / 100 * circumference);
                    const offsetMd = circumferenceMd - (Math.min(percentage, 100) / 100 * circumferenceMd);
                    
                    circles[1].style.stroke = color;
                    circles[1].setAttribute('stroke-dashoffset', offset);
                    
                    if (circles[3]) {
                        circles[3].style.stroke = color;
                        circles[3].setAttribute('stroke-dashoffset', offsetMd);
                    }
                }
                
                const costElement = cardElement.querySelector('.text-xl.md\\:text-2xl.font-bold');
                const consumptionElement = cardElement.querySelector('.text-xs.md\\:text-sm');
                
                if (costElement) {
                    costElement.textContent = `R$ ${monthlyCost.toFixed(2)}`;
                    costElement.style.color = color;
                }
                
                if (consumptionElement) {
                    // CORREÇÃO: Usar 1 casa decimal para mostrar valor mais preciso
                    consumptionElement.textContent = `${monthlyConsumption.toFixed(1)} kWh`;
                }
                
                console.log('✅ Card mensal atualizado:', { monthlyConsumption, monthlyCost, percentage });
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar card mensal:', error);
        }
    }
}

function updateWeeklyCard(statsData) {
    const weeklyCardElements = document.querySelectorAll('.border.rounded-xl.p-4.md\\:p-6 .text-center');
    
    if (weeklyCardElements.length >= 2) {
        const cardElement = weeklyCardElements[1].closest('.border.rounded-xl');
        
        try {
            if (statsData.diario) {
                const now = new Date();
                let weeklyConsumption = 0;
                
                // LOG para debug
                console.log('📊 Calculando consumo semanal...');
                
                for (let i = 0; i < 7; i++) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - i);
                    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    
                    const dayConsumption = statsData.diario[dateKey] || 0;
                    weeklyConsumption += dayConsumption;
                    
                    console.log(`  ${dateKey}: ${dayConsumption.toFixed(3)} kWh`);
                }
                
                const weeklyCost = weeklyConsumption * energyPrice;
                
                console.log('📊 Card Semanal:', {
                    weeklyConsumption,
                    energyPrice,
                    weeklyCost
                });
                
                const weeklyLimitKwh = 100;
                const percentage = weeklyLimitKwh > 0 ? (weeklyConsumption / weeklyLimitKwh) * 100 : 0;
                
                let color = 'var(--accent-green)';
                if (percentage >= 80) {
                    color = 'var(--accent-red)';
                } else if (percentage >= 60) {
                    color = 'var(--accent-yellow)';
                }
                
                const circles = cardElement.querySelectorAll('circle');
                if (circles.length >= 2) {
                    const circumference = 2 * Math.PI * 48;
                    const circumferenceMd = 2 * Math.PI * 56;
                    const offset = circumference - (Math.min(percentage, 100) / 100 * circumference);
                    const offsetMd = circumferenceMd - (Math.min(percentage, 100) / 100 * circumferenceMd);
                    
                    circles[1].style.stroke = color;
                    circles[1].setAttribute('stroke-dashoffset', offset);
                    
                    if (circles[3]) {
                        circles[3].style.stroke = color;
                        circles[3].setAttribute('stroke-dashoffset', offsetMd);
                    }
                }
                
                const costElement = cardElement.querySelector('.text-xl.md\\:text-2xl.font-bold');
                const consumptionElement = cardElement.querySelector('.text-xs.md\\:text-sm');
                
                if (costElement) {
                    costElement.textContent = `R$ ${weeklyCost.toFixed(2)}`;
                    costElement.style.color = color;
                }
                
                if (consumptionElement) {
                    consumptionElement.textContent = `${weeklyConsumption.toFixed(1)} kWh`;
                }
                
                console.log('✅ Card semanal atualizado:', { weeklyConsumption, weeklyCost, percentage });
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar card semanal:', error);
        }
    }
}

function updateDailyCard(statsData) {
    const dailyCardElements = document.querySelectorAll('.border.rounded-xl.p-4.md\\:p-6 .text-center');
    
    if (dailyCardElements.length >= 3) {
        const cardElement = dailyCardElements[2].closest('.border.rounded-xl');
        
        try {
            if (statsData.diario) {
                // ====================================
                // CORREÇÃO: Usar timezone de São Paulo
                // ====================================
                const now = new Date();
                
                // Opção 1: Forçar timezone de São Paulo
                const brasiliaDate = new Date(now.toLocaleString('en-US', { 
                    timeZone: 'America/Sao_Paulo' 
                }));
                
                const year = brasiliaDate.getFullYear();
                const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0');
                const day = String(brasiliaDate.getDate()).padStart(2, '0');
                const dateKey = `${year}-${month}-${day}`;
                
                console.log('📊 Buscando consumo do dia:', dateKey);
                console.log('📊 Timezone local:', now.toString());
                console.log('📊 Timezone Brasília:', brasiliaDate.toString());
                console.log('📊 Datas disponíveis no Firebase:', Object.keys(statsData.diario));
                
                let dailyConsumption = statsData.diario[dateKey] || 0;
                
                // ====================================
                // FALLBACK: Se não encontrar hoje, tentar ontem
                // ====================================
                if (dailyConsumption === 0) {
                    console.warn('⚠️ Não encontrou dados para', dateKey);
                    
                    // Tentar buscar a data mais recente disponível
                    const availableDates = Object.keys(statsData.diario).sort().reverse();
                    if (availableDates.length > 0) {
                        const latestDate = availableDates[0];
                        console.log('🔄 Usando data mais recente:', latestDate);
                        dailyConsumption = statsData.diario[latestDate] || 0;
                        
                        // Adicionar indicador visual de que não é hoje
                        console.warn('⚠️ Mostrando dados de', latestDate, 'em vez de hoje');
                    }
                }
                
                const dailyCost = dailyConsumption * energyPrice;
                
                console.log('📊 Card Diário:', {
                    dateKey,
                    dailyConsumption,
                    energyPrice,
                    dailyCost,
                    rawData: statsData.diario[dateKey]
                });
                
                const dailyLimitKwh = 20;
                const percentage = dailyLimitKwh > 0 ? (dailyConsumption / dailyLimitKwh) * 100 : 0;
                
                let color = 'var(--accent-green)';
                if (percentage >= 80) {
                    color = 'var(--accent-red)';
                } else if (percentage >= 60) {
                    color = 'var(--accent-yellow)';
                }
                
                const circles = cardElement.querySelectorAll('circle');
                if (circles.length >= 2) {
                    const circumference = 2 * Math.PI * 48;
                    const circumferenceMd = 2 * Math.PI * 56;
                    const offset = circumference - (Math.min(percentage, 100) / 100 * circumference);
                    const offsetMd = circumferenceMd - (Math.min(percentage, 100) / 100 * circumferenceMd);
                    
                    circles[1].style.stroke = color;
                    circles[1].setAttribute('stroke-dashoffset', offset);
                    
                    if (circles[3]) {
                        circles[3].style.stroke = color;
                        circles[3].setAttribute('stroke-dashoffset', offsetMd);
                    }
                }
                
                const costElement = cardElement.querySelector('.text-xl.md\\:text-2xl.font-bold');
                const consumptionElement = cardElement.querySelector('.text-xs.md\\:text-sm');
                
                if (costElement) {
                    costElement.textContent = `R$ ${dailyCost.toFixed(2)}`;
                    costElement.style.color = color;
                }
                
                if (consumptionElement) {
                    consumptionElement.textContent = `${dailyConsumption.toFixed(1)} kWh`;
                }
                
                if (dailyConsumption === 0) {
                    console.warn('⚠️ Nenhum consumo registrado para', dateKey);
                } else {
                    console.log('✅ Card diário atualizado:', { dailyConsumption, dailyCost, percentage });
                }
            }
        } catch (error) {
            console.error('❌ Erro ao atualizar card diário:', error);
        }
    }
}

function updateMonthlyCostAverage(statsData) {
    const monthlyCostElement = document.querySelector('.border.rounded-xl.p-4.md\\:p-6.text-center .text-2xl.md\\:text-3xl.font-bold.mb-2');
    
    if (monthlyCostElement && statsData.mensal) {
        try {
            const monthlyData = statsData.mensal;
            const months = Object.keys(monthlyData);
            
            if (months.length > 0) {
                const recentMonths = months.slice(-3);
                let totalConsumption = 0;
                let monthCount = 0;
                
                recentMonths.forEach(monthKey => {
                    const consumption = monthlyData[monthKey] || 0;
                    const monthlyCost = consumption * energyPrice;
                    totalConsumption += monthlyCost;
                    monthCount++;
                });
                
                const averageMonthlyCost = monthCount > 0 ? totalConsumption / monthCount : 0;
                monthlyCostElement.textContent = `R$ ${averageMonthlyCost.toFixed(2)}`;
                
                console.log('Média mensal calculada:', averageMonthlyCost);
            } else {
                monthlyCostElement.textContent = 'R$ 387,66';
            }
        } catch (error) {
            console.error('Erro ao calcular média mensal:', error);
            monthlyCostElement.textContent = 'R$ 387,66';
        }
    }
}

function updateDailyCostAverage(statsData) {
    const dailyCostElements = document.querySelectorAll('.border.rounded-xl.p-4.md\\:p-6.text-center .text-2xl.md\\:text-3xl.font-bold.mb-2');
    
    if (dailyCostElements.length >= 2) {
        const dailyCostElement = dailyCostElements[1];
        
        try {
            if (statsData.diario) {
                const dailyData = statsData.diario;
                const today = new Date().toISOString().split('T')[0];
                
                let todayConsumption = 0;
                Object.keys(dailyData).forEach(dateKey => {
                    if (dateKey.includes(today)) {
                        todayConsumption = dailyData[dateKey] || 0;
                    }
                });
                
                const dailyCost = todayConsumption * energyPrice;
                
                if (dailyCost > 0) {
                    dailyCostElement.textContent = `R$ ${dailyCost.toFixed(2)}`;
                } else {
                    calculateWeeklyAverage(dailyData, dailyCostElement);
                }
            } else {
                calculateWeeklyAverage({}, dailyCostElement);
            }
        } catch (error) {
            console.error('Erro ao calcular custo diário:', error);
            dailyCostElement.textContent = 'R$ 14,89';
        }
    }
}

function calculateWeeklyAverage(dailyData, dailyCostElement) {
    const dailyEntries = Object.entries(dailyData);
    
    if (dailyEntries.length > 0) {
        const recentDays = dailyEntries.slice(-7);
        let totalCost = 0;
        let dayCount = 0;
        
        recentDays.forEach(([date, consumption]) => {
            const dailyCost = consumption * energyPrice;
            totalCost += dailyCost;
            dayCount++;
        });
        
        const averageDailyCost = dayCount > 0 ? totalCost / dayCount : 14.89;
        dailyCostElement.textContent = `R$ ${averageDailyCost.toFixed(2)}`;
    } else {
        dailyCostElement.textContent = 'R$ 14,89';
    }
}

function updateCurrentPower() {
    const currentPowerElement = document.querySelectorAll('.border.rounded-xl.p-4.md\\:p-6.text-center .text-2xl.md\\:text-3xl.font-bold.mb-2');
    
    if (currentPowerElement.length >= 3) {
        const powerElement = currentPowerElement[2];
        
        const currentPower = s1Power + s2Power;
        const powerInKW = currentPower / 1000;
        
        powerElement.textContent = `${powerInKW.toFixed(2)} kW`;
        
        console.log('Potência atual atualizada:', powerInKW);
    }
}

function updateActiveDevicesCount() {
    const activeDevicesElement = document.querySelectorAll('.border.rounded-xl.p-4.md\\:p-6.text-center .text-2xl.md\\:text-3xl.font-bold.mb-2');
    
    if (activeDevicesElement.length >= 4) {
        const devicesElement = activeDevicesElement[3];
        
        try {
            let activeCount = Object.keys(regularDevices).length;
            
            Object.keys(smartDevices).forEach(key => {
                if (smartDevices[key].state === true) {
                    activeCount++;
                }
            });
            
            devicesElement.textContent = activeCount.toString();
            
            console.log('Contagem de dispositivos atualizada:', activeCount);
        } catch (error) {
            console.error('Erro ao contar dispositivos ativos:', error);
            devicesElement.textContent = '12';
        }
    }
}

function setDefaultStatistics() {
    const bigCardElements = document.querySelectorAll('.border.rounded-xl.p-4.md\\:p-6 .text-center');
    
    if (bigCardElements.length >= 3) {
        const monthlyCard = bigCardElements[0];
        const monthlyCost = monthlyCard.querySelector('.text-xl.md\\:text-2xl.font-bold');
        const monthlyConsumption = monthlyCard.querySelector('.text-xs.md\\:text-sm');
        if (monthlyCost) monthlyCost.textContent = 'R$ 463,50';
        if (monthlyConsumption) monthlyConsumption.textContent = '342 kWh';
        
        const weeklyCard = bigCardElements[1];
        const weeklyCost = weeklyCard.querySelector('.text-xl.md\\:text-2xl.font-bold');
        const weeklyConsumption = weeklyCard.querySelector('.text-xs.md\\:text-sm');
        if (weeklyCost) weeklyCost.textContent = 'R$ 15,45';
        if (weeklyConsumption) weeklyConsumption.textContent = '11.4 kWh';
        
        const dailyCard = bigCardElements[2];
        const dailyCost = dailyCard.querySelector('.text-xl.md\\:text-2xl.font-bold');
        const dailyConsumption = dailyCard.querySelector('.text-xs.md\\:text-sm');
        if (dailyCost) dailyCost.textContent = 'R$ 15,45';
        if (dailyConsumption) dailyConsumption.textContent = '11.4 kWh';
    }
    
    const statElements = document.querySelectorAll('.border.rounded-xl.p-4.md\\:p-6.text-center .text-2xl.md\\:text-3xl.font-bold.mb-2');
    
    if (statElements.length >= 4) {
        statElements[0].textContent = 'R$ 387,66';
        statElements[1].textContent = 'R$ 14,89';
        statElements[2].textContent = '0.47 kW';
        statElements[3].textContent = '12';
    }
}

function startStatisticsMonitor() {
    setInterval(() => {
        updateCurrentPower();
        updateActiveDevicesCount();
        
        if (USER_ID) {
            const statsRef = database.ref(`users/${USER_ID}/esp32/estatisticas`);
            statsRef.once('value', (snapshot) => {
                const statsData = snapshot.val();
                if (statsData) {
                    updateMonthlyCard(statsData);
                    updateWeeklyCard(statsData);
                    updateDailyCard(statsData);
                }
            });
        }
    }, 30000);
}

confirmDeleteBtn.addEventListener('click', deleteDevice);
cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.style.display = 'none';
    deviceToDelete = null;
});

confirmDeleteBtn.addEventListener('mouseenter', () => {
    confirmDeleteBtn.style.transform = 'translateY(-2px)';
    confirmDeleteBtn.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
});

confirmDeleteBtn.addEventListener('mouseleave', () => {
    confirmDeleteBtn.style.transform = '';
    confirmDeleteBtn.style.boxShadow = '';
});

cancelDeleteBtn.addEventListener('mouseenter', () => {
    cancelDeleteBtn.style.backgroundColor = 'var(--border-dark)';
});

cancelDeleteBtn.addEventListener('mouseleave', () => {
    cancelDeleteBtn.style.backgroundColor = 'var(--bg-secondary)';
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

confirmBtn.addEventListener('mouseenter', () => {
    confirmBtn.style.transform = 'translateY(-2px)';
    confirmBtn.style.boxShadow = '0 4px 12px rgba(0, 255, 42, 0.3)';
});

confirmBtn.addEventListener('mouseleave', () => {
    confirmBtn.style.transform = '';
    confirmBtn.style.boxShadow = '';
});

cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.backgroundColor = 'var(--border-dark)';
});

cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.backgroundColor = 'var(--bg-secondary)';
});

hasButton.addEventListener('change', () => {
    const smartDeviceCount = Object.keys(smartDevices).length;
    
    if (hasButton.value === 'yes' && smartDeviceCount >= MAX_SMART_DEVICES) {
        limitWarning.style.display = 'block';
        setTimeout(() => {
            hasButton.value = 'no';
            limitWarning.innerHTML = `<strong>LIMITE ATINGIDO!</strong><br>Você já possui ${smartDeviceCount}/${MAX_SMART_DEVICES} dispositivos inteligentes.<br>Selecione "Não Inteligente" para continuar.`;
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
    
    if (editingDevice) {
        console.log('Modo edição ativado');
        const deviceRef = database.ref(`users/${USER_ID}/devices/${editingDevice.key}`);
        
        deviceRef.once('value', (snapshot) => {
            const currentData = snapshot.val();
            
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

function openWattsChatbot() {
    const modal = document.getElementById('wattsChatbotModal');
    const chatMessages = document.getElementById('chatMessages');
    
    if (modal && chatMessages) {
        chatHistory = [];
        chatMessages.innerHTML = '';
        
        addChatMessage('assistant', 'Vou te ajudar a descobrir quantos watts seu dispositivo consome.\n\nPor favor, me conte:\n• Que tipo de dispositivo é? (ex: geladeira, TV, micro-ondas)\n• Qual a marca e modelo, se souber\n• Alguma característica especial? (ex: tamanho, capacidade)');
        
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
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${watts} Watts</div>
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
        addChatMessage('assistant', 'Desculpe, ocorreu um erro ao processar sua mensagem.');
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

function startUptimeCounter() {
    setInterval(() => {
        if (Object.keys(regularDevices).length > 0 || Object.keys(smartDevices).length > 0) {
            renderDevices();
            renderDynamicDeviceCards();
        }
    }, 60000);
    
    setInterval(() => {
        if (Object.keys(regularDevices).length > 0 || Object.keys(smartDevices).length > 0) {
            console.log('Salvamento automático de consumo...');
            updateAllConsumptions();
        }
    }, 300000);
    
    window.addEventListener('beforeunload', () => {
        console.log('Salvando consumo antes de sair...');
        updateAllConsumptions();
    });
}

async function inicializarDashboard() {
    try {
        // PASSO 1: Autenticar e garantir USER_ID
        console.log('🔐 Iniciando autenticação...');
        await verificarAutenticacao();
        
        if (!USER_ID) {
            throw new Error('USER_ID não foi definido após autenticação');
        }
        
        console.log('✅ Dashboard inicializado para usuário:', USER_ID);
        
        // PASSO 2: Mostrar interface
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        
        // PASSO 3: Carregar preço da energia
        console.log('💰 Carregando preço da energia...');
        await loadEnergyPrice();
        console.log('✅ Preço da energia carregado:', energyPrice);
        
        // PASSO 4: Iniciar monitoramento de preço
        monitorEnergyPriceChanges();
        
        // PASSO 5: Carregar limites e potência
        console.log('⚡ Iniciando monitoramento de potência...');
        getAlertLimit();
        monitorPower();
        
        // PASSO 6: Carregar dispositivos
        console.log('📱 Carregando dispositivos...');
        loadDevicesFromFirebase();
        
        // PASSO 7: Renderizar locais
        renderLocations();
        
        // PASSO 8: CORREÇÃO - Carregar estatísticas com delay para garantir que USER_ID está disponível
        console.log('📊 Preparando para carregar estatísticas...');
        
        // Verificar novamente se USER_ID está disponível
        if (USER_ID) {
            console.log('📊 USER_ID confirmado, carregando estatísticas...');
            loadStatisticsData();
            startStatisticsMonitor();
        } else {
            console.error('❌ USER_ID não disponível para carregar estatísticas');
            // Tentar novamente após 1 segundo
            setTimeout(() => {
                if (USER_ID) {
                    console.log('📊 Tentativa 2: Carregando estatísticas...');
                    loadStatisticsData();
                    startStatisticsMonitor();
                } else {
                    console.error('❌ USER_ID ainda não disponível após 1s');
                }
            }, 1000);
        }
        
        // PASSO 9: Iniciar contador de uptime
        startUptimeCounter();
        
        // PASSO 10: Salvamento inicial de consumo
        setTimeout(() => {
            if (USER_ID) {
                console.log('💾 Fazendo salvamento inicial de consumo...');
                updateAllConsumptions();
            }
        }, 10000);
        
        console.log('✅ Dashboard totalmente inicializado!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar dashboard:', error);
        redirecionarParaLogin();
    }
}

document.addEventListener('DOMContentLoaded', inicializarDashboard);

const confirmPriceBtnElement = document.getElementById('confirmPriceBtn');
const cancelPriceBtnElement = document.getElementById('cancelPriceBtn');

if (confirmPriceBtnElement) {
    confirmPriceBtnElement.addEventListener('mouseenter', () => {
        confirmPriceBtnElement.style.transform = 'translateY(-2px)';
        confirmPriceBtnElement.style.boxShadow = '0 4px 12px rgba(0, 255, 42, 0.3)';
    });
    
    confirmPriceBtnElement.addEventListener('mouseleave', () => {
        confirmPriceBtnElement.style.transform = '';
        confirmPriceBtnElement.style.boxShadow = '';
    });
}

if (cancelPriceBtnElement) {
    cancelPriceBtnElement.addEventListener('mouseenter', () => {
        cancelPriceBtnElement.style.backgroundColor = 'var(--border-dark)';
    });
    
    cancelPriceBtnElement.addEventListener('mouseleave', () => {
        cancelPriceBtnElement.style.backgroundColor = 'var(--bg-secondary)';
    });
}

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