// Theme Toggle Functionality
class ThemeToggle {
    constructor() {
        this.themeToggleBtn = document.getElementById('themeToggle');
        this.themeIcon = document.getElementById('themeIcon');
        this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
        
        this.init();
    }

    init() {
        // Set initial theme
        this.applyTheme(this.currentTheme);
        
        // Add event listener
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getStoredTheme()) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    getStoredTheme() {
        return localStorage.getItem('theme');
    }

    storeTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    applyTheme(theme) {
        this.currentTheme = theme;
        
        if (theme === 'dark') {
            document.documentElement.style.setProperty('--bg-primary', '#000000');
            document.documentElement.style.setProperty('--bg-secondary', '#0a0a0a');
            document.documentElement.style.setProperty('--text-primary', '#ffffff');
            document.documentElement.style.setProperty('--text-secondary', '#999999');
            document.documentElement.style.setProperty('--text-tertiary', '#666666');
            document.documentElement.style.setProperty('--border-color', '#333333');
            document.documentElement.style.setProperty('--border-light', '#333333');
            document.documentElement.style.setProperty('--input-bg', 'transparent');
            
            if (this.themeIcon) {
                this.themeIcon.textContent = '☀️';
            }
        } else {
            document.documentElement.style.setProperty('--bg-primary', '#ffffff');
            document.documentElement.style.setProperty('--bg-secondary', '#fafafa');
            document.documentElement.style.setProperty('--text-primary', '#000000');
            document.documentElement.style.setProperty('--text-secondary', '#666666');
            document.documentElement.style.setProperty('--text-tertiary', '#999999');
            document.documentElement.style.setProperty('--border-color', '#e1e5e9');
            document.documentElement.style.setProperty('--border-light', '#e1e5e9');
            document.documentElement.style.setProperty('--input-bg', '#ffffff');
            
            if (this.themeIcon) {
                this.themeIcon.textContent = '🌙';
            }
        }
        
        this.storeTheme(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }
}

// Initialize theme toggle when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ThemeToggle();
});