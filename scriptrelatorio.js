let consumptionChart; // variável global pro gráfico

function openLocationModal() {
    // Cria um modal simples com prompt
    const reportName = prompt("Digite o nome do relatório:");
    if (!reportName) return;

    const period = prompt("Digite o período (ex: Dia, Mês, Ano):");
    if (!period) return;

    // Gera dados falsos pro gráfico (você pode depois trocar pelos dados reais do backend)
    generateReport(reportName, period);
}

function generateReport(reportName, period) {
    const labels = [];
    const data = [];

    if (period.toLowerCase() === "dia") {
        for (let i = 1; i <= 24; i++) {
            labels.push(i + "h");
            data.push(Math.floor(Math.random() * 10) + 1); // consumo aleatório
        }
    } else if (period.toLowerCase() === "mês") {
        for (let i = 1; i <= 30; i++) {
            labels.push("Dia " + i);
            data.push(Math.floor(Math.random() * 100) + 20);
        }
    } else {
        for (let i = 1; i <= 12; i++) {
            labels.push("Mês " + i);
            data.push(Math.floor(Math.random() * 500) + 100);
        }
    }

    // Se já existir um gráfico, destrói antes de criar outro
    if (consumptionChart) {
        consumptionChart.destroy();
    }

    const ctx = document.getElementById("consumptionChart").getContext("2d");
    consumptionChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: reportName + " - " + period,
                data: data,
                borderColor: "#22c55e",
                backgroundColor: "rgba(34,197,94,0.2)",
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: "white" } }
            },
            scales: {
                x: { ticks: { color: "white" } },
                y: { ticks: { color: "white" } }
            }
        }
    });

    // Atualiza estatísticas
    const total = data.reduce((a, b) => a + b, 0);
    const avg = (total / data.length).toFixed(2);
    const peak = Math.max(...data);

    document.getElementById("totalConsumption").innerText = total + " kWh";
    document.getElementById("averageConsumption").innerText = avg + " kWh";
    document.getElementById("peakConsumption").innerText = peak + " kWh";
}
