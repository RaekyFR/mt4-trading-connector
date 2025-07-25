// js/components/notifications.js

/**
 * Système de notifications utilisant Vanilla Framework CSS
 */
class NotificationSystem {
    constructor(container = null) {
        this.container = container || document.getElementById('notifications');
        this.notifications = new Map();
        this.maxNotifications = 5;
        this.defaultDuration = 5000; // 5 secondes
        
        this.init();
    }

    init() {
        if (!this.container) {
            this.container = this.createContainer();
        }
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'notifications';
        container.style.cssText = 'position: fixed; top: 1rem; right: 1rem; z-index: 200; max-width: 400px;';
        document.body.appendChild(container);
        return container;
    }

    /**
     * Affiche une notification utilisant les classes Vanilla Framework
     */
    show(type = 'information', title = '', message = '', options = {}) {
        const id = this.generateId();
        const duration = options.duration !== undefined ? options.duration : this.defaultDuration;
        const persistent = options.persistent || false;
        const actions = options.actions || [];

        const notification = this.createNotification(id, type, title, message, actions);
        
        // Ajouter à la collection
        this.notifications.set(id, {
            element: notification,
            type,
            title,
            message,
            timestamp: new Date(),
            duration,
            persistent
        });

        // Ajouter au DOM avec animation
        this.container.appendChild(notification);
        
        // Animation d'entrée
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 10);

        // Limiter le nombre de notifications
        this.limitNotifications();

        // Auto-suppression si pas persistante
        if (!persistent && duration > 0) {
            setTimeout(() => this.hide(id), duration);
        }

