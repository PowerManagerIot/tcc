import {auth, database} from "./auth.js"

// Variável global para armazenar o ID do usuário logado
let USER_ID = null;

// Elementos da página
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

// Elementos do modal de exclusão
const deleteModal = document.getElementById('deleteModal');
const deviceToDeleteName = document.getElementById('deviceToDeleteName');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

// Arrays para armazenar os dispositivos
let regularDevices = {};
let smartDevices = {};
const MAX_SMART_DEVICES = 8;

// Variáveis para controle de exclusão
let deviceToDelete = null;

// Função para verificar autenticação e obter USER_ID
function verificarAutenticacao() {
    return new Promise((resolve, reject) => {
        // Primeiro verifica se há usuário no sessionStorage/localStorage
        const storedUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') || localStorage.getItem('isLoggedIn');
        
        if (storedUserId && isLoggedIn === 'true') {
            USER_ID = storedUserId;
            console.log('Usuário recuperado do storage:', USER_ID);
            resolve(USER_ID);
        } else {
            // Se não há no storage, verifica com Firebase Auth
            auth.onAuthStateChanged((user) => {
                if (user) {
                    USER_ID = user.uid;
                    console.log('Usuário autenticado:', USER_ID);
                    
                    // Salva no storage para próxima vez
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

// Função para redirecionar para login se não estiver autenticado
function redirecionarParaLogin() {
    alert('Sessão expirada. Por favor, faça login novamente.');
    // Limpa os dados de sessão
    sessionStorage.clear();
    localStorage.clear();
    
    // Limpar cookies
    document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    window.location.href = 'login.html';
}

// Função para formatar data/hora
function formatDateTime(date) {
    return date.toLocaleTimeString() + ' - ' + date.toLocaleDateString();
}

// Função para atualizar o contador de dispositivos inteligentes
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

// Função para iniciar monitoramento dos dados
function startDataMonitoring() {
    // Monitorar S1 e S2 para consumo em tempo real
    const s1Ref = database.ref(`users/${USER_ID}/esp32/s1/potencia`);
    const s2Ref = database.ref(`users/${USER_ID}/esp32/s2/potencia`);
    
    let s1Value = 0;
    let s2Value = 0;
    
    // Função para atualizar o display com a soma
    function updateCurrentValue() {
        const totalValue = s1Value + s2Value;
        currentValue.textContent = totalValue.toFixed(2);
        
        const now = new Date();
        lastUpdate.textContent = `Última atualização: ${formatDateTime(now)}`;
        
        connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
        connectionStatus.className = "status connected";
    }
    
    // Monitorar S1
    s1Ref.on('value', (snapshot) => {
        s1Value = snapshot.val() || 0;
        updateCurrentValue();
    }, (error) => {
        connectionStatus.textContent = "Erro na leitura S1: " + error.message;
        connectionStatus.className = "status disconnected";
    });
    
    // Monitorar S2
    s2Ref.on('value', (snapshot) => {
        s2Value = snapshot.val() || 0;
        updateCurrentValue();
    }, (error) => {
        connectionStatus.textContent = "Erro na leitura S2: " + error.message;
        connectionStatus.className = "status disconnected";
    });
}

const powerBar = document.getElementById('powerBar');
const percentage = document.getElementById('percentage');
const currentPower = document.getElementById('currentPower');
const limitPower = document.getElementById('limitPower');
const status = document.getElementById('status');

let alertLimit = 100; // Valor padrão
let currentPowerValue = 0;
let s1Power = 0; // Potência do sensor 1
let s2Power = 0; // Potência do sensor 2

// Função para atualizar a barra
function updateBar(current, limit) {
    const percent = (current / limit) * 100;
    const displayPercent = Math.min(percent, 100); // Limita a barra visualmente a 100%
    
    powerBar.style.width = displayPercent + '%';
    percentage.textContent = percent.toFixed(1) + '%'; // Mostra porcentagem real, mesmo acima de 100%
    currentPower.textContent = current.toFixed(2);
    limitPower.textContent = limit;
    
    // Remover todas as classes
    powerBar.classList.remove('warning', 'danger', 'full');
    
    // Adicionar classe baseada na porcentagem
    if (percent >= 100) {
        powerBar.classList.add('full');
    } else if (percent >= 80) {
        powerBar.classList.add('danger');
    } else if (percent >= 60) {
        powerBar.classList.add('warning');
    }
}

// Buscar o limit do alerta
function getAlertLimit() {
    const alertsRef = database.ref(`users/${USER_ID}/alerts`);
    
    alertsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            // Pegar o primeiro alerta e seu limit
            const firstAlertKey = Object.keys(data)[0];
            alertLimit = data[firstAlertKey].limit;
            
            console.log("Limit do alerta:", alertLimit);
            updateBar(currentPowerValue, alertLimit);
            
            status.textContent = "✓ Conectado - Monitorando em tempo real";
            status.className = "status connected";
        } else {
            console.log("Nenhum alerta encontrado, usando limite padrão");
            alertLimit = 100;
            status.textContent = "⚠ Nenhum alerta cadastrado - Usando limite padrão (100W)";
            status.className = "status error";
        }
    }, (error) => {
        console.error("Erro ao buscar limit:", error);
        status.textContent = "✗ Erro ao conectar: " + error.message;
        status.className = "status error";
    });
}

// Monitorar potência instantânea - MODIFICADO para somar S1 e S2
function monitorPower() {
    const s1Ref = database.ref(`users/${USER_ID}/esp32/s1/potencia`);
    const s2Ref = database.ref(`users/${USER_ID}/esp32/s2/potencia`);
    
    // Monitorar S1
    s1Ref.on('value', (snapshot) => {
        s1Power = snapshot.val() || 0;
        currentPowerValue = s1Power + s2Power; // Soma das potências
        console.log("S1:", s1Power, "| S2:", s2Power, "| Total:", currentPowerValue);
        updateBar(currentPowerValue, alertLimit);
    }, (error) => {
        console.error("Erro ao monitorar S1:", error);
        status.textContent = "✗ Erro na leitura de S1";
        status.className = "status error";
    });
    
    // Monitorar S2
    s2Ref.on('value', (snapshot) => {
        s2Power = snapshot.val() || 0;
        currentPowerValue = s1Power + s2Power; // Soma das potências
        console.log("S1:", s1Power, "| S2:", s2Power, "| Total:", currentPowerValue);
        updateBar(currentPowerValue, alertLimit);
    }, (error) => {
        console.error("Erro ao monitorar S2:", error);
        status.textContent = "✗ Erro na leitura de S2";
        status.className = "status error";
    });
}

// Iniciar monitoramento
document.addEventListener('DOMContentLoaded', function() {
    console.log("Iniciando monitoramento...");
    getAlertLimit();
    monitorPower();
});
// Chamar a função

// Função para carregar dispositivos do Firebase - MODIFICADA
function loadDevicesFromFirebase() {
    if (!USER_ID) {
        console.error('USER_ID não definido');
        return;
    }
    
    // Carregar dispositivos regulares
    const regularDevicesRef = database.ref(`users/${USER_ID}/regularDevices`);
    regularDevicesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        regularDevices = data || {};
        renderDevices();
        updateSmartDevicesCounter();
    });
    
    // Carregar dispositivos inteligentes (tabela "devices")
    const devicesRef = database.ref(`users/${USER_ID}/devices`);
    devicesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        smartDevices = data || {};
        renderDevices();
        updateSmartDevicesCounter();
    });
}

