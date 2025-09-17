let consumptionChart; // variável global pro gráfico

import { getFirestore, collection, query, where, orderBy, getDocs } from "firebase/firestore";

const db = getFirestore();
let consumptionChart = null;

async function openLocationModal() {
    const reportName = prompt("Digite o nome do relatório:");
    if (!reportName) return;

    const period = prompt("Digite o período (ex: Dia, Mês, Ano):");
    if (!period) return;

    await generateReport(reportName, period);
}

async function generateReport(reportName, period) {
    const labels = [];
    const data = [];

    try {
        const q = query(
            collection(db, "consumptionData"),
            orderBy("timestamp", "asc")
        );

        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const entry = doc.data();

            const date = new Date(entry.timestamp);

            if (period.toLowerCase() === "dia") {
                labels.push(date.getHours() + "h");
            } else if (period.toLowerCase() === "mês") {
                labels.push("Dia " + date.getDate());
            } else {
                labels.push("Mês " + (date.getMonth() + 1));
            }

            data.push(entry.consumption);
        });

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

        const total = data.reduce((a, b) => a + b, 0);
        const avg = (total / data.length).toFixed(2);
        const peak = Math.max(...data);

        document.getElementById("totalConsumption").innerText = total + " kWh";
        document.getElementById("averageConsumption").innerText = avg + " kWh";
        document.getElementById("peakConsumption").innerText = peak + " kWh";

    } catch (error) {
        console.error("Erro ao buscar dados do Firebase:", error);
        alert("Não foi possível carregar o relatório. Verifique o console.");
    }
}
