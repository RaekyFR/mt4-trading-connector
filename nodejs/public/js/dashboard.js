// js/dashboard.js

/**
 * Gestionnaire principal du Dashboard - Version française épurée
 */
class Dashboard {
    constructor() {
        this.isInitialized = false;
        this.updateInterval = null;
        this.refreshInterval = 5000; // 5 secondes
        this.currentEditTicket = null;
        
        this.data = {
            account: null,
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
            console.log('Dashboard initialisé');
            
        } catch (error) {
            console.error('Erreur initialisation dashboard:', error);
            window.notifications.error('Erreur', 'Impossible d\'initialiser le tableau de bord');
        }
    }

    /**
     * Attache les gestionnaires d'événements
     */
    attachEventListeners() {
        // Boutons d'action
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refresh());
        document.getElementById('closeAllBtn')?.addEventListener('click', () => this.closeAllPositions());
        document.getElementById('closeAllPositionsBtn')?.addEventListener('click', () => this.closeAllPositions());
        document.getElementById('systemRestartBtn')?.addEventListener('click', () => this.restartSystem());
        document.getElementById('refreshPositions')?.addEventListener('click', () => this.loadPositions());

        // Gestionnaires modaux
        window.closeEditModal = () => this.closeEditModal();
        window.savePositionChanges = () => this.savePositionChanges();
        window.editPosition = (ticket) => this.editPosition(ticket);
        window.closePosition = (ticket) => this.closePosition(ticket);
    }

    /**
     * Charge toutes les données du dashboard
     */
    async loadAllData() {
        const loadPromises = [
            this.loadAccountState(),
            this.loadSystemStatus(),
            this.loadPositions(),
            this.loadRecentSignals()
        ];

        const results = await Promise.allSettled(loadPromises);
        
        // Logger les erreurs sans bloquer
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.warn(`Échec chargement données ${index}:`, result.reason);
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
            console.error('Erreur chargement compte:', error);
            this.showAccountError();
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
            console.error('Erreur statut système:', error);
            this.showSystemError();
        }
    }

    /**
     * Charge les positions ouvertes
     */
    async loadPositions() {
        try {
            const response = await window.api.getOrders({ 
                status: ['PLACED', 'FILLED'], 
                limit: 20 
            });
            this.data.positions = response.data || [];
            this.updatePositionsDisplay(this.data.positions);
        } catch (error) {
            console.error('Erreur chargement positions:', error);
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
            console.error('Erreur chargement signaux:', error);
            this.showSignalsError();
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
            statusElement.className = `status-indicator ${isRealTime ? 'connected' : 'warning'}`;
        }
    }

    /**
     * Met à jour le statut système
     */
    updateSystemStatus(data) {
        // Statut MT4
        const mt4StatusText = document.getElementById('mt4StatusText');
        if (mt4StatusText) {
            mt4StatusText.textContent = data.mt4Connected ? 'Connecté' : 'Déconnecté';
            mt4StatusText.style.color = data.mt4Connected ? '#0e8420' : '#c7162b';
        }

        // Positions ouvertes - utiliser le nombre réel de positions chargées
        const actualOpenPositions = this.data.positions ? this.data.positions.length : (data.positions ? data.positions.open : 0);
        this.updateElement('openPositions', actualOpenPositions);
        
        // Signaux en attente
        this.updateElement('pendingSignals', data.signalProcessor ? data.signalProcessor.pendingSignals : 0);
        
        // Dernière mise à jour
        const lastUpdate = data.lastActivity ? (data.lastActivity.order || data.lastActivity.signal) : null;
        this.updateElement('lastUpdate', lastUpdate ? window.api.formatRelativeTime(lastUpdate) : '--');

        // Indicateur principal
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            const isHealthy = data.mt4Connected && (data.signalProcessor ? data.signalProcessor.running : false);
            statusIndicator.className = `status-indicator ${isHealthy ? 'connected' : 'disconnected'}`;
        }
    }

    /**
     * Met à jour l'affichage des positions avec contrôles
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
            const pnlColor = pnl >= 0 ? 'positive' : 'negative';
            const typeClass = position.type.includes('BUY') ? '' : 'sell';
            
            return `
                <div class="p-card position-card ${typeClass}">
                    <div class="p-card__content">
                        <div class="row">
                            <div class="col-3">
                                <h6 class="p-heading--6">${position.symbol}</h6>
                                <span class="p-label--${position.type.includes('BUY') ? 'positive' : 'negative'}">
                                    ${position.type}
                                </span>
                            </div>
                            <div class="col-2">
                                <p class="metric-label">Lots</p>
                                <p class="p-text--default">${position.lots}</p>
                            </div>
                            <div class="col-2">
                                <p class="metric-label">Prix</p>
                                <p class="p-text--default">${position.openPrice || 'Market'}</p>
                            </div>
                            <div class="col-2">
                                <p class="metric-label">P&L</p>
                                <p class="p-heading--6 position-pnl ${pnlColor}">
                                    ${window.api.formatCurrency(pnl)}
                                </p>
                            </div>
                            <div class="col-3 u-align--right">
                                <div class="action-buttons" style="display: flex;">
                                    <button class="p-button--base is-dense" onclick="editPosition(${position.ticket})" title="Modifier SL/TP">
                                        Modifier
                                    </button>
                                    <button class="p-button--negative is-dense" onclick="closePosition(${position.ticket})" title="Fermer position">
                                        Fermer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Met à jour l'affichage des signaux
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
            const statusLabels = {
                'PENDING': 'En attente',
                'VALIDATED': 'Validé',
                'PROCESSED': 'Traité',
                'REJECTED': 'Rejeté'
            };

            return `
                <div class="p-card is-compact" style="margin-bottom: 0.5rem;">
                    <div class="p-card__content">
                        <div class="row">
                            <div class="col-3">
                                <h6 class="p-heading--6">${signal.symbol}</h6>
                                <span class="p-label--${signal.action === 'buy' ? 'positive' : 'negative'}">
                                    ${signal.action.toUpperCase()}
                                </span>
                            </div>
                            <div class="col-3">
                                <p class="metric-label">Stratégie</p>
                                <p class="p-text--small">${signal.strategy?.name || 'Inconnue'}</p>
                            </div>
                            <div class="col-3">
                                <p class="metric-label">Prix</p>
                                <p class="p-text--small">${signal.price ? window.api.formatCurrency(signal.price) : 'Marché'}</p>
                            </div>
                            <div class="col-3 u-align--right">
                                <span class="p-label--information">${statusLabels[signal.status] || signal.status}</span>
                                <p class="p-text--small u-text--muted">${window.api.formatRelativeTime(signal.createdAt)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    /**
     * Ouvre le modal d'édition de position
     */
    editPosition(ticket) {
        const position = this.data.positions.find(p => p.ticket == ticket);
        if (!position) {
            window.notifications.error('Erreur', 'Position non trouvée');
            return;
        }

        this.currentEditTicket = ticket;
        
        // Remplir le modal avec placeholders si valeurs existantes
        document.getElementById('editSymbol').value = position.symbol;
        
        const slInput = document.getElementById('editStopLoss');
        const tpInput = document.getElementById('editTakeProfit');
        
        if (position.stopLoss) {
            slInput.value = position.stopLoss;
            slInput.placeholder = `Actuel: ${position.stopLoss}`;
        } else {
            slInput.value = '';
            slInput.placeholder = 'Aucun SL défini';
        }
        
        if (position.takeProfit) {
            tpInput.value = position.takeProfit;
            tpInput.placeholder = `Actuel: ${position.takeProfit}`;
        } else {
            tpInput.value = '';
            tpInput.placeholder = 'Aucun TP défini';
        }
        
        // Afficher le modal
        document.getElementById('editPositionModal').style.display = 'block';
    }

    /**
     * Ferme le modal d'édition
     */
    closeEditModal() {
        document.getElementById('editPositionModal').style.display = 'none';
        this.currentEditTicket = null;
    }

    /**
     * Sauvegarde les modifications de position
     */
    async savePositionChanges() {
        if (!this.currentEditTicket) return;

        const stopLoss = parseFloat(document.getElementById('editStopLoss').value) || null;
        const takeProfit = parseFloat(document.getElementById('editTakeProfit').value) || null;

        try {
            // TODO: Implémenter l'endpoint de modification dans l'API
            // await window.api.modifyOrder(this.currentEditTicket, { stopLoss, takeProfit });
            
            window.notifications.success('Position', 'Modifications sauvegardées (simulation)');
            this.closeEditModal();
            await this.loadPositions();
            
        } catch (error) {
            window.notifications.error('Erreur', 'Impossible de modifier la position');
        }
    }

    /**
     * Ferme une position spécifique
     */
    async closePosition(ticket) {
        const position = this.data.positions.find(p => p.ticket == ticket);
        if (!position) return;

        if (!confirm(`Fermer la position ${position.symbol} (${position.type}) ?`)) return;

        try {
            await window.api.closeOrder(ticket);
            window.notifications.success('Position', `Position ${position.symbol} fermée`);
            await this.loadPositions();
        } catch (error) {
            window.notifications.error('Erreur', 'Impossible de fermer la position');
        }
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
     * Actions utilisateur
     */
    async refresh() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            setTimeout(() => refreshBtn.disabled = false, 1000);
        }

        try {
            await this.loadAllData();
            window.notifications.success('Actualisation', 'Données mises à jour');
        } catch (error) {
            window.notifications.error('Erreur', 'Impossible d\'actualiser les données');
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
                await this.loadPositions();
            } else {
                window.notifications.info('Information', 'Aucune position à fermer');
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

    /**
     * Gestion des erreurs d'affichage
     */
    showAccountError() {
        this.updateElement('balance', 'Erreur');
        this.updateElement('equity', 'Erreur');
        this.updateElement('margin', 'Erreur');
        this.updateElement('freeMargin', 'Erreur');
        this.updateElement('marginLevel', 'Erreur');
    }

    showSystemError() {
        const mt4StatusText = document.getElementById('mt4StatusText');
        if (mt4StatusText) {
            mt4StatusText.textContent = 'Déconnecté';
            mt4StatusText.style.color = '#c7162b';
        }
    }

    showPositionsError() {
        const container = document.getElementById('positionsList');
        if (container) {
            container.innerHTML = `
                <div class="p-notification--negative">
                    <div class="p-notification__content">
                        <p class="p-notification__message">Erreur lors du chargement des positions</p>
                        <button class="p-button--base" onclick="window.dashboard.loadPositions()">Réessayer</button>
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
            } catch (error) {
                console.warn('Échec actualisation données critiques:', error);
            }
        }, this.refreshInterval);

        // Signaux moins critiques toutes les 30 secondes
        window.pollingSystem.start('dashboard-signals', async () => {
            try {
                await this.loadRecentSignals();
            } catch (error) {
                console.warn('Échec actualisation signaux:', error);
            }
        }, 30000);
    }

    /**
     * Arrêt des mises à jour automatiques
     */
    stopAutoRefresh() {
        window.pollingSystem.stop('dashboard-critical');
        window.pollingSystem.stop('dashboard-signals');
    }

    /**
     * Nettoyage lors de la fermeture
     */
    destroy() {
        this.stopAutoRefresh();
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
    // Initialiser le dashboard
    window.dashboard.init().catch(error => {
        console.error('Échec initialisation dashboard:', error);
    });
});

/**
 * Nettoyage avant fermeture de la page
 */
window.addEventListener('beforeunload', () => {
    window.dashboard.destroy();
});