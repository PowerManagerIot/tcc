 // ========== SISTEMA DE ALTERNÂNCIA DE TEMA ==========
    
    // Elementos do DOM
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const body = document.body;

    // Verificar preferência salva no localStorage
    const savedTheme = localStorage.getItem('powerManagerTheme') || 'dark';
    
    // Aplicar tema salvo ao carregar a página
    body.className = savedTheme + '-mode';
    updateIcon(savedTheme);

    // Event listener para alternar tema ao clicar no botão
    themeToggle.addEventListener('click', () => {
        const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Aplicar novo tema
        body.className = newTheme + '-mode';
        
        // Salvar preferência no localStorage
        localStorage.setItem('powerManagerTheme', newTheme);
        
        // Atualizar ícone
        updateIcon(newTheme);
        
        console.log('Tema alterado para:', newTheme);
    });

    // Função para atualizar o ícone do botão
    function updateIcon(theme) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    
    console.log('Sistema de tema inicializado - Tema atual:', savedTheme);