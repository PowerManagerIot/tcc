tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'bg-primary': '#0a0a0a',
                        'bg-secondary': '#1a1a1a',
                        'bg-card': '#1e1e1e',
                        'accent-green': '#00ff2a',
                        'accent-red': '#ef4444',
                        'border-dark': '#333333'
                    }
                }
            }
        }

// Dados iniciais dos locais
        let locations = [
            { name: 'São Paulo', cost: 20408, consumption: 25500, emission: 200, active: true },
            { name: 'Rio Claro', cost: 15450, consumption: 18000, emission: 230, active: false },
            { name: 'Campinas', cost: 18350, consumption: 22100, emission: 380, active: false }
        ];

        // Renderizar locais iniciais
        function renderLocations() {
            const container = document.getElementById('locationsContainer');
            const addButton = container.querySelector('div:last-child');
            
            // Limpar container mantendo apenas o botão de adicionar
            while (container.firstChild && container.firstChild !== addButton) {
                container.removeChild(container.firstChild);
            }
            
            // Adicionar cada local
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

        // Definir local ativo
        function setActiveLocation(index) {
            locations = locations.map((loc, i) => ({ ...loc, active: i === index }));
            renderLocations();
        }

        // Modal functions
        function openLocationModal() {
            document.getElementById('locationModal').classList.remove('hidden');
        }

        function closeLocationModal() {
            document.getElementById('locationModal').classList.add('hidden');
            // Limpar campos
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
            
            if (name !== "" && !isNaN(cost) && !isNaN(consumption) && !isNaN(emission)) {
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

        // Configuração do Chart.js
        let chart;
        let currentView = 'month';

        // Dados para diferentes visualizações
        const chartData = {
            day: {
                labels: ['00h', '02h', '04h', '06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h', '22h'],
                data: [450, 380, 320, 280, 520, 680, 890, 920, 850, 780, 650, 480],
                total: 7700,
                average: 641,
                peak: 920
            },
            month: {
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
                data: [18500, 17200, 19800, 21000, 22500, 24800, 26200, 25500, 23800, 22100, 20400, 19200],
                total: 261000,
                average: 21750,
                peak: 26200
            },
            year: {
                labels: ['2019', '2020', '2021', '2022', '2023', '2024'],
                data: [180000, 195000, 210000, 235000, 248000, 261000],
                total: 1329000,
                average: 221500,
                peak: 261000
            }
        };

        function initChart() {
            const ctx = document.getElementById('consumptionChart').getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(0, 255, 42, 0.3)');
            gradient.addColorStop(1, 'rgba(0, 255, 42, 0.01)');

            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.month.labels,
                    datasets: [{
                        label: 'Consumo (kWh)',
                        data: chartData.month.data,
                        borderColor: '#00ff2a',
                        backgroundColor: gradient,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#00ff2a',
                        pointBorderColor: '#0a0a0a',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: '#1e1e1e',
                            titleColor: '#00ff2a',
                            bodyColor: '#ffffff',
                            borderColor: '#333333',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            callbacks: {
                                label: function(context) {
                                    return `Consumo: ${context.parsed.y.toLocaleString('pt-BR')} kWh`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: '#333333',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#888888'
                            }
                        },
                        y: {
                            grid: {
                                color: '#333333',
                                drawBorder: false
                            },
                            ticks: {
                                color: '#888888',
                                callback: function(value) {
                                    return value.toLocaleString('pt-BR') + ' kWh';
                                }
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });

            updateStats('month');
        }

        function updateChart(view) {
            currentView = view;
            
            // Atualizar botões
            document.querySelectorAll('#btnDay, #btnMonth, #btnYear').forEach(btn => {
                btn.classList.remove('bg-accent-green', 'text-black', 'border-accent-green');
                btn.classList.add('border-border-dark', 'text-gray-400');
            });
            
            const activeBtn = document.getElementById('btn' + view.charAt(0).toUpperCase() + view.slice(1));
            activeBtn.classList.remove('border-border-dark', 'text-gray-400');
            activeBtn.classList.add('bg-accent-green', 'text-black', 'border-accent-green');
            
            // Atualizar dados do gráfico
            chart.data.labels = chartData[view].labels;
            chart.data.datasets[0].data = chartData[view].data;
            
            // Ajustar tipo de gráfico baseado na visualização
            if (view === 'day') {
                chart.config.type = 'line';
                chart.data.datasets[0].tension = 0.4;
                chart.data.datasets[0].fill = true;
            } else if (view === 'month') {
                chart.config.type = 'bar';
                chart.data.datasets[0].backgroundColor = '#00ff2a';
                chart.data.datasets[0].borderRadius = 4;
            } else {
                chart.config.type = 'line';
                chart.data.datasets[0].tension = 0.2;
                chart.data.datasets[0].fill = true;
            }
            
            chart.update('active');
            updateStats(view);
        }

        function updateStats(view) {
            document.getElementById('totalConsumption').textContent = chartData[view].total.toLocaleString('pt-BR') + ' kWh';
            document.getElementById('averageConsumption').textContent = chartData[view].average.toLocaleString('pt-BR') + ' kWh';
            document.getElementById('peakConsumption').textContent = chartData[view].peak.toLocaleString('pt-BR') + ' kWh';
        }

        // Inicializar ao carregar a página
        document.addEventListener('DOMContentLoaded', function() {
            renderLocations();
            initChart();
        });

        // Fechar modal ao clicar fora
        document.getElementById('locationModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeLocationModal();
            }
        });