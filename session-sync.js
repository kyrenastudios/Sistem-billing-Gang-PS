(() => {
    //======== Session MySQL Sync ========
    const SESSION_API_URL = 'api/sessions.php';
    const originalSetItem = Storage.prototype.setItem;
    let timer = null;
    let inProgress = false;
    let queued = false;

    async function syncSessions() {
        if (inProgress) { queued = true; return; }
        inProgress = true;
        try {
            const raw = localStorage.getItem('consoles');
            const consoles = raw ? JSON.parse(raw) : [];
            const response = await fetch(SESSION_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consoles: Array.isArray(consoles) ? consoles : [] })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || result.message || `HTTP ${response.status}`);
        } catch (error) {
            console.error('Session MySQL sync gagal:', error);
        } finally {
            inProgress = false;
            if (queued) { queued = false; schedule(); }
        }
    }

    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(syncSessions, 150);
    }

    Storage.prototype.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        if (key === 'consoles') schedule();
    };
})();
