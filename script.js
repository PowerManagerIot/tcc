// Configuração do Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyBTPR8X4dRg5fZu_PTj0hwud3bfHtky1S4",
            databaseURL: "https://powermanager-988cc-default-rtdb.firebaseio.com",
            projectId: "powermanager-988cc",
        };

        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        const database = firebase.database();
        const auth = firebase.auth();

        // Elementos da página
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const loginStatus = document.getElementById('loginStatus');
        const loginForm = document.getElementById('loginForm');
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
            
            // Desabilitar opção inteligente se limite atingido
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
            const user = auth.currentUser;
            if (user) {
                const valueRef = database.ref(`users/${user.uid}/esp32/numero`);
                
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
        }

        // Função para carregar dispositivos do Firebase
        function loadDevicesFromFirebase() {
            const user = auth.currentUser;
            if (user) {
                // Carregar dispositivos regulares
                const regularDevicesRef = database.ref(`users/${user.uid}/regularDevices`);
                regularDevicesRef.on('value', (snapshot) => {
                    const data = snapshot.val();
                    regularDevices = data || {};
                    renderDevices();
                    updateSmartDevicesCounter();
                });
                
                // Carregar dispositivos inteligentes (tabela "devices")
                const devicesRef = database.ref(`users/${user.uid}/devices`);
                devicesRef.on('value', (snapshot) => {
                    const data = snapshot.val();
                    smartDevices = data || {};
                    renderDevices();
                    updateSmartDevicesCounter();
                });
            }
        }

        // Função para alternar o estado do dispositivo inteligente
        function toggleDeviceState(deviceKey) {
            // Alternar o estado
            smartDevices[deviceKey].state = !smartDevices[deviceKey].state;
            
            // Atualizar no Firebase (tabela "devices")
            const user = auth.currentUser;
            if (user) {
                database.ref(`users/${user.uid}/devices/${deviceKey}/state`).set(smartDevices[deviceKey].state)
                    .then(() => {
                        console.log("Estado atualizado no Firebase");
                        renderDevices();
                    })
                    .catch((error) => {
                        console.error("Erro ao atualizar estado:", error);
                    });
            }
        }

        // Função para mostrar modal de confirmação de exclusão
        function showDeleteConfirmation(deviceKey, deviceName, isSmart) {
            deviceToDelete = { key: deviceKey, name: deviceName, isSmart: isSmart };
            deviceToDeleteName.textContent = deviceName;
            deleteModal.style.display = 'block';
        }

        // Função para excluir dispositivo
        function deleteDevice() {
            if (!deviceToDelete) return;

            const user = auth.currentUser;
            if (user) {
                const path = deviceToDelete.isSmart 
                    ? `users/${user.uid}/devices/${deviceToDelete.key}`
                    : `users/${user.uid}/regularDevices/${deviceToDelete.key}`;

                database.ref(path).remove()
                    .then(() => {
                        console.log(`Dispositivo ${deviceToDelete.name} excluído com sucesso`);
                        deleteModal.style.display = 'none';
                        deviceToDelete = null;
                        
                        // Mostrar mensagem de sucesso (opcional)
                        connectionStatus.textContent = `Dispositivo "${deviceToDelete?.name || 'dispositivo'}" excluído com sucesso!`;
                        connectionStatus.className = "status connected";
                        
                        // Voltar ao status normal após 3 segundos
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
                
                // Adicionar evento de clique ao botão de exclusão
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
                
                // Adicionar evento de clique ao botão de controle
                const controlBtn = deviceElement.querySelector('.device-btn');
                controlBtn.addEventListener('click', () => toggleDeviceState(key));
                
                // Adicionar evento de clique ao botão de exclusão
                const deleteBtn = deviceElement.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', () => {
                    showDeleteConfirmation(key, device.name, true);
                });
            });

            // Mostrar mensagem se não houver dispositivos
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

        // Evento de login
        loginBtn.addEventListener('click', () => {
            const email = emailInput.value;
            const password = passwordInput.value;
            
            loginStatus.textContent = "Autenticando...";
            loginStatus.style.color = "black";
            
            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    loginStatus.textContent = "Autenticado com sucesso!";
                    loginStatus.style.color = "green";
                    loginForm.style.display = 'none';
                    mainContent.style.display = 'block';
                    startDataMonitoring();
                    loadDevicesFromFirebase();
                })
                .catch((error) => {
                    loginStatus.textContent = "Erro na autenticação: " + error.message;
                    loginStatus.style.color = "red";
                });
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
            // Limpar campos
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
                // NÃO forçar mudança aqui, deixar o usuário ver o aviso
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
            const name = deviceName.value.trim();
            const number = parseInt(deviceNumber.value.trim());
            const isSmart = hasButton.value === 'yes';
            
            if (!name || !number || isNaN(number)) {
                alert("Por favor, preencha todos os campos corretamente.");
                return;
            }
            
            // Verificar limite de dispositivos inteligentes ANTES de tentar salvar
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
                state: false // Estado inicial: desligado
            };
            
            const user = auth.currentUser;
            if (user) {
                if (isSmart) {
                    // Dupla verificação antes de salvar dispositivo inteligente
                    if (smartDeviceCount >= MAX_SMART_DEVICES) {
                        alert(`ERRO: Limite de dispositivos inteligentes atingido (${smartDeviceCount}/${MAX_SMART_DEVICES})`);
                        return;
                    }
                    
                    // Obter próximo ID sequencial para dispositivos inteligentes
                    const nextId = getNextDeviceId(smartDevices);
                    console.log("Salvando dispositivo inteligente com ID:", nextId);
                    
                    database.ref(`users/${user.uid}/devices/${nextId}`).set(newDevice)
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
                    // Obter próximo ID sequencial para dispositivos regulares (sem limite)
                    const nextId = getNextDeviceId(regularDevices);
                    console.log("Salvando dispositivo regular com ID:", nextId);
                    
                    database.ref(`users/${user.uid}/regularDevices/${nextId}`).set(newDevice)
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

        // Verificar se já está autenticado ao carregar a página
        auth.onAuthStateChanged((user) => {
            if (user) {
                loginForm.style.display = 'none';
                mainContent.style.display = 'block';
                startDataMonitoring();
                loadDevicesFromFirebase();
            } else {
                loginForm.style.display = 'block';
                mainContent.style.display = 'none';
            }
        });
        