// Import Firebase SDK (módulos ES6)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    updateProfile 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getDatabase, 
    ref, 
    set
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// =====================================================
// CONFIGURAÇÃO DO FIREBASE - SUBSTITUA COM SUAS CREDENCIAIS
// =====================================================
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// =====================================================
// VARIÁVEIS GLOBAIS
// =====================================================
let currentStep = 1;
const totalSteps = 4;

// =====================================================
// FUNÇÕES DE NAVEGAÇÃO E VALIDAÇÃO
// =====================================================
function updateProgress() {
    const progressPercentage = (currentStep / totalSteps) * 100;
    document.getElementById('progressFill').style.width = progressPercentage + '%';
    document.getElementById('currentStep').textContent = currentStep;
}

function showStep(step) {
    // Ocultar todas as etapas
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    // Mostrar etapa atual
    document.getElementById('step' + step).classList.add('active');
    
    updateProgress();
}

function validateStep(step) {
    let isValid = true;
    
    // Remover mensagens de erro anteriores
    document.querySelectorAll('.input-group').forEach(group => {
        group.classList.remove('error');
    });

    switch(step) {
        case 1:
            const nome = document.getElementById('nome').value.trim();
            if (nome.length < 2) {
                showError('nome', 'Por favor, insira seu nome completo');
                isValid = false;
            }
            break;
            
        case 2:
            const email = document.getElementById('email').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showError('email', 'Por favor, insira um e-mail válido');
                isValid = false;
            }
            break;
            
        case 3:
            const telefone = document.getElementById('telefone').value.trim();
            if (telefone.length < 10) {
                showError('telefone', 'Por favor, insira um telefone válido');
                isValid = false;
            }
            break;
            
        case 4:
            const senha = document.getElementById('senha').value;
            const confirmarSenha = document.getElementById('confirmarSenha').value;
            
            if (senha.length < 6) {
                showError('senha', 'A senha deve ter pelo menos 6 caracteres');
                isValid = false;
            }
            
            if (senha !== confirmarSenha) {
                showError('confirmarSenha', 'As senhas não coincidem');
                isValid = false;
            }
            break;
    }
    
    return isValid;
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const inputGroup = field.closest('.input-group');
    inputGroup.classList.add('error');
    inputGroup.querySelector('.error-message').textContent = message;
}

