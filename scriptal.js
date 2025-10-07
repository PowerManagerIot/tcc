// ====== IMPORTAR AUTH ======
import { auth, database } from './auth.js';

// ====== VARIÁVEIS GLOBAIS ======
let USER_ID = null;
const alertsContainer = document.getElementById("alertsContainer");
let currentEditId = null;
let currentAlerts = {};

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
    title.textContent = "Criar Alerta";
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

  if (!name || isNaN(limit)) {
    alert("Preencha todos os campos!");
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
        console.log("✅ Alerta atualizado");
      })
      .catch(err => {
        console.error("❌ Erro ao atualizar:", err);
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
        console.log("✅ Alerta criado");
      })
      .catch(err => {
        console.error("❌ Erro ao criar:", err);
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

  const ref = database.ref(`users/${USER_ID}/alerts`);
  ref.on("value", snap => {
    currentAlerts = snap.val() || {};
    renderAlerts(currentAlerts);
  }, (error) => {
    console.error("❌ Erro ao carregar alertas:", error);
    alertsContainer.innerHTML = `<p class="text-red-400">Erro ao carregar alertas: ${error.message}</p>`;
  });
}

function renderAlerts(alerts) {
  alertsContainer.innerHTML = "";
  const keys = Object.keys(alerts);
  if (keys.length === 0) {
    alertsContainer.innerHTML = `<p class="text-gray-400">Nenhum alerta criado ainda.</p>`;
    return;
  }

  keys.forEach(id => {
    const a = alerts[id];
    const color = a.type === "Consumo em tempo real" ? "text-yellow-400" : "text-blue-400";
    const date = new Date(a.timestamp).toLocaleString('pt-BR');

    const alertDiv = document.createElement('div');
    alertDiv.className = "flex justify-between items-center bg-[#1e1e1e] border border-[#333] p-4 rounded-xl";
    alertDiv.innerHTML = `
      <div>
        <p class="font-semibold">${a.name}</p>
        <p class="text-sm text-gray-400">Limite: ${a.limit} kWh • Tipo: <span class="${color}">${a.type}</span></p>
        <p class="text-xs text-gray-500">Criado em: ${date}</p>
      </div>
      <div class="flex gap-3">
        <button onclick="openAlertModal('${id}')" class="text-yellow-400 hover:text-yellow-300">✏️</button>
        <button onclick="deleteAlert('${id}')" class="text-red-500 hover:text-red-400">🗑️</button>
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

  if (confirm("Deseja realmente excluir este alerta?")) {
    database.ref(`users/${USER_ID}/alerts/${id}`)
      .remove()
      .then(() => {
        console.log("✅ Alerta excluído");
      })
      .catch(err => {
        console.error("❌ Erro ao excluir:", err);
        alert("Erro ao excluir alerta: " + err.message);
      });
  }
}

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

// === CARREGAR AO INICIAR ===
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM carregado, inicializando alertas...');
  inicializarAlertas();
});