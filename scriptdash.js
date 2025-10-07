// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBTPR8X4dRg5fZu_PTj0hwud3bfHtky1S4",
    databaseURL: "https://powermanager-988cc-default-rtdb.firebaseio.com",
    projectId: "powermanager-988cc",
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// REMOVER OU COMENTAR A LINHA DE AUTH
// const auth = firebase.auth();

// DEFINIR UM USER ID FIXO (substitua pelo ID real do seu usuário)
const USER_ID = "VXOUd3jgCPTdGZrutzn6Sp9tlGO2"; // Coloque aqui o ID do usuário que você quer usar

// Elementos da página (REMOVER elementos de login)
// const emailInput = document.getElementById('email'); // REMOVIDO
// const passwordInput = document.getElementById('password'); // REMOVIDO
// const loginBtn = document.getElementById('loginBtn'); // REMOVIDO
// const loginStatus = document.getElementById('loginStatus'); // REMOVIDO
// const loginForm = document.getElementById('loginForm'); // REMOVIDO

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


// Função para iniciar monitoramento dos dados - MODIFICADA
function startDataMonitoring() {
    // Usar USER_ID fixo em vez de auth.currentUser
    const valueRef = database.ref(`users/${USER_ID}/esp32/potencia_instantanea`);
    
    valueRef.on('value', (snapshot) => {
        const value = snapshot.val();
        currentValue.textContent = value || '--';

        const now = new Date();
        lastUpdate.textContent = `Última atualização: ${formatDateTime(now)}`;

        connectionStatus.textContent = "Conectado ao Firebase (leitura ativa)";
        connectionStatus.className = "status connected";
    }, (error) => {
        connectionStatus.textContent = "Erro na leitura: " + error.message;
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

        // Função para atualizar a barra
        function updateBar(current, limit) {
            const percent = (current / limit) * 100;
            const displayPercent = Math.min(percent, 100); // Limita a barra visualmente a 100%
            
            powerBar.style.width = displayPercent + '%';
            percentage.textContent = percent.toFixed(1) + '%'; // Mostra porcentagem real, mesmo acima de 100%
            currentPower.textContent = current;
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

        // Monitorar potência instantânea
        function monitorPower() {
            const powerRef = database.ref(`users/${USER_ID}/esp32/s1/potencia`) + database.ref(`users/${USER_ID}/esp32/s2/potencia`);
            
            powerRef.on('value', (snapshot) => {
                currentPowerValue = snapshot.val() || 0;
                console.log("Potência atual:", currentPowerValue);
                updateBar(currentPowerValue, alertLimit);
            }, (error) => {
                console.error("Erro ao monitorar potência:", error);
                status.textContent = "✗ Erro na leitura de potência";
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
    // Usar USER_ID fixo
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

// Função para alternar o estado do dispositivo inteligente - MODIFICADA
function toggleDeviceState(deviceKey) {
    smartDevices[deviceKey].state = !smartDevices[deviceKey].state;
    
    // Usar USER_ID fixo
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

// Função para excluir dispositivo - MODIFICADA
function deleteDevice() {
    if (!deviceToDelete) return;

    // Usar USER_ID fixo
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

// Função para renderizar os dispositivos (mantém igual)
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

// REMOVER evento de login - toda essa parte foi removida
/* 
loginBtn.addEventListener('click', () => {
    // CÓDIGO DE LOGIN REMOVIDO
});
*/

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

// Evento para confirmar novo dispositivo - MODIFICADO
confirmBtn.addEventListener('click', () => {
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
    
    // Usar USER_ID fixo
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

// MODIFICAR - Iniciar aplicação diretamente sem verificar autenticação
document.addEventListener('DOMContentLoaded', function() {
    // Esconder form de login e mostrar conteúdo principal diretamente
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.style.display = 'none';
    }
    
    mainContent.style.display = 'block';
    
    // Iniciar monitoramento e carregar dispositivos
    startDataMonitoring();
    loadDevicesFromFirebase();
    
    // Renderizar locais também
    renderLocations();
});

// REMOVER verificação de autenticação
/*
auth.onAuthStateChanged((user) => {
    // CÓDIGO DE VERIFICAÇÃO REMOVIDO
});
*/

// Script - Adicionar novo local (mantém igual)
let locations = [
    { name: 'São Paulo', cost: 20408, consumption: 25500, emission: 200, active: true },
    { name: 'Rio Claro', cost: 15450, consumption: 18000, emission: 230, active: false },
    { name: 'Campinas', cost: 18350, consumption: 22100, emission: 380, active: false }
];

function renderLocations() {
    const container = document.getElementById('locationsContainer');
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
    document.getElementById('locationModal').classList.remove('hidden');
}

function closeLocationModal() {
    document.getElementById('locationModal').classList.add('hidden');
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

document.getElementById('locationModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeLocationModal();
    }
});