// File: script.js (Versi Final dengan Biaya Real-time)
document.addEventListener('DOMContentLoaded', () => {
    const PRICES = { PS3: 5000, PS4: 8000, PS5: 13000 };
    const specialPromo = [
        {
            id: 'ps5_promo_3jam',
            name: 'ps 5 promo 3 jam',
            consoleType: 'PS5',
            durationMinute: 180,
            price: 30000, 
        },

    ]

    const consoleList = document.getElementById('console-list');
    const noConsolesMessage = document.getElementById('no-consoles-message');
    const modals = {
        start: document.getElementById('start-session-modal'),
        addTime: document.getElementById('add-time-modal'),
        note: document.getElementById('note-modal'),
        order: document.getElementById('order-modal'),
    };
    let consoles = [];
    let menuItems = [];

    function initialize() {
        const savedConsoles = JSON.parse(localStorage.getItem('consoles'));
        menuItems = JSON.parse(localStorage.getItem('menuItems')) || [];
        if (savedConsoles && savedConsoles.length > 0) {
            consoles = savedConsoles;
            renderConsoles();
            setInterval(updateTimers, 1000); // Update biaya setiap detik
        } else {
            consoleList.style.display = 'none';
            noConsolesMessage.style.display = 'block';
        }
    }

    // sesi console biling PS beserta Biaya
    function renderConsoles() {
        consoleList.innerHTML = '';
        if (!consoles || consoles.length === 0) {
            consoleList.style.display = 'none';
            noConsolesMessage.style.display = 'block';
            return;
        }
        consoles.forEach(console => {
            const card = document.createElement('div');
            card.className = `console-card ${console.status}`;
            card.dataset.id = console.id;
            let detailsHTML = '', actionsHTML = '';

            if (console.status === 'in-use') {
                const session = console.session;
                const timerId = `timer-${console.id}`;
                const billingTypeDisplay = session.type === 'open' ? 'OPEN' : `Paket (Total ${session.totalPaketMinutes / 60} Jam)`;
                
                // [BARU] Tambahkan elemen biaya real-time jika tipenya OPEN
                const realTimeCostHTML = session.type === 'open' 
                    ? `<p>Biaya Saat Ini: <span class="realtime-cost" id="cost-${console.id}">Rp 0</span></p>` 
                    : '';

                const notesDisplay = session.notes ? `<div class="session-details"><strong class="notes-display">Catatan:</strong> ${session.notes}</div>` : '';
                let ordersDisplay = '';
                if (session.orders && session.orders.length > 0) {
                    const orderItems = session.orders.map((o, index) =>
                        `<li class="order-item">
                            <span>${o.name} x ${o.quantity} - ${formatCurrency(o.price * o.quantity)}</span>
                            <button class="btn-delete-order" data-order-index="${index}" title="Hapus Pesanan">&times;</button>
                        </li>`
                    ).join('');
                    ordersDisplay = `<div class="session-details"><strong>Pesanan:</strong><ul>${orderItems}</ul></div>`;
                }
                detailsHTML = `<p class="status in-use">SEDANG DIGUNAKAN</p><div class="timer" id="${timerId}">00:00:00</div><p>Tipe: ${billingTypeDisplay}</p>${realTimeCostHTML}${notesDisplay}${ordersDisplay}`;
                actionsHTML = `<button class="btn-stop">Stop Sesi</button>${session.type !== 'open' ? `<button class="btn-add-time">Tambah Waktu</button>` : ''}<button class="btn-edit-note">Catatan</button><button class="btn-add-order">Tambah Pesanan</button>`;
            } else {
                detailsHTML = `<p class="status available">TERSEDIA</p>`;
                actionsHTML = `<button class="btn-start">Mulai Sesi</button>`;
            }
            card.innerHTML = `<h4>${console.name}</h4>${detailsHTML}<div class="card-actions">${actionsHTML}</div>`;
            consoleList.appendChild(card);
        });
        updateTimers(); // Panggil sekali untuk memastikan tampilan awal benar
    }

    // timers mengupdate biaya secara real-time
    function updateTimers() {
        const now = new Date().getTime();
        consoles.forEach(c => {
            if (c.status === 'in-use') {
                const timerElement = document.getElementById(`timer-${c.id}`);
                if (!timerElement) return;

                const session = c.session;
                
                // Update timer (waktu)
                if (session.type === 'open') {
                    const elapsedTime = now - session.startTime;
                    timerElement.textContent = formatDuration(elapsedTime);
                } else {
                    const remainingTime = session.endTime - now;
                    if (remainingTime <= 0) {
                        timerElement.textContent = "WAKTU HABIS!";
                        timerElement.style.color = "red";
                    } else {
                        timerElement.textContent = formatDuration(remainingTime);
                    }
                }

                // Perhitungan Biaya OPEN
                if (session.type === 'open') {
                    const costElement = document.getElementById(`cost-${c.id}`);
                    if (costElement) {
                        const elapsedTimeMs = now - session.startTime;
                        // Biaya dihitung per menit, jadi pembulatan ke atas
                        const elapsedMinutes = Math.ceil(elapsedTimeMs / (1000 * 60));
                        const currentCost = calculateCost(c.type, elapsedMinutes);
                        costElement.textContent = formatCurrency(currentCost);
                    }
                }
            }
        });
    }


    // fungsi memulai aktivitas sesi biling PS
    function stopSession(consoleId) {
        const console = findConsole(consoleId);
        if (!console || console.status !== 'in-use') return;
        const session = console.session;
        let rentalCost = 0;
        if (session.type === 'paket') {
            rentalCost = PRICES[console.type] * (session.totalPaketMinutes / 60);
        } else {
            const endTime = new Date().getTime();
            const durationMs = endTime - session.startTime;
            const durationMinutes = Math.ceil(durationMs / (1000 * 60));
            rentalCost = calculateCost(console.type, durationMinutes);
        }
        const orderCost = session.orders.reduce((sum, order) => sum + (order.price * order.quantity), 0);
        const totalCost = rentalCost + orderCost;
        const history = JSON.parse(localStorage.getItem('history')) || [];
        const today = new Date().toISOString().split('T')[0];
        const endTime = new Date().getTime();
        const durationMs = endTime - session.startTime;
        const durationMinutes = Math.ceil(durationMs / (1000 * 60));
        history.push({ date: today, consoleName: console.name, startTime: new Date(session.startTime).toLocaleTimeString('id-ID'), endTime: new Date(endTime).toLocaleTimeString('id-ID'), durationMinutes, rentalCost, orderCost, totalCost, orders: session.orders, notes: session.notes });
        localStorage.setItem('history', JSON.stringify(history));
        alert(`Sesi untuk ${console.name} selesai!\n\nBiaya Sewa: ${formatCurrency(rentalCost)}\nBiaya Pesanan: ${formatCurrency(orderCost)}\n---------------------------\nTOTAL BIAYA: ${formatCurrency(totalCost)}`);
        console.status = 'available';
        console.session = null;
        saveAndRender();
    }
    
    function calculateCost(type, durationMinutes) {
        return Math.round((PRICES[type] / 60) * durationMinutes);
    }
    
    consoleList.addEventListener('click', e => {
        const card = e.target.closest('.console-card');
        if (!card) return;
        const consoleId = card.dataset.id;
        const console = findConsole(consoleId);
        if (e.target.matches('.btn-delete-order')) {
            const orderIndex = parseInt(e.target.dataset.orderIndex, 10);
            if (confirm(`Anda yakin ingin menghapus pesanan "${console.session.orders[orderIndex].name} x ${console.session.orders[orderIndex].quantity}"?`)) {
                console.session.orders.splice(orderIndex, 1);
                saveAndRender();
            }
        } else if (e.target.matches('.btn-start')) {
            modals.start.querySelector('#modal-console-name').textContent = console.name;
            modals.start.querySelector('#modal-console-id').value = console.id;
            modals.start.style.display = 'block';
        } else if (e.target.matches('.btn-stop')) {
            stopSession(consoleId);
        } else if (e.target.matches('.btn-add-time')) {
            modals.addTime.querySelector('#add-time-console-name').textContent = console.name;
            modals.addTime.querySelector('#add-time-console-id').value = console.id;
            modals.addTime.style.display = 'block';
        } else if (e.target.matches('.btn-edit-note')) {
            modals.note.querySelector('#note-console-name').textContent = console.name;
            modals.note.querySelector('#note-console-id').value = console.id;
            modals.note.querySelector('#console-note').value = console.session.notes || '';
            modals.note.style.display = 'block';
        } else if (e.target.matches('.btn-add-order')) {
            const select = modals.order.querySelector('#menu-item-select');
            select.innerHTML = '<option value="" disabled selected>-- Pilih Item --</option>';
            if (menuItems.length > 0) {
                menuItems.forEach(item => { const o = document.createElement('option'); o.value = item.id; o.textContent = `${item.name} - ${formatCurrency(item.price)}`; select.appendChild(o); });
            } else { select.innerHTML = '<option value="">Menu kosong</option>'; }
            modals.order.querySelector('#order-console-name').textContent = console.name;
            modals.order.querySelector('#order-console-id').value = console.id;
            modals.order.querySelector('#item-quantity').value = 1;
            modals.order.style.display = 'block';
        }
    });

    modals.addTime.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target;
        const consoleId = form.querySelector('#add-time-console-id').value;
        const additionalMinutes = parseInt(form.querySelector('#additional-time').value, 10);
        const console = findConsole(consoleId);
        if (console && console.status === 'in-use' && console.session.type === 'paket') {
            const now = new Date().getTime();
            const baseTime = console.session.endTime > now ? console.session.endTime : now;
            console.session.endTime = baseTime + additionalMinutes * 60 * 1000;
            console.session.totalPaketMinutes += additionalMinutes;
            saveAndRender();
        }
        modals.addTime.style.display = 'none';
    });

    modals.start.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target;
        const consoleId = form.querySelector('#modal-console-id').value;
        const billingType = form.querySelector('#billing-type').value;
        const console = findConsole(consoleId);
        console.status = 'in-use';
        const now = new Date().getTime();
        const isPackage = billingType !== 'open';
        console.session = {
            startTime: now,
            type: isPackage ? 'paket' : 'open',
            totalPaketMinutes: isPackage ? parseInt(billingType, 10) : null,
            endTime: isPackage ? now + parseInt(billingType) * 60 * 1000 : null,
            notes: '',
            orders: []
        };
        saveAndRender();
        modals.start.style.display = 'none';
        form.reset();
    });

    modals.order.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target;
        const consoleId = form.querySelector('#order-console-id').value;
        const selectedItemId = form.querySelector('#menu-item-select').value;
        const quantity = parseInt(form.querySelector('#item-quantity').value, 10);
        const console = findConsole(consoleId);
        const selectedItem = menuItems.find(item => item.id === selectedItemId);
        if (console && console.session && selectedItem && quantity > 0) {
            const existingOrder = console.session.orders.find(order => order.id === selectedItemId);
            if (existingOrder) {
                existingOrder.quantity += quantity;
            } else {
                console.session.orders.push({ id: selectedItem.id, name: selectedItem.name, price: selectedItem.price, quantity: quantity });
            }
            saveAndRender();
        }
        modals.order.style.display = 'none';
        form.reset();
    });
    
    function saveAndRender() { localStorage.setItem('consoles', JSON.stringify(consoles)); renderConsoles(); }
    function findConsole(id) { return consoles.find(c => c.id === id); }
    function formatDuration(ms) { if (ms < 0) ms = 0; const t = Math.floor(ms / 1e3), e = Math.floor(t / 3600), o = Math.floor(t % 3600 / 60); return `${String(e).padStart(2, "0")}:${String(o).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` }
    function formatCurrency(amount) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount) }
    modals.note.querySelector("form").addEventListener("submit", e => { e.preventDefault(); const t = e.target, o = t.querySelector("#note-console-id").value, n = t.querySelector("#console-note").value, s = findConsole(o); s && s.session && (s.session.notes = n, saveAndRender()), modals.note.style.display = "none" });
    Object.values(modals).forEach(m => { m.querySelector(".close-btn").onclick = () => { m.style.display = "none" } });
    window.onclick = e => { if (e.target.classList.contains("modal")) { e.target.style.display = "none" } };

    initialize();
});