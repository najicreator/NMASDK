/**
 * Naji Mini Apps SDK
 * Version: 2.0
 */

class NajiSDK {
    constructor() {
        this.user = null;
        this.initialized = false;
        this.initCallbacks = [];
        this.pendingRequests = {}; // Хранилище для Promise (ожидание ответа от основного приложения)

        // Слушаем сообщения от родительского окна (Najime)
        window.addEventListener('message', (event) => {
            const data = event.data;

            if (!data || typeof data !== 'object') return;

            // 1. Инициализация данными пользователя
            if (data.type === 'NAJI_INIT_DATA') {
                this.user = data.user;
                this.initialized = true;
                this.initCallbacks.forEach(cb => cb());
            }

            // 2. Ответ на асинхронный запрос (Storage, Payment, etc.)
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

        // Отправляем сигнал родителю, что SDK готов принимать данные
        this._postMessage('NAJI_SDK_INIT');
    }

    /**
     * Внутренний метод отправки сообщений
     */
    _postMessage(type, payload = {}) {
        if (window.parent) {
            window.parent.postMessage({ type, payload }, '*');
        } else {
            console.warn('[NajiSDK] Parent window not found. Run this inside Najime Messenger.');
        }
    }

    /**
     * Внутренний метод для запросов, требующих ответа (Promise)
     */
    _request(type, payload = {}) {
        return new Promise((resolve, reject) => {
            const reqId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            // Сохраняем resolve/reject чтобы вызвать их, когда придет ответ
            this.pendingRequests[reqId] = { resolve, reject };
            
            this._postMessage(type, { ...payload, reqId });
            
            // Таймаут на случай, если родитель не ответит (опционально, 30 сек)
            setTimeout(() => {
                if (this.pendingRequests[reqId]) {
                    this.pendingRequests[reqId].reject('Request timeout');
                    delete this.pendingRequests[reqId];
                }
            }, 30000);
        });
    }

    /**
     * Вызывает callback, когда SDK инициализирован и данные пользователя получены
     * @param {Function} callback 
     */
    onInit(callback) {
        if (this.initialized) {
            callback();
        } else {
            this.initCallbacks.push(callback);
        }
    }

    // ============================================================
    // 1. Получение данных о пользователе
    // ============================================================

    /** @returns {string|null} Юзернейм (например, "durov") */
    getNickname() {
        return this.user ? this.user.username : null;
    }

    /** @returns {string|null} Имя */
    getName() {
        return this.user ? this.user.first_name : null;
    }

    /** @returns {string|null} Фамилия */
    getSurname() {
        return this.user ? this.user.last_name : null;
    }

    /** @returns {string|null} Полное имя одной строкой */
    getFullName() {
        if (!this.user) return null;
        return `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim();
    }

    /** @returns {string|null} URL аватарки */
    getUserAvatar() {
        return this.user ? this.user.avatar : null;
    }

    // ============================================================
    // 2. Облачное хранилище (Cloud Storage)
    // Данные привязаны к конкретному пользователю в конкретном боте
    // ============================================================

    /**
     * Сохраняет значение по ключу
     * @param {string} key 
     * @param {any} value - Объект, строка или число
     * @returns {Promise<boolean>}
     */
    async setItem(key, value) {
        return this._request('STORAGE_SET', { key, value });
    }

    /**
     * Получает значение по ключу
     * @param {string} key 
     * @returns {Promise<any>}
     */
    async getItem(key) {
        return this._request('STORAGE_GET', { key });
    }

    /**
     * Изменяет значение (синоним setItem)
     */
    async changeItem(key, value) {
        return this.setItem(key, value);
    }

    /**
     * Удаляет значение по ключу
     * @returns {Promise<boolean>}
     */
    async deleteItem(key) {
        return this._request('STORAGE_DELETE', { key });
    }

    // ============================================================
    // 3. Платежи и Кошелек
    // ============================================================

    /**
     * Показывает нативное окно оплаты товара за NajiSparks
     * @param {string} title - Название товара
     * @param {number} amount - Стоимость в Sparks
     * @returns {Promise<boolean>} true - оплачено, false - отмена/ошибка
     */
    async createInvoice(title, amount) {
        return this._request('CREATE_INVOICE', { title, amount });
    }

    /**
     * Получает адрес привязанного Solana кошелька пользователя
     * @returns {Promise<string|null>} Адрес кошелька или null
     */
    async getSolanaAddress() {
        return this._request('GET_SOLANA_ADDRESS');
    }

    // ============================================================
    // 4. Интерфейс (UI) и Окно
    // ============================================================

    /**
     * Сообщает приложению, что Mini App загрузился (убирает лоадер/индикатор)
     */
    isReady() {
        this._postMessage('APP_READY');
    }

    /**
     * Показывает красивое всплывающее уведомление внутри мессенджера
     * @param {string} message 
     */
    showAlert(message) {
        this._postMessage('SHOW_ALERT', { message });
    }

    /**
     * Меняет цвет шапки окна
     * @param {string} color - HEX код (например '#ff0000')
     */
    setHeaderColor(color) {
        this._postMessage('SET_HEADER_COLOR', { color });
    }

    /**
     * Разворачивает приложение на весь экран (скрывает шапку мессенджера)
     */
    setFullscreen() {
        this._postMessage('SET_FULLSCREEN', { value: true });
    }

    /**
     * Возвращает приложение в стандартное модальное окно с шапкой
     */
    exitFullscreen() {
        this._postMessage('SET_FULLSCREEN', { value: false });
    }

    /**
     * Проверяет, активно ли окно приложения в данный момент
     * @returns {Promise<boolean>}
     */
    async isActive() {
        return this._request('CHECK_IS_ACTIVE');
    }

    // ============================================================
    // 5. Навигация и Утилиты
    // ============================================================

    /**
     * Открывает внешнюю ссылку в новой вкладке
     */
    openLink(url) {
        this._postMessage('OPEN_LINK', { url });
    }

    /**
     * Открывает внутреннюю ссылку мессенджера (например, переход в чат)
     * @param {string} path 
     */
    openNMLink(path) {
        this._postMessage('OPEN_NM_LINK', { path });
    }

    /**
     * Инициирует скачивание файла
     */
    downloadFile(url, filename) {
        this._postMessage('DOWNLOAD_FILE', { url, filename });
    }
}

// Инициализация глобального объекта
window.NajiApp = new NajiSDK();
