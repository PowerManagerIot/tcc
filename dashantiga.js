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

// Variáveis de monitoramento
let alertLimit = 100;
let monthlyLimit = 700;
let currentPowerValue = 0;
let currentMonthlyValue = 0;
let s1Power = 0;
let s2Power = 0;

// Preço da energia (padrão R$ 0,80/kWh)
let energyPrice = 0.80;

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
            
            // Processar alerta de tempo real
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
            
            // Processar alerta de consumo total
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
        
        // Atualizar display principal
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
        
        // Atualizar barra de potência
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
    
    // Salvar no localStorage
    localStorage.setItem('energyPrice', energyPrice.toString());
    
    // Atualizar todos os valores dos dispositivos
    updateDevicePrices();
    
    closeEnergyPriceModal();
    
    if (connectionStatus) {
        connectionStatus.textContent = `Preço da energia atualizado para R$ ${energyPrice.toFixed(2)}/kWh`;
        connectionStatus.className = "status connected";
        
        setTimeout(() => {
            connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
        }, 3000);
    }
}

function updateDevicePrices() {
    // Ar-Condicionado - 4 kWh
    const arCondCost = 4 * energyPrice;
    const arCondElement = document.querySelector('[data-device="ar-cond"]');
    if (arCondElement) {
        arCondElement.querySelector('.cost-value').textContent = `R$ ${arCondCost.toFixed(2)}`;
    }
    
    // Lâmpada do Quarto - 0.60 kWh
    const lampadaCost = 0.60 * energyPrice;
    const lampadaElement = document.querySelector('[data-device="lampada"]');
    if (lampadaElement) {
        lampadaElement.querySelector('.cost-value').textContent = `R$ ${lampadaCost.toFixed(2)}`;
    }
    
    // Ventilador - 1 kWh
    const ventiladorCost = 1 * energyPrice;
    const ventiladorElement = document.querySelector('[data-device="ventilador"]');
    if (ventiladorElement) {
        ventiladorElement.querySelector('.cost-value').textContent = `R$ ${ventiladorCost.toFixed(2)}`;
    }
    
    // Chuveiro - 5.8 kWh
    const chuveiroCost = 5.8 * energyPrice;
    const chuveiroElement = document.querySelector('[data-device="chuveiro"]');
    if (chuveiroElement) {
        chuveiroElement.querySelector('.cost-value').textContent = `R$ ${chuveiroCost.toFixed(2)}`;
    }
}

function loadEnergyPrice() {
    const savedPrice = localStorage.getItem('energyPrice');
    if (savedPrice) {
        energyPrice = parseFloat(savedPrice);
    }
    updateDevicePrices();
}

// ========== FUNÇÕES DE DISPOSITIVOS ==========

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
    
    const regularDevicesRef = database.ref(`users/${USER_ID}/regularDevices`);
    regularDevicesRef.on('value', (snapshot) => {
        regularDevices = snapshot.val() || {};
        renderDevices();
        updateSmartDevicesCounter();
    });
    
    const devicesRef = database.ref(`users/${USER_ID}/devices`);
    devicesRef.on('value', (snapshot) => {
        smartDevices = snapshot.val() || {};
        renderDevices();
        updateSmartDevicesCounter();
    });
}

function toggleDeviceState(deviceKey) {
    if (!USER_ID) return;
    
    smartDevices[deviceKey].state = !smartDevices[deviceKey].state;
    
    database.ref(`users/${USER_ID}/devices/${deviceKey}/state`).set(smartDevices[deviceKey].state)
        .then(() => renderDevices())
        .catch((error) => console.error("Erro ao atualizar estado:", error));
}

function showDeleteConfirmation(deviceKey, deviceName, isSmart) {
    deviceToDelete = { key: deviceKey, name: deviceName, isSmart: isSmart };
    deviceToDeleteName.textContent = deviceName;
    deleteModal.style.display = 'block';
}

