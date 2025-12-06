/**
 * Naji Mini Apps SDK v3.0
 */
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

            // 1. Инициализация
            if (data.type === 'NAJI_INIT_DATA') {
                this.user = data.user;
                this.theme = data.theme || 'light';
                this.initialized = true;
                this.initCallbacks.forEach(cb => cb());
            }

            // 2. Ответы на асинхронные запросы
            if (data.type === 'NAJI_ASYNC_RESPONSE') {
                const { reqId, result, error } = data;
                if (this.pendingRequests[reqId]) {
                    if (error) this.pendingRequests[reqId].reject(error);
                    else this.pendingRequests[reqId].resolve(result);
                    delete this.pendingRequests[reqId];
                }
            }

            // 3. События от хоста
            if (data.type === 'NAJI_EVENT') {
                const { eventName, payload } = data;
                if (this.eventListeners[eventName]) {
                    this.eventListeners[eventName].forEach(cb => cb(payload));
                }
            }
        });

        // Сообщаем, что мы загрузились
        this._postMessage('NAJI_SDK_INIT');
    }

    _postMessage(type, payload = {}) {
        if (window.parent) window.parent.postMessage({ type, payload }, '*');
        else console.warn('[NajiSDK] Parent window not found.');
    }

    _request(type, payload = {}) {
        return new Promise((resolve, reject) => {
            const reqId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            this.pendingRequests[reqId] = { resolve, reject };
            this._postMessage(type, { ...payload, reqId });
            // Таймаут 30 секунд
            setTimeout(() => {
                if (this.pendingRequests[reqId]) {
                    delete this.pendingRequests[reqId];
                    reject('Request timeout');
                }
            }, 30000);
        });
    }

    onInit(callback) {
        if (this.initialized) callback();
        else this.initCallbacks.push(callback);
    }

    // === Данные пользователя ===
    getNickname() { return this.user?.username; }
    getName() { return this.user?.first_name; }
    getSurname() { return this.user?.last_name; }
    getFullName() { return this.user ? `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim() : 'Guest'; }
    getUserAvatar() { return this.user?.avatar; }
    getColorScheme() { return this.theme; }

    // === UI и Навигация ===
    openLink(url) { this._postMessage('OPEN_LINK', { url }); }
    openNMLink(path) { this._postMessage('OPEN_NM_LINK', { path }); }
    showAlert(message) { this._postMessage('SHOW_ALERT', { message }); }
    isReady() { this._postMessage('APP_READY'); }
    setHeaderColor(color) { this._postMessage('SET_HEADER_COLOR', { color }); }
    setFullscreen() { this._postMessage('SET_FULLSCREEN_APP', { value: true }); }
    exitFullscreen() { this._postMessage('SET_FULLSCREEN_APP', { value: false }); }

    // === Кнопка Назад ===
    backButton = {
        show: () => this._postMessage('BACK_BUTTON_UPDATE', { visible: true }),
        hide: () => this._postMessage('BACK_BUTTON_UPDATE', { visible: false }),
        onClick: (callback) => this.eventListeners['backButtonClicked'].push(callback),
        offClick: (callback) => {
            this.eventListeners['backButtonClicked'] = this.eventListeners['backButtonClicked'].filter(cb => cb !== callback);
        }
    };

    // === Шеринг ===
    shareMessage(text) { this._postMessage('SHARE_MESSAGE', { text }); }
    onMessageShared(callback) { this.eventListeners['messageShared'].push(callback); }

    // === Облачное хранилище ===
    async setItem(key, value) { return this._request('STORAGE_SET', { key, value }); }
    async getItem(key) { return this._request('STORAGE_GET', { key }); }
    async changeItem(key, value) { return this.setItem(key, value); }
    async deleteItem(key) { return this._request('STORAGE_DELETE', { key }); }

    // === Платежи и Solana ===
    async createInvoice(title, amount) { return this._request('CREATE_INVOICE_SPARKS', { title, amount }); }
    async getSolanaAddress() { return this._request('GET_SOLANA_ADDRESS'); }
    async createSolanaInvoice(recipientAddr, lamports) {
        return this._request('SOLANA_TRANSFER', { recipient: recipientAddr, amount: lamports });
    }
    
    // === Разное ===
    downloadFile(url, filename) { this._postMessage('DOWNLOAD_FILE', { url, filename }); }
    async isActive() { return this._request('CHECK_IS_ACTIVE'); }
}

window.NajiApp = new NajiSDK();
