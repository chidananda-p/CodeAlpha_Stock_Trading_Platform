/* ══════════════════════════════════════════════════
   MODELS (OOP)
   ══════════════════════════════════════════════════ */

/**
 * Represents a stock with symbol, price, and price history.
 */
class Stock {
    constructor(symbol, companyName, initialPrice) {
        this.symbol = symbol;
        this.companyName = companyName;
        this.currentPrice = initialPrice;
        this.openPrice = initialPrice;
        this.priceHistory = [initialPrice];
    }

    /** Simulates realistic price movement using Gaussian distribution. */
    updatePrice() {
        const changePercent = this._gaussianRandom() * 1.5;
        this.currentPrice += this.currentPrice * (changePercent / 100);
        this.currentPrice = Math.max(0.01, Math.round(this.currentPrice * 100) / 100);
        this.priceHistory.push(this.currentPrice);
    }

    get change()        { return this.currentPrice - this.openPrice; }
    get changePercent() { return this.openPrice === 0 ? 0 : (this.change / this.openPrice) * 100; }

    _gaussianRandom() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}

/**
 * Records a single buy or sell transaction.
 */
class Transaction {
    constructor(type, symbol, quantity, price, timestamp = new Date()) {
        this.type = type;           // 'BUY' or 'SELL'
        this.symbol = symbol;
        this.quantity = quantity;
        this.price = price;
        this.total = quantity * price;
        this.timestamp = timestamp instanceof Date ? timestamp : new Date(timestamp);
    }

    get formattedTime() {
        return this.timestamp.toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    toJSON() {
        return {
            type: this.type, symbol: this.symbol,
            quantity: this.quantity, price: this.price,
            timestamp: this.timestamp.toISOString()
        };
    }

    static fromJSON(obj) {
        return new Transaction(obj.type, obj.symbol, obj.quantity, obj.price, obj.timestamp);
    }
}

/**
 * Represents a user with balance, holdings, cost basis, and transaction history.
 */
class User {
    constructor(username, balance = 100000) {
        this.username = username;
        this.balance = balance;
        this.holdings = {};        // symbol -> quantity
        this.avgCostBasis = {};    // symbol -> average buy price
        this.transactions = [];
    }

    buyStock(symbol, quantity, price) {
        const totalCost = quantity * price;
        if (totalCost > this.balance) return false;

        this.balance -= totalCost;

        const existingQty  = this.holdings[symbol] || 0;
        const existingCost = (this.avgCostBasis[symbol] || 0) * existingQty;
        const newTotalQty  = existingQty + quantity;
        this.avgCostBasis[symbol] = (existingCost + totalCost) / newTotalQty;
        this.holdings[symbol] = newTotalQty;

        this.transactions.push(new Transaction('BUY', symbol, quantity, price));
        return true;
    }

    sellStock(symbol, quantity, price) {
        const currentQty = this.holdings[symbol] || 0;
        if (quantity > currentQty) return false;

        this.balance += quantity * price;
        const remaining = currentQty - quantity;

        if (remaining === 0) {
            delete this.holdings[symbol];
            delete this.avgCostBasis[symbol];
        } else {
            this.holdings[symbol] = remaining;
        }

        this.transactions.push(new Transaction('SELL', symbol, quantity, price));
        return true;
    }

    getPortfolioValue(market) {
        let total = 0;
        for (const [symbol, qty] of Object.entries(this.holdings)) {
            const stock = market.getStock(symbol);
            if (stock) total += stock.currentPrice * qty;
        }
        return total;
    }

    toJSON() {
        return {
            username: this.username,
            balance: this.balance,
            holdings: { ...this.holdings },
            avgCostBasis: { ...this.avgCostBasis },
            transactions: this.transactions.map(t => t.toJSON())
        };
    }