function nextStep() {
    if (validateStep(currentStep)) {
        if (currentStep < totalSteps) {
            currentStep++;
            showStep(currentStep);
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

// =====================================================
// FUNÇÃO PARA GERAR ID ALEATÓRIO
// =====================================================
function generateRandomUserId() {
    // Gera um ID aleatório similar ao formato do Firebase
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 28; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// =====================================================
// FUNÇÃO PRINCIPAL - CRIAR USUÁRIO NO FIREBASE
// =====================================================
async function criarUsuarioFirebase(dadosUsuario) {
    try {
        // Criar usuário com autenticação
        const userCredential = await createUserWithEmailAndPassword(
            auth, 
            dadosUsuario.email, 
            dadosUsuario.senha
        );
        
        const user = userCredential.user;
        
        // Atualizar o perfil do usuário com o nome
        await updateProfile(user, {
            displayName: dadosUsuario.nome
        });
        
        // Gerar ID aleatório único
        const userId = generateRandomUserId();
        
        // Preparar dados do perfil (sem incluir a senha)
        const profileData = {
            userId: userId,
            uid: user.uid, // UID do Firebase Auth
            nome: dadosUsuario.nome,
            email: dadosUsuario.email,
            telefone: dadosUsuario.telefone,
            dataCadastro: new Date().toISOString(),
            ativo: true
        };
        
        // Salvar no Realtime Database no caminho especificado
        await set(ref(database, `users/${userId}/profile`), profileData);
        
        console.log('Usuário criado com sucesso:', userId);
        return { success: true, userId: userId, authId: user.uid };
        
    } catch (error) {
        // ========== INÍCIO DO TRATAMENTO DE ERROS ==========
        console.error('Erro ao criar usuário:', error);
        
        // Tratar erros específicos do Firebase
        let mensagemErro = 'Erro ao criar conta. Tente novamente.';
        
        switch(error.code) {
            case 'auth/email-already-in-use':
                mensagemErro = 'Este e-mail já está cadastrado.';
                break;
            case 'auth/invalid-email':
                mensagemErro = 'E-mail inválido.';
                break;
            case 'auth/weak-password':
                mensagemErro = 'A senha deve ter pelo menos 6 caracteres.';
                break;
            case 'auth/network-request-failed':
                mensagemErro = 'Erro de conexão. Verifique sua internet.';
                break;
        }
        
        return { success: false, error: mensagemErro };
        // ========== FIM DO TRATAMENTO DE ERROS ==========
    }
}

// =====================================================
// FUNÇÃO PARA FINALIZAR CADASTRO
// =====================================================
async function finalizarCadastro() {
    if (validateStep(4)) {
        // Mostrar loading
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        document.getElementById('stepLoading').classList.add('active');
        
        // Desabilitar botão para evitar múltiplos cliques
        const btnCriarConta = document.getElementById('btnCriarConta');
        btnCriarConta.disabled = true;
        
        // Coletar dados do usuário
        const dadosUsuario = {
            nome: document.getElementById('nome').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefone: document.getElementById('telefone').value.trim(),
            senha: document.getElementById('senha').value
        };
        
        // Criar usuário no Firebase
        const resultado = await criarUsuarioFirebase(dadosUsuario);
        
        if (resultado.success) {
            // Salvar ID do usuário no localStorage para uso futuro
            localStorage.setItem('currentUserId', resultado.userId);
            localStorage.setItem('currentUserAuthId', resultado.authId);
            
            // Mostrar tela de sucesso
            document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
            document.getElementById('stepSuccess').classList.add('active');
            
            // Ocultar barra de progresso
            document.querySelector('.progress-container').style.visibility = 'hidden';
            
            // Limpar formulário
            document.getElementById('nome').value = '';
            document.getElementById('email').value = '';
            document.getElementById('telefone').value = '';
            document.getElementById('senha').value = '';
            document.getElementById('confirmarSenha').value = '';
            
        } else {
            // ========== INÍCIO DO TRATAMENTO DE ERRO NA UI ==========
            // Mostrar erro
            document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
            document.getElementById('stepError').classList.add('active');
            document.getElementById('errorDetail').textContent = resultado.error;
            // ========== FIM DO TRATAMENTO DE ERRO NA UI ==========
            
            // Reabilitar botão
            btnCriarConta.disabled = false;
        }
    }
}

function voltarParaCadastro() {
    // Voltar para a última etapa do cadastro
    currentStep = 4;
    showStep(currentStep);
    
    // Reabilitar botão
    const btnCriarConta = document.getElementById('btnCriarConta');
    if (btnCriarConta) {
        btnCriarConta.disabled = false;
    }
}

function irParaLogin() {
    window.location.href = "login.html";
}

// =====================================================
// EVENT LISTENERS
// =====================================================

// Botões de navegação
document.getElementById('btnNext1').addEventListener('click', nextStep);
document.getElementById('btnNext2').addEventListener('click', nextStep);
document.getElementById('btnNext3').addEventListener('click', nextStep);

document.getElementById('btnPrev2').addEventListener('click', prevStep);
document.getElementById('btnPrev3').addEventListener('click', prevStep);
document.getElementById('btnPrev4').addEventListener('click', prevStep);

// Botões principais
document.getElementById('btnCriarConta').addEventListener('click', finalizarCadastro);
document.getElementById('btnEntrar').addEventListener('click', irParaLogin);
document.getElementById('btnFazerLogin').addEventListener('click', irParaLogin);
document.getElementById('btnTentarNovamente').addEventListener('click', voltarParaCadastro);

// Formatação automática do telefone
document.getElementById('telefone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 11) {
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (value.length >= 7) {
        value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (value.length >= 3) {
        value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    }
    e.target.value = value;
});

// Permitir navegação com Enter
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const activeStep = document.querySelector('.step.active');
        const btnPrimary = activeStep?.querySelector('.btn-primary');
        
        // Só clicar se o botão não for de login e estiver habilitado
        if (btnPrimary && 
            !btnPrimary.textContent.includes('Login') && 
            !btnPrimary.disabled) {
            btnPrimary.click();
        }
    }
});

// =====================================================
// VERIFICAÇÃO DO FIREBASE
// =====================================================
window.addEventListener('load', function() {
    // ========== INÍCIO DA VERIFICAÇÃO DE ERRO ==========
    setTimeout(() => {
        if (!auth || !database) {
            console.error('Firebase não foi carregado corretamente. Verifique sua configuração.');
            alert('Erro ao carregar o sistema. Por favor, recarregue a página.');
        } else {
            console.log('Firebase carregado com sucesso!');
        }
    }, 2000);
    // ========== FIM DA VERIFICAÇÃO DE ERRO ==========
});

// Inicializar progress bar
updateProgress();