        return id;
    }

    /**
     * Crée l'élément DOM de la notification avec classes Vanilla Framework
     */
    createNotification(id, type, title, message, actions) {
        const notification = document.createElement('div');
        
        // Mapper les types vers les classes Vanilla Framework
        const typeMap = {
            'success': 'positive',
            'error': 'negative', 
            'warning': 'caution',
            'info': 'information'
        };
        
        const vanillaType = typeMap[type] || 'information';
        
        notification.className = `p-notification--${vanillaType}`;
        notification.dataset.id = id;
        notification.style.cssText = `
            margin-bottom: 0.75rem;
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s ease-out;
            position: relative;
        `;

        const timestamp = new Date().toLocaleTimeString();

        let notificationHTML = `
            <div class="p-notification__content">
                <div class="row">
                    <div class="col-10">
                        <h5 class="p-notification__title">${title}</h5>
                        <p class="p-notification__message">${message}</p>
                        <p class="p-text--small u-text--muted">${timestamp}</p>
                    </div>
                    <div class="col-2">
                        <button class="p-button--base is-dense u-no-margin" data-action="close" style="float: right;">
                            ×
                        </button>
                    </div>
                </div>
        `;

        // Ajouter les actions si présentes
        if (actions.length > 0) {
            notificationHTML += `
                <div class="row">
                    <div class="col-12">
                        <div class="p-notification__actions" style="margin-top: 0.5rem;">
                            ${actions.map(action => 
                                `<button class="p-button--base is-dense" data-action="${action.id}" style="margin-right: 0.5rem;">
                                    ${action.label}
                                </button>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        notificationHTML += '</div>';
        notification.innerHTML = notificationHTML;

        // Gestionnaires d'événements
        this.attachEventListeners(notification, id, actions);

        return notification;
    }

    /**
     * Attache les gestionnaires d'événements
     */
    attachEventListeners(notification, id, actions) {
        // Fermeture
        const closeBtn = notification.querySelector('[data-action="close"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide(id);
            });
        }

        // Actions personnalisées
        actions.forEach(action => {
            const btn = notification.querySelector(`[data-action="${action.id}"]`);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof action.handler === 'function') {
                        action.handler(id);
                    }
                    if (action.dismissOnClick !== false) {
                        this.hide(id);
                    }
                });
            }
        });

        // Fermeture au clic si pas d'actions
        if (actions.length === 0) {
            notification.addEventListener('click', () => this.hide(id));
        }
    }

    /**
     * Cache une notification
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const element = notification.element;
        element.style.transform = 'translateX(100%)';
        element.style.opacity = '0';

        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    /**
     * Cache toutes les notifications
     */
    hideAll() {
        Array.from(this.notifications.keys()).forEach(id => this.hide(id));
    }

    /**
     * Limite le nombre de notifications affichées
     */
    limitNotifications() {
        const notificationIds = Array.from(this.notifications.keys());
        if (notificationIds.length > this.maxNotifications) {
            const toRemove = notificationIds.slice(0, notificationIds.length - this.maxNotifications);
            toRemove.forEach(id => this.hide(id));
        }
    }

    /**
     * Méthodes de raccourci utilisant la terminologie Vanilla Framework
     */
    success(title, message, options = {}) {
        return this.show('success', title, message, options);
    }

    error(title, message, options = {}) {
        return this.show('error', title, message, { ...options, duration: options.duration || 8000 });
    }

    warning(title, message, options = {}) {
        return this.show('warning', title, message, options);
    }

    info(title, message, options = {}) {
        return this.show('info', title, message, options);
    }

    // Alias pour correspondre aux classes Vanilla Framework
    positive(title, message, options = {}) {
        return this.success(title, message, options);
    }

    negative(title, message, options = {}) {
        return this.error(title, message, options);
    }

    caution(title, message, options = {}) {
        return this.warning(title, message, options);
    }

    information(title, message, options = {}) {
        return this.info(title, message, options);
    }

    /**
     * Notifications spéciales pour le trading
     */
    signalReceived(signal) {
        const message = `${signal.action.toUpperCase()} ${signal.symbol} @ ${signal.price || 'Market'}`;
        return this.information('Signal Reçu', message, {
            actions: [{
                id: 'view',
                label: 'Voir Détails',
                handler: () => window.location.hash = `#signals?id=${signal.id}`
            }]
        });
    }

    orderPlaced(order) {
        const message = `${order.type} ${order.symbol} - Lot: ${order.lots}`;
        return this.positive('Ordre Placé', message, {
            actions: [{
                id: 'view',
                label: 'Voir Ordre',
                handler: () => window.location.hash = `#orders?ticket=${order.ticket}`
            }]
        });
    }

    orderClosed(order) {
        const profit = order.profit || 0;
        const message = `${order.symbol} fermé - P&L: ${window.api.formatCurrency(profit)}`;
        
        return this.show(profit >= 0 ? 'success' : 'warning', 'Position Fermée', message);
    }

    riskLimitHit(limit) {
        const message = `Limite ${limit.type} atteinte: ${limit.value}`;
        return this.caution('Limite de Risque', message, {
            persistent: true,
            actions: [{
                id: 'settings',
                label: 'Paramètres',
                handler: () => window.location.hash = '#risk'
            }]
        });
    }

    connectionStatus(isConnected, component = 'MT4') {
        if (isConnected) {
            return this.positive('Connexion', `${component} connecté`);
        } else {
            return this.negative('Déconnexion', `${component} déconnecté`, {
                persistent: true,
                actions: [{
                    id: 'retry',
                    label: 'Reconnecter',
                    handler: () => {
                        window.api.restartSystem(component.toLowerCase())
                            .then(() => this.positive('Reconnexion', `${component} redémarré`))
                            .catch(err => this.negative('Erreur', `Impossible de redémarrer ${component}`));
                    }
                }]
            });
        }
    }

    /**
     * Génère un ID unique
     */
    generateId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Récupère une notification par ID
     */
    get(id) {
        return this.notifications.get(id);
    }

    /**
     * Récupère toutes les notifications
     */
    getAll() {
        return Array.from(this.notifications.values());
    }

    /**
     * Compte les notifications par type
     */
    count(type = null) {
        if (!type) return this.notifications.size;
        
        return Array.from(this.notifications.values())
            .filter(notification => notification.type === type)
            .length;
    }

    /**
     * Efface les notifications anciennes
     */
    cleanup(maxAge = 300000) { // 5 minutes
        const now = new Date();
        const toRemove = [];

        this.notifications.forEach((notification, id) => {
            if (!notification.persistent && (now - notification.timestamp) > maxAge) {
                toRemove.push(id);
            }
        });

        toRemove.forEach(id => this.hide(id));
    }
}

/**
 * Instance globale du système de notifications
 */
window.notifications = new NotificationSystem();

/**
 * Gestionnaire d'événements pour les notifications système
 */
document.addEventListener('DOMContentLoaded', () => {
    // Nettoyage automatique toutes les 5 minutes
    setInterval(() => {
        window.notifications.cleanup();
    }, 300000);
});

/**
 * Export pour utilisation en module
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationSystem;
}