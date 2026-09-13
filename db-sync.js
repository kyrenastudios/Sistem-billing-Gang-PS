(() => {
    //======== Database Sync ========
    const DB_SYNC_URL = 'api/sync.php';
    // Consoles dan session billing ditangani API khusus; master console tidak lagi dipush oleh bridge umum.
    const KEYS = ['members', 'customPackages', 'history'];
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
            // Consoles tetap dibaca dari MySQL saat halaman dimuat, tetapi perubahan status/session tidak dipush bridge umum.
            applyArrayIfSafe('consoles', data.consoles);
            applyArrayIfSafe('members', data.members);
            applyArrayIfSafe('customPackages', data.customPackages);
            applyArrayIfSafe('history', data.history);
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

    async function postSnapshot(snapshot) {
        if (syncInProgress) { syncQueued = true; return false; }
        syncInProgress = true;
        try {
            const response = await fetch(DB_SYNC_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(snapshot) });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || result.message || `HTTP ${response.status}`);
            applyDatabaseState(result);
            return true;
        } catch (error) {
            console.error('DB Sync: gagal menulis ke MySQL:', error);
            return false;
        } finally {
            syncInProgress = false;
            if (syncQueued) { syncQueued=false; scheduleSync(); }
        }
    }

    function scheduleSync() {
        if (applyingDatabase) return;
        clearTimeout(syncTimer);
        syncTimer=setTimeout(()=>postSnapshot(buildSnapshot(true)),300);
    }

    const databaseState=requestDatabaseSyncSync();
    const initialized=storage.getItem(INIT_KEY)==='1';

    if(!initialized){
        const initialSnapshot=buildSnapshot(false);
        if(Object.keys(initialSnapshot).length>0){
            const xhr=new XMLHttpRequest();
            try{
                xhr.open('POST',DB_SYNC_URL,false);
                xhr.setRequestHeader('Content-Type','application/json');
                xhr.send(JSON.stringify(initialSnapshot));
                if(xhr.status>=200&&xhr.status<300) applyDatabaseState(JSON.parse(xhr.responseText));
                else console.warn('DB Sync: migrasi awal gagal HTTP',xhr.status,xhr.responseText);
            }catch(error){ console.warn('DB Sync: migrasi awal gagal.',error); }
        }else if(databaseState) applyDatabaseState(databaseState);
        originalSetItem.call(storage,INIT_KEY,'1');
    }else if(databaseState) applyDatabaseState(databaseState);

    Storage.prototype.setItem=function(key,value){
        originalSetItem.call(this,key,value);
        if(!applyingDatabase&&KEYS.includes(key)) scheduleSync();
    };
    Storage.prototype.removeItem=function(key){
        originalRemoveItem.call(this,key);
        if(!applyingDatabase&&KEYS.includes(key)) scheduleSync();
    };

    window.gangPsDbSync={
        refresh:()=>{const state=requestDatabaseSyncSync();if(state)applyDatabaseState(state);return state;},
        push:()=>postSnapshot(buildSnapshot(true))
    };
})();