(() => {
    //======== Session MySQL Sync ========
    const SESSION_API_URL = 'api/sessions.php';
    const originalSetItem = Storage.prototype.setItem;
    const POLL_MS = 2000;
    const isMaster = String(window.GANG_PS_CONFIG?.mode || 'master').toLowerCase() === 'master';
    let saveTimer = null;
    let pollTimer = null;
    let inProgress = false;
    let queuedSave = null;
    let applyingRemote = false;
    let lastSavedSignature = '';

    function safeParse(value, fallback) {
        try { const parsed = JSON.parse(value); return parsed; } catch (_) { return fallback; }
    }

    function mergeSessions(remoteConsoles) {
        const local = safeParse(localStorage.getItem('consoles') || '[]', []);
        const localByName = new Map((Array.isArray(local) ? local : []).map(c => [c.name, c]));
        return (Array.isArray(remoteConsoles) ? remoteConsoles : []).map(remote => {
            const old = localByName.get(remote.name) || {};
            return {
                ...old,
                ...remote,
                session: remote.session || null,
                status: old.status === 'booked' && remote.status === 'available' ? 'booked' : (remote.status || 'available')
            };
        });
    }

    async function refresh() {
        if (inProgress) return;
        inProgress = true;
        try {
            const response = await fetch(`${SESSION_API_URL}?t=${Date.now()}`, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store'
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || result.message || `HTTP ${response.status}`);
            const remote = mergeSessions(result.data);
            const signature = JSON.stringify(remote);
            if (signature !== lastSavedSignature) {
                applyingRemote = true;
                try { localStorage.setItem('consoles', JSON.stringify(remote)); } finally { applyingRemote = false; }
                lastSavedSignature = signature;
                if (typeof window.gangPsApplyRemoteSessions === 'function') window.gangPsApplyRemoteSessions(remote);
            }
            return remote;
        } catch (error) {
            console.error('Gagal memuat session dari MySQL:', error);
            throw error;
        } finally {
            inProgress = false;
        }
    }

    async function push(consoles) {
        if (!isMaster) return refresh();
        const payload = Array.isArray(consoles) ? consoles : [];
        const signature = JSON.stringify(payload);
        lastSavedSignature = signature;
        if (inProgress) {
            queuedSave = payload;
            return;
        }
        inProgress = true;
        try {
            const response = await fetch(SESSION_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Gang-PS-Mode': 'master' },
                credentials: 'same-origin',
                body: JSON.stringify({ consoles: payload })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || result.message || `HTTP ${response.status}`);
            const remote = mergeSessions(result.data || payload);
            applyingRemote = true;
            try { localStorage.setItem('consoles', JSON.stringify(remote)); } finally { applyingRemote = false; }
            lastSavedSignature = JSON.stringify(remote);
            if (typeof window.gangPsApplyRemoteSessions === 'function') window.gangPsApplyRemoteSessions(remote);
            return remote;
        } catch (error) {
            console.error('Gagal menyimpan session ke MySQL:', error);
            throw error;
        } finally {
            inProgress = false;
            if (queuedSave) {
                const next = queuedSave;
                queuedSave = null;
                push(next).catch(() => {});
            }
        }
    }

    function save(consoles) {
        if (!isMaster) return Promise.resolve();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => push(consoles).catch(() => {}), 80);
        return Promise.resolve();
    }

    function schedulePoll() {
        clearTimeout(pollTimer);
        pollTimer = setTimeout(async () => {
            await refresh().catch(() => {});
            schedulePoll();
        }, POLL_MS);
    }

    Storage.prototype.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (key === 'consoles' && !applyingRemote) {
            // Cache lokal hanya sebagai fallback UI; session tetap disinkronkan ke MySQL lewat save().
        }
    };

    window.gangPsSessionSync = { refresh, save, push, isMaster };
    refresh().catch(() => {}).finally(schedulePoll);
})();
