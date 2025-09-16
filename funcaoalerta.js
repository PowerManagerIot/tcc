// Lista de alertas cadastrados
let alerts = [];

// Função para criar um alerta
function createAlert() {
    const alertName = prompt("Digite o nome do alerta:");
    if (!alertName) return;

    const alertType = prompt("Digite o tipo do alerta (notificacao ou automacao):").toLowerCase();
    if (alertType !== "notificacao" && alertType !== "automacao") {
        alert("Tipo inválido! Use 'notificacao' ou 'automacao'.");
        return;
    }

    const alertValue = parseFloat(prompt("Digite o valor de consumo (kWh) que vai disparar o alerta:"));
    if (isNaN(alertValue)) {
        alert("Valor inválido!");
        return;
    }

    const newAlert = { name: alertName, type: alertType, value: alertValue };
    alerts.push(newAlert);
    alert(`Alerta "${alertName}" do tipo "${alertType}" criado com sucesso!`);

    // Atualiza a lista de alertas na página
    renderAlerts();
}

// Função para mostrar os alertas na tela
function renderAlerts() {
    const alertsContainer = document.getElementById("alertsContainer");
    if (!alertsContainer) return;

    alertsContainer.innerHTML = ""; // limpa os alertas anteriores

    alerts.forEach((alertObj, index) => {
        const alertDiv = document.createElement("div");
        alertDiv.className = "bg-bg-card border border-border-dark rounded-xl p-4 mb-2 flex justify-between items-center";
        alertDiv.innerHTML = `
            <div>
                <strong>${alertObj.name}</strong> - <span>${alertObj.type}</span> - <span>${alertObj.value} kWh</span>
            </div>
            <button onclick="removeAlert(${index})" class="px-2 py-1 bg-red-500 text-white rounded">Remover</button>
        `;
        alertsContainer.appendChild(alertDiv);
    });
}

// Função para remover um alerta
function removeAlert(index) {
    alerts.splice(index, 1);
    renderAlerts();
}

// Função para checar consumo e disparar alertas
function checkConsumption(currentConsumption) {
    alerts.forEach(alertObj => {
        if (currentConsumption >= alertObj.value) {
            if (alertObj.type === "notificacao") {
                // Mostra notificação no navegador
                if (Notification.permission === "granted") {
                    new Notification(`Alerta: ${alertObj.name}`, {
                        body: `Consumo atingiu ${currentConsumption} kWh!`,
                        icon: "img/iconsemfundo.png"
                    });
                } else {
                    alert(`Alerta: ${alertObj.name} - Consumo atingiu ${currentConsumption} kWh!`);
                }
            } else if (alertObj.type === "automacao") {
                // Aqui você faria a chamada para desligar dispositivos
                console.log(`Automação disparada! Desligando dispositivos por alerta: ${alertObj.name}`);
                // Exemplo: desligarReles();
            }
        }
    });
}

// Pedir permissão para notificação assim que carregar a página
if ("Notification" in window) {
    Notification.requestPermission();
}
