class NajiSDK {
    constructor() {
        this.user = null;
        this.initialized = false;
        this.initCallbacks = [];
        this.pendingRequests = {}; // Хранилище для ожидающих промисов
        
        window.addEventListener('message', (event) => {
            const data = event.data;
            
            // Инициализация
            if (data.type === 'NAJI_INIT_DATA') {
                this.user = data.user;
                this.initialized = true;
                this.initCallbacks.forEach(cb => cb());
            }

            // Ответ на запрос (Async Response)
            if (data.type === 'NAJI_ASYNC_RESPONSE') {
                const { reqId, result, error } = data;
                if (this.pendingRequests[reqId]) {
                    if (error) {
                        this.pendingRequests[reqId].reject(error);
                    } else {
                        this.pendingRequests[reqId].resolve(result);
                    }
                    delete this.pendingRequests[reqId];
                }
            }
        });

        this._postMessage('NAJI_SDK_INIT');
    }

    _postMessage(type, payload = {}) {
        if (window.parent) {
            window.parent.postMessage({ type, payload }, '*');
        }
    }

    /**
     * Отправляет запрос родителю и ждет ответ
     */
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

    // === User Info ===
    getNickname() { return this.user ? this.user.username : null; }
    getName() { return this.user ? this.user.first_name : null; }
    getSurname() { return this.user ? this.user.last_name : null; }
    getFullName() { return this.user ? `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim() : null; }
    getUserAvatar() { return this.user ? this.user.avatar : null; }

    // === New Methods ===

    async isActive() {
        // Спрашиваем у родителя, в фокусе ли сейчас приложение
        return this._request('CHECK_IS_ACTIVE');
    }

    async getSolanaAddress() {
        return this._request('GET_SOLANA_ADDRESS');
    }

    // === Cloud Storage ===

    async setItem(key, value) {
        return this._request('STORAGE_SET', { key, value });
    }

    async getItem(key) {
        return this._request('STORAGE_GET', { key });
    }

    async changeItem(key, value) {
        // Для бэкенда это то же самое, что set (upsert)
        return this._request('STORAGE_SET', { key, value });
    }

    async deleteItem(key) {
        return this._request('STORAGE_DELETE', { key });
    }

    // === Payments ===

    /**
     * Создает инвойс на оплату
     * @param {string} title Название товара
     * @param {number} amount Сумма в NajiSparks
     * @returns {Promise<boolean>} true если оплачено, false если отменено
     */
    async createInvoice(title, amount) {
        return this._request('CREATE_INVOICE', { title, amount });
    }

    // === UI Actions ===

    openLink(url) { this._postMessage('OPEN_LINK', { url }); }
    openNMLink(path) { this._postMessage('OPEN_NM_LINK', { path }); }
    
    // Теперь это показывает кастомный Div в мессенджере
    showAlert(message) {
        this._postMessage('SHOW_ALERT', { message });
    }

    isReady() { this._postMessage('APP_READY'); }
    setHeaderColor(color) { this._postMessage('SET_HEADER_COLOR', { color }); }

    setFullscreen() { this._postMessage('SET_FULLSCREEN', { value: true }); }
    exitFullscreen() { this._postMessage('SET_FULLSCREEN', { value: false }); }

    downloadFile(url, filename) { this._postMessage('DOWNLOAD_FILE', { url, filename }); }
}

window.NajiApp = new NajiSDK();
