// ====== IMPORTAR AUTH ======
import { auth, database } from './auth.js';

// ====== VARIÁVEIS GLOBAIS ======
let USER_ID = null;
const alertsContainer = document.getElementById("alertsContainer");
const connectionStatus = document.getElementById("connectionStatus");
const logoutBtn = document.getElementById("logoutBtn");
let currentEditId = null;
let currentAlerts = {};

// ====== FUNÇÕES DE STATUS ======
function updateConnectionStatus(message, isConnected = true) {
  if (connectionStatus) {
    connectionStatus.innerHTML = `
      <div class="w-2 h-2 ${isConnected ? 'bg-accent-green' : 'bg-accent-red'} rounded-full ${isConnected ? 'animate-pulse' : ''}"></div>
      <span class="text-sm">${message}</span>
    `;
  }
}

// ====== VERIFICAR AUTENTICAÇÃO ======
function verificarAutenticacao() {
  return new Promise((resolve, reject) => {
    const storedUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') || localStorage.getItem('isLoggedIn');
    
    if (storedUserId && isLoggedIn === 'true') {
      USER_ID = storedUserId;
      console.log('✅ Usuário recuperado do storage:', USER_ID);
      resolve(USER_ID);
    } else {
      auth.onAuthStateChanged((user) => {
        if (user) {
          USER_ID = user.uid;
          console.log('✅ Usuário autenticado:', USER_ID);
          
          sessionStorage.setItem('userId', user.uid);
          sessionStorage.setItem('userEmail', user.email);
          sessionStorage.setItem('isLoggedIn', 'true');
          
          resolve(USER_ID);
        } else {
          console.log('❌ Nenhum usuário autenticado');
          reject('Usuário não autenticado');
        }
      });
    }
  });
}

// ====== REDIRECIONAR PARA LOGIN ======
function redirecionarParaLogin() {
  alert('Sessão expirada. Por favor, faça login novamente.');
  sessionStorage.clear();
  localStorage.clear();
  
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  
  window.location.href = 'login.html';
}

// ====== LOGOUT ======
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

// === MODAL ===
window.openAlertModal = function(editId = null) {
  const modal = document.getElementById("alertModal");
  const title = document.getElementById("alertModalTitle");
  const saveBtn = document.getElementById("saveAlertBtn");

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  if (editId) {
    currentEditId = editId;
    title.textContent = "Editar Alerta";
    saveBtn.textContent = "Salvar Alterações";
    loadAlertData(editId);
  } else {
    currentEditId = null;
    title.textContent = "Criar Novo Alerta";
    saveBtn.textContent = "Salvar";
    document.getElementById("alertName").value = "";
    document.getElementById("alertLimit").value = "";
    document.getElementById("alertType").value = "Consumo em tempo real";
  }
}

window.closeAlertModal = function() {
  document.getElementById("alertModal").classList.add("hidden");
  document.getElementById("alertModal").classList.remove("flex");
}

