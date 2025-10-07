// Configuração do Firebase
import {auth, database} from "./auth.js"


// Variável para controlar estado de loading
let isLoading = false;

// Validação de email
function validarEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Mostrar erro no campo
function mostrarErro(fieldId, mensagem) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    formGroup.classList.add('error');
    formGroup.querySelector('.error-message').textContent = mensagem;
}

// Limpar erros
function limparErros() {
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
    });
}

// Toggle loading state
function setLoadingState(loading) {
    isLoading = loading;
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    const loginLoading = document.getElementById('loginLoading');

    if (loading) {
        loginBtn.disabled = true;
        loginText.style.display = 'none';
        loginLoading.style.display = 'inline-block';
    } else {
        loginBtn.disabled = false;
        loginText.style.display = 'inline';
        loginLoading.style.display = 'none';
    }
}

// Mostrar mensagem de erro ou sucesso
function mostrarMensagem(mensagem, tipo = 'error') {
    // Remove mensagem existente se houver
    const existingMsg = document.querySelector('.message-popup');
    if (existingMsg) {
        existingMsg.remove();
    }

    // Cria nova mensagem
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-popup ${tipo}`;
    messageDiv.textContent = mensagem;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${tipo === 'error' ? '#f44336' : '#4CAF50'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(messageDiv);
    
    // Remove mensagem após 5 segundos
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Função para verificar se o usuário existe no database
async function verificarUsuarioExiste(email) {
    try {
        const usersRef = database.ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val();
        
        if (!users) return null;
        
        // Procura o usuário pelo email
        for (const userId in users) {
            const userProfile = users[userId].profile;
            if (userProfile && userProfile.email === email) {
                return userId;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        return null;
    }
}

// Função de login
async function realizarLogin(email, senha) {
    setLoadingState(true);

    try {
        // Primeiro, verifica se o usuário existe no database
        const userIdExists = await verificarUsuarioExiste(email);
        
        if (!userIdExists) {
            // Usuário não cadastrado
            mostrarMensagem('Usuário não encontrado. Por favor, cadastre-se primeiro.');
            
            // Aguarda 2 segundos e oferece redirecionamento
            setTimeout(() => {
                const redirecionar = confirm('Deseja ir para a página de cadastro?');
                if (redirecionar) {
                    window.location.href = 'cadastro.html';
                }
            }, 2000);
            
            setLoadingState(false);
            return;
        }

        // Tenta fazer login com Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, senha);
        const user = userCredential.user;

        console.log('Login realizado com sucesso:', user);

        // Salva informações do usuário no localStorage
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userId', user.uid);
        localStorage.setItem('isLoggedIn', 'true');

        // Busca dados adicionais do usuário no database
        const userSnapshot = await database.ref(`users/${user.uid}/profile`).once('value');
        const userData = userSnapshot.val();
        
        if (userData) {
            localStorage.setItem('userName', userData.nome || '');
            localStorage.setItem('userPhone', userData.telefone || '');
        }

        mostrarMensagem('Login realizado com sucesso! Redirecionando...', 'success');
        
        // Redireciona para o dashboard após 1 segundo
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (error) {
        console.error('Erro no login:', error);
        
        // Tratamento de erros específicos do Firebase
        let mensagemErro = 'Erro ao fazer login. Tente novamente.';
        
        switch (error.code) {
            case 'auth/wrong-password':
                mensagemErro = 'Senha incorreta. Por favor, tente novamente.';
                mostrarErro('senha', 'Senha incorreta');
                break;
            case 'auth/user-not-found':
                mensagemErro = 'Usuário não encontrado. Por favor, cadastre-se.';
                setTimeout(() => {
                    const redirecionar = confirm('Deseja ir para a página de cadastro?');
                    if (redirecionar) {
                        window.location.href = 'cadastro.html';
                    }
                }, 2000);
                break;
            case 'auth/invalid-email':
                mensagemErro = 'Email inválido. Verifique o formato do email.';
                mostrarErro('email', 'Email inválido');
                break;
            case 'auth/user-disabled':
                mensagemErro = 'Esta conta foi desabilitada. Entre em contato com o suporte.';
                break;
            case 'auth/too-many-requests':
                mensagemErro = 'Muitas tentativas de login. Tente novamente mais tarde.';
                break;
            case 'auth/network-request-failed':
                mensagemErro = 'Erro de conexão. Verifique sua internet.';
                break;
        }
        
        mostrarMensagem(mensagemErro);
    } finally {
        setLoadingState(false);
    }
}

// Event listener do formulário
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (isLoading) return;

    limparErros();

    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    let isValid = true;

    // Validar email
    if (!email) {
        mostrarErro('email', 'Por favor, insira seu e-mail');
        isValid = false;
    } else if (!validarEmail(email)) {
        mostrarErro('email', 'Por favor, insira um e-mail válido');
        isValid = false;
    }

    // Validar senha
    if (!senha) {
        mostrarErro('senha', 'Por favor, insira sua senha');
        isValid = false;
    } else if (senha.length < 6) {
        mostrarErro('senha', 'A senha deve ter pelo menos 6 caracteres');
        isValid = false;
    }

    if (isValid) {
        realizarLogin(email, senha);
    }
});

// Função para esqueceu senha
async function esqueceuSenha() {
    const email = document.getElementById('email').value.trim();
    
    if (!email) {
        mostrarMensagem('Por favor, insira seu e-mail no campo acima.');
        return;
    }
    
    if (!validarEmail(email)) {
        mostrarMensagem('Por favor, insira um e-mail válido.');
        return;
    }

    try {
        // Verifica se o usuário existe antes de enviar o email
        const userExists = await verificarUsuarioExiste(email);
        
        if (!userExists) {
            mostrarMensagem('Este email não está cadastrado em nosso sistema.');
            return;
        }

        // Envia email de recuperação de senha
        await auth.sendPasswordResetEmail(email);
        mostrarMensagem(`Email de recuperação enviado para ${email}. Verifique sua caixa de entrada.`, 'success');
    } catch (error) {
        console.error('Erro ao enviar email de recuperação:', error);
        
        let mensagemErro = 'Erro ao enviar email de recuperação.';
        
        if (error.code === 'auth/user-not-found') {
            mensagemErro = 'Email não cadastrado em nosso sistema.';
        } else if (error.code === 'auth/too-many-requests') {
            mensagemErro = 'Muitas tentativas. Aguarde alguns minutos.';
        }
        
        mostrarMensagem(mensagemErro);
    }
}

// Login com Google
async function loginComGoogle() {
    setLoadingState(true);
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Verifica se é um novo usuário
        const userSnapshot = await database.ref(`users/${user.uid}/profile`).once('value');
        const userData = userSnapshot.val();
        
        if (!userData) {
            // Novo usuário - cria perfil no database
            await database.ref(`users/${user.uid}/profile`).set({
                nome: user.displayName || '',
                email: user.email,
                telefone: user.phoneNumber || '',
                dataCadastro: firebase.database.ServerValue.TIMESTAMP,
                tipoLogin: 'google'
            });
        }
        
        // Salva informações no localStorage
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userId', user.uid);
        localStorage.setItem('userName', user.displayName || '');
        localStorage.setItem('isLoggedIn', 'true');
        
        mostrarMensagem('Login com Google realizado com sucesso!', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
        
    } catch (error) {
        console.error('Erro no login com Google:', error);
        
        let mensagemErro = 'Erro ao fazer login com Google.';
        
        if (error.code === 'auth/popup-closed-by-user') {
            mensagemErro = 'Login cancelado pelo usuário.';
        } else if (error.code === 'auth/popup-blocked') {
            mensagemErro = 'Pop-up bloqueado. Permita pop-ups para este site.';
        }
        
        mostrarMensagem(mensagemErro);
    } finally {
        setLoadingState(false);
    }
}

// Login com Apple (Apple Sign In)
async function loginComApple() {
    // O login com Apple requer configuração adicional no Firebase Console
    // e certificados da Apple Developer
    mostrarMensagem('Login com Apple será implementado em breve!', 'info');
}

// Redirecionar para cadastro
function irParaCadastro() {
    window.location.href = 'cadastro.html';
}

// Permitir login com Enter
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !isLoading) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.dispatchEvent(new Event('submit'));
        }
    }
});

// Limpar erros quando o usuário digitar
document.getElementById('email').addEventListener('input', function() {
    this.closest('.form-group').classList.remove('error');
});

document.getElementById('senha').addEventListener('input', function() {
    this.closest('.form-group').classList.remove('error');
});



// Adiciona estilos CSS para mensagens (caso não existam no CSS principal)
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .message-popup {
        animation: slideIn 0.3s ease;
    }
`;
document.head.appendChild(style);