class NajiSDK {
    constructor() {
        this.user = null;
        this.theme = 'light';
        this.platform = 'web';
        this.permissions = {};
        this.wallet = null;
        this.initialized = false;
        this.initCallbacks = [];
        this.pendingRequests = {};
        this.eventListeners = {
            'backButtonClicked': [],
            'themeChanged': [],
            'permissionChanged': []
        };

        window.addEventListener('message', this._handleMessage.bind(this));
        this._postMessage('NAJI_SDK_INIT');

        console.log('🚀 Naji SDK v2.1 initialized');
    }

    _handleMessage(event) {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
            case 'NAJI_INIT_DATA':
                this.user = data.user;
                this.theme = data.theme || 'light';
                this.platform = data.platform || 'web';
                this.permissions = data.permissions || {};
                this.wallet = data.wallet || null;
                this.initialized = true;

                console.log('✅ SDK initialized');
                console.log('📱 Platform:', this.platform);
                console.log('💼 Wallet:', this.wallet?.connected ? 'Connected' : 'Not connected');

                this.initCallbacks.forEach(cb => {
                    try {
                        cb();
                    } catch (error) {
                        console.error('Init callback error:', error);
                    }
                });
                this.initCallbacks = [];
                break;

            case 'NAJI_ASYNC_RESPONSE':
                const { reqId, result, error } = data;
                if (this.pendingRequests[reqId]) {
                    if (error) {
                        this.pendingRequests[reqId].reject(new Error(error));
                    } else {
                        this.pendingRequests[reqId].resolve(result);
                    }
                    delete this.pendingRequests[reqId];
                }
                break;

            case 'NAJI_EVENT':
                const { eventName, payload } = data;
                if (this.eventListeners[eventName]) {
                    this.eventListeners[eventName].forEach(cb => {
                        try {
                            cb(payload);
                        } catch (error) {
                            console.error(`Event "${eventName}" handler error:`, error);
                        }
                    });
                }
                break;
        }
    }

    _postMessage(type, payload = {}) {
        if (window.parent) {
            window.parent.postMessage({ type, payload }, '*');
        }
    }

    _request(type, payload = {}, timeout = 60000) {
        return new Promise((resolve, reject) => {
            const reqId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            this.pendingRequests[reqId] = { resolve, reject };

            this._postMessage(type, { ...payload, reqId });

            setTimeout(() => {
                if (this.pendingRequests[reqId]) {
                    delete this.pendingRequests[reqId];
                    reject(new Error('Request timeout'));
                }
            }, timeout);
        });
    }

    onInit(callback) {
        if (this.initialized) {
            callback();
        } else {
            this.initCallbacks.push(callback);
        }
    }

    isInitialized() {
        return this.initialized;
    }

    ready() {
        this._postMessage('APP_READY');
    }

    getNickname() {
        return this.user?.username || null;
    }

    getUser() {
        return this.user;
    }

    getSparks() {
        return this.user?.sparks || 0;
    }

    getColorScheme() {
        return this.theme;
    }

    onThemeChange(callback) {
        this.eventListeners['themeChanged'].push(callback);
    }

    setHeaderColor(color) {
        this._postMessage('SET_HEADER_COLOR', { color });
    }

    setFullscreen(enabled) {
        this._postMessage('SET_FULLSCREEN_APP', { value: enabled });
    }

    backButton = {
        show: () => this._postMessage('BACK_BUTTON_UPDATE', { visible: true }),
        hide: () => this._postMessage('BACK_BUTTON_UPDATE', { visible: false }),
        onClick: (callback) => this.eventListeners['backButtonClicked'].push(callback),
        offClick: (callback) => {
            this.eventListeners['backButtonClicked'] = 
                this.eventListeners['backButtonClicked'].filter(cb => cb !== callback);
        }
    };

    openLink(url) {
        this._postMessage('OPEN_LINK', { url });
    }

    showAlert(message, title = null, type = 'info') {
        this._postMessage('SHOW_ALERT', { message, title, type });
    }

    async setItem(key, value) {
        return this._request('STORAGE_SET', { key, value });
    }

    async getItem(key) {
        return this._request('STORAGE_GET', { key });
    }

    async removeItem(key) {
        return this._request('STORAGE_REMOVE', { key });
    }

    async createInvoice(title, amount, description = '') {
        return this._request('CREATE_INVOICE_SPARKS', { title, amount, description });
    }

    isWalletConnected() {
        return this.wallet?.connected || false;
    }

    async getSolanaAddress() {
        return this._request('GET_SOLANA_ADDRESS');
    }

    async getSolanaBalance() {
        const result = await this._request('GET_SOLANA_BALANCE');
        return result.balance;
    }

    async getTokenBalance(tokenMint) {
        const result = await this._request('GET_TOKEN_BALANCE', { tokenMint });
        return result.balance;
    }

    async transferSOL(recipient, amount, memo = '') {
        return this._request('SOLANA_PAYMENT_REQUEST', { 
            recipient, 
            amount,
            tokenMint: 'SOL',
            memo
        });
    }

    async transferToken(recipient, amount, tokenMint, memo = '') {
        return this._request('SOLANA_PAYMENT_REQUEST', { 
            recipient, 
            amount,
            tokenMint,
            memo
        });
    }

    async createToken(config) {
        const { name, symbol, decimals = 9, supply = 0, uri } = config;

        if (!uri) {
            throw new Error('URI is required. Upload your metadata.json first.');
        }

        return this._request('SOLANA_CREATE_TOKEN', { 
            name,
            symbol,
            decimals,
            supply,
            uri
        });
    }

    async createNFT(config) {
        const { name, symbol, uri } = config;

        if (!uri) {
            throw new Error('URI is required. Upload your metadata.json first.');
        }

        return this._request('SOLANA_MINT_NFT', { 
            name,
            symbol,
            uri
        });
    }

    async signMessage(message) {
        return this._request('SOLANA_SIGN_MESSAGE', { message });
    }

    async executeSmartContract(params) {
        return this._request('SOLANA_EXECUTE_CONTRACT', params);
    }

    async requestPayment(recipient, amount, tokenMint = 'SOL', memo = '') {
        return this._request('SOLANA_PAYMENT_REQUEST', { 
            recipient, 
            amount,
            tokenMint,
            memo
        });
    }

    async mintNFT(name, symbol, uri) {
        return this._request('SOLANA_MINT_NFT', { name, symbol, uri });
    }

    hasPermission(permission) {
        return this.permissions[permission] || false;
    }

    onPermissionChange(callback) {
        this.eventListeners['permissionChanged'].push(callback);
    }

    getPlatform() {
        return this.platform;
    }

    isMobile() {
        return this.platform === 'ios' || this.platform === 'android';
    }

    isIOS() {
        return this.platform === 'ios';
    }

    isAndroid() {
        return this.platform === 'android';
    }

    on(eventName, callback) {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    off(eventName, callback) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName] = 
                this.eventListeners[eventName].filter(cb => cb !== callback);
        }
    }

    getVersion() {
        return '2.1.0';
    }

    debug() {
        return {
            version: this.getVersion(),
            initialized: this.initialized,
            user: this.user,
            theme: this.theme,
            platform: this.platform,
            permissions: this.permissions,
            wallet: this.wallet,
            pendingRequests: Object.keys(this.pendingRequests).length
        };
    }
}

window.formatSolanaAddress = function(address, start = 4, end = 4) {
    if (!address) return '';
    return `${address.slice(0, start)}...${address.slice(-end)}`;
};

window.solToLamports = function(sol) {
    return sol * 1000000000; 

};

window.lamportsToSol = function(lamports) {
    return lamports / 1000000000;
};

window.isValidSolanaAddress = function(address) {
    if (!address || typeof address !== 'string') return false;
    if (address.length < 32 || address.length > 44) return false;
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
};

window.NajiApp = new NajiSDK();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NajiSDK;
}

console.log('📱 Naji Mini App SDK v2.1 loaded');
