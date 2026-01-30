/**
 * ═══════════════════════════════════════════════════════════════
 * CRYPTOFOLIO v6.1 - TOKEN VALIDATOR MODULE
 * Filtri avanzati anti-scam/spam con GoPlus Security
 * ═══════════════════════════════════════════════════════════════
 * 
 * Strategia multi-livello:
 * 1. Pattern Check (nome/simbolo sospetto) - ISTANTANEO
 * 2. Whitelist Check (top token per market cap) - ISTANTANEO
 * 3. GoPlus Security API (honeypot, blacklist) - ASYNC
 * 4. DexScreener Liquidity Check - ASYNC
 * 5. Value Check (prezzo/liquidità)
 */

const TokenValidator = (function() {
    'use strict';
    
    // ═══════════════════════════════════════════════════════════
    // GOPLUS SECURITY API
    // ═══════════════════════════════════════════════════════════
    
    const GOPLUS_API = 'https://api.gopluslabs.io/api/v1/token_security';
    
    // Chain IDs per GoPlus (numerico)
    const GOPLUS_CHAIN_IDS = {
        'eth': '1',
        'bsc': '56',
        'polygon': '137',
        'arbitrum': '42161',
        'optimism': '10',
        'base': '8453',
        'avalanche': '43114',
        'fantom': '250',
        'cronos': '25'
        // PulseChain e BlackFort non supportati da GoPlus
    };
    
    // Cache risultati GoPlus (evita chiamate ripetute)
    const goPlusCache = new Map();
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 ore
    
    /**
     * ⭐ CHECK GOPLUS SECURITY
     * Verifica se un token è honeypot, blacklistato o ha backdoor
     * @param {string} contractAddress - Indirizzo del contratto
     * @param {string} chainKey - Chiave chain (es: 'bsc', 'eth')
     * @returns {Promise<{isScam: boolean, reason: string, details: object}>}
     */
    async function checkWithGoPlus(contractAddress, chainKey) {
        if (!contractAddress || contractAddress.startsWith('native-')) {
            return { isScam: false, reason: 'native_token', details: null };
        }
        
        const chainId = GOPLUS_CHAIN_IDS[chainKey];
        if (!chainId) {
            return { isScam: false, reason: 'chain_not_supported', details: null };
        }
        
        const cacheKey = `${chainId}_${contractAddress.toLowerCase()}`;
        
        // Check cache
        const cached = goPlusCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.result;
        }
        
        try {
            const url = `${GOPLUS_API}/${chainId}?contract_addresses=${contractAddress}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                return { isScam: false, reason: 'api_error', details: null };
            }
            
            const data = await response.json();
            const addrLower = contractAddress.toLowerCase();
            
            if (data.result && data.result[addrLower]) {
                const details = data.result[addrLower];
                
                // ⚠️ SCAM INDICATORS
                const isHoneypot = details.is_honeypot === '1';
                const isBlacklisted = details.is_blacklisted === '1';
                const hasProxyContract = details.is_proxy === '1' && details.is_open_source !== '1';
                const cantSell = details.cannot_sell_all === '1';
                const hasHiddenOwner = details.hidden_owner === '1';
                const hasMintFunction = details.is_mintable === '1' && details.owner_address;
                const canTakeBackOwnership = details.can_take_back_ownership === '1';
                const hasExternalCall = details.external_call === '1';
                const isFakeToken = details.is_true_token === '0';
                
                // Determina se è scam
                let isScam = false;
                let reason = 'safe';
                
                if (isHoneypot) {
                    isScam = true;
                    reason = 'honeypot';
                } else if (isBlacklisted) {
                    isScam = true;
                    reason = 'blacklisted';
                } else if (cantSell) {
                    isScam = true;
                    reason = 'cannot_sell';
                } else if (isFakeToken) {
                    isScam = true;
                    reason = 'fake_token';
                } else if (hasHiddenOwner && hasMintFunction) {
                    isScam = true;
                    reason = 'hidden_owner_mintable';
                } else if (canTakeBackOwnership) {
                    isScam = true;
                    reason = 'ownership_risk';
                }
                
                const result = { isScam, reason, details };
                
                // Salva in cache
                goPlusCache.set(cacheKey, {
                    timestamp: Date.now(),
                    result
                });
                
                return result;
            }
            
            return { isScam: false, reason: 'not_found', details: null };
            
        } catch (error) {
            console.warn('[GoPlus] Error:', error.message);
            return { isScam: false, reason: 'fetch_error', details: null };
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // PATTERN SPAM/SCAM (Espanso)
    // ═══════════════════════════════════════════════════════════
    
    const SPAM_PATTERNS = [
        // URL/Domini
        '.com', '.org', '.io', '.xyz', '.net', '.co', '.me', '.app',
        'http', 'www.', '://',
        
        // Azioni sospette
        'visit', 'claim', 'reward', 'airdrop', 'bonus', 'free', 'gift',
        'redeem', 'collect', 'activate', 'unlock', 'swap here',
        
        // Phishing
        'voucher', 'ticket', 'points', 'winner', 'prize', 'lottery',
        'giveaway', 'promo', 'promotional',
        
        // Fake versioni
        'v2.0', 'v3.0', '2.0', '3.0', 'new ', ' new', 'upgraded',
        
        // Simboli sospetti
        '$', '#', '!', '?', '*', '→', '⇒', '»',
        
        // Urgenza
        'urgent', 'limited', 'hurry', 'fast', 'quick', 'instant',
        'expire', 'expiring', 'deadline',
        
        // Truffe note
        'elon', 'musk', 'bezos', 'zuck', 'trump',
        'double', 'triple', '10x', '100x', '1000x',
        
        // Messaggi
        'congratulation', 'selected', 'eligible', 'qualified',
        
        // Honeypot indicators
        'safu', 'safe ', ' safe', 'rug', 'moon', 'pump'
    ];
    
    // ═══════════════════════════════════════════════════════════
    // WHITELIST - Token Legittimi (Top per Market Cap)
    // ═══════════════════════════════════════════════════════════
    
    const WHITELIST_TOKENS = new Set([
        // === TOP 50 CRYPTO ===
        'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOGE', 'DOT', 'LINK',
        'MATIC', 'POL', 'LTC', 'SHIB', 'TRX', 'ATOM', 'UNI', 'XLM', 'NEAR', 'APT',
        'FIL', 'ARB', 'OP', 'VET', 'HBAR', 'ALGO', 'ICP', 'GRT', 'FTM', 'AAVE',
        'EOS', 'MKR', 'SAND', 'AXS', 'MANA', 'THETA', 'XTZ', 'EGLD', 'FLOW', 'CHZ',
        'KCS', 'NEO', 'KAVA', 'MINA', 'XDC', 'IOTA', 'ZEC', 'DASH', 'ENJ', 'BAT',
        'SUI', 'TON', 'BCH', 'ETC', 'XMR', 'RUNE', 'INJ', 'SEI', 'TIA', 'STX',
        
        // === STABLECOINS ===
        'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'FDUSD', 'PYUSD', 'GUSD',
        'LUSD', 'CRVUSD', 'GHO', 'USDD', 'UST', 'USTC', 'MAI', 'MIMATIC', 'USDP',
        'USDE', 'EURC', 'EURS', 'EURT', 'USDJ', 'VAI',
        
        // === WRAPPED TOKENS ===
        'WETH', 'WBTC', 'WBNB', 'WMATIC', 'WAVAX', 'WFTM', 'WCRO', 'WPLS',
        'STETH', 'RETH', 'CBETH', 'WSTETH', 'FRXETH', 'SFRXETH', 'METH',
        'MSOL', 'JITOSOL', 'BSOL', 'STSOL', 'WEETH', 'EZETH', 'RSETH',
        
        // === DEFI BLUE CHIPS ===
        'CRV', 'CVX', 'COMP', 'SNX', 'SUSHI', '1INCH', 'CAKE', 'LDO', 'RPL',
        'FXS', 'PENDLE', 'GMX', 'DYDX', 'JOE', 'SPELL', 'YFI', 'BAL', 'LQTY',
        'RDNT', 'VELO', 'AERO', 'THE', 'MORPHO', 'ENA', 'ETHFI',
        
        // === LAYER 2 / SCALING ===
        'IMX', 'LRC', 'ZK', 'STRK', 'MANTA', 'METIS', 'BOBA', 'CELO', 'GLMR',
        'MOVR', 'SKL', 'CTSI', 'SYN', 'ZRO', 'MODE', 'BLAST', 'SCROLL',
        
        // === EXCHANGE TOKENS ===
        'CRO', 'OKB', 'BGB', 'KCS', 'GT', 'HT', 'LEO', 'FTT', 'MX', 'WOO',
        
        // === MEME COINS LEGITTIMI ===
        'PEPE', 'FLOKI', 'BONK', 'WIF', 'BRETT', 'POPCAT', 'NEIRO', 'TURBO',
        'COQ', 'DEGEN', 'TOSHI', 'MEME', 'LADYS', 'MILADY', 'WOJAK',
        'BABYDOGE', 'ELON', 'KISHU', 'HOGE', 'BONE', 'LEASH', 'MOG', 'SPX',
        'PORK', 'ANDY', 'PONKE', 'BOME', 'SLERF', 'MEW', 'MYRO',
        
        // === AI / DATA ===
        'FET', 'AGIX', 'OCEAN', 'RNDR', 'RENDER', 'TAO', 'WLD', 'ARKM', 'AKT',
        'AIOZ', 'PHB', 'NMR', 'CTXC', 'GLM', 'ORAI', 'VIRTUAL', 'AI16Z',
        
        // === GAMING / METAVERSE ===
        'GALA', 'IMX', 'ILV', 'PRIME', 'MAGIC', 'YGG', 'PIXEL', 'MAVIA', 'BEAM',
        'BIGTIME', 'GODS', 'PYR', 'REVV', 'GHST', 'ALICE', 'TLM', 'SUPER',
        'RON', 'AXS', 'SLP', 'PORTO', 'SANTOS', 'LAZIO', 'CITY', 'PSG',
        
        // === INFRASTRUCTURE ===
        'API3', 'BAND', 'TRB', 'UMA', 'REQ', 'COTI', 'CELR', 'ANKR', 'STORJ',
        'AR', 'FIO', 'NKN', 'IOTX', 'POKT', 'SSV', 'OETH',
        
        // === PULSECHAIN ===
        'PLS', 'PLSX', 'HEX', 'INC', 'LOAN', 'MINT', 'PHIAT', 'SPARK', 'EHEX',
        'DAI9', 'USDC9', 'USDT9', 'WETH9',
        
        // === BLACKFORT ===
        'BXN', 'WBXN',
        
        // === COSMOS ECOSYSTEM ===
        'OSMO', 'JUNO', 'SCRT', 'INJ', 'SEI', 'TIA', 'DYM', 'KUJI', 'NTRN',
        'LUNA', 'LUNC', 'AKT', 'FET', 'STARS', 'NTRN', 'MARS',
        
        // === SOLANA ECOSYSTEM ===
        'RAY', 'ORCA', 'MNDE', 'SRM', 'STEP', 'SLND', 'TULIP', 'SHDW', 'DUST',
        'JUP', 'PYTH', 'JTO', 'TENSOR', 'BSOL', 'MSOL', 'W', 'KMNO', 'JITO',
        
        // === BSC POPULAR ===
        'XVS', 'ALPACA', 'BAKE', 'TWT', 'SFP', 'C98', 'REEF', 'LINA', 'TKO',
        'BURGER', 'SXP', 'MDX', 'RACA', 'HERO', 'GMT', 'GST', 'HIGH',
        
        // === OTHER POPULAR ===
        'MASK', 'ENS', 'RSS3', 'ID', 'ARB', 'BLUR', 'X2Y2', 'LOOKS', 'RARE',
        'AUDIO', 'JASMY', 'HOT', 'ONE', 'ROSE', 'QTUM', 'ZIL', 'ICX', 'ONT',
        'WAVES', 'SC', 'DGB', 'RVN', 'FLUX', 'KDA', 'ERG', 'CFX', 'CKB',
        'APE', 'SHIFU', 'BUBBLE', 'CIV', 'VSN'
    ]);
    
    // ═══════════════════════════════════════════════════════════
    // BLACKLIST CONTRATTI NOTI SCAM
    // ═══════════════════════════════════════════════════════════
    
    const KNOWN_SCAM_CONTRACTS = new Set([
        // Aggiungi qui contratti scam noti
        // Esempio: '0x123...abc'
    ]);
    
    // ═══════════════════════════════════════════════════════════
    // CONFIGURAZIONE
    // ═══════════════════════════════════════════════════════════
    
    const CONFIG = {
        // Soglia valore minimo in EUR
        MIN_VALUE_EUR: 0.01,
        
        // Soglia liquidità minima USD (per DexScreener)
        MIN_LIQUIDITY_USD: 1000,
        
        // Lunghezza massima nome token
        MAX_NAME_LENGTH: 40,
        
        // Lunghezza massima simbolo
        MAX_SYMBOL_LENGTH: 12,
        
        // Abilita log verbose
        VERBOSE: false
    };
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 1: PATTERN (Statico)
    // ═══════════════════════════════════════════════════════════
    
    function checkPattern(name, symbol) {
        const n = String(name || '').toLowerCase();
        const s = String(symbol || '').toLowerCase();
        
        // Check whitelist PRIMA (se in whitelist, è sempre OK)
        if (WHITELIST_TOKENS.has(s.toUpperCase()) || WHITELIST_TOKENS.has(symbol?.toUpperCase())) {
            return { isSpam: false, reason: 'whitelist' };
        }
        
        // Check pattern spam
        for (const pattern of SPAM_PATTERNS) {
            if (n.includes(pattern) || s.includes(pattern)) {
                return { isSpam: true, reason: `pattern: "${pattern}"` };
            }
        }
        
        // Check lunghezza nome
        if (n.length > CONFIG.MAX_NAME_LENGTH) {
            return { isSpam: true, reason: 'name too long' };
        }
        
        // Check lunghezza simbolo
        if (s.length > CONFIG.MAX_SYMBOL_LENGTH) {
            return { isSpam: true, reason: 'symbol too long' };
        }
        
        // Check caratteri strani nel simbolo
        if (!/^[a-zA-Z0-9]+$/.test(symbol || '')) {
            // Permetti alcuni caratteri comuni
            if (!/^[a-zA-Z0-9._-]+$/.test(symbol || '')) {
                return { isSpam: true, reason: 'invalid symbol chars' };
            }
        }
        
        return { isSpam: false, reason: 'passed' };
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 2: CONTRATTO NOTO SCAM
    // ═══════════════════════════════════════════════════════════
    
    function checkContract(contractAddress) {
        if (!contractAddress) return { isSpam: false, reason: 'native' };
        
        const addr = contractAddress.toLowerCase();
        
        if (KNOWN_SCAM_CONTRACTS.has(addr)) {
            return { isSpam: true, reason: 'known scam contract' };
        }
        
        return { isSpam: false, reason: 'passed' };
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 3: VALORE (Dust Filter)
    // ═══════════════════════════════════════════════════════════
    
    function checkValue(amount, priceEUR) {
        const value = (amount || 0) * (priceEUR || 0);
        
        // Se ha prezzo e valore < minimo, è dust
        if (priceEUR > 0 && value < CONFIG.MIN_VALUE_EUR) {
            return { isSpam: true, reason: `dust: €${value.toFixed(4)}` };
        }
        
        return { isSpam: false, reason: 'passed', value };
    }
    
    // ═══════════════════════════════════════════════════════════
    // CHECK 4: PREZZO/LIQUIDITÀ
    // ═══════════════════════════════════════════════════════════
    
    function checkPrice(priceEUR, liquidityUSD) {
        // Se in whitelist, non serve prezzo
        // Questo check è per token NON in whitelist
        
        // Se non ha prezzo E non è in whitelist = sospetto
        // Ma non blocchiamo subito, potrebbe essere token nuovo legittimo
        
        if (liquidityUSD !== undefined && liquidityUSD < CONFIG.MIN_LIQUIDITY_USD) {
            return { isSpam: true, reason: `low liquidity: $${liquidityUSD}` };
        }
        
        return { isSpam: false, reason: 'passed' };
    }
    
    // ═══════════════════════════════════════════════════════════
    // VALIDAZIONE COMPLETA
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Valida un token con tutti i check
     * @param {Object} token - { name, symbol, amount, priceEUR, contractAddress, liquidityUSD }
     * @returns {Object} - { isValid, isSpam, reason, checks }
     */
    function validate(token) {
        const checks = [];
        
        // 1. Pattern Check
        const patternResult = checkPattern(token.name, token.symbol);
        checks.push({ check: 'pattern', ...patternResult });
        if (patternResult.isSpam) {
            return createResult(false, true, patternResult.reason, checks);
        }
        
        // 2. Contract Check
        const contractResult = checkContract(token.contractAddress);
        checks.push({ check: 'contract', ...contractResult });
        if (contractResult.isSpam) {
            return createResult(false, true, contractResult.reason, checks);
        }
        
        // 3. Value Check (dust)
        const valueResult = checkValue(token.amount, token.priceEUR);
        checks.push({ check: 'value', ...valueResult });
        if (valueResult.isSpam) {
            return createResult(false, true, valueResult.reason, checks);
        }
        
        // 4. Price/Liquidity Check (solo se non in whitelist)
        if (!WHITELIST_TOKENS.has((token.symbol || '').toUpperCase())) {
            const priceResult = checkPrice(token.priceEUR, token.liquidityUSD);
            checks.push({ check: 'liquidity', ...priceResult });
            if (priceResult.isSpam) {
                return createResult(false, true, priceResult.reason, checks);
            }
        }
        
        // Tutti i check passati
        return createResult(true, false, 'valid', checks);
    }
    
    function createResult(isValid, isSpam, reason, checks) {
        if (CONFIG.VERBOSE && isSpam) {
            console.log(`[TokenValidator] Filtered: ${reason}`);
        }
        return { isValid, isSpam, reason, checks };
    }
    
    // ═══════════════════════════════════════════════════════════
    // UTILITY: Quick Check (Solo Pattern + Whitelist)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Check veloce senza prezzo/liquidità
     * Usare durante lo scan per filtrare subito gli ovvi spam
     */
    function quickCheck(name, symbol) {
        return checkPattern(name, symbol);
    }
    
    /**
     * Check se token è in whitelist
     */
    function isWhitelisted(symbol) {
        return WHITELIST_TOKENS.has((symbol || '').toUpperCase());
    }
    
    /**
     * ⭐ CHECK TOKEN VERIFICATO
     * Un token è "verificato" se:
     * 1. È nella whitelist (token conosciuti)
     * 2. OPPURE ha un prezzo valido > 0 (i token scam non hanno mai prezzo!)
     * 
     * @param {string} symbol - Simbolo del token
     * @param {number} price - Prezzo del token (0 se non disponibile)
     * @returns {boolean} - true se verificato
     */
    function isVerifiedToken(symbol, price = 0) {
        // 1. Check whitelist
        if (WHITELIST_TOKENS.has((symbol || '').toUpperCase())) {
            return true;
        }
        
        // 2. Check se ha prezzo valido (token reali hanno sempre prezzo su CoinGecko)
        if (price && price > 0) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Aggiungi token alla whitelist runtime
     */
    function addToWhitelist(symbol) {
        WHITELIST_TOKENS.add((symbol || '').toUpperCase());
    }
    
    /**
     * Aggiungi contratto scam noto
     */
    function addScamContract(address) {
        KNOWN_SCAM_CONTRACTS.add((address || '').toLowerCase());
    }
    
    // ═══════════════════════════════════════════════════════════
    // ⭐ VALIDAZIONE COMPLETA ASINCRONA (con GoPlus)
    // ═══════════════════════════════════════════════════════════
    
    /**
     * Validazione completa con GoPlus Security API
     * Strategia:
     * 1. Pattern Check (istantaneo) → se spam, blocca
     * 2. Whitelist Check (istantaneo) → se in whitelist, approva
     * 3. GoPlus Security (async) → se honeypot/blacklist, blocca
     * 4. Liquidity Check (async) → se < $1000, nascondi
     * 
     * @param {Object} token - { name, symbol, contractAddress, chain, amount, priceEUR }
     * @returns {Promise<{isValid, isScam, reason, goPlusDetails}>}
     */
    async function validateAsync(token) {
        const symbol = (token.symbol || '').toUpperCase();
        const contractAddress = token.contractAddress;
        const chain = token.chain || 'eth';
        
        // 1. PATTERN CHECK (istantaneo)
        const patternResult = checkPattern(token.name, token.symbol);
        if (patternResult.isSpam) {
            return {
                isValid: false,
                isScam: true,
                reason: `pattern_${patternResult.reason}`,
                goPlusDetails: null
            };
        }
        
        // 2. WHITELIST CHECK (istantaneo)
        if (WHITELIST_TOKENS.has(symbol)) {
            return {
                isValid: true,
                isScam: false,
                reason: 'whitelist',
                goPlusDetails: null
            };
        }
        
        // 3. GOPLUS SECURITY CHECK (async)
        if (contractAddress && !contractAddress.startsWith('native-')) {
            const goPlusResult = await checkWithGoPlus(contractAddress, chain);
            
            if (goPlusResult.isScam) {
                // Aggiungi a blacklist locale per evitare future chiamate
                KNOWN_SCAM_CONTRACTS.add(contractAddress.toLowerCase());
                
                return {
                    isValid: false,
                    isScam: true,
                    reason: `goplus_${goPlusResult.reason}`,
                    goPlusDetails: goPlusResult.details
                };
            }
        }
        
        // 4. PREZZO/LIQUIDITÀ CHECK
        // Se ha prezzo CoinGecko > 0, è probabilmente legittimo
        if (token.priceEUR && token.priceEUR > 0) {
            return {
                isValid: true,
                isScam: false,
                reason: 'has_price',
                goPlusDetails: null
            };
        }
        
        // 5. Nessun prezzo e non verificato = sospetto (ma non bloccare)
        return {
            isValid: false,
            isScam: false,  // Non è necessariamente scam, solo non verificato
            reason: 'unverified',
            goPlusDetails: null
        };
    }
    
    /**
     * Batch validation con GoPlus (per array di token)
     * @param {Array} tokens - Array di token da validare
     * @returns {Promise<Map<string, ValidationResult>>}
     */
    async function validateBatch(tokens) {
        const results = new Map();
        
        // Raggruppa token per chain per ottimizzare chiamate GoPlus
        const byChain = {};
        for (const token of tokens) {
            const chain = token.chain || 'eth';
            if (!byChain[chain]) byChain[chain] = [];
            byChain[chain].push(token);
        }
        
        // Processa ogni chain
        for (const [chain, chainTokens] of Object.entries(byChain)) {
            for (const token of chainTokens) {
                const key = `${chain}_${token.contractAddress || token.symbol}`;
                const result = await validateAsync(token);
                results.set(key, result);
                
                // Rate limiting: 100ms tra chiamate
                await new Promise(r => setTimeout(r, 100));
            }
        }
        
        return results;
    }
    
    /**
     * Clear cache GoPlus (utility)
     */
    function clearGoPlusCache() {
        goPlusCache.clear();
    }
    
    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════
    
    return {
        // Validazione sincrona (veloce)
        validate,
        quickCheck,
        
        // ⭐ Validazione asincrona (con GoPlus)
        validateAsync,
        validateBatch,
        checkWithGoPlus,
        
        // Check singoli
        checkPattern,
        checkContract,
        checkValue,
        checkPrice,
        
        // Token verification
        isWhitelisted,
        isVerifiedToken,
        
        // Gestione liste
        addToWhitelist,
        addScamContract,
        clearGoPlusCache,
        
        // Configurazione
        setMinValue: (val) => CONFIG.MIN_VALUE_EUR = val,
        setMinLiquidity: (val) => CONFIG.MIN_LIQUIDITY_USD = val,
        setVerbose: (val) => CONFIG.VERBOSE = val,
        
        // Accesso alle liste (read-only)
        getWhitelist: () => [...WHITELIST_TOKENS],
        getSpamPatterns: () => [...SPAM_PATTERNS],
        getGoPlusChains: () => Object.keys(GOPLUS_CHAIN_IDS)
    };
    
})();

// Export
if (typeof window !== 'undefined') {
    window.TokenValidator = TokenValidator;
}
