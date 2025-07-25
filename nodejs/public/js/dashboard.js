// js/dashboard.js

/**
 * Gestionnaire principal du Dashboard
 */
class Dashboard {
    constructor() {
        this.isInitialized = false;
        this.performanceChart = null;
        this.updateInterval = null;
        this.refreshInterval = 5000; // 5 secondes
        
        this.data = {
            account: null,
            metrics: null,
            positions: [],
            signals: [],
            systemStatus: null
        };
    }

    /**
     * Initialise le dashboard
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Attacher les gestionnaires d'événements
            this.attachEventListeners();
            
            // Charger les données initiales
            await this.loadAllData();
            
            // Démarrer les mises à jour automatiques
            this.startAutoRefresh();
            
            this.isInitialized = true;
            console.log('Dashboard initialized');
            
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            window.notifications.error('Erreur', 'Impossible d\'initialiser le dashboard');
        }
    }

    /**
     * Attache les gestionnaires d'événements
     */
    attachEventListeners() {
        // Boutons d'action
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refresh());
        document.getElementById('closeAllBtn')?.addEventListener('click', () => this.closeAllPositions());
        document.getElementById('systemRestartBtn')?.addEventListener('click', () => this.restartSystem());
        document.getElementById('refreshPositions')?.addEventListener('click', () => this.loadPositions());
        
        // Sélecteurs de période
        document.getElementById('performancePeriod')?.addEventListener('change', (e) => {
            this.loadAccountMetrics(e.target.value);
        });
        
        document.getElementById('statsPeriod')?.addEventListener('change', (e) => {
            this.loadTradingStats(e.target.value);
        });

