/**
 * Gestionnaire de mises à jour temps réel
 * Gère le polling des données et les notifications en temps réel
 */

class RealtimeManager {
    constructor() {
        this.intervals = new Map();
        this.isOnline = navigator.onLine;
        this.lastData = new Map();
        this.listeners = new Map();
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 2000;
    }

    /**
     * Initialiser le gestionnaire temps réel
     */
    init() {
        this.bindNetworkEvents();
        this.startPolling();
        this.startHeartbeat();
    }

    /**
     * Événements réseau
     */
    bindNetworkEvents() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.retryCount = 0;
            this.startPolling();
            
            if (window.NotificationManager) {
                window.NotificationManager.success(
                    'Connexion rétablie',
                    'Les mises à jour temps réel ont repris'
                );
            }
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.stopPolling();
            
            if (window.NotificationManager) {
                window.NotificationManager.warning(
                    'Connexion perdue',
                    'Les mises à jour temps réel sont suspendues'
                );
            }
        });
    }

    /**
     * Démarrer le polling
     */
    startPolling() {
        if (!this.isOnline) return;

        // Account state - Plus fréquent
        this.startInterval('accountState', async () => {
            const result = await window.apiClient.getAccountState();
            if (result.success) {
                this.handleAccountStateUpdate(result.data);
            } else {
                this.handleError('accountState', result.error);
            }
        }, window.CONFIG.POLLING_INTERVALS.ACCOUNT_STATE);

        // System status
        this.startInterval('systemStatus', async () => {
            const result = await window.apiClient.getSystemStatus();
            if (result.success) {
                this.handleSystemStatusUpdate(result.data);
            } else {
                this.handleError('systemStatus', result.error);
            }
        }, window.CONFIG.POLLING_INTERVALS.SYSTEM_STATUS);

        // Risk metrics
        this.startInterval('riskMetrics', async () => {
            const result = await window.apiClient.getRiskMetrics();
            if (result.success) {
                this.handleRiskMetricsUpdate(result.data);
            } else {
                this.handleError('riskMetrics', result.error);
            }
        }, window.CONFIG.POLLING_INTERVALS.RISK_METRICS);

        // Orders - Seulement si on est sur la page dashboard ou orders
        if (this.shouldPollOrders()) {
            this.startInterval('orders', async () => {
                const result = await window.apiClient.getOrders({ limit: 10 });
                if (result.success) {
                    this.handleOrdersUpdate(result.data);
                } else {
                    this.handleError('orders', result.error);
                }
            }, window.CONFIG.POLLING_INTERVALS.ORDERS);
        }

        // Notifications (vérifier nouveaux événements)
        this.startInterval('notifications', async () => {
            const result = await window.apiClient.getLogs({ 
                limit: 5, 
                severity: 'ERROR' 
            });
            if (result.success) {
                this.handleNotificationsUpdate(result.data);
            }
        }, window.CONFIG.POLLING_INTERVALS.NOTIFICATIONS);
    }

    /**
     * Arrêter le polling
     */
    stopPolling() {
        this.intervals.forEach((intervalId, key) => {
            clearInterval(intervalId);
        });
        this.intervals.clear();
    }

    /**
     * Démarrer un intervalle spécifique
     */
    startInterval(key, callback, interval) {
        // Arrêter l'ancien intervalle s'il existe
        if (this.intervals.has(key)) {
            clearInterval(this.intervals.get(key));
        }

        // Première exécution immédiate
        callback();

        // Démarrer l'intervalle
        const intervalId = setInterval(callback, interval);
        this.intervals.set(key, intervalId);
    }

    /**
     * Arrêter un intervalle spécifique
     */
    stopInterval(key) {
        if (this.intervals.has(key)) {
            clearInterval(this.intervals.get(key));
            this.intervals.delete(key);
        }
    }

    /**
     * Heartbeat pour maintenir la connexion
     */
    startHeartbeat() {
        this.startInterval('heartbeat', async () => {
            try {
                const result = await fetch('/api/system/status', {
                    method: 'HEAD',
                    timeout: 5000
                });
                
                if (!result.ok) {
                    throw new Error('Heartbeat failed');
                }
                
                this.retryCount = 0;
            } catch (error) {
                this.handleHeartbeatError(error);
            }
        }, 30000); // Toutes les 30 secondes
    }

    /**
     * Gestion des erreurs de heartbeat
     */
    handleHeartbeatError(error) {
        this.retryCount++;
        
        if (this.retryCount >= this.maxRetries) {
            this.stopPolling();
            
            if (window.NotificationManager) {
                window.NotificationManager.error(
                    'Connexion perdue',
                    'Impossible de contacter le serveur'
                );
            }
        }
    }

    /**
     * Gérer les mises à jour de l'état du compte
     */
    handleAccountStateUpdate(data) {
        const lastData = this.lastData.get('accountState');
        
        if (lastData) {
            // Détecter les changements significatifs
            const balanceChange = data.current.balance - lastData.current.balance;
            const equityChange = data.current.equity - lastData.current.equity;
            
            if (Math.abs(balanceChange) > 0.01) {
                this.emitUpdate('balanceChange', {
                    old: lastData.current.balance,
                    new: data.current.balance,
                    change: balanceChange
                });
            }
            
            if (Math.abs(equityChange) > 0.01) {
                this.emitUpdate('equityChange', {
                    old: lastData.current.equity,
                    new: data.current.equity,
                    change: equityChange
                });
            }
        }
        
        this.lastData.set('accountState', data);
        this.emitUpdate('accountState', data);
    }

    /**
     * Gérer les mises à jour du statut système
     */
    handleSystemStatusUpdate(data) {
        const lastData = this.lastData.get('systemStatus');
        
        if (lastData) {
            // Détecter les changements de statut
            if (data.mt4Connected !== lastData.mt4Connected) {
                const event = data.mt4Connected ? 'mt4Connected' : 'mt4Disconnected';
                this.emitUpdate(event, data);
                
                if (window.NotificationManager) {
                    window.NotificationManager.systemNotification(
                        data.mt4Connected ? 'connected' : 'disconnected',
                        `MT4 ${data.mt4Connected ? 'connecté' : 'déconnecté'}`
                    );
                }
            }
            
            if (data.signalProcessor.running !== lastData.signalProcessor.running) {
                this.emitUpdate('signalProcessorStatusChange', data);
            }
        }
        
        this.lastData.set('systemStatus', data);
        this.emitUpdate('systemStatus', data);
    }

    /**
     * Gérer les mises à jour des métriques de risque
     */
    handleRiskMetricsUpdate(data) {
        const lastData = this.lastData.get('riskMetrics');
        
        if (lastData && data.current) {
            // Détecter les changements de positions
            const positionChange = data.current.openPositions - (lastData.current?.openPositions || 0);
            
            if (positionChange !== 0) {
                this.emitUpdate('positionChange', {
                    old: lastData.current?.openPositions || 0,
                    new: data.current.openPositions,
                    change: positionChange
                });
            }
        }
        
        this.lastData.set('riskMetrics', data);
        this.emitUpdate('riskMetrics', data);
    }

    /**
     * Gérer les mises à jour des ordres
     */
    handleOrdersUpdate(data) {
        const lastData = this.lastData.get('orders');
        
        if (lastData) {
            // Détecter les nouveaux ordres
            const newOrders = data.data.filter(order => 
                !lastData.data.some(lastOrder => lastOrder.id === order.id)
            );
            
            newOrders.forEach(order => {
                this.emitUpdate('newOrder', order);
                
                if (window.NotificationManager) {
                    window.NotificationManager.tradingNotification(
                        'order_placed',
                        order.symbol,
                        order.type,
                        { lots: order.lots, price: order.openPrice }
                    );
                }
            });
            
            // Détecter les changements de statut
            data.data.forEach(order => {
                const lastOrder = lastData.data.find(lo => lo.id === order.id);
                if (lastOrder && lastOrder.status !== order.status) {
                    this.emitUpdate('orderStatusChange', {
                        order,
                        oldStatus: lastOrder.status,
                        newStatus: order.status
                    });
                    
                    if (order.status === 'FILLED') {
                        if (window.NotificationManager) {
                            window.NotificationManager.tradingNotification(
                                'order_filled',
                                order.symbol,
                                order.type,
                                { lots: order.lots, price: order.openPrice }
                            );
                        }
                    }
                }
            });
        }
        
        this.lastData.set('orders', data);
        this.emitUpdate('orders', data);
    }

    /**
     * Gérer les mises à jour des notifications
     */
    handleNotificationsUpdate(data) {
        const lastData = this.lastData.get('notifications');
        
        if (lastData) {
            // Détecter les nouveaux logs d'erreur
            const newErrors = data.data.filter(log => 
                !lastData.data.some(lastLog => lastLog.id === log.id) &&
                log.severity === 'ERROR'
            );
            
            newErrors.forEach(error => {
                if (window.NotificationManager) {
                    window.NotificationManager.error(
                        'Erreur système',
                        error.details || 'Une erreur est survenue'
                    );
                }
            });
        }
        
        this.lastData.set('notifications', data);
    }

    /**
     * Émettre une mise à jour
     */
    emitUpdate(eventType, data) {
        const event = new CustomEvent(`realtime:${eventType}`, {
            detail: data
        });
        window.dispatchEvent(event);
        
        // Appeler les listeners spécifiques
        if (this.listeners.has(eventType)) {
            this.listeners.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Erreur dans listener:', error);
                }
            });
        }
    }

    /**
     * Ajouter un listener
     */
    addListener(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        
        this.listeners.get(eventType).add(callback);
        
        // Retourner une fonction pour supprimer le listener
        return () => {
            this.listeners.get(eventType).delete(callback);
        };
    }

    /**
     * Supprimer un listener
     */
    removeListener(eventType, callback) {
        if (this.listeners.has(eventType)) {
            this.listeners.get(eventType).delete(callback);
        }
    }

    /**
     * Gestion des erreurs
     */
    handleError(source, error) {
        console.error(`Erreur ${source}:`, error);
        
        this.retryCount++;
        
        if (this.retryCount >= this.maxRetries) {
            this.stopInterval(source);
            
            // Réessayer après un délai
            setTimeout(() => {
                this.retryCount = 0;
                this.startInterval(source, this.getCallbackForSource(source), this.getIntervalForSource(source));
            }, this.retryDelay);
        }
    }

    /**
     * Obtenir le callback pour une source
     */
    getCallbackForSource(source) {
        const callbacks = {
            accountState: async () => {
                const result = await window.apiClient.getAccountState();
                if (result.success) {
                    this.handleAccountStateUpdate(result.data);
                } else {
                    this.handleError('accountState', result.error);
                }
            },
            systemStatus: async () => {
                const result = await window.apiClient.getSystemStatus();
                if (result.success) {
                    this.handleSystemStatusUpdate(result.data);
                } else {
                    this.handleError('systemStatus', result.error);
                }
            },
            // Ajouter d'autres callbacks...
        };
        
        return callbacks[source];
    }

    /**
     * Obtenir l'intervalle pour une source
     */
    getIntervalForSource(source) {
        const intervals = {
            accountState: window.CONFIG.POLLING_INTERVALS.ACCOUNT_STATE,
            systemStatus: window.CONFIG.POLLING_INTERVALS.SYSTEM_STATUS,
            riskMetrics: window.CONFIG.POLLING_INTERVALS.RISK_METRICS,
            orders: window.CONFIG.POLLING_INTERVALS.ORDERS,
            notifications: window.CONFIG.POLLING_INTERVALS.NOTIFICATIONS
        };
        
        return intervals[source] || 5000;
    }

    /**
     * Vérifier si on doit poller les ordres
     */
    shouldPollOrders() {
        const currentPage = window.location.pathname;
        return currentPage.includes('dashboard') || 
               currentPage.includes('orders') || 
               currentPage === '/' || 
               currentPage.includes('index');
    }

    /**
     * Modifier la fréquence de polling
     */
    setPollingInterval(source, interval) {
        if (this.intervals.has(source)) {
            this.stopInterval(source);
            const callback = this.getCallbackForSource(source);
            this.startInterval(source, callback, interval);
        }
    }

    /**
     * Obtenir les statistiques de performance
     */
    getStats() {
        return {
            isOnline: this.isOnline,
            activeIntervals: this.intervals.size,
            lastUpdateTimes: Object.fromEntries(
                Array.from(this.lastData.entries()).map(([key, value]) => [
                    key,
                    value.timestamp || new Date().toISOString()
                ])
            ),
            retryCount: this.retryCount,
            listenersCount: Object.fromEntries(
                Array.from(this.listeners.entries()).map(([key, set]) => [key, set.size])
            )
        };
    }

    /**
     * Forcer une mise à jour
     */
    forceUpdate(source) {
        const callback = this.getCallbackForSource(source);
        if (callback) {
            callback();
        }
    }

    /**
     * Arrêter le gestionnaire
     */
    destroy() {
        this.stopPolling();
        this.listeners.clear();
        this.lastData.clear();
    }
}

// Export global
window.RealtimeManager = RealtimeManager;