(() => {
    //======== Database Sync ========
    const DB_SYNC_URL = 'api/sync.php';
    const HISTORY_SYNC_URL = 'api/history.php';
    const KEYS = ['members', 'customPackages'];
    const MASTER_KEYS = ['members', 'customPackages'];
    const INIT_KEY = 'gangPsDbInitialized';

    let applyingDatabase = false;
    let syncTimer = null;
    let syncInProgress = false;
    let syncQueued = false;
    let historyCache = [];

    const storage = window.localStorage;
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    function readArray(key) {
        try {
            const value = originalGetItem.call(storage, key);
            if (!value) return null;
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : null;
        } catch (error) {
            console.warn(`DB Sync: data ${key} tidak valid.`, error);
            return null;
        }
    }

    function buildSnapshot(keys, includeEmpty = true) {
        const data = {};
        keys.forEach(key => {
            const value = readArray(key);
            if (value !== null && (includeEmpty || value.length > 0)) data[key] = value;
        });
        return data;
    }

    function applyArrayIfSafe(key, value) {
        if (!Array.isArray(value)) return;
        const local = readArray(key);
        if (value.length === 0 && local && local.length > 0) return;
        originalSetItem.call(storage, key, JSON.stringify(value));
    }

    function applyDatabaseState(result) {
        if (!result || !result.success || !result.data) return;
        applyingDatabase = true;
        try {
            const data = result.data;
            applyArrayIfSafe('consoles', data.consoles);
            applyArrayIfSafe('members', data.members);
            applyArrayIfSafe('customPackages', data.customPackages);
            if (Array.isArray(data.history)) historyCache = data.history;
        } finally {
            applyingDatabase = false;
        }
    }

    function requestDatabaseSyncSync() {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', DB_SYNC_URL, false);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.send();
            if (xhr.status < 200 || xhr.status >= 300) throw new Error(`HTTP ${xhr.status}`);
            return JSON.parse(xhr.responseText);
        } catch (error) {
            console.warn('DB Sync: gagal membaca MySQL. History tidak menggunakan localStorage.', error);
            return null;
        }
    }

    async function postJson(url, payload) {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const text = await response.text();
        let result = null;
        try { result = JSON.parse(text); } catch (error) { throw new Error(`HTTP ${response.status}: respons server bukan JSON: ${text.slice(0, 300)}`); }
        if (!response.ok || !result.success) throw new Error(result.error || result.message || `HTTP ${response.status}`);
        return result;
    }

    async function postMasterSnapshot(snapshot) {
        if (Object.keys(snapshot).length === 0) return true;
        try { await postJson(DB_SYNC_URL, snapshot); return true; }
        catch (error) { console.error('DB Sync: gagal menulis master data ke MySQL:', error); return false; }
    }

    async function postHistorySnapshot(history) {
        if (!Array.isArray(history)) return true;
        if (String(window.gangPsServerMode || '').toLowerCase() === 'client') return false;
        try {
            const result = await postJson(HISTORY_SYNC_URL, { history });
            if (result && result.data && Array.isArray(result.data)) historyCache = result.data;
            return true;
        } catch (error) {
            console.error('DB Sync: gagal menulis history ke MySQL:', error);
            return false;
        }
    }

    async function syncNow() {
        if (syncInProgress) { syncQueued = true; return; }
        syncInProgress = true;
        try {
            const masterSnapshot = buildSnapshot(MASTER_KEYS, true);
            await postMasterSnapshot(masterSnapshot);
        } finally {
            syncInProgress = false;
            if (syncQueued) { syncQueued = false; scheduleSync(); }
        }
    }

    function scheduleSync() {
        if (applyingDatabase) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(syncNow, 300);
    }

    //======== Initial Database Load ========
    const databaseState = requestDatabaseSyncSync();
    if (databaseState) applyDatabaseState(databaseState);
    originalSetItem.call(storage, INIT_KEY, '1');

    //======== Storage Watcher ========
    Storage.prototype.getItem = function(key) {
        if (key === 'history') return JSON.stringify(historyCache);
        return originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function(key, value) {
        if (key === 'history') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    historyCache = parsed;
                    if (!applyingDatabase && String(window.gangPsServerMode || '').toLowerCase() !== 'client') postHistorySnapshot(historyCache);
                }
            } catch (error) { console.warn('DB Sync: history baru tidak valid.', error); }
            return;
        }
        originalSetItem.call(this, key, value);
        if (!applyingDatabase && KEYS.includes(key)) scheduleSync();
    };

    Storage.prototype.removeItem = function(key) {
        if (key === 'history') return;
        originalRemoveItem.call(this, key);
        if (!applyingDatabase && KEYS.includes(key)) scheduleSync();
    };

    window.gangPsDbSync = {
        refresh: () => {
            const state = requestDatabaseSyncSync();
            if (state) applyDatabaseState(state);
            return state;
        },
        push: () => syncNow(),
        getHistory: () => historyCache.slice()
    };
})();
