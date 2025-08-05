#
Powermanager
#
----------------------------------------------------------------------


config.database_url = "https://powermanager-988cc-default-rtdb.firebaseio.com";


----------------------------------------------------------------------
- Nome do projeto:
  PowerManager
- ID do projeto:
  powermanager-988cc
- Número do projeto:
  556881433184
- Chave de API da Web:
  AIzaSyBTPR8X4dRg5fZu_PTj0hwud3bfHtky1S4
----------------------------------------------------------------------
{
  "rules": {
    "esp32": {
      ".read": "auth != null",
      ".write": "auth != null",
      "sensor": {
        ".read": true,  // Permite leitura pública do sensor
        ".write": "auth != null" // Só o ESP32 pode escrever (via autenticação)
      },
      "relay1": {
        ".read": true,
        ".write": "auth != null"
      },
      "relay2": {
        ".read": true,
        ".write": "auth != null"
      },
      "relay3": {
        ".read": true,
        ".write": "auth != null"
      },
      "relay4": {
        ".read": true,
        ".write": "auth != null"
      },
      "relay5": {
        ".read": true,
        ".write": "auth != null"
      },
      "relay6": {
        ".read": true,
        ".write": "auth != null"
      },
      "relay7": {
        ".read": true,
        ".write": "auth != null"
      },
      "relay8": {
        ".read": true,
        ".write": "auth != null"
      }
      
    }
  }
}
----------------------------------------------------------------------

powermanageriot@gmail.com --------- pmiot12*

ewersonngabriell@gmail.com -------- pmiot12*

-----------------------------------------------------------------------

usuário 

Corrente(int)

rl1(L|D)
rl2(L|D)
rl3(L|D)
rl4(L|D)
rl5(L|D)
rl6(L|D)
rl7(L|D)
rl8(L|D)


-----------------------------------------------------------------------

Consumo (kWh) = Potência do aparelho (kW) × Tempo de uso (horas)

sujestões:

Gostaria de um sistema que controlasse meus dispositivos que mais consomem energia da casa, 
e que me avise sobre quando o consumo está acima do nível esperado, além de também comparar 
o consumo por períodos...


Com funcionamento remoto, que possibilite criar alertas de consumo quando targets fossem atingidos, ou seja, 
limites máximos de valores que desejo pagar para a companhia elétrica mediante a quantidade de carga instalada na rede, 
sempre atualizado com os valores das bandeiras de cobrança pra cada tipo de instalação ou tipo de consumo que tiver, seja 
residencial ou industrial.




Estrutura Principal
- https://powermanager-98Bcc-default-rtdb.firebascio.com/
  - users
    - VXOUd3jqCPTdGZrutzn6Sp9t1G02 (ID de usuário)
      - devices
        - 0
            hasButton: no
            name: geladeira
            number: 250
            state: false
        - 1
            hasButtom: yes
            name: ventilador
            number: 300
            state: false
 
        - 2
            hasButton: no
            name: microondas
            number: 40
            state: false      
        - 3
            hasButton: no
            name: Wicroondas
            number: 40
            state: false    
  - esp32
    - numero: 4000

Lembrando, que os dispositivos são alteráveis, e dependendo da configuração armazenada podem ter de 0 até 15 dispositivos diferentes, e que são definidas pelo usuário
E, NO DISPOSITIVO QUE HAVER "hasButton: "yes", ele vai ver o "state" dele. Se o "state: false", desliga o relé. se for "state: true", liga o relé





