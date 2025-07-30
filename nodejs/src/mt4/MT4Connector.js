// nodejs/src/mt4/MT4Connector.js
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class MT4Connector {
  constructor(config) {
    this.folder = config.folder;
    this.commandTimeout = config.commandTimeout || 10000;
    this.responseCheckInterval = config.responseCheckInterval || 500;
    
    // Fichiers de communication
    this.commandFile = path.join(this.folder, 'command.txt');
    this.responseFile = path.join(this.folder, 'response.txt');
    this.pingCommandFile = path.join(this.folder, 'command-ping.txt');
    this.pingResponseFile = path.join(this.folder, 'response-ping.txt');
    
    // État
    this.pendingCommands = new Map();
    this.isConnected = false;
    this.checkInterval = null;
  }

  /**
   * Démarre la connexion avec MT4
   */
  async start() {
    console.log('[MT4Connector] Démarrage...');
    
    // Nettoyer les anciens fichiers
    await this.cleanup();
    
    // Vérifier la connexion
    /*const connected = await this.checkConnection();
    if (!connected) {
      throw new Error('Impossible de se connecter à MT4');
    }*/
   this.isConnected = true
    
    // Démarrer la vérification des réponses
    this.startResponseChecker();
    
    console.log('[MT4Connector] ✅ Connecté');
  }

  /**
   * Arrête la connexion
   */
  async stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.isConnected = false;
    await this.cleanup();
    
    console.log('[MT4Connector] Arrêté');
  }

  /**
   * Envoie une commande à MT4
   */
  async sendCommand(command, timeout = null) {
    if (!this.isConnected) {
      await this.checkConnection();
    }

    const commandId = command.id || `cmd-${uuidv4()}`;
    const fullCommand = { ...command, id: commandId };
    const timeoutMs = timeout || this.commandTimeout;

    return new Promise(async (resolve, reject) => {
      // Enregistrer la commande en attente
      this.pendingCommands.set(commandId, {
        command: fullCommand,
        resolve,
        reject,
        timestamp: Date.now(),
        timeout: timeoutMs
      });

      try {
        // Écrire la commande
        await fs.writeFile(
          this.commandFile, 
          JSON.stringify(fullCommand), 
          'utf8'
        );
        
        console.log(`[MT4Connector] ⬆️ Commande envoyée: ${command.command} (${commandId})`);

        // Timeout automatique
        setTimeout(() => {
          if (this.pendingCommands.has(commandId)) {
            this.pendingCommands.delete(commandId);
            reject(new Error(`Timeout commande ${commandId}`));
          }
        }, timeoutMs);

      } catch (error) {
        this.pendingCommands.delete(commandId);
        reject(error);
      }
    });
  }

  /**
   * Vérifie la connexion avec MT4
   */
  async checkConnection() {
    try {
      const pingId = `ping-${Date.now()}`;
      const pingCommand = { id: pingId, command: 'ping' };
      
      // Envoyer un ping
      await fs.writeFile(
        this.pingCommandFile,
        JSON.stringify(pingCommand),
        'utf8'
      );

      // Attendre la réponse (max 5 secondes)
      const startTime = Date.now();
      while (Date.now() - startTime < 5000) {
        try {
          const response = await fs.readFile(this.pingResponseFile, 'utf8');
          const data = JSON.parse(response);
          
          if (data.id === pingId && data.result === 'pong') {
            await fs.unlink(this.pingResponseFile);
            this.isConnected = true;
            return true;
          }
        } catch (e) {
          // Fichier pas encore prêt
        }
        
        await this.sleep(200);
      }

      this.isConnected = false;
      return false;

    } catch (error) {
      console.error('[MT4Connector] Erreur de connexion:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Démarre la vérification périodique des réponses
   */
  startResponseChecker() {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkResponses();
      this.checkTimeouts();
    }, this.responseCheckInterval);
  }

  /**
   * Vérifie les réponses de MT4
   */
  async checkResponses() {
    try {
      // Vérifier le fichier de réponse principal
      const exists = await this.fileExists(this.responseFile);
      if (!exists) return;

      const content = await fs.readFile(this.responseFile, 'utf8');
      const response = JSON.parse(content);

      // Trouver la commande correspondante
      const pending = this.pendingCommands.get(response.id);
      if (!pending) {
        console.warn(`[MT4Connector] Réponse orpheline: ${response.id}`);
        await fs.unlink(this.responseFile);
        return;
      }

      // Résoudre la promesse
      this.pendingCommands.delete(response.id);
      await fs.unlink(this.responseFile);

      console.log(`[MT4Connector] ✅ Réponse reçue: ${response.id}`);

      if (response.error) {
        pending.reject(new Error(response.error));
      } else {
        pending.resolve({
          success: true,
          ...response.result
        });
      }

    } catch (error) {
      // Ignorer les erreurs de parsing (fichier en cours d'écriture)
      if (error.name !== 'SyntaxError') {
        console.error('[MT4Connector] Erreur lecture réponse:', error);
      }
    }
  }

  /**
   * Vérifie les timeouts des commandes
   */
  checkTimeouts() {
    const now = Date.now();
    
    for (const [id, pending] of this.pendingCommands) {
      if (now - pending.timestamp > pending.timeout) {
        this.pendingCommands.delete(id);
        pending.reject(new Error(`Timeout commande ${id}`));
        console.warn(`[MT4Connector] ⏱️ Timeout: ${id}`);
      }
    }
  }

  /**
   * Récupère le solde du compte
   */
  async getBalance() {
    const result = await this.sendCommand({ command: 'getBalance' });
    return result;
  }

  /**
   * Place un ordre au marché
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

    return await this.sendCommand(command);
  }

  /**
   * Place un ordre limite/stop
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

    return await this.sendCommand(command);
  }

  /**
   * Ferme un ordre
   */
  async closeOrder(ticket) {
    const command = {
      command: 'closeMarketOrder',
      ticket: ticket
    };

    return await this.sendCommand(command);
  }

  /**
   * Récupère la liste des ordres ouverts
   */
  async getOpenOrders() {
    //const result = await this.sendCommand({ command: 'getOpenOrders' });
    const result = await this.sendCommand({ command: 'getAllMarketOrders' });
    return result.orders || [];
  }

  /**
   * Récupère l'historique des ordres
   */
  async getOrderHistory(days = 30) {
    const result = await this.sendCommand({ 
      command: 'getOrderHistory',
      days: days 
    });
    return result.orders || [];
  }

  /**
   * Nettoie les fichiers de communication
   */
  async cleanup() {
    const files = [
      this.commandFile,
      this.responseFile,
      this.pingCommandFile,
      this.pingResponseFile
    ];

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

  /**
   * Helper: vérifie si un fichier existe
   */
  async fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MT4Connector;