// Função para alternar o estado do dispositivo inteligente
function toggleDeviceState(deviceKey) {
    if (!USER_ID) {
        console.error('USER_ID não definido');
        return;
    }
    
    smartDevices[deviceKey].state = !smartDevices[deviceKey].state;
    
    database.ref(`users/${USER_ID}/devices/${deviceKey}/state`).set(smartDevices[deviceKey].state)
        .then(() => {
            console.log("Estado atualizado no Firebase");
            renderDevices();
        })
        .catch((error) => {
            console.error("Erro ao atualizar estado:", error);
        });
}

// Função para mostrar modal de confirmação de exclusão
function showDeleteConfirmation(deviceKey, deviceName, isSmart) {
    deviceToDelete = { key: deviceKey, name: deviceName, isSmart: isSmart };
    deviceToDeleteName.textContent = deviceName;
    deleteModal.style.display = 'block';
}

// Função para excluir dispositivo
function deleteDevice() {
    if (!deviceToDelete || !USER_ID) {
        console.error('Dados insuficientes para excluir dispositivo');
        return;
    }

    const path = deviceToDelete.isSmart 
        ? `users/${USER_ID}/devices/${deviceToDelete.key}`
        : `users/${USER_ID}/regularDevices/${deviceToDelete.key}`;

    database.ref(path).remove()
        .then(() => {
            console.log(`Dispositivo ${deviceToDelete.name} excluído com sucesso`);
            deleteModal.style.display = 'none';
            const deletedName = deviceToDelete.name;
            deviceToDelete = null;
            
            connectionStatus.textContent = `Dispositivo "${deletedName}" excluído com sucesso!`;
            connectionStatus.className = "status connected";
            
            setTimeout(() => {
                connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
            }, 3000);
        })
        .catch((error) => {
            console.error("Erro ao excluir dispositivo:", error);
            alert("Erro ao excluir dispositivo: " + error.message);
            deleteModal.style.display = 'none';
            deviceToDelete = null;
        });
}

