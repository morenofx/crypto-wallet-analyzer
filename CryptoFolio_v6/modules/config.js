/**
 * ═══════════════════════════════════════════════════════════════
 * CRYPTOFOLIO v6 - MODULO CONFIG
 * ═══════════════════════════════════════════════════════════════
 * 
 * Configurazione centralizzata:
 * - Firebase connection
 * - API keys
 * - Costanti
 */

// ═══════════════════════════════════════════════════════════════
// FIREBASE CONFIG
// ═══════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCohqvBdT3KdUBRSz0zp0X4Pd_lkZBFDSw",
    authDomain: "moreno-crypto-tools.firebaseapp.com",
    projectId: "moreno-crypto-tools",
    storageBucket: "moreno-crypto-tools.appspot.com",
    messagingSenderId: "612292795927",
    appId: "1:612292795927:web:9e38a411a37b1f8b721c40"
};

// ═══════════════════════════════════════════════════════════════
// DATABASE STATE (in memoria, sincronizzato con Firebase)
// ═══════════════════════════════════════════════════════════════

const AppState = {
    // Dati
    transactions: [],        // Tutte le transazioni normalizzate
    balances: {},           // { 'BTC': Balance, 'ETH': Balance, ... }
    wallets: [],            // Wallet salvati
    exchanges: {},          // Configurazione exchange
    prices: {},             // Cache prezzi { 'BTC': { eur: 45000, usd: 50000 } }
    historicalPrices: {},   // Prezzi storici { 'BTC_2024-01-15': 42000 }
    
    // Settings
    apiKeys: {
        moralis: [],        // Array di API keys a cascata
        etherscan: '',
        coingecko: ''       // Gratuito, non serve key
    },
    
    // API Key rotation
    currentMoralisIndex: 0,
    
    // UI State
    selectedChains: ['eth', 'bsc', 'polygon'],
    currency: 'EUR',
    
    // Sync
    lastSync: null,
    isSyncing: false
};

// ═══════════════════════════════════════════════════════════════
// CHAINS SUPPORTATE
// ═══════════════════════════════════════════════════════════════

const CHAINS = {
    // EVM
    eth: { 
        name: 'Ethereum', 
        symbol: 'ETH', 
        color: '#627eea',
        explorer: 'https://etherscan.io',
        type: 'evm'
    },
    bsc: { 
        name: 'BSC', 
        symbol: 'BNB', 
        color: '#f3ba2f',
        explorer: 'https://bscscan.com',
        type: 'evm'
    },
    polygon: { 
        name: 'Polygon', 
        symbol: 'MATIC', 
        color: '#8247e5',
        explorer: 'https://polygonscan.com',
        type: 'evm'
    },
    arbitrum: { 
        name: 'Arbitrum', 
        symbol: 'ETH', 
        color: '#28a0f0',
        explorer: 'https://arbiscan.io',
        type: 'evm'
    },
    base: { 
        name: 'Base', 
        symbol: 'ETH', 
        color: '#0052ff',
        explorer: 'https://basescan.org',
        type: 'evm'
    },
    
    // Cosmos
    terra: { 
        name: 'Terra Classic', 
        symbol: 'LUNC', 
        color: '#5493f7',
        explorer: 'https://finder.terra.money/classic',
        type: 'cosmos',
        denom: 'uluna',
        decimals: 6,
        restUrl: 'https://terra-classic-fcd.publicnode.com'
    },
    atom: { 
        name: 'Cosmos Hub', 
        symbol: 'ATOM', 
        color: '#2e3148',
        explorer: 'https://mintscan.io/cosmos',
        type: 'cosmos',
        denom: 'uatom',
        decimals: 6,
        restUrl: 'https://cosmos-rest.publicnode.com'
    },
    osmo: { 
        name: 'Osmosis', 
        symbol: 'OSMO', 
        color: '#5e12a0',
        explorer: 'https://mintscan.io/osmosis',
        type: 'cosmos',
        denom: 'uosmo',
        decimals: 6,
        restUrl: 'https://osmosis-rest.publicnode.com'
    },
    
    // Altri
    solana: { 
        name: 'Solana', 
        symbol: 'SOL', 
        color: '#9945ff',
        explorer: 'https://solscan.io',
        type: 'solana'
    },
    pulse: { 
        name: 'PulseChain', 
        symbol: 'PLS', 
        color: '#00ff00',
        explorer: 'https://scan.pulsechain.com',
        type: 'evm'
    }
};

