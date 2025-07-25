/**
 * Gestionnaire de la page Stratégies
 * Gestion CRUD complète des stratégies de trading
 */

class StrategiesManager {
    constructor() {
        this.strategies = [];
        this.filteredStrategies = [];
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.totalItems = 0;
        this.currentFilters = {
            search: '',
            status: '',
            sortBy: 'name',
            sortOrder: 'asc'
        };
        
        // Symboles disponibles pour les stratégies
        this.availableSymbols = window.CONFIG.TRADING.SUPPORTED_SYMBOLS;
    }

    /**
     * Sauvegarder une stratégie (création ou modification)
     */
    async saveStrategy(strategyId = null) {
        try {
            const form = document.getElementById('strategyForm');
            const formData = new FormData(form);
            
            // Récupération des symboles sélectionnés
            const selectedSymbols = Array.from(form.querySelectorAll('input[name="symbols"]:checked'))
                .map(input => input.value);
            
            if (selectedSymbols.length === 0) {
                window.NotificationManager.show(
                    'Validation',
                    'Vous devez sélectionner au moins un symbole',
                    'warning'
                );
                return false;
            }
            
            // Construction de l'objet données
            const data = {
                name: formData.get('name').trim(),
                description: formData.get('description')?.trim() || null,
                isActive: formData.has('isActive'),
                defaultRiskPercent: parseFloat(formData.get('defaultRiskPercent')),
                maxPositions: parseInt(formData.get('maxPositions')),
                maxLotSize: parseFloat(formData.get('maxLotSize')),
                maxDailyLoss: formData.get('maxDailyLoss') ? parseFloat(formData.get('maxDailyLoss')) : null,
                allowedSymbols: JSON.stringify(selectedSymbols),
                tradingHours: JSON.stringify({
                    start: formData.get('startTime'),
                    end: formData.get('endTime')
                })
            };
            
            // Validation côté client
            const validation = this.validateStrategyData(data);
            if (!validation.isValid) {
                window.NotificationManager.show(
                    'Validation',
                    validation.errors.join('<br>'),
                    'warning'
                );
                return false;
            }
            
            // Appel API
            let response;
            if (strategyId) {
                response = await window.apiClient.updateStrategy(strategyId, data);
            } else {
                response = await window.apiClient.createStrategy(data);
            }
            
            if (response.success) {
                window.NotificationManager.show(
                    'Succès',
                    `Stratégie ${strategyId ? 'modifiée' : 'créée'} avec succès`,
                    'success'
                );
                
                await this.loadStrategies();
                return true;
            } else {
                throw new Error(response.error || 'Erreur lors de la sauvegarde');
            }
            
        } catch (error) {
            console.error('Erreur sauvegarde stratégie:', error);
            window.NotificationManager.show(
                'Erreur',
                error.message,
                'error'
            );
            return false;
        }
    }

