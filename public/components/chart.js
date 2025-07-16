/**
 * Composants de graphiques pour Trading Monitor
 * Utilise Chart.js pour les graphiques temps réel
 */

/**
 * Classe de base pour tous les graphiques
 */
class BaseChart {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.chart = null;
        this.data = [];
        this.options = options;
        this.isDestroyed = false;
        
        this.init();
    }

    /**
     * Initialiser le graphique
     */
    init() {
        // Obtenir les couleurs du thème
        this.themeColors = this.getThemeColors();
        
        // Créer le graphique
        this.createChart();
        
        // Écouter les changements de thème
        window.addEventListener('themeChange', () => {
            this.updateTheme();
        });
    }

    /**
     * Obtenir les couleurs du thème actuel
     */
    getThemeColors() {
        if (window.ThemeManager) {
            const themeManager = new window.ThemeManager();
            return themeManager.getChartColors();
        }
        
        // Fallback colors
        return {
            primary: '#00d4aa',
            secondary: '#246cf9',
            success: '#00c851',
            warning: '#ffbb33',
            danger: '#ff4444',
            info: '#33b5e5',
            grid: '#404040',
            text: '#b0b0b0',
            background: '#2d2d2d'
        };
    }

    /**
     * Obtenir les options par défaut
     */
    getDefaultOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: this.themeColors.text,
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: this.themeColors.background,
                    titleColor: this.themeColors.text,
                    bodyColor: this.themeColors.text,
                    borderColor: this.themeColors.grid,
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: true,
                        color: this.themeColors.grid,
                        lineWidth: 1
                    },
                    ticks: {
                        color: this.themeColors.text,
                        font: {
                            size: 11
                        }
                    },
                    border: {
                        color: this.themeColors.grid
                    }
                },
                y: {
                    display: true,
                    grid: {
                        display: true,
                        color: this.themeColors.grid,
                        lineWidth: 1
                    },
                    ticks: {
                        color: this.themeColors.text,
                        font: {
                            size: 11
                        }
                    },
                    border: {
                        color: this.themeColors.grid
                    }
                }
            },
            animation: {
                duration: 500,
                easing: 'easeInOutQuart'
            }
        };
    }

    /**
     * Créer le graphique (à implémenter dans les classes enfants)
     */
    createChart() {
        throw new Error('createChart() doit être implémenté');
    }

    /**
     * Mettre à jour le thème
     */
    updateTheme() {
        if (this.isDestroyed) return;
        
        this.themeColors = this.getThemeColors();
        
        if (this.chart) {
            // Mettre à jour les couleurs
            this.chart.options = {
                ...this.chart.options,
                ...this.getDefaultOptions()
            };
            
            this.chart.update('none');
        }
    }

    /**
     * Mettre à jour les données
     */
    updateData(newData) {
        if (this.isDestroyed) return;
        
        this.data = newData;
        this.processData();
        
        if (this.chart) {
            this.chart.update('active');
        }
    }

    /**
     * Traiter les données (à implémenter si nécessaire)
     */
    processData() {
        // À implémenter dans les classes enfants
    }

    /**
     * Redimensionner le graphique
     */
    resize() {
        if (this.chart && !this.isDestroyed) {
            this.chart.resize();
        }
    }

    /**
     * Détruire le graphique
     */
    destroy() {
        this.isDestroyed = true;
        
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

/**
 * Graphique d'évolution de l'equity
 */
class EquityChart extends BaseChart {
    createChart() {
        const config = {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Equity',
                    data: [],
                    borderColor: this.themeColors.primary,
                    backgroundColor: Utils.hexToRgba(this.themeColors.primary, 0.1),
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: this.themeColors.primary,
                    pointBorderColor: this.themeColors.background,
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...this.getDefaultOptions(),
                scales: {
                    ...this.getDefaultOptions().scales,
                    y: {
                        ...this.getDefaultOptions().scales.y,
                        beginAtZero: false,
                        ticks: {
                            ...this.getDefaultOptions().scales.y.ticks,
                            callback: function(value) {
                                return Utils.formatCurrency(value);
                            }
                        }
                    },
                    x: {
                        ...this.getDefaultOptions().scales.x,
                        ticks: {
                            ...this.getDefaultOptions().scales.x.ticks,
                            maxTicksLimit: 8
                        }
                    }
                },
                plugins: {
                    ...this.getDefaultOptions().plugins,
                    tooltip: {
                        ...this.getDefaultOptions().plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                return `Equity: ${Utils.formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                }
            }
        };

        this.chart = new Chart(this.ctx, config);
    }

    processData() {
        if (!this.data || this.data.length === 0) {
            this.chart.data.labels = [];
            this.chart.data.datasets[0].data = [];
            return;
        }

        // Trier par timestamp
        const sortedData = [...this.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Limiter à 50 points max pour la performance
        const limitedData = sortedData.slice(-50);
        
        this.chart.data.labels = limitedData.map(item => 
            Utils.formatDate(item.timestamp, 'time')
        );
        
        this.chart.data.datasets[0].data = limitedData.map(item => item.equity);
    }

    /**
     * Ajouter un point de données
     */
    addDataPoint(timestamp, equity) {
        if (this.isDestroyed) return;
        
        const timeLabel = Utils.formatDate(timestamp, 'time');
        
        this.chart.data.labels.push(timeLabel);
        this.chart.data.datasets[0].data.push(equity);
        
        // Limiter à 50 points
        if (this.chart.data.labels.length > 50) {
            this.chart.data.labels.shift();
            this.chart.data.datasets[0].data.shift();
        }
        
        this.chart.update('active');
    }
}

/**
 * Graphique de performance par stratégie
 */
class PerformanceChart extends BaseChart {
    createChart() {
        const config = {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [],
                    borderColor: this.themeColors.background,
                    borderWidth: 2,
                    hoverBorderWidth: 3
                }]
            },
            options: {
                ...this.getDefaultOptions(),
                cutout: '60%',
                plugins: {
                    ...this.getDefaultOptions().plugins,
                    legend: {
                        ...this.getDefaultOptions().plugins.legend,
                        position: 'bottom'
                    },
                    tooltip: {
                        ...this.getDefaultOptions().plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + Math.abs(b), 0);
                                const percentage = total > 0 ? ((Math.abs(value) / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${Utils.formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };

        this.chart = new Chart(this.ctx, config);
    }

    processData() {
        if (!this.data || !this.data.profitLoss) {
            this.chart.data.labels = ['Aucune donnée'];
            this.chart.data.datasets[0].data = [1];
            this.chart.data.datasets[0].backgroundColor = [this.themeColors.grid];
            return;
        }

        // Simuler des données par stratégie (à adapter selon vos données réelles)
        const strategies = [
            { name: 'Default', profit: this.data.profitLoss.total * 0.6 },
            { name: 'Scalping', profit: this.data.profitLoss.total * 0.3 },
            { name: 'Trend Following', profit: this.data.profitLoss.total * 0.1 }
        ];

        this.chart.data.labels = strategies.map(s => s.name);
        this.chart.data.datasets[0].data = strategies.map(s => s.profit);
        
        // Couleurs basées sur la performance
        this.chart.data.datasets[0].backgroundColor = strategies.map(s => 
            s.profit > 0 ? this.themeColors.success : 
            s.profit < 0 ? this.themeColors.danger : 
            this.themeColors.info
        );
    }
}

/**
 * Graphique de barres pour les trades
 */
class TradesChart extends BaseChart {
    createChart() {
        const config = {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Trades Gagnants',
                    data: [],
                    backgroundColor: this.themeColors.success,
                    borderColor: this.themeColors.success,
                    borderWidth: 1
                }, {
                    label: 'Trades Perdants',
                    data: [],
                    backgroundColor: this.themeColors.danger,
                    borderColor: this.themeColors.danger,
                    borderWidth: 1
                }]
            },
            options: {
                ...this.getDefaultOptions(),
                scales: {
                    ...this.getDefaultOptions().scales,
                    y: {
                        ...this.getDefaultOptions().scales.y,
                        beginAtZero: true,
                        ticks: {
                            ...this.getDefaultOptions().scales.y.ticks,
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    ...this.getDefaultOptions().plugins,
                    tooltip: {
                        ...this.getDefaultOptions().plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y}`;
                            }
                        }
                    }
                }
            }
        };

        this.chart = new Chart(this.ctx, config);
    }

    processData() {
        if (!this.data || !this.data.orderStats) {
            this.chart.data.labels = [];
            this.chart.data.datasets[0].data = [];
            this.chart.data.datasets[1].data = [];
            return;
        }

        // Simuler des données journalières
        const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const winningTrades = days.map(() => Math.floor(Math.random() * 10));
        const losingTrades = days.map(() => Math.floor(Math.random() * 5));

        this.chart.data.labels = days;
        this.chart.data.datasets[0].data = winningTrades;
        this.chart.data.datasets[1].data = losingTrades.map(x => -x); // Valeurs négatives
    }
}

