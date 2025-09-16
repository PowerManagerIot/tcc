#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Bibliotecas auxiliares do Firebase
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ==== CONFIGURAÇÕES DE REDE ====
#define WIFI_SSID "SEU_WIFI"
#define WIFI_PASSWORD "SUA_SENHA"

// ==== CONFIGURAÇÕES DO FIREBASE ====
#define API_KEY "SUA_API_KEY"
#define DATABASE_URL "https://SEU_PROJETO.firebaseio.com/" 

// Objetos Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Controle de tempo
unsigned long sendDataPrevMillis = 0;
unsigned long acumuloPrevMillis = 0;

// Variáveis de acumulação
float somaConsumo = 0;
int intervaloEnvio = 5000; // 5 segundos

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);

  // Conectar ao Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\nWi-Fi conectado!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // Config Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Login anônimo (ou pode ser com email/senha)
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Login anônimo OK!");
  } else {
    Serial.printf("Erro no signup: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (Firebase.ready()) {

    // Acumular leituras continuamente (1 vez por segundo, pode ajustar)
    if (millis() - acumuloPrevMillis >= 1000) {
      acumuloPrevMillis = millis();

      // Aqui entra sua função de medição de corrente
      // Por enquanto simulação com leitura analógica
      float leituraAtual = analogRead(34);  

      somaConsumo += leituraAtual; // acumula valores
      Serial.print("Leitura atual: ");
      Serial.println(leituraAtual);
    }

    // Enviar soma acumulada a cada 5 segundos
    if (millis() - sendDataPrevMillis > intervaloEnvio) {
      sendDataPrevMillis = millis();

      // Montar o caminho no Firebase
      String path = "/users/" + String(auth.token.uid.c_str()) + "/esp32/consumo";

      // Envia soma total
      if (Firebase.RTDB.setFloat(&fbdo, path, somaConsumo)) {
        Serial.print("Consumo acumulado enviado: ");
        Serial.println(somaConsumo);
        digitalWrite(LED_BUILTIN, HIGH);
        delay(100);
        digitalWrite(LED_BUILTIN, LOW);
      } else {
        Serial.println("Falha no envio!");
        Serial.println(fbdo.errorReason());
      }

      // Resetar soma
      somaConsumo = 0;
    }
  }
}
