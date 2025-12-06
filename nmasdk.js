/**
 * Naji Mini Apps SDK v3.0
 */
class NajiSDK {
    constructor() {
        this.user = null;
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

            // 1. Init
            if (data.type === 'NAJI_INIT_DATA') {
                this.user = data.user;
                this.theme = data.theme; // Получаем тему при старте
                this.initialized = true;
                this.initCallbacks.forEach(cb => cb());
            }

            // 2. Async Responses
            if (data.type === 'NAJI_ASYNC_RESPONSE') {
                const { reqId, result, error } = data;
                if (this.pendingRequests[reqId]) {
                    if (error) this.pendingRequests[reqId].reject(error);
                    else this.pendingRequests[reqId].resolve(result);
                    delete this.pendingRequests[reqId];
                }
            }

            // 3. Events from Host
            if (data.type === 'NAJI_EVENT') {
                const { eventName, payload } = data;
                if (this.eventListeners[eventName]) {
                    this.eventListeners[eventName].forEach(cb => cb(payload));
                }
            }
        });

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
        });
    }

    onInit(callback) {
        if (this.initialized) callback();
        else this.initCallbacks.push(callback);
    }

    // === User & Environment ===
    getNickname() { return this.user?.username; }
    getName() { return this.user?.first_name; }
    getSurname() { return this.user?.last_name; }
    getFullName() { return this.user ? `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim() : null; }
    getUserAvatar() { return this.user?.avatar; }
    
    /** Возвращает 'light' или 'dark' */
    getColorScheme() { return this.theme || 'light'; }

    // === UI & Navigation ===
    openLink(url) { this._postMessage('OPEN_LINK', { url }); }
    openNMLink(path) { this._postMessage('OPEN_NM_LINK', { path }); }
    
    showAlert(message) { this._postMessage('SHOW_ALERT', { message }); }
    isReady() { this._postMessage('APP_READY'); }
    setHeaderColor(color) { this._postMessage('SET_HEADER_COLOR', { color }); }

    /** Разворачивает ВЕСЬ мессенджер в полноэкранный режим браузера */
    setFullscreen() { this._postMessage('SET_FULLSCREEN_APP', { value: true }); }
    exitFullscreen() { this._postMessage('SET_FULLSCREEN_APP', { value: false }); }

    // === Back Button ===
    backButton = {
        show: () => this._postMessage('BACK_BUTTON_UPDATE', { visible: true }),
        hide: () => this._postMessage('BACK_BUTTON_UPDATE', { visible: false }),
        onClick: (callback) => {
            this.eventListeners['backButtonClicked'].push(callback);
        },
        offClick: (callback) => {
            this.eventListeners['backButtonClicked'] = this.eventListeners['backButtonClicked'].filter(cb => cb !== callback);
        }
    };

    // === Sharing ===
    /**
     * Открывает окно выбора чата для пересылки текста или ссылки
     * @param {string} text Сообщение для шеринга
     */
    shareMessage(text) {
        this._postMessage('SHARE_MESSAGE', { text });
    }

    onMessageShared(callback) {
        this.eventListeners['messageShared'].push(callback);
    }

    // === Storage ===
    async setItem(key, value) { return this._request('STORAGE_SET', { key, value }); }
    async getItem(key) { return this._request('STORAGE_GET', { key }); }
    async changeItem(key, value) { return this.setItem(key, value); }
    async deleteItem(key) { return this._request('STORAGE_DELETE', { key }); }

    // === Payments & Solana ===
    
    /** Создать инвойс в NajiSparks */
    async createInvoice(title, amount) { return this._request('CREATE_INVOICE_SPARKS', { title, amount }); }

    /** Получить адрес кошелька */
    async getSolAddr() { return this._request('GET_SOLANA_ADDRESS'); }
    async getSolanaAddress() { return this.getSolAddr(); } // Alias

    /**
     * Запросить оплату в SOL (Lamports)
     * @param {string} recipientAddr Адрес получателя
     * @param {number} lamports Сумма (1 SOL = 1 000 000 000 Lamports)
     */
    async createSolanaInvoice(recipientAddr, lamports) {
        return this._request('SOLANA_TRANSFER', { recipient: recipientAddr, amount: lamports });
    }

    /**
     * Создать SPL Токен (MINT)
     * @param {string} name Название токена
     * @param {string} symbol Символ
     * @param {number} decimals Десятичные знаки (обычно 9)
     * @param {number} amount Начальное количество для минта
     */
    async mintSolanaToken(name, symbol, decimals, amount) {
        return this._request('SOLANA_MINT_TOKEN', { name, symbol, decimals, amount });
    }

    /**
     * Создать NFT (Упрощенно)
     * @param {string} name Название
     * @param {string} symbol Символ
     * @param {string} uri Ссылка на метаданные (JSON)
     */
    async mintSolanaNFT(name, symbol, uri) {
        return this._request('SOLANA_MINT_NFT', { name, symbol, uri });
    }

    downloadFile(url, filename) { this._postMessage('DOWNLOAD_FILE', { url, filename }); }
}

window.NajiApp = new NajiSDK();
