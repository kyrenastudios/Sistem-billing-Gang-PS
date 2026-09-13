document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('member-form');
    const memberNameInput = document.getElementById('member-name');
    const tableBody = document.getElementById('member-list-body');
    const searchInput = document.getElementById('search-member');
    const historyModal = document.getElementById('member-history-modal');
    const historyMemberName = document.getElementById('history-member-name');
    const historyListContainer = document.getElementById('member-history-list');

    const MEMBER_PASS_PRICE = 300000;
    const MEMBER_API_URL = 'api/members.php';

    let members = JSON.parse(localStorage.getItem('members')) || [];

    //======== Penyimpanan Lokal ========
    function saveMembers() {
        localStorage.setItem('members', JSON.stringify(members));
    }

    //======== API Member ========
    async function loadMembersFromDatabase() {
        try {
            const response = await fetch(MEMBER_API_URL, { cache: 'no-store' });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || result.message || `HTTP ${response.status}`);

            const databaseMembers = Array.isArray(result.data) ? result.data : [];

            // Migrasikan member lama yang masih ada di localStorage bila DB masih kosong.
            if (databaseMembers.length === 0 && members.length > 0) {
                const migrate = await fetch(MEMBER_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ members })
                });
                const migrated = await migrate.json();
                if (!migrate.ok || !migrated.success) throw new Error(migrated.error || migrated.message || `HTTP ${migrate.status}`);
                members = Array.isArray(migrated.data) ? migrated.data : members;
            } else {
                members = databaseMembers;
            }

            saveMembers();
            renderMembers(searchInput.value);
        } catch (error) {
            console.error('Member API gagal:', error);
            console.warn('Member tetap menggunakan localStorage sementara.', error);
            renderMembers(searchInput.value);
        }
    }

    async function saveMemberToDatabase(member) {
        const response = await fetch(MEMBER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(member)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.message || `HTTP ${response.status}`);
        return Array.isArray(result.data) ? result.data : [];
    }

    async function deleteMemberFromDatabase(name) {
        const response = await fetch(`${MEMBER_API_URL}?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.message || `HTTP ${response.status}`);
        return Array.isArray(result.data) ? result.data : [];
    }

    //======== Format ========
    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    //======== Tampilan ========
    function renderMembers(filter = '') {
        tableBody.innerHTML = '';
        const searchTerm = filter.toLowerCase().trim();
        const filteredMembers = members.filter(member => member.name.toLowerCase().includes(searchTerm));

        if (filteredMembers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Member tidak ditemukan atau belum ada.</td></tr>';
            return;
        }

        filteredMembers.forEach(member => {
            const remaining = (member.totalPasses || 21) - member.timesUsed;
            const creationDate = member.creationDate
                ? new Date(member.creationDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                : '-';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.name}</td>
                <td>${member.timesUsed} kali</td>
                <td><strong>${remaining} kali</strong></td>
                <td>${creationDate}</td>
                <td>
                    <button class="btn-detail" data-id="${member.id}" data-name="${member.name}" style="background-color: #0288d1;">Detail</button>
                    <button class="btn-add-time btn-renew" data-id="${member.id}">Perpanjang (+21)</button>
                    <button class="btn-stop btn-delete" data-id="${member.id}">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    //======== Histori Member ========
    function showMemberHistory(memberId, memberName) {
        historyMemberName.textContent = memberName;
        historyListContainer.innerHTML = '<p>Memuat histori...</p>';

        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        const memberUsageHistory = allHistory.filter(item =>
            item.billingInfo && item.billingInfo.includes(`Member Pass: ${memberName}`) &&
            item.consoleName !== 'Pendaftaran Member' && item.consoleName !== 'Perpanjangan Member'
        );

        if (memberUsageHistory.length === 0) {
            historyListContainer.innerHTML = '<p>Belum ada riwayat pemakaian untuk member ini.</p>';
        } else {
            let historyHTML = '<ul style="list-style-type: none; padding-left: 0;">';
            memberUsageHistory.sort((a, b) => new Date(b.date + ' ' + b.endTime) - new Date(a.date + ' ' + a.endTime));
            memberUsageHistory.forEach((item, index) => {
                const usageNumber = memberUsageHistory.length - index;
                historyHTML += `
                    <li style="border-bottom: 1px solid #eee; padding: 8px 0;">
                        <strong>Pemakaian ke-${usageNumber}:</strong> (${item.date})<br>
                        <small>Konsol: ${item.consoleName}, Durasi: ${item.durationMinutes} menit</small>
                    </li>
                `;
            });
            historyHTML += '</ul>';
            historyListContainer.innerHTML = historyHTML;
        }

        historyModal.style.display = 'block';
    }

    //======== Tambah Member ========
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberName = memberNameInput.value.trim();
        const price = MEMBER_PASS_PRICE;
        const now = new Date();

        const existingMember = members.find(m => m.name.toLowerCase() === memberName.toLowerCase());
        if (existingMember) {
            alert(`Member dengan nama "${memberName}" sudah ada. Gunakan tombol 'Perpanjang' untuk menambah sesi.`);
            return;
        }

        const newMember = {
            id: `member_${now.getTime()}`,
            name: memberName,
            timesUsed: 0,
            totalPasses: 21,
            creationDate: now.toISOString()
        };

        try {
            members = await saveMemberToDatabase(newMember);
            saveMembers();

            const history = JSON.parse(localStorage.getItem('history')) || [];
            history.push({
                date: now.toISOString().split('T')[0],
                consoleName: 'Pendaftaran Member',
                startTime: now.toLocaleTimeString('id-ID'),
                endTime: now.toLocaleTimeString('id-ID'),
                durationMinutes: 0,
                rentalCost: 0,
                orderCost: price,
                totalCost: price,
                billingInfo: `Play Pass - ${memberName}`,
                orders: [],
                notes: 'Pembelian Member Play Pass'
            });
            localStorage.setItem('history', JSON.stringify(history));

            renderMembers();
            form.reset();
            if (window.gangPsDbSync) window.gangPsDbSync.push();
            alert(`Member baru "${memberName}" berhasil ditambahkan. Transaksi ${formatCurrency(price)} dicatat.`);
        } catch (error) {
            console.error('Gagal menyimpan member:', error);
            alert(`Member gagal disimpan ke database.\n\n${error.message}`);
        }
    });

    //======== Aksi Member ========
    tableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const memberId = target.dataset.id;
        if (!memberId) return;

        if (target.classList.contains('btn-delete')) {
            const member = members.find(item => item.id === memberId);
            if (!member) return;

            const confirmed = await window.gangPsConfirm(
                'Anda yakin ingin menghapus member ini? Menghapus member tidak akan menghapus transaksi pembeliannya dari histori.'
            );
            if (confirmed) {
                try {
                    members = await deleteMemberFromDatabase(member.name);
                    saveMembers();
                    renderMembers(searchInput.value);
                } catch (error) {
                    console.error('Gagal menghapus member:', error);
                    alert(`Member gagal dihapus dari database.\n\n${error.message}`);
                }
            }
        } else if (target.classList.contains('btn-renew')) {
            const memberIndex = members.findIndex(member => member.id === memberId);
            if (memberIndex === -1) return;

            const member = members[memberIndex];
            const price = MEMBER_PASS_PRICE;
            const currentTotalPasses = member.totalPasses || 21;
            const currentRemaining = currentTotalPasses - member.timesUsed;
            const newTotalPasses = currentTotalPasses + 21;
            const newRemaining = currentRemaining + 21;

            const confirmed = await window.gangPsConfirm(
                `Perpanjang Play Pass untuk ${member.name} seharga ${formatCurrency(price)}?\nSisa sesi saat ini: ${currentRemaining}x\nSetelah diperpanjang akan menjadi: ${newRemaining}x`
            );
            if (confirmed) {
                try {
                    const updatedMember = {
                        ...member,
                        totalPasses: newTotalPasses,
                        timesUsed: member.timesUsed
                    };
                    members = await saveMemberToDatabase(updatedMember);
                    saveMembers();

                    const history = JSON.parse(localStorage.getItem('history')) || [];
                    const now = new Date();
                    history.push({
                        date: now.toISOString().split('T')[0],
                        consoleName: 'Perpanjangan Member',
                        startTime: now.toLocaleTimeString('id-ID'),
                        endTime: now.toLocaleTimeString('id-ID'),
                        durationMinutes: 0,
                        rentalCost: 0,
                        orderCost: price,
                        totalCost: price,
                        billingInfo: `Perpanjangan Pass - ${member.name}`,
                        orders: [],
                        notes: 'Perpanjangan Member Play Pass'
                    });
                    localStorage.setItem('history', JSON.stringify(history));

                    renderMembers(searchInput.value);
                    if (window.gangPsDbSync) window.gangPsDbSync.push();
                    alert(`Play Pass untuk ${member.name} berhasil diperpanjang. Sisa sesi sekarang ${newRemaining}x. Transaksi ${formatCurrency(price)} dicatat.`);
                } catch (error) {
                    console.error('Gagal memperpanjang member:', error);
                    alert(`Perpanjangan gagal disimpan ke database.\n\n${error.message}`);
                }
            }
        } else if (target.classList.contains('btn-detail')) {
            showMemberHistory(memberId, target.dataset.name);
        }
    });

    searchInput.addEventListener('input', e => renderMembers(e.target.value));

    if (historyModal) {
        historyModal.querySelector('.close-btn').onclick = () => {
            historyModal.style.display = 'none';
        };
    }

    window.onclick = e => {
        if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    };

    renderMembers();
    loadMembersFromDatabase();
});