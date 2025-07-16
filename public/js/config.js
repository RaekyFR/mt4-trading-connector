// Configuration globale de l'application
const CONFIG = {
    // API Configuration
    API_BASE_URL: 'http://localhost:3000',
    API_ENDPOINTS: {
        ACCOUNT_STATE: '/api/account/state',
        ACCOUNT_METRICS: '/api/account/metrics',
        STRATEGIES: '/api/strategies',
        SIGNALS: '/api/signals',
        ORDERS: '/api/orders',
        RISK_CONFIG: '/api/risk/config',
        RISK_METRICS: '/api/risk/metrics',
        LOGS: '/api/logs',
        SYSTEM_STATUS: '/api/system/status'
    },
    
    // Polling Configuration
    POLLING_INTERVALS: {
        ACCOUNT_STATE: 5000,      // 5 secondes
        SYSTEM_STATUS: 10000,     // 10 secondes
        ORDERS: 3000,             // 3 secondes
        RISK_METRICS: 5000,       // 5 secondes
        NOTIFICATIONS: 2000       // 2 secondes
    },
    
    // UI Configuration
    UI: {
        THEME_STORAGE_KEY: 'trading-monitor-theme',
        PREFERENCES_STORAGE_KEY: 'trading-monitor-preferences',
        DEFAULT_THEME: 'dark',
        ITEMS_PER_PAGE: 25,
        ANIMATION_DURATION: 300,
        CHART_COLORS: {
            PRIMARY: '#00d4aa',
            SECONDARY: '#246cf9',
            SUCCESS: '#00c851',
            WARNING: '#ffbb33',
            DANGER: '#ff4444',
            INFO: '#33b5e5'
        }
    },
    
    // Trading Configuration
    TRADING: {
        SUPPORTED_SYMBOLS: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'XAUUSD', 'BTCUSD'],
        ORDER_TYPES: ['BUY', 'SELL', 'BUY_LIMIT', 'SELL_LIMIT', 'BUY_STOP', 'SELL_STOP'],
        SIGNAL_STATUSES: ['PENDING', 'VALIDATED', 'REJECTED', 'PROCESSED', 'ERROR'],
        ORDER_STATUSES: ['PENDING', 'SENDING', 'PLACED', 'FILLED', 'PARTIAL', 'CANCELLED', 'CLOSED', 'ERROR']
    },
    
    // Formatage et localisation
    FORMATS: {
        CURRENCY: {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        },
        PERCENTAGE: {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 2
        },
        NUMBER: {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        },
        DATETIME: {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }
    },
    
    // Notifications
    NOTIFICATIONS: {
        TYPES: {
            SUCCESS: 'success',
            ERROR: 'error',
            WARNING: 'warning',
            INFO: 'info'
        },
        DURATION: 5000,
        MAX_NOTIFICATIONS: 5
    }
};

// Fonction pour obtenir la configuration selon l'environnement
function getConfig(env = 'development') {
    const config = { ...CONFIG };
    
    if (env === 'production') {
        config.API_BASE_URL = window.location.origin;
        config.POLLING_INTERVALS.ACCOUNT_STATE = 10000;
        config.POLLING_INTERVALS.SYSTEM_STATUS = 30000;
    }
    
    return config;
}

// Export pour utilisation dans d'autres modules
window.CONFIG = getConfig();

// Utilitaires de configuration
window.ConfigUtils = {
    // Obtenir une valeur de configuration par chemin
    get: (path) => {
        return path.split('.').reduce((obj, key) => obj?.[key], window.CONFIG);
    },
    
    // Construire une URL d'API
    buildApiUrl: (endpoint, params = {}) => {
        const baseUrl = window.CONFIG.API_BASE_URL;
        const endpointPath = window.CONFIG.API_ENDPOINTS[endpoint] || endpoint;
        let url = `${baseUrl}${endpointPath}`;
        
        const queryParams = new URLSearchParams(params).toString();
        if (queryParams) {
            url += `?${queryParams}`;
        }
        
        return url;
    },
    
    // Obtenir la couleur du thème
    getThemeColor: (colorName) => {
        return window.CONFIG.UI.CHART_COLORS[colorName.toUpperCase()] || '#000000';
    },
    
    // Formater une valeur selon le type
    formatValue: (value, type = 'NUMBER') => {
        const formatter = window.CONFIG.FORMATS[type];
        if (!formatter) return value;
        
        try {
            return new Intl.NumberFormat('fr-FR', formatter).format(value);
        } catch (error) {
            console.error('Erreur formatage:', error);
            return value;
        }
    }
};