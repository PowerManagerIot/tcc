// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBTPR8X4dRg5fZu_PTj0hwud3bfHtky1S4",
    authDomain: "SEU_AUTH_DOMAIN",
    databaseURL: "https://powermanager-988cc-default-rtdb.firebaseio.com",
    projectId: "powermanager-988cc",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
export const database = firebase.database();