// === SALVAR ===
window.saveAlert = function() {
  if (!USER_ID) {
    alert('Erro: Usuário não identificado. Por favor, faça login novamente.');
    redirecionarParaLogin();
    return;
  }

  const name = document.getElementById("alertName").value.trim();
  const limit = parseFloat(document.getElementById("alertLimit").value);
  const type = document.getElementById("alertType").value;

  if (!name || isNaN(limit) || limit <= 0) {
    alert("Por favor, preencha todos os campos corretamente!");
    return;
  }

  const data = { name, limit, type, timestamp: Date.now() };
  const ref = database.ref(`users/${USER_ID}/alerts`);

  if (currentEditId) {
    // Ao editar, verificar se mudou o tipo
    const currentAlert = currentAlerts[currentEditId];
    if (currentAlert && currentAlert.type !== type) {
      // Verificar se já existe outro alerta com o novo tipo
      const existingType = Object.entries(currentAlerts).find(
        ([id, a]) => a.type === type && id !== currentEditId
      );
      
      if (existingType) {
        alert(`Já existe um alerta do tipo "${type}". Você só pode ter um alerta de cada tipo.`);
        return;
      }
    }
    
    ref.child(currentEditId)
      .update(data)
      .then(() => {
        window.closeAlertModal();
        updateConnectionStatus("Alerta atualizado com sucesso!", true);
        setTimeout(() => {
          updateConnectionStatus("Conectado ao Firebase", true);
        }, 3000);
        console.log("✅ Alerta atualizado");
      })
      .catch(err => {
        console.error("❌ Erro ao atualizar:", err);
        updateConnectionStatus("Erro ao atualizar alerta", false);
        alert("Erro ao atualizar alerta: " + err.message);
      });
  } else {
    // Verificar se já existe alerta do mesmo tipo
    const existingType = Object.values(currentAlerts).find(a => a.type === type);
    
    if (existingType) {
      alert(`Já existe um alerta do tipo "${type}". Você só pode ter um alerta de cada tipo.`);
      return;
    }
    
    ref
      .push(data)
      .then(() => {
        window.closeAlertModal();
        updateConnectionStatus("Alerta criado com sucesso!", true);
        setTimeout(() => {
          updateConnectionStatus("Conectado ao Firebase", true);
        }, 3000);
        console.log("✅ Alerta criado");
      })
      .catch(err => {
        console.error("❌ Erro ao criar:", err);
        updateConnectionStatus("Erro ao criar alerta", false);
        alert("Erro ao criar alerta: " + err.message);
      });
  }
}

// === LISTAR ===
function loadAlerts() {
  if (!USER_ID) {
    console.error('❌ USER_ID não definido');
    return;
  }

  updateConnectionStatus("Carregando alertas...", true);

  const ref = database.ref(`users/${USER_ID}/alerts`);
  ref.on("value", snap => {
    currentAlerts = snap.val() || {};
    renderAlerts(currentAlerts);
    updateConnectionStatus("Conectado ao Firebase", true);
  }, (error) => {
    console.error("❌ Erro ao carregar alertas:", error);
    updateConnectionStatus("Erro ao conectar: " + error.message, false);
    alertsContainer.innerHTML = `
      <div class="text-center py-8">
        <i class="ph ph-warning-circle text-4xl mb-3 block text-accent-red"></i>
        <p class="text-accent-red">Erro ao carregar alertas: ${error.message}</p>
      </div>
    `;
  });
}

