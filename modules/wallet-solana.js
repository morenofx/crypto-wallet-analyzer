/**
 * ═══════════════════════════════════════════════════════════════
 * WALLET SOLANA MODULE - Helius API
 * ═══════════════════════════════════════════════════════════════
 * 
 * Scansione wallet Solana usando Helius API
 * - Balance SOL nativo
 * - Token SPL (USDC, USDT, BONK, JUP, etc.)
 * - NFT (opzionale)
 * - Transazioni
 * 
 * API Key: https://dev.helius.xyz/ (gratis fino a 100k req/mese)
 */

const WalletSolana = (function() {
    'use strict';
    
    // ═══════════════════════════════════════════════════════════
    // CONFIGURAZIONE
    // ═══════════════════════════════════════════════════════════
    
    const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';
    const HELIUS_RPC_URL = 'https://mainnet.helius-rpc.com';
    
    // Token noti Solana (per icone e nomi)
    const KNOWN_TOKENS = {
        'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 },
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk', decimals: 5 },
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter', decimals: 6 },
        'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF', name: 'dogwifhat', decimals: 6 },
        'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': { symbol: 'RENDER', name: 'Render Token', decimals: 8 },
        'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', name: 'Pyth Network', decimals: 6 },
        '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'ETH', name: 'Wrapped Ether (Wormhole)', decimals: 8 },
        '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': { symbol: 'WBTC', name: 'Wrapped BTC (Wormhole)', decimals: 8 },
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade staked SOL', decimals: 9 },
        'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'jitoSOL', name: 'Jito Staked SOL', decimals: 9 },
        'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': { symbol: 'bSOL', name: 'BlazeStake Staked SOL', decimals: 9 },
        '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { symbol: 'stSOL', name: 'Lido Staked SOL', decimals: 9 },
        'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': { symbol: 'ORCA', name: 'Orca', decimals: 6 },
        'RaijcLrq6R4V4eXddhY7CbUDfJR1qMJhpwBPNsXQfrJ': { symbol: 'RAY', name: 'Raydium', decimals: 6 },
        'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt': { symbol: 'SRM', name: 'Serum', decimals: 6 },
        'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey': { symbol: 'MNDE', name: 'Marinade', decimals: 9 },
        'HxhWkVpk5NS4Ltg5nij2G671CKXFRKPK8vy271Ub4uEK': { symbol: 'HXRO', name: 'Hxro', decimals: 8 },
        'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6': { symbol: 'KIN', name: 'Kin', decimals: 5 },
        'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM': { symbol: 'USDCet', name: 'USD Coin (Wormhole)', decimals: 6 },
        'Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS': { symbol: 'PAI', name: 'Parrot USD', decimals: 6 },
        'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5': { symbol: 'MEW', name: 'cat in a dogs world', decimals: 5 },
        'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82': { symbol: 'BOME', name: 'BOOK OF MEME', decimals: 6 },
        '5z3EqYQo9HiCEs3R84RCDMu2n4DKWu2JB9xwkdM4pEUa': { symbol: 'POPCAT', name: 'Popcat', decimals: 9 },
        'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump': { symbol: 'GOAT', name: 'Goatseus Maximus', decimals: 6 }
    };
    
    // ═══════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════
    
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    function getHeliusKey() {
        // Usa Database.getHeliusKey se disponibile, altrimenti fallback
        if (typeof Database !== 'undefined' && Database.getHeliusKey) {
            return Database.getHeliusKey();
        }
        const state = Database.getState();
        return state.apiKeys?.helius || null;
    }
    
    function isValidSolanaAddress(address) {
        // Solana addresses are base58 encoded, 32-44 characters
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }
    
    // ═══════════════════════════════════════════════════════════
    // HELIUS API CALLS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Fetch native SOL balance
     */
    async function fetchSOLBalance(address, apiKey) {
        try {
            const response = await fetch(`${HELIUS_RPC_URL}/?api-key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [address]
                })
            });
            
            const data = await response.json();
            if (data.result?.value !== undefined) {
                return data.result.value / 1e9; // lamports to SOL
            }
            return 0;
        } catch (error) {
            Logger.error('WalletSolana', 'Errore fetch SOL balance', error);
            return 0;
        }
    }
    
    /**
     * Fetch all token balances using Helius DAS API
     */
    async function fetchTokenBalances(address, apiKey) {
        try {
            // Metodo 1: getAssetsByOwner (DAS API)
            const response = await fetch(`${HELIUS_RPC_URL}/?api-key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getAssetsByOwner',
                    params: {
                        ownerAddress: address,
                        page: 1,
                        limit: 1000,
                        displayOptions: {
                            showFungible: true,
                            showNativeBalance: true
                        }
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.result?.items) {
                return data.result.items;
            }
            
            return [];
        } catch (error) {
            Logger.error('WalletSolana', 'Errore fetch token balances', error);
            return [];
        }
    }
    
    /**
     * Fetch token balances usando endpoint balances (alternativo)
     */
    async function fetchBalancesAlternative(address, apiKey) {
        try {
            const response = await fetch(
                `${HELIUS_BASE_URL}/addresses/${address}/balances?api-key=${apiKey}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            Logger.error('WalletSolana', 'Errore fetch balances alternative', error);
            return null;
        }
    }
    
    /**
     * Fetch transactions
     */
    async function fetchTransactions(address, apiKey, limit = 100) {
        try {
            const response = await fetch(
                `${HELIUS_BASE_URL}/addresses/${address}/transactions?api-key=${apiKey}&limit=${limit}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            Logger.error('WalletSolana', 'Errore fetch transactions', error);
            return [];
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN BALANCE
    // ═══════════════════════════════════════════════════════════
    
    async function scanBalance(address) {
        const apiKey = getHeliusKey();
        
        if (!apiKey) {
            Logger.warn('WalletSolana', 'API Key Helius non configurata');
            return { success: false, error: 'API Key Helius mancante', balances: [] };
        }
        
        if (!isValidSolanaAddress(address)) {
            return { success: false, error: 'Indirizzo Solana non valido', balances: [] };
        }
        
        Logger.info('WalletSolana', `Scansione wallet Solana: ${address.slice(0,8)}...`);
        
        const allBalances = [];
        
        try {
            // 1. Fetch SOL nativo
            const solBalance = await fetchSOLBalance(address, apiKey);
            
            if (solBalance > 0) {
                allBalances.push(createBalance({
                    coin: 'SOL',
                    name: 'Solana',
                    amount: solBalance,
                    source: `wallet_${address}`,
                    chain: 'sol',
                    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                    contractAddress: 'native-sol'
                }));
                
                Logger.info('WalletSolana', `SOL: ${solBalance.toFixed(4)}`);
            }
            
            // 2. Fetch token SPL
            const assets = await fetchTokenBalances(address, apiKey);
            
            for (const asset of assets) {
                // Skip NFT (solo fungible)
                if (asset.interface === 'V1_NFT' || asset.interface === 'ProgrammableNFT') {
                    continue;
                }
                
                // Solo token fungibili
                if (asset.interface === 'FungibleToken' || asset.interface === 'FungibleAsset') {
                    const tokenInfo = asset.token_info || asset.content?.metadata || {};
                    const balance = asset.token_info?.balance || 0;
                    const decimals = asset.token_info?.decimals || 9;
                    const amount = balance / Math.pow(10, decimals);
                    
                    if (amount <= 0) continue;
                    
                    // Prova a ottenere info dal nostro database
                    const mint = asset.id;
                    const knownToken = KNOWN_TOKENS[mint];
                    
                    const symbol = knownToken?.symbol || 
                                   tokenInfo.symbol || 
                                   asset.content?.metadata?.symbol || 
                                   'UNKNOWN';
                    
                    const name = knownToken?.name || 
                                 tokenInfo.name || 
                                 asset.content?.metadata?.name || 
                                 symbol;
                    
                    // Skip spam tokens
                    if (isSpamToken(name, symbol)) {
                        continue;
                    }
                    
                    const logo = asset.content?.links?.image || 
                                 asset.content?.files?.[0]?.uri ||
                                 null;
                    
                    allBalances.push(createBalance({
                        coin: symbol.toUpperCase(),
                        name: name,
                        amount: amount,
                        source: `wallet_${address}`,
                        chain: 'sol',
                        logo: logo,
                        contractAddress: mint
                    }));
                    
                    Logger.info('WalletSolana', `${symbol}: ${amount.toFixed(4)}`);
                }
            }
            
            // 3. Fallback: prova endpoint alternativo se DAS non ha risultati
            if (allBalances.length <= 1) {
                Logger.info('WalletSolana', 'Provo endpoint alternativo...');
                const altData = await fetchBalancesAlternative(address, apiKey);
                
                if (altData?.tokens) {
                    for (const token of altData.tokens) {
                        const amount = token.amount / Math.pow(10, token.decimals || 9);
                        if (amount <= 0) continue;
                        
                        const knownToken = KNOWN_TOKENS[token.mint];
                        const symbol = knownToken?.symbol || token.symbol || 'UNKNOWN';
                        const name = knownToken?.name || token.name || symbol;
                        
                        if (isSpamToken(name, symbol)) continue;
                        
                        // Evita duplicati
                        const exists = allBalances.some(b => b.contractAddress === token.mint);
                        if (exists) continue;
                        
                        allBalances.push(createBalance({
                            coin: symbol.toUpperCase(),
                            name: name,
                            amount: amount,
                            source: `wallet_${address}`,
                            chain: 'sol',
                            logo: token.logoURI || null,
                            contractAddress: token.mint
                        }));
                    }
                }
            }
            
            Logger.success('WalletSolana', `Trovati ${allBalances.length} token`);
            return { success: true, balances: allBalances };
            
        } catch (error) {
            Logger.error('WalletSolana', 'Errore scan', error);
            return { success: false, error: error.message, balances: allBalances };
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // SCAN TRANSAZIONI
    // ═══════════════════════════════════════════════════════════
    
    async function scanTransactions(address) {
        const apiKey = getHeliusKey();
        
        if (!apiKey) {
            return { success: false, error: 'API Key Helius mancante', transactions: [] };
        }
        
        if (!isValidSolanaAddress(address)) {
            return { success: false, error: 'Indirizzo Solana non valido', transactions: [] };
        }
        
        Logger.info('WalletSolana', `Scarico transazioni: ${address.slice(0,8)}...`);
        
        try {
            const txs = await fetchTransactions(address, apiKey, 100);
            const transactions = [];
            
            for (const tx of txs) {
                // Parse enhanced transaction
                const timestamp = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date();
                const type = parseTransactionType(tx, address);
                
                // Token transfers
                if (tx.tokenTransfers?.length > 0) {
                    for (const transfer of tx.tokenTransfers) {
                        const isIncoming = transfer.toUserAccount?.toLowerCase() === address.toLowerCase();
                        const amount = transfer.tokenAmount || 0;
                        
                        const knownToken = KNOWN_TOKENS[transfer.mint];
                        const symbol = knownToken?.symbol || transfer.symbol || 'UNKNOWN';
                        
                        transactions.push(createTransaction({
                            date: timestamp.toISOString(),
                            type: isIncoming ? 'receive' : 'send',
                            coin: symbol,
                            amount: amount,
                            source: `wallet_${address}`,
                            chain: 'sol',
                            txHash: tx.signature,
                            from: transfer.fromUserAccount || '',
                            to: transfer.toUserAccount || ''
                        }));
                    }
                }
                
                // Native SOL transfers
                if (tx.nativeTransfers?.length > 0) {
                    for (const transfer of tx.nativeTransfers) {
                        const isIncoming = transfer.toUserAccount?.toLowerCase() === address.toLowerCase();
                        const amount = (transfer.amount || 0) / 1e9;
                        
                        if (amount > 0) {
                            transactions.push(createTransaction({
                                date: timestamp.toISOString(),
                                type: isIncoming ? 'receive' : 'send',
                                coin: 'SOL',
                                amount: amount,
                                source: `wallet_${address}`,
                                chain: 'sol',
                                txHash: tx.signature,
                                from: transfer.fromUserAccount || '',
                                to: transfer.toUserAccount || ''
                            }));
                        }
                    }
                }
            }
            
            Logger.success('WalletSolana', `Trovate ${transactions.length} transazioni`);
            return { success: true, transactions };
            
        } catch (error) {
            Logger.error('WalletSolana', 'Errore scan transazioni', error);
            return { success: false, error: error.message, transactions: [] };
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════
    
    function parseTransactionType(tx, address) {
        const type = tx.type?.toLowerCase() || '';
        
        if (type.includes('swap')) return 'swap';
        if (type.includes('transfer')) return 'transfer';
        if (type.includes('stake')) return 'stake';
        if (type.includes('unstake')) return 'unstake';
        
        return 'transfer';
    }
    
    function isSpamToken(name, symbol) {
        const n = (name || '').toLowerCase();
        const s = (symbol || '').toLowerCase();
        
        const spam = ['visit', 'claim', 'reward', '.com', '.org', '.io', '.xyz', 
                      'airdrop', 'bonus', 'free', 'gift', 'http', '$', '#'];
        
        for (const p of spam) {
            if (n.includes(p) || s.includes(p)) return true;
        }
        
        return (name || '').length > 40;
    }
    
    function createBalance(data) {
        return {
            coin: data.coin,
            name: data.name || data.coin,
            amount: data.amount,
            source: data.source,
            chain: data.chain,
            logo: data.logo,
            contractAddress: data.contractAddress,
            lastUpdate: new Date().toISOString()
        };
    }
    
    function createTransaction(data) {
        return {
            id: `${data.txHash}_${data.coin}_${Date.now()}`,
            date: data.date,
            type: data.type,
            coin: data.coin,
            amount: data.amount,
            source: data.source,
            chain: data.chain,
            txHash: data.txHash,
            from: data.from,
            to: data.to
        };
    }
    
    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════
    
    return {
        scanBalance,
        scanTransactions,
        isValidSolanaAddress,
        
        // Full scan (balance + transactions)
        async fullScan(address) {
            const balanceResult = await scanBalance(address);
            await sleep(500);
            const txResult = await scanTransactions(address);
            
            return {
                success: balanceResult.success,
                balances: balanceResult.balances,
                transactions: txResult.transactions,
                error: balanceResult.error || txResult.error
            };
        }
    };
    
})();

// Export per browser
if (typeof window !== 'undefined') {
    window.WalletSolana = WalletSolana;
}
