document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('member-form');
    const memberNameInput = document.getElementById('member-name');
    const tableBody = document.getElementById('member-list-body');
    const searchInput = document.getElementById('search-member');
    const historyModal = document.getElementById('member-history-modal');
    const historyMemberName = document.getElementById('history-member-name');
    const historyListContainer = document.getElementById('member-history-list');

    const MEMBER_PASS_PRICE = 300000;

    let members = JSON.parse(localStorage.getItem('members')) || [];

    function saveMembers() {
        localStorage.setItem('members', JSON.stringify(members));
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    function renderMembers(filter = '') {
        tableBody.innerHTML = '';
        const searchTerm = filter.toLowerCase().trim();
        const filteredMembers = members.filter(member =>
            member.name.toLowerCase().includes(searchTerm)
        );

        if (filteredMembers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Member tidak ditemukan atau belum ada.</td></tr>';
            return;
        }

        filteredMembers.forEach(member => {
            const remaining = (member.totalPasses || 21) - member.timesUsed;
            const creationDate = member.creationDate
                ? new Date(member.creationDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric'})
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

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const memberName = memberNameInput.value;
        const price = MEMBER_PASS_PRICE;
        const now = new Date();

        const existingMember = members.find(m => m.name.toLowerCase() === memberName.toLowerCase());
        if (existingMember) {
            alert(`Member dengan nama "${memberName}" sudah ada. Gunakan tombol 'Perpanjang' untuk menambah sesi.`);
            return;
        }

        const newMember = {
            id: `member_${now.getTime()}`, name: memberName, timesUsed: 0,
            totalPasses: 21,
            creationDate: now.toISOString()
        };
        members.push(newMember);
        saveMembers();

        const history = JSON.parse(localStorage.getItem('history')) || [];
        const historyEntry = {
            date: now.toISOString().split('T')[0], consoleName: 'Pendaftaran Member',
            startTime: now.toLocaleTimeString('id-ID'), endTime: now.toLocaleTimeString('id-ID'),
            durationMinutes: 0, rentalCost: 0, orderCost: price, totalCost: price,
            billingInfo: `Play Pass - ${memberName}`, orders: [], notes: 'Pembelian Member Play Pass'
        };
        history.push(historyEntry);
        localStorage.setItem('history', JSON.stringify(history));

        renderMembers();
        form.reset();
        alert(`Member baru "${memberName}" berhasil ditambahkan. Transaksi ${formatCurrency(price)} dicatat.`);
    });

    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        const memberId = target.dataset.id;
        if (!memberId) return;

        if (target.classList.contains('btn-delete')) {
            if (confirm('Anda yakin ingin menghapus member ini? Menghapus member tidak akan menghapus transaksi pembeliannya dari histori.')) {
                members = members.filter(member => member.id !== memberId);
                saveMembers();
                renderMembers(searchInput.value);
            }
        }
        else if (target.classList.contains('btn-renew')) {
            const memberIndex = members.findIndex(member => member.id === memberId);

            if (memberIndex > -1) {
                const member = members[memberIndex];
                const price = MEMBER_PASS_PRICE;
                const currentTotalPasses = member.totalPasses || 21;
                const currentRemaining = currentTotalPasses - member.timesUsed;
                const newTotalPasses = currentTotalPasses + 21;
                const newRemaining = currentRemaining + 21;

                if (confirm(`Perpanjang Play Pass untuk ${member.name} seharga ${formatCurrency(price)}?\nSisa sesi saat ini: ${currentRemaining}x\nSetelah diperpanjang akan menjadi: ${newRemaining}x`)) {
                    members[memberIndex].totalPasses = newTotalPasses;
                    saveMembers();

                    const history = JSON.parse(localStorage.getItem('history')) || [];
                    const now = new Date();
                    const historyEntry = {
                        date: now.toISOString().split('T')[0], consoleName: 'Perpanjangan Member',
                        startTime: now.toLocaleTimeString('id-ID'), endTime: now.toLocaleTimeString('id-ID'),
                        durationMinutes: 0, rentalCost: 0, orderCost: price, totalCost: price,
                        billingInfo: `Perpanjangan Pass - ${member.name}`, orders: [], notes: 'Perpanjangan Member Play Pass'
                    };
                    history.push(historyEntry);
                    localStorage.setItem('history', JSON.stringify(history));

                    renderMembers(searchInput.value);
                    alert(`Play Pass untuk ${member.name} berhasil diperpanjang. Sisa sesi sekarang ${newRemaining}x. Transaksi ${formatCurrency(price)} dicatat.`);
                }
            }
        }
        else if (target.classList.contains('btn-detail')) {
            const memberName = target.dataset.name;
            showMemberHistory(memberId, memberName);
        }
    });
    
    searchInput.addEventListener('input', (e) => {
        renderMembers(e.target.value);
    });
    
    if (historyModal) {
        historyModal.querySelector('.close-btn').onclick = () => {
            historyModal.style.display = 'none';
        };
    }
    window.onclick = e => {
        if (e.target.classList.contains("modal")) {
            e.target.style.display = "none";
        }
    };

    renderMembers();
});