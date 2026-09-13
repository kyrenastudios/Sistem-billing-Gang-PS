(() => {
    //======== Database Sync ========
    const DB_SYNC_URL = 'api/sync.php';
    const HISTORY_SYNC_URL = 'api/history.php';
    const KEYS = ['members', 'customPackages', 'history'];
    const MASTER_KEYS = ['members', 'customPackages'];
    const MENU_KEY = 'menuItems';
    const INIT_KEY = 'gangPsDbInitialized';

    let applyingDatabase = false;
    let syncTimer = null;
    let syncInProgress = false;
    let syncQueued = false;

    const storage = window.localStorage;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    function readArray(key) {
        try {
            const value = storage.getItem(key);
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

    function applyDatabaseState(result, includeHistory = true) {
        if (!result || !result.success || !result.data) return;
        applyingDatabase = true;
        try {
            const data = result.data;
            applyArrayIfSafe('consoles', data.consoles);
            applyArrayIfSafe('members', data.members);
            applyArrayIfSafe('customPackages', data.customPackages);
            if (includeHistory) applyArrayIfSafe('history', data.history);
            applyArrayIfSafe(MENU_KEY, data.menuItems);
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
            console.warn('DB Sync: gagal membaca MySQL, web tetap menggunakan cache.', error);
            return null;
        }
    }

    async function postJson(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await response.text();
        let result = null;
        try {
            result = JSON.parse(text);
        } catch (error) {
            throw new Error(`HTTP ${response.status}: respons server bukan JSON: ${text.slice(0, 300)}`);
        }
        if (!response.ok || !result.success) {
            throw new Error(result.error || result.message || `HTTP ${response.status}`);
        }
        return result;
    }

    async function postMasterSnapshot(snapshot) {
        if (Object.keys(snapshot).length === 0) return true;
        try {
            await postJson(DB_SYNC_URL, snapshot);
            return true;
        } catch (error) {
            console.error('DB Sync: gagal menulis master data ke MySQL:', error);
            return false;
        }
    }

    async function postHistorySnapshot(history) {
        // History kosong tetap dikirim agar transaksi di MySQL ikut terhapus setelah user menghapus semuanya.
        if (!Array.isArray(history)) return true;
        try {
            await postJson(HISTORY_SYNC_URL, { history });
            return true;
        } catch (error) {
            console.error('DB Sync: gagal menulis history ke MySQL:', error);
            return false;
        }
    }

    async function syncNow() {
        if (syncInProgress) {
            syncQueued = true;
            return;
        }
        syncInProgress = true;
        try {
            const masterSnapshot = buildSnapshot(MASTER_KEYS, true);
            const history = readArray('history');
            await Promise.all([
                postMasterSnapshot(masterSnapshot),
                postHistorySnapshot(history)
            ]);
        } finally {
            syncInProgress = false;
            if (syncQueued) {
                syncQueued = false;
                scheduleSync();
            }
        }
    }

    function scheduleSync() {
        if (applyingDatabase) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(syncNow, 300);
    }

    //======== Initial Database Load ========
    const databaseState = requestDatabaseSyncSync();
    const initialized = storage.getItem(INIT_KEY) === '1';

    if (!initialized) {
        const masterSnapshot = buildSnapshot(MASTER_KEYS, false);
        const history = readArray('history');
        let migrated = false;

        if (Object.keys(masterSnapshot).length > 0) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', DB_SYNC_URL, false);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify(masterSnapshot));
                migrated = xhr.status >= 200 && xhr.status < 300;
                if (!migrated) console.warn('DB Sync: migrasi master gagal HTTP', xhr.status, xhr.responseText);
            } catch (error) {
                console.warn('DB Sync: migrasi master gagal.', error);
            }
        }

        if (Array.isArray(history) && history.length > 0) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', HISTORY_SYNC_URL, false);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify({ history }));
                migrated = migrated || (xhr.status >= 200 && xhr.status < 300);
                if (xhr.status < 200 || xhr.status >= 300) console.warn('DB Sync: migrasi history gagal HTTP', xhr.status, xhr.responseText);
            } catch (error) {
                console.warn('DB Sync: migrasi history gagal.', error);
            }
        }

        if (!migrated && databaseState) applyDatabaseState(databaseState, true);
        originalSetItem.call(storage, INIT_KEY, '1');
    } else if (databaseState) {
        applyDatabaseState(databaseState, true);
    }

    //======== Storage Watcher ========
    Storage.prototype.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (!applyingDatabase && KEYS.includes(key)) scheduleSync();
    };

    Storage.prototype.removeItem = function(key) {
        originalRemoveItem.call(this, key);
        if (!applyingDatabase && KEYS.includes(key)) scheduleSync();
    };

    window.gangPsDbSync = {
        refresh: () => {
            const state = requestDatabaseSyncSync();
            if (state) applyDatabaseState(state, true);
            return state;
        },
        push: () => syncNow()
    };
})();
