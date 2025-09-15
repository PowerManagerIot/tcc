let currentStep = 1;
        const totalSteps = 4;

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

        function finalizarCadastro() {
            if (validateStep(4)) {
                // Aqui você enviaria os dados para o servidor
                const dadosUsuario = {
                    nome: document.getElementById('nome').value,
                    email: document.getElementById('email').value,
                    telefone: document.getElementById('telefone').value,
                    senha: document.getElementById('senha').value
                };
                
                console.log('Dados do usuário:', dadosUsuario);
                
                // Mostrar tela de sucesso
                document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
                document.getElementById('stepSuccess').classList.add('active');
                
                // Ocultar barra de progresso
                document.querySelector('.progress-container').style.visibility = 'hidden';
            }
        }

        function irParaLogin() {
            window.location.href = "login.html";
        }

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
                const nextButton = activeStep.querySelector('.btn-primary:not(.btn-secondary)');
                if (nextButton && !nextButton.textContent.includes('Login')) {
                    nextButton.click();
                }
            }
        });

        // Inicializar
        updateProgress();