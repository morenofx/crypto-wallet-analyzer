/**
 * ═══════════════════════════════════════════════════════════════
 * CRYPTOFOLIO v6 - TOKEN VALIDATOR MODULE
 * Filtri avanzati anti-scam/spam
 * ═══════════════════════════════════════════════════════════════
 * 
 * Strategia multi-livello:
 * 1. Pattern Check (nome/simbolo sospetto)
 * 2. Whitelist Check (top token per market cap)
 * 3. Value Check (prezzo/liquidità)
 * 4. Dust Check (valore minimo)
 */

const TokenValidator = (function() {
    'use strict';
    
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
        
        // === STABLECOINS ===
        'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'FDUSD', 'PYUSD', 'GUSD',
        'LUSD', 'CRVUSD', 'GHO', 'USDD', 'UST', 'USTC', 'MAI', 'MIMATIC', 'USDP',
        
        // === WRAPPED TOKENS ===
        'WETH', 'WBTC', 'WBNB', 'WMATIC', 'WAVAX', 'WFTM', 'WCRO', 'WPLS',
        'STETH', 'RETH', 'CBETH', 'WSTETH', 'FRXETH', 'SFRXETH',
        'MSOL', 'JITOSOL', 'BSOL', 'STSOL',
        
        // === DEFI BLUE CHIPS ===
        'CRV', 'CVX', 'COMP', 'SNX', 'SUSHI', '1INCH', 'CAKE', 'LDO', 'RPL',
        'FXS', 'PENDLE', 'GMX', 'DYDX', 'JOE', 'SPELL', 'YFI', 'BAL', 'LQTY',
        
        // === LAYER 2 / SCALING ===
        'IMX', 'LRC', 'ZK', 'STRK', 'MANTA', 'METIS', 'BOBA', 'CELO', 'GLMR',
        'MOVR', 'SKL', 'CTSI', 'SYN',
        
        // === EXCHANGE TOKENS ===
        'CRO', 'OKB', 'BGB', 'KCS', 'GT', 'HT', 'LEO', 'FTT', 'MX', 'WOO',
        
        // === MEME COINS LEGITTIMI ===
        'PEPE', 'FLOKI', 'BONK', 'WIF', 'BRETT', 'POPCAT', 'NEIRO', 'TURBO',
        'COQ', 'DEGEN', 'TOSHI', 'MEME', 'LADYS', 'MILADY', 'WOJAK',
        'BABYDOGE', 'ELON', 'KISHU', 'HOGE', 'BONE', 'LEASH',
        
        // === AI / DATA ===
        'FET', 'AGIX', 'OCEAN', 'RNDR', 'RENDER', 'TAO', 'WLD', 'ARKM', 'AKT',
        
        // === GAMING / METAVERSE ===
        'GALA', 'IMX', 'ILV', 'PRIME', 'MAGIC', 'YGG', 'PIXEL', 'MAVIA', 'BEAM',
        'BIGTIME', 'GODS', 'PYR', 'REVV', 'GHST', 'ALICE', 'TLM', 'SUPER',
        
        // === INFRASTRUCTURE ===
        'API3', 'BAND', 'TRB', 'UMA', 'REQ', 'COTI', 'CELR', 'ANKR', 'STORJ',
        
        // === PULSECHAIN ===
        'PLS', 'PLSX', 'HEX', 'INC', 'LOAN', 'MINT', 'PHIAT', 'SPARK', 'EHEX',
        
        // === BLACKFORT ===
        'BXN', 'WBXN',
        
        // === COSMOS ECOSYSTEM ===
        'OSMO', 'JUNO', 'SCRT', 'INJ', 'SEI', 'TIA', 'DYM', 'KUJI', 'NTRN',
        'LUNA', 'LUNC',
        
        // === SOLANA ECOSYSTEM ===
        'RAY', 'ORCA', 'MNDE', 'SRM', 'STEP', 'SLND', 'TULIP', 'SHDW', 'DUST',
        'JUP', 'PYTH', 'JTO', 'TENSOR', 'BSOL', 'MSOL',
        
        // === OTHER POPULAR ===
        'MASK', 'ENS', 'RSS3', 'ID', 'ARB', 'BLUR', 'X2Y2', 'LOOKS', 'RARE',
        'AUDIO', 'JASMY', 'HOT', 'ONE', 'ROSE', 'QTUM', 'ZIL', 'ICX', 'ONT',
        'WAVES', 'SC', 'DGB', 'RVN', 'FLUX', 'KDA', 'ERG', 'CFX', 'CKB'
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
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════
    
    return {
        // Validazione completa
        validate,
        
        // Check singoli
        checkPattern,
        checkContract,
        checkValue,
        checkPrice,
        
        // Quick check
        quickCheck,
        isWhitelisted,
        
        // Gestione liste
        addToWhitelist,
        addScamContract,
        
        // Configurazione
        setMinValue: (val) => CONFIG.MIN_VALUE_EUR = val,
        setMinLiquidity: (val) => CONFIG.MIN_LIQUIDITY_USD = val,
        setVerbose: (val) => CONFIG.VERBOSE = val,
        
        // Accesso alle liste (read-only)
        getWhitelist: () => [...WHITELIST_TOKENS],
        getSpamPatterns: () => [...SPAM_PATTERNS]
    };
    
})();

// Export
if (typeof window !== 'undefined') {
    window.TokenValidator = TokenValidator;
}
