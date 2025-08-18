import { useState, useEffect } from 'react';
import { Calendar, Zap, TrendingUp } from 'lucide-react';

const EnergyConsumptionChart = () => {
  const [viewMode, setViewMode] = useState('dia');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [animatedValues, setAnimatedValues] = useState([]);

  // Dados simulados para demonstração
  const data = {
    dia: {
      labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
      values: [45, 52, 38, 61, 48, 71, 35],
      unit: 'kWh',
      period: 'Última Semana'
    },
    semana: {
      labels: ['S1', 'S2', 'S3', 'S4'],
      values: [320, 285, 410, 375],
      unit: 'kWh',
      period: 'Último Mês'
    },
    mes: {
      labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
      values: [1250, 1180, 1320, 1450, 1380, 1520, 1680, 1590, 1420, 1350, 1280, 1400],
      unit: 'kWh',
      period: '2024'
    }
  };

  const currentData = data[viewMode];
  const maxValue = Math.max(...currentData.values);

  // Animação das barras
  useEffect(() => {
    // Reset todas as barras para 0
    setAnimatedValues(new Array(currentData.values.length).fill(0));
    setSelectedIndex(null);
    
    // Anima as barras uma por uma com delay
    currentData.values.forEach((value, index) => {
      setTimeout(() => {
        setAnimatedValues(prev => {
          const newValues = [...prev];
          newValues[index] = value;
          return newValues;
        });
      }, 200 + (index * 150)); // Delay escalonado para cada barra
    });
  }, [viewMode]);

  const getBarHeight = (value, index) => {
    const animatedValue = animatedValues[index] || 0;
    return (animatedValue / maxValue) * 100;
  };

  const getBarColor = (index) => {
    if (selectedIndex === index) {
      return 'bg-gradient-to-t from-yellow-400 via-yellow-300 to-yellow-200';
    }
    return 'bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400';
  };

  const handleBarClick = (index) => {
    setSelectedIndex(selectedIndex === index ? null : index);
  };

  const getConsumptionLevel = (value) => {
    const percentage = (value / maxValue) * 100;
    if (percentage > 80) return { level: 'Alto', color: 'text-red-500' };
    if (percentage > 50) return { level: 'Médio', color: 'text-yellow-500' };
    return { level: 'Baixo', color: 'text-green-500' };
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Consumo de Energia</h1>
            <p className="text-gray-600">{currentData.period}</p>
          </div>
        </div>

        {/* Botões de período */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
          {['dia', 'semana', 'mes'].map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setSelectedIndex(null);
              }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === mode
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Informações do item selecionado */}
      {selectedIndex !== null && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">
                {currentData.labels[selectedIndex]}
              </h3>
              <p className="text-2xl font-bold text-blue-600">
                {currentData.values[selectedIndex]} {currentData.unit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Nível de Consumo</p>
              <p className={`font-semibold ${getConsumptionLevel(currentData.values[selectedIndex]).color}`}>
                {getConsumptionLevel(currentData.values[selectedIndex]).level}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6 relative">
        <div className="flex items-end justify-between h-96 gap-4">
          {currentData.labels.map((label, index) => (
            <div key={index} className="flex flex-col items-center flex-1 max-w-20">
              <div className="flex-1 flex items-end w-full relative">
                {/* Valor no topo da barra */}
                {animatedValues[index] > 0 && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap font-semibold">
                      {animatedValues[index]} {currentData.unit}
                    </div>
                  </div>
                )}
                <div
                  className={`w-full rounded-t-lg cursor-pointer transition-all duration-1000 ease-out hover:opacity-80 hover:scale-105 relative ${getBarColor(index)}`}
                  style={{
                    height: `${getBarHeight(currentData.values[index], index)}%`,
                    minHeight: animatedValues[index] > 0 ? '20px' : '4px',
                    transform: selectedIndex === index ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: selectedIndex === index ? '0 8px 25px rgba(59, 130, 246, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                  onClick={() => handleBarClick(index)}
                >
                  {/* Efeito de brilho na barra */}
                  <div className="absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg"></div>
                </div>
              </div>
              <div className="mt-4 text-sm font-semibold text-gray-700">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Linha de referência e grid */}
        <div className="mt-6 pt-4 border-t border-gray-300">
          <div className="flex justify-between text-sm text-gray-600 font-medium">
            <span>0 {currentData.unit}</span>
            <span className="text-gray-800 font-semibold">{Math.round(maxValue)} {currentData.unit}</span>
          </div>
          {/* Grid lines */}
          <div className="absolute inset-x-6 top-6 bottom-16 pointer-events-none">
            {[...Array(4)].map((_, i) => (
              <div 
                key={i}
                className="absolute w-full border-t border-gray-200/60"
                style={{ bottom: `${(i + 1) * 20}%` }}
              ></div>
            ))}
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-green-700">Média</p>
              <p className="font-bold text-green-800">
                {Math.round(currentData.values.reduce((a, b) => a + b, 0) / currentData.values.length)} {currentData.unit}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-blue-700">Total</p>
              <p className="font-bold text-blue-800">
                {currentData.values.reduce((a, b) => a + b, 0)} {currentData.unit}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-sm text-purple-700">Máximo</p>
              <p className="font-bold text-purple-800">
                {Math.max(...currentData.values)} {currentData.unit}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <p className="text-sm text-gray-700 text-center font-medium">
          🎯 Clique nos botões Dia/Semana/Mês para ver as barras subirem | 💡 Clique nas barras para ver detalhes
        </p>
      </div>
    </div>
  );
};

export default EnergyConsumptionChart;