// Função para renderizar os dispositivos
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
                <button class="delete-btn" data-key="${key}" data-name="${device.name}" data-smart="false">
                    🗑️ Excluir
                </button>
            </div>
        `;
        
        devicesContainer.appendChild(deviceElement);
        
        const deleteBtn = deviceElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
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
                <button class="device-btn" data-key="${key}" data-state="${device.state ? 'on' : 'off'}">
                    ${device.state ? 'Ligado' : 'Desligado'}
                </button>
                <button class="delete-btn" data-key="${key}" data-name="${device.name}" data-smart="true">
                    🗑️ Excluir
                </button>
            </div>
        `;
        
        devicesContainer.appendChild(deviceElement);
        
        const controlBtn = deviceElement.querySelector('.device-btn');
        controlBtn.addEventListener('click', () => toggleDeviceState(key));
        
        const deleteBtn = deviceElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            showDeleteConfirmation(key, device.name, true);
        });
    });

    if (Object.keys(regularDevices).length === 0 && Object.keys(smartDevices).length === 0) {
        devicesContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Nenhum dispositivo cadastrado. Clique em "Adicionar Dispositivo" para começar.</p>';
    }
}

// Eventos do modal de exclusão
confirmDeleteBtn.addEventListener('click', deleteDevice);

cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.style.display = 'none';
    deviceToDelete = null;
});

// Evento para abrir o modal
addDeviceBtn.addEventListener('click', () => {
    deviceModal.style.display = 'block';
    updateSmartDevicesCounter();
});

// Evento para fechar o modal
cancelBtn.addEventListener('click', () => {
    deviceModal.style.display = 'none';
    limitWarning.style.display = 'none';
    deviceName.value = '';
    deviceNumber.value = '';
    hasButton.value = 'no';
});

// Monitorar mudanças no select para mostrar aviso
hasButton.addEventListener('change', () => {
    const smartDeviceCount = Object.keys(smartDevices).length;
    console.log("Select mudou para:", hasButton.value, "Dispositivos atuais:", smartDeviceCount);
    
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

// Função para obter o próximo ID sequencial
function getNextDeviceId(devices) {
    const ids = Object.keys(devices).map(id => parseInt(id)).filter(id => !isNaN(id));
    return ids.length === 0 ? 0 : Math.max(...ids) + 1;
}

// Evento para confirmar novo dispositivo
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
    console.log("Dispositivos inteligentes atuais:", smartDeviceCount, "Limite:", MAX_SMART_DEVICES);
    
    if (isSmart && smartDeviceCount >= MAX_SMART_DEVICES) {
        alert(`LIMITE ATINGIDO!\n\nVocê já possui ${smartDeviceCount} dispositivos inteligentes.\nO limite máximo é ${MAX_SMART_DEVICES} dispositivos inteligentes.\n\nPara adicionar este dispositivo, selecione "Não Inteligente".`);
        return;
    }
    
    const newDevice = {
        name,
        number,
        hasButton: isSmart ? 'yes' : 'no',
        state: false
    };
    
    if (isSmart) {
        if (smartDeviceCount >= MAX_SMART_DEVICES) {
            alert(`ERRO: Limite de dispositivos inteligentes atingido (${smartDeviceCount}/${MAX_SMART_DEVICES})`);
            return;
        }
        
        const nextId = getNextDeviceId(smartDevices);
        console.log("Salvando dispositivo inteligente com ID:", nextId);
        
        database.ref(`users/${USER_ID}/devices/${nextId}`).set(newDevice)
            .then(() => {
                console.log("Dispositivo inteligente salvo no Firebase com ID:", nextId);
                deviceModal.style.display = 'none';
                limitWarning.style.display = 'none';
                deviceName.value = '';
                deviceNumber.value = '';
                hasButton.value = 'no';
            })
            .catch((error) => {
                console.error("Erro ao salvar dispositivo inteligente:", error);
                alert("Erro ao salvar dispositivo: " + error.message);
            });
    } else {
        const nextId = getNextDeviceId(regularDevices);
        console.log("Salvando dispositivo regular com ID:", nextId);
        
        database.ref(`users/${USER_ID}/regularDevices/${nextId}`).set(newDevice)
            .then(() => {
                console.log("Dispositivo regular salvo no Firebase com ID:", nextId);
                deviceModal.style.display = 'none';
                limitWarning.style.display = 'none';
                deviceName.value = '';
                deviceNumber.value = '';
                hasButton.value = 'no';
            })
            .catch((error) => {
                console.error("Erro ao salvar dispositivo regular:", error);
                alert("Erro ao salvar dispositivo: " + error.message);
            });
    }
});

