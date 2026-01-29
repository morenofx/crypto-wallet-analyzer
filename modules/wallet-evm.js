/**
 * ═══════════════════════════════════════════════════════════════
 * CRYPTOFOLIO v6 - MODULO WALLET EVM
 * ═══════════════════════════════════════════════════════════════
 * 
 * Gestisce i wallet EVM (Ethereum, BSC, Polygon, etc.)
 * - Scan token via Moralis
 * - Transazioni via Etherscan/BscScan
 * - Normalizza dati in formato universale
 */

const WalletEVM = (function() {
    
    const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';
    
    // Chain IDs per Moralis
    const MORALIS_CHAINS = {
        'eth': '0x1',
        'bsc': '0x38',
        'polygon': '0x89',
        'arbitrum': '0xa4b1',
        'base': '0x2105',
        'avalanche': '0xa86a',
        'fantom': '0xfa',
        'cronos': '0x19'
    };
    
    // PulseChain (non supportato da Moralis, usa PulseScan)
    const PULSESCAN_API = 'https://api.scan.pulsechain.com/api';
    
    // Explorer APIs
    const EXPLORER_APIS = {
        'eth': 'https://api.etherscan.io/api',
        'bsc': 'https://api.bscscan.com/api',
        'polygon': 'https://api.polygonscan.com/api',
        'arbitrum': 'https://api.arbiscan.io/api',
        'base': 'https://api.basescan.org/api',
        'pulse': 'https://api.scan.pulsechain.com/api'
    };
    
    // ═══════════════════════════════════════════════════════════
    // FILTRO SPAM/SCAM TOKEN (come v5.2)
    // ═══════════════════════════════════════════════════════════
    
    const SPAM_PATTERNS = [
        'visit', 'claim', 'reward', '.com', '.org', '.io', '.xyz', '.net',
        'airdrop', 'bonus', 'free', 'gift', 'http', 'www', '$', '#',
        'giveaway', '100x', '1000x', 'elon', 'trump'
    ];
    
    function isSpamToken(name, symbol) {
        const n = (name || '').toLowerCase();
        const s = (symbol || '').toLowerCase();
        
        // Pattern spam
        for (const pattern of SPAM_PATTERNS) {
            if (n.includes(pattern) || s.includes(pattern)) {
                return true;
            }
        }
        
        // Nome troppo lungo (> 40 char) = spam
        if ((name || '').length > 40) {
            return true;
        }
        
        return false;
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN WALLET - TOKEN BALANCES
    // ═══════════════════════════════════════════════════════════
    
    async function scanTokens(address, chains = ['eth', 'bsc', 'polygon']) {
        const moralisKeys = Database.getMoralisKeys();
        
        if (!moralisKeys || moralisKeys.length === 0) {
            Logger.warn('WalletEVM', 'API Keys Moralis mancanti');
            return { success: false, error: 'Inserisci almeno una API Key Moralis nelle impostazioni' };
        }
        
        const allBalances = [];
        
        for (const chainKey of chains) {
            const chainId = MORALIS_CHAINS[chainKey];
            if (!chainId) continue;
            
            try {
                Logger.info('WalletEVM', `Scanning ${chainKey} per ${address.slice(0,8)}...`);
                
                // Prova con rotazione API keys
                let nativeData = null;
                let lastError = null;
                
                for (let attempt = 0; attempt < moralisKeys.length; attempt++) {
                    const apiKey = Database.getNextMoralisKey();
                    if (!apiKey) break;
                    
                    try {
                        // Native balance
                        const nativeUrl = `${MORALIS_BASE}/${address}/balance?chain=${chainId}`;
                        const nativeResp = await fetch(nativeUrl, {
                            headers: { 'X-API-Key': apiKey }
                        });
                        
                        if (nativeResp.ok) {
                            nativeData = await nativeResp.json();
                            break; // Successo!
                        } else if (nativeResp.status === 429) {
                            Logger.warn('WalletEVM', `Rate limit su key ${attempt + 1}, provo la prossima...`);
                            continue;
                        } else {
                            lastError = `HTTP ${nativeResp.status}`;
                        }
                    } catch (e) {
                        lastError = e.message;
                    }
                }
                
                if (nativeData) {
                    const chain = CHAINS[chainKey];
                    const balance = parseFloat(nativeData.balance) / 1e18;
                    
                    if (balance > 0.0001) {
                        allBalances.push(createBalance({
                            coin: chain.symbol,
                            amount: balance,
                            source: `wallet_${address.toLowerCase()}`,
                            chain: chainKey
                        }));
                    }
                }
                
                // Token balances (con rotazione)
                let tokensData = null;
                
                for (let attempt = 0; attempt < moralisKeys.length; attempt++) {
                    const apiKey = Database.getNextMoralisKey();
                    if (!apiKey) break;
                    
                    try {
                        const tokenUrl = `${MORALIS_BASE}/${address}/erc20?chain=${chainId}`;
                        const tokenResp = await fetch(tokenUrl, {
                            headers: { 'X-API-Key': apiKey }
                        });
                        
                        if (tokenResp.ok) {
                            tokensData = await tokenResp.json();
                            break;
                        } else if (tokenResp.status === 429) {
                            continue;
                        }
                    } catch (e) {
                        // Retry
                    }
                }
                
                if (tokensData) {
                    for (const token of tokensData) {
                        const decimals = parseInt(token.decimals) || 18;
                        const balance = parseFloat(token.balance) / Math.pow(10, decimals);
                        
                        // Filtra spam/scam durante scan (come v5.2)
                        if (isSpamToken(token.name, token.symbol)) {
                            Logger.info('WalletEVM', `Filtrato spam: ${token.symbol}`);
                            continue;
                        }
                        
                        if (balance > 0) {
                            allBalances.push(createBalance({
                                coin: token.symbol || 'UNKNOWN',
                                name: token.name || token.symbol || 'Unknown',
                                amount: balance,
                                source: `wallet_${address.toLowerCase()}`,
                                chain: chainKey,
                                logo: token.logo || token.thumbnail || null,
                                contractAddress: token.token_address || null
                            }));
                        }
                    }
                }
                
                // Rate limiting tra chain
                await sleep(500);
                
            } catch (error) {
                Logger.error('WalletEVM', `Errore scan ${chainKey}`, error);
            }
        }
        
        Logger.success('WalletEVM', `Trovati ${allBalances.length} token`);
        return { success: true, balances: allBalances };
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN TRANSAZIONI
    // ═══════════════════════════════════════════════════════════
    
    async function scanTransactions(address, chains = ['eth', 'bsc', 'polygon']) {
        const moralisKeys = Database.getMoralisKeys();
        
        if (!moralisKeys || moralisKeys.length === 0) {
            return { success: false, error: 'API Keys Moralis mancanti' };
        }
        
        const allTransactions = [];
        const addrLower = address.toLowerCase();
        
        for (const chainKey of chains) {
            const chainId = MORALIS_CHAINS[chainKey];
            if (!chainId) continue;
            
            try {
                Logger.info('WalletEVM', `Fetching tx ${chainKey}...`);
                
                // Native transfers (con rotazione)
                let nativeData = null;
                
                for (let attempt = 0; attempt < moralisKeys.length; attempt++) {
                    const apiKey = Database.getNextMoralisKey();
                    if (!apiKey) break;
                    
                    try {
                        const nativeUrl = `${MORALIS_BASE}/${address}?chain=${chainId}&limit=100`;
                        const nativeResp = await fetch(nativeUrl, {
                            headers: { 'X-API-Key': apiKey }
                        });
                        
                        if (nativeResp.ok) {
                            nativeData = await nativeResp.json();
                            break;
                        } else if (nativeResp.status === 429) {
                            Logger.warn('WalletEVM', `Rate limit, provo prossima key...`);
                            continue;
                        }
                    } catch (e) {
                        // Retry
                    }
                }
                
                if (nativeData) {
                    const chain = CHAINS[chainKey];
                    
                    for (const tx of nativeData.result || []) {
                        const value = parseFloat(tx.value) / 1e18;
                        if (value === 0) continue;
                        
                        const isIncoming = tx.to_address?.toLowerCase() === addrLower;
                        
                        allTransactions.push(createTransaction({
                            source: `wallet_${addrLower}`,
                            sourceId: tx.hash,
                            timestamp: new Date(tx.block_timestamp).getTime(),
                            date: tx.block_timestamp,
                            year: new Date(tx.block_timestamp).getFullYear(),
                            type: isIncoming ? 'deposit' : 'withdrawal',
                            coinIn: isIncoming ? chain.symbol : '',
                            amountIn: isIncoming ? value : 0,
                            coinOut: !isIncoming ? chain.symbol : '',
                            amountOut: !isIncoming ? value : 0,
                            feeCoin: chain.symbol,
                            feeAmount: parseFloat(tx.gas_price || 0) * parseFloat(tx.gas || 0) / 1e18,
                            wallet: addrLower,
                            chain: chainKey
                        }));
                    }
                }
                
                // ERC20 transfers (con rotazione)
                let tokenData = null;
                
                for (let attempt = 0; attempt < moralisKeys.length; attempt++) {
                    const apiKey = Database.getNextMoralisKey();
                    if (!apiKey) break;
                    
                    try {
                        const tokenUrl = `${MORALIS_BASE}/${address}/erc20/transfers?chain=${chainId}&limit=100`;
                        const tokenResp = await fetch(tokenUrl, {
                            headers: { 'X-API-Key': apiKey }
                        });
                        
                        if (tokenResp.ok) {
                            tokenData = await tokenResp.json();
                            break;
                        } else if (tokenResp.status === 429) {
                            continue;
                        }
                    } catch (e) {
                        // Retry
                    }
                }
                
                if (tokenData) {
                    for (const tx of tokenData.result || []) {
                        const decimals = parseInt(tx.token_decimals) || 18;
                        const value = parseFloat(tx.value) / Math.pow(10, decimals);
                        if (value === 0) continue;
                        
                        const isIncoming = tx.to_address?.toLowerCase() === addrLower;
                        const symbol = tx.token_symbol || 'UNKNOWN';
                        
                        allTransactions.push(createTransaction({
                            source: `wallet_${addrLower}`,
                            sourceId: tx.transaction_hash,
                            timestamp: new Date(tx.block_timestamp).getTime(),
                            date: tx.block_timestamp,
                            year: new Date(tx.block_timestamp).getFullYear(),
                            type: isIncoming ? 'deposit' : 'withdrawal',
                            coinIn: isIncoming ? symbol : '',
                            amountIn: isIncoming ? value : 0,
                            coinOut: !isIncoming ? symbol : '',
                            amountOut: !isIncoming ? value : 0,
                            wallet: addrLower,
                            chain: chainKey
                        }));
                    }
                }
                
                await sleep(500);
                
            } catch (error) {
                Logger.error('WalletEVM', `Errore tx ${chainKey}`, error);
            }
        }
        
        Logger.success('WalletEVM', `Trovate ${allTransactions.length} transazioni`);
        return { success: true, transactions: allTransactions };
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN COMPLETO (Token + Transazioni)
    // ═══════════════════════════════════════════════════════════
    
    async function fullScan(address, chains = ['eth', 'bsc', 'polygon']) {
        Logger.info('WalletEVM', `Full scan: ${address.slice(0,8)}...`);
        
        // Separa PulseChain dalle altre chain (Moralis non lo supporta)
        const moralisChains = chains.filter(c => c !== 'pulse');
        const includePulse = chains.includes('pulse');
        
        let allBalances = [];
        let allTransactions = [];
        
        // Scan chain Moralis
        if (moralisChains.length > 0) {
            const tokenResult = await scanTokens(address, moralisChains);
            const txResult = await scanTransactions(address, moralisChains);
            
            if (tokenResult.success) allBalances.push(...(tokenResult.balances || []));
            if (txResult.success) allTransactions.push(...(txResult.transactions || []));
        }
        
        // Scan PulseChain separatamente
        if (includePulse) {
            const pulseResult = await scanPulseChain(address);
            if (pulseResult.success) {
                allBalances.push(...(pulseResult.balances || []));
                allTransactions.push(...(pulseResult.transactions || []));
            }
        }
        
        // Calcola valueEUR per le transazioni (prezzo corrente come approssimazione)
        for (const tx of allTransactions) {
            const coin = tx.coinIn || tx.coinOut;
            const amount = tx.amountIn || tx.amountOut || 0;
            if (coin && amount > 0) {
                const price = PriceService.getPrice(coin, 'eur');
                tx.valueEUR = amount * price;
                tx.priceEUR = price;
            }
        }
        
        // Aggiungi al database
        if (allTransactions.length > 0) {
            Database.addTransactions(allTransactions);
        }
        
        // Aggiorna balances
        for (const bal of allBalances) {
            const key = `${bal.coin}_${bal.chain}`;
            Database.updateBalance(key, bal);
        }
        
        return {
            success: true,
            balances: allBalances,
            transactions: allTransactions
        };
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN PULSECHAIN (via PulseScan API)
    // ═══════════════════════════════════════════════════════════
    
    async function scanPulseChain(address) {
        Logger.info('WalletEVM', `Scanning PulseChain: ${address.slice(0,8)}...`);
        
        const balances = [];
        const transactions = [];
        const addrLower = address.toLowerCase();
        
        try {
            // Native PLS balance
            const balanceUrl = `${PULSESCAN_API}?module=account&action=balance&address=${address}`;
            const balResp = await fetch(balanceUrl);
            
            if (balResp.ok) {
                const balData = await balResp.json();
                if (balData.status === '1' && balData.result) {
                    const plsBalance = parseFloat(balData.result) / 1e18;
                    if (plsBalance > 0.0001) {
                        balances.push(createBalance({
                            coin: 'PLS',
                            name: 'PulseChain',
                            amount: plsBalance,
                            source: `wallet_${addrLower}`,
                            chain: 'pulse',
                            logo: 'https://tokens.app.pulsex.com/images/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27.png'
                        }));
                    }
                }
            }
            
            // Token list (PRC20)
            const tokenUrl = `${PULSESCAN_API}?module=account&action=tokenlist&address=${address}`;
            const tokenResp = await fetch(tokenUrl);
            
            if (tokenResp.ok) {
                const tokenData = await tokenResp.json();
                if (tokenData.status === '1' && tokenData.result) {
                    for (const token of tokenData.result) {
                        const decimals = parseInt(token.decimals) || 18;
                        const balance = parseFloat(token.balance) / Math.pow(10, decimals);
                        
                        // Filtra spam/scam durante scan
                        if (isSpamToken(token.name, token.symbol)) {
                            Logger.info('WalletEVM', `Filtrato spam PulseChain: ${token.symbol}`);
                            continue;
                        }
                        
                        if (balance > 0) {
                            balances.push(createBalance({
                                coin: token.symbol || 'UNKNOWN',
                                name: token.name || token.symbol || 'Unknown',
                                amount: balance,
                                source: `wallet_${addrLower}`,
                                chain: 'pulse',
                                contractAddress: token.contractAddress || null
                            }));
                        }
                    }
                }
            }
            
            // Native transactions
            const txUrl = `${PULSESCAN_API}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=100`;
            const txResp = await fetch(txUrl);
            
            if (txResp.ok) {
                const txData = await txResp.json();
                if (txData.status === '1' && txData.result) {
                    for (const tx of txData.result) {
                        if (tx.isError === '1') continue;
                        
                        const value = parseFloat(tx.value) / 1e18;
                        if (value === 0) continue;
                        
                        const isIncoming = tx.to?.toLowerCase() === addrLower;
                        const timestamp = parseInt(tx.timeStamp) * 1000;
                        
                        transactions.push(createTransaction({
                            source: `wallet_${addrLower}`,
                            sourceId: tx.hash,
                            timestamp: timestamp,
                            date: new Date(timestamp).toISOString(),
                            year: new Date(timestamp).getFullYear(),
                            type: isIncoming ? 'deposit' : 'withdrawal',
                            coinIn: isIncoming ? 'PLS' : '',
                            amountIn: isIncoming ? value : 0,
                            coinOut: !isIncoming ? 'PLS' : '',
                            amountOut: !isIncoming ? value : 0,
                            feeCoin: 'PLS',
                            feeAmount: parseFloat(tx.gasUsed || 0) * parseFloat(tx.gasPrice || 0) / 1e18,
                            wallet: addrLower,
                            chain: 'pulse'
                        }));
                    }
                }
            }
            
            // Token transfers (PRC20)
            const tokenTxUrl = `${PULSESCAN_API}?module=account&action=tokentx&address=${address}&sort=desc&page=1&offset=100`;
            const tokenTxResp = await fetch(tokenTxUrl);
            
            if (tokenTxResp.ok) {
                const tokenTxData = await tokenTxResp.json();
                if (tokenTxData.status === '1' && tokenTxData.result) {
                    for (const tx of tokenTxData.result) {
                        const decimals = parseInt(tx.tokenDecimal) || 18;
                        const value = parseFloat(tx.value) / Math.pow(10, decimals);
                        if (value === 0) continue;
                        
                        const isIncoming = tx.to?.toLowerCase() === addrLower;
                        const timestamp = parseInt(tx.timeStamp) * 1000;
                        const symbol = tx.tokenSymbol || 'UNKNOWN';
                        
                        transactions.push(createTransaction({
                            source: `wallet_${addrLower}`,
                            sourceId: tx.hash,
                            timestamp: timestamp,
                            date: new Date(timestamp).toISOString(),
                            year: new Date(timestamp).getFullYear(),
                            type: isIncoming ? 'deposit' : 'withdrawal',
                            coinIn: isIncoming ? symbol : '',
                            amountIn: isIncoming ? value : 0,
                            coinOut: !isIncoming ? symbol : '',
                            amountOut: !isIncoming ? value : 0,
                            wallet: addrLower,
                            chain: 'pulse'
                        }));
                    }
                }
            }
            
            Logger.success('WalletEVM', `PulseChain: ${balances.length} token, ${transactions.length} tx`);
            return { success: true, balances, transactions };
            
        } catch (error) {
            Logger.error('WalletEVM', 'Errore scan PulseChain', error);
            return { success: false, error: error.message, balances: [], transactions: [] };
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // HELPER: Rileva tipo wallet
    // ═══════════════════════════════════════════════════════════
    
    function detectWalletType(address) {
        if (!address) return null;
        
        // EVM (Ethereum, BSC, etc.)
        if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return 'evm';
        }
        
        // Cosmos (Terra, ATOM, OSMO)
        if (address.startsWith('terra1')) return 'terra';
        if (address.startsWith('cosmos1')) return 'atom';
        if (address.startsWith('osmo1')) return 'osmo';
        
        // Solana
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
            return 'solana';
        }
        
        return 'unknown';
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
        scanTokens,
        scanTransactions,
        fullScan,
        detectWalletType,
        MORALIS_CHAINS,
        EXPLORER_APIS
    };
    
})();
