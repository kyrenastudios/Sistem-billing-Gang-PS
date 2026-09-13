(() => {
    //======== Database Sync ========
    const DB_SYNC_URL = 'api/sync.php';
    const KEYS = ['consoles', 'members', 'customPackages', 'history'];
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

    function buildSnapshot(includeEmpty = true) {
        const data = {};
        KEYS.forEach(key => {
            const value = readArray(key);
            if (value !== null && (includeEmpty || value.length > 0)) data[key] = value;
        });
        return data;
    }

    function applyDatabaseState(result) {
        if (!result || !result.success || !result.data) return;
        applyingDatabase = true;
        try {
            const data = result.data;
            if (Array.isArray(data.consoles)) originalSetItem.call(storage, 'consoles', JSON.stringify(data.consoles));
            if (Array.isArray(data.members)) originalSetItem.call(storage, 'members', JSON.stringify(data.members));
            if (Array.isArray(data.customPackages)) originalSetItem.call(storage, 'customPackages', JSON.stringify(data.customPackages));
            if (Array.isArray(data.history)) originalSetItem.call(storage, 'history', JSON.stringify(data.history));
            if (Array.isArray(data.menuItems)) originalSetItem.call(storage, MENU_KEY, JSON.stringify(data.menuItems));
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

    async function postSnapshot(snapshot) {
        if (syncInProgress) {
            syncQueued = true;
            return;
        }
        syncInProgress = true;
        try {
            const response = await fetch(DB_SYNC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshot)
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
            applyDatabaseState(result);
        } catch (error) {
            console.warn('DB Sync: gagal menulis ke MySQL.', error);
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
        syncTimer = setTimeout(() => postSnapshot(buildSnapshot(true)), 300);
    }

    //======== Inisialisasi Database ========
    const databaseState = requestDatabaseSyncSync();
    const initialized = storage.getItem(INIT_KEY) === '1';

    if (!initialized) {
        const initialSnapshot = buildSnapshot(false);
        if (Object.keys(initialSnapshot).length > 0) {
            // Migrasikan data lokal yang masih ada sebelum MySQL menjadi sumber utama.
            const xhr = new XMLHttpRequest();
            try {
                xhr.open('POST', DB_SYNC_URL, false);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify(initialSnapshot));
                if (xhr.status >= 200 && xhr.status < 300) {
                    const result = JSON.parse(xhr.responseText);
                    applyDatabaseState(result);
                } else {
                    console.warn('DB Sync: migrasi awal gagal HTTP', xhr.status);
                }
            } catch (error) {
                console.warn('DB Sync: migrasi awal gagal.', error);
            }
        } else if (databaseState) {
            // Jika localStorage kosong, ambil data yang sudah ada di MySQL.
            applyDatabaseState(databaseState);
        }
        originalSetItem.call(storage, INIT_KEY, '1');
    } else if (databaseState) {
        // Setelah migrasi awal, MySQL menjadi sumber data utama.
        applyDatabaseState(databaseState);
    }

    //======== Pantau Perubahan Web ========
    Storage.prototype.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (!applyingDatabase && KEYS.includes(key)) scheduleSync();
    };

    Storage.prototype.removeItem = function(key) {
        originalRemoveItem.call(this, key);
        if (!applyingDatabase && KEYS.includes(key)) scheduleSync();
    };

    // Helper global untuk sinkronisasi manual bila dibutuhkan halaman lain.
    window.gangPsDbSync = {
        refresh: () => {
            const state = requestDatabaseSyncSync();
            if (state) applyDatabaseState(state);
            return state;
        },
        push: () => postSnapshot(buildSnapshot(true))
    };
})();