// Fechar modais ao clicar fora deles
window.addEventListener('click', (event) => {
    if (event.target === deviceModal) {
        deviceModal.style.display = 'none';
        limitWarning.style.display = 'none';
    }
    if (event.target === deleteModal) {
        deleteModal.style.display = 'none';
        deviceToDelete = null;
    }
});

// Função para inicializar o dashboard
async function inicializarDashboard() {
    try {
        // Verifica autenticação e obtém USER_ID
        await verificarAutenticacao();
        
        console.log('Dashboard inicializado para usuário:', USER_ID);
        
        // Esconder form de login e mostrar conteúdo principal
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.style.display = 'none';
        }
        
        if (mainContent) {
            mainContent.style.display = 'block';
        }
        
        // Iniciar monitoramento e carregar dispositivos
        startDataMonitoring();
        loadDevicesFromFirebase();
        
        // Renderizar locais
        renderLocations();
        
    } catch (error) {
        console.error('Erro ao inicializar dashboard:', error);
        redirecionarParaLogin();
    }
}

// Função de logout - MÉTODO CORRETO
function logout() {
    console.log('Iniciando logout...');
    
    auth.signOut().then(() => {
        console.log('Firebase signOut bem-sucedido');
        
        // Limpar TODOS os dados de sessão
        sessionStorage.clear();
        localStorage.clear();
        
        // Limpar cookies
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        console.log('Logout realizado com sucesso - sessão limpa');
        
        // Redirecionar para login
        window.location.href = 'login.html';
        
    }).catch((error) => {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao fazer logout: ' + error.message);
    });
}

// Tornar a função logout global para o HTML poder chamar
window.logout = logout;

// Locais - Script para adicionar novo local
let locations = [
    { name: 'São Paulo', cost: 20408, consumption: 25500, emission: 200, active: true },
    { name: 'Rio Claro', cost: 15450, consumption: 18000, emission: 230, active: false },
    { name: 'Campinas', cost: 18350, consumption: 22100, emission: 380, active: false }
];

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
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
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
        locations.push({
            name,
            cost,
            consumption,
            emission,
            active: false
        });
        renderLocations();
        closeLocationModal();
    } else {
        alert('Por favor, preencha todos os campos');
    }
}

// Tornar funções globais para o HTML
window.openLocationModal = openLocationModal;
window.closeLocationModal = closeLocationModal;
window.addLocation = addLocation;

// Event listener do modal de location
const locationModal = document.getElementById('locationModal');
if (locationModal) {
    locationModal.addEventListener('click', function(e) {
        if (e.target === this) {
            closeLocationModal();
        }
    });
}

// Inicializar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando dashboard...');
    inicializarDashboard();
    
    // Event listener para o botão de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        console.log('Botão de logout encontrado, adicionando event listener');
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Botão de logout clicado');
            logout();
        });
    } else {
        console.warn('Botão de logout não encontrado no DOM');
    }
});