    static fromJSON(obj) {
        const user = new User(obj.username, obj.balance);
        user.holdings = { ...obj.holdings };
        user.avgCostBasis = { ...obj.avgCostBasis };
        user.transactions = (obj.transactions || []).map(Transaction.fromJSON);
        return user;
    }
}

/**
 * Manages the collection of listed stocks and simulates market ticks.
 */
class StockMarket {
    constructor() {
        this.stocks = new Map();
        this._initStocks();
    }

    _initStocks() {
        const data = [
            ['AAPL',  'Apple Inc.',            189.84],
            ['GOOGL', 'Alphabet Inc.',         141.80],
            ['MSFT',  'Microsoft Corp.',       378.91],
            ['AMZN',  'Amazon.com Inc.',       178.25],
            ['TSLA',  'Tesla Inc.',            248.42],
            ['META',  'Meta Platforms Inc.',   505.75],
            ['NFLX',  'Netflix Inc.',          628.30],
            ['NVDA',  'NVIDIA Corp.',          875.28],
            ['JPM',   'JPMorgan Chase & Co.', 198.47],
            ['DIS',   'Walt Disney Co.',       112.56],
        ];
        data.forEach(([s, n, p]) => this.stocks.set(s, new Stock(s, n, p)));
    }

    simulateTick() {
        this.stocks.forEach(stock => stock.updatePrice());
    }

    getStock(symbol) { return this.stocks.get(symbol); }
    getAllStocks()    { return [...this.stocks.values()]; }
    hasStock(symbol) { return this.stocks.has(symbol); }
}

/**
 * Handles localStorage persistence.
 */
class DataManager {
    static KEY = 'stocktrader_data';

    static save(user) {
        localStorage.setItem(DataManager.KEY, JSON.stringify(user.toJSON()));
    }

    static load() {
        const raw = localStorage.getItem(DataManager.KEY);
        if (!raw) return null;
        try { return User.fromJSON(JSON.parse(raw)); }
        catch { return null; }
    }

    static clear() {
        localStorage.removeItem(DataManager.KEY);
    }
}


/* ══════════════════════════════════════════════════
   APP CONTROLLER
   ══════════════════════════════════════════════════ */

class TradingApp {
    constructor() {
        this.market = new StockMarket();
        this.user = null;
        this.autoSimInterval = null;
        this._bindEvents();
        this._init();
    }

    /* ── Initialization ── */

    _init() {
        const saved = DataManager.load();
        if (saved) {
            this.user = saved;
            this._hideModal();
            this._refresh();
        }
    }

    _bindEvents() {
        // Modal
        document.getElementById('startBtn').addEventListener('click', () => this._startNew());
        document.getElementById('usernameInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') this._startNew();
        });

        // Tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
        });

        // Market controls
        document.getElementById('simulateBtn').addEventListener('click', () => this.simulateMarket());
        document.getElementById('autoSimBtn').addEventListener('click', () => this.toggleAutoSimulate());

        // Trade inputs
        document.getElementById('buySymbol').addEventListener('change', () => this._updateBuyPreview());
        document.getElementById('buyQty').addEventListener('input', () => this._updateBuyPreview());
        document.getElementById('sellSymbol').addEventListener('change', () => this._updateSellPreview());
        document.getElementById('sellQty').addEventListener('input', () => this._updateSellPreview());

        // Trade buttons
        document.getElementById('buyBtn').addEventListener('click', () => this._executeBuy());
        document.getElementById('sellBtn').addEventListener('click', () => this._executeSell());

        // Clear history
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this._clearHistory());
    }

    _startNew() {
        const name = document.getElementById('usernameInput').value.trim() || 'Trader';
        this.user = new User(name);
        this._hideModal();
        this._refresh();
        this._toast(`Welcome, ${name}! You start with $100,000.`, 'success');
    }

    _hideModal() {
        document.getElementById('welcomeModal').classList.add('hidden');
    }

    /* ── Tab Navigation ── */

    _switchTab(tabId) {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.nav-tab[data-tab="${tabId}"]`).classList.add('active');

        document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');

        if (tabId === 'trade')     this._populateTradeDropdowns();
        if (tabId === 'portfolio') this._renderPortfolio();
        if (tabId === 'history')   this._renderHistory();
    }

    /* ── Refresh All Views ── */

    _refresh() {
        this._updateHeader();
        this._renderMarket();
        DataManager.save(this.user);
    }

    _updateHeader() {
        document.getElementById('headerUser').textContent = this.user.username;
        document.getElementById('headerBalance').textContent = this._fmt(this.user.balance);
        const total = this.user.balance + this.user.getPortfolioValue(this.market);
        document.getElementById('headerTotal').textContent = this._fmt(total);
    }

    /* ── Market ── */

    _renderMarket() {
        const body = document.getElementById('marketBody');
        body.innerHTML = '';

        this.market.getAllStocks().forEach(stock => {
            const change = stock.change;
            const changePct = stock.changePercent;
            const cls = change >= 0 ? 'positive' : 'negative';
            const sign = change >= 0 ? '+' : '';
            const arrow = change >= 0 ? '▲' : '▼';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${stock.symbol}</strong></td>
                <td>${stock.companyName}</td>
                <td class="align-right">${this._fmt(stock.currentPrice)}</td>
                <td class="align-right ${cls}">${sign}${this._fmt(Math.abs(change))} ${arrow}</td>
                <td class="align-right ${cls}">${sign}${changePct.toFixed(2)}%</td>
                <td class="align-center">
                    <button class="btn-sm buy" data-symbol="${stock.symbol}" data-action="buy">Buy</button>
                    <button class="btn-sm sell" data-symbol="${stock.symbol}" data-action="sell">Sell</button>
                </td>
            `;
            body.appendChild(tr);
        });

        // Quick-trade buttons on market table
        body.querySelectorAll('.btn-sm').forEach(btn => {
            btn.addEventListener('click', () => {
                const symbol = btn.dataset.symbol;
                const action = btn.dataset.action;
                this._switchTab('trade');
                this._populateTradeDropdowns();
                if (action === 'buy') {
                    document.getElementById('buySymbol').value = symbol;
                    this._updateBuyPreview();
                } else {
                    document.getElementById('sellSymbol').value = symbol;
                    this._updateSellPreview();
                }
            });
        });
    }

    simulateMarket() {
        this.market.simulateTick();
        this._refresh();
    }

    toggleAutoSimulate() {
        const btn = document.getElementById('autoSimBtn');
        if (this.autoSimInterval) {
            clearInterval(this.autoSimInterval);
            this.autoSimInterval = null;
            btn.textContent = 'Auto ▶';
            btn.classList.remove('active');
        } else {
            this.autoSimInterval = setInterval(() => this.simulateMarket(), 2000);
            btn.textContent = 'Auto ■';
            btn.classList.add('active');
        }
    }

    /* ── Trade ── */

    _populateTradeDropdowns() {
        // Buy dropdown — all stocks
        const buySelect = document.getElementById('buySymbol');
        const currentBuy = buySelect.value;
        buySelect.innerHTML = '<option value="">Choose...</option>';
        this.market.getAllStocks().forEach(s => {
            buySelect.innerHTML += `<option value="${s.symbol}">${s.symbol} — ${s.companyName}</option>`;
        });
        buySelect.value = currentBuy;

        // Sell dropdown — only owned stocks
        const sellSelect = document.getElementById('sellSymbol');
        const currentSell = sellSelect.value;
        sellSelect.innerHTML = '<option value="">Choose...</option>';
        for (const [symbol, qty] of Object.entries(this.user.holdings)) {
            sellSelect.innerHTML += `<option value="${symbol}">${symbol} — ${qty} shares</option>`;
        }
        sellSelect.value = currentSell;

        this._updateBuyPreview();
        this._updateSellPreview();
    }

    _updateBuyPreview() {
        const symbol = document.getElementById('buySymbol').value;
        const qty = parseInt(document.getElementById('buyQty').value) || 0;
        const infoBox = document.getElementById('buyStockInfo');
        const summaryBox = document.getElementById('buySummary');

        if (!symbol) {
            infoBox.innerHTML = '<span>Select a stock to see details.</span>';
            summaryBox.innerHTML = '';
            return;
        }

        const stock = this.market.getStock(symbol);
        const maxQty = Math.floor(this.user.balance / stock.currentPrice);

        infoBox.innerHTML = `
            <div class="row"><span>Price</span><span class="val">${this._fmt(stock.currentPrice)}</span></div>
            <div class="row"><span>Max Affordable</span><span class="val">${maxQty.toLocaleString()} shares</span></div>
        `;

        if (qty > 0) {
            const total = qty * stock.currentPrice;
            const canAfford = total <= this.user.balance;
            summaryBox.innerHTML = `
                <div class="row"><span>Total Cost</span><span class="val">${this._fmt(total)}</span></div>
                <div class="row"><span>After Purchase</span><span class="val">${this._fmt(this.user.balance - total)}</span></div>
                ${!canAfford ? '<div class="row"><span class="negative">Insufficient funds</span></div>' : ''}
            `;
        } else {
            summaryBox.innerHTML = '';
        }
    }

    _updateSellPreview() {
        const symbol = document.getElementById('sellSymbol').value;
        const qty = parseInt(document.getElementById('sellQty').value) || 0;
        const infoBox = document.getElementById('sellStockInfo');
        const summaryBox = document.getElementById('sellSummary');

        if (!symbol) {
            infoBox.innerHTML = '<span>Select a stock to see details.</span>';
            summaryBox.innerHTML = '';
            return;
        }

        const stock = this.market.getStock(symbol);
        const owned = this.user.holdings[symbol] || 0;
        const avgCost = this.user.avgCostBasis[symbol] || 0;

        infoBox.innerHTML = `
            <div class="row"><span>Current Price</span><span class="val">${this._fmt(stock.currentPrice)}</span></div>
            <div class="row"><span>Owned</span><span class="val">${owned} shares</span></div>
            <div class="row"><span>Avg Cost</span><span class="val">${this._fmt(avgCost)}</span></div>
        `;

        if (qty > 0) {
            const revenue = qty * stock.currentPrice;
            const pl = (stock.currentPrice - avgCost) * qty;
            const plCls = pl >= 0 ? 'positive' : 'negative';
            const plSign = pl >= 0 ? '+' : '';
            const enough = qty <= owned;
            summaryBox.innerHTML = `
                <div class="row"><span>Revenue</span><span class="val">${this._fmt(revenue)}</span></div>
                <div class="row"><span>P/L</span><span class="val ${plCls}">${plSign}${this._fmt(pl)}</span></div>
                ${!enough ? '<div class="row"><span class="negative">Not enough shares</span></div>' : ''}
            `;
        } else {
            summaryBox.innerHTML = '';
        }
    }

    _executeBuy() {
        const symbol = document.getElementById('buySymbol').value;
        const qty = parseInt(document.getElementById('buyQty').value) || 0;
        if (!symbol) return this._toast('Select a stock first.', 'error');
        if (qty <= 0) return this._toast('Enter a valid quantity.', 'error');

        const stock = this.market.getStock(symbol);
        if (this.user.buyStock(symbol, qty, stock.currentPrice)) {
            this._toast(`Bought ${qty} shares of ${symbol} at ${this._fmt(stock.currentPrice)}`, 'success');
            document.getElementById('buyQty').value = '';
            this._updateBuyPreview();
            this._populateTradeDropdowns();
            this._refresh();
        } else {
            this._toast('Insufficient funds.', 'error');
        }
    }

    _executeSell() {
        const symbol = document.getElementById('sellSymbol').value;
        const qty = parseInt(document.getElementById('sellQty').value) || 0;
        if (!symbol) return this._toast('Select a stock first.', 'error');
        if (qty <= 0) return this._toast('Enter a valid quantity.', 'error');

        const stock = this.market.getStock(symbol);
        if (this.user.sellStock(symbol, qty, stock.currentPrice)) {
            this._toast(`Sold ${qty} shares of ${symbol} at ${this._fmt(stock.currentPrice)}`, 'success');
            document.getElementById('sellQty').value = '';
            this._updateSellPreview();
            this._populateTradeDropdowns();
            this._refresh();
        } else {
            this._toast('Not enough shares.', 'error');
        }
    }

    /* ── Portfolio ── */

    _renderPortfolio() {
        const holdingsValue = this.user.getPortfolioValue(this.market);
        const totalAssets = this.user.balance + holdingsValue;
        const returnPct = ((totalAssets - 100000) / 100000) * 100;
        const retCls = returnPct >= 0 ? 'positive' : 'negative';
        const retSign = returnPct >= 0 ? '+' : '';

        document.getElementById('portCash').textContent = this._fmt(this.user.balance);
        document.getElementById('portHoldings').textContent = this._fmt(holdingsValue);
        document.getElementById('portTotal').textContent = this._fmt(totalAssets);
        const retEl = document.getElementById('portReturn');
        retEl.textContent = `${retSign}${returnPct.toFixed(2)}%`;
        retEl.className = `stat-value ${retCls}`;

        const body = document.getElementById('portfolioBody');
        body.innerHTML = '';
        const entries = Object.entries(this.user.holdings);
        document.getElementById('emptyPortfolio').style.display = entries.length === 0 ? 'block' : 'none';

        entries.forEach(([symbol, qty]) => {
            const stock = this.market.getStock(symbol);
            const avgCost = this.user.avgCostBasis[symbol] || 0;
            const mktVal = stock.currentPrice * qty;
            const pl = (stock.currentPrice - avgCost) * qty;
            const cls = pl >= 0 ? 'positive' : 'negative';
            const sign = pl >= 0 ? '+' : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${symbol}</strong></td>
                <td class="align-right">${qty}</td>
                <td class="align-right">${this._fmt(avgCost)}</td>
                <td class="align-right">${this._fmt(stock.currentPrice)}</td>
                <td class="align-right">${this._fmt(mktVal)}</td>
                <td class="align-right ${cls}">${sign}${this._fmt(pl)}</td>
            `;
            body.appendChild(tr);
        });
    }

    /* ── History ── */

    _renderHistory() {
        const body = document.getElementById('historyBody');
        body.innerHTML = '';
        const txns = [...this.user.transactions].reverse();
        document.getElementById('emptyHistory').style.display = txns.length === 0 ? 'block' : 'none';

        txns.forEach((txn, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${txns.length - i}</td>
                <td>${txn.formattedTime}</td>
                <td><span class="badge badge-${txn.type.toLowerCase()}">${txn.type}</span></td>
                <td><strong>${txn.symbol}</strong></td>
                <td class="align-right">${txn.quantity}</td>
                <td class="align-right">${this._fmt(txn.price)}</td>
                <td class="align-right">${this._fmt(txn.total)}</td>
            `;
            body.appendChild(tr);
        });
    }

    _clearHistory() {
        if (this.user.transactions.length === 0) return;
        this.user.transactions = [];
        DataManager.save(this.user);
        this._renderHistory();
        this._toast('Transaction history cleared.', 'info');
    }

    /* ── Utilities ── */

    _fmt(n) {
        return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    _toast(message, type = 'info') {
        const el = document.getElementById('toast');
        el.textContent = message;
        el.className = `toast ${type} show`;
        setTimeout(() => el.classList.remove('show'), 2500);
    }
}


/* ── Launch ── */
const app = new TradingApp();
