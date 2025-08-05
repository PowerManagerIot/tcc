#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// Configurações do WiFi
#define WIFI_SSID "ewerson"
#define WIFI_PASSWORD "12345678"

// Configurações do Firebase
#define API_KEY "AIzaSyBTPR8X4dRg5fZu_PTj0hwud3bfHtky1S4"
#define DATABASE_URL "https://powermanager-988cc-default-rtdb.firebaseio.com"

// Credenciais do usuário
#define USER_EMAIL "powermanageriot@gmail.com"
#define USER_PASSWORD "pmiot12*"

// Pinos dos relés (defina conforme sua conexão)
#define RELAY_PIN_1 23   // Relé para dispositivo 1 (ventilador)
#define RELAY_PIN_2 5   // Adicione mais pinos conforme necessário
#define RELAY_PIN_3 18
#define RELAY_PIN_4 19

// Objetos Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Variáveis
bool signupOK = false;
int numeroParaEnviar = 7000;
unsigned long sendDataPrevMillis = 0;
unsigned long readDataPrevMillis = 0;
#define LED_BUILTIN 2

// Array para armazenar os pinos dos relés
int relayPins[] = {RELAY_PIN_1, RELAY_PIN_2, RELAY_PIN_3, RELAY_PIN_4};
int numRelays = sizeof(relayPins) / sizeof(relayPins[0]);

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  
  // Configurar pinos dos relés como saída
  for (int i = 0; i < numRelays; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], LOW); // Inicializar relés desligados
  }
  
  Serial.begin(115200);

  // Conectar ao WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    delay(300);
  }
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println();
  Serial.print("Conectado com IP: ");
  Serial.println(WiFi.localIP());

  // Configurar Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  // Definir credenciais do usuário
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Aguardar autenticação
  Serial.println("Aguardando autenticação...");
  while (auth.token.uid == "") {
    Serial.print(".");
    delay(1000);
  }
  signupOK = true;
  Serial.println();
  Serial.println("Autenticado no Firebase como usuário registrado");
  Serial.print("UID: ");
  Serial.println(auth.token.uid.c_str());
}

void loop() {
  if (Firebase.ready() && signupOK) {
    
    // Enviar número 4000 a cada 15 segundos (função original)
    if (millis() - sendDataPrevMillis > 15000 || sendDataPrevMillis == 0) {
      sendDataPrevMillis = millis();
      
      // Montar o caminho com o UID do usuário autenticado
      String path = "/users/" + String(auth.token.uid.c_str()) + "/esp32/numero";
      
      // Enviar o número para o caminho correto
      if (Firebase.RTDB.setInt(&fbdo, path, numeroParaEnviar)) {
        Serial.println("Número 4000 enviado com sucesso!");
        digitalWrite(LED_BUILTIN, HIGH);
        delay(100);
        digitalWrite(LED_BUILTIN, LOW);
      } else {
        Serial.println("Falha no envio do número:");
        Serial.println(fbdo.errorReason());
      }
    }
    
    // Ler dados dos dispositivos a cada 5 segundos
    if (millis() - readDataPrevMillis > 5000 || readDataPrevMillis == 0) {
      readDataPrevMillis = millis();
      checkDevicesAndControlRelays();
    }
  }
}

void checkDevicesAndControlRelays() {
  String basePath = "/users/" + String(auth.token.uid.c_str()) + "/devices";
  
  // Verificar cada dispositivo (assumindo que há pelo menos 4 dispositivos: 0, 1, 2, 3)
  for (int deviceIndex = 0; deviceIndex < 4; deviceIndex++) {
    String devicePath = basePath + "/" + String(deviceIndex);
    
    // Verificar se o dispositivo tem botão
    String hasButtonPath = devicePath + "/hasButton";
    if (Firebase.RTDB.getString(&fbdo, hasButtonPath)) {
      String hasButton = fbdo.stringData();
      
      if (hasButton == "yes") {
        Serial.print("Dispositivo ");
        Serial.print(deviceIndex);
        Serial.println(" tem botão. Verificando estado...");
        
        // Ler o estado do dispositivo
        String statePath = devicePath + "/state";
        if (Firebase.RTDB.getBool(&fbdo, statePath)) {
          bool deviceState = fbdo.boolData();
          
          // Ler o nome do dispositivo para debug
          String namePath = devicePath + "/name";
          String deviceName = "Desconhecido";
          if (Firebase.RTDB.getString(&fbdo, namePath)) {
            deviceName = fbdo.stringData();
          }
          
          Serial.print("Dispositivo: ");
          Serial.print(deviceName);
          Serial.print(" (índice ");
          Serial.print(deviceIndex);
          Serial.print(") - Estado: ");
          Serial.println(deviceState ? "LIGADO" : "DESLIGADO");
          
          // Controlar o relé correspondente (se existe)
          if (deviceIndex < numRelays) {
            digitalWrite(relayPins[deviceIndex], deviceState ? HIGH : LOW);
            Serial.print("Relé no pino ");
            Serial.print(relayPins[deviceIndex]);
            Serial.println(deviceState ? " LIGADO" : " DESLIGADO");
          }
          
        } else {
          Serial.print("Erro ao ler estado do dispositivo ");
          Serial.print(deviceIndex);
          Serial.print(": ");
          Serial.println(fbdo.errorReason());
        }
        
      } else {
        Serial.print("Dispositivo ");
        Serial.print(deviceIndex);
        Serial.println(" não tem botão.");
      }
      
    } else {
      Serial.print("Erro ao verificar hasButton do dispositivo ");
      Serial.print(deviceIndex);
      Serial.print(": ");
      Serial.println(fbdo.errorReason());
    }
  }
  
  Serial.println("--- Verificação de dispositivos concluída ---");
}