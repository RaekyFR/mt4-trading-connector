/**
 * Gestionnaire de thème pour Trading Monitor
 * Gère le basculement entre thème sombre et clair
 */

class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || 'dark';
        this.themeKey = window.CONFIG.UI.THEME_STORAGE_KEY;
        this.transitions = [];
    }

    /**
     * Initialiser le gestionnaire de thème
     */
    init() {
        this.applyTheme(this.currentTheme);
        this.bindEvents();
        this.updateThemeIcon();
    }

    /**
     * Obtenir le thème stocké
     */
    getStoredTheme() {
        return Utils.loadFromStorage(this.themeKey, window.CONFIG.UI.DEFAULT_THEME);
    }

    /**
     * Sauvegarder le thème
     */
    saveTheme(theme) {
        Utils.saveToStorage(this.themeKey, theme);
    }

    /**
     * Appliquer un thème
     */
    applyTheme(theme) {
        if (!['light', 'dark'].includes(theme)) {
            console.warn('Thème invalide:', theme);
            return;
        }

        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.saveTheme(theme);
        this.updateThemeIcon();
        
        // Émettre un événement pour les composants qui ont besoin d'être mis à jour
        this.emitThemeChange(theme);
    }

    /**
     * Basculer entre les thèmes
     */
    toggle() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }

    /**
     * Mettre à jour l'icône du bouton de thème
     */
    updateThemeIcon() {
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.textContent = this.currentTheme === 'dark' ? '☀️' : '🌙';
        }
    }

    /**
     * Événements
     */
    bindEvents() {
        // Bouton de basculement
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggle();
            });
        }

        // Raccourci clavier
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Détecter la préférence système
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener((e) => {
                if (!this.getStoredTheme()) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    /**
     * Émettre un événement de changement de thème
     */
    emitThemeChange(theme) {
        const event = new CustomEvent('themeChange', {
            detail: { theme }
        });
        window.dispatchEvent(event);
    }

    /**
     * Obtenir les couleurs du thème actuel
     */
    getThemeColors() {
        const style = getComputedStyle(document.documentElement);
        
        return {
            primary: style.getPropertyValue('--primary-color').trim(),
            secondary: style.getPropertyValue('--secondary-color').trim(),
            accent: style.getPropertyValue('--accent-color').trim(),
            success: style.getPropertyValue('--success-color').trim(),
            warning: style.getPropertyValue('--warning-color').trim(),
            danger: style.getPropertyValue('--danger-color').trim(),
            info: style.getPropertyValue('--info-color').trim(),
            bgPrimary: style.getPropertyValue('--bg-primary').trim(),
            bgSecondary: style.getPropertyValue('--bg-secondary').trim(),
            bgTertiary: style.getPropertyValue('--bg-tertiary').trim(),
            textPrimary: style.getPropertyValue('--text-primary').trim(),
            textSecondary: style.getPropertyValue('--text-secondary').trim(),
            textMuted: style.getPropertyValue('--text-muted').trim(),
            borderColor: style.getPropertyValue('--border-color').trim()
        };
    }

    /**
     * Obtenir le thème actuel
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Vérifier si le thème est sombre
     */
    isDark() {
        return this.currentTheme === 'dark';
    }

    /**
     * Vérifier si le thème est clair
     */
    isLight() {
        return this.currentTheme === 'light';
    }

    /**
     * Transition personnalisée pour le changement de thème
     */
    enableTransitions() {
        const css = `
            * {
                transition: background-color 0.3s ease, 
                           color 0.3s ease, 
                           border-color 0.3s ease,
                           box-shadow 0.3s ease !important;
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        
        // Retirer les transitions après un délai
        setTimeout(() => {
            document.head.removeChild(style);
        }, 300);
    }

    /**
     * Adapter automatiquement selon l'heure
     */
    autoTheme() {
        const hour = new Date().getHours();
        const shouldBeDark = hour < 7 || hour > 19;
        const targetTheme = shouldBeDark ? 'dark' : 'light';
        
        if (this.currentTheme !== targetTheme) {
            this.applyTheme(targetTheme);
            
            if (window.NotificationManager) {
                window.NotificationManager.info(
                    'Thème automatique',
                    `Basculement vers le thème ${targetTheme === 'dark' ? 'sombre' : 'clair'}`
                );
            }
        }
    }

    /**
     * Démarrer le mode automatique
     */
    startAutoMode() {
        this.autoTheme();
        
        // Vérifier toutes les heures
        this.autoInterval = setInterval(() => {
            this.autoTheme();
        }, 60 * 60 * 1000);
    }

    /**
     * Arrêter le mode automatique
     */
    stopAutoMode() {
        if (this.autoInterval) {
            clearInterval(this.autoInterval);
            this.autoInterval = null;
        }
    }

    /**
     * Créer un thème personnalisé
     */
    createCustomTheme(colors) {
        const style = document.createElement('style');
        style.id = 'custom-theme';
        
        let css = ':root {';
        Object.entries(colors).forEach(([key, value]) => {
            css += `--${key}: ${value};`;
        });
        css += '}';
        
        style.textContent = css;
        
        // Supprimer l'ancien thème personnalisé
        const oldCustomTheme = document.getElementById('custom-theme');
        if (oldCustomTheme) {
            oldCustomTheme.remove();
        }
        
        document.head.appendChild(style);
        this.currentTheme = 'custom';
        this.saveTheme('custom');
        this.emitThemeChange('custom');
    }

    /**
     * Réinitialiser au thème par défaut
     */
    resetToDefault() {
        const customTheme = document.getElementById('custom-theme');
        if (customTheme) {
            customTheme.remove();
        }
        
        this.applyTheme(window.CONFIG.UI.DEFAULT_THEME);
    }

    /**
     * Obtenir les préférences de thème
     */
    getPreferences() {
        return {
            theme: this.currentTheme,
            autoMode: !!this.autoInterval,
            systemPreference: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        };
    }

    /**
     * Exporter la configuration du thème
     */
    exportTheme() {
        const colors = this.getThemeColors();
        const config = {
            theme: this.currentTheme,
            colors,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `theme-${this.currentTheme}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Importer une configuration de thème
     */
    importTheme(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    
                    if (config.colors) {
                        this.createCustomTheme(config.colors);
                        resolve(config);
                    } else {
                        reject(new Error('Configuration de thème invalide'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsText(file);
        });
    }

    /**
     * Créer un sélecteur de thème
     */
    createThemeSelector() {
        const selector = document.createElement('div');
        selector.className = 'theme-selector';
        selector.innerHTML = `
            <div class="theme-options">
                <button class="theme-option ${this.currentTheme === 'dark' ? 'active' : ''}" 
                        data-theme="dark">
                    <span class="theme-preview theme-dark"></span>
                    <span class="theme-label">Sombre</span>
                </button>
                <button class="theme-option ${this.currentTheme === 'light' ? 'active' : ''}" 
                        data-theme="light">
                    <span class="theme-preview theme-light"></span>
                    <span class="theme-label">Clair</span>
                </button>
                <button class="theme-option" id="autoThemeBtn">
                    <span class="theme-preview theme-auto"></span>
                    <span class="theme-label">Auto</span>
                </button>
            </div>
            <div class="theme-actions">
                <button class="btn btn-sm btn-ghost" id="exportThemeBtn">Exporter</button>
                <button class="btn btn-sm btn-ghost" id="importThemeBtn">Importer</button>
                <input type="file" id="themeFileInput" accept=".json" style="display: none;">
            </div>
        `;
        
        // Événements
        selector.querySelectorAll('.theme-option[data-theme]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyTheme(btn.dataset.theme);
                this.updateThemeSelector(selector);
            });
        });
        
        selector.querySelector('#autoThemeBtn').addEventListener('click', () => {
            if (this.autoInterval) {
                this.stopAutoMode();
            } else {
                this.startAutoMode();
            }
            this.updateThemeSelector(selector);
        });
        
        selector.querySelector('#exportThemeBtn').addEventListener('click', () => {
            this.exportTheme();
        });
        
        const importBtn = selector.querySelector('#importThemeBtn');
        const fileInput = selector.querySelector('#themeFileInput');
        
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importTheme(file).then(() => {
                    if (window.NotificationManager) {
                        window.NotificationManager.success('Thème importé', 'Le thème a été appliqué avec succès');
                    }
                }).catch(error => {
                    if (window.NotificationManager) {
                        window.NotificationManager.error('Erreur', error.message);
                    }
                });
            }
        });
        
        return selector;
    }

    /**
     * Mettre à jour le sélecteur de thème
     */
    updateThemeSelector(selector) {
        selector.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = selector.querySelector(`[data-theme="${this.currentTheme}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        const autoBtn = selector.querySelector('#autoThemeBtn');
        if (autoBtn) {
            autoBtn.classList.toggle('active', !!this.autoInterval);
        }
    }

    /**
     * Obtenir les couleurs recommandées pour les graphiques
     */
    getChartColors() {
        const colors = this.getThemeColors();
        
        return {
            primary: colors.primary,
            secondary: colors.secondary,
            success: colors.success,
            warning: colors.warning,
            danger: colors.danger,
            info: colors.info,
            grid: colors.borderColor,
            text: colors.textSecondary,
            background: colors.bgSecondary
        };
    }

    /**
     * Adapter Chart.js au thème
     */
    getChartDefaults() {
        const colors = this.getChartColors();
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: colors.text,
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: colors.background,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.grid,
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: colors.text
                    },
                    grid: {
                        color: colors.grid
                    }
                },
                y: {
                    ticks: {
                        color: colors.text
                    },
                    grid: {
                        color: colors.grid
                    }
                }
            }
        };
    }

    /**
     * Destruction du gestionnaire
     */
    destroy() {
        this.stopAutoMode();
        
        // Supprimer les thèmes personnalisés
        const customTheme = document.getElementById('custom-theme');
        if (customTheme) {
            customTheme.remove();
        }
        
        // Réinitialiser au thème par défaut
        this.applyTheme(window.CONFIG.UI.DEFAULT_THEME);
    }
}

// Export global
window.ThemeManager = ThemeManager;

// Styles CSS pour le sélecteur de thème
const themeStyles = `
    .theme-selector {
        padding: var(--spacing-md);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        background-color: var(--bg-secondary);
    }
    
    .theme-options {
        display: flex;
        gap: var(--spacing-sm);
        margin-bottom: var(--spacing-md);
    }
    
    .theme-option {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-sm);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        background-color: var(--bg-tertiary);
        cursor: pointer;
        transition: all var(--transition-fast);
        min-width: 60px;
    }
    
    .theme-option:hover {
        background-color: var(--bg-accent);
    }
    
    .theme-option.active {
        border-color: var(--primary-color);
        background-color: color-mix(in srgb, var(--primary-color) 10%, transparent);
    }
    
    .theme-preview {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid var(--border-color);
    }
    
    .theme-dark {
        background: linear-gradient(45deg, #1a1a1a 50%, #2d2d2d 50%);
    }
    
    .theme-light {
        background: linear-gradient(45deg, #ffffff 50%, #f8f9fa 50%);
    }
    
    .theme-auto {
        background: linear-gradient(45deg, #1a1a1a 50%, #ffffff 50%);
    }
    
    .theme-label {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
    }
    
    .theme-actions {
        display: flex;
        gap: var(--spacing-sm);
        justify-content: center;
        padding-top: var(--spacing-sm);
        border-top: 1px solid var(--border-color);
    }
`;

// Injecter les styles
const styleSheet = document.createElement('style');
styleSheet.textContent = themeStyles;
document.head.appendChild(styleSheet);