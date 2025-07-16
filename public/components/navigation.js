/**
 * Composant de navigation principal
 * Gère le menu latéral et la navigation entre les pages
 */

class NavigationComponent {
    constructor() {
        this.isCollapsed = false;
        this.currentPage = this.getCurrentPage();
        this.menuItems = [
            {
                id: 'dashboard',
                title: 'Dashboard',
                url: '/index.html',
                icon: '📊',
                description: 'Vue d\'ensemble du système'
            },
            {
                id: 'strategies',
                title: 'Stratégies',
                url: '/pages/strategies.html',
                icon: '🎯',
                description: 'Gestion des stratégies de trading'
            },
            {
                id: 'signals',
                title: 'Signaux',
                url: '/pages/signals.html',
                icon: '📡',
                description: 'Historique des signaux TradingView'
            },
            {
                id: 'orders',
                title: 'Ordres',
                url: '/pages/orders.html',
                icon: '📋',
                description: 'Journal des ordres MT4'
            },
            {
                id: 'risk',
                title: 'Risk Management',
                url: '/pages/risk.html',
                icon: '🛡️',
                description: 'Configuration du risk management'
            },
            {
                id: 'logs',
                title: 'Logs',
                url: '/pages/logs.html',
                icon: '📝',
                description: 'Logs système et audit'
            }
        ];
    }

    /**
     * Obtenir la page courante depuis l'URL
     */
    getCurrentPage() {
        const path = window.location.pathname;
        
        if (path === '/' || path.endsWith('/index.html')) return 'dashboard';
        if (path.includes('/strategies.html')) return 'strategies';
        if (path.includes('/signals.html')) return 'signals';
        if (path.includes('/orders.html')) return 'orders';
        if (path.includes('/risk.html')) return 'risk';
        if (path.includes('/logs.html')) return 'logs';
        
        return 'dashboard';
    }

    /**
     * Render du composant navigation
     */
    render() {
        const navHTML = `
            <nav class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <div class="logo">
                        <span class="logo-icon">⚡</span>
                        <span class="logo-text">TradingMonitor</span>
                    </div>
                    <button class="sidebar-toggle" id="sidebarToggle">
                        <span class="toggle-icon">☰</span>
                    </button>
                </div>
                
                <div class="sidebar-content">
                    <ul class="nav-menu">
                        ${this.menuItems.map(item => this.renderMenuItem(item)).join('')}
                    </ul>
                </div>
                
                <div class="sidebar-footer">
                    <div class="system-status" id="systemStatus">
                        <div class="status-indicator">
                            <span class="status-dot" id="statusDot"></span>
                            <span class="status-text" id="statusText">Chargement...</span>
                        </div>
                        <div class="status-details" id="statusDetails"></div>
                    </div>
                </div>
            </nav>
        `;
        
        return navHTML;
    }

    /**
     * Render d'un élément de menu
     */
    renderMenuItem(item) {
        const isActive = this.currentPage === item.id;
        const activeClass = isActive ? 'active' : '';
        
        return `
            <li class="nav-item">
                <a href="${item.url}" class="nav-link ${activeClass}" data-page="${item.id}">
                    <span class="nav-icon">${item.icon}</span>
                    <span class="nav-text">${item.title}</span>
                    <span class="nav-tooltip">${item.description}</span>
                </a>
            </li>
        `;
    }

    /**
     * Initialiser les événements
     */
    initEvents() {
        // Toggle sidebar
        const toggleBtn = document.getElementById('sidebarToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // Optionnel : gestion SPA si nécessaire
                this.handleNavClick(e);
            });
        });

        // Responsive
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Démarrer la surveillance du statut système
        this.startSystemStatusMonitoring();
    }

    /**
     * Toggle du sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
        
        // Sauvegarder l'état
        Utils.saveToStorage('sidebar-collapsed', this.isCollapsed);
    }

    /**
     * Gestion du clic sur navigation
     */
    handleNavClick(event) {
        const link = event.target.closest('.nav-link');
        if (!link) return;
        
        // Retirer active de tous les liens
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        // Ajouter active au lien cliqué
        link.classList.add('active');
        
        // Mettre à jour la page courante
        this.currentPage = link.dataset.page;
    }

    /**
     * Gestion du responsive
     */
    handleResize() {
        const sidebar = document.getElementById('sidebar');
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            sidebar.classList.add('mobile');
            // Fermer automatiquement sur mobile
            if (!this.isCollapsed) {
                this.toggleSidebar();
            }
        } else {
            sidebar.classList.remove('mobile');
            // Restaurer l'état sauvegardé
            const savedState = Utils.loadFromStorage('sidebar-collapsed', false);
            if (savedState !== this.isCollapsed) {
                this.toggleSidebar();
            }
        }
    }

    /**
     * Surveillance du statut système
     */
    async startSystemStatusMonitoring() {
        const updateStatus = async () => {
            try {
                const response = await window.apiClient.getSystemStatus();
                if (response.success) {
                    this.updateSystemStatus(response.data);
                }
            } catch (error) {
                console.error('Erreur statut système:', error);
                this.updateSystemStatus(null);
            }
        };
        
        // Première mise à jour
        updateStatus();
        
        // Mise à jour périodique
        setInterval(updateStatus, window.CONFIG.POLLING_INTERVALS.SYSTEM_STATUS);
    }

    /**
     * Mise à jour de l'affichage du statut
     */
    updateSystemStatus(status) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const statusDetails = document.getElementById('statusDetails');
        
        if (!status) {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Déconnecté';
            statusDetails.innerHTML = '<small>Serveur inaccessible</small>';
            return;
        }
        
        // Déterminer le statut global
        const isHealthy = status.mt4Connected && status.status === 'running';
        statusDot.className = `status-dot ${isHealthy ? 'online' : 'warning'}`;
        statusText.textContent = isHealthy ? 'En ligne' : 'Problème';
        
        // Détails du statut
        const details = [];
        if (status.mt4Connected) {
            details.push('✅ MT4 connecté');
        } else {
            details.push('❌ MT4 déconnecté');
        }
        
        if (status.signalProcessor.running) {
            details.push(`📡 ${status.signalProcessor.pendingSignals} signaux en attente`);
        }
        
        if (status.positions.open > 0) {
            details.push(`📊 ${status.positions.open} position(s) ouverte(s)`);
        }
        
        statusDetails.innerHTML = `<small>${details.join('<br>')}</small>`;
    }

    /**
     * Mettre à jour le badge d'un menu
     */
    updateMenuBadge(menuId, count) {
        const navLink = document.querySelector(`[data-page="${menuId}"]`);
        if (!navLink) return;
        
        // Supprimer l'ancien badge
        const oldBadge = navLink.querySelector('.nav-badge');
        if (oldBadge) {
            oldBadge.remove();
        }
        
        // Ajouter le nouveau badge si count > 0
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.textContent = count > 99 ? '99+' : count;
            navLink.appendChild(badge);
        }
    }

    /**
     * Initialiser le composant
     */
    init() {
        // Restaurer l'état du sidebar
        const savedState = Utils.loadFromStorage('sidebar-collapsed', false);
        this.isCollapsed = savedState;
        
        // Initialiser les événements
        this.initEvents();
        
        // Appliquer l'état initial
        if (this.isCollapsed) {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.add('collapsed');
        }
        
        // Responsive initial
        this.handleResize();
    }
}

// Export global
window.NavigationComponent = NavigationComponent;