#define PINO_SENSOR 34
const float VREF = 3.3f;
const float ADC_MAX = 4095.0f;

const float AMPS_PER_VOLT = 30.0f;   // ajustar: 30.0 para SCT-013 30A/1V
const float LINE_VOLTAGE = 220.0f;   // ajustar para sua rede
const int SAMPLES = 500;             // amostras por janela RMS
const float EMA_ALPHA = 0.005f;      // 0.005 = filtro lento (mais estável)

/* --- não mexer abaixo se não souber --- */
float offsetEMA = VREF / 2.0f;   // valor inicial do offset (meio da escala)

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // 12-bit ADC
  // Garanta atenuação para ler até ~3.3V no ESP32 (ajusta faixa)
  #if defined(ARDUINO_ARCH_ESP32)
    analogSetPinAttenuation(PINO_SENSOR, ADC_11db); // permite ~0-3.3V
  #endif
  delay(200);
  Serial.println("Medidor de corrente (offset automatico) iniciado");
}

void loop() {
  float somaQuad = 0.0f;

  for (int i = 0; i < SAMPLES; i++) {
    int leitura = analogRead(PINO_SENSOR);
    float tensao = ( (float)leitura / ADC_MAX ) * VREF;

    // Atualiza offset com EMA (filtro exponencial)
    offsetEMA = (1.0f - EMA_ALPHA) * offsetEMA + EMA_ALPHA * tensao;

    // Sinal AC estimado subtraindo o offset atual
    float ac = tensao - offsetEMA;

    somaQuad += ac * ac;

    // controle de taxa de amostragem: aprox. 10 kHz -> delayMicroseconds(100)
    // ajuste conforme necessário. Não use delay() aqui.
    delayMicroseconds(100); // ~10 kHz
  }

  float vRMS = sqrt(somaQuad / (float)SAMPLES);
  float correnteRMS = vRMS * AMPS_PER_VOLT;
  float potencia = correnteRMS * LINE_VOLTAGE;

  // Impressão
  Serial.print("Offset (V): ");
  Serial.print(offsetEMA, 4);
  Serial.print("  |  vRMS (V): ");
  Serial.print(vRMS, 4);
  Serial.print("  |  I_RMS (A): ");
  Serial.print(correnteRMS, 3);
  Serial.print("  |  P_est (W): ");
  Serial.println(potencia, 1);

  delay(500); // esperar meio segundo entre janelas (ajuste se quiser)
}