// ═══════════════════════════════════════════════════════════════
// EXCHANGES SUPPORTATI
// ═══════════════════════════════════════════════════════════════

const EXCHANGES = {
    binance: { 
        name: 'Binance', 
        color: '#f3ba2f', 
        hasApi: true,
        csvFormats: ['spot', 'futures', 'earn']
    },
    coinbase: { 
        name: 'Coinbase', 
        color: '#0052ff', 
        hasApi: true,
        csvFormats: ['standard']
    },
    kraken: { 
        name: 'Kraken', 
        color: '#5741d9', 
        hasApi: true,
        csvFormats: ['trades', 'ledgers']
    },
    bitget: { 
        name: 'Bitget', 
        color: '#00f0ff', 
        hasApi: true,
        csvFormats: ['spot']
    },
    bybit: { 
        name: 'Bybit', 
        color: '#f7a600', 
        hasApi: true,
        csvFormats: ['spot', 'derivatives']
    },
    cryptocom: { 
        name: 'Crypto.com', 
        color: '#002d74', 
        hasApi: false,
        csvFormats: ['app', 'exchange']
    },
    nexo: { 
        name: 'Nexo', 
        color: '#1a4bff', 
        hasApi: false,
        csvFormats: ['transactions']
    },
    youngplatform: { 
        name: 'Young Platform', 
        color: '#ff6b35', 
        hasApi: false,
        csvFormats: ['report']
    }
};

// ═══════════════════════════════════════════════════════════════
// COINGECKO IDS (per fetch prezzi)
// ═══════════════════════════════════════════════════════════════

const COINGECKO_IDS = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'MATIC': 'matic-network',
    'ATOM': 'cosmos',
    'OSMO': 'osmosis',
    'LUNC': 'terra-luna',
    'USTC': 'terrausd',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
    'SHIB': 'shiba-inu',
    'DOGE': 'dogecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'AVAX': 'avalanche-2',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'CRO': 'crypto-com-chain',
    'PLS': 'pulsechain',
    'HEX': 'hex'
};

// ═══════════════════════════════════════════════════════════════
// COSTANTI FISCALI ITALIA
// ═══════════════════════════════════════════════════════════════

const TAX_CONFIG = {
    // Aliquote
    CAPITAL_GAINS_RATE: 0.26,      // 26% plusvalenze (dal 2023)
    IVAFE_RATE: 0.002,             // 0.2% IVAFE annuale
    
    // Soglie
    NO_TAX_THRESHOLD: 2000,        // Sotto 2000€ niente tasse (proposta 2024)
    
    // Metodo calcolo
    DEFAULT_METHOD: 'LIFO',        // LIFO o AVERAGE_COST
    
    // Anno corrente
    CURRENT_YEAR: new Date().getFullYear()
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function formatEUR(value) {
    return new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatCrypto(value, decimals = 6) {
    if (Math.abs(value) < 0.000001) return '0';
    if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(2) + 'M';
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(2) + 'K';
    return value.toFixed(decimals);
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ═══════════════════════════════════════════════════════════════
// LOGGER (per debug)
// ═══════════════════════════════════════════════════════════════

const Logger = {
    info: (module, msg, data) => console.log(`ℹ️ [${module}] ${msg}`, data || ''),
    success: (module, msg, data) => console.log(`✅ [${module}] ${msg}`, data || ''),
    warn: (module, msg, data) => console.warn(`⚠️ [${module}] ${msg}`, data || ''),
    error: (module, msg, data) => console.error(`❌ [${module}] ${msg}`, data || '')
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        FIREBASE_CONFIG, AppState, CHAINS, EXCHANGES, 
        COINGECKO_IDS, TAX_CONFIG, formatEUR, formatCrypto,
        formatDate, formatDateTime, Logger
    };
}