function renderAlerts(alerts) {
  alertsContainer.innerHTML = "";
  const keys = Object.keys(alerts);
  
  if (keys.length === 0) {
    alertsContainer.innerHTML = `
      <div class="text-center py-8">
        <i class="ph ph-bell-slash text-4xl mb-3 block text-gray-600"></i>
        <p class="text-gray-400 mb-2">Nenhum alerta criado ainda</p>
        <p class="text-sm text-gray-500">Clique em "Criar Novo Alerta" para começar</p>
      </div>
    `;
    return;
  }

  keys.forEach(id => {
    const a = alerts[id];
    const isRealTime = a.type === "Consumo em tempo real";
    const color = isRealTime ? "accent-yellow" : "blue-400";
    const icon = isRealTime ? "ph-lightning" : "ph-chart-line-up";
    const bgColor = isRealTime ? "bg-accent-yellow/10" : "bg-blue-500/10";
    const borderColor = isRealTime ? "border-accent-yellow/30" : "border-blue-500/30";
    const unit = isRealTime ? "W" : "kWh";
    const date = new Date(a.timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const alertDiv = document.createElement('div');
    alertDiv.className = `bg-bg-secondary border ${borderColor} rounded-xl p-4 hover:border-accent-green transition-all duration-300 transform hover:-translate-y-1`;
    alertDiv.innerHTML = `
      <div class="flex justify-between items-start">
        <div class="flex gap-4 flex-1">
          <div class="w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0">
            <i class="ph ${icon} text-${color} text-2xl"></i>
          </div>
          <div class="flex-1">
            <div class="flex items-start justify-between mb-2">
              <h4 class="font-semibold text-lg">${a.name}</h4>
            </div>
            <div class="space-y-1">
              <p class="text-sm text-gray-400">
                <span class="text-${color} font-semibold">${a.limit} ${unit}</span> • 
                <span class="text-${color}">${a.type}</span>
              </p>
              <p class="text-xs text-gray-500">
                <i class="ph ph-clock"></i> Criado em ${date}
              </p>
            </div>
          </div>
        </div>
        <div class="flex gap-2 ml-4">
          <button onclick="openAlertModal('${id}')" 
                  class="w-10 h-10 bg-bg-card border border-border-dark rounded-lg hover:bg-accent-yellow/10 hover:border-accent-yellow transition-all flex items-center justify-center"
                  title="Editar">
            <i class="ph ph-pencil-simple text-accent-yellow"></i>
          </button>
          <button onclick="deleteAlert('${id}')" 
                  class="w-10 h-10 bg-bg-card border border-border-dark rounded-lg hover:bg-accent-red/10 hover:border-accent-red transition-all flex items-center justify-center"
                  title="Excluir">
            <i class="ph ph-trash text-accent-red"></i>
          </button>
        </div>
      </div>
    `;
    alertsContainer.appendChild(alertDiv);
  });
}

// === CARREGAR PARA EDIÇÃO ===
function loadAlertData(id) {
  if (!USER_ID) return;
  
  database.ref(`users/${USER_ID}/alerts/${id}`).once("value").then(snap => {
    const a = snap.val();
    if (a) {
      document.getElementById("alertName").value = a.name;
      document.getElementById("alertLimit").value = a.limit;
      document.getElementById("alertType").value = a.type;
      
      // Atualizar descrição e unidade
      const typeDescription = document.getElementById('typeDescription');
      const limitUnit = document.getElementById('limitUnit');
      if (a.type === 'Consumo em tempo real') {
        typeDescription.textContent = 'Monitora o consumo instantâneo em Watts';
        limitUnit.textContent = '(W)';
      } else {
        typeDescription.textContent = 'Monitora o consumo acumulado mensal em kWh';
        limitUnit.textContent = '(kWh)';
      }
    }
  });
}

// === EXCLUIR ===
window.deleteAlert = function(id) {
  if (!USER_ID) {
    alert('Erro: Usuário não identificado. Por favor, faça login novamente.');
    redirecionarParaLogin();
    return;
  }

  const alertName = currentAlerts[id]?.name || 'este alerta';
  
  if (confirm(`Tem certeza que deseja excluir o alerta "${alertName}"?\n\nEsta ação não pode ser desfeita.`)) {
    database.ref(`users/${USER_ID}/alerts/${id}`)
      .remove()
      .then(() => {
        updateConnectionStatus("Alerta excluído com sucesso!", true);
        setTimeout(() => {
          updateConnectionStatus("Conectado ao Firebase", true);
        }, 3000);
        console.log("✅ Alerta excluído");
      })
      .catch(err => {
        console.error("❌ Erro ao excluir:", err);
        updateConnectionStatus("Erro ao excluir alerta", false);
        alert("Erro ao excluir alerta: " + err.message);
      });
  }
}

// === FECHAR MODAL AO CLICAR FORA ===
window.addEventListener('click', (event) => {
  const modal = document.getElementById('alertModal');
  if (event.target === modal) {
    window.closeAlertModal();
  }
});

// === INICIALIZAR ===
async function inicializarAlertas() {
  try {
    await verificarAutenticacao();
    console.log('✅ Alertas inicializados para usuário:', USER_ID);
    loadAlerts();
  } catch (error) {
    console.error('❌ Erro ao inicializar alertas:', error);
    redirecionarParaLogin();
  }
}

// === EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM carregado, inicializando alertas...');
  inicializarAlertas();
  
  // Botão de logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }
});