/**
 * Graphique linéaire pour les métriques de risque
 */
class RiskChart extends BaseChart {
    createChart() {
        const config = {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Exposition Totale',
                    data: [],
                    borderColor: this.themeColors.warning,
                    backgroundColor: Utils.hexToRgba(this.themeColors.warning, 0.1),
                    yAxisID: 'y',
                    tension: 0.4
                }, {
                    label: 'Risque Total',
                    data: [],
                    borderColor: this.themeColors.danger,
                    backgroundColor: Utils.hexToRgba(this.themeColors.danger, 0.1),
                    yAxisID: 'y1',
                    tension: 0.4
                }]
            },
            options: {
                ...this.getDefaultOptions(),
                scales: {
                    ...this.getDefaultOptions().scales,
                    y: {
                        ...this.getDefaultOptions().scales.y,
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Exposition (lots)',
                            color: this.themeColors.text
                        }
                    },
                    y1: {
                        ...this.getDefaultOptions().scales.y,
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Risque ($)',
                            color: this.themeColors.text
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        };

        this.chart = new Chart(this.ctx, config);
    }

    processData() {
        if (!this.data || this.data.length === 0) {
            this.chart.data.labels = [];
            this.chart.data.datasets[0].data = [];
            this.chart.data.datasets[1].data = [];
            return;
        }

        const sortedData = [...this.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const limitedData = sortedData.slice(-20);

        this.chart.data.labels = limitedData.map(item => 
            Utils.formatDate(item.timestamp, 'time')
        );
        
        this.chart.data.datasets[0].data = limitedData.map(item => item.totalExposure);
        this.chart.data.datasets[1].data = limitedData.map(item => item.totalRisk);
    }
}

