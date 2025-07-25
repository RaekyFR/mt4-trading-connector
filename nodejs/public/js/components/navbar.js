// js/components/navbar.js

/**
 * Gestionnaire de navigation utilisant Vanilla Framework CSS
 */
class Navigation {
    constructor() {
        this.currentPage = 'dashboard';
        this.navItems = new Map();
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.initNavItems();
        this.handleInitialRoute();
    }

    /**
     * Initialise les éléments de navigation
     */
    initNavItems() {
        const navLinks = document.querySelectorAll('.p-navigation__link');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                const page = href.substring(1);
                this.navItems.set(page, {
                    element: link.parentElement, // li element
                    link: link,
                    page: page,
                    title: link.textContent.trim()
                });
            }
        });
    }

    /**
     * Attache les gestionnaires d'événements
     */
    attachEventListeners() {
        // Navigation par hash
        window.addEventListener('hashchange', () => this.handleRouteChange());
        
        // Clics sur les liens de navigation
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('.p-navigation__link');
            if (navLink) {
                e.preventDefault();
                const href = navLink.getAttribute('href');
                if (href && href.startsWith('#')) {
                    this.navigateTo(href.substring(1));
                }
            }
        });

        // Gestion du bouton retour du navigateur
        window.addEventListener('popstate', () => this.handleRouteChange());
    }

    /**
     * Gère les changements de route
     */
    handleRouteChange() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        const [page, ...params] = hash.split('?');
        
        this.setActivePage(page, params.join('?'));
    }

    /**
     * Gère la route initiale
     */
    handleInitialRoute() {
        this.handleRouteChange();
    }

    /**
     * Navigue vers une page
     */
    navigateTo(page, params = '') {
        const fullPath = params ? `${page}?${params}` : page;
        window.location.hash = `#${fullPath}`;
    }

    /**
     * Définit la page active en utilisant les classes Vanilla Framework
     */
    setActivePage(page, params = '') {
        // Nettoyer les classes actives
        this.navItems.forEach(item => {
            item.element.classList.remove('is-selected');
        });

        // Activer la nouvelle page
        const navItem = this.navItems.get(page);
        if (navItem) {
            navItem.element.classList.add('is-selected');
            this.currentPage = page;
            
            // Mettre à jour le titre de la page
            this.updatePageTitle(navItem.title);
            
            // Charger le contenu de la page
            this.loadPageContent(page, params);
        } else {
            // Page par défaut si non trouvée
            this.navigateTo('dashboard');
        }
    }

    /**
     * Met à jour le titre de la page
     */
    updatePageTitle(title) {
        document.title = `${title} - TradingView MT4 Bridge`;
    }

    /**
     * Charge le contenu d'une page
     */
    async loadPageContent(page, params) {
        const mainContent = document.querySelector('main');
        if (!mainContent) return;

        try {
            // Masquer le dashboard et afficher un loader si nécessaire
            if (page !== 'dashboard') {
                this.showPageLoader(mainContent);
            }

            switch (page) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'strategies':
                    await this.loadStrategiesPage();
                    break;
                case 'signals':
                    await this.loadSignalsPage(params);
                    break;
                case 'orders':
                    await this.loadOrdersPage(params);
                    break;
                case 'risk':
                    await this.loadRiskPage();
                    break;
                case 'logs':
                    await this.loadLogsPage();
                    break;
                default:
                    this.show404Page();
            }

        } catch (error) {
            console.error(`Error loading page ${page}:`, error);
            this.showErrorPage(error.message);
        }
    }

    /**
     * Affiche le loader de page avec Vanilla Framework
     */
    showPageLoader(container) {
        container.innerHTML = `
            <div class="p-strip">
                <div class="row">
                    <div class="col-12 u-align--center">
                        <i class="p-icon--spinner u-animation--spin"></i>
                        <p class="p-text--default">Chargement...</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Charge le dashboard (aucune action, déjà chargé)
     */
    async loadDashboard() {
        // Le dashboard est déjà dans le HTML principal
        if (window.dashboard && window.dashboard.isInitialized) {
            await window.dashboard.refresh();
        }
    }

    /**
     * Charge la page des stratégies avec Vanilla Framework
     */
    async loadStrategiesPage() {
        const mainContent = document.querySelector('main');
        
        try {
            const strategies = await window.api.getStrategies();
            
            const html = `
                <div class="p-strip">
                    <div class="row">
                        <div class="col-8">
                            <h1 class="p-heading--2">Stratégies de Trading</h1>
                        </div>
                        <div class="col-4 u-align--right">
                            <button class="p-button--positive" id="addStrategyBtn">
                                Nouvelle Stratégie
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="p-strip is-shallow">
                    <div class="row">
                        <div class="col-12">
                            ${this.renderStrategies(strategies)}
                        </div>
                    </div>
                </div>
            `;
            
            mainContent.innerHTML = html;
            this.attachStrategiesEvents();
            
        } catch (error) {
            mainContent.innerHTML = `
                <div class="p-strip">
                    <div class="row">
                        <div class="col-12">
                            <div class="p-notification--negative">
                                <div class="p-notification__content">
                                    <h5 class="p-notification__title">Erreur de chargement</h5>
                                    <p class="p-notification__message">Impossible de charger les stratégies: ${error.message}</p>
                                    <button class="p-button--positive" onclick="window.location.reload()">Réessayer</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Charge la page des signaux
     */
    async loadSignalsPage(params) {
        const mainContent = document.querySelector('main');
        
        const urlParams = new URLSearchParams(params);
        const filters = {
            status: urlParams.get('status') || '',
            symbol: urlParams.get('symbol') || '',
            strategyId: urlParams.get('strategyId') || ''
        };

        try {
            const response = await window.api.getSignals(filters);
            
            const html = `
                <div class="p-strip">
                    <div class="row">
                        <div class="col-6">
                            <h1 class="p-heading--2">Signaux de Trading</h1>
                        </div>
                        <div class="col-6">
                            ${this.renderSignalFilters(filters)}
                        </div>
                    </div>
                </div>
                
                <div class="p-strip is-shallow">
                    <div class="row">
                        <div class="col-12">
                            ${this.renderSignalsTable(response)}
                        </div>
                    </div>
                </div>
            `;
            
            mainContent.innerHTML = html;
            this.attachSignalsEvents();
            
        } catch (error) {
            this.showErrorPage(error.message);
        }
    }

    /**
     * Charge la page des ordres
     */
    async loadOrdersPage(params) {
        const mainContent = document.querySelector('main');
        
        const urlParams = new URLSearchParams(params);
        const filters = {
            status: urlParams.get('status') || '',
            symbol: urlParams.get('symbol') || ''
        };

        try {
            const response = await window.api.getOrders(filters);
            
            const html = `
                <div class="p-strip">
                    <div class="row">
                        <div class="col-6">
                            <h1 class="p-heading--2">Ordres de Trading</h1>
                        </div>
                        <div class="col-6 u-align--right">
                            <button class="p-button--negative" id="closeAllOrdersBtn">Fermer Tout</button>
                            <button class="p-button--base" id="refreshOrdersBtn">Actualiser</button>
                        </div>
                    </div>
                </div>
                
                <div class="p-strip is-shallow">
                    <div class="row">
                        <div class="col-12">
                            ${this.renderOrdersTable(response)}
                        </div>
                    </div>
                </div>
            `;
            
            mainContent.innerHTML = html;
            this.attachOrdersEvents();
            
        } catch (error) {
            this.showErrorPage(error.message);
        }
    }

    /**
     * Charge la page de risk management
     */
    async loadRiskPage() {
        const mainContent = document.querySelector('main');
        
        try {
            const [config, metrics] = await Promise.all([
                window.api.getRiskConfig(),
                window.api.getRiskMetrics()
            ]);
            
            const html = `
                <div class="p-strip">
                    <div class="row">
                        <div class="col-8">
                            <h1 class="p-heading--2">Risk Management</h1>
                        </div>
                        <div class="col-4 u-align--right">
                            <button class="p-button--positive" id="saveRiskConfigBtn">Sauvegarder</button>
                        </div>
                    </div>
                </div>
                
                <div class="p-strip is-shallow">
                    <div class="row">
                        <div class="col-6">
                            ${this.renderRiskConfig(config)}
                        </div>
                        <div class="col-6">
                            ${this.renderRiskMetrics(metrics)}
                        </div>
                    </div>
                </div>
            `;
            
            mainContent.innerHTML = html;
            this.attachRiskEvents();
            
        } catch (error) {
            this.showErrorPage(error.message);
        }
    }

    /**
     * Charge la page des logs
     */
    async loadLogsPage() {
        const mainContent = document.querySelector('main');
        
        try {
            const response = await window.api.getLogs();
            
            const html = `
                <div class="p-strip">
                    <div class="row">
                        <div class="col-8">
                            <h1 class="p-heading--2">Logs d'Audit</h1>
                        </div>
                        <div class="col-4">
                            <select class="p-form-field__select" id="severityFilter">
                                <option value="">Tous les niveaux</option>
                                <option value="DEBUG">Debug</option>
                                <option value="INFO">Info</option>
                                <option value="WARNING">Warning</option>
                                <option value="ERROR">Error</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="p-strip is-shallow">
                    <div class="row">
                        <div class="col-12">
                            ${this.renderLogsTable(response)}
                        </div>
                    </div>
                </div>
            `;
            
            mainContent.innerHTML = html;
            this.attachLogsEvents();
            
        } catch (error) {
            this.showErrorPage(error.message);
        }
    }

    /**
     * Affiche une page 404 avec Vanilla Framework
     */
    show404Page() {
        const mainContent = document.querySelector('main');
        mainContent.innerHTML = `
            <div class="p-strip">
                <div class="row">
                    <div class="col-12 u-align--center">
                        <h1 class="p-heading--1">404</h1>
                        <p class="p-heading--4">Page Non Trouvée</p>
                        <p>La page demandée n'existe pas.</p>
                        <button class="p-button--positive" onclick="window.navigation.navigateTo('dashboard')">
                            Retour au Dashboard
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Affiche une page d'erreur avec Vanilla Framework
     */
    showErrorPage(message) {
        const mainContent = document.querySelector('main');
        mainContent.innerHTML = `
            <div class="p-strip">
                <div class="row">
                    <div class="col-12">
                        <div class="p-notification--negative">
                            <div class="p-notification__content">
                                <h5 class="p-notification__title">Erreur</h5>
                                <p class="p-notification__message">${message}</p>
                                <button class="p-button--positive" onclick="window.location.reload()">Réessayer</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==================== RENDER METHODS avec Vanilla Framework ====================

    renderStrategies(strategies) {
        if (strategies.length === 0) {
            return `
                <div class="p-card">
                    <div class="p-card__content u-align--center">
                        <p class="p-text--default">Aucune stratégie configurée</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="row">
                ${strategies.map(strategy => `
                    <div class="col-4">
                        <div class="p-card">
                            <div class="p-card__header">
                                <h4 class="p-card__title">${strategy.name}</h4>
                                <span class="p-label--${strategy.isActive ? 'positive' : 'information'}">
                                    ${strategy.isActive ? 'Actif' : 'Inactif'}
                                </span>
                            </div>
                            <div class="p-card__content">
                                <div class="row">
                                    <div class="col-6 u-align--center">
                                        <p class="p-heading--4">${strategy._count.signals}</p>
                                        <p class="p-text--small">Signaux</p>
                                    </div>
                                    <div class="col-6 u-align--center">
                                        <p class="p-heading--4">${strategy._count.orders}</p>
                                        <p class="p-text--small">Ordres</p>
                                    </div>
                                </div>
                                <hr class="p-rule">
                                <div class="u-align--right">
                                    <button class="p-button--base is-dense" onclick="editStrategy('${strategy.id}')">Éditer</button>
                                    <button class="p-button--negative is-dense" onclick="deleteStrategy('${strategy.id}')">Supprimer</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderSignalFilters(filters) {
        return `
            <div class="u-align--right">
                <select class="p-form-field__select" id="statusFilter" style="margin-right: 0.5rem;">
                    <option value="">Tous les statuts</option>
                    <option value="PENDING" ${filters.status === 'PENDING' ? 'selected' : ''}>En attente</option>
                    <option value="VALIDATED" ${filters.status === 'VALIDATED' ? 'selected' : ''}>Validés</option>
                    <option value="PROCESSED" ${filters.status === 'PROCESSED' ? 'selected' : ''}>Traités</option>
                    <option value="REJECTED" ${filters.status === 'REJECTED' ? 'selected' : ''}>Rejetés</option>
                </select>
                <input class="p-form-field__input" type="text" id="symbolFilter" placeholder="Symbole" value="${filters.symbol}" style="width: 100px; margin-right: 0.5rem;">
                <button class="p-button--base" id="applyFiltersBtn">Appliquer</button>
            </div>
        `;
    }

    renderSignalsTable(response) {
        const { data: signals, total } = response;
        
        if (signals.length === 0) {
            return `
                <div class="p-card">
                    <div class="p-card__content u-align--center">
                        <p class="p-text--default">Aucun signal trouvé</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="p-card">
                <div class="p-card__header">
                    <h4 class="p-card__title">Total: ${total} signaux</h4>
                </div>
                <div class="p-card__content">
                    <table class="p-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Stratégie</th>
                                <th>Action</th>
                                <th>Symbole</th>
                                <th>Prix</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${signals.map(signal => `
                                <tr>
                                    <td>${window.api.formatDate(signal.createdAt)}</td>
                                    <td>${signal.strategy?.name || 'N/A'}</td>
                                    <td><span class="p-label--${signal.action === 'buy' ? 'positive' : 'negative'}">${signal.action.toUpperCase()}</span></td>
                                    <td>${signal.symbol}</td>
                                    <td>${signal.price ? window.api.formatCurrency(signal.price) : 'Market'}</td>
                                    <td><span class="p-label--information">${signal.status}</span></td>
                                    <td>
                                        <button class="p-button--base is-dense" onclick="viewSignal('${signal.id}')">Voir</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderOrdersTable(response) {
        const { data: orders, total } = response;
        
        if (orders.length === 0) {
            return `
                <div class="p-card">
                    <div class="p-card__content u-align--center">
                        <p class="p-text--default">Aucun ordre trouvé</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="p-card">
                <div class="p-card__header">
                    <h4 class="p-card__title">Total: ${total} ordres</h4>
                </div>
                <div class="p-card__content">
                    <table class="p-table">
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Symbole</th>
                                <th>Lots</th>
                                <th>Prix</th>
                                <th>P&L</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map(order => `
                                <tr>
                                    <td>${order.ticket || 'N/A'}</td>
                                    <td>${window.api.formatDate(order.createdAt)}</td>
                                    <td><span class="p-label--${order.type.includes('BUY') ? 'positive' : 'negative'}">${order.type}</span></td>
                                    <td>${order.symbol}</td>
                                    <td>${order.lots}</td>
                                    <td>${order.openPrice ? window.api.formatCurrency(order.openPrice) : 'N/A'}</td>
                                    <td style="color: ${(order.profit || 0) >= 0 ? '#0e8420' : '#c7162b'}">${window.api.formatCurrency(order.profit)}</td>
                                    <td><span class="p-label--information">${order.status}</span></td>
                                    <td>
                                        ${order.status === 'PLACED' ? 
                                            `<button class="p-button--negative is-dense" onclick="closeOrder(${order.ticket})">Fermer</button>` :
                                            '<span>-</span>'
                                        }
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderRiskConfig(config) {
        return `
            <div class="p-card">
                <div class="p-card__header">
                    <h4 class="p-card__title">Configuration Globale</h4>
                </div>
                <div class="p-card__content">
                    <div class="p-form-validation">
                        <div class="p-form-validation__field">
                            <label for="maxDailyLoss" class="p-form-validation__label">Perte max journalière (%)</label>
                            <input class="p-form-validation__input" type="number" id="maxDailyLoss" value="${config.maxDailyLoss}" step="0.1">
                        </div>
                        <div class="p-form-validation__field">
                            <label for="maxWeeklyLoss" class="p-form-validation__label">Perte max hebdomadaire (%)</label>
                            <input class="p-form-validation__input" type="number" id="maxWeeklyLoss" value="${config.maxWeeklyLoss}" step="0.1">
                        </div>
                        <div class="p-form-validation__field">
                            <label for="maxTotalPositions" class="p-form-validation__label">Positions max totales</label>
                            <input class="p-form-validation__input" type="number" id="maxTotalPositions" value="${config.maxTotalPositions}">
                        </div>
                        <div class="p-form-validation__field">
                            <label for="maxLotSize" class="p-form-validation__label">Lot max par position</label>
                            <input class="p-form-validation__input" type="number" id="maxLotSize" value="${config.maxLotSize}" step="0.01">
                        </div>
                        <div class="p-form-validation__field">
                            <label for="defaultRiskPercent" class="p-form-validation__label">Risque par défaut (%)</label>
                            <input class="p-form-validation__input" type="number" id="defaultRiskPercent" value="${config.defaultRiskPercent}" step="0.1">
                        </div>
                        <div class="p-form-validation__field">
                            <label for="maxCorrelation" class="p-form-validation__label">Corrélation max</label>
                            <input class="p-form-validation__input" type="number" id="maxCorrelation" value="${config.maxCorrelation}" step="0.01" min="0" max="1">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderRiskMetrics(metrics) {
        if (!metrics.current) {
            return `
                <div class="p-card">
                    <div class="p-card__content u-align--center">
                        <p class="p-text--default">Aucune métrique de risque disponible</p>
                    </div>
                </div>
            `;
        }

        const current = metrics.current;
        return `
            <div class="p-card">
                <div class="p-card__header">
                    <h4 class="p-card__title">Métriques Actuelles</h4>
                </div>
                <div class="p-card__content">
                    <div class="row">
                        <div class="col-6 u-align--center">
                            <p class="p-heading--4">${window.api.formatCurrency(current.equity)}</p>
                            <p class="p-text--small">Equity</p>
                        </div>
                        <div class="col-6 u-align--center">
                            <p class="p-heading--4">${current.openPositions}</p>
                            <p class="p-text--small">Positions</p>
                        </div>
                    </div>
                    <hr class="p-rule">
                    <div class="row">
                        <div class="col-6 u-align--center">
                            <p class="p-heading--4">${current.totalExposure}</p>
                            <p class="p-text--small">Exposition (lots)</p>
                        </div>
                        <div class="col-6 u-align--center">
                            <p class="p-heading--4" style="color: ${current.dailyPnL >= 0 ? '#0e8420' : '#c7162b'}">${window.api.formatCurrency(current.dailyPnL)}</p>
                            <p class="p-text--small">P&L Journalier</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderLogsTable(response) {
        const { data: logs, total } = response;
        
        if (logs.length === 0) {
            return `
                <div class="p-card">
                    <div class="p-card__content u-align--center">
                        <p class="p-text--default">Aucun log trouvé</p>
                    </div>
                </div>
            `;
        }

        const severityColors = {
            'DEBUG': 'information',
            'INFO': 'information', 
            'WARNING': 'caution',
            'ERROR': 'negative',
            'CRITICAL': 'negative'
        };

        return `
            <div class="p-card">
                <div class="p-card__header">
                    <h4 class="p-card__title">Total: ${total} logs</h4>
                </div>
                <div class="p-card__content">
                    <table class="p-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Niveau</th>
                                <th>Action</th>
                                <th>Entité</th>
                                <th>Détails</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr>
                                    <td>${window.api.formatDate(log.createdAt)}</td>
                                    <td><span class="p-label--${severityColors[log.severity] || 'information'}">${log.severity}</span></td>
                                    <td>${log.action}</td>
                                    <td>${log.entityType}${log.entityId ? `:${log.entityId}` : ''}</td>
                                    <td title="${log.details}">${this.truncateDetails(log.details)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    truncateDetails(details, maxLength = 50) {
        if (!details) return '-';
        if (details.length <= maxLength) return details;
        return details.substring(0, maxLength) + '...';
    }

    // ==================== EVENT HANDLERS ====================

    attachStrategiesEvents() {
        document.getElementById('addStrategyBtn')?.addEventListener('click', () => {
            this.openStrategyModal();
        });
    }

    attachSignalsEvents() {
        document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
            const status = document.getElementById('statusFilter')?.value || '';
            const symbol = document.getElementById('symbolFilter')?.value || '';
            
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            if (symbol) params.set('symbol', symbol);
            
            this.navigateTo('signals', params.toString());
        });
    }

    attachOrdersEvents() {
        document.getElementById('closeAllOrdersBtn')?.addEventListener('click', async () => {
            if (!confirm('Fermer toutes les positions ouvertes ?')) return;
            
            try {
                await window.api.closeAllOrders();
                window.notifications.positive('Positions', 'Toutes les positions ont été fermées');
                this.loadOrdersPage('');
            } catch (error) {
                window.notifications.negative('Erreur', 'Impossible de fermer les positions');
            }
        });

        document.getElementById('refreshOrdersBtn')?.addEventListener('click', () => {
            this.loadOrdersPage('');
        });
    }

    attachRiskEvents() {
        document.getElementById('saveRiskConfigBtn')?.addEventListener('click', async () => {
            const config = this.gatherRiskConfig();
            
            try {
                await window.api.updateRiskConfig(config);
                window.notifications.positive('Configuration', 'Paramètres de risque sauvegardés');
            } catch (error) {
                window.notifications.negative('Erreur', 'Impossible de sauvegarder la configuration');
            }
        });
    }

    attachLogsEvents() {
        document.getElementById('severityFilter')?.addEventListener('change', (e) => {
            this.loadLogsPage(e.target.value);
        });
    }

    // ==================== MODAL & FORMS avec Vanilla Framework ====================

    openStrategyModal(strategy = null) {
        const isEdit = !!strategy;
        const title = isEdit ? 'Modifier la Stratégie' : 'Nouvelle Stratégie';
        
        const modalHTML = `
            <div class="p-modal" id="strategyModal" style="display: block;">
                <div class="p-modal__dialog">
                    <div class="p-modal__header">
                        <h2 class="p-modal__title">${title}</h2>
                        <button class="p-modal__close" onclick="closeModal('strategyModal')">Close</button>
                    </div>
                    <div class="p-form-validation">
                        <div class="p-form-validation__field">
                            <label for="strategyName" class="p-form-validation__label">Nom</label>
                            <input class="p-form-validation__input" type="text" id="strategyName" value="${strategy?.name || ''}" required>
                        </div>
                        <div class="p-form-validation__field">
                            <label for="strategyDescription" class="p-form-validation__label">Description</label>
                            <textarea class="p-form-validation__input" id="strategyDescription">${strategy?.description || ''}</textarea>
                        </div>
                        <div class="row">
                            <div class="col-6">
                                <div class="p-form-validation__field">
                                    <label for="maxDailyLoss" class="p-form-validation__label">Perte max journalière (%)</label>
                                    <input class="p-form-validation__input" type="number" id="maxDailyLoss" value="${strategy?.maxDailyLoss || 5}" step="0.1">
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-form-validation__field">
                                    <label for="maxPositions" class="p-form-validation__label">Positions max</label>
                                    <input class="p-form-validation__input" type="number" id="maxPositions" value="${strategy?.maxPositions || 1}">
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-6">
                                <div class="p-form-validation__field">
                                    <label for="maxLotSize" class="p-form-validation__label">Lot max</label>
                                    <input class="p-form-validation__input" type="number" id="maxLotSize" value="${strategy?.maxLotSize || 0.1}" step="0.01">
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="p-form-validation__field">
                                    <label for="defaultRiskPercent" class="p-form-validation__label">Risque par défaut (%)</label>
                                    <input class="p-form-validation__input" type="number" id="defaultRiskPercent" value="${strategy?.defaultRiskPercent || 1}" step="0.1">
                                </div>
                            </div>
                        </div>
                        <div class="p-form-validation__field">
                            <label for="allowedSymbols" class="p-form-validation__label">Symboles autorisés (séparés par des virgules)</label>
                            <input class="p-form-validation__input" type="text" id="allowedSymbols" value="${this.parseSymbols(strategy?.allowedSymbols)}">
                        </div>
                    </div>
                    <div class="p-modal__footer">
                        <button class="p-button--base" onclick="closeModal('strategyModal')">Annuler</button>
                        <button class="p-button--positive" onclick="saveStrategy(${isEdit ? `'${strategy.id}'` : 'null'})">${isEdit ? 'Modifier' : 'Créer'}</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    parseSymbols(allowedSymbols) {
        if (!allowedSymbols) return '';
        try {
            return JSON.parse(allowedSymbols).join(', ');
        } catch {
            return allowedSymbols;
        }
    }

    gatherRiskConfig() {
        return {
            maxDailyLoss: parseFloat(document.getElementById('maxDailyLoss')?.value || 5),
            maxWeeklyLoss: parseFloat(document.getElementById('maxWeeklyLoss')?.value || 10),
            maxTotalPositions: parseInt(document.getElementById('maxTotalPositions')?.value || 5),
            maxLotSize: parseFloat(document.getElementById('maxLotSize')?.value || 1),
            defaultRiskPercent: parseFloat(document.getElementById('defaultRiskPercent')?.value || 1),
            maxCorrelation: parseFloat(document.getElementById('maxCorrelation')?.value || 0.7)
        };
    }

    /**
     * Obtient la page courante
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * Vérifie si une page est active
     */
    isPageActive(page) {
        return this.currentPage === page;
    }
}

// ==================== GLOBAL FUNCTIONS ====================

/**
 * Ferme une modal avec Vanilla Framework
 */
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
};

/**
 * Sauvegarde une stratégie
 */
window.saveStrategy = async function(strategyId) {
    const formData = {
        name: document.getElementById('strategyName')?.value,
        description: document.getElementById('strategyDescription')?.value,
        maxDailyLoss: parseFloat(document.getElementById('maxDailyLoss')?.value),
        maxPositions: parseInt(document.getElementById('maxPositions')?.value),
        maxLotSize: parseFloat(document.getElementById('maxLotSize')?.value),
        defaultRiskPercent: parseFloat(document.getElementById('defaultRiskPercent')?.value),
        allowedSymbols: JSON.stringify(
            document.getElementById('allowedSymbols')?.value
                .split(',')
                .map(s => s.trim())
                .filter(s => s)
        )
    };

    try {
        if (strategyId) {
            await window.api.updateStrategy(strategyId, formData);
            window.notifications.positive('Stratégie', 'Stratégie modifiée avec succès');
        } else {
            await window.api.createStrategy(formData);
            window.notifications.positive('Stratégie', 'Stratégie créée avec succès');
        }
        
        window.closeModal('strategyModal');
        window.navigation.loadStrategiesPage();
        
    } catch (error) {
        window.notifications.negative('Erreur', error.message);
    }
};

/**
 * Édite une stratégie
 */
window.editStrategy = async function(strategyId) {
    try {
        const strategies = await window.api.getStrategies();
        const strategy = strategies.find(s => s.id === strategyId);
        if (strategy) {
            window.navigation.openStrategyModal(strategy);
        }
    } catch (error) {
        window.notifications.negative('Erreur', 'Impossible de charger la stratégie');
    }
};

/**
 * Supprime une stratégie
 */
window.deleteStrategy = async function(strategyId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette stratégie ?')) return;
    
    try {
        // TODO: Implémenter l'endpoint de suppression dans l'API
        window.notifications.positive('Stratégie', 'Stratégie supprimée');
        window.navigation.loadStrategiesPage();
    } catch (error) {
        window.notifications.negative('Erreur', 'Impossible de supprimer la stratégie');
    }
};

/**
 * Voir détails d'un signal
 */
window.viewSignal = function(signalId) {
    // TODO: Implémenter la vue détaillée du signal
    window.notifications.information('Signal', `Affichage du signal ${signalId}`);
};

/**
 * Fermer un ordre spécifique
 */
window.closeOrder = async function(ticket) {
    if (!confirm(`Fermer la position ${ticket} ?`)) return;
    
    try {
        await window.api.closeOrder(ticket);
        window.notifications.positive('Position', 'Position fermée avec succès');
        window.navigation.loadOrdersPage('');
    } catch (error) {
        window.notifications.negative('Erreur', 'Impossible de fermer la position');
    }
};

/**
 * Instance globale de navigation
 */
window.navigation = new Navigation();