/**
 * ═══════════════════════════════════════════════════════════════
 * CRYPTOFOLIO v6 - MODULO PREZZI
 * ═══════════════════════════════════════════════════════════════
 * 
 * Gestisce i prezzi delle crypto:
 * - Prezzi attuali (CoinGecko API)
 * - Prezzi storici (per calcoli fiscali)
 * - Cache intelligente
 */

const PriceService = (function() {
    
    const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
    const CACHE_DURATION = 60000; // 1 minuto per prezzi attuali
    const HISTORY_CACHE_DURATION = 86400000; // 24h per prezzi storici
    
    let lastFetch = 0;
    let isFetching = false;
    
    // ═══════════════════════════════════════════════════════════
    // PREZZI ATTUALI
    // ═══════════════════════════════════════════════════════════
    
    async function fetchCurrentPrices(coins = []) {
        // Rate limiting
        if (isFetching) return AppState.prices;
        if (Date.now() - lastFetch < 10000) return AppState.prices; // Min 10s tra richieste
        
        try {
            isFetching = true;
            
            // Se non specificati, usa i coin più comuni
            if (coins.length === 0) {
                coins = ['BTC', 'ETH', 'BNB', 'SOL', 'MATIC', 'ATOM', 'OSMO', 'LUNC', 'USTC'];
            }
            
            // Converti in CoinGecko IDs
            const ids = coins
                .map(c => COINGECKO_IDS[c.toUpperCase()])
                .filter(id => id)
                .join(',');
            
            if (!ids) {
                Logger.warn('PriceService', 'Nessun coin valido da cercare');
                return AppState.prices;
            }
            
            const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=eur,usd`;
            Logger.info('PriceService', `Fetching prezzi: ${ids}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Aggiorna cache
            for (const [id, prices] of Object.entries(data)) {
                // Trova il simbolo dal CoinGecko ID
                const symbol = Object.keys(COINGECKO_IDS).find(k => COINGECKO_IDS[k] === id);
                if (symbol) {
                    AppState.prices[symbol] = {
                        eur: prices.eur || 0,
                        usd: prices.usd || 0,
                        lastUpdate: Date.now()
                    };
                }
            }
            
            lastFetch = Date.now();
            Logger.success('PriceService', `Aggiornati ${Object.keys(data).length} prezzi`);
            
            return AppState.prices;
            
        } catch (error) {
            Logger.error('PriceService', 'Errore fetch prezzi', error);
            return AppState.prices;
            
        } finally {
            isFetching = false;
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // PREZZO SINGOLO COIN
    // ═══════════════════════════════════════════════════════════
    
    function getPrice(coin, currency = 'eur') {
        const cached = AppState.prices[coin.toUpperCase()];
        
        if (cached && Date.now() - cached.lastUpdate < CACHE_DURATION) {
            return cached[currency] || 0;
        }
        
        // Prezzo non in cache, ritorna 0 (verrà aggiornato al prossimo fetch)
        return cached?.[currency] || 0;
    }
    
    // ═══════════════════════════════════════════════════════════
    // PREZZO STORICO (per calcoli fiscali)
    // ═══════════════════════════════════════════════════════════
    
    async function fetchHistoricalPrice(coin, date) {
        const cacheKey = `${coin.toUpperCase()}_${date}`;
        
        // Check cache
        if (AppState.historicalPrices[cacheKey]) {
            return AppState.historicalPrices[cacheKey];
        }
        
        try {
            const coinId = COINGECKO_IDS[coin.toUpperCase()];
            if (!coinId) {
                Logger.warn('PriceService', `CoinGecko ID non trovato per ${coin}`);
                return 0;
            }
            
            // Formato data per CoinGecko: dd-mm-yyyy
            const [year, month, day] = date.split('-');
            const formattedDate = `${day}-${month}-${year}`;
            
            const url = `${COINGECKO_BASE}/coins/${coinId}/history?date=${formattedDate}`;
            Logger.info('PriceService', `Fetching prezzo storico: ${coin} @ ${date}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const priceEUR = data.market_data?.current_price?.eur || 0;
            
            // Salva in cache
            AppState.historicalPrices[cacheKey] = priceEUR;
            
            Logger.success('PriceService', `${coin} @ ${date} = €${priceEUR}`);
            return priceEUR;
            
        } catch (error) {
            Logger.error('PriceService', `Errore prezzo storico ${coin}@${date}`, error);
            return 0;
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // PREZZI STORICI BATCH (per performance)
    // ═══════════════════════════════════════════════════════════
    
    async function fetchHistoricalPricesBatch(requests) {
        // requests = [{ coin: 'BTC', date: '2024-01-15' }, ...]
        const results = {};
        
        // Filtra quelli già in cache
        const toFetch = requests.filter(r => {
            const cacheKey = `${r.coin.toUpperCase()}_${r.date}`;
            if (AppState.historicalPrices[cacheKey]) {
                results[cacheKey] = AppState.historicalPrices[cacheKey];
                return false;
            }
            return true;
        });
        
        Logger.info('PriceService', `Batch: ${toFetch.length} da scaricare, ${requests.length - toFetch.length} in cache`);
        
        // Fetch quelli mancanti (con rate limiting)
        for (const req of toFetch) {
            const price = await fetchHistoricalPrice(req.coin, req.date);
            const cacheKey = `${req.coin.toUpperCase()}_${req.date}`;
            results[cacheKey] = price;
            
            // Rate limit: 10 richieste/minuto per CoinGecko free
            await sleep(6000);
        }
        
        return results;
    }
    
    // ═══════════════════════════════════════════════════════════
    // PREZZO AL 1° GENNAIO (per Quadro RW)
    // ═══════════════════════════════════════════════════════════
    
    async function getJanuary1Price(coin, year) {
        return await fetchHistoricalPrice(coin, `${year}-01-01`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // PREZZO AL 31 DICEMBRE (per Quadro RW)
    // ═══════════════════════════════════════════════════════════
    
    async function getDecember31Price(coin, year) {
        return await fetchHistoricalPrice(coin, `${year}-12-31`);
    }
    
    // ═══════════════════════════════════════════════════════════
    // CONVERTI VALORE
    // ═══════════════════════════════════════════════════════════
    
    function convertToEUR(coin, amount) {
        const price = getPrice(coin, 'eur');
        return amount * price;
    }
    
    function convertToUSD(coin, amount) {
        const price = getPrice(coin, 'usd');
        return amount * price;
    }
    
    // ═══════════════════════════════════════════════════════════
    // CALCOLA VALORE PORTFOLIO
    // ═══════════════════════════════════════════════════════════
    
    async function calculatePortfolioValue() {
        const balances = Database.getBalances();
        let totalEUR = 0;
        let totalUSD = 0;
        
        // Fetch prezzi mancanti
        const coinsToFetch = Object.keys(balances).filter(coin => !getPrice(coin));
        if (coinsToFetch.length > 0) {
            await fetchCurrentPrices(coinsToFetch);
        }
        
        // Calcola totale
        for (const [coin, data] of Object.entries(balances)) {
            const priceEUR = getPrice(coin, 'eur');
            const priceUSD = getPrice(coin, 'usd');
            const amount = data.amount || 0;
            
            totalEUR += amount * priceEUR;
            totalUSD += amount * priceUSD;
            
            // Aggiorna balance con prezzo
            data.priceEUR = priceEUR;
            data.valueEUR = amount * priceEUR;
        }
        
        return { eur: totalEUR, usd: totalUSD };
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
        fetchCurrentPrices,
        getPrice,
        fetchHistoricalPrice,
        fetchHistoricalPricesBatch,
        getJanuary1Price,
        getDecember31Price,
        convertToEUR,
        convertToUSD,
        calculatePortfolioValue
    };
    
})();