/**
 * Graphique de volatilité
 */
class VolatilityChart extends BaseChart {
    createChart() {
        const config = {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Volatilité',
                    data: [],
                    backgroundColor: this.themeColors.info,
                    borderColor: this.themeColors.info,
                    pointRadius: 4,
                    pointHoverRadius: 8
                }]
            },
            options: {
                ...this.getDefaultOptions(),
                scales: {
                    ...this.getDefaultOptions().scales,
                    x: {
                        ...this.getDefaultOptions().scales.x,
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'Temps',
                            color: this.themeColors.text
                        }
                    },
                    y: {
                        ...this.getDefaultOptions().scales.y,
                        title: {
                            display: true,
                            text: 'Volatilité (%)',
                            color: this.themeColors.text
                        }
                    }
                }
            }
        };

        this.chart = new Chart(this.ctx, config);
    }

    processData() {
        if (!this.data || this.data.length === 0) {
            this.chart.data.datasets[0].data = [];
            return;
        }

        // Calculer la volatilité (simulation)
        const volatilityData = this.data.map((item, index) => ({
            x: index,
            y: Math.random() * 10 + 5 // Simulation de volatilité entre 5% et 15%
        }));

        this.chart.data.datasets[0].data = volatilityData;
    }
}

/**
 * Gestionnaire de graphiques pour créer et gérer tous les graphiques
 */
class ChartManager {
    constructor() {
        this.charts = new Map();
        this.defaultColors = this.getDefaultColors();
    }

    /**
     * Créer un graphique
     */
    createChart(type, canvas, options = {}) {
        const chartClasses = {
            'equity': EquityChart,
            'performance': PerformanceChart,
            'trades': TradesChart,
            'risk': RiskChart,
            'volatility': VolatilityChart
        };

        const ChartClass = chartClasses[type];
        if (!ChartClass) {
            throw new Error(`Type de graphique non supporté: ${type}`);
        }

        const chart = new ChartClass(canvas, options);
        this.charts.set(canvas.id, chart);
        return chart;
    }

    /**
     * Obtenir un graphique
     */
    getChart(canvasId) {
        return this.charts.get(canvasId);
    }

    /**
     * Détruire un graphique
     */
    destroyChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.destroy();
            this.charts.delete(canvasId);
        }
    }

    /**
     * Détruire tous les graphiques
     */
    destroyAll() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }

    /**
     * Redimensionner tous les graphiques
     */
    resizeAll() {
        this.charts.forEach(chart => chart.resize());
    }

    /**
     * Obtenir les couleurs par défaut
     */
    getDefaultColors() {
        return {
            primary: '#00d4aa',
            secondary: '#246cf9',
            success: '#00c851',
            warning: '#ffbb33',
            danger: '#ff4444',
            info: '#33b5e5'
        };
    }

    /**
     * Créer un graphique personnalisé
     */
    createCustomChart(canvas, config) {
        const chart = new Chart(canvas, config);
        this.charts.set(canvas.id, { chart, destroy: () => chart.destroy(), resize: () => chart.resize() });
        return chart;
    }
}

// Exports globaux
window.BaseChart = BaseChart;
window.EquityChart = EquityChart;
window.PerformanceChart = PerformanceChart;
window.TradesChart = TradesChart;
window.RiskChart = RiskChart;
window.VolatilityChart = VolatilityChart;
window.ChartManager = ChartManager;

// Utility function pour créer des couleurs avec alpha
if (!window.Utils.hexToRgba) {
    window.Utils.hexToRgba = function(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
}