document.addEventListener('DOMContentLoaded', () => {
    // Definisi Elemen DOM
    const form = document.getElementById('member-form');
    const memberNameInput = document.getElementById('member-name');
    const memberPsTypeInput = document.getElementById('member-ps-type');
    const tableBody = document.getElementById('member-list-body');
    const searchInput = document.getElementById('search-member');
    // Elemen untuk modal histori
    const historyModal = document.getElementById('member-history-modal');
    const historyMemberName = document.getElementById('history-member-name');
    const historyListContainer = document.getElementById('member-history-list');

    // Pastikan semua elemen penting ditemukan
    if (!form || !tableBody || !searchInput || !historyModal) {
        console.error("Elemen penting di halaman 'Kelola Member' tidak ditemukan. Periksa ID di file members.html.");
        // Beri tahu pengguna jika ada masalah
        const container = document.querySelector('.container');
        if (container) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = "Terjadi kesalahan saat memuat halaman. Beberapa elemen tidak ditemukan.";
            errorMsg.style.color = "red";
            errorMsg.style.textAlign = "center";
            container.prepend(errorMsg);
        }
        return; // Hentikan eksekusi jika elemen penting hilang
    }


    // Harga pass
    const MEMBER_PASS_PRICES = { PS4: 300000, PS5: 300000 };

    let members = JSON.parse(localStorage.getItem('members')) || [];

    function saveMembers() {
        localStorage.setItem('members', JSON.stringify(members));
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    // Fungsi render member dengan filter nama
    function renderMembers(filter = '') {
        tableBody.innerHTML = '';
        const searchTerm = filter.toLowerCase().trim();
        const filteredMembers = members.filter(member =>
            member.name.toLowerCase().includes(searchTerm)
        );

        if (filteredMembers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Member tidak ditemukan atau belum ada.</td></tr>';
            return;
        }

        filteredMembers.forEach(member => {
            const remaining = 21 - member.timesUsed;
            const creationDate = member.creationDate
                ? new Date(member.creationDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric'})
                : '-';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.name}</td>
                <td>${member.psType}</td>
                <td>${member.timesUsed} kali</td>
                <td><strong>${remaining} kali</strong></td>
                <td>${creationDate}</td>
                <td style="display: flex; flex-direction: column;">
                    <button class="btn-detail" style="margin-bottom: 10px" data-id="${member.id}" data-name="${member.name}" style="background-color: #0288d1;">Detail</button>

                    <button class="btn-stop btn-delete" data-id="${member.id}">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Fungsi untuk menampilkan histori pemakaian member
    function showMemberHistory(memberId, memberName) {
        historyMemberName.textContent = memberName;
        historyListContainer.innerHTML = '<p>Memuat histori...</p>';

        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        const memberUsageHistory = allHistory.filter(item =>
            item.billingInfo && item.billingInfo.includes(`Member Pass: ${memberName}`) && item.consoleName !== 'Pendaftaran Member' && item.consoleName !== 'Perpanjangan Member'
        );

        if (memberUsageHistory.length === 0) {
            historyListContainer.innerHTML = '<p>Belum ada riwayat pemakaian untuk member ini.</p>';
        } else {
            let historyHTML = '<ul style="list-style-type: none; padding-left: 0;">';
            memberUsageHistory.forEach((item, index) => {
                const usageNumber = index + 1;
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

    // Event listener untuk form tambah member
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const memberName = memberNameInput.value;
        const psType = memberPsTypeInput.value;
        const price = MEMBER_PASS_PRICES[psType];
        const now = new Date();

        const existingMember = members.find(m => m.name.toLowerCase() === memberName.toLowerCase() && m.psType === psType);
        if (existingMember) {
            alert(`Member dengan nama "${memberName}" untuk ${psType} sudah ada. Jika ingin memperpanjang, gunakan tombol 'Perpanjang'.`);
            return;
        }

        const newMember = {
            id: `member_${now.getTime()}`, name: memberName, psType: psType, timesUsed: 0,
            creationDate: now.toISOString()
        };
        members.push(newMember);
        saveMembers();

        const history = JSON.parse(localStorage.getItem('history')) || [];
        const historyEntry = {
            date: now.toISOString().split('T')[0], consoleName: 'Pendaftaran Member',
            startTime: now.toLocaleTimeString('id-ID'), endTime: now.toLocaleTimeString('id-ID'),
            durationMinutes: 0, rentalCost: 0, orderCost: price, totalCost: price,
            billingInfo: `Play Pass ${psType} - ${memberName}`, orders: [], notes: 'Pembelian Member Play Pass'
        };
        history.push(historyEntry);
        localStorage.setItem('history', JSON.stringify(history));

        renderMembers();
        form.reset();
        alert(`Member baru "${memberName}" (${psType}) berhasil ditambahkan. Transaksi ${formatCurrency(price)} dicatat.`);
    });

    // Event listener untuk tombol-tombol di tabel
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
            const psType = target.dataset.type;
            const memberIndex = members.findIndex(member => member.id === memberId);

            if (memberIndex > -1) {
                const member = members[memberIndex];
                const price = MEMBER_PASS_PRICES[psType];

                if (confirm(`Perpanjang Play Pass untuk ${member.name} (${psType}) seharga ${formatCurrency(price)}? Sisa sesi akan direset menjadi 21.`)) {
                    members[memberIndex].timesUsed = 0;
                    members[memberIndex].creationDate = new Date().toISOString();
                    saveMembers();

                    const history = JSON.parse(localStorage.getItem('history')) || [];
                    const now = new Date();
                    const historyEntry = {
                        date: now.toISOString().split('T')[0], consoleName: 'Perpanjangan Member',
                        startTime: now.toLocaleTimeString('id-ID'), endTime: now.toLocaleTimeString('id-ID'),
                        durationMinutes: 0, rentalCost: 0, orderCost: price, totalCost: price,
                        billingInfo: `Perpanjangan Pass ${psType} - ${member.name}`, orders: [], notes: 'Perpanjangan Member Play Pass'
                    };
                    history.push(historyEntry);
                    localStorage.setItem('history', JSON.stringify(history));

                    renderMembers(searchInput.value);
                    alert(`Play Pass untuk ${member.name} berhasil diperpanjang. Transaksi ${formatCurrency(price)} dicatat.`);
                }
            }
        }
        else if (target.classList.contains('btn-detail')) {
            const memberName = target.dataset.name;
            showMemberHistory(memberId, memberName);
        }
    });
    
    // Event listener untuk input pencarian
    searchInput.addEventListener('input', (e) => {
        renderMembers(e.target.value);
    });
    
    // Menutup modal histori
    if (historyModal) {
        historyModal.querySelector('.close-btn').onclick = () => {
            historyModal.style.display = 'none';
        };
    }
    // Menutup modal lain jika diklik di luar area
    window.onclick = e => {
        if (e.target.classList.contains("modal")) {
            e.target.style.display = "none";
        }
    };

    // Render tabel awal saat halaman dimuat
    renderMembers();
});