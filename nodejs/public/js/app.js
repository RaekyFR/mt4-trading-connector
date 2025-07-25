// js/app.js

/**
 * Application principale TradingView MT4 Bridge
 */
class App {
    constructor() {
        this.isInitialized = false;
        this.version = '2.0.0';
        this.config = {
            apiBaseURL: '',
            refreshInterval: 5000,
            enableWebSocket: false,
            enableNotifications: true,
            theme: 'dark'
        };
        
        this.modules = {
            api: null,
            dashboard: null,
            navigation: null,
            notifications: null
        };
    }

    /**
     * Initialise l'application
     */
    async init() {
        if (this.isInitialized) return;

        try {
            console.log(`🚀 Initialisation TradingView MT4 Bridge v${this.version}`);
            
            // Chargement de la configuration
            this.loadConfig();
            
            // Vérification de la compatibilité du navigateur
            if (!this.checkBrowserCompatibility()) {
                throw new Error('Navigateur non supporté');
            }
            
            // Initialisation des modules
            await this.initModules();
            
            // Configuration des gestionnaires d'erreurs globaux
            this.setupErrorHandlers();
            
            // Vérification de la connexion API
            await this.checkAPIConnection();
            
            // Configuration des raccourcis clavier
            this.setupKeyboardShortcuts();
            
            // Démarrage du monitoring de performance
            this.startPerformanceMonitoring();
            
            this.isInitialized = true;
            console.log('✅ Application initialisée avec succès');
            
            // Notification de démarrage
            if (window.notifications) {
                window.notifications.success('Application', 'TradingView MT4 Bridge démarré');
            }
            
        } catch (error) {
            console.error('❌ Erreur d\'initialisation:', error);
            this.showInitializationError(error);
        }
    }

    /**
     * Charge la configuration depuis localStorage
     */
    loadConfig() {
        const savedConfig = localStorage.getItem('tv-mt4-config');
        if (savedConfig) {
            try {
                const parsedConfig = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsedConfig };
            } catch (error) {
                console.warn('Configuration corrompue, utilisation des valeurs par défaut');
            }
        }
        