    /**
     * Validation des données de stratégie
     */
    validateStrategyData(data) {
        const errors = [];
        
        if (!data.name || data.name.length < 2) {
            errors.push('Le nom doit contenir au moins 2 caractères');
        }
        
        if (data.defaultRiskPercent < 0.1 || data.defaultRiskPercent > 10) {
            errors.push('Le risque par défaut doit être entre 0.1% et 10%');
        }
        
        if (data.maxPositions < 1 || data.maxPositions > 10) {
            errors.push('Le nombre maximum de positions doit être entre 1 et 10');
        }
        
        if (data.maxLotSize < 0.01 || data.maxLotSize > 10) {
            errors.push('La taille maximum des lots doit être entre 0.01 et 10');
        }
        
        if (data.maxDailyLoss && (data.maxDailyLoss < 1 || data.maxDailyLoss > 20)) {
            errors.push('La perte maximale quotidienne doit être entre 1% et 20%');
        }
        
        try {
            const symbols = JSON.parse(data.allowedSymbols);
            if (!Array.isArray(symbols) || symbols.length === 0) {
                errors.push('Au moins un symbole doit être sélectionné');
            }
        } catch {
            errors.push('Erreur dans la sélection des symboles');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Basculer le statut actif/inactif d'une stratégie
     */
    async toggleStrategy(strategyId) {
        try {
            const strategy = this.strategies.find(s => s.id === strategyId);
            if (!strategy) return;
            
            const newStatus = !strategy.isActive;
            const action = newStatus ? 'activer' : 'désactiver';
            
            // Demande de confirmation
            const confirmed = await new Promise(resolve => {
                window.ModalManager.confirm(
                    'Confirmation',
                    `Êtes-vous sûr de vouloir ${action} la stratégie "${strategy.name}" ?`,
                    resolve,
                    () => resolve(false)
                );
            });
            
            if (!confirmed) return;
            
            const response = await window.apiClient.updateStrategy(strategyId, {
                isActive: newStatus
            });
            
            if (response.success) {
                window.NotificationManager.show(
                    'Succès',
                    `Stratégie ${newStatus ? 'activée' : 'désactivée'} avec succès`,
                    'success'
                );
                
                await this.loadStrategies();
            } else {
                throw new Error(response.error || 'Erreur lors de la modification');
            }
            
        } catch (error) {
            console.error('Erreur basculement stratégie:', error);
            window.NotificationManager.show(
                'Erreur',
                error.message,
                'error'
            );
        }
    }

    /**
     * Supprimer une stratégie
     */
    async deleteStrategy(strategyId) {
        try {
            const strategy = this.strategies.find(s => s.id === strategyId);
            if (!strategy) return;
            
            // Vérifier s'il y a des signaux ou ordres associés
            const hasSignals = (strategy._count?.signals || 0) > 0;
            const hasOrders = (strategy._count?.orders || 0) > 0;
            
            let confirmMessage = `Êtes-vous sûr de vouloir supprimer la stratégie "${strategy.name}" ?`;
            
            if (hasSignals || hasOrders) {
                confirmMessage += `\n\n⚠️ Attention: Cette stratégie a ${strategy._count?.signals || 0} signal(s) et ${strategy._count?.orders || 0} ordre(s) associé(s). La suppression est définitive.`;
            }
            
            // Demande de confirmation
            const confirmed = await new Promise(resolve => {
                window.ModalManager.confirm(
                    'Supprimer la stratégie',
                    confirmMessage,
                    resolve,
                    () => resolve(false)
                );
            });
            
            if (!confirmed) return;
            
            const response = await window.apiClient.deleteStrategy(strategyId);
            
            if (response.success) {
                window.NotificationManager.show(
                    'Succès',
                    'Stratégie supprimée avec succès',
                    'success'
                );
                
                await this.loadStrategies();
            } else {
                throw new Error(response.error || 'Erreur lors de la suppression');
            }
            
        } catch (error) {
            console.error('Erreur suppression stratégie:', error);
            window.NotificationManager.show(
                'Erreur',
                error.message,
                'error'
            );
        }
    }

    /**
     * Afficher l'état de chargement
     */
    showLoading() {
        const tbody = document.getElementById('strategiesTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center">
                    <div class="loading-content">
                        <div class="spinner"></div>
                        <p>Chargement des stratégies...</p>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Afficher une erreur
     */
    showError(message) {
        const tbody = document.getElementById('strategiesTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center">
                    <div class="empty-state">
                        <div class="empty-icon" style="color: var(--danger-color);">❌</div>
                        <h3>Erreur de chargement</h3>
                        <p>${message}</p>
                        <button class="btn btn-primary" onclick="window.strategiesManager.loadStrategies()">
                            Réessayer
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Exporter les stratégies au format JSON
     */
    exportStrategies() {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                totalStrategies: this.strategies.length,
                strategies: this.strategies.map(strategy => ({
                    name: strategy.name,
                    description: strategy.description,
                    isActive: strategy.isActive,
                    defaultRiskPercent: strategy.defaultRiskPercent,
                    maxPositions: strategy.maxPositions,
                    maxLotSize: strategy.maxLotSize,
                    maxDailyLoss: strategy.maxDailyLoss,
                    allowedSymbols: strategy.allowedSymbols,
                    tradingHours: strategy.tradingHours,
                    createdAt: strategy.createdAt,
                    stats: {
                        totalSignals: strategy._count?.signals || 0,
                        totalOrders: strategy._count?.orders || 0
                    }
                }))
            };
            
            const filename = `strategies_export_${new Date().toISOString().split('T')[0]}.json`;
            const dataStr = JSON.stringify(exportData, null, 2);
            
            Utils.downloadFile(dataStr, filename, 'application/json');
            
            window.NotificationManager.show(
                'Export réussi',
                `${this.strategies.length} stratégies exportées`,
                'success'
            );
            
        } catch (error) {
            console.error('Erreur export:', error);
            window.NotificationManager.show(
                'Erreur d\'export',
                error.message,
                'error'
            );
        }
    }

    /**
     * Dupliquer une stratégie
     */
    async duplicateStrategy(strategyId) {
        try {
            const strategy = this.strategies.find(s => s.id === strategyId);
            if (!strategy) return;
            
            // Préparer les données pour la duplication
            const duplicateData = {
                name: `${strategy.name} (Copie)`,
                description: strategy.description,
                isActive: false, // Désactivée par défaut
                defaultRiskPercent: strategy.defaultRiskPercent,
                maxPositions: strategy.maxPositions,
                maxLotSize: strategy.maxLotSize,
                maxDailyLoss: strategy.maxDailyLoss,
                allowedSymbols: strategy.allowedSymbols,
                tradingHours: strategy.tradingHours
            };
            
            const response = await window.apiClient.createStrategy(duplicateData);
            
            if (response.success) {
                window.NotificationManager.show(
                    'Succès',
                    'Stratégie dupliquée avec succès',
                    'success'
                );
                
                await this.loadStrategies();
            } else {
                throw new Error(response.error || 'Erreur lors de la duplication');
            }
            
        } catch (error) {
            console.error('Erreur duplication stratégie:', error);
            window.NotificationManager.show(
                'Erreur',
                error.message,
                'error'
            );
        }
    }

    /**
     * Afficher les détails d'une stratégie
     */
    showStrategyDetails(strategyId) {
        const strategy = this.strategies.find(s => s.id === strategyId);
        if (!strategy) return;
        
        const symbols = JSON.parse(strategy.allowedSymbols || '[]');
        const tradingHours = JSON.parse(strategy.tradingHours || '{}');
        
        window.ModalManager.show('strategy-details', {
            title: `Détails - ${strategy.name}`,
            content: `
                <div class="strategy-details">
                    <div class="detail-section">
                        <h4>Informations générales</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Nom:</label>
                                <span>${strategy.name}</span>
                            </div>
                            <div class="detail-item">
                                <label>Statut:</label>
                                <span class="strategy-status">
                                    <span class="status-dot ${strategy.isActive ? 'status-active' : 'status-inactive'}"></span>
                                    ${strategy.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div class="detail-item">
                                <label>Description:</label>
                                <span>${strategy.description || 'Aucune description'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Créée le:</label>
                                <span>${Utils.formatDate(strategy.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Paramètres de risque</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Risque par défaut:</label>
                                <span>${strategy.defaultRiskPercent}%</span>
                            </div>
                            <div class="detail-item">
                                <label>Positions maximum:</label>
                                <span>${strategy.maxPositions}</span>
                            </div>
                            <div class="detail-item">
                                <label>Lot maximum:</label>
                                <span>${strategy.maxLotSize}</span>
                            </div>
                            <div class="detail-item">
                                <label>Perte max quotidienne:</label>
                                <span>${strategy.maxDailyLoss ? strategy.maxDailyLoss + '%' : 'Aucune limite'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Configuration trading</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Heures de trading:</label>
                                <span>${tradingHours.start || '--'} - ${tradingHours.end || '--'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Symboles autorisés:</label>
                                <div class="symbols-list">
                                    ${symbols.map(symbol => `<span class="symbol-badge">${symbol}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Statistiques</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Total signaux:</label>
                                <span class="badge badge-info">${strategy._count?.signals || 0}</span>
                            </div>
                            <div class="detail-item">
                                <label>Total ordres:</label>
                                <span class="badge badge-success">${strategy._count?.orders || 0}</span>
                            </div>
                            <div class="detail-item">
                                <label>Dernière modification:</label>
                                <span>${Utils.formatDate(strategy.updatedAt)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            size: 'large',
            buttons: [
                {
                    id: 'edit',
                    label: 'Modifier',
                    type: 'primary',
                    handler: () => {
                        window.ModalManager.close();
                        this.showStrategyModal(strategyId);
                    }
                },
                {
                    id: 'duplicate',
                    label: 'Dupliquer',
                    type: 'secondary',
                    handler: () => {
                        window.ModalManager.close();
                        this.duplicateStrategy(strategyId);
                    }
                },
                {
                    id: 'close',
                    label: 'Fermer',
                    type: 'secondary'
                }
            ]
        });
    }

    /**
     * Obtenir les statistiques de performance d'une stratégie
     */
    async getStrategyPerformance(strategyId) {
        try {
            // Cette fonction pourrait appeler un endpoint spécialisé pour les stats
            // Pour l'instant, on utilise les données disponibles
            const strategy = this.strategies.find(s => s.id === strategyId);
            if (!strategy) return null;
            
            return {
                totalSignals: strategy._count?.signals || 0,
                totalOrders: strategy._count?.orders || 0,
                // D'autres métriques pourraient être ajoutées ici
            };
            
        } catch (error) {
            console.error('Erreur récupération performance:', error);
            return null;
        }
    }
}

// Export global
window.StrategiesManager = StrategiesManager;

// Rendre l'instance accessible globalement pour les boutons d'action
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('strategies.html')) {
        window.strategiesManager = new StrategiesManager();
    }
});

/**
 * Utilitaires additionnels pour la gestion des stratégies
 */
class StrategyUtils {
    /**
     * Valider les heures de trading
     */
    static validateTradingHours(startTime, endTime) {
        if (!startTime || !endTime) return true; // Optionnel
        
        const start = new Date(`2000-01-01T${startTime}:00`);
        const end = new Date(`2000-01-01T${endTime}:00`);
        
        return start < end;
    }
    
    /**
     * Formater les symboles pour l'affichage
     */
    static formatSymbolsList(symbolsJson, maxDisplay = 3) {
        try {
            const symbols = JSON.parse(symbolsJson || '[]');
            if (symbols.length === 0) return 'Aucun symbole';
            
            const displayed = symbols.slice(0, maxDisplay);
            const remaining = symbols.length - maxDisplay;
            
            let result = displayed.join(', ');
            if (remaining > 0) {
                result += ` (+${remaining} autres)`;
            }
            
            return result;
        } catch {
            return 'Symboles invalides';
        }
    }
    
    /**
     * Calculer le score de risque d'une stratégie
     */
    static calculateRiskScore(strategy) {
        let score = 0;
        
        // Plus le risque par défaut est élevé, plus le score augmente
        score += (strategy.defaultRiskPercent || 1) * 10;
        
        // Plus il y a de positions max, plus le risque augmente
        score += (strategy.maxPositions || 1) * 5;
        
        // Plus la taille de lot max est élevée, plus le risque augmente
        score += (strategy.maxLotSize || 0.1) * 20;
        
        // Si pas de limite de perte quotidienne, risque plus élevé
        if (!strategy.maxDailyLoss) {
            score += 20;
        }
        
        // Normaliser le score sur 100
        return Math.min(100, Math.round(score));
    }
    
    /**
     * Obtenir la couleur selon le score de risque
     */
    static getRiskColor(riskScore) {
        if (riskScore < 30) return 'var(--success-color)';
        if (riskScore < 60) return 'var(--warning-color)';
        return 'var(--danger-color)';
    }
    
    /**
     * Générer un résumé textuel d'une stratégie
     */
    static generateStrategySummary(strategy) {
        const symbols = JSON.parse(strategy.allowedSymbols || '[]');
        const tradingHours = JSON.parse(strategy.tradingHours || '{}');
        
        let summary = `Stratégie "${strategy.name}" `;
        summary += strategy.isActive ? '(Active)' : '(Inactive)';
        summary += `\n• Risque: ${strategy.defaultRiskPercent}% par trade`;
        summary += `\n• Max positions: ${strategy.maxPositions}`;
        summary += `\n• Symboles: ${symbols.join(', ')}`;
        
        if (tradingHours.start && tradingHours.end) {
            summary += `\n• Heures: ${tradingHours.start} - ${tradingHours.end}`;
        }
        
        if (strategy.maxDailyLoss) {
            summary += `\n• Limite quotidienne: ${strategy.maxDailyLoss}%`;
        }
        
        return summary;
    }
}

// Export des utilitaires
window.StrategyUtils = StrategyUtils;
    /**
     * Initialisation du gestionnaire
     */
    async init() {
        this.bindEvents();
        await this.loadStrategies();
        this.updateStats();
    }

    /**
     * Liaison des événements
     */
    bindEvents() {
        // Bouton d'actualisation
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadStrategies();
        });

