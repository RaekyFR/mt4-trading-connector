// MT4Connector simplifié - Version avec support complet pour le levier
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class MT4Connector {
  constructor(config) {
    this.folder = config.folder;
    this.commandTimeout = config.commandTimeout || 15000;
    
    // Fichiers de communication
    this.commandFile = path.join(this.folder, 'command.txt');
    this.responseFile = path.join(this.folder, 'response.txt');
    
    // État simplifié
    this.isConnected = false;
    this.currentCommand = null; // Un seul command à la fois
    
    // NOUVEAU: Cache pour les données de compte
    this.lastAccountInfo = null;
    this.lastAccountUpdate = null;
  }

  async start() {
    console.log('[MT4Connector] Démarrage...');
    await this.cleanup();
    this.isConnected = true;
    
    // NOUVEAU: Récupérer immédiatement les infos de compte
    try {
      await this.refreshAccountInfo();
      console.log('[MT4Connector] ✅ Connecté avec infos compte');
    } catch (error) {
      console.warn('[MT4Connector] ⚠️ Connecté mais sans infos compte:', error.message);
    }
  }

  async stop() {
    this.isConnected = false;
    await this.cleanup();
    this.lastAccountInfo = null;
    this.lastAccountUpdate = null;
    console.log('[MT4Connector] Arrêté');
  }

  /**
   * Envoie une commande - VERSION SIMPLIFIÉE (inchangée)
   */
  async sendCommand(command, timeout = null) {
   /* if (!this.isConnected) {
      throw new Error('MT4 non connecté');
    }*/

    // Attendre que la commande précédente soit terminée
    let attempts = 0;
    while (this.currentCommand && attempts < 50) {
      console.log(`[MT4Connector] ⏳ Attente fin commande précédente (${attempts + 1}/50)`);
      await this.sleep(100);
      attempts++;
    }

    if (this.currentCommand) {
      throw new Error('MT4 occupé - timeout attente');
    }

    const commandId = command.id || `cmd-${uuidv4()}`;
    const fullCommand = { ...command, id: commandId };
    const timeoutMs = timeout || this.commandTimeout;

    console.log(`[MT4Connector] 📤 Envoi commande: ${command.command} (${commandId})`);

    return new Promise(async (resolve, reject) => {
      // Marquer comme en cours
      this.currentCommand = {
        id: commandId,
        resolve,
        reject,
        startTime: Date.now()
      };

      // Timeout principal
      const timeoutId = setTimeout(() => {
        if (this.currentCommand?.id === commandId) {
          this.currentCommand = null;
          reject(new Error(`Timeout commande ${commandId} après ${timeoutMs}ms`));
        }
      }, timeoutMs);

      try {
        // 1. Attendre que le fichier soit libre
        await this.waitForFileAvailable();

        // 2. Écrire la commande
        const commandJson = JSON.stringify(fullCommand);
        console.log(`[MT4Connector] 📝 Écriture: ${commandJson}`);
        
        const tempFile = this.commandFile + '.tmp';
        await fs.writeFile(tempFile, commandJson, 'utf8');
        await fs.rename(tempFile, this.commandFile);

        console.log(`[MT4Connector] ⬆️ Commande envoyée: ${commandId}`);

        // 3. Attendre la réponse
        const response = await this.waitForResponse(commandId, timeoutMs - 1000);
        
        // 4. Nettoyer
        clearTimeout(timeoutId);
        this.currentCommand = null;

        console.log(`[MT4Connector] ✅ Réponse reçue: ${commandId}`);

        // 5. Traiter la réponse
        if (response.result && response.result.error) {
          reject(new Error(response.result.error));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve({
            success: true,
            ...response.result
          });
        }

      } catch (error) {
        clearTimeout(timeoutId);
        this.currentCommand = null;
        console.error(`[MT4Connector] ❌ Erreur: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * NOUVEAU: Récupère les informations complètes du compte
   */
  async getAccountInfo() {
    const result = await this.sendCommand({ command: 'getAccountInfo' });
    
    // Mettre en cache les informations
    this.lastAccountInfo = {
      balance: result.balance || 0,
      equity: result.equity || 0,
      margin: result.margin || 0,
      freeMargin: result.freeMargin || result.free_margin || 0, // Support des deux formats
      marginLevel: result.marginLevel || result.margin_level || 0,
      currency: result.currency || 'USD',
      leverage: result.leverage || 30, // Levier par défaut
      accountNumber: result.accountNumber || result.account_number,
      broker: result.broker || 'Unknown',
      timestamp: new Date()
    };
    
    this.lastAccountUpdate = Date.now();
    
    console.log('[MT4Connector] Infos compte récupérées:', {
      balance: this.lastAccountInfo.balance,
      equity: this.lastAccountInfo.equity,
      freeMargin: this.lastAccountInfo.freeMargin,
      leverage: this.lastAccountInfo.leverage
    });
    
    return this.lastAccountInfo;
  }

  /**
   * NOUVEAU: Rafraîchit les infos de compte si nécessaire
   */
  async refreshAccountInfo(forceRefresh = false) {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
    if (!forceRefresh && this.lastAccountInfo && this.lastAccountUpdate && 
        (now - this.lastAccountUpdate) < maxAge) {
      return this.lastAccountInfo;
    }
    
    try {
      return await this.getAccountInfo();
    } catch (error) {
      console.warn('[MT4Connector] Impossible de rafraîchir les infos compte:', error.message);
      return this.lastAccountInfo; // Retourner le cache si disponible
    }
  }

  /**
   * NOUVEAU: Retourne les infos de compte (avec cache intelligent)
   */
  async getCachedAccountInfo() {
    if (!this.lastAccountInfo) {
      return await this.refreshAccountInfo();
    }
    
    return this.lastAccountInfo;
  }

  /**
   * Méthode legacy pour compatibilité - utilise maintenant getAccountInfo()
   */
  async getBalance() {
    const accountInfo = await this.refreshAccountInfo();
    return {
      success: true,
      balance: accountInfo.balance,
      equity: accountInfo.equity,
      margin: accountInfo.margin,
      freeMargin: accountInfo.freeMargin
    };
  }

  /**
   * NOUVEAU: Place un ordre avec gestion optimisée du levier
   */
  async placeMarketOrder(params) {
    const command = {
      command: 'marketOrder',
      symbol: params.symbol,
      type: params.type,
      lot: params.lots,
      sl: params.stopLoss,
      tp: params.takeProfit,
      comment: params.comment || ''
    };

    console.log(`[MT4Connector] Placement ordre market:`, {
      symbol: params.symbol,
      type: params.type,
      lot: params.lots,
      sl: params.stopLoss,
      tp: params.takeProfit
    });

    const result = await this.sendCommand(command, 30000); // 30s pour les ordres
    
    // NOUVEAU: Rafraîchir les infos de compte après un ordre
    if (result.success) {
      setTimeout(() => {
        this.refreshAccountInfo(true).catch(err => 
          console.warn('[MT4Connector] Erreur rafraîchissement post-ordre:', err.message)
        );
      }, 1000); // Délai pour laisser MT4 se mettre à jour
    }
    
    return result;
  }

  /**
   * NOUVEAU: Place un ordre limite
   */
  async placeLimitOrder(params) {
    const command = {
      command: 'limitOrder',
      symbol: params.symbol,
      type: params.type,
      lot: params.lots,
      price: params.price,
      sl: params.stopLoss,
      tp: params.takeProfit,
      comment: params.comment || ''
    };

    console.log(`[MT4Connector] Placement ordre limite:`, {
      symbol: params.symbol,
      type: params.type,
      lot: params.lots,
      price: params.price
    });

    return await this.sendCommand(command, 30000);
  }

  /**
   * Récupère les ordres ouverts (inchangé)
   */
  async getOpenOrders() {
    const result = await this.sendCommand({ command: 'getAllMarketOrders' });
    return result.orders || [];
  }

  /**
   * Ferme un ordre (inchangé)
   */
  async closeOrder(ticket) {
    const result = await this.sendCommand({
      command: 'closeMarketOrder',
      ticket: ticket
    });
    
    // Rafraîchir les infos après fermeture
    if (result.success) {
      setTimeout(() => {
        this.refreshAccountInfo(true).catch(err => 
          console.warn('[MT4Connector] Erreur rafraîchissement post-fermeture:', err.message)
        );
      }, 1000);
    }
    
    return result;
  }

  /**
   * Modifie un ordre (inchangé)
   */
  async modifyOrder(ticket, stopLoss = 0, takeProfit = 0) {
    return await this.sendCommand({
      command: 'modifyOrder',
      ticket: ticket,
      sl: stopLoss,
      tp: takeProfit
    });
  }

  /**
   * NOUVEAU: Calcule la marge requise pour une position
   */
  async calculateMarginRequirement(symbol, lotSize, price) {
    try {
      const result = await this.sendCommand({
        command: 'calculateMargin',
        symbol: symbol,
        lot: lotSize,
        price: price
      });
      
      return result.marginRequired || 0;
    } catch (error) {
      console.warn(`[MT4Connector] Impossible de calculer marge via MT4:`, error.message);
      
      // Calcul approximatif basé sur les infos de compte
      const accountInfo = await this.getCachedAccountInfo();
      const positionValue = lotSize * price * this.getContractSize(symbol);
      return positionValue / (accountInfo.leverage || 30);
    }
  }

  /**
   * NOUVEAU: Obtient la taille de contrat pour un symbole
   */
  getContractSize(symbol) {
    const contractSizes = {
      'BTCUSD': 1,
      'EURUSD': 100000,
      'GBPUSD': 100000,
      'USDJPY': 100000,
      'XAUUSD': 100,
      'NAS100': 1,
      'US500': 1,
      'SPX500': 1
    };
    
    return contractSizes[symbol] || 100000;
  }

  /**
   * NOUVEAU: Vérifie si une position peut être ouverte avec la marge disponible
   */
  async canOpenPosition(symbol, lotSize, price) {
    try {
      const accountInfo = await this.refreshAccountInfo();
      const marginRequired = await this.calculateMarginRequirement(symbol, lotSize, price);
      
      const canOpen = marginRequired <= accountInfo.freeMargin * 0.9; // 10% de sécurité
      
      console.log(`[MT4Connector] Vérification position ${symbol}:`, {
        lotSize,
        marginRequired: marginRequired.toFixed(2),
        freeMargin: accountInfo.freeMargin.toFixed(2),
        canOpen
      });
      
      return {
        canOpen,
        marginRequired,
        freeMargin: accountInfo.freeMargin,
        marginAfter: accountInfo.freeMargin - marginRequired
      };
    } catch (error) {
      console.error('[MT4Connector] Erreur vérification position:', error);
      return { canOpen: false, error: error.message };
    }
  }

  /**
   * Vérification de connexion améliorée
   */
  async checkConnection() {
    try {
      await this.refreshAccountInfo();
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      console.warn('[MT4Connector] Connexion perdue:', error.message);
      return false;
    }
  }

  /**
   * NOUVEAU: Obtient des statistiques détaillées du compte
   */
  async getAccountStats() {
    try {
      const accountInfo = await this.refreshAccountInfo();
      const openOrders = await this.getOpenOrders();
      
      const stats = {
        account: accountInfo,
        positions: {
          count: openOrders.length,
          totalLots: openOrders.reduce((sum, order) => sum + (order.lot || 0), 0),
          symbols: [...new Set(openOrders.map(order => order.symbol))]
        },
        margins: {
          used: accountInfo.margin,
          free: accountInfo.freeMargin,
          level: accountInfo.marginLevel,
          usagePercent: accountInfo.margin > 0 ? 
            ((accountInfo.margin / accountInfo.equity) * 100).toFixed(2) : 0
        },
        risk: {
          drawdown: accountInfo.balance > 0 ? 
            (((accountInfo.balance - accountInfo.equity) / accountInfo.balance) * 100).toFixed(2) : 0,
          equityPercent: accountInfo.balance > 0 ? 
            ((accountInfo.equity / accountInfo.balance) * 100).toFixed(2) : 100
        }
      };
      
      return stats;
    } catch (error) {
      console.error('[MT4Connector] Erreur statistiques compte:', error);
      return null;
    }
  }

  /**
   * Attendre que le fichier command soit disponible (inchangé)
   */
  async waitForFileAvailable(maxWait = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        const exists = await this.fileExists(this.commandFile);
        if (!exists) {
          return; // Fichier libre
        }
        await this.sleep(50);
      } catch (error) {
        return; // Erreur d'accès = fichier libre
      }
    }
    
    throw new Error('Timeout attente fichier command libre');
  }

  /**
   * Attendre la réponse de MT4 (inchangé)
   */
  async waitForResponse(commandId, maxWait = 14000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        const exists = await this.fileExists(this.responseFile);
        if (!exists) {
          await this.sleep(100);
          continue;
        }

        const content = await fs.readFile(this.responseFile, 'utf8');
        if (!content.trim()) {
          await this.sleep(100);
          continue;
        }

        let response;
        try {
          response = JSON.parse(content);
        } catch (parseError) {
          // Fichier en cours d'écriture
          await this.sleep(100);
          continue;
        }

        // Vérifier si c'est notre réponse
        if (response.id === commandId) {
          // Nettoyer le fichier
          await fs.unlink(this.responseFile);
          return response;
        }

        // Pas notre réponse, attendre
        await this.sleep(100);
        
      } catch (error) {
        await this.sleep(100);
      }
    }
    
    throw new Error(`Timeout attente réponse pour ${commandId}`);
  }

  /**
   * Helpers (inchangés)
   */
  async fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    const files = [this.commandFile, this.responseFile];
    for (const file of files) {
      try {
        if (await this.fileExists(file)) {
          await fs.unlink(file);
        }
      } catch (e) {
        // Ignorer les erreurs
      }
    }
  }
}

module.exports = MT4Connector;