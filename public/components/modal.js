/**
 * Gestionnaire de modales réutilisable
 * Permet d'afficher des modales avec différents types de contenu
 */

class ModalManager {
    constructor() {
        this.modals = new Map();
        this.activeModal = null;
        this.init();
    }

    /**
     * Initialiser le gestionnaire
     */
    init() {
        this.createOverlay();
        this.bindGlobalEvents();
    }

    /**
     * Créer l'overlay de fond
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'modal-overlay';
        this.overlay.className = 'modal-overlay';
        this.overlay.style.display = 'none';
        document.body.appendChild(this.overlay);

        // Fermer au clic sur l'overlay
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
    }

    /**
     * Événements globaux
     */
    bindGlobalEvents() {
        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close();
            }
        });
    }

    /**
     * Créer une nouvelle modale
     */
    create(id, options = {}) {
        const modal = {
            id,
            title: options.title || 'Modal',
            content: options.content || '',
            size: options.size || 'medium', // small, medium, large, full
            type: options.type || 'default', // default, confirm, form
            closeButton: options.closeButton !== false,
            closable: options.closable !== false,
            buttons: options.buttons || [],
            onOpen: options.onOpen || null,
            onClose: options.onClose || null,
            onConfirm: options.onConfirm || null,
            onCancel: options.onCancel || null
        };

        this.modals.set(id, modal);
        return modal;
    }

    /**
     * Afficher une modale
     */
    show(id, options = {}) {
        let modal = this.modals.get(id);
        
        if (!modal) {
            modal = this.create(id, options);
        } else {
            // Mettre à jour les options
            Object.assign(modal, options);
        }

        this.activeModal = modal;
        this.render(modal);
        this.open();

        // Callback d'ouverture
        if (modal.onOpen) {
            modal.onOpen(modal);
        }

        return modal;
    }

    /**
     * Render la modale
     */
    render(modal) {
        const modalElement = document.createElement('div');
        modalElement.className = `modal modal-${modal.size}`;
        modalElement.id = `modal-${modal.id}`;

        modalElement.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${modal.title}</h3>
                    ${modal.closeButton ? '<button class="modal-close" onclick="window.ModalManager.close()">×</button>' : ''}
                </div>
                <div class="modal-body">
                    ${modal.content}
                </div>
                ${modal.buttons.length > 0 ? this.renderButtons(modal.buttons) : ''}
            </div>
        `;

        // Vider l'overlay et ajouter la nouvelle modale
        this.overlay.innerHTML = '';
        this.overlay.appendChild(modalElement);

        // Événements spécifiques à la modale
        this.bindModalEvents(modalElement, modal);
    }

    /**
     * Render des boutons
     */
    renderButtons(buttons) {
        return `
            <div class="modal-footer">
                ${buttons.map(button => `
                    <button class="btn btn-${button.type || 'secondary'}" 
                            onclick="window.ModalManager.handleButtonClick('${button.id}')">
                        ${button.label}
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Événements spécifiques à la modale
     */
    bindModalEvents(modalElement, modal) {
        // Empêcher la fermeture du clic sur le contenu
        modalElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Gestion des formulaires
        const forms = modalElement.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit(form, modal);
            });
        });
    }

    /**
     * Ouvrir l'overlay
     */
    open() {
        this.overlay.style.display = 'flex';
        document.body.classList.add('modal-open');
        
        // Animation d'ouverture
        requestAnimationFrame(() => {
            this.overlay.classList.add('modal-open');
        });
    }

    /**
     * Fermer la modale
     */
    close() {
        if (!this.activeModal) return;

        const modal = this.activeModal;
        
        // Callback de fermeture
        if (modal.onClose) {
            const shouldClose = modal.onClose(modal);
            if (shouldClose === false) return;
        }

        // Animation de fermeture
        this.overlay.classList.remove('modal-open');
        
        setTimeout(() => {
            this.overlay.style.display = 'none';
            this.overlay.innerHTML = '';
            document.body.classList.remove('modal-open');
            this.activeModal = null;
        }, 300);
    }

    /**
     * Gérer le clic sur un bouton
     */
    handleButtonClick(buttonId) {
        if (!this.activeModal) return;

        const modal = this.activeModal;
        const button = modal.buttons.find(b => b.id === buttonId);
        if (!button) return;

        // Exécuter le handler du bouton
        if (button.handler) {
            const result = button.handler(modal);
            
            // Fermer automatiquement si le handler retourne true
            if (result === true || button.autoClose !== false) {
                this.close();
            }
        } else {
            // Comportement par défaut
            if (buttonId === 'confirm' && modal.onConfirm) {
                modal.onConfirm(modal);
            } else if (buttonId === 'cancel' && modal.onCancel) {
                modal.onCancel(modal);
            }
            
            this.close();
        }
    }

    /**
     * Gérer la soumission de formulaire
     */
    handleFormSubmit(form, modal) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        if (modal.onConfirm) {
            const result = modal.onConfirm(data, modal);
            if (result !== false) {
                this.close();
            }
        }
    }

    /**
     * Modale de confirmation
     */
    confirm(title, message, onConfirm, onCancel = null) {
        const id = Utils.generateId('confirm');
        
        return this.show(id, {
            title,
            content: `<p>${message}</p>`,
            type: 'confirm',
            size: 'small',
            buttons: [
                {
                    id: 'cancel',
                    label: 'Annuler',
                    type: 'secondary',
                    handler: onCancel
                },
                {
                    id: 'confirm',
                    label: 'Confirmer',
                    type: 'primary',
                    handler: onConfirm
                }
            ]
        });
    }

    /**
     * Modale d'alerte
     */
    alert(title, message, type = 'info') {
        const id = Utils.generateId('alert');
        
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        const icon = icons[type] || icons.info;
        
        return this.show(id, {
            title,
            content: `
                <div class="alert alert-${type}">
                    <span class="alert-icon">${icon}</span>
                    <p>${message}</p>
                </div>
            `,
            size: 'small',
            buttons: [
                {
                    id: 'ok',
                    label: 'OK',
                    type: 'primary'
                }
            ]
        });
    }

    /**
     * Modale de formulaire
     */
    form(title, fields, onSubmit, onCancel = null) {
        const id = Utils.generateId('form');
        
        const formHTML = `
            <form id="modal-form-${id}">
                ${fields.map(field => this.renderFormField(field)).join('')}
            </form>
        `;

        return this.show(id, {
            title,
            content: formHTML,
            type: 'form',
            buttons: [
                {
                    id: 'cancel',
                    label: 'Annuler',
                    type: 'secondary',
                    handler: onCancel
                },
                {
                    id: 'submit',
                    label: 'Enregistrer',
                    type: 'primary',
                    handler: () => {
                        const form = document.getElementById(`modal-form-${id}`);
                        if (form) {
                            const formData = new FormData(form);
                            const data = Object.fromEntries(formData);
                            
                            if (onSubmit) {
                                return onSubmit(data);
                            }
                        }
                        return true;
                    }
                }
            ]
        });
    }

    /**
     * Render un champ de formulaire
     */
    renderFormField(field) {
        const { type, name, label, value, required, options, placeholder } = field;
        
        let fieldHTML = '';
        
        switch (type) {
            case 'text':
            case 'email':
            case 'number':
            case 'password':
                fieldHTML = `
                    <input type="${type}" 
                           name="${name}" 
                           value="${value || ''}" 
                           placeholder="${placeholder || ''}"
                           ${required ? 'required' : ''}>
                `;
                break;
                
            case 'textarea':
                fieldHTML = `
                    <textarea name="${name}" 
                              placeholder="${placeholder || ''}"
                              ${required ? 'required' : ''}>${value || ''}</textarea>
                `;
                break;
                
            case 'select':
                fieldHTML = `
                    <select name="${name}" ${required ? 'required' : ''}>
                        ${options.map(option => `
                            <option value="${option.value}" ${option.value === value ? 'selected' : ''}>
                                ${option.label}
                            </option>
                        `).join('')}
                    </select>
                `;
                break;
                
            case 'checkbox':
                fieldHTML = `
                    <label class="checkbox-label">
                        <input type="checkbox" name="${name}" ${value ? 'checked' : ''}>
                        <span class="checkbox-text">${label}</span>
                    </label>
                `;
                break;
        }
        
        if (type === 'checkbox') {
            return `<div class="form-group">${fieldHTML}</div>`;
        }
        
        return `
            <div class="form-group">
                <label for="${name}">${label}</label>
                ${fieldHTML}
            </div>
        `;
    }

    /**
     * Modale de loading
     */
    loading(title = 'Chargement...', message = 'Veuillez patienter') {
        const id = 'loading';
        
        return this.show(id, {
            title,
            content: `
                <div class="loading-content">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `,
            size: 'small',
            closeButton: false,
            closable: false
        });
    }

    /**
     * Fermer la modale de loading
     */
    closeLoading() {
        if (this.activeModal && this.activeModal.id === 'loading') {
            this.close();
        }
    }

    /**
     * Détruire une modale
     */
    destroy(id) {
        this.modals.delete(id);
        
        if (this.activeModal && this.activeModal.id === id) {
            this.close();
        }
    }

    /**
     * Vérifier si une modale est ouverte
     */
    isOpen() {
        return this.activeModal !== null;
    }

    /**
     * Obtenir la modale active
     */
    getActive() {
        return this.activeModal;
    }
}

// Instance globale
window.ModalManager = new ModalManager();