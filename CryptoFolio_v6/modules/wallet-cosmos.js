/**
 * ═══════════════════════════════════════════════════════════════
 * CRYPTOFOLIO v6 - MODULO WALLET COSMOS
 * ═══════════════════════════════════════════════════════════════
 * 
 * Gestisce i wallet Cosmos (Terra Classic, ATOM, Osmosis)
 * - Terra FCD API
 * - Cosmos REST API
 * - Normalizza dati in formato universale
 */

const WalletCosmos = (function() {
    
    // ═══════════════════════════════════════════════════════════
    // CONFIGURAZIONE CHAINS
    // ═══════════════════════════════════════════════════════════
    
    const COSMOS_CONFIG = {
        terra: {
            name: 'Terra Classic',
            symbol: 'LUNC',
            denom: 'uluna',
            decimals: 6,
            api: 'https://terra-classic-fcd.publicnode.com',
            validDenoms: {
                'uluna': { symbol: 'LUNC', decimals: 6 },
                'uusd': { symbol: 'USTC', decimals: 6 }
            }
        },
        atom: {
            name: 'Cosmos Hub',
            symbol: 'ATOM',
            denom: 'uatom',
            decimals: 6,
            api: 'https://cosmos-rest.publicnode.com',
            validDenoms: {
                'uatom': { symbol: 'ATOM', decimals: 6 }
            }
        },
        osmo: {
            name: 'Osmosis',
            symbol: 'OSMO',
            denom: 'uosmo',
            decimals: 6,
            api: 'https://osmosis-rest.publicnode.com',
            validDenoms: {
                'uosmo': { symbol: 'OSMO', decimals: 6 }
            }
        }
    };
    
    // ═══════════════════════════════════════════════════════════
    // RILEVA CHAIN DA INDIRIZZO
    // ═══════════════════════════════════════════════════════════
    
    function detectChain(address) {
        if (address.startsWith('terra1')) return 'terra';
        if (address.startsWith('cosmos1')) return 'atom';
        if (address.startsWith('osmo1')) return 'osmo';
        return null;
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN BALANCE
    // ═══════════════════════════════════════════════════════════
    
    async function scanBalance(address) {
        const chainKey = detectChain(address);
        if (!chainKey) {
            return { success: false, error: 'Indirizzo Cosmos non riconosciuto' };
        }
        
        const config = COSMOS_CONFIG[chainKey];
        const balances = [];
        
        try {
            Logger.info('WalletCosmos', `Scanning balance ${chainKey}: ${address.slice(0,12)}...`);
            
            const url = `${config.api}/cosmos/bank/v1beta1/balances/${address}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            for (const bal of data.balances || []) {
                const denomInfo = config.validDenoms[bal.denom];
                
                // Salta denom non riconosciuti (IBC, etc.)
                if (!denomInfo) continue;
                
                const amount = parseFloat(bal.amount) / Math.pow(10, denomInfo.decimals);
                
                if (amount > 0.000001) {
                    balances.push(createBalance({
                        coin: denomInfo.symbol,
                        amount: amount,
                        source: `wallet_${address.toLowerCase()}`,
                        chain: chainKey
                    }));
                }
            }
            
            Logger.success('WalletCosmos', `Trovati ${balances.length} token`);
            return { success: true, balances, chain: chainKey };
            
        } catch (error) {
            Logger.error('WalletCosmos', 'Errore scan balance', error);
            return { success: false, error: error.message };
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN TRANSAZIONI TERRA
    // ═══════════════════════════════════════════════════════════
    
    async function scanTerraTx(address) {
        const config = COSMOS_CONFIG.terra;
        const transactions = [];
        const addrLower = address.toLowerCase();
        
        try {
            Logger.info('WalletCosmos', `Scanning Terra tx: ${address.slice(0,12)}...`);
            
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            let totalFetched = 0;
            
            while (hasMore && totalFetched < 5000) {
                const url = `${config.api}/v1/txs?account=${address}&limit=${limit}&offset=${offset}`;
                const response = await fetch(url);
                
                if (!response.ok) break;
                
                const data = await response.json();
                const txs = data.txs || [];
                
                if (txs.length === 0) {
                    hasMore = false;
                    break;
                }
                
                for (const tx of txs) {
                    const parsed = parseTerraTransaction(tx, addrLower, config);
                    transactions.push(...parsed);
                }
                
                totalFetched += txs.length;
                offset += limit;
                
                // Rate limiting
                await sleep(200);
                
                Logger.info('WalletCosmos', `Scaricate ${totalFetched} tx...`);
            }
            
            Logger.success('WalletCosmos', `Parsate ${transactions.length} transazioni Terra`);
            return { success: true, transactions, chain: 'terra' };
            
        } catch (error) {
            Logger.error('WalletCosmos', 'Errore scan Terra tx', error);
            return { success: false, error: error.message };
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // PARSER TRANSAZIONE TERRA
    // ═══════════════════════════════════════════════════════════
    
    function parseTerraTransaction(tx, myAddress, config) {
        const results = [];
        
        try {
            const timestamp = tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now();
            const year = new Date(timestamp).getFullYear();
            const txHash = tx.txhash || '';
            
            // Skip tx fallite
            if (tx.code !== undefined && tx.code !== 0) return results;
            
            const msgs = tx.tx?.body?.messages || tx.tx?.value?.msg || [];
            
            for (const msg of msgs) {
                const msgType = msg['@type'] || msg.type || '';
                
                // ─────────────────────────────────────────────
                // MsgSend (Transfer)
                // ─────────────────────────────────────────────
                if (msgType.includes('MsgSend')) {
                    const fromAddr = (msg.from_address || msg.value?.from_address || '').toLowerCase();
                    const toAddr = (msg.to_address || msg.value?.to_address || '').toLowerCase();
                    const amounts = msg.amount || msg.value?.amount || [];
                    
                    const isOutgoing = fromAddr === myAddress;
                    const isIncoming = toAddr === myAddress;
                    
                    if (!isOutgoing && !isIncoming) continue;
                    
                    for (const amt of amounts) {
                        const denomInfo = config.validDenoms[amt.denom];
                        if (!denomInfo) continue;
                        
                        const amount = parseFloat(amt.amount) / Math.pow(10, denomInfo.decimals);
                        if (amount <= 0) continue;
                        
                        results.push(createTransaction({
                            source: `wallet_${myAddress}`,
                            sourceId: txHash,
                            timestamp,
                            date: new Date(timestamp).toISOString(),
                            year,
                            type: isOutgoing ? 'withdrawal' : 'deposit',
                            coinIn: isIncoming ? denomInfo.symbol : '',
                            amountIn: isIncoming ? amount : 0,
                            coinOut: isOutgoing ? denomInfo.symbol : '',
                            amountOut: isOutgoing ? amount : 0,
                            wallet: myAddress,
                            chain: 'terra',
                            notes: isOutgoing ? 'Send' : 'Receive'
                        }));
                    }
                }
                
                // ─────────────────────────────────────────────
                // MsgDelegate (Staking)
                // ─────────────────────────────────────────────
                else if (msgType.includes('MsgDelegate')) {
                    const denomInfo = config.validDenoms[msg.amount?.denom || 'uluna'];
                    if (!denomInfo) continue;
                    
                    const amount = parseFloat(msg.amount?.amount || 0) / Math.pow(10, denomInfo.decimals);
                    if (amount <= 0) continue;
                    
                    results.push(createTransaction({
                        source: `wallet_${myAddress}`,
                        sourceId: txHash,
                        timestamp,
                        date: new Date(timestamp).toISOString(),
                        year,
                        type: 'staking',
                        coinOut: denomInfo.symbol,
                        amountOut: amount,
                        wallet: myAddress,
                        chain: 'terra',
                        notes: 'Delegate (Staking)'
                    }));
                }
                
                // ─────────────────────────────────────────────
                // MsgUndelegate (Unstaking)
                // ─────────────────────────────────────────────
                else if (msgType.includes('MsgUndelegate')) {
                    const denomInfo = config.validDenoms[msg.amount?.denom || 'uluna'];
                    if (!denomInfo) continue;
                    
                    const amount = parseFloat(msg.amount?.amount || 0) / Math.pow(10, denomInfo.decimals);
                    if (amount <= 0) continue;
                    
                    results.push(createTransaction({
                        source: `wallet_${myAddress}`,
                        sourceId: txHash,
                        timestamp,
                        date: new Date(timestamp).toISOString(),
                        year,
                        type: 'staking',
                        coinIn: denomInfo.symbol,
                        amountIn: amount,
                        wallet: myAddress,
                        chain: 'terra',
                        notes: 'Undelegate (Unstaking)'
                    }));
                }
            }
            
            // ─────────────────────────────────────────────
            // Fee
            // ─────────────────────────────────────────────
            const fees = tx.tx?.auth_info?.fee?.amount || tx.tx?.value?.fee?.amount || [];
            for (const fee of fees) {
                const denomInfo = config.validDenoms[fee.denom];
                if (!denomInfo) continue;
                
                const feeAmount = parseFloat(fee.amount) / Math.pow(10, denomInfo.decimals);
                if (feeAmount > 0) {
                    results.push(createTransaction({
                        source: `wallet_${myAddress}`,
                        sourceId: `${txHash}_fee`,
                        timestamp,
                        date: new Date(timestamp).toISOString(),
                        year,
                        type: 'fee',
                        coinOut: denomInfo.symbol,
                        amountOut: feeAmount,
                        feeCoin: denomInfo.symbol,
                        feeAmount: feeAmount,
                        wallet: myAddress,
                        chain: 'terra',
                        notes: 'Transaction Fee'
                    }));
                }
            }
            
        } catch (error) {
            Logger.warn('WalletCosmos', 'Errore parsing tx', error);
        }
        
        return results;
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN COMPLETO
    // ═══════════════════════════════════════════════════════════
    
    async function fullScan(address) {
        const chainKey = detectChain(address);
        if (!chainKey) {
            return { success: false, error: 'Indirizzo non riconosciuto' };
        }
        
        Logger.info('WalletCosmos', `Full scan ${chainKey}: ${address.slice(0,12)}...`);
        
        // Scan balance
        const balanceResult = await scanBalance(address);
        
        // Scan transazioni (solo Terra per ora)
        let txResult = { success: true, transactions: [] };
        if (chainKey === 'terra') {
            txResult = await scanTerraTx(address);
        }
        
        // Aggiungi al database
        if (txResult.success && txResult.transactions.length > 0) {
            Database.addTransactions(txResult.transactions);
        }
        
        // Aggiorna balances
        if (balanceResult.success && balanceResult.balances.length > 0) {
            for (const bal of balanceResult.balances) {
                const key = `${bal.coin}_${bal.chain}`;
                Database.updateBalance(key, bal);
            }
        }
        
        return {
            success: true,
            chain: chainKey,
            balances: balanceResult.balances || [],
            transactions: txResult.transactions || []
        };
    }
    
    // ═══════════════════════════════════════════════════════════
    // HELPER
    // ═══════════════════════════════════════════════════════════
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════
    
    return {
        detectChain,
        scanBalance,
        scanTerraTx,
        fullScan,
        COSMOS_CONFIG
    };
    
})();
