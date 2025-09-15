#define PINO_SENSOR 34
#define AMAX 100.0      // Corrente máxima do sensor
#define VMAX 3.3        // Tensão máxima no ADC
#define ADC_MAX 4095.0  // Resolução do ADC ESP32

void setup() {
  Serial.begin(115200);
}

void loop() {
  const int N = 500;  // Número de amostras
  float somaQuad = 0;

  for (int i = 0; i < N; i++) {
    int leitura = analogRead(PINO_SENSOR);
    float tensao = leitura * (VMAX / ADC_MAX);
    tensao -= 1.65;   // Remove offset do ponto médio
    somaQuad += tensao * tensao;
    delayMicroseconds(100); // ~10kHz
  }

  float vRMS = sqrt(somaQuad / N);
  float correnteRMS = (vRMS / VMAX) * AMAX;  // Ajusta para sensor 100A
  Serial.print("Corrente RMS: ");
  Serial.print(correnteRMS, 2);
  Serial.println(" A");

  delay(1000);
}





