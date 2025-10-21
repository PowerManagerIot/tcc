// ========== SISTEMA DE ALTERNÂNCIA DE TEMA ==========

// Elementos do DOM
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const body = document.body;

// SVG paths para os ícones de sol e lua
const sunIcon = 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z';
const moonIcon = 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z';

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
    // Se for tema escuro, mostra o sol (para mudar para claro)
    // Se for tema claro, mostra a lua (para mudar para escuro)
    const iconPath = theme === 'dark' ? sunIcon : moonIcon;
    themeIcon.querySelector('path').setAttribute('d', iconPath);
}

console.log('Sistema de tema inicializado - Tema atual:', savedTheme);