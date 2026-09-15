document.addEventListener('DOMContentLoaded', () => {
    const billingMain = document.getElementById('billing-main-view');
    const denahView = document.getElementById('denah-view');
    const showDenahBtn = document.getElementById('show-denah-btn');
    const showBillingBtn = document.getElementById('show-billing-btn');
    const cashierBtn = document.getElementById('open-cashier-btn');
    const overlays = document.getElementById('denah-overlays');
    if (!billingMain || !denahView || !showDenahBtn || !showBillingBtn || !overlays) return;

    // Coordinates are percentages of denah_rental.svg's 387x300 viewBox.
    // These follow the user's physical box reference, not the reference image itself.
    const positions = {
        ps4No2: { left:'3.8%', top:'7.0%', width:'22.0%', height:'23.0%' },
        sharedPs4Ps5: { left:'32.7%', top:'7.0%', width:'21.9%', height:'23.0%' },
        ps4No1: { left:'3.8%', top:'33.6%', width:'22.0%', height:'24.6%' },
        ps4No3: { left:'33.0%', top:'33.6%', width:'21.3%', height:'24.6%' },
        ps3No1: { left:'72.1%', top:'7.0%', width:'25.6%', height:'17.2%' },
        ps3No2: { left:'72.1%', top:'29.0%', width:'25.6%', height:'17.2%' },
        ps3No3: { left:'72.1%', top:'51.0%', width:'25.6%', height:'17.2%' },
        ps3No4: { left:'72.1%', top:'73.0%', width:'25.6%', height:'16.8%' }
    };

    function getConsoles(){
        try {
            const data = JSON.parse(localStorage.getItem('consoles') || '[]');
            return Array.isArray(data) ? data : [];
        } catch (_) { return []; }
    }

    function consoleNumber(c){
        const m = String(c?.name || '').match(/(\d+)\s*$/);
        return m ? parseInt(m[1],10) : 999;
    }

    function byType(type){
        return getConsoles()
            .filter(c => String(c.type || '').toUpperCase() === type)
            .sort((a,b) => consoleNumber(a) - consoleNumber(b));
    }

    function duration(ms){
        ms = Math.max(0, ms || 0);
        const t = Math.floor(ms/1000), h = Math.floor(t/3600), m = Math.floor((t%3600)/60), s = t%60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function remaining(ms){ return ms <= 0 ? 'WAKTU HABIS' : duration(ms); }

    function mode(c){
        const s = c?.session;
        if (!s) return 'KOSONG';
        if (s.type === 'open') return 'OPEN';
        const info = String(s.billingInfo || '');
        if (info.startsWith('Member Pass:')) return 'Member Pass';
        const main = info.match(/^Main\s+(.+)$/i);
        if (main) return main[1];
        const total = info.match(/Total\s+(\d+(?:\.\d+)?)\s*Jam/i);
        if (total) return `${total[1]} Jam`;
        if (s.totalPaketMinutes){
            const mins = Number(s.totalPaketMinutes);
            return mins >= 60 ? `${mins/60} Jam` : `${mins} Menit`;
        }
        return info || 'Paket';
    }

    function data(c,type,no){
        const active = c?.status === 'in-use' && c.session;
        const paused = c?.status === 'paused' && c.session;
        const s = c?.session;
        let timer = 'KOSONG';
        if (active) {
            timer = s.type === 'open'
                ? duration(Date.now() - s.startTime - (s.totalPausedDuration || 0))
                : remaining((s.endTime || Date.now()) - Date.now());
        } else if (paused) {
            timer = s.frozenTimeDisplay || 'DIJEDA';
        }
        return {
            type:type.toLowerCase(),
            name:type === 'PS5' ? 'PS5 No.1' : `${type} No.${no}`,
            use:mode(c), active:!!active, paused:!!paused, timer
        };
    }

    function station(d, position){
        const el = document.createElement('div');
        el.className = `denah-station ${d.type} ${d.active ? 'in-use' : ''} ${d.paused ? 'paused' : ''}`;
        Object.assign(el.style, position);
        el.innerHTML = (d.active || d.paused)
            ? `<div class="station-name">${d.name}</div><div class="station-timer">${d.timer}</div><div class="station-use">Dipakai : ${d.use}</div>`
            : `<div class="station-name">${d.name}</div><div class="station-empty">KOSONG</div>`;
        return el;
    }

    function render(){
        overlays.innerHTML = '';
        const ps3 = byType('PS3');
        const ps4 = byType('PS4');
        const ps5 = byType('PS5');

        // Physical left-side slots: PS4 No.1, PS4 No.2, shared PS5 No.1 / PS4 No.3.
        if (ps4[0]) overlays.appendChild(station(data(ps4[0], 'PS4', 1), positions.ps4No1));
        if (ps4[1]) overlays.appendChild(station(data(ps4[1], 'PS4', 2), positions.ps4No2));

        // One physical slot can represent either PS5 No.1 or PS4 No.3.
        // If both sessions are somehow active simultaneously, PS5 takes visual priority
        // because it is the dedicated PS5 machine assigned to this physical location.
        const shared = ps5[0] || ps4[2];
        if (shared) {
            const isPs5 = shared === ps5[0];
            overlays.appendChild(station(
                data(shared, isPs5 ? 'PS5' : 'PS4', isPs5 ? 1 : 3),
                positions.sharedPs4Ps5
            ));
        }

        // PS3 occupies the four physical boxes on the right.
        const ps3Positions = [positions.ps3No1, positions.ps3No2, positions.ps3No3, positions.ps3No4];
        ps3.slice(0,4).forEach((c,i) => overlays.appendChild(station(data(c, 'PS3', i+1), ps3Positions[i])));
    }

    function setView(view){
        const denah = view === 'denah';
        denahView.hidden = !denah;
        billingMain.hidden = denah;
        showDenahBtn.classList.toggle('active', denah);
        showBillingBtn.classList.toggle('active', !denah);
        showDenahBtn.setAttribute('aria-selected', String(denah));
        showBillingBtn.setAttribute('aria-selected', String(!denah));
        if (cashierBtn) cashierBtn.style.display = denah ? 'none' : '';
        if (denah) render();
    }

    showDenahBtn.addEventListener('click', () => setView('denah'));
    showBillingBtn.addEventListener('click', () => setView('billing'));
    setView('billing');
    setInterval(render, 1000);
});