        // Appliquer le thème
        document.documentElement.setAttribute('data-theme', this.config.theme);
    }

    /**
     * Sauvegarde la configuration
     */
    saveConfig() {
        try {
            localStorage.setItem('tv-mt4-config', JSON.stringify(this.config));
        } catch (error) {
            console.warn('Impossible de sauvegarder la configuration:', error);
        }
    }

    /**
     * Vérifie la compatibilité du navigateur
     */
    checkBrowserCompatibility() {
        const required = {
            fetch: typeof fetch !== 'undefined',
            promises: typeof Promise !== 'undefined',
            localStorage: typeof Storage !== 'undefined',
            flexbox: CSS.supports('display', 'flex'),
            grid: CSS.supports('display', 'grid')
        };

        const missing = Object.keys(required).filter(feature => !required[feature]);
        
        if (missing.length > 0) {
            console.error('Fonctionnalités manquantes:', missing);
            return false;
        }
        
        return true;
    }

    /**
     * Initialise les modules de l'application
     */
    async initModules() {
        console.log('🔧 Initialisation des modules...');
        
        // Récupération des instances globales
        this.modules.api = window.api;
        this.modules.notifications = window.notifications;
        this.modules.navigation = window.navigation;
        this.modules.dashboard = window.dashboard;
        
        // Vérification que tous les modules sont présents
        const missingModules = Object.keys(this.modules)
            .filter(key => !this.modules[key]);
            
        if (missingModules.length > 0) {
            throw new Error(`Modules manquants: ${missingModules.join(', ')}`);
        }
        
        console.log('✅ Modules initialisés');
    }

    /**
     * Configure les gestionnaires d'erreurs globaux
     */
    setupErrorHandlers() {
        // Erreurs JavaScript non capturées
        window.addEventListener('error', (event) => {
            console.error('Erreur JavaScript:', event.error);
            this.handleGlobalError(event.error, 'JavaScript Error');
        });

        // Promesses rejetées non capturées
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Promesse rejetée:', event.reason);
            this.handleGlobalError(event.reason, 'Unhandled Promise Rejection');
        });

        // Erreurs de ressources (images, scripts, etc.)
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                console.warn('Ressource non chargée:', event.target.src || event.target.href);
            }
        }, true);
    }

    /**
     * Gère les erreurs globales
     */
    handleGlobalError(error, context = '') {
        const errorInfo = {
            message: error.message || error.toString(),
            stack: error.stack,
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Logger l'erreur
        console.error('Erreur globale:', errorInfo);

        // Notification utilisateur pour les erreurs critiques
        if (this.modules.notifications && this.isCriticalError(error)) {
            this.modules.notifications.error(
                'Erreur Système',
                'Une erreur inattendue s\'est produite',
                {
                    persistent: true,
                    actions: [{
                        id: 'reload',
                        label: 'Recharger',
                        handler: () => window.location.reload()
                    }]
                }
            );
        }

        // TODO: Envoyer l'erreur au serveur pour monitoring
        // this.sendErrorToServer(errorInfo);
    }

    /**
     * Détermine si une erreur est critique
     */
    isCriticalError(error) {
        const criticalPatterns = [
            /network/i,
            /fetch/i,
            /connection/i,
            /unauthorized/i,
            /forbidden/i
        ];

        return criticalPatterns.some(pattern => 
            pattern.test(error.message || error.toString())
        );
    }

    /**
     * Vérifie la connexion à l'API
     */
    async checkAPIConnection() {
        console.log('🔗 Vérification de la connexion API...');
        
        try {
            const status = await this.modules.api.getSystemStatus();
            console.log('✅ API connectée:', status);
            
            // Afficher le statut de connexion MT4
            if (!status.mt4Connected) {
                this.modules.notifications?.warning(
                    'Connexion MT4',
                    'MT4 n\'est pas connecté'
                );
            }
            
        } catch (error) {
            console.error('❌ Erreur de connexion API:', error);
            this.modules.notifications?.error(
                'Connexion API',
                'Impossible de contacter le serveur',
                { persistent: true }
            );
            throw error;
        }
    }

    /**
     * Configure les raccourcis clavier
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + combinaisons
            if (event.ctrlKey || event.metaKey) {
                switch (event.key.toLowerCase()) {
                    case 'r':
                        event.preventDefault();
                        this.refreshData();
                        break;
                    case 'd':
                        event.preventDefault();
                        this.modules.navigation?.navigateTo('dashboard');
                        break;
                    case 's':
                        event.preventDefault();
                        this.modules.navigation?.navigateTo('strategies');
                        break;
                    case 'o':
                        event.preventDefault();
                        this.modules.navigation?.navigateTo('orders');
                        break;
                }
            }
            
            // Touche Escape - fermer les modals
            if (event.key === 'Escape') {
                const modals = document.querySelectorAll('.modal-overlay');
                modals.forEach(modal => modal.remove());
            }
        });
        
        console.log('⌨️ Raccourcis clavier configurés');
    }

    /**
     * Démarre le monitoring de performance
     */
    startPerformanceMonitoring() {
        // Surveiller les métriques de performance
        if ('performance' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (entry.entryType === 'navigation') {
                        console.log('📊 Temps de chargement:', entry.loadEventEnd);
                    }
                    
                    // Surveiller les requêtes lentes
                    if (entry.entryType === 'resource' && entry.duration > 2000) {
                        console.warn('🐌 Ressource lente:', entry.name, entry.duration);
                    }
                });
            });
            
            observer.observe({ entryTypes: ['navigation', 'resource'] });
        }
        
        // Surveiller l'utilisation mémoire
        setInterval(() => {
            if ('memory' in performance) {
                const memory = performance.memory;
                const memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;
                
                if (memoryUsage > 0.8) {
                    console.warn('⚠️ Utilisation mémoire élevée:', Math.round(memoryUsage * 100) + '%');
                }
            }
        }, 30000); // Chaque 30 secondes
    }

    /**
     * Actualise les données de l'application
     */
    async refreshData() {
        try {
            const currentPage = this.modules.navigation?.getCurrentPage();
            
            if (currentPage === 'dashboard' && this.modules.dashboard) {
                await this.modules.dashboard.refresh();
            } else {
                // Recharger la page actuelle
                await this.modules.navigation?.loadPageContent(currentPage, '');
            }
            
            this.modules.notifications?.success('Actualisation', 'Données mises à jour');
        } catch (error) {
            this.modules.notifications?.error('Erreur', 'Impossible d\'actualiser les données');
        }
    }

    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
        
        // Appliquer les changements
        if (newConfig.theme) {
            document.documentElement.setAttribute('data-theme', newConfig.theme);
        }
        
        console.log('Configuration mise à jour:', newConfig);
    }

    /**
     * Obtient les informations de l'application
     */
    getAppInfo() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            config: this.config,
            uptime: performance.now(),
            modules: Object.keys(this.modules).map(key => ({
                name: key,
                loaded: !!this.modules[key]
            }))
        };
    }

    /**
     * Affiche l'erreur d'initialisation
     */
    showInitializationError(error) {
        const errorHTML = `
            <div class="init-error">
                <div class="error-container">
                    <h1>❌ Erreur d'initialisation</h1>
                    <p>L'application n'a pas pu démarrer correctement:</p>
                    <div class="error-details">${error.message}</div>
                    <div class="error-actions">
                        <button onclick="window.location.reload()" class="btn btn-primary">
                            Recharger la page
                        </button>
                        <button onclick="localStorage.clear(); window.location.reload()" class="btn btn-secondary">
                            Réinitialiser et recharger
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHTML;
    }

    /**
     * Arrêt propre de l'application
     */
    shutdown() {
        console.log('🔽 Arrêt de l\'application...');
        
        // Arrêter les intervalles
        window.pollingSystem?.stopAll();
        
        // Nettoyer les modules
        this.modules.dashboard?.destroy();
        
        // Sauvegarder la configuration
        this.saveConfig();
        
        this.isInitialized = false;
        console.log('✅ Application arrêtée proprement');
    }
}

/**
 * Styles CSS pour l'erreur d'initialisation
 */
const initErrorStyles = `
    .init-error {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--bg-primary, #0d1117);
        color: var(--text-primary, #f0f6fc);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        z-index: 10000;
    }
    
    .error-container {
        max-width: 500px;
        padding: 2rem;
        text-align: center;
    }
    
    .error-container h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
    }
    
    .error-details {
        background: rgba(248, 81, 73, 0.1);
        border: 1px solid rgba(248, 81, 73, 0.3);
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
        font-family: monospace;
        font-size: 0.9rem;
    }
    
    .error-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin-top: 1.5rem;
    }
    
    .error-actions .btn {
        padding: 0.75rem 1.5rem;
        border: 1px solid #30363d;
        border-radius: 8px;
        background: #21262d;
        color: #f0f6fc;
        cursor: pointer;
        text-decoration: none;
        font-weight: 500;
        transition: all 0.2s ease;
    }
    
    .error-actions .btn:hover {
        background: #30363d;
        border-color: #58a6ff;
        transform: translateY(-1px);
    }
    
    .error-actions .btn-primary {
        background: #58a6ff;
        border-color: #58a6ff;
    }
    
    .error-actions .btn-primary:hover {
        background: #4493f8;
        border-color: #4493f8;
    }
