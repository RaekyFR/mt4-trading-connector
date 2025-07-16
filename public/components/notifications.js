/**
 * Gestionnaire de notifications toast
 * Affiche des notifications temporaires avec différents types
 */

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.maxNotifications = window.CONFIG.NOTIFICATIONS.MAX_NOTIFICATIONS;
        this.defaultDuration = window.CONFIG.NOTIFICATIONS.DURATION;
        this.container = null;
        this.init();
    }

    /**
     * Initialiser le gestionnaire
     */
    init() {
        this.createContainer();
        this.loadSavedNotifications();
    }

    /**
     * Créer le conteneur des notifications
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    /**
     * Afficher une notification
     */
    show(title, message, type = 'info', duration = null, actions = []) {
        const notification = {
            id: Utils.generateId('notification'),
            title,
            message,
            type,
            duration: duration || this.defaultDuration,
            actions,
            timestamp: new Date()
        };

        this.addNotification(notification);
        return notification.id;
    }

    /**
     * Ajouter une notification
     */
    addNotification(notification) {
        // Limiter le nombre de notifications
        if (this.notifications.length >= this.maxNotifications) {
            this.removeOldestNotification();
        }

        this.notifications.push(notification);
        this.renderNotification(notification);
        this.saveNotifications();

        // Auto-remove après la durée spécifiée
        if (notification.duration > 0) {
            setTimeout(() => {
                this.remove(notification.id);
            }, notification.duration);
        }
    }

    /**
     * Render une notification
     */
    renderNotification(notification) {
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification notification-${notification.type}`;
        notificationElement.id = notification.id;
        notificationElement.setAttribute('data-notification-id', notification.id);

        const iconMap = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const icon = iconMap[notification.type] || 'ℹ️';
        
        notificationElement.innerHTML = `
            <div class="notification-content">
                <div class="notification-header">
                    <span class="notification-icon">${icon}</span>
                    <span class="notification-title">${notification.title}</span>
                    <button class="notification-close" onclick="window.NotificationManager.remove('${notification.id}')">×</button>
                </div>
                <div class="notification-body">
                    <p class="notification-message">${notification.message}</p>
                    ${notification.actions.length > 0 ? this.renderActions(notification.actions, notification.id) : ''}
                </div>
            </div>
            <div class="notification-progress" id="progress-${notification.id}"></div>
        `;

        // Animation d'entrée
        notificationElement.style.opacity = '0';
        notificationElement.style.transform = 'translateX(100%)';
        
        this.container.appendChild(notificationElement);

        // Trigger animation
        requestAnimationFrame(() => {
            notificationElement.style.opacity = '1';
            notificationElement.style.transform = 'translateX(0)';
        });

        // Barre de progression
        if (notification.duration > 0) {
            this.startProgressBar(notification.id, notification.duration);
        }

        // Gestion des clics
        this.addNotificationEvents(notificationElement, notification);
    }

    /**
     * Render des actions
     */
    renderActions(actions, notificationId) {
        return `
            <div class="notification-actions">
                ${actions.map(action => `
                    <button class="notification-action" 
                            onclick="window.NotificationManager.handleAction('${notificationId}', '${action.id}')">
                        ${action.label}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Ajouter les événements à une notification
     */
    addNotificationEvents(element, notification) {
        // Pause sur hover
        element.addEventListener('mouseenter', () => {
            this.pauseProgressBar(notification.id);
        });

        element.addEventListener('mouseleave', () => {
            this.resumeProgressBar(notification.id);
        });

        // Clic pour fermer
        element.addEventListener('click', (e) => {
            if (e.target.classList.contains('notification-close')) {
                return; // Géré par le onclick
            }
            
            // Fermer au clic si pas d'actions
            if (notification.actions.length === 0) {
                this.remove(notification.id);
            }
        });
    }

    /**
     * Barre de progression
     */
    startProgressBar(notificationId, duration) {
        const progressBar = document.getElementById(`progress-${notificationId}`);
        if (!progressBar) return;

        progressBar.style.width = '100%';
        progressBar.style.transition = `width ${duration}ms linear`;
        
        // Démarrer l'animation
        requestAnimationFrame(() => {
            progressBar.style.width = '0%';
        });
    }

    pauseProgressBar(notificationId) {
        const progressBar = document.getElementById(`progress-${notificationId}`);
        if (!progressBar) return;

        const computedStyle = window.getComputedStyle(progressBar);
        const currentWidth = computedStyle.width;
        
        progressBar.style.width = currentWidth;
        progressBar.style.transition = 'none';
    }

    resumeProgressBar(notificationId) {
        const progressBar = document.getElementById(`progress-${notificationId}`);
        if (!progressBar) return;

        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        const currentWidth = parseFloat(progressBar.style.width);
        const remainingTime = (currentWidth / 100) * notification.duration;

        progressBar.style.transition = `width ${remainingTime}ms linear`;
        progressBar.style.width = '0%';
    }

    /**
     * Supprimer une notification
     */
    remove(notificationId) {
        const element = document.getElementById(notificationId);
        if (!element) return;

        // Animation de sortie
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';

        setTimeout(() => {
            element.remove();
        }, 300);

        // Retirer du tableau
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.saveNotifications();
    }

    /**
     * Supprimer la plus ancienne notification
     */
    removeOldestNotification() {
        if (this.notifications.length === 0) return;
        
        const oldest = this.notifications[0];
        this.remove(oldest.id);
    }

    /**
     * Vider toutes les notifications
     */
    clear() {
        this.notifications.forEach(notification => {
            this.remove(notification.id);
        });
        this.notifications = [];
        this.saveNotifications();
    }

    /**
     * Gérer les actions des notifications
     */
    handleAction(notificationId, actionId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        const action = notification.actions.find(a => a.id === actionId);
        if (!action) return;

        // Exécuter l'action
        if (typeof action.handler === 'function') {
            action.handler();
        }

        // Fermer la notification après action
        this.remove(notificationId);
    }

    /**
     * Sauvegarder les notifications
     */
    saveNotifications() {
        const notificationsToSave = this.notifications.map(n => ({
            ...n,
            timestamp: n.timestamp.toISOString()
        }));
        
        Utils.saveToStorage('notifications', notificationsToSave);
    }

    /**
     * Charger les notifications sauvegardées
     */
    loadSavedNotifications() {
        const saved = Utils.loadFromStorage('notifications', []);
        
        // Filtrer les notifications trop anciennes (> 1 heure)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        this.notifications = saved
            .filter(n => new Date(n.timestamp) > oneHourAgo)
            .map(n => ({
                ...n,
                timestamp: new Date(n.timestamp)
            }));
    }

    /**
     * Méthodes de convenance
     */
    success(title, message, duration = null) {
        return this.show(title, message, 'success', duration);
    }

    error(title, message, duration = null) {
        return this.show(title, message, 'error', duration);
    }

    warning(title, message, duration = null) {
        return this.show(title, message, 'warning', duration);
    }

    info(title, message, duration = null) {
        return this.show(title, message, 'info', duration);
    }

    /**
     * Notification avec action
     */
    confirm(title, message, onConfirm, onCancel = null) {
        const actions = [
            {
                id: 'confirm',
                label: 'Confirmer',
                handler: onConfirm
            },
            {
                id: 'cancel',
                label: 'Annuler',
                handler: onCancel || (() => {})
            }
        ];

        return this.show(title, message, 'warning', 0, actions);
    }

    /**
     * Notification de trading
     */
    tradingNotification(type, symbol, action, details = {}) {
        const messages = {
            signal_received: `Signal ${action} reçu pour ${symbol}`,
            order_placed: `Ordre ${action} placé sur ${symbol}`,
            order_filled: `Ordre ${action} exécuté sur ${symbol}`,
            order_closed: `Position ${symbol} fermée`,
            risk_limit: `Limite de risque atteinte`,
            system_error: `Erreur système`
        };

        const message = messages[type] || `Événement ${type} sur ${symbol}`;
        
        // Ajouter les détails si disponibles
        let detailsText = '';
        if (details.profit) {
            const profitFormatted = Utils.formatCurrency(details.profit);
            detailsText += `\nProfit: ${profitFormatted}`;
        }
        if (details.price) {
            detailsText += `\nPrix: ${details.price}`;
        }
        if (details.lots) {
            detailsText += `\nLots: ${details.lots}`;
        }

        const notificationType = type.includes('error') || type.includes('risk') ? 'error' : 
                               type.includes('filled') || type.includes('closed') ? 'success' : 'info';

        return this.show('Trading', message + detailsText, notificationType);
    }

    /**
     * Notification système
     */
    systemNotification(status, message, details = {}) {
        const statusMap = {
            connected: 'success',
            disconnected: 'error',
            warning: 'warning',
            info: 'info'
        };

        const type = statusMap[status] || 'info';
        const title = status === 'connected' ? 'Système connecté' :
                     status === 'disconnected' ? 'Système déconnecté' :
                     'Système';

        return this.show(title, message, type);
    }

    /**
     * Obtenir les statistiques des notifications
     */
    getStats() {
        const stats = {
            total: this.notifications.length,
            byType: {},
            recent: 0
        };

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        this.notifications.forEach(notification => {
            // Par type
            stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
            
            // Récentes
            if (notification.timestamp > fiveMinutesAgo) {
                stats.recent++;
            }
        });

        return stats;
    }
}

// Instance globale
window.NotificationManager = new NotificationManager();