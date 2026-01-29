/**
 * ═══════════════════════════════════════════════════════════════
 * CRYPTOFOLIO v6 - SCHEMA DATABASE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Questo file definisce la struttura dati UNIVERSALE.
 * Tutti i moduli (Binance, Terra, Moralis, etc.) devono 
 * convertire i loro dati in questo formato.
 * 
 * REGOLA D'ORO: Se cambi questo schema, tutti i moduli si adattano.
 */

const DB_SCHEMA = {
    
    // ═══════════════════════════════════════════════════════════
    // TRANSAZIONE UNIVERSALE
    // ═══════════════════════════════════════════════════════════
    // Ogni movimento (deposito, prelievo, trade, fee) diventa questo
    
    Transaction: {
        id: '',              // UUID univoco
        source: '',          // 'binance' | 'coinbase' | 'terra' | 'wallet_evm' | etc.
        sourceId: '',        // ID originale dalla fonte (txhash, orderId, etc.)
        
        // QUANDO
        timestamp: 0,        // Unix timestamp (milliseconds)
        date: '',            // ISO 8601: '2024-01-15T10:30:00Z'
        year: 0,             // Per raggruppamento fiscale: 2024
        
        // COSA
        type: '',            // 'deposit' | 'withdrawal' | 'trade' | 'fee' | 'staking_reward' | 'airdrop'
        
        // IMPORTI
        coinIn: '',          // Coin ricevuto (es: 'BTC')
        amountIn: 0,         // Quantità ricevuta
        coinOut: '',         // Coin inviato (es: 'EUR')
        amountOut: 0,        // Quantità inviata
        
        // VALORI IN EUR (per calcoli fiscali)
        valueEUR: 0,         // Valore in EUR al momento della transazione
        priceEUR: 0,         // Prezzo unitario in EUR
        
        // FEES
        feeCoin: '',         // Coin usato per fee
        feeAmount: 0,        // Quantità fee
        feeEUR: 0,           // Valore fee in EUR
        
        // METADATA
        wallet: '',          // Indirizzo wallet (se applicabile)
        chain: '',           // 'eth' | 'bsc' | 'terra' | 'cosmos' | etc.
        notes: '',           // Note aggiuntive
        
        // TRACKING
        importedAt: 0,       // Quando è stato importato
        verified: false      // Verificato manualmente
    },
    
    // ═══════════════════════════════════════════════════════════
    // BALANCE (Saldo attuale)
    // ═══════════════════════════════════════════════════════════
    
    Balance: {
        coin: '',            // 'BTC', 'ETH', 'LUNC', etc.
        amount: 0,           // Quantità
        source: '',          // 'binance' | 'wallet_0x123...' | etc.
        chain: '',           // Chain se wallet
        priceEUR: 0,         // Prezzo attuale
        valueEUR: 0,         // Valore attuale
        lastUpdate: 0        // Ultimo aggiornamento
    },
    
    // ═══════════════════════════════════════════════════════════
    // PREZZO STORICO (per calcoli fiscali)
    // ═══════════════════════════════════════════════════════════
    
    HistoricalPrice: {
        coin: '',            // 'BTC'
        date: '',            // '2024-01-15'
        priceEUR: 0,         // Prezzo in EUR
        source: ''           // 'coingecko' | 'cryptocompare'
    },
    
    // ═══════════════════════════════════════════════════════════
    // WALLET
    // ═══════════════════════════════════════════════════════════
    
    Wallet: {
        id: '',              // UUID
        name: '',            // 'Main Wallet', 'Cold Storage'
        address: '',         // Indirizzo
        type: '',            // 'evm' | 'solana' | 'cosmos'
        chain: '',           // 'eth' | 'bsc' | 'terra' | 'atom' | 'osmo'
        addedAt: 0,          // Quando aggiunto
        lastSync: 0          // Ultimo sync
    },
    
    // ═══════════════════════════════════════════════════════════
    // EXCHANGE
    // ═══════════════════════════════════════════════════════════
    
    Exchange: {
        id: '',              // 'binance', 'coinbase', etc.
        name: '',            // Nome display
        hasApi: false,       // Supporta API?
        apiKey: '',          // API key (encrypted)
        apiSecret: '',       // API secret (encrypted)
        lastSync: 0          // Ultimo sync
    },
    
    // ═══════════════════════════════════════════════════════════
    // REPORT FISCALE
    // ═══════════════════════════════════════════════════════════
    
    TaxReport: {
        year: 0,             // Anno fiscale
        
        // Quadro RW (Monitoraggio)
        rw_valore_iniziale: 0,
        rw_valore_finale: 0,
        rw_giorni_detenzione: 0,
        rw_ivafe: 0,         // 0.2% sul valore
        
        // Quadro RT (Plusvalenze)
        rt_totale_vendite: 0,
        rt_costo_acquisto: 0,
        rt_plusvalenza: 0,
        rt_minusvalenza: 0,
        rt_imposta: 0,       // 26% sulla plusvalenza
        
        generatedAt: 0
    }
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Crea transazione vuota
// ═══════════════════════════════════════════════════════════════

function createTransaction(data = {}) {
    return {
        id: data.id || generateUUID(),
        source: data.source || '',
        sourceId: data.sourceId || '',
        timestamp: data.timestamp || Date.now(),
        date: data.date || new Date().toISOString(),
        year: data.year || new Date().getFullYear(),
        type: data.type || 'unknown',
        coinIn: data.coinIn || '',
        amountIn: parseFloat(data.amountIn) || 0,
        coinOut: data.coinOut || '',
        amountOut: parseFloat(data.amountOut) || 0,
        valueEUR: parseFloat(data.valueEUR) || 0,
        priceEUR: parseFloat(data.priceEUR) || 0,
        feeCoin: data.feeCoin || '',
        feeAmount: parseFloat(data.feeAmount) || 0,
        feeEUR: parseFloat(data.feeEUR) || 0,
        wallet: data.wallet || '',
        chain: data.chain || '',
        notes: data.notes || '',
        importedAt: Date.now(),
        verified: false
    };
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Crea balance vuoto
// ═══════════════════════════════════════════════════════════════

function createBalance(data = {}) {
    return {
        coin: data.coin || '',
        amount: parseFloat(data.amount) || 0,
        source: data.source || '',
        chain: data.chain || '',
        priceEUR: parseFloat(data.priceEUR) || 0,
        valueEUR: parseFloat(data.valueEUR) || 0,
        lastUpdate: Date.now()
    };
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Genera UUID
// ═══════════════════════════════════════════════════════════════

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Export per uso in altri moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DB_SCHEMA, createTransaction, createBalance, generateUUID };
}
