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

        // Função de login
        async function realizarLogin(email, senha) {
            setLoadingState(true);

            try {
                // Simular chamada para API
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Aqui você faria a chamada real para seu backend
                const loginData = {
                    email: email,
                    senha: senha
                };

                console.log('Dados de login:', loginData);

                // Simular resposta de sucesso
                alert('Login realizado com sucesso!\nRedirecionando para o dashboard...');
                window.location.href = 'dashboard.html';

            } catch (error) {
                console.error('Erro no login:', error);
                alert('Erro ao fazer login. Tente novamente.');
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
        function esqueceuSenha() {
            const email = document.getElementById('email').value.trim();
            if (email && validarEmail(email)) {
                alert(`Instruções de recuperação de senha foram enviadas para: ${email}`);
            } else {
                alert('Por favor, insira seu e-mail no campo acima e clique novamente em "Esqueceu sua senha?"');
            }
        }

        // Login com Google
        function loginComGoogle() {
            alert('Login com Google será implementado em breve!');
        }

        // Login com GitHub
        function loginComGithub() {
            alert('Login com GitHub será implementado em breve!');
        }

        // Redirecionar para cadastro
        function irParaCadastro() {
            window.location.href = 'cadastro.html';
        }

        // Permitir login com Enter
        document.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !isLoading) {
                document.getElementById('loginForm').dispatchEvent(new Event('submit'));
            }
        });

        // Limpar erros quando o usuário digitar
        document.getElementById('email').addEventListener('input', function() {
            this.closest('.form-group').classList.remove('error');
        });

        document.getElementById('senha').addEventListener('input', function() {
            this.closest('.form-group').classList.remove('error');
        });