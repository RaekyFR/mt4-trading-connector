/**
 * Client API centralisé pour toutes les communications avec le backend
 * Gère les requêtes HTTP, la gestion d'erreurs et le cache
 */

class ApiClient {
    constructor() {
        this.baseUrl = window.CONFIG.API_BASE_URL;
        this.cache = new Map();
        this.requestQueue = new Map();
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    /**
     * Requête HTTP générique avec gestion d'erreurs
     */
    async request(endpoint, options = {}) {
        const url = this.buildUrl(endpoint, options.params);
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (config.method !== 'GET' && options.body) {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await this.fetchWithRetry(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            console.error(`Erreur API ${endpoint}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Requête avec retry automatique
     */
    async fetchWithRetry(url, config, attempt = 1) {
        try {
            return await fetch(url, config);
        } catch (error) {
            if (attempt < this.retryAttempts) {
                await this.delay(this.retryDelay * attempt);
                return this.fetchWithRetry(url, config, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Construire l'URL complète avec paramètres
     */
    buildUrl(endpoint, params = {}) {
        const baseEndpoint = window.CONFIG.API_ENDPOINTS[endpoint] || endpoint;
        let url = `${this.baseUrl}${baseEndpoint}`;
        
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, value);
            }
        });
        
        const queryString = queryParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
        
        return url;
    }

    /**
     * Délai pour retry
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== ACCOUNT ====================

    async getAccountState() {
        return this.request('ACCOUNT_STATE');
    }

    async getAccountMetrics(period = '7d') {
        return this.request('ACCOUNT_METRICS', { params: { period } });
    }

    // ==================== STRATEGIES ====================

    async getStrategies() {
        return this.request('STRATEGIES');
    }

    async createStrategy(data) {
        return this.request('STRATEGIES', {
            method: 'POST',
            body: data
        });
    }

    async updateStrategy(id, data) {
        return this.request(`STRATEGIES/${id}`, {
            method: 'PUT',
            body: data
        });
    }

    async deleteStrategy(id) {
        return this.request(`STRATEGIES/${id}`, {
            method: 'DELETE'
        });
    }

    // ==================== SIGNALS ====================

    async getSignals(filters = {}) {
        const params = {
            limit: filters.limit || 50,
            offset: filters.offset || 0,
            status: filters.status,
            strategyId: filters.strategyId,
            symbol: filters.symbol
        };
        return this.request('SIGNALS', { params });
    }

    async getSignal(id) {
        return this.request(`SIGNALS/${id}`);
    }

    // ==================== ORDERS ====================

    async getOrders(filters = {}) {
        const params = {
            limit: filters.limit || 50,
            offset: filters.offset || 0,
            status: filters.status,
            strategyId: filters.strategyId,
            symbol: filters.symbol
        };
        return this.request('ORDERS', { params });
    }

    async closeOrder(ticket) {
        return this.request(`ORDERS/close/${ticket}`, {
            method: 'POST'
        });
    }

    async closeAllOrders(filters = {}) {
        return this.request('ORDERS/close-all', {
            method: 'POST',
            body: filters
        });
    }

    // ==================== RISK MANAGEMENT ====================

    async getRiskConfig(strategyId = null) {
        const params = strategyId ? { strategyId } : {};
        return this.request('RISK_CONFIG', { params });
    }

    async updateRiskConfig(data) {
        return this.request('RISK_CONFIG', {
            method: 'PUT',
            body: data
        });
    }

    async getRiskMetrics() {
        return this.request('RISK_METRICS');
    }

    // ==================== LOGS ====================

    async getLogs(filters = {}) {
        const params = {
            limit: filters.limit || 100,
            offset: filters.offset || 0,
            severity: filters.severity,
            entityType: filters.entityType
        };
        return this.request('LOGS', { params });
    }

    // ==================== SYSTEM ====================

    async getSystemStatus() {
        return this.request('SYSTEM_STATUS');
    }

    async restartSystem(component = null) {
        return this.request('SYSTEM/restart', {
            method: 'POST',
            body: { component }
        });
    }

    // ==================== CACHE MANAGEMENT ====================

    /**
     * Mettre en cache une réponse API
     */
    setCache(key, data, ttl = 30000) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    /**
     * Récupérer depuis le cache
     */
    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    /**
     * Vider le cache
     */
    clearCache() {
        this.cache.clear();
    }

    // ==================== BATCH REQUESTS ====================

    /**
     * Exécuter plusieurs requêtes en parallèle
     */
    async batchRequest(requests) {
        const promises = requests.map(request => {
            return this.request(request.endpoint, request.options);
        });
        
        return Promise.allSettled(promises);
    }

    // ==================== WEBSOCKET SIMULATION ====================

    /**
     * Simuler des mises à jour temps réel via polling
     */
    startPolling(endpoint, callback, interval = 5000) {
        const pollId = setInterval(async () => {
            const result = await this.request(endpoint);
            if (result.success) {
                callback(result.data);
            }
        }, interval);
        
        return pollId;
    }

    stopPolling(pollId) {
        clearInterval(pollId);
    }
}

// Instance globale
window.apiClient = new ApiClient();

// Gestionnaire d'erreurs global
window.addEventListener('unhandledrejection', (event) => {
    console.error('Erreur non gérée:', event.reason);
    
    // Afficher une notification si disponible
    if (window.NotificationManager) {
        window.NotificationManager.show(
            'Erreur réseau',
            'Une erreur de connexion est survenue',
            'error'
        );
    }
});

// Vérifier la connectivité
window.addEventListener('online', () => {
    console.log('Connexion rétablie');
    if (window.NotificationManager) {
        window.NotificationManager.show(
            'Connexion rétablie',
            'La connexion au serveur est de nouveau disponible',
            'success'
        );
    }
});

window.addEventListener('offline', () => {
    console.log('Connexion perdue');
    if (window.NotificationManager) {
        window.NotificationManager.show(
            'Connexion perdue',
            'Vérifiez votre connexion réseau',
            'error'
        );
    }
});