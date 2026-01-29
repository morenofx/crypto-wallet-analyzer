/**
 * ═══════════════════════════════════════════════════════════════
 * CRYPTOFOLIO v6 - MODULO DATABASE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Gestisce la persistenza dei dati:
 * - Firebase Firestore (cloud)
 * - LocalStorage (backup locale)
 */

const Database = (function() {
    
    let db = null;
    let isInitialized = false;
    let saveTimeout = null;
    
    // ═══════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════
    
    async function init() {
        if (isInitialized) return true;
        
        try {
            // Inizializza Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            db = firebase.firestore();
            
            // Carica dati esistenti
            await load();
            
            isInitialized = true;
            Logger.success('Database', 'Inizializzato');
            return true;
            
        } catch (error) {
            Logger.error('Database', 'Errore inizializzazione', error);
            
            // Fallback a localStorage
            loadFromLocal();
            return false;
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // LOAD (da Firebase)
    // ═══════════════════════════════════════════════════════════
    
    async function load() {
        try {
            const doc = await db.collection('cryptofolio_v6').doc('data').get();
            
            if (doc.exists) {
                const data = doc.data();
                
                // Popola AppState
                AppState.transactions = data.transactions || [];
                AppState.balances = data.balances || {};
                AppState.wallets = data.wallets || [];
                AppState.exchanges = data.exchanges || {};
                AppState.apiKeys = data.apiKeys || {};
                AppState.prices = data.prices || {};
                AppState.historicalPrices = data.historicalPrices || {};
                AppState.selectedChains = data.selectedChains || ['eth', 'bsc', 'polygon'];
                AppState.lastSync = data.lastSync || null;
                
                Logger.success('Database', `Caricati: ${AppState.transactions.length} tx, ${AppState.wallets.length} wallet`);
            } else {
                Logger.info('Database', 'Nessun dato esistente, inizializzo vuoto');
            }
            
            // Salva anche in localStorage come backup
            saveToLocal();
            
        } catch (error) {
            Logger.error('Database', 'Errore caricamento Firebase', error);
            loadFromLocal();
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // SAVE (su Firebase) - con debounce
    // ═══════════════════════════════════════════════════════════
    
    function save() {
        // Debounce: salva solo dopo 2 secondi di inattività
        if (saveTimeout) clearTimeout(saveTimeout);
        
        saveTimeout = setTimeout(async () => {
            await saveNow();
        }, 2000);
    }
    
    async function saveNow() {
        if (!db) {
            saveToLocal();
            return;
        }
        
        try {
            AppState.isSyncing = true;
            updateSyncStatus('Salvataggio...', 'orange');
            
            const data = {
                transactions: AppState.transactions,
                balances: AppState.balances,
                wallets: AppState.wallets,
                exchanges: AppState.exchanges,
                apiKeys: AppState.apiKeys,
                prices: AppState.prices,
                historicalPrices: AppState.historicalPrices,
                selectedChains: AppState.selectedChains,
                lastSync: Date.now()
            };
            
            // Verifica dimensione (Firebase ha limite 1MB per documento)
            const size = new Blob([JSON.stringify(data)]).size;
            if (size > 900000) { // 900KB safety margin
                Logger.warn('Database', `Dati troppo grandi (${(size/1024).toFixed(0)}KB), splitto...`);
                await saveSplit(data);
            } else {
                await db.collection('cryptofolio_v6').doc('data').set(data);
            }
            
            // Backup locale
            saveToLocal();
            
            AppState.lastSync = Date.now();
            AppState.isSyncing = false;
            updateSyncStatus('Salvato ✓', 'green');
            Logger.success('Database', 'Salvato su Firebase');
            
        } catch (error) {
            AppState.isSyncing = false;
            updateSyncStatus('Errore sync', 'red');
            Logger.error('Database', 'Errore salvataggio', error);
            saveToLocal();
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // SAVE SPLIT (se dati troppo grandi)
    // ═══════════════════════════════════════════════════════════
    
    async function saveSplit(data) {
        // Salva transazioni separatamente
        const txChunks = chunkArray(data.transactions, 500);
        for (let i = 0; i < txChunks.length; i++) {
            await db.collection('cryptofolio_v6').doc(`transactions_${i}`).set({
                transactions: txChunks[i],
                chunkIndex: i,
                totalChunks: txChunks.length
            });
        }
        
        // Salva resto senza transazioni
        const mainData = { ...data, transactions: [], txChunks: txChunks.length };
        await db.collection('cryptofolio_v6').doc('data').set(mainData);
    }
    
    function chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    
    // ═══════════════════════════════════════════════════════════
    // LOCAL STORAGE (backup)
    // ═══════════════════════════════════════════════════════════
    
    function saveToLocal() {
        try {
            const data = {
                transactions: AppState.transactions,
                balances: AppState.balances,
                wallets: AppState.wallets,
                exchanges: AppState.exchanges,
                apiKeys: AppState.apiKeys,
                selectedChains: AppState.selectedChains,
                lastSync: AppState.lastSync
            };
            
            localStorage.setItem('cryptofolio_v6_backup', JSON.stringify(data));
            Logger.info('Database', 'Backup locale salvato');
            
        } catch (error) {
            Logger.error('Database', 'Errore backup locale', error);
        }
    }
    
    function loadFromLocal() {
        try {
            const saved = localStorage.getItem('cryptofolio_v6_backup');
            if (saved) {
                const data = JSON.parse(saved);
                
                AppState.transactions = data.transactions || [];
                AppState.balances = data.balances || {};
                AppState.wallets = data.wallets || [];
                AppState.exchanges = data.exchanges || {};
                AppState.apiKeys = data.apiKeys || {};
                AppState.selectedChains = data.selectedChains || ['eth', 'bsc', 'polygon'];
                AppState.lastSync = data.lastSync || null;
                
                Logger.success('Database', 'Caricato da backup locale');
            }
        } catch (error) {
            Logger.error('Database', 'Errore caricamento locale', error);
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // CRUD TRANSACTIONS
    // ═══════════════════════════════════════════════════════════
    
    function addTransaction(tx) {
        // Evita duplicati
        const exists = AppState.transactions.find(t => 
            t.sourceId === tx.sourceId && t.source === tx.source
        );
        
        if (!exists) {
            AppState.transactions.push(tx);
            save();
            return true;
        }
        return false;
    }
    
    function addTransactions(txList) {
        let added = 0;
        for (const tx of txList) {
            if (addTransaction(tx)) added++;
        }
        Logger.info('Database', `Aggiunte ${added}/${txList.length} transazioni`);
        return added;
    }
    
    function getTransactions(filter = {}) {
        let result = AppState.transactions;
        
        if (filter.source) {
            result = result.filter(t => t.source === filter.source);
        }
        if (filter.year) {
            result = result.filter(t => t.year === filter.year);
        }
        if (filter.coin) {
            result = result.filter(t => t.coinIn === filter.coin || t.coinOut === filter.coin);
        }
        if (filter.type) {
            result = result.filter(t => t.type === filter.type);
        }
        
        // Ordina per data (più recenti prima)
        result.sort((a, b) => b.timestamp - a.timestamp);
        
        return result;
    }
    
    function deleteTransactions(filter) {
        const before = AppState.transactions.length;
        
        if (filter.source) {
            AppState.transactions = AppState.transactions.filter(t => t.source !== filter.source);
        }
        
        const deleted = before - AppState.transactions.length;
        if (deleted > 0) {
            save();
            Logger.info('Database', `Eliminate ${deleted} transazioni`);
        }
        return deleted;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CRUD WALLETS
    // ═══════════════════════════════════════════════════════════
    
    function addWallet(wallet) {
        const exists = AppState.wallets.find(w => 
            w.address.toLowerCase() === wallet.address.toLowerCase()
        );
        
        if (!exists) {
            AppState.wallets.push(wallet);
            save();
            return true;
        }
        return false;
    }
    
    function removeWallet(address) {
        const index = AppState.wallets.findIndex(w => 
            w.address.toLowerCase() === address.toLowerCase()
        );
        
        if (index !== -1) {
            AppState.wallets.splice(index, 1);
            save();
            return true;
        }
        return false;
    }
    
    function getWallets() {
        return AppState.wallets;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CRUD BALANCES
    // ═══════════════════════════════════════════════════════════
    
    function updateBalance(coin, data) {
        AppState.balances[coin] = {
            ...AppState.balances[coin],
            ...data,
            lastUpdate: Date.now()
        };
        save();
    }
    
    function getBalances() {
        return AppState.balances;
    }
    
    // ═══════════════════════════════════════════════════════════
    // API KEYS (con supporto multi-key per Moralis)
    // ═══════════════════════════════════════════════════════════
    
    function setApiKey(name, value) {
        if (name === 'moralis') {
            // Moralis supporta array di keys
            if (Array.isArray(value)) {
                AppState.apiKeys.moralis = value;
            } else {
                // Singola key -> aggiungi all'array se non esiste
                const keys = AppState.apiKeys.moralis || [];
                if (value && !keys.includes(value)) {
                    keys.push(value);
                }
                AppState.apiKeys.moralis = keys;
            }
        } else {
            AppState.apiKeys[name] = value;
        }
        save();
    }
    
    function addMoralisKey(key) {
        if (!key) return false;
        const keys = AppState.apiKeys.moralis || [];
        if (!keys.includes(key)) {
            keys.push(key);
            AppState.apiKeys.moralis = keys;
            save();
            return true;
        }
        return false;
    }
    
    function removeMoralisKey(index) {
        const keys = AppState.apiKeys.moralis || [];
        if (index >= 0 && index < keys.length) {
            keys.splice(index, 1);
            AppState.apiKeys.moralis = keys;
            save();
            return true;
        }
        return false;
    }
    
    function getMoralisKeys() {
        return AppState.apiKeys.moralis || [];
    }
    
    function getNextMoralisKey() {
        const keys = AppState.apiKeys.moralis || [];
        if (keys.length === 0) return null;
        
        // Rotazione circolare
        const key = keys[AppState.currentMoralisIndex % keys.length];
        AppState.currentMoralisIndex++;
        return key;
    }
    
    function getApiKey(name) {
        if (name === 'moralis') {
            // Ritorna la prossima key disponibile
            return getNextMoralisKey();
        }
        return AppState.apiKeys[name] || '';
    }
    
    // ═══════════════════════════════════════════════════════════
    // UI HELPER
    // ═══════════════════════════════════════════════════════════
    
    function updateSyncStatus(text, color) {
        const statusEl = document.getElementById('syncStatus');
        const dotEl = document.getElementById('syncDot');
        
        if (statusEl) statusEl.textContent = text;
        if (dotEl) dotEl.style.background = color;
    }
    
    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════
    
    return {
        init,
        save,
        saveNow,
        
        // Transactions
        addTransaction,
        addTransactions,
        getTransactions,
        deleteTransactions,
        
        // Wallets
        addWallet,
        removeWallet,
        getWallets,
        
        // Balances
        updateBalance,
        getBalances,
        
        // API Keys
        setApiKey,
        getApiKey,
        addMoralisKey,
        removeMoralisKey,
        getMoralisKeys,
        getNextMoralisKey,
        
        // State access
        getState: () => AppState
    };
    
})();
