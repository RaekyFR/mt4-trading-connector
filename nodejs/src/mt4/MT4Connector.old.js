// MT4Connector simplifié - Version sans queue complexe
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
  }

  async start() {
    console.log('[MT4Connector] Démarrage...');
    await this.cleanup();
    this.isConnected = true;
    console.log('[MT4Connector] ✅ Connecté');
  }

  async stop() {
    this.isConnected = false;
    await this.cleanup();
    console.log('[MT4Connector] Arrêté');
  }

  /**
   * Envoie une commande - VERSION SIMPLIFIÉE
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
   * Attendre que le fichier command soit disponible
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
   * Attendre la réponse de MT4
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
   * Méthodes MT4 simplifiées
   */
  async getBalance() {
    return await this.sendCommand({ command: 'getBalance' });
  }

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

    return await this.sendCommand(command, 30000); // 30s pour les ordres
  }

  async getOpenOrders() {
    const result = await this.sendCommand({ command: 'getAllMarketOrders' });
    return result.orders || [];
  }

  async closeOrder(ticket) {
    return await this.sendCommand({
      command: 'closeMarketOrder',
      ticket: ticket
    });
  }

  async modifyOrder(ticket, stopLoss = 0, takeProfit = 0) {
    return await this.sendCommand({
      command: 'modifyOrder',
      ticket: ticket,
      sl: stopLoss,
      tp: takeProfit
    });
  }

  /**
   * Vérification de connexion simplifiée
   */
  async checkConnection() {
    try {
      await this.getBalance();
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Helpers
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