        // Bouton nouvelle stratégie
        document.getElementById('addStrategyBtn').addEventListener('click', () => {
            this.showStrategyModal();
        });

        // Recherche
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', Utils.debounce(() => {
            this.currentFilters.search = searchInput.value;
            this.applyFilters();
        }, 300));

        // Filtres
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.currentFilters.status = e.target.value;
            this.applyFilters();
        });

        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.currentFilters.sortBy = e.target.value;
            this.applyFilters();
        });

        document.getElementById('sortOrder').addEventListener('change', (e) => {
            this.currentFilters.sortOrder = e.target.value;
            this.applyFilters();
        });

        // Pagination
        document.getElementById('prevPageBtn').addEventListener('click', () => {
            this.goToPage(this.currentPage - 1);
        });

        document.getElementById('nextPageBtn').addEventListener('click', () => {
            this.goToPage(this.currentPage + 1);
        });
    }

    /**
     * Charger les stratégies depuis l'API
     */
    async loadStrategies() {
        try {
            this.showLoading();
            
            const response = await window.apiClient.getStrategies();
            
            if (response.success) {
                this.strategies = response.data;
                this.applyFilters();
                this.updateStats();
                
                window.NotificationManager.show(
                    'Stratégies chargées',
                    `${this.strategies.length} stratégie(s) trouvée(s)`,
                    'success'
                );
            } else {
                throw new Error(response.error || 'Erreur lors du chargement');
            }
        } catch (error) {
            console.error('Erreur chargement stratégies:', error);
            this.showError('Impossible de charger les stratégies');
            
            window.NotificationManager.show(
                'Erreur de chargement',
                error.message,
                'error'
            );
        }
    }

    /**
     * Appliquer les filtres et trier
     */
    applyFilters() {
        let filtered = [...this.strategies];

        // Filtre par recherche
        if (this.currentFilters.search) {
            filtered = Utils.searchFilter(filtered, this.currentFilters.search, [
                'name', 'description'
            ]);
        }

        // Filtre par statut
        if (this.currentFilters.status !== '') {
            const isActive = this.currentFilters.status === 'true';
            filtered = filtered.filter(strategy => strategy.isActive === isActive);
        }

        // Tri
        filtered = Utils.sortBy(filtered, this.currentFilters.sortBy, this.currentFilters.sortOrder);

        this.filteredStrategies = filtered;
        this.totalItems = filtered.length;
        this.currentPage = 1;
        
        this.updatePagination();
        this.renderTable();
    }

    /**
     * Aller à une page spécifique
     */
    goToPage(page) {
        const maxPage = Math.ceil(this.totalItems / this.itemsPerPage);
        
        if (page < 1) page = 1;
        if (page > maxPage) page = maxPage;
        
        this.currentPage = page;
        this.updatePagination();
        this.renderTable();
    }

    /**
     * Mise à jour de la pagination
     */
    updatePagination() {
        const maxPage = Math.ceil(this.totalItems / this.itemsPerPage);
        const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);

        // Informations de pagination
        document.getElementById('paginationInfo').textContent = 
            `Affichage de ${startItem} à ${endItem} sur ${this.totalItems} stratégies`;

        // Boutons précédent/suivant
        document.getElementById('prevPageBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage >= maxPage;

        // Pages
        this.renderPaginationPages(maxPage);
    }

    /**
     * Rendre les boutons de pagination
     */
    renderPaginationPages(maxPage) {
        const pagesContainer = document.getElementById('paginationPages');
        pagesContainer.innerHTML = '';

        if (maxPage <= 1) return;

        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(maxPage, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const button = document.createElement('button');
            button.className = `page-btn ${i === this.currentPage ? 'active' : ''}`;
            button.textContent = i;
            button.addEventListener('click', () => this.goToPage(i));
            pagesContainer.appendChild(button);
        }
    }

    /**
     * Mise à jour des statistiques
     */
    updateStats() {
        const totalStrategies = this.strategies.length;
        const activeStrategies = this.strategies.filter(s => s.isActive).length;
        const totalSignals = this.strategies.reduce((sum, s) => sum + (s._count?.signals || 0), 0);
        const totalOrders = this.strategies.reduce((sum, s) => sum + (s._count?.orders || 0), 0);

        document.getElementById('totalStrategies').textContent = totalStrategies;
        document.getElementById('activeStrategies').textContent = activeStrategies;
        document.getElementById('totalSignals').textContent = totalSignals;
        document.getElementById('totalOrders').textContent = totalOrders;
    }

    /**
     * Rendre le tableau des stratégies
     */
    renderTable() {
        const tbody = document.getElementById('strategiesTableBody');
        
        if (this.filteredStrategies.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">
                        <div class="empty-state">
                            <div class="empty-icon">🎯</div>
                            <h3>Aucune stratégie trouvée</h3>
                            <p>Créez votre première stratégie pour commencer</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = this.filteredStrategies.slice(startIndex, endIndex);

        tbody.innerHTML = pageItems.map(strategy => this.renderStrategyRow(strategy)).join('');

        // Réattacher les événements aux nouveaux éléments
        this.bindTableEvents();
    }

    /**
     * Rendre une ligne de stratégie
     */
    renderStrategyRow(strategy) {
        const symbols = JSON.parse(strategy.allowedSymbols || '[]');
        const symbolsDisplay = symbols.slice(0, 3).map(symbol => 
            `<span class="symbol-badge">${symbol}</span>`
        ).join('');
        const moreSymbols = symbols.length > 3 ? `<span class="symbol-badge">+${symbols.length - 3}</span>` : '';

        return `
            <tr data-id="${strategy.id}">
                <td>
                    <strong>${strategy.name}</strong>
                </td>
                <td>
                    <span title="${strategy.description || ''}">${
                        strategy.description 
                            ? (strategy.description.length > 50 
                                ? strategy.description.substring(0, 50) + '...' 
                                : strategy.description)
                            : '--'
                    }</span>
                </td>
                <td>
                    <div class="strategy-status">
                        <span class="status-dot ${strategy.isActive ? 'status-active' : 'status-inactive'}"></span>
                        ${strategy.isActive ? 'Active' : 'Inactive'}
                    </div>
                </td>
                <td>${strategy.defaultRiskPercent}%</td>
                <td>${strategy.maxPositions}</td>
                <td>
                    <div class="symbols-list">
                        ${symbolsDisplay}
                        ${moreSymbols}
                    </div>
                </td>
                <td>
                    <span class="badge badge-info">${strategy._count?.signals || 0}</span>
                </td>
                <td>
                    <span class="badge badge-success">${strategy._count?.orders || 0}</span>
                </td>
                <td>${Utils.formatDate(strategy.createdAt, 'date')}</td>
                <td>
                    <div class="actions-group">
                        <button class="btn btn-sm btn-ghost edit-btn" data-id="${strategy.id}" title="Modifier">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-ghost toggle-btn" data-id="${strategy.id}" title="${strategy.isActive ? 'Désactiver' : 'Activer'}">
                            ${strategy.isActive ? '⏸️' : '▶️'}
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${strategy.id}" title="Supprimer">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Liaison des événements du tableau
     */
    bindTableEvents() {
        // Boutons d'édition
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const strategyId = e.target.closest('.edit-btn').dataset.id;
                this.showStrategyModal(strategyId);
            });
        });

        // Boutons de basculement actif/inactif
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const strategyId = e.target.closest('.toggle-btn').dataset.id;
                this.toggleStrategy(strategyId);
            });
        });

        // Boutons de suppression
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const strategyId = e.target.closest('.delete-btn').dataset.id;
                this.deleteStrategy(strategyId);
            });
        });
    }

    /**
     * Afficher la modale de création/édition
     */
    showStrategyModal(strategyId = null) {
        const strategy = strategyId ? this.strategies.find(s => s.id === strategyId) : null;
        const isEdit = !!strategy;
        
        const symbols = strategy ? JSON.parse(strategy.allowedSymbols || '[]') : ['EURUSD'];
        const tradingHours = strategy ? JSON.parse(strategy.tradingHours || '{}') : { start: '08:00', end: '22:00' };

        const symbolsCheckboxes = this.availableSymbols.map(symbol => `
            <div class="checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" name="symbols" value="${symbol}" ${symbols.includes(symbol) ? 'checked' : ''}>
                    <span class="checkbox-text">${symbol}</span>
                </label>
            </div>
        `).join('');

        const formFields = [
            {
                type: 'text',
                name: 'name',
                label: 'Nom de la stratégie',
                value: strategy?.name || '',
                required: true,
                placeholder: 'Ex: Scalping EURUSD'
            },
            {
                type: 'textarea',
                name: 'description',
                label: 'Description',
                value: strategy?.description || '',
                placeholder: 'Description détaillée de la stratégie...'
            },
            {
                type: 'number',
                name: 'defaultRiskPercent',
                label: 'Risque par défaut (%)',
                value: strategy?.defaultRiskPercent || 1.0,
                required: true,
                min: 0.1,
                max: 10,
                step: 0.1
            },
            {
                type: 'number',
                name: 'maxPositions',
                label: 'Nombre maximum de positions',
                value: strategy?.maxPositions || 1,
                required: true,
                min: 1,
                max: 10
            },
            {
                type: 'number',
                name: 'maxLotSize',
                label: 'Taille maximum des lots',
                value: strategy?.maxLotSize || 0.1,
                required: true,
                min: 0.01,
                max: 10,
                step: 0.01
            },
            {
                type: 'number',
                name: 'maxDailyLoss',
                label: 'Perte maximale quotidienne (%)',
                value: strategy?.maxDailyLoss || 5,
                min: 1,
                max: 20
            }
        ];

        window.ModalManager.show('strategy-form', {
            title: isEdit ? 'Modifier la Stratégie' : 'Nouvelle Stratégie',
            content: `
                <form id="strategyForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Nom de la stratégie</label>
                            <input type="text" name="name" class="form-control" value="${strategy?.name || ''}" required placeholder="Ex: Scalping EURUSD">
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" name="isActive" ${!strategy || strategy.isActive ? 'checked' : ''}>
                                Stratégie active
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea name="description" class="form-control" rows="3" placeholder="Description détaillée de la stratégie...">${strategy?.description || ''}</textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Risque par défaut (%)</label>
                            <input type="number" name="defaultRiskPercent" class="form-control" value="${strategy?.defaultRiskPercent || 1.0}" min="0.1" max="10" step="0.1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max positions</label>
                            <input type="number" name="maxPositions" class="form-control" value="${strategy?.maxPositions || 1}" min="1" max="10" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Max lot size</label>
                            <input type="number" name="maxLotSize" class="form-control" value="${strategy?.maxLotSize || 0.1}" min="0.01" max="10" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max perte quotidienne (%)</label>
                            <input type="number" name="maxDailyLoss" class="form-control" value="${strategy?.maxDailyLoss || 5}" min="1" max="20">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Heure de début</label>
                            <input type="time" name="startTime" class="form-control" value="${tradingHours.start || '08:00'}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Heure de fin</label>
                            <input type="time" name="endTime" class="form-control" value="${tradingHours.end || '22:00'}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Symboles autorisés</label>
                        <div class="symbols-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--spacing-sm);">
                            ${symbolsCheckboxes}
                        </div>
                    </div>
                </form>
            `,
            size: 'large',
            buttons: [
                {
                    id: 'cancel',
                    label: 'Annuler',
                    type: 'secondary'
                },
                {
                    id: 'save',
                    label: isEdit ? 'Mettre à jour' : 'Créer',
                    type: 'primary',
                    handler: () => this.saveStrategy(strategyId)
                }
            ]
        });
    }

  