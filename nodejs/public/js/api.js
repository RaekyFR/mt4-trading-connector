// js/api.js

/**
 * Client API pour communiquer avec le serveur TradingView MT4 Bridge
 */
class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Effectue une requête HTTP
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    /**
     * Méthodes HTTP
     */
    async get(endpoint, params = {}) {
        const searchParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                searchParams.append(key, params[key]);
            }
        });
        
        const queryString = searchParams.toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, { method: 'GET' });
    }

    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ==================== ACCOUNT ENDPOINTS ====================

    /**
     * Récupère l'état actuel du compte
     */
    async getAccountState() {
        return this.get('/api/account/state');
    }

    /**
     * Récupère les métriques de performance
     */
    async getAccountMetrics(period = '7d') {
        return this.get('/api/account/metrics', { period });
    }

    // ==================== STRATEGIES ENDPOINTS ====================

    /**
     * Récupère toutes les stratégies
     */
    async getStrategies() {
        return this.get('/api/strategies');
    }

    /**
     * Crée une nouvelle stratégie
     */
    async createStrategy(strategyData) {
        return this.post('/api/strategies', strategyData);
    }

    /**
     * Met à jour une stratégie
     */
    async updateStrategy(id, strategyData) {
        return this.put(`/api/strategies/${id}`, strategyData);
    }

    // ==================== SIGNALS ENDPOINTS ====================

    /**
     * Récupère les signaux avec filtres
     */
    async getSignals(filters = {}) {
        const { status, strategyId, symbol, limit = 50, offset = 0 } = filters;
        return this.get('/api/signals', { status, strategyId, symbol, limit, offset });
    }

    /**
     * Récupère un signal spécifique
     */
    async getSignal(id) {
        return this.get(`/api/signals/${id}`);
    }

    // ==================== ORDERS ENDPOINTS ====================

    /**
     * Récupère les ordres avec filtres
     */
    async getOrders(filters = {}) {
        const { status, symbol, strategyId, limit = 50, offset = 0 } = filters;
        return this.get('/api/orders', { status, symbol, strategyId, limit, offset });
    }

    /**
     * Ferme un ordre spécifique
     */
    async closeOrder(ticket) {
        return this.post(`/api/orders/close/${ticket}`);
    }

    /**
     * Ferme tous les ordres ouverts
     */
    async closeAllOrders(filters = {}) {
        return this.post('/api/orders/close-all', filters);
    }

    // ==================== RISK MANAGEMENT ENDPOINTS ====================

    /**
     * Récupère la configuration de risk
     */
    async getRiskConfig(strategyId = null) {
        return this.get('/api/risk/config', { strategyId });
    }

    /**
     * Met à jour la configuration de risk
     */
    async updateRiskConfig(configData) {
        return this.put('/api/risk/config', configData);
    }

    /**
     * Récupère les métriques de risk
     */
    async getRiskMetrics() {
        return this.get('/api/risk/metrics');
    }

    // ==================== AUDIT LOGS ENDPOINTS ====================

    /**
     * Récupère les logs d'audit
     */
    async getLogs(filters = {}) {
        const { severity, entityType, limit = 100, offset = 0 } = filters;
        return this.get('/api/logs', { severity, entityType, limit, offset });
    }

    // ==================== SYSTEM ENDPOINTS ====================

    /**
     * Récupère le statut du système
     */
    async getSystemStatus() {
        return this.get('/api/system/status');
    }

    /**
     * Redémarre les composants du système
     */
    async restartSystem(component = null) {
        return this.post('/api/system/restart', { component });
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Formate les montants en USD
     */
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }

    /**
     * Formate les pourcentages
     */
    formatPercentage(value, decimals = 2) {
        return `${(value || 0).toFixed(decimals)}%`;
    }

    /**
     * Formate les dates
     */
    formatDate(dateString, options = {}) {
        if (!dateString) return '--';
        
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return new Date(dateString).toLocaleDateString('en-US', { ...defaultOptions, ...options });
    }

    /**
     * Formate le temps relatif
     */
    formatRelativeTime(dateString) {
        if (!dateString) return '--';
        
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }

    /**
     * Détermine la couleur selon la valeur
     */
    getValueColor(value) {
        if (value > 0) return 'positive';
        if (value < 0) return 'negative';
        return 'neutral';
    }

    /**
     * Calcule le niveau de risque
     */
    getRiskLevel(value, maxValue) {
        const percentage = (value / maxValue) * 100;
        if (percentage <= 30) return 'low';
        if (percentage <= 70) return 'medium';
        return 'high';
    }

    /**
     * Valide une requête avant envoi
     */
    validateRequest(data, requiredFields = []) {
        const missing = requiredFields.filter(field => !data[field]);
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
        return true;
    }
}

