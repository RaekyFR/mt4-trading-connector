// public/js/strategies.js

/**
 * Gestionnaire de la page des stratégies
 */
class StrategiesManager {
    constructor() {
        this.strategies = [];
        this.currentStrategy = null;
        this.isEditing = false;
        this.init();
    }

    async init() {
        await this.loadStrategies();
        this.render();
        this.attachEvents();
    }

    /**
     * Charge les stratégies depuis l'API
     */
    async loadStrategies() {
        try {
            this.strategies = await window.api.getStrategies();
        } catch (error) {
            console.error('[Strategies] Erreur chargement:', error);
            window.notifications.error('Erreur', 'Impossible de charger les stratégies');
            this.strategies = [];
        }
    }

    /**
     * Rendu de la page complète
     */
    render() {
        const mainContent = document.querySelector('main');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="p-strip">
                <div class="row">
                    <div class="col-8">
                        <h1 class="p-heading--2">Gestion des Stratégies</h1>
                        <p class="p-text--default">Créez et configurez vos stratégies de trading avec TradingView</p>
                    </div>
                    <div class="col-4 u-align--right">
                        <button class="p-button--positive" id="createStrategyBtn">
                            <i class="p-icon--plus"></i> Nouvelle Stratégie
                        </button>
                    </div>
                </div>
            </div>

            <div class="p-strip is-shallow">
                <div class="row">
                    <div class="col-12">
                        ${this.renderStrategiesList()}
                    </div>
                </div>
            </div>

            <!-- Modal de création/édition -->
            <div id="strategyModalContainer"></div>
        `;
    }

    /**
     * Rendu de la liste des stratégies
     */
    renderStrategiesList() {
        if (this.strategies.length === 0) {
            return `
                <div class="p-card">
                    <div class="p-card__content u-align--center">
                        <h4>Aucune stratégie configurée</h4>
                        <p class="p-text--default">Créez votre première stratégie pour commencer à recevoir des signaux TradingView</p>
                        <button class="p-button--positive" onclick="window.strategiesManager.openModal()">
                            Créer une stratégie
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="row">
                ${this.strategies.map(strategy => this.renderStrategyCard(strategy)).join('')}
            </div>
        `;
    }

    /**
     * Rendu d'une carte de stratégie
     */
    renderStrategyCard(strategy) {
        const tradingHours = this.parseTradingHours(strategy.tradingHours);
        const allowedSymbols = this.parseAllowedSymbols(strategy.allowedSymbols);
        
        return `
            <div class="col-6" data-strategy-id="${strategy.id}">
                <div class="p-card">
                    <div class="p-card__header">
                        <div class="row">
                            <div class="col-8">
                                <h4 class="p-card__title">${strategy.name}</h4>
                                <p class="p-text--small">${strategy.description || 'Aucune description'}</p>
                            </div>
                            <div class="col-4 u-align--right">
                                <span class="p-label--${strategy.isActive ? 'positive' : 'information'}">
                                    ${strategy.isActive ? 'Actif' : 'Inactif'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="p-card__content">
                        <!-- Statistiques -->
                        <div class="row">
                            <div class="col-4 u-align--center">
                                <p class="p-heading--4">${strategy._count?.signals || 0}</p>
                                <p class="p-text--small">Signaux</p>
                            </div>
                            <div class="col-4 u-align--center">
                                <p class="p-heading--4">${strategy._count?.orders || 0}</p>
                                <p class="p-text--small">Ordres</p>
                            </div>
                            <div class="col-4 u-align--center">
                                <p class="p-heading--4">${strategy.riskRewardRatio || 'N/A'}</p>
                                <p class="p-text--small">R:R Ratio</p>
                            </div>
                        </div>
                        
                        <hr class="p-rule">
                        
                        <!-- Configuration -->
                        <div class="row">
                            <div class="col-6">
                                <p class="p-text--small"><strong>Risque:</strong> ${strategy.defaultRiskPercent}%</p>
                                <p class="p-text--small"><strong>Lot max:</strong> ${strategy.maxLotSize}</p>
                                <p class="p-text--small"><strong>Perte max/jour:</strong> ${strategy.maxDailyLoss}%</p>
                            </div>
                            <div class="col-6">
                                <p class="p-text--small"><strong>Symboles:</strong></p>
                                <p class="p-text--small">${allowedSymbols.slice(0, 3).join(', ')}${allowedSymbols.length > 3 ? '...' : ''}</p>
                                <p class="p-text--small"><strong>Horaires:</strong> ${tradingHours.length} créneaux</p>
                            </div>
                        </div>
                        
                        <hr class="p-rule">
                        
                        <!-- Actions -->
                        <div class="u-align--right">
                            <button class="p-button--base is-dense" onclick="window.strategiesManager.viewDetails('${strategy.id}')">
                                Détails
                            </button>
                            <button class="p-button--positive is-dense" onclick="window.strategiesManager.editStrategy('${strategy.id}')">
                                Modifier
                            </button>
                            <button class="p-button--negative is-dense" onclick="window.strategiesManager.deleteStrategy('${strategy.id}')">
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Parse les heures de trading
     */
    parseTradingHours(tradingHours) {
        if (!tradingHours) return [];
        try {
            const parsed = JSON.parse(tradingHours);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    /**
     * Parse les symboles autorisés
     */
    parseAllowedSymbols(allowedSymbols) {
        if (!allowedSymbols) return [];
        try {
            return JSON.parse(allowedSymbols) || [];
        } catch {
            return [];
        }
    }

    /**
     * Ouvre la modal de création/édition
     */
    openModal(strategy = null) {
        this.currentStrategy = strategy;
        this.isEditing = !!strategy;
        
        const modalContainer = document.getElementById('strategyModalContainer');
        modalContainer.innerHTML = this.renderModal(strategy);
        
        // Initialiser les créneaux horaires
        this.initTimeSlots(strategy);
        
        // Afficher la modal
        const modal = document.getElementById('strategyModal');
        modal.style.display = 'block';
    }

    /**
     * Rendu de la modal complète
     */
    renderModal(strategy) {
        const title = this.isEditing ? 'Modifier la Stratégie' : 'Nouvelle Stratégie';
        const tradingDays = this.parseTradingDays(strategy?.tradingDays);
        
        return `
            <div class="p-modal" id="strategyModal">
                <div class="p-modal__dialog" style="max-width: 800px;">
                    <div class="p-modal__header">
                        <h2 class="p-modal__title">${title}</h2>
                        <button class="p-modal__close" onclick="window.strategiesManager.closeModal()">×</button>
                    </div>
                    <div class="p-modal__body">
                        <form id="strategyForm" class="p-form">
                            <!-- Informations générales -->
                            <fieldset>
                                <legend class="p-form__legend">Informations générales</legend>
                                
                                <div class="row">
                                    <div class="col-6">
                                        <div class="p-form__group">
                                            <label for="strategyName" class="p-form__label is-required">Nom de la stratégie</label>
                                            <input class="p-form__control" type="text" id="strategyName" 
                                                   value="${strategy?.name || ''}" required 
                                                   placeholder="Ex: FVG_ENTRY">
                                            <p class="p-form__help-text">Nom utilisé par TradingView dans le signal JSON</p>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="p-form__group">
                                            <label class="p-form__label">Statut</label>
                                            <label class="p-checkbox">
                                                <input type="checkbox" id="isActive" ${strategy?.isActive ? 'checked' : ''}>
                                                <span class="p-checkbox__label">Stratégie active</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="p-form__group">
                                    <label for="strategyDescription" class="p-form__label">Description</label>
                                    <textarea class="p-form__control" id="strategyDescription" rows="2"
                                              placeholder="Description de la stratégie...">${strategy?.description || ''}</textarea>
                                </div>
                            </fieldset>

                            <!-- Paramètres de risque -->
                            <fieldset>
                                <legend class="p-form__legend">Gestion des risques</legend>
                                
                                <div class="row">
                                    <div class="col-4">
                                        <div class="p-form__group">
                                            <label for="defaultRiskPercent" class="p-form__label is-required">Risque par trade (%)</label>
                                            <input class="p-form__control" type="number" id="defaultRiskPercent" 
                                                   value="${strategy?.defaultRiskPercent || 1}" step="0.1" min="0.1" max="10" required>
                                            <p class="p-form__help-text">% du capital à risquer par position</p>
                                        </div>
                                    </div>
                                    <div class="col-4">
                                        <div class="p-form__group">
                                            <label for="maxLotSize" class="p-form__label is-required">Lot maximum</label>
                                            <input class="p-form__control" type="number" id="maxLotSize" 
                                                   value="${strategy?.maxLotSize || 0.5}" step="0.01" min="0.01" required>
                                            <p class="p-form__help-text">Taille maximale par position</p>
                                        </div>
                                    </div>
                                    <div class="col-4">
                                        <div class="p-form__group">
                                            <label for="riskRewardRatio" class="p-form__label is-required">Risk/Reward Ratio</label>
                                            <input class="p-form__control" type="number" id="riskRewardRatio" 
                                                   value="${strategy?.riskRewardRatio || 2}" step="0.1" min="0.5" required>
                                            <p class="p-form__help-text">Ratio pour calcul du TP (ex: 2 = 1:2)</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-6">
                                        <div class="p-form__group">
                                            <label for="maxDailyLoss" class="p-form__label">Perte max journalière (%)</label>
                                            <input class="p-form__control" type="number" id="maxDailyLoss" 
                                                   value="${strategy?.maxDailyLoss || 3}" step="0.1" min="0">
                                            <p class="p-form__help-text">Arrêt si perte quotidienne atteinte</p>
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <div class="p-form__group">
                                            <label for="allowedSymbols" class="p-form__label is-required">Symboles autorisés</label>
                                            <input class="p-form__control" type="text" id="allowedSymbols" 
                                                   value="${this.parseAllowedSymbols(strategy?.allowedSymbols).join(', ')}" 
                                                   placeholder="EURUSD, GBPUSD, BTCUSD" required>
                                            <p class="p-form__help-text">Séparés par des virgules</p>
                                        </div>
                                    </div>
                                </div>
                            </fieldset>

                            <!-- Jours de trading -->
                            <fieldset>
                                <legend class="p-form__legend">Jours de trading</legend>
                                <div class="row" id="tradingDays">
                                    ${this.renderTradingDays(tradingDays)}
                                </div>
                            </fieldset>

                            <!-- Horaires de trading -->
                            <fieldset>
                                <legend class="p-form__legend">Créneaux horaires</legend>
                                <p class="p-form__help-text">Définissez les créneaux pendant lesquels la stratégie peut trader (format 24h)</p>
                                <div id="timeSlots">
                                    <!-- Les créneaux seront ajoutés ici -->
                                </div>
                                <button type="button" class="p-button--base" id="addTimeSlotBtn">
                                    <i class="p-icon--plus"></i> Ajouter un créneau
                                </button>
                            </fieldset>
                        </form>
                    </div>
                    <div class="p-modal__footer">
                        <button class="p-button--base" onclick="window.strategiesManager.closeModal()">Annuler</button>
                        <button class="p-button--positive" onclick="window.strategiesManager.saveStrategy()">
                            ${this.isEditing ? 'Modifier' : 'Créer'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rendu des jours de trading
     */
    renderTradingDays(selectedDays = {}) {
        const days = [
            { key: 'monday', label: 'Lundi' },
            { key: 'tuesday', label: 'Mardi' },
            { key: 'wednesday', label: 'Mercredi' },
            { key: 'thursday', label: 'Jeudi' },
            { key: 'friday', label: 'Vendredi' },
            { key: 'saturday', label: 'Samedi' },
            { key: 'sunday', label: 'Dimanche' }
        ];

        return days.map(day => `
            <div class="col-3">
                <label class="p-checkbox">
                    <input type="checkbox" name="tradingDay" value="${day.key}" 
                           ${selectedDays[day.key] ? 'checked' : ''}>
                    <span class="p-checkbox__label">${day.label}</span>
                </label>
            </div>
        `).join('');
    }

    /**
     * Parse les jours de trading
     */
    parseTradingDays(tradingDays) {
        if (!tradingDays) {
            // Par défaut: lundi à vendredi
            return {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
                sunday: false
            };
        }
        try {
            return JSON.parse(tradingDays);
        } catch {
            return {};
        }
    }

    /**
     * Initialise les créneaux horaires
     */
    initTimeSlots(strategy) {
        const timeSlots = this.parseTradingHours(strategy?.tradingHours);
        const container = document.getElementById('timeSlots');
        
        // Si aucun créneau, en ajouter un par défaut
        if (timeSlots.length === 0) {
            timeSlots.push({ start: '0800', end: '1700' });
        }
        
        timeSlots.forEach((slot, index) => {
            this.addTimeSlot(slot.start, slot.end);
        });
    }

    /**
     * Ajoute un créneau horaire
     */
    addTimeSlot(start = '0800', end = '1700') {
        const container = document.getElementById('timeSlots');
        const slotIndex = container.children.length;
        
        const slotHtml = `
            <div class="p-form__group time-slot" data-slot-index="${slotIndex}">
                <div class="row">
                    <div class="col-3">
                        <label class="p-form__label">Début</label>
                        <input class="p-form__control time-input" type="time" 
                               name="timeSlot[${slotIndex}][start]" value="${this.formatTimeForInput(start)}" required>
                    </div>
                    <div class="col-3">
                        <label class="p-form__label">Fin</label>
                        <input class="p-form__control time-input" type="time" 
                               name="timeSlot[${slotIndex}][end]" value="${this.formatTimeForInput(end)}" required>
                    </div>
                    <div class="col-6 u-align--right" style="padding-top: 2rem;">
                        <button type="button" class="p-button--negative is-dense" 
                                onclick="window.strategiesManager.removeTimeSlot(${slotIndex})">
                            Supprimer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', slotHtml);
    }

    /**
     * Supprime un créneau horaire
     */
    removeTimeSlot(slotIndex) {
        const slot = document.querySelector(`[data-slot-index="${slotIndex}"]`);
        if (slot) {
            slot.remove();
        }
        
        // Empêcher la suppression du dernier créneau
        const container = document.getElementById('timeSlots');
        if (container.children.length === 0) {
            this.addTimeSlot();
        }
    }

    /**
     * Formate l'heure pour l'input HTML5
     */
    formatTimeForInput(time) {
        if (!time) return '08:00';
        const str = time.toString().padStart(4, '0');
        return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
    }

    /**
     * Formate l'heure pour le stockage
     */
    formatTimeForStorage(timeInput) {
        return timeInput.replace(':', '');
    }

    /**
     * Sauvegarde la stratégie
     */
    async saveStrategy() {
        try {
            const formData = this.gatherFormData();
            
            // Validation
            if (!this.validateFormData(formData)) {
                return;
            }

            let result;
            if (this.isEditing) {
                result = await window.api.updateStrategy(this.currentStrategy.id, formData);
                window.notifications.success('Stratégie', 'Stratégie modifiée avec succès');
            } else {
                result = await window.api.createStrategy(formData);
                window.notifications.success('Stratégie', 'Stratégie créée avec succès');
            }

            this.closeModal();
            await this.loadStrategies();
            this.render();

        } catch (error) {
            console.error('[Strategies] Erreur sauvegarde:', error);
            window.notifications.error('Erreur', error.message || 'Impossible de sauvegarder la stratégie');
        }
    }

    /**
     * Collecte les données du formulaire
     */
    gatherFormData() {
        // Informations générales
        const formData = {
            name: document.getElementById('strategyName').value.trim(),
            description: document.getElementById('strategyDescription').value.trim(),
            isActive: document.getElementById('isActive').checked,
            defaultRiskPercent: parseFloat(document.getElementById('defaultRiskPercent').value),
            maxLotSize: parseFloat(document.getElementById('maxLotSize').value),
            riskRewardRatio: parseFloat(document.getElementById('riskRewardRatio').value),
            maxDailyLoss: parseFloat(document.getElementById('maxDailyLoss').value) || null
        };

        // Symboles autorisés
        const symbolsInput = document.getElementById('allowedSymbols').value;
        formData.allowedSymbols = JSON.stringify(
            symbolsInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s)
        );

        // Jours de trading
        const tradingDays = {};
        document.querySelectorAll('input[name="tradingDay"]').forEach(checkbox => {
            tradingDays[checkbox.value] = checkbox.checked;
        });
        formData.tradingDays = JSON.stringify(tradingDays);

        // Créneaux horaires
        const timeSlots = [];
        document.querySelectorAll('.time-slot').forEach(slot => {
            const startInput = slot.querySelector('input[name*="[start]"]');
            const endInput = slot.querySelector('input[name*="[end]"]');
            
            if (startInput && endInput && startInput.value && endInput.value) {
                timeSlots.push({
                    start: this.formatTimeForStorage(startInput.value),
                    end: this.formatTimeForStorage(endInput.value)
                });
            }
        });
        formData.tradingHours = JSON.stringify(timeSlots);

        return formData;
    }

    /**
     * Valide les données du formulaire
     */
    validateFormData(formData) {
        if (!formData.name) {
            window.notifications.error('Validation', 'Le nom de la stratégie est obligatoire');
            return false;
        }

        if (formData.defaultRiskPercent <= 0 || formData.defaultRiskPercent > 10) {
            window.notifications.error('Validation', 'Le risque par trade doit être entre 0.1% et 10%');
            return false;
        }

        if (formData.maxLotSize <= 0) {
            window.notifications.error('Validation', 'Le lot maximum doit être positif');
            return false;
        }

        if (formData.riskRewardRatio < 0.5) {
            window.notifications.error('Validation', 'Le Risk/Reward ratio doit être au moins 0.5');
            return false;
        }

        try {
            const symbols = JSON.parse(formData.allowedSymbols);
            if (!Array.isArray(symbols) || symbols.length === 0) {
                window.notifications.error('Validation', 'Au moins un symbole doit être autorisé');
                return false;
            }
        } catch {
            window.notifications.error('Validation', 'Format des symboles invalide');
            return false;
        }

        return true;
    }

    /**
     * Ferme la modal
     */
    closeModal() {
        const modal = document.getElementById('strategyModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentStrategy = null;
        this.isEditing = false;
    }

    /**
     * Édite une stratégie
     */
    async editStrategy(strategyId) {
        const strategy = this.strategies.find(s => s.id === strategyId);
        if (strategy) {
            this.openModal(strategy);
        } else {
            window.notifications.error('Erreur', 'Stratégie non trouvée');
        }
    }

    /**
     * Supprime une stratégie
     */
    async deleteStrategy(strategyId) {
        const strategy = this.strategies.find(s => s.id === strategyId);
        if (!strategy) {
            window.notifications.error('Erreur', 'Stratégie non trouvée');
            return;
        }

        const confirmed = confirm(`Êtes-vous sûr de vouloir supprimer la stratégie "${strategy.name}" ?\n\nCette action est irréversible.`);
        if (!confirmed) return;

        try {
            await window.api.deleteStrategy(strategyId);
            window.notifications.success('Stratégie', 'Stratégie supprimée avec succès');
            
            await this.loadStrategies();
            this.render();
            
        } catch (error) {
            console.error('[Strategies] Erreur suppression:', error);
            window.notifications.error('Erreur', 'Impossible de supprimer la stratégie');
        }
    }

    /**
     * Affiche les détails d'une stratégie
     */
    viewDetails(strategyId) {
        const strategy = this.strategies.find(s => s.id === strategyId);
        if (!strategy) {
            window.notifications.error('Erreur', 'Stratégie non trouvée');
            return;
        }

        // TODO: Implémenter une vue détaillée ou rediriger vers une page de détails
        window.notifications.info('Détails', `Affichage des détails de "${strategy.name}"`);
    }

    /**
     * Attache les événements
     */
    attachEvents() {
        // Bouton créer stratégie
        document.getElementById('createStrategyBtn')?.addEventListener('click', () => {
            this.openModal();
        });

        // Bouton ajouter créneau horaire (délégation d'événement)
        document.addEventListener('click', (e) => {
            if (e.target.id === 'addTimeSlotBtn') {
                e.preventDefault();
                this.addTimeSlot();
            }
        });

        // Fermeture modal au clic en dehors
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('strategyModal');
            if (modal && e.target === modal) {
                this.closeModal();
            }
        });

        // Échap pour fermer la modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    /**
     * Rafraîchit la page
     */
    async refresh() {
        await this.loadStrategies();
        this.render();
        this.attachEvents();
    }
}

// Initialisation globale
window.strategiesManager = new StrategiesManager();