`;

// Injecter les styles d'erreur
const errorStyleSheet = document.createElement('style');
errorStyleSheet.textContent = initErrorStyles;
document.head.appendChild(errorStyleSheet);

/**
 * Instance globale de l'application
 */
window.app = new App();

/**
 * Console de debug pour développement
 */
window.tvmt4Debug = {
    app: window.app,
    
    getInfo() {
        return window.app.getAppInfo();
    },
    
    refreshData() {
        return window.app.refreshData();
    },
    
    clearCache() {
        window.apiCache?.clear();
        localStorage.removeItem('tv-mt4-config');
        console.log('Cache et configuration effacés');
    },
    
    testNotification(type = 'info') {
        window.notifications?.show(type, 'Test', 'Ceci est une notification de test');
    },
    
    simulateError() {
        throw new Error('Erreur simulée pour test');
    },
    
    getSystemStatus() {
        return window.api?.getSystemStatus();
    },
    
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        window.app.updateConfig({ theme: newTheme });
    }
};

/**
 * Auto-initialisation de l'application
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Attendre que tous les scripts soient chargés
    await new Promise(resolve => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve);
        }
    });
    
    // Petite pause pour s'assurer que tous les modules sont prêts
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initialiser l'application
    try {
        await window.app.init();
    } catch (error) {
        console.error('Échec de l\'initialisation de l\'application:', error);
    }
});

/**
 * Nettoyage avant fermeture
 */
window.addEventListener('beforeunload', () => {
    window.app?.shutdown();
});

/**
 * Gestion de la visibilité de la page pour optimiser les performances
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page cachée - réduire les mises à jour
        console.log('📱 Page cachée - optimisation des performances');
        window.pollingSystem?.stopAll();
    } else {
        // Page visible - reprendre les mises à jour
        console.log('👁️ Page visible - reprise des mises à jour');
        if (window.dashboard?.isInitialized) {
            window.dashboard.startAutoRefresh();
        }
    }
});

/**
 * Gestion des erreurs de connexion réseau
 */
window.addEventListener('online', () => {
    console.log('🌐 Connexion réseau rétablie');
    window.notifications?.success('Connexion', 'Connexion réseau rétablie');
    window.app?.refreshData();
});

window.addEventListener('offline', () => {
    console.log('📵 Connexion réseau perdue');
    window.notifications?.warning('Connexion', 'Connexion réseau perdue', { persistent: true });
});

/**
 * Gestion des mises à jour de l'application (PWA ready)
 */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.notifications?.info(
            'Mise à jour',
            'Une nouvelle version est disponible',
            {
                persistent: true,
                actions: [{
                    id: 'reload',
                    label: 'Recharger',
                    handler: () => window.location.reload()
                }]
            }
        );
    });
}

/**
 * Export pour utilisation en module
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}

console.log('📦 Application TradingView MT4 Bridge chargée');