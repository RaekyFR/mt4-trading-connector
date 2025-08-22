// nodejs/src/mt4/MT4Connector.js - Version avec queue de commandes

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
    
    // SOLUTION 1: Queue de commandes pour éviter les écrasements
    this.commandQueue = [];
    this.isProcessingQueue = false;
    this.queueProcessInterval = null;
  }

  /**
   * Démarre la connexion avec MT4
   */
  async start() {
    console.log('[MT4Connector] Démarrage...');
    
    // Nettoyer les anciens fichiers
    await this.cleanup();
    
    this.isConnected = true;
    
    // Démarrer la vérification des réponses
    this.startResponseChecker();
    
    // SOLUTION 1: Démarrer le processeur de queue
    this.startQueueProcessor();
    
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
    
    // SOLUTION 1: Arrêter le processeur de queue
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
      this.queueProcessInterval = null;
    }
    
    this.isConnected = false;
    await this.cleanup();
    
    console.log('[MT4Connector] Arrêté');
  }

  /**
   * SOLUTION 1: Démarrer le processeur de queue
   */
  startQueueProcessor() {
    this.queueProcessInterval = setInterval(async () => {
      if (!this.isProcessingQueue && this.commandQueue.length > 0) {
        await this.processNextCommand();
      }
    }, 100); // Vérifier toutes les 100ms
  }

  /**
   * SOLUTION 1: Traiter la prochaine commande dans la queue
   */
  async processNextCommand() {
    if (this.isProcessingQueue || this.commandQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      const { command, resolve, reject, timeout } = this.commandQueue.shift();
      
      console.log(`[MT4Connector] 📤 Traitement queue: ${command.command} (${command.id})`);
      
      // Attendre que le fichier précédent soit traité
      await this.waitForFileToBeProcessed();
      
      // Écrire la commande
      await fs.writeFile(this.commandFile, JSON.stringify(command), 'utf8');
      
      console.log(`[MT4Connector] ⬆️ Commande envoyée: ${command.command} (${command.id})`);
      
      // Enregistrer la commande en attente
      this.pendingCommands.set(command.id, {
        command,
        resolve,
        reject,
        timestamp: Date.now(),
        timeout
      });
      
      // Timeout automatique
      setTimeout(() => {
        if (this.pendingCommands.has(command.id)) {
          this.pendingCommands.delete(command.id);
          reject(new Error(`Timeout commande ${command.id}`));
        }
      }, timeout);
      
    } catch (error) {
      console.error('[MT4Connector] Erreur traitement queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * SOLUTION 1: Attendre que le fichier de commande soit traité par MT4
   */
  async waitForFileToBeProcessed(maxWait = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      try {
        // Si le fichier n'existe plus, c'est qu'il a été traité
        const exists = await this.fileExists(this.commandFile);
        if (!exists) {
          return;
        }
        
        // Attendre un peu avant de vérifier à nouveau
        await this.sleep(50);
      } catch (error) {
        // Erreur d'accès = fichier probablement supprimé
        return;
      }
    }
    
    console.warn('[MT4Connector] ⚠️ Timeout attente traitement fichier');
  }

  /**
   * SOLUTION 1: Envoie une commande via la queue
   */
  async sendCommand(command, timeout = null) {
    if (!this.isConnected) {
      await this.checkConnection();
    }

    const commandId = command.id || `cmd-${uuidv4()}`;
    const fullCommand = { ...command, id: commandId };
    const timeoutMs = timeout || this.commandTimeout;

    return new Promise((resolve, reject) => {
      // Ajouter à la queue au lieu d'envoyer directement
      this.commandQueue.push({
        command: fullCommand,
        resolve,
        reject,
        timeout: timeoutMs
      });
      
      console.log(`[MT4Connector] 📥 Commande ajoutée à la queue: ${command.command} (${commandId}) - Queue: ${this.commandQueue.length}`);
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
      
      // SOLUTION 2: Vérifier les réponses des fichiers uniques
      this.checkUniqueFileResponses();
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
   * SOLUTION 2: Vérifie les réponses des fichiers uniques
   */
  async checkUniqueFileResponses() {
    for (const [commandId, pending] of this.pendingCommands) {
      if (!pending.responseFile) continue;
      
      try {
        const exists = await this.fileExists(pending.responseFile);
        if (!exists) continue;

        const content = await fs.readFile(pending.responseFile, 'utf8');
        const response = JSON.parse(content);

        if (response.id === commandId) {
          // Résoudre la promesse
          this.pendingCommands.delete(commandId);
          
          // Nettoyer les fichiers
          await this.cleanupCommandFiles(null, pending.responseFile);
          
          console.log(`[MT4Connector] ✅ Réponse reçue (fichier unique): ${commandId}`);

          if (response.error) {
            pending.reject(new Error(response.error));
          } else {
            pending.resolve({
              success: true,
              ...response.result
            });
          }
        }
      } catch (error) {
        // Ignorer les erreurs de parsing
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
   * Nettoie les fichiers de commande
   */
  async cleanupCommandFiles(commandFile, responseFile) {
    try {
      if (commandFile && await this.fileExists(commandFile)) {
        await fs.unlink(commandFile);
      }
      if (responseFile && await this.fileExists(responseFile)) {
        await fs.unlink(responseFile);
      }
    } catch (error) {
      // Ignorer les erreurs
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
 * Ferme toutes les positions ouvertes
 */
async closeAllOrders() {
  console.log('[MT4Connector] Demande fermeture toutes positions');
  
  const command = {
    command: 'closeAllMarketOrders'
  };

  try {
    const result = await this.sendCommand(command);
    
    console.log('[MT4Connector] Réponse fermeture toutes positions:', result);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('[MT4Connector] Erreur fermeture toutes positions:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

 /**
 * Modification du SL/TP
 */

async modifyOrder(ticket, stopLoss = 0, takeProfit = 0) {
  console.log(`[MT4Connector] Modification ordre ${ticket} - SL: ${stopLoss}, TP: ${takeProfit}`);
  
  const command = {
    command: 'modifyOrder',
    ticket: ticket,
    sl: stopLoss,
    tp: takeProfit
  };

  try {
    const result = await this.sendCommand(command);
    
    console.log(`[MT4Connector] Résultat modification:`, result);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error(`[MT4Connector] Erreur modification:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}
/*
async savePositionChanges() {
    if (!this.currentEditTicket) return;

    const stopLoss = parseFloat(document.getElementById('editStopLoss').value) || 0;
    const takeProfit = parseFloat(document.getElementById('editTakeProfit').value) || 0;

    try {
        console.log(`[Dashboard] Modification position ${this.currentEditTicket} - SL: ${stopLoss}, TP: ${takeProfit}`);
        
        // Appeler l'API de modification
        const result = await window.api.modifyOrder(this.currentEditTicket, { stopLoss, takeProfit });
        
        if (result.success) {
            window.notifications.success('Position', 'Position modifiée avec succès');
            this.closeEditModal();
            await this.loadPositions();
        } else {
            window.notifications.error('Erreur', result.error || 'Modification échouée');
        }
        
    } catch (error) {
        console.error('[Dashboard] Erreur modification:', error);
        window.notifications.error('Erreur', 'Impossible de modifier la position');
    }
}*/

  /**
   * Récupère la liste des ordres ouverts
   */
  async getOpenOrders() {
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
   * Récupère les détails d'un ordre spécifique
   */
  async getOrderDetails(ticket) {
    const command = {
      command: 'getOrderDetails',
      ticket: ticket
    };

    return await this.sendCommand(command);
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