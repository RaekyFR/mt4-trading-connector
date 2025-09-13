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
 * Version debug qui trace toutes les suppressions de pendingCommands - CORRIGÉE
 */
debugDeleteCommand(commandId, reason, stackTrace = false) {
  if (this.pendingCommands.has(commandId)) {
    console.log(`[MT4Connector] 🗑️ SUPPRESSION commande ${commandId} - Raison: ${reason}`);
    if (stackTrace) {
      console.log(`[MT4Connector] 📍 Stack trace:`, new Error().stack);
    }
    this.pendingCommands.delete(commandId); // ← CORRECTION
    return true;
  } else {
    console.log(`[MT4Connector] ⚠️ Tentative suppression commande inexistante ${commandId} - Raison: ${reason}`);
    return false;
  }
}

/**
 * Version debug qui trace toutes les modifications de pendingCommands - CORRIGÉE
 */
debugSetCommand(commandId, pending) {
  console.log(`[MT4Connector] ➕ AJOUT commande ${commandId} dans pendingCommands`);
  console.log(`[MT4Connector] 📊 Size avant: ${this.pendingCommands.size}`);
  this.pendingCommands.set(commandId, pending); // ← CORRECTION
  console.log(`[MT4Connector] 📊 Size après: ${this.pendingCommands.size}`);
  console.log(`[MT4Connector] 📋 Toutes les commandes:`, Array.from(this.pendingCommands.keys()));
}

  /**
   * SOLUTION 1: Démarrer le processeur de queue
   */
  startQueueProcessor() {
     if (this.queueProcessInterval) return;
    console.log('[MT4Connector] 🚀 Démarrage processeur de queue');
    this.queueProcessInterval = setInterval(async () => {
      if (!this.isProcessingQueue && this.commandQueue.length > 0) {
         console.log(`[MT4Connector] 🔍 Queue check: ${this.commandQueue.length} commandes`);
        await this.processNextCommand();
      }
    }, 50); // Vérifier toutes les 50ms
  }

  /**
   * SOLUTION 1: Traiter la prochaine commande dans la queue
   */

  /**
 * CORRECTION FINALE: Deux timeouts distincts
 */
/**
 * processNextCommand avec debug complet
 */
async processNextCommand() {
  if (this.isProcessingQueue || this.commandQueue.length === 0) {
    return;
  }
  
  this.isProcessingQueue = true;
  console.log('[MT4Connector] 🔒 Verrouillage processeur de queue');
  
  try {
    const queueItem = this.commandQueue.shift();
    if (!queueItem) {
      console.log('[MT4Connector] ⚠️ Queue item null, abandon');
      return;
    }

    const { command, resolve, reject, timeout } = queueItem;
    
    console.log(`[MT4Connector] 🔄 Début traitement queue: ${command.command} (${command.id})`);
    
    // Timeout de réponse MT4 avec debug
    const responseTimeoutId = setTimeout(() => {
      console.error(`[MT4Connector] ⏰ TIMEOUT RÉPONSE MT4 pour ${command.id} après ${timeout}ms`);
      const deleted = this.debugDeleteCommand(command.id, "timeout-reponse-mt4", true);
      if (deleted) {
        reject(new Error(`Timeout réponse MT4 pour commande ${command.id}`));
      }
    }, timeout);

    // Enregistrement avec debug
    this.debugSetCommand(command.id, {
      command,
      resolve,
      reject,
      timestamp: Date.now(),
      timeout,
      responseTimeoutId
    });

    // Timeout de processing avec debug
    const processingTimeoutId = setTimeout(() => {
      console.error(`[MT4Connector] ⏰ TIMEOUT PROCESSING pour ${command.id} après 5000ms`);
      // Ne pas supprimer de pendingCommands, juste rejeter
      reject(new Error(`Timeout processing pour commande ${command.id}`));
    }, 5000);

    try {
      // ... rest of file operations ...
      
      console.log(`[MT4Connector] 📝 Écriture atomique fichier command.txt`);
      const commandJson = JSON.stringify(command);
      const tempFile = this.commandFile + '.tmp';
      await fs.writeFile(tempFile, commandJson, 'utf8');
      await fs.rename(tempFile, this.commandFile);
      
      console.log(`[MT4Connector] ⬆️ Commande envoyée: ${command.command} (${command.id})`);
      
      // Debug : Vérifier l'état juste après envoi
      console.log(`[MT4Connector] 📊 Commande dans pendingCommands (après envoi):`, this.pendingCommands.has(command.id));
      console.log(`[MT4Connector] 📊 Size pendingCommands:`, this.pendingCommands.size);
      
      clearTimeout(processingTimeoutId);
      console.log(`[MT4Connector] ⏰ Timeout de processing annulé`);
      
    } catch (error) {
      console.error(`[MT4Connector] ❌ Erreur envoi commande ${command.id}:`, error);
      clearTimeout(processingTimeoutId);
      clearTimeout(responseTimeoutId);
      this.debugDeleteCommand(command.id, "erreur-envoi", true);
      reject(error);
    }

  } finally {
    console.log('[MT4Connector] 🔓 Déverrouillage processeur de queue');
    
    // Debug final : Vérifier l'état au déverrouillage
    console.log(`[MT4Connector] 📊 État final pendingCommands:`, Array.from(this.pendingCommands.keys()));
    console.log(`[MT4Connector] 📊 Size final:`, this.pendingCommands.size);
    
    this.isProcessingQueue = false;
  }
}