function deleteDevice() {
    if (!deviceToDelete || !USER_ID) return;

    const path = deviceToDelete.isSmart 
        ? `users/${USER_ID}/devices/${deviceToDelete.key}`
        : `users/${USER_ID}/regularDevices/${deviceToDelete.key}`;

    database.ref(path).remove()
        .then(() => {
            deleteModal.style.display = 'none';
            const deletedName = deviceToDelete.name;
            deviceToDelete = null;
            
            if (connectionStatus) {
                connectionStatus.textContent = `Dispositivo "${deletedName}" excluído com sucesso!`;
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
}

function renderDevices() {
    devicesContainer.innerHTML = '';
    
    // Renderizar dispositivos regulares
    Object.keys(regularDevices).forEach((key) => {
        const device = regularDevices[key];
        const deviceElement = document.createElement('div');
        deviceElement.className = 'device';
        
        deviceElement.innerHTML = `
            <div class="device-info">
                <div class="device-name">
                    ${device.name}
                    <span class="device-type">Regular</span>
                </div>
                <div class="device-value">${device.number} W</div>
                <div class="device-state">Dispositivo não controlável</div>
            </div>
            <div class="device-controls">
                <button class="delete-btn">🗑️ Excluir</button>
            </div>
        `;
        
        devicesContainer.appendChild(deviceElement);
        
        deviceElement.querySelector('.delete-btn').addEventListener('click', () => {
            showDeleteConfirmation(key, device.name, false);
        });
    });
    
    // Renderizar dispositivos inteligentes
    Object.keys(smartDevices).forEach((key) => {
        const device = smartDevices[key];
        const deviceElement = document.createElement('div');
        deviceElement.className = 'device has-button';
        
        deviceElement.innerHTML = `
            <div class="device-info">
                <div class="device-name">
                    ${device.name}
                    <span class="device-type smart">Inteligente</span>
                </div>
                <div class="device-value">${device.number} W</div>
                <div class="device-state">Estado: ${device.state ? 'Ligado' : 'Desligado'}</div>
            </div>
            <div class="device-controls">
                <button class="device-btn" data-state="${device.state ? 'on' : 'off'}">
                    ${device.state ? 'Ligado' : 'Desligado'}
                </button>
                <button class="delete-btn">🗑️ Excluir</button>
            </div>
        `;
        
        devicesContainer.appendChild(deviceElement);
        
        deviceElement.querySelector('.device-btn').addEventListener('click', () => toggleDeviceState(key));
        deviceElement.querySelector('.delete-btn').addEventListener('click', () => {
            showDeleteConfirmation(key, device.name, true);
        });
    });

    if (Object.keys(regularDevices).length === 0 && Object.keys(smartDevices).length === 0) {
        devicesContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Nenhum dispositivo cadastrado. Clique em "Adicionar Dispositivo" para começar.</p>';
    }
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
    deviceModal.style.display = 'block';
    updateSmartDevicesCounter();
});

cancelBtn.addEventListener('click', () => {
    deviceModal.style.display = 'none';
    limitWarning.style.display = 'none';
    deviceName.value = '';
    deviceNumber.value = '';
    hasButton.value = 'no';
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
    if (!USER_ID) {
        alert('Erro: Usuário não identificado. Por favor, faça login novamente.');
        redirecionarParaLogin();
        return;
    }
    
    const name = deviceName.value.trim();
    const number = parseInt(deviceNumber.value.trim());
    const isSmart = hasButton.value === 'yes';
    
    if (!name || !number || isNaN(number)) {
        alert("Por favor, preencha todos os campos corretamente.");
        return;
    }
    
    const smartDeviceCount = Object.keys(smartDevices).length;
    
    if (isSmart && smartDeviceCount >= MAX_SMART_DEVICES) {
        alert(`LIMITE ATINGIDO!\n\nVocê já possui ${smartDeviceCount} dispositivos inteligentes.\nO limite máximo é ${MAX_SMART_DEVICES} dispositivos inteligentes.`);
        return;
    }
    
    const newDevice = {
        name,
        number,
        hasButton: isSmart ? 'yes' : 'no',
        state: false
    };
    
    const path = isSmart ? 'devices' : 'regularDevices';
    const devices = isSmart ? smartDevices : regularDevices;
    const nextId = getNextDeviceId(devices);
    
    database.ref(`users/${USER_ID}/${path}/${nextId}`).set(newDevice)
        .then(() => {
            deviceModal.style.display = 'none';
            limitWarning.style.display = 'none';
            deviceName.value = '';
            deviceNumber.value = '';
            hasButton.value = 'no';
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

// ========== INICIALIZAÇÃO ==========

async function inicializarDashboard() {
    try {
        await verificarAutenticacao();
        console.log('Dashboard inicializado para usuário:', USER_ID);
        
        const loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
        
        // Carregar preço da energia salvo
        loadEnergyPrice();
        
        // Iniciar todos os monitoramentos
        getAlertLimit();
        monitorPower();
        loadDevicesFromFirebase();
        renderLocations();
        
    } catch (error) {
        console.error('Erro ao inicializar dashboard:', error);
        redirecionarParaLogin();
    }
}

// ========== EVENT LISTENERS GLOBAIS ==========

document.addEventListener('DOMContentLoaded', inicializarDashboard);

// Fechar modais ao clicar fora
window.addEventListener('click', (event) => {
    if (event.target === deviceModal) {
        deviceModal.style.display = 'none';
        limitWarning.style.display = 'none';
    }
    if (event.target === deleteModal) {
        deleteModal.style.display = 'none';
        deviceToDelete = null;
    }
    if (event.target === energyPriceModal) {
        energyPriceModal.style.display = 'none';
    }
});

// Event listener do modal de location
const locationModal = document.getElementById('locationModal');
if (locationModal) {
    locationModal.addEventListener('click', function(e) {
        if (e.target === this) closeLocationModal();
    });
}

// Botão de logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
}

// Tornar funções globais para o HTML
window.logout = logout;
window.openLocationModal = openLocationModal;
window.closeLocationModal = closeLocationModal;
window.addLocation = addLocation;
window.openEnergyPriceModal = openEnergyPriceModal;
window.closeEnergyPriceModal = closeEnergyPriceModal;
window.updateEnergyPrice = updateEnergyPrice;