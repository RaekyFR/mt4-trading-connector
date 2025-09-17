// nodejs/src/utils/PriceValidator.js

class PriceValidator {
  constructor() {
    // Définir des ranges de prix réalistes par symbole
    this.priceRanges = {
      'BTCUSD': { min: 10000, max: 200000, digits: 2 },
      'EURUSD': { min: 0.8, max: 1.5, digits: 5 },
      'GBPUSD': { min: 1.0, max: 2.0, digits: 5 },
      'USDJPY': { min: 80, max: 200, digits: 3 },
      'XAUUSD': { min: 1500, max: 3000, digits: 2 },
      'USDCHF': { min: 0.8, max: 1.3, digits: 5 },
      'AUDUSD': { min: 0.5, max: 1.0, digits: 5 },
      'USDCAD': { min: 1.0, max: 1.6, digits: 5 }
    };
  }

  /**
   * Valide et corrige les prix reçus de TradingView
   * @param {Object} signal - Signal brut
   * @returns {Object} Signal avec prix corrigés
   */
  validateAndFixPrices(signal) {
    const symbol = signal.symbol;
    console.log(`[PriceValidator] Validation des prix pour ${symbol}:`, {
      current_price: signal.current_price,
      entry_price: signal.entry_price,
      stop_loss: signal.stop_loss
    });
    
    const range = this.priceRanges[symbol];
    if (!range) {
      console.warn(`[PriceValidator] Aucun range défini pour ${symbol}`);
      return signal;
    }
    
    let correctedSignal = { ...signal };
    let correctionApplied = false;
    
    // Vérifier current_price
    if (signal.current_price) {
      const result = this.validatePrice('current_price', signal.current_price, range);
      if (result.corrected) {
        correctedSignal.current_price = result.price;
        correctionApplied = true;
      }
    }
    
    // Vérifier entry_price si présent et > 0
    if (signal.entry_price && signal.entry_price > 0) {
      const result = this.validatePrice('entry_price', signal.entry_price, range);
      if (result.corrected) {
        correctedSignal.entry_price = result.price;
        correctionApplied = true;
      }
    }
    
    // Vérifier stop_loss
    if (signal.stop_loss) {
      const result = this.validatePrice('stop_loss', signal.stop_loss, range, true);
      if (result.corrected) {
        correctedSignal.stop_loss = result.price;
        correctionApplied = true;
      }
    }
    
    // Vérifier la cohérence entre les prix
    this.validatePriceCoherence(correctedSignal, range);
    
    if (correctionApplied) {
      console.log(`[PriceValidator] Signal corrigé:`, {
        original: signal,
        corrected: correctedSignal
      });
    }
    
    return correctedSignal;
  }

  /**
   * Valide et corrige un prix individuel
   */
  validatePrice(priceType, price, range, allowWideRange = false) {
    const numPrice = parseFloat(price);
    
    // Vérifier si le prix est dans la range normale
    if (numPrice >= range.min && numPrice <= range.max) {
      return { price: numPrice, corrected: false };
    }
    
    // Si trop élevé, essayer de corriger en divisant
    if (numPrice > range.max) {
      const corrections = [10, 100, 1000];
      
      for (const divisor of corrections) {
        const correctedPrice = numPrice / divisor;
        if (correctedPrice >= range.min && correctedPrice <= range.max) {
          console.log(`[PriceValidator] ${priceType} corrigé: ${numPrice} -> ${correctedPrice} (÷${divisor})`);
          return { price: correctedPrice, corrected: true };
        }
      }
    }
    
    // Si stop_loss, autoriser une range plus large (pour les SL éloignés)
    if (allowWideRange && numPrice > range.max) {
      const maxDistance = range.max * 2; // Autoriser jusqu'à 2x la valeur max
      if (numPrice <= maxDistance) {
        console.warn(`[PriceValidator] ${priceType} dans la range étendue: ${numPrice}`);
        return { price: numPrice, corrected: false };
      }
    }
    
    // Si aucune correction possible
    throw new Error(`${priceType} hors range pour ${range}: ${numPrice} (attendu: ${range.min}-${range.max})`);
  }

  /**
   * Vérifie la cohérence entre les différents prix
   */
  validatePriceCoherence(signal, range) {
    const referencePrice = signal.current_price || signal.entry_price;
    
    if (!referencePrice || !signal.stop_loss) {
      return; // Pas assez de données pour valider
    }
    
    const stopDistance = Math.abs(referencePrice - signal.stop_loss);
    const maxDistance = referencePrice * 0.5; // Max 50% de distance
    
    if (stopDistance > maxDistance) {
      console.warn(`[PriceValidator] Stop Loss suspect:`, {
        symbol: signal.symbol,
        referencePrice,
        stopLoss: signal.stop_loss,
        distance: stopDistance,
        maxAllowed: maxDistance,
        percentDistance: ((stopDistance / referencePrice) * 100).toFixed(2) + '%'
      });
    }
  }

  /**
   * Obtient les spécifications pour un symbole
   */
  getSymbolSpecs(symbol) {
    return this.priceRanges[symbol] || {
      min: 0,
      max: 999999,
      digits: 5
    };
  }
}

module.exports = PriceValidator;