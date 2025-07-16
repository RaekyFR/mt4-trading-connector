/**
 * Gestionnaire du dashboard principal
 * Gère l'affichage des métriques, graphiques et mises à jour temps réel
 */

class DashboardManager {
    constructor() {
        this.charts = new Map();
        this.currentData = {
            accountState: null,
            systemStatus: null,
            riskMetrics: null,
            orders: null,
            signals: null,
            metrics: null
        };
        this.updateListeners = [];
        this.refreshing = false;
    }

    /**
     * Initialiser le dashboard
     */
    async init() {
        this.bindEvents();
        this.initializeCharts();
        this.setupRealtimeListeners();
        await this.loadInitialData();
        this.startPeriodicUpdates();
    }

    /**
     * Événements du dashboard
     */
    bindEvents() {
        // Bouton refresh
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }

        // Bouton redémarrage système
        const restartBtn = document.getElementById('restartSystemBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.showRestartModal();
            });
        }

        // Responsive - adapter les graphiques
        window.addEventListener('resize', Utils.debounce(() => {
            this.resizeCharts();
        }, 300));
    }

    /**
     * Initialiser les graphiques
     */
    initializeCharts() {
        // Graphique d'equity
        const equityCanvas = document.getElementById('equityChart');
        if (equityCanvas) {
            this.charts.set('equity', new EquityChart(equityCanvas));
        }

        // Graphique de performance
        const performanceCanvas = document.getElementById('performanceChart');
        if (performanceCanvas) {
            this.charts.set('performance', new PerformanceChart(performanceCanvas));
        }
    }

    /**
     * Configurer les listeners temps réel
     */
    setupRealtimeListeners() {
        // État du compte
        window.addEventListener('realtime:accountState', (event) => {
            this.updateAccountState(event.detail);
        });

        // Statut système
        window.addEventListener('realtime:systemStatus', (event) => {
            this.updateSystemStatus(event.detail);
        });

        // Métriques de risque
        window.addEventListener('realtime:riskMetrics', (event) => {
            this.updateRiskMetrics(event.detail);
        });

        // Nouveaux ordres
        window.addEventListener('realtime:newOrder', (event) => {
            this.handleNewOrder(event.detail);
        });

        // Changements de position
        window.addEventListener('realtime:positionChange', (event) => {
            this.updatePositionCount(event.detail);
        });

        // Changements de balance
        window.addEventListener('realtime:balanceChange', (event) => {
            this.animateBalanceChange(event.detail);
        });

        // Changements d'equity
        window.addEventListener('realtime:equityChange', (event) => {
            this.animateEquityChange(event.detail);
        });
    }

    /**
     * Charger les données initiales
     */
    async loadInitialData() {
        try {
            this.setLoadingState(true);

            // Charger toutes les données en parallèle
            const [
                accountState,
                systemStatus,
                riskMetrics,
                recentOrders,
                recentSignals,
                metrics
            ] = await Promise.all([
                window.apiClient.getAccountState(),
                window.apiClient.getSystemStatus(),
                window.apiClient.getRiskMetrics(),
                window.apiClient.getOrders({ limit: 10 }),
                window.apiClient.getSignals({ limit: 10 }),
                window.apiClient.getAccountMetrics('7d')
            ]);

            // Traiter les résultats
            if (accountState.success) {
                this.currentData.accountState = accountState.data;
                this.updateAccountState(accountState.data);
            }

            if (systemStatus.success) {
                this.currentData.systemStatus = systemStatus.data;
                this.updateSystemStatus(systemStatus.data);
            }

            if (riskMetrics.success) {
                this.currentData.riskMetrics = riskMetrics.data;
                this.updateRiskMetrics(riskMetrics.data);
            }

            if (recentOrders.success) {
                this.currentData.orders = recentOrders.data;
                this.updateRecentOrders(recentOrders.data);
            }

            if (recentSignals.success) {
                this.currentData.signals = recentSignals.data;
                this.updateRecentSignals(recentSignals.data);
            }

            if (metrics.success) {
                this.currentData.metrics = metrics.data;
                this.updateTradingStats(metrics.data);
            }

            // Mettre à jour les graphiques
            this.updateCharts();

            // Vérifier les alertes système
            this.checkSystemAlerts();

        } catch (error) {
            console.error('Erreur chargement données:', error);
            this.showErrorState('Erreur lors du chargement des données');
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * Mettre à jour l'état du compte
     */
    updateAccountState(data) {
        if (!data.current) return;

        const { balance, equity, margin, freeMargin, marginLevel } = data.current;

        // Balance
        const balanceElement = document.getElementById('balanceValue');
        if (balanceElement) {
            balanceElement.textContent = Utils.formatCurrency(balance);
        }

        // Equity
        const equityElement = document.getElementById('equityValue');
        if (equityElement) {
            equityElement.textContent = Utils.formatCurrency(equity);
        }

        // Calculer les changements
        this.updateStatChange('balance', balance, data.lastUpdate);
        this.updateStatChange('equity', equity, data.lastUpdate);

        // Niveau de marge
        const marginLevelElement = document.getElementById('marginLevel');
        if (marginLevelElement) {
            marginLevelElement.textContent = marginLevel ? 
                Utils.formatPercentage(marginLevel / 100) : '--';
        }

        // Mettre à jour la barre de progression de marge
        this.updateMarginProgress(marginLevel);
    }

    /**
     * Mettre à jour le statut système
     */
    updateSystemStatus(data) {
        // Indicateurs de santé
        this.updateHealthIndicator('mt4', data.mt4Connected);
        this.updateHealthIndicator('signal', data.signalProcessor.running);
        this.updateHealthIndicator('db', true); // Toujours true si on reçoit des données
        this.updateHealthIndicator('risk', true);

        // Statut détaillé
        document.getElementById('mt4Status').textContent = 
            data.mt4Connected ? 'Connecté' : 'Déconnecté';
        
        document.getElementById('signalStatus').textContent = 
            data.signalProcessor.running ? 'Actif' : 'Arrêté';
        
        document.getElementById('dbStatus').textContent = 'Opérationnel';
        document.getElementById('riskStatus').textContent = 'Opérationnel';

        // Positions ouvertes
        const positionsElement = document.getElementById('positionsValue');
        if (positionsElement) {
            positionsElement.textContent = data.positions.open;
        }

        // Signaux en attente
        if (window.NavigationComponent) {
            const nav = window.NavigationComponent;
            if (nav.updateMenuBadge) {
                nav.updateMenuBadge('signals', data.signalProcessor.pendingSignals);
            }
        }
    }

    /**
     * Mettre à jour les métriques de risque
     */
    updateRiskMetrics(data) {
        if (!data.current) return;

        const { totalExposure, totalRisk, dailyPnL } = data.current;

        // Exposition totale
        const exposureElement = document.getElementById('totalExposure');
        if (exposureElement) {
            exposureElement.textContent = Utils.formatNumber(totalExposure, 2) + ' lots';
        }

        // Risque total
        const riskElement = document.getElementById('totalRisk');
        if (riskElement) {
            riskElement.textContent = Utils.formatCurrency(totalRisk);
        }

        // P&L journalier
        const pnlElement = document.getElementById('pnlValue');
        if (pnlElement) {
            const formatted = Utils.formatProfitLoss(dailyPnL);
            pnlElement.textContent = formatted.text;
            pnlElement.className = `stat-value ${formatted.color}`;
        }

        // Barres de progression
        this.updateRiskProgress(totalExposure, totalRisk);
    }

    /**
     * Mettre à jour les ordres récents
     */
    updateRecentOrders(data) {
        const tableBody = document.getElementById('recentOrdersTable');
        if (!tableBody) return;

        if (!data.data || data.data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Aucun ordre récent</td></tr>';
            return;
        }

        tableBody.innerHTML = data.data.slice(0, 5).map(order => {
            const statusClass = this.getOrderStatusClass(order.status);
            const timeFormatted = Utils.formatRelativeTime(order.openTime || order.createdAt);
            
            return `
                <tr>
                    <td><strong>${order.symbol}</strong></td>
                    <td><span class="badge badge-${order.type.toLowerCase().includes('buy') ? 'success' : 'danger'}">${order.type}</span></td>
                    <td>${Utils.formatNumber(order.lots, 2)}</td>
                    <td>${order.openPrice ? Utils.formatNumber(order.openPrice, 5) : '--'}</td>
                    <td><span class="badge badge-${statusClass}">${order.status}</span></td>
                    <td><small>${timeFormatted}</small></td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Mettre à jour les signaux récents
     */
    updateRecentSignals(data) {
        const tableBody = document.getElementById('recentSignalsTable');
        if (!tableBody) return;

        if (!data.data || data.data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aucun signal récent</td></tr>';
            return;
        }

        tableBody.innerHTML = data.data.slice(0, 5).map(signal => {
            const statusClass = this.getSignalStatusClass(signal.status);
            const timeFormatted = Utils.formatRelativeTime(signal.createdAt);
            
            return `
                <tr>
                    <td><strong>${signal.symbol}</strong></td>
                    <td><span class="badge badge-${signal.action === 'buy' ? 'success' : 'danger'}">${signal.action.toUpperCase()}</span></td>
                    <td>${signal.strategy ? signal.strategy.name : '--'}</td>
                    <td><span class="badge badge-${statusClass}">${signal.status}</span></td>
                    <td><small>${timeFormatted}</small></td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Mettre à jour les statistiques de trading
     */
    updateTradingStats(data) {
        // Trades totaux
        const totalTrades = data.profitLoss.trades || 0;
        document.getElementById('totalTrades').textContent = totalTrades;

        // Win rate
        const winRate = data.profitLoss.winRate || 0;
        document.getElementById('winRate').textContent = winRate + '%';

        // Profit factor (approximation)
        const profitFactor = totalTrades > 0 ? Math.abs(data.profitLoss.total / Math.max(totalTrades, 1)) : 0;
        document.getElementById('profitFactor').textContent = Utils.formatNumber(profitFactor, 2);

        // Max drawdown (approximation basée sur le risque actuel)
        const maxDrawdown = data.currentRisk.totalRisk / 100; // Approximation
        document.getElementById('maxDrawdown').textContent = Utils.formatPercentage(maxDrawdown);
    }

    /**
     * Mettre à jour les graphiques
     */
    updateCharts() {
        // Graphique d'equity
        if (this.charts.has('equity') && this.currentData.riskMetrics) {
            const equityChart = this.charts.get('equity');
            equityChart.updateData(this.currentData.riskMetrics.history || []);
        }

        // Graphique de performance
        if (this.charts.has('performance') && this.currentData.metrics) {
            const performanceChart = this.charts.get('performance');
            performanceChart.updateData(this.currentData.metrics);
        }
    }

    /**
     * Mettre à jour un indicateur de santé
     */
    updateHealthIndicator(type, isHealthy) {
        const indicator = document.getElementById(`${type}Indicator`);
        if (indicator) {
            indicator.className = `health-indicator ${isHealthy ? 'online' : 'offline'}`;
            if (isHealthy) {
                indicator.classList.add('pulse');
            }
        }
    }

    /**
     * Mettre à jour la barre de progression de marge
     */
    updateMarginProgress(marginLevel) {
        const progressBar = document.getElementById('marginProgress');
        if (!progressBar) return;

        let percentage = 0;
        let className = 'progress-bar';

        if (marginLevel > 0) {
            // Convertir le niveau de marge en pourcentage (inverse)
            percentage = Math.min((10000 / marginLevel) * 100, 100);
            
            if (marginLevel < 200) {
                className += ' danger';
            } else if (marginLevel < 500) {
                className += ' warning';
            }
        }

        progressBar.style.width = percentage + '%';
        progressBar.className = className;
    }

    /**
     * Mettre à jour les barres de progression de risque
     */
    updateRiskProgress(totalExposure, totalRisk) {
        // Exposition (max 5 lots par défaut)
        const exposureProgress = document.getElementById('exposureProgress');
        if (exposureProgress) {
            const maxExposure = 5; // Configurable
            const percentage = Math.min((totalExposure / maxExposure) * 100, 100);
            exposureProgress.style.width = percentage + '%';
            exposureProgress.className = `progress-bar ${percentage > 80 ? 'danger' : percentage > 60 ? 'warning' : ''}`;
        }

        // Risque (max 5% du capital par défaut)
        const riskProgress = document.getElementById('riskProgress');
        if (riskProgress && this.currentData.accountState) {
            const maxRisk = this.currentData.accountState.current.balance * 0.05;
            const percentage = Math.min((totalRisk / maxRisk) * 100, 100);
            riskProgress.style.width = percentage + '%';
            riskProgress.className = `progress-bar ${percentage > 80 ? 'danger' : percentage > 60 ? 'warning' : ''}`;
        }
    }

    /**
     * Mettre à jour le changement d'une statistique
     */
    updateStatChange(statType, newValue, lastUpdate) {
        const changeElement = document.getElementById(`${statType}Change`);
        const changeIconElement = document.getElementById(`${statType}ChangeIcon`);
        const changeValueElement = document.getElementById(`${statType}ChangeValue`);

        if (!changeElement || !changeIconElement || !changeValueElement) return;

        // Calculer le changement (simulation pour l'exemple)
        const oldValue = this.getPreviousValue(statType);
        const change = newValue - oldValue;
        const changePercent = oldValue > 0 ? (change / oldValue) * 100 : 0;

        let className = 'stat-change ';
        let icon = '';

        if (change > 0) {
            className += 'positive';
            icon = '↗';
        } else if (change < 0) {
            className += 'negative';
            icon = '↘';
        } else {
            className += 'neutral';
            icon = '→';
        }

        changeElement.className = className;
        changeIconElement.textContent = icon;
        changeValueElement.textContent = Utils.formatPercentage(Math.abs(changePercent));

        // Sauvegarder la nouvelle valeur
        this.setPreviousValue(statType, newValue);
    }

    /**
     * Animer le changement de balance
     */
    animateBalanceChange(data) {
        const balanceElement = document.getElementById('balanceValue');
        if (balanceElement) {
            balanceElement.classList.add('updated');
            setTimeout(() => {
                balanceElement.classList.remove('updated');
            }, 600);
        }
    }

    /**
     * Animer le changement d'equity
     */
    animateEquityChange(data) {
        const equityElement = document.getElementById('equityValue');
        if (equityElement) {
            equityElement.classList.add('updated');
            setTimeout(() => {
                equityElement.classList.remove('updated');
            }, 600);
        }
    }

    /**
     * Gérer un nouvel ordre
     */
    handleNewOrder(order) {
        // Recharger les ordres récents
        this.loadRecentOrders();
        
        // Notification déjà gérée par le RealtimeManager
    }

    /**
     * Mettre à jour le nombre de positions
     */
    updatePositionCount(data) {
        const positionsElement = document.getElementById('positionsValue');
        if (positionsElement) {
            positionsElement.textContent = data.new;
            positionsElement.classList.add('updated');
            setTimeout(() => {
                positionsElement.classList.remove('updated');
            }, 600);
        }
    }

    /**
     * Obtenir la classe CSS pour un statut d'ordre
     */
    getOrderStatusClass(status) {
        const statusMap = {
            'PENDING': 'warning',
            'PLACED': 'info',
            'FILLED': 'success',
            'CLOSED': 'secondary',
            'CANCELLED': 'danger',
            'ERROR': 'danger'
        };
        return statusMap[status] || 'secondary';
    }

    /**
     * Obtenir la classe CSS pour un statut de signal
     */
    getSignalStatusClass(status) {
        const statusMap = {
            'PENDING': 'warning',
            'VALIDATED': 'info',
            'PROCESSED': 'success',
            'REJECTED': 'danger',
            'ERROR': 'danger'
        };
        return statusMap[status] || 'secondary';
    }

    /**
     * Vérifier les alertes système
     */
    checkSystemAlerts() {
        const alertContainer = document.getElementById('systemAlert');
        const alertMessage = document.getElementById('systemAlertMessage');
        
        if (!alertContainer || !alertMessage) return;

        let hasAlert = false;
        let message = '';

        // Vérifier MT4
        if (this.currentData.systemStatus && !this.currentData.systemStatus.mt4Connected) {
            hasAlert = true;
            message = 'MT4 n\'est pas connecté. Les ordres ne peuvent pas être traités.';
        }

        // Vérifier le niveau de marge
        if (this.currentData.accountState && this.currentData.accountState.current.marginLevel < 200) {
            hasAlert = true;
            message = 'Niveau de marge critique. Risque de margin call.';
        }

        // Afficher ou masquer l'alerte
        if (hasAlert) {
            alertMessage.textContent = message;
            alertContainer.style.display = 'block';
        } else {
            alertContainer.style.display = 'none';
        }
    }

    /**
     * Afficher la modale de redémarrage
     */
    showRestartModal() {
        window.ModalManager.confirm(
            'Redémarrer le système',
            'Êtes-vous sûr de vouloir redémarrer tous les composants du système ? Cette action peut interrompre les ordres en cours.',
            async () => {
                await this.restartSystem();
                return true;
            }
        );
    }

    /**
     * Redémarrer le système
     */
    async restartSystem() {
        try {
            window.ModalManager.loading('Redémarrage', 'Redémarrage des composants en cours...');
            
            const result = await window.apiClient.restartSystem();
            
            if (result.success) {
                window.NotificationManager.success(
                    'Système redémarré',
                    'Tous les composants ont été redémarrés avec succès'
                );
                
                // Recharger les données après un délai
                setTimeout(() => {
                    this.loadInitialData();
                }, 3000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            window.NotificationManager.error(
                'Erreur de redémarrage',
                error.message || 'Impossible de redémarrer le système'
            );
        } finally {
            window.ModalManager.closeLoading();
        }
    }

    /**
     * Actualiser les données
     */
    async refreshData() {
        if (this.refreshing) return;
        
        this.refreshing = true;
        const refreshBtn = document.getElementById('refreshBtn');
        
        if (refreshBtn) {
            refreshBtn.classList.add('refreshing');
            refreshBtn.disabled = true;
        }

        try {
            await this.loadInitialData();
            
            window.NotificationManager.success(
                'Données actualisées',
                'Toutes les données ont été mises à jour'
            );
        } catch (error) {
            window.NotificationManager.error(
                'Erreur d\'actualisation',
                error.message || 'Impossible d\'actualiser les données'
            );
        } finally {
            this.refreshing = false;
            
            if (refreshBtn) {
                refreshBtn.classList.remove('refreshing');
                refreshBtn.disabled = false;
            }
        }
    }

    /**
     * Charger les ordres récents
     */
    async loadRecentOrders() {
        try {
            const result = await window.apiClient.getOrders({ limit: 10 });
            if (result.success) {
                this.currentData.orders = result.data;
                this.updateRecentOrders(result.data);
            }
        } catch (error) {
            console.error('Erreur chargement ordres:', error);
        }
    }

    /**
     * Définir l'état de chargement
     */
    setLoadingState(loading) {
        // Afficher des placeholders de chargement
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(element => {
            if (loading) {
                element.classList.add('loading-placeholder');
            } else {
                element.classList.remove('loading-placeholder');
            }
        });
    }

    /**
     * Afficher un état d'erreur
     */
    showErrorState(message) {
        const alertContainer = document.getElementById('systemAlert');
        const alertMessage = document.getElementById('systemAlertMessage');
        
        if (alertContainer && alertMessage) {
            alertMessage.textContent = message;
            alertContainer.style.display = 'block';
            alertContainer.className = 'alert-container';
            alertContainer.firstElementChild.className = 'alert alert-error';
        }
    }

    /**
     * Redimensionner les graphiques
     */
    resizeCharts() {
        this.charts.forEach(chart => {
            if (chart.resize) {
                chart.resize();
            }
        });
    }

    /**
     * Démarrer les mises à jour périodiques
     */
    startPeriodicUpdates() {
        // Mettre à jour les logs d'activité toutes les 30 secondes
        setInterval(() => {
            this.updateActivityLog();
        }, 30000);
    }

    /**
     * Mettre à jour le journal d'activité
     */
    async updateActivityLog() {
        try {
            const result = await window.apiClient.getLogs({ limit: 5 });
            if (result.success) {
                this.renderActivityLog(result.data);
            }
        } catch (error) {
            console.error('Erreur mise à jour logs:', error);
        }
    }

    /**
     * Afficher le journal d'activité
     */
    renderActivityLog(data) {
        const logContainer = document.getElementById('activityLog');
        if (!logContainer) return;

        if (!data.data || data.data.length === 0) {
            logContainer.innerHTML = '<div class="log-item"><div class="log-message">Aucune activité récente</div></div>';
            return;
        }

        logContainer.innerHTML = data.data.map(log => {
            const timeFormatted = Utils.formatRelativeTime(log.createdAt);
            return `
                <div class="log-item">
                    <div class="log-time">${timeFormatted}</div>
                    <div class="log-message">${log.action}</div>
                    <div class="log-severity ${log.severity.toLowerCase()}">${log.severity}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Obtenir la valeur précédente d'une stat
     */
    getPreviousValue(statType) {
        const stored = Utils.loadFromStorage(`dashboard_${statType}`, 0);
        return stored || 0;
    }

    /**
     * Sauvegarder la valeur précédente d'une stat
     */
    setPreviousValue(statType, value) {
        Utils.saveToStorage(`dashboard_${statType}`, value);
    }

    /**
     * Destruction du gestionnaire
     */
    destroy() {
        // Nettoyer les graphiques
        this.charts.forEach(chart => {
            if (chart.destroy) {
                chart.destroy();
            }
        });
        this.charts.clear();

        // Nettoyer les listeners
        this.updateListeners.forEach(listener => {
            if (typeof listener === 'function') {
                listener();
            }
        });
        this.updateListeners = [];
    }
}

// Export global
window.DashboardManager = DashboardManager;