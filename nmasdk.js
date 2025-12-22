class NajiSDK {
    constructor() {
        this.user = null;
        this.theme = 'light';
        this.initialized = false;
        this.initCallbacks = [];
        this.pendingRequests = {};
        this.eventListeners = {
            'backButtonClicked': [],
            'messageShared': []
        };

        window.addEventListener('message', (event) => {
            const data = event.data;
            if (!data || typeof data !== 'object') return;

            if (data.type === 'NAJI_INIT_DATA') {
                this.user = data.user;
                this.theme = data.theme || 'light';
                this.initialized = true;
                this.initCallbacks.forEach(cb => cb());
            }

            if (data.type === 'NAJI_ASYNC_RESPONSE') {
                const { reqId, result, error } = data;
                if (this.pendingRequests[reqId]) {
                    if (error) this.pendingRequests[reqId].reject(error);
                    else this.pendingRequests[reqId].resolve(result);
                    delete this.pendingRequests[reqId];
                }
            }

            if (data.type === 'NAJI_EVENT') {
                const { eventName, payload } = data;
                if (this.eventListeners[eventName]) {
                    this.eventListeners[eventName].forEach(cb => cb(payload));
                }
            }
        });

        // Handshake
        this._postMessage('NAJI_SDK_INIT');
    }

    _postMessage(type, payload = {}) {
        if (window.parent) window.parent.postMessage({ type, payload }, '*');
    }

    _request(type, payload = {}) {
        return new Promise((resolve, reject) => {
            const reqId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            this.pendingRequests[reqId] = { resolve, reject };
            this._postMessage(type, { ...payload, reqId });
            setTimeout(() => {
                if (this.pendingRequests[reqId]) {
                    delete this.pendingRequests[reqId];
                    reject('Request timeout');
                }
            }, 60000);
        });
    }

    onInit(callback) {
        if (this.initialized) callback();
        else this.initCallbacks.push(callback);
    }

    // === User & UI ===
    getNickname() { return this.user?.username; }
    getColorScheme() { return this.theme; }
    openLink(url) { this._postMessage('OPEN_LINK', { url }); }
    showAlert(message) { this._postMessage('SHOW_ALERT', { message }); }
    isReady() { this._postMessage('APP_READY'); }
    
    // === Back Button ===
    backButton = {
        show: () => this._postMessage('BACK_BUTTON_UPDATE', { visible: true }),
        hide: () => this._postMessage('BACK_BUTTON_UPDATE', { visible: false }),
        onClick: (callback) => this.eventListeners['backButtonClicked'].push(callback),
        offClick: (callback) => {
            this.eventListeners['backButtonClicked'] = this.eventListeners['backButtonClicked'].filter(cb => cb !== callback);
        }
    };

    async setItem(key, value) { return this._request('STORAGE_SET', { key, value }); }
    async getItem(key) { return this._request('STORAGE_GET', { key }); }

    async createInvoice(title, amount) { return this._request('CREATE_INVOICE_SPARKS', { title, amount }); }

    async getSolanaAddress() { 
        return this._request('GET_SOLANA_ADDRESS'); 
    }

    async requestPayment(recipientAddr, amount, tokenMint = 'SOL') {
        return this._request('SOLANA_PAYMENT_REQUEST', { 
            recipient: recipientAddr, 
            amount: amount,
            tokenMint: tokenMint 
        });
    }

    async mintNFT(name, symbol, uri) {
        return this._request('SOLANA_MINT_NFT', { name, symbol, uri });
    }
}

window.NajiApp = new NajiSDK();