/**
 * Instance globale du client API
 */
window.api = new APIClient();

/**
 * Gestionnaire d'erreurs global pour les requêtes API
 */
window.handleAPIError = function(error, context = '') {
    console.error(`API Error ${context}:`, error);
    
    let message = 'Une erreur est survenue';
    
    if (error.message) {
        if (error.message.includes('Failed to fetch')) {
            message = 'Impossible de contacter le serveur';
        } else if (error.message.includes('NetworkError')) {
            message = 'Erreur de réseau';
        } else {
            message = error.message;
        }
    }
    
    // Afficher notification d'erreur si le système de notifications est disponible
    if (window.notifications) {
        window.notifications.show('error', 'Erreur API', message);
    }
    
    return message;
};

/**
 * Cache simple pour les données API
 */
window.apiCache = {
    data: new Map(),
    ttl: new Map(),
    
    set(key, value, ttlMs = 30000) { // 30 secondes par défaut
        this.data.set(key, value);
        this.ttl.set(key, Date.now() + ttlMs);
    },
    
    get(key) {
        const expiry = this.ttl.get(key);
        if (expiry && Date.now() > expiry) {
            this.data.delete(key);
            this.ttl.delete(key);
            return null;
        }
        return this.data.get(key) || null;
    },
    
    clear() {
        this.data.clear();
        this.ttl.clear();
    },
    
    has(key) {
        const expiry = this.ttl.get(key);
        return expiry && Date.now() <= expiry && this.data.has(key);
    }
};

/**
 * Utilitaires pour les WebSocket (pour implémentation future)
 */
window.websocketUtils = {
    connection: null,
    callbacks: new Map(),
    
    connect(url = 'ws://localhost:3000/ws') {
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            return this.connection;
        }
        
        this.connection = new WebSocket(url);
        
        this.connection.onopen = () => {
            console.log('WebSocket connected');
            this.triggerCallback('connected', { status: 'connected' });
        };
        
        this.connection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.triggerCallback(data.type, data);
            } catch (error) {
                console.error('WebSocket message parsing error:', error);
            }
        };
        
        this.connection.onclose = () => {
            console.log('WebSocket disconnected');
            this.triggerCallback('disconnected', { status: 'disconnected' });
            
            // Tentative de reconnexion après 5 secondes
            setTimeout(() => this.connect(url), 5000);
        };
        
        this.connection.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.triggerCallback('error', { error });
        };
        
        return this.connection;
    },
    
    disconnect() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
    },
    
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
    },
    
    off(event, callback) {
        const callbacks = this.callbacks.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    },
    
    triggerCallback(event, data) {
        const callbacks = this.callbacks.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`WebSocket callback error for ${event}:`, error);
                }
            });
        }
    },
    
    send(data) {
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            this.connection.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket not connected, cannot send data');
        }
    }
};

/**
 * Système de polling pour les mises à jour temps réel
 */
window.pollingSystem = {
    intervals: new Map(),
    
    start(key, callback, intervalMs = 5000) {
        if (this.intervals.has(key)) {
            this.stop(key);
        }
        
        // Exécuter immédiatement
        callback();
        
        // Puis programmer les exécutions suivantes
        const intervalId = setInterval(callback, intervalMs);
        this.intervals.set(key, intervalId);
        
        console.log(`Polling started for ${key} (${intervalMs}ms)`);
    },
    
    stop(key) {
        const intervalId = this.intervals.get(key);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(key);
            console.log(`Polling stopped for ${key}`);
        }
    },
    
    stopAll() {
        this.intervals.forEach((intervalId, key) => {
            clearInterval(intervalId);
            console.log(`Polling stopped for ${key}`);
        });
        this.intervals.clear();
    },
    
    isRunning(key) {
        return this.intervals.has(key);
    }
};