/**
 * checkResponses modifié pour nettoyer le timeout de réponse
 */
async checkResponses() {
  try {
    const exists = await this.fileExists(this.responseFile);
    if (!exists) return;

    console.log(`[MT4Connector] 📨 Lecture fichier réponse...`);
    const content = await fs.readFile(this.responseFile, 'utf8');
    
    console.log(`[MT4Connector] 📄 Contenu fichier response.txt:`, content);
    
    if (!content.trim()) {
      console.warn('[MT4Connector] ⚠️ Fichier réponse vide');
      await fs.unlink(this.responseFile);
      return;
    }

    let response;
    try {
      response = JSON.parse(content);
      console.log(`[MT4Connector] 📋 Réponse parsée:`, response);
    } catch (parseError) {
      console.error('[MT4Connector] ❌ Erreur parsing JSON:', parseError);
      await fs.unlink(this.responseFile);
      return;
    }

    console.log(`[MT4Connector] 🔍 Recherche commande ${response.id} dans pendingCommands`);
    console.log(`[MT4Connector] 📊 Commandes en attente:`, Array.from(this.pendingCommands.keys()));

    const pending = this.pendingCommands.get(response.id);
    if (!pending) {
      console.warn(`[MT4Connector] ⚠️ Réponse orpheline: ${response.id}`);
      console.log(`[MT4Connector] 📊 Détail pendingCommands:`, this.pendingCommands);
      await fs.unlink(this.responseFile);
      return;
    }

    // CORRECTION: Nettoyer le timeout de réponse
    this.debugDeleteCommand(response.id);
    if (pending.responseTimeoutId) {
      clearTimeout(pending.responseTimeoutId);
      console.log(`[MT4Connector] ⏰ Timeout de réponse annulé pour ${response.id}`);
    }
    
    await fs.unlink(this.responseFile);

    console.log(`[MT4Connector] ✅ Réponse reçue: ${response.id} - Status: ${response.error ? 'ERROR' : 'SUCCESS'}`);

    // Gérer les erreurs MT4 dans la réponse
    if (response.result && response.result.error) {
      pending.reject(new Error(response.result.error));
    } else if (response.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve({
        success: true,
        ...response.result
      });
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    } else if (error.name === 'SyntaxError') {
      return;
    } else {
      console.error('[MT4Connector] ❌ Erreur lecture réponse:', error);
    }
  }
}

v

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
    console.log('[MT4Connector] 🔌 Vérification connexion...');
    const connected = await this.checkConnection();
    if (!connected) {
      throw new Error('MT4 non connecté');
    }
  }

  const commandId = command.id || `cmd-${uuidv4()}`;
  const fullCommand = { ...command, id: commandId };
  const timeoutMs = timeout || this.commandTimeout;

  console.log(`[MT4Connector] 📥 Nouvelle commande: ${command.command} (${commandId}) - Timeout: ${timeoutMs}ms`);

  return new Promise((resolve, reject) => {
    // FIX: Add command validation
    if (!fullCommand.command) {
      reject(new Error('Commande invalide: propriété "command" manquante'));
      return;
    }

    // Ajouter à la queue
    const queueItem = {
      command: fullCommand,
      resolve,
      reject,
      timeout: timeoutMs,
      addedAt: Date.now()
    };

    this.commandQueue.push(queueItem);
    
    console.log(`[MT4Connector] 📥 Commande ajoutée à la queue: ${command.command} (${commandId}) - Queue: ${this.commandQueue.length}`);
    console.log(`[MT4Connector] 📋 Queue actuelle:`, this.commandQueue.map(item => item.command.command));
    
    // FIX: Trigger immediate processing if queue was empty
    if (this.commandQueue.length === 1 && !this.isProcessingQueue) {
      console.log('[MT4Connector] 🚀 Déclenchement immédiat du traitement');
      setImmediate(() => this.processNextCommand());
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
    console.log(`[MT4Connector] 🔄 Cycle checker - pendingCommands.size: ${this.pendingCommands.size}`);
    this.checkResponses();
    // Désactive complètement checkTimeouts() pour le moment
    // this.checkTimeouts();
    this.checkUniqueFileResponses();
  }, this.responseCheckInterval);
}
  /*startResponseChecker() {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkResponses();
      this.checkTimeouts();
      
      // SOLUTION 2: Vérifier les réponses des fichiers uniques
      this.checkUniqueFileResponses();
    }, this.responseCheckInterval);
  }*/

/**
 * checkResponses avec correction de syntaxe
 */
