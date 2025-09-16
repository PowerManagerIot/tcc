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


FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long sendDataPrevMillis = 0;
unsigned long acumuloPrevMillis = 0;

float somaConsumo = 0;
int intervaloEnvio = 5000;

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\nWi-Fi conectado!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

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

    
    if (millis() - acumuloPrevMillis >= 1000) {
      acumuloPrevMillis = millis();


      float leituraAtual = analogRead(34);  

      somaConsumo += leituraAtual; 
      Serial.print("Leitura atual: ");
      Serial.println(leituraAtual);
    }

    if (millis() - sendDataPrevMillis > intervaloEnvio) {
      sendDataPrevMillis = millis();


      String path = "/users/" + String(auth.token.uid.c_str()) + "/esp32/consumo";


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


      somaConsumo = 0;
    }
  }
}
