class NajiSDK {
    constructor() {
        this.user = null;
        this.initialized = false;
        this.initCallbacks = [];
        
        // Слушаем сообщения от родительского окна (Najime App)
        window.addEventListener('message', (event) => {
            const data = event.data;
            
            // Обработка инициализации
            if (data.type === 'NAJI_INIT_DATA') {
                this.user = data.user;
                this.initialized = true;
                this.initCallbacks.forEach(cb => cb());
            }
        });

        // Сообщаем родителю, что SDK загружен и ждет данных
        this._postMessage('NAJI_SDK_INIT');
    }

    /**
     * Внутренний метод отправки сообщений родителю
     */
    _postMessage(type, payload = {}) {
        if (window.parent) {
            window.parent.postMessage({ type, payload }, '*');
        } else {
            console.warn('NajiSDK: Parent window not found. Are you running inside Najime?');
        }
    }

    /**
     * Ожидание инициализации SDK
     * @param {Function} callback 
     */
    onInit(callback) {
        if (this.initialized) {
            callback();
        } else {
            this.initCallbacks.push(callback);
        }
    }

    // === User Info Getters ===

    getNickname() {
        return this.user ? this.user.username : null;
    }

    getName() {
        return this.user ? this.user.first_name : null;
    }

    getSurname() {
        return this.user ? this.user.last_name : null;
    }

    getFullName() {
        if (!this.user) return null;
        return `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim();
    }

    getUserAvatar() {
        return this.user ? this.user.avatar : null;
    }

    // === Navigation ===

    openLink(url) {
        this._postMessage('OPEN_LINK', { url });
    }

    openNMLink(path) {
        // Для внутренних ссылок, например "settings" или "chat/username"
        this._postMessage('OPEN_NM_LINK', { path });
    }

    // === UI Interactions ===

    showAlert(message) {
        this._postMessage('SHOW_ALERT', { message });
    }

    /**
     * Сообщает приложению, что Mini App полностью загрузился (убирает лоадер, если есть)
     */
    isReady() {
        this._postMessage('APP_READY');
    }

    /**
     * Меняет цвет шапки модального окна
     * @param {string} color - HEX code (e.g. '#ff0000') or CSS color
     */
    setHeaderColor(color) {
        this._postMessage('SET_HEADER_COLOR', { color });
    }

    /**
     * Разворачивает Mini App на весь экран (скрывает шапку или растягивает модалку)
     */
    setFullscreen() {
        this._postMessage('SET_FULLSCREEN', { value: true });
    }

    /**
     * Возвращает Mini App в стандартный режим
     */
    exitFullscreen() {
        this._postMessage('SET_FULLSCREEN', { value: false });
    }

    // === Utilities ===

    /**
     * Скачивает файл. Запрос передается в основное приложение для обхода CORS/Sandbox.
     * @param {string} url 
     * @param {string} [filename] 
     */
    downloadFile(url, filename) {
        this._postMessage('DOWNLOAD_FILE', { url, filename });
    }
}

// Экспортируем глобальный инстанс
window.NMA = new NajiSDK();