async checkResponses() {
  try {
    const exists = await this.fileExists(this.responseFile);
    if (!exists) return;

    console.log(`[MT4Connector] 📨 Lecture fichier réponse...`);
    const content = await fs.readFile(this.responseFile, 'utf8');
    
    console.log(`[MT4Connector] 📄 Contenu fichier response.txt:`, content);
    
    if (!content.trim()) {
      console.warn('[MT4Connector] ⚠️ Fichier réponse vide');
      await fs.unlink(this.responseFile);
      return;
    }

    let response;
    try {
      response = JSON.parse(content);
      console.log(`[MT4Connector] 📋 Réponse parsée:`, response);
    } catch (parseError) {
      console.error('[MT4Connector] ❌ Erreur parsing JSON:', parseError);
      console.error('[MT4Connector] 📄 Contenu fichier:', content);
      await fs.unlink(this.responseFile);
      return;
    }

    console.log(`[MT4Connector] 🔍 Recherche commande ${response.id} dans pendingCommands`);
    console.log(`[MT4Connector] 📊 Commandes en attente:`, Array.from(this.pendingCommands.keys()));
    console.log(`[MT4Connector] 🔍 Commande trouvée:`, this.pendingCommands.has(response.id));

    const pending = this.pendingCommands.get(response.id);
    if (!pending) {
      console.warn(`[MT4Connector] ⚠️ Réponse orpheline: ${response.id}`);
      console.log(`[MT4Connector] 📊 Détail pendingCommands:`, this.pendingCommands);
      await fs.unlink(this.responseFile);
      return;
    }

    // CORRECTION: Nettoyer avec la bonne syntaxe
    this.debugDeleteCommand(response.id, "reponse-recue");
    if (pending.responseTimeoutId) {
      clearTimeout(pending.responseTimeoutId);
      console.log(`[MT4Connector] ⏰ Timeout de réponse annulé pour ${response.id}`);
    }
    
    await fs.unlink(this.responseFile);

    console.log(`[MT4Connector] ✅ Réponse reçue: ${response.id} - Status: ${response.error ? 'ERROR' : 'SUCCESS'}`);

    // Gérer les erreurs MT4 dans la réponse
    if (response.result && response.result.error) {
      pending.reject(new Error(response.result.error));
    } else if (response.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve({
        success: true,
        ...response.result
      });
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    } else if (error.name === 'SyntaxError') {
      return;
    } else {
      console.error('[MT4Connector] ❌ Erreur lecture réponse:', error);
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
          this.debugDeleteCommand(commandId);
          
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
 * checkTimeouts avec protection responseTimeoutId - VERSION CORRIGÉE
 */
checkTimeouts() {
  const now = Date.now();
  // DEBUG CRITIQUE : Vérifier l'identité de l'objet
  console.log(`[MT4Connector] 🔍 DEBUG checkTimeouts:`);
  console.log(`[MT4Connector] 📊 this.pendingCommands.size: ${this.pendingCommands.size}`);
  console.log(`[MT4Connector] 📊 this.pendingCommands === this.pendingCommands: ${this.pendingCommands === this.pendingCommands}`);
  console.log(`[MT4Connector] 📊 Type: ${this.pendingCommands.constructor.name}`);
  console.log(`[MT4Connector] 📊 Clés visibles:`, Array.from(this.pendingCommands.keys()));
  console.log(`[MT4Connector] 📊 Valeurs:`, Array.from(this.pendingCommands.values()).map(v => ({ id: v.command.id, hasTimeout: !!v.responseTimeoutId })));
  


  let iterationCount = 0;
  for (const [id, pending] of this.pendingCommands) {
    iterationCount++;
    console.log(`[MT4Connector] 🔄 Itération ${iterationCount}: ${id}`);
    
    if (pending.responseTimeoutId) {
      console.log(`[MT4Connector] ⏰ Skip ${id} (a responseTimeoutId)`);
      continue;
    }
    
    if (now - pending.timestamp > pending.timeout) {
      console.log(`[MT4Connector] ⏰ Timeout manuel pour ${id}`);
      this.debugDeleteCommand(id, "timeout-manuel", true);
      pending.reject(new Error(`Timeout commande ${id}`));
    }
  }
  
  console.log(`[MT4Connector] 🔄 Total itérations: ${iterationCount}`);

  for (const [id, pending] of this.pendingCommands) {
    console.log(`[MT4Connector] ⏰ Commande ${id} - hasResponseTimeoutId: ${!!pending.responseTimeoutId}, age: ${now - pending.timestamp}ms`);
    
    // PROTECTION CRITIQUE : Si la commande a un responseTimeoutId, 
    // le timeout est géré par setTimeout, pas par cette fonction
    if (pending.responseTimeoutId) {
      console.log(`[MT4Connector] ⏰ Skip ${id} (a responseTimeoutId)`);
      continue;
    }
    
    // Seulement pour les anciennes commandes sans responseTimeoutId
    if (now - pending.timestamp > pending.timeout) {
      console.log(`[MT4Connector] ⏰ Timeout manuel pour ${id}`);
      this.debugDeleteCommand(id, "timeout-manuel", true);
      pending.reject(new Error(`Timeout commande ${id}`));
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