/**
 * Utilitaires communs pour l'application Trading Monitor
 * Fonctions réutilisables pour le formatage, les calculs et les manipulations DOM
 */

class Utils {
    /**
     * Formatage des valeurs monétaires
     */
    static formatCurrency(value, currency = 'USD') {
        if (value === null || value === undefined) return '--';
        
        try {
            return new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);
        } catch (error) {
            console.error('Erreur formatage devise:', error);
            return `${value} ${currency}`;
        }
    }

    /**
     * Formatage des pourcentages
     */
    static formatPercentage(value, precision = 2) {
        if (value === null || value === undefined) return '--';
        
        try {
            return new Intl.NumberFormat('fr-FR', {
                style: 'percent',
                minimumFractionDigits: precision,
                maximumFractionDigits: precision
            }).format(value / 100);
        } catch (error) {
            console.error('Erreur formatage pourcentage:', error);
            return `${value}%`;
        }
    }

    /**
     * Formatage des nombres
     */
    static formatNumber(value, precision = 2) {
        if (value === null || value === undefined) return '--';
        
        try {
            return new Intl.NumberFormat('fr-FR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: precision
            }).format(value);
        } catch (error) {
            console.error('Erreur formatage nombre:', error);
            return value;
        }
    }

    /**
     * Formatage des dates
     */
    static formatDate(date, format = 'datetime') {
        if (!date) return '--';
        
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) return '--';
        
        try {
            switch (format) {
                case 'date':
                    return new Intl.DateTimeFormat('fr-FR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    }).format(dateObj);
                
                case 'time':
                    return new Intl.DateTimeFormat('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }).format(dateObj);
                
                case 'datetime':
                default:
                    return new Intl.DateTimeFormat('fr-FR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }).format(dateObj);
            }
        } catch (error) {
            console.error('Erreur formatage date:', error);
            return dateObj.toLocaleString();
        }
    }

    /**
     * Formatage du temps relatif (il y a X minutes)
     */
    static formatRelativeTime(date) {
        if (!date) return '--';
        
        const now = new Date();
        const dateObj = new Date(date);
        const diffMs = now - dateObj;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMinutes < 1) return 'À l\'instant';
        if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
        if (diffHours < 24) return `Il y a ${diffHours} h`;
        if (diffDays < 7) return `Il y a ${diffDays} j`;
        
        return this.formatDate(date, 'date');
    }

    /**
     * Calcul du P&L avec couleur
     */
    static formatProfitLoss(value, includeColor = true) {
        if (value === null || value === undefined) return { text: '--', color: 'neutral' };
        
        const formatted = this.formatCurrency(value);
        const color = value > 0 ? 'success' : value < 0 ? 'danger' : 'neutral';
        
        return includeColor ? { text: formatted, color } : formatted;
    }

    /**
     * Calculer le win rate
     */
    static calculateWinRate(wins, total) {
        if (total === 0) return 0;
        return (wins / total) * 100;
    }

    /**
     * Génération d'ID unique
     */
    static generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Débounce function
     */
    static debounce(func, delay = 300) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Throttle function
     */
    static throttle(func, limit = 100) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Validation email
     */
    static isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    /**
     * Validation nombre
     */
    static isValidNumber(value, min = null, max = null) {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        if (min !== null && num < min) return false;
        if (max !== null && num > max) return false;
        return true;
    }

    /**
     * Copier dans le presse-papiers
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Erreur copie presse-papiers:', error);
            return false;
        }
    }

    /**
     * Télécharger un fichier
     */
    static downloadFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Obtenir la couleur selon la valeur
     */
    static getValueColor(value, thresholds = { positive: 0, negative: 0 }) {
        if (value > thresholds.positive) return 'var(--success-color)';
        if (value < thresholds.negative) return 'var(--danger-color)';
        return 'var(--neutral-color)';
    }

    /**
     * Créer un élément DOM avec attributs
     */
    static createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        if (content) {
            element.textContent = content;
        }
        
        return element;
    }

    /**
     * Animation fade in/out
     */
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const startTime = performance.now();
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    }

    static fadeOut(element, duration = 300) {
        const startTime = performance.now();
        const startOpacity = parseFloat(element.style.opacity) || 1;
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = startOpacity * (1 - progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        }
        
        requestAnimationFrame(animate);
    }

    /**
     * Gestion du localStorage avec JSON
     */
    static saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Erreur sauvegarde localStorage:', error);
            return false;
        }
    }

    static loadFromStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Erreur chargement localStorage:', error);
            return defaultValue;
        }
    }

    /**
     * Gestion des erreurs
     */
    static handleError(error, context = 'Application') {
        console.error(`[${context}] Erreur:`, error);
        
        // Afficher une notification si disponible
        if (window.NotificationManager) {
            const message = error.message || 'Une erreur inattendue s\'est produite';
            window.NotificationManager.show(
                'Erreur',
                message,
                'error'
            );
        }
        
        // Log pour debugging
        if (window.CONFIG?.DEBUG) {
            console.trace('Stack trace:', error);
        }
    }

    /**
     * Validation des données de formulaire
     */
    static validateForm(formData, rules) {
        const errors = {};
        
        Object.entries(rules).forEach(([field, rule]) => {
            const value = formData[field];
            
            if (rule.required && (!value || value.toString().trim() === '')) {
                errors[field] = 'Ce champ est requis';
                return;
            }
            
            if (value && rule.type === 'email' && !this.isValidEmail(value)) {
                errors[field] = 'Email invalide';
                return;
            }
            
            if (value && rule.type === 'number') {
                if (!this.isValidNumber(value, rule.min, rule.max)) {
                    errors[field] = `Nombre invalide (${rule.min || 0} - ${rule.max || '∞'})`;
                    return;
                }
            }
            
            if (value && rule.minLength && value.length < rule.minLength) {
                errors[field] = `Minimum ${rule.minLength} caractères`;
                return;
            }
            
            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors[field] = `Maximum ${rule.maxLength} caractères`;
                return;
            }
        });
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Calculer les statistiques d'un tableau
     */
    static calculateStats(values) {
        if (!values || values.length === 0) {
            return { sum: 0, avg: 0, min: 0, max: 0, count: 0 };
        }
        
        const sum = values.reduce((acc, val) => acc + val, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return { sum, avg, min, max, count: values.length };
    }

    /**
     * Grouper un tableau par clé
     */
    static groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }

    /**
     * Trier un tableau par plusieurs critères
     */
    static sortBy(array, sortKey, direction = 'asc') {
        return [...array].sort((a, b) => {
            let aVal = a[sortKey];
            let bVal = b[sortKey];
            
            // Gestion des dates
            if (aVal instanceof Date || typeof aVal === 'string' && !isNaN(Date.parse(aVal))) {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }
            
            if (direction === 'desc') {
                return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
            } else {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            }
        });
    }

    /**
     * Pagination
     */
    static paginate(array, page = 1, pageSize = 10) {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        
        return {
            data: array.slice(startIndex, endIndex),
            pagination: {
                currentPage: page,
                pageSize,
                totalItems: array.length,
                totalPages: Math.ceil(array.length / pageSize),
                hasNext: endIndex < array.length,
                hasPrev: page > 1
            }
        };
    }

    /**
     * Filtre de recherche
     */
    static searchFilter(array, query, searchFields = []) {
        if (!query || query.trim() === '') return array;
        
        const searchTerm = query.toLowerCase();
        
        return array.filter(item => {
            return searchFields.some(field => {
                const value = item[field];
                return value && value.toString().toLowerCase().includes(searchTerm);
            });
        });
    }

    /**
     * Convertir un objet en paramètres URL
     */
    static objectToQueryString(obj) {
        const params = new URLSearchParams();
        
        Object.entries(obj).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });
        
        return params.toString();
    }

    /**
     * Détection du type de device
     */
    static getDeviceType() {
        const width = window.innerWidth;
        
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    }

    /**
     * Formater la taille de fichier
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Génération de couleurs aléatoires
     */
    static generateRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    /**
     * Convertir hex en rgba
     */
    static hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

// Export global
window.Utils = Utils;