        // Toggle thème
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    }

    /**
     * Charge toutes les données du dashboard
     */
    async loadAllData() {
        const loadPromises = [
            this.loadAccountState(),
            this.loadAccountMetrics(),
            this.loadSystemStatus(),
            this.loadPositions(),
            this.loadRecentSignals(),
            this.loadTradingStats()
        ];

        const results = await Promise.allSettled(loadPromises);
        
        // Logger les erreurs sans bloquer
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.warn(`Dashboard data loading failed for promise ${index}:`, result.reason);
            }
        });
    }

    /**
     * Charge l'état du compte
     */
    async loadAccountState() {
        try {
            const data = await window.api.getAccountState();
            this.data.account = data;
            this.updateAccountDisplay(data);
        } catch (error) {
            console.error('Error loading account state:', error);
            this.showAccountError();
        }
    }

    /**
     * Charge les métriques de performance
     */
    async loadAccountMetrics(period = '7d') {
        try {
            const data = await window.api.getAccountMetrics(period);
            this.data.metrics = data;
            this.updatePerformanceChart(data);
        } catch (error) {
            console.error('Error loading account metrics:', error);
        }
    }

    /**
     * Charge le statut système
     */
    async loadSystemStatus() {
        try {
            const data = await window.api.getSystemStatus();
            this.data.systemStatus = data;
            this.updateSystemStatus(data);
        } catch (error) {
            console.error('Error loading system status:', error);
            this.showSystemError();
        }
    }

    /**
     * Charge les positions ouvertes
     */
    async loadPositions() {
        try {
            const response = await window.api.getOrders({ status: ['PLACED', 'FILLED'], limit: 10 });
            this.data.positions = response.data || [];
            this.updatePositionsDisplay(this.data.positions);
        } catch (error) {
            console.error('Error loading positions:', error);
            this.showPositionsError();
        }
    }

    /**
     * Charge les signaux récents
     */
    async loadRecentSignals() {
        try {
            const response = await window.api.getSignals({ limit: 5 });
            this.data.signals = response.data || [];
            this.updateSignalsDisplay(this.data.signals);
        } catch (error) {
            console.error('Error loading recent signals:', error);
            this.showSignalsError();
        }
    }

    /**
     * Charge les statistiques de trading
     */
    async loadTradingStats(period = '7d') {
        try {
            const data = await window.api.getAccountMetrics(period);
            this.updateTradingStats(data);
        } catch (error) {
            console.error('Error loading trading stats:', error);
        }
    }

    /**
     * Met à jour l'affichage du compte
     */
    updateAccountDisplay(data) {
        const { current, isRealTime } = data;
        if (!current) return;

        // Mise à jour des métriques
        this.updateElement('balance', window.api.formatCurrency(current.balance));
        this.updateElement('equity', window.api.formatCurrency(current.equity));
        this.updateElement('margin', window.api.formatCurrency(current.margin));
        this.updateElement('freeMargin', window.api.formatCurrency(current.freeMargin));

        // Calcul du niveau de marge
        const marginLevel = current.marginLevel || (current.equity / current.margin * 100);
        this.updateElement('marginLevel', `${marginLevel.toFixed(1)}%`);

        // Statut de la connexion compte
        const statusElement = document.getElementById('accountStatus');
        if (statusElement) {
            statusElement.className = `card-status ${isRealTime ? 'online' : 'warning'}`;
        }

        // Calcul des changements (simulé pour l'exemple)
        const balanceChange = current.equity - current.balance;
        this.updateChangeDisplay('balanceChange', balanceChange);
        this.updateChangeDisplay('equityChange', balanceChange);
    }

    /**
     * Met à jour le graphique de performance
     */
    updatePerformanceChart(data) {
        // Cette fonction sera implémentée avec Chart.js
        console.log('Performance chart data:', data);
        
        if (!window.Chart) {
            console.warn('Chart.js not loaded');
            return;
        }

        // TODO: Implémenter le graphique avec les données réelles
        // Pour l'instant, on met un placeholder
        const chartCanvas = document.getElementById('performanceChart');
        if (chartCanvas && !this.performanceChart) {
            this.createPerformanceChart(chartCanvas, data);
        }
    }

    /**
     * Crée le graphique de performance
     */
    createPerformanceChart(canvas, data) {
        const ctx = canvas.getContext('2d');
        
        // Données d'exemple - à remplacer par les vraies données
        const chartData = {
            labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
            datasets: [{
                label: 'Equity',
                data: [10000, 10050, 10100, 10080, 10120, 10200, 10250],
                borderColor: '#58a6ff',
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };

        this.performanceChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8b949e',
                            callback: function(value) {
                                return window.api.formatCurrency(value);
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8b949e'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(22, 27, 34, 0.9)',
                        titleColor: '#f0f6fc',
                        bodyColor: '#f0f6fc',
                        borderColor: '#30363d',
                        borderWidth: 1
                    }
                },
                elements: {
                    point: {
                        radius: 0,
                        hoverRadius: 6
                    }
                }
            }
        });
    }

    /**
     * Met à jour le statut système avec Vanilla Framework
     */
    updateSystemStatus(data) {
        // Statut MT4
        const mt4StatusText = document.getElementById('mt4StatusText');
        if (mt4StatusText) {
            mt4StatusText.textContent = data.mt4Connected ? 'Connected' : 'Disconnected';
            mt4StatusText.style.color = data.mt4Connected ? '#0e8420' : '#c7162b';
        }

        // Statut processeur de signaux
        const processorStatusText = document.getElementById('processorStatusText');
        if (processorStatusText) {
            processorStatusText.textContent = data.signalProcessor.running ? 'Running' : 'Stopped';
            processorStatusText.style.color = data.signalProcessor.running ? '#0e8420' : '#c7162b';
        }

        // Positions ouvertes
        this.updateElement('openPositions', data.positions.open);
        
        // Signaux en attente
        this.updateElement('pendingSignals', data.signalProcessor.pendingSignals);
        
        // Dernière mise à jour
        const lastUpdate = data.lastActivity.order || data.lastActivity.signal;
        this.updateElement('lastUpdate', window.api.formatRelativeTime(lastUpdate));

        // Indicateur principal
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            const isHealthy = data.mt4Connected && data.signalProcessor.running;
            statusIndicator.className = `status-indicator ${isHealthy ? 'connected' : 'disconnected'}`;
        }
    }

    /**
     * Met à jour l'affichage des positions avec Vanilla Framework
     */
    updatePositionsDisplay(positions) {
        const container = document.getElementById('positionsList');
        if (!container) return;

        if (positions.length === 0) {
            container.innerHTML = `
                <div class="p-text--muted u-align--center">
                    <p>Aucune position ouverte</p>
                </div>
            `;
            return;
        }

        const html = positions.map(position => {
            const pnl = position.profit || 0;
            const pnlColor = pnl >= 0 ? '#0e8420' : '#c7162b';
            
            return `
                <div class="p-card is-compact" style="margin-bottom: 0.5rem;">
                    <div class="p-card__content">
                        <div class="row">
                            <div class="col-8">
                                <h6 class="p-heading--6">${position.symbol}</h6>
                                <p class="p-text--small">
                                    <span class="p-label--${position.type.includes('BUY') ? 'positive' : 'negative'}">${position.type}</span>
                                    ${position.lots} lots @ ${position.openPrice}
                                </p>
                            </div>
                            <div class="col-4 u-align--right">
                                <p class="p-heading--6" style="color: ${pnlColor}">
                                    ${window.api.formatCurrency(pnl)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Met à jour l'affichage des signaux avec Vanilla Framework
     */
    updateSignalsDisplay(signals) {
        const container = document.getElementById('signalsList');
        if (!container) return;

        if (signals.length === 0) {
            container.innerHTML = `
                <div class="p-text--muted u-align--center">
                    <p>Aucun signal récent</p>
                </div>
            `;
            return;
        }

        const html = signals.map(signal => {
            return `
                <div class="p-card is-compact" style="margin-bottom: 0.5rem;">
                    <div class="p-card__content">
                        <div class="row">
                            <div class="col-8">
                                <div class="u-sv1">
                                    <span class="p-heading--6">${signal.symbol}</span>
                                    <span class="p-label--${signal.action === 'buy' ? 'positive' : 'negative'}">${signal.action.toUpperCase()}</span>
                                </div>
                                <p class="p-text--small">
                                    ${signal.strategy?.name || 'Unknown'} • 
                                    ${signal.price ? window.api.formatCurrency(signal.price) : 'Market'}
                                </p>
                                <p class="p-text--small u-text--muted">${window.api.formatRelativeTime(signal.createdAt)}</p>
                            </div>
                            <div class="col-4 u-align--right">
                                <span class="p-label--information">${signal.status}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Met à jour les statistiques de trading
     */
    updateTradingStats(data) {
        if (!data.profitLoss || !data.orderStats) return;

        // Total des trades
        const totalTrades = data.profitLoss.trades || 0;
        this.updateElement('totalTrades', totalTrades);

        // Win rate
        this.updateElement('winRate', `${data.profitLoss.winRate}%`);

        // P&L total
        const totalPnL = data.profitLoss.total || 0;
        this.updateElement('totalPnL', window.api.formatCurrency(totalPnL));
        
        // Profit moyen
        const avgProfit = totalTrades > 0 ? (totalPnL / totalTrades) : 0;
        this.updateElement('avgProfit', window.api.formatCurrency(avgProfit));

        // Couleurs selon performance
        const pnlElement = document.getElementById('totalPnL');
        if (pnlElement) {
            pnlElement.className = `stat-value ${window.api.getValueColor(totalPnL)}`;
        }
    }

    /**
     * Met à jour les métriques de risque avec Vanilla Framework
     */
    updateRiskMetrics() {
        // Exposition totale
        const totalExposure = this.data.positions.reduce((sum, pos) => sum + pos.lots, 0);
        this.updateElement('totalExposure', totalExposure.toFixed(2));
        this.updateProgressBar('exposureProgress', totalExposure, 5.0); // Max 5 lots

        // Risque journalier
        const dailyRisk = Math.abs(this.data.positions.reduce((sum, pos) => sum + (pos.riskAmount || 0), 0));
        this.updateElement('dailyRisk', window.api.formatCurrency(dailyRisk));
        this.updateProgressBar('dailyRiskProgress', dailyRisk, 500); // Max $500

        // P&L journalier
        const dailyPnL = this.data.positions.reduce((sum, pos) => sum + (pos.profit || 0), 0);
        this.updateElement('dailyPnL', window.api.formatCurrency(dailyPnL));
        this.updateProgressBar('dailyPnLProgress', Math.abs(dailyPnL), 1000, dailyPnL >= 0); // Max $1000

        // Niveau de risque global
        const riskLevel = window.api.getRiskLevel(dailyRisk, 500);
        const riskBadge = document.getElementById('riskLevel');
        if (riskBadge) {
            riskBadge.textContent = riskLevel.toUpperCase();
            // Utiliser les classes Vanilla Framework pour les labels
            const labelClass = riskLevel === 'low' ? 'positive' : (riskLevel === 'medium' ? 'caution' : 'negative');
            riskBadge.className = `p-label--${labelClass}`;
        }
    }

    /**
     * Met à jour une barre de progression
     */
    updateProgressBar(elementId, value, maxValue, isPositive = null) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const percentage = Math.min((Math.abs(value) / maxValue) * 100, 100);
        element.style.width = `${percentage}%`;

        // Couleur selon le niveau
        let colorClass = 'low';
        if (percentage > 70) colorClass = 'high';
        else if (percentage > 30) colorClass = 'medium';
        
        // Override si on spécifie positive/negative
        if (isPositive === true) colorClass = 'low';
        else if (isPositive === false) colorClass = 'high';

        element.className = `risk-progress ${colorClass}`;
    }

    /**
     * Met à jour un élément du DOM
     */
    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Met à jour l'affichage d'un changement (positif/négatif)
     */
    updateChangeDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const formattedValue = window.api.formatCurrency(Math.abs(value));
        const sign = value >= 0 ? '+' : '-';
        const colorClass = window.api.getValueColor(value);

        element.textContent = `${sign}${formattedValue}`;
        element.className = `metric-change ${colorClass}`;
    }

    /**
     * Actions utilisateur
     */
    async refresh() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('pulse');
            setTimeout(() => refreshBtn.classList.remove('pulse'), 1000);
        }

        try {
            await this.loadAllData();
            window.notifications.success('Actualisation', 'Données mises à jour');
        } catch (error) {
            window.notifications.error('Erreur', 'Impossible de rafraîchir les données');
        }
    }

    async closeAllPositions() {
        if (!confirm('Êtes-vous sûr de vouloir fermer toutes les positions ?')) return;

        try {
            const result = await window.api.closeAllOrders();
            
            if (result.closedCount > 0) {
                window.notifications.success(
                    'Positions Fermées', 
                    `${result.closedCount} positions fermées sur ${result.totalCount}`
                );
                
                // Recharger les positions
                await this.loadPositions();
            } else {
                window.notifications.info('Info', 'Aucune position à fermer');
            }
        } catch (error) {
            window.notifications.error('Erreur', 'Impossible de fermer les positions');
        }
    }

    async restartSystem() {
        if (!confirm('Redémarrer le système ? Cela peut interrompre le trading.')) return;

        try {
            await window.api.restartSystem();
            window.notifications.success('Système', 'Redémarrage en cours...');
            
            // Recharger le statut après quelques secondes
            setTimeout(() => this.loadSystemStatus(), 3000);
        } catch (error) {
            window.notifications.error('Erreur', 'Impossible de redémarrer le système');
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
        }
    }

    /**
     * Gestion des erreurs d'affichage avec Vanilla Framework
     */
    showAccountError() {
        const container = document.querySelector('.p-card .p-card__content');
        if (container) {
            container.innerHTML = `
                <div class="p-notification--negative">
                    <div class="p-notification__content">
                        <p class="p-notification__message">Impossible de charger les données du compte</p>
                    </div>
                </div>
            `;
        }
    }

    showSystemError() {
        // Marquer tous les statuts comme déconnectés avec couleurs Vanilla
        const mt4StatusText = document.getElementById('mt4StatusText');
        if (mt4StatusText) {
            mt4StatusText.textContent = 'Disconnected';
            mt4StatusText.style.color = '#c7162b';
        }

        const processorStatusText = document.getElementById('processorStatusText');
        if (processorStatusText) {
            processorStatusText.textContent = 'Stopped';
            processorStatusText.style.color = '#c7162b';
        }
    }

    showPositionsError() {
        const container = document.getElementById('positionsList');
        if (container) {
            container.innerHTML = `
                <div class="p-notification--negative">
                    <div class="p-notification__content">
                        <p class="p-notification__message">Erreur lors du chargement des positions</p>
                    </div>
                </div>
            `;
        }
    }

    showSignalsError() {
        const container = document.getElementById('signalsList');
        if (container) {
            container.innerHTML = `
                <div class="p-notification--negative">
                    <div class="p-notification__content">
                        <p class="p-notification__message">Erreur lors du chargement des signaux</p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Démarrage des mises à jour automatiques
     */
    startAutoRefresh() {
        // Données critiques toutes les 5 secondes
        window.pollingSystem.start('dashboard-critical', async () => {
            try {
                await Promise.all([
                    this.loadAccountState(),
                    this.loadSystemStatus(),
                    this.loadPositions()
                ]);
                this.updateRiskMetrics();
            } catch (error) {
                console.warn('Critical data refresh failed:', error);
            }
        }, this.refreshInterval);

        // Données moins critiques toutes les 30 secondes
        window.pollingSystem.start('dashboard-secondary', async () => {
            try {
                await Promise.all([
                    this.loadRecentSignals(),
                    this.loadTradingStats()
                ]);
            } catch (error) {
                console.warn('Secondary data refresh failed:', error);
            }
        }, 30000);
    }

    /**
     * Arrêt des mises à jour automatiques
     */
    stopAutoRefresh() {
        window.pollingSystem.stop('dashboard-critical');
        window.pollingSystem.stop('dashboard-secondary');
    }

    /**
     * Nettoyage lors de la fermeture
     */
    destroy() {
        this.stopAutoRefresh();
        
        if (this.performanceChart) {
            this.performanceChart.destroy();
            this.performanceChart = null;
        }
        
        this.isInitialized = false;
    }
}

/**
 * Instance globale du dashboard
 */
window.dashboard = new Dashboard();

/**
 * Auto-initialisation quand le DOM est prêt
 */
document.addEventListener('DOMContentLoaded', () => {
    // Restaurer le thème sauvegardé
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    }

    // Initialiser le dashboard
    window.dashboard.init().catch(error => {
        console.error('Dashboard initialization failed:', error);
    });
});

/**
 * Nettoyage avant fermeture de la page
 */
window.addEventListener('beforeunload', () => {
    window.dashboard.destroy();
});