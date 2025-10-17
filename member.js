document.addEventListener('DOMContentLoaded', () => {
    // Definisi Elemen DOM
    const form = document.getElementById('member-form');
    const memberNameInput = document.getElementById('member-name');
    const memberPsTypeInput = document.getElementById('member-ps-type');
    const tableBody = document.getElementById('member-list-body');

    // [BARU] Definisikan harga pass di sini agar mudah diubah
    const MEMBER_PASS_PRICES = {
        PS4: 300000,
        PS5: 350000
    };

    let members = JSON.parse(localStorage.getItem('members')) || [];

    function saveMembers() {
        localStorage.setItem('members', JSON.stringify(members));
    }

    function renderMembers() {
        tableBody.innerHTML = '';
        members.forEach(member => {
            const remaining = 21 - member.timesUsed; // jumlah berapa kali member
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.name}</td>
                <td>${member.psType}</td>
                <td>${member.timesUsed} kali</td>
                <td><strong>${remaining} kali</strong></td>
                <td>
                    <button class="btn-stop btn-delete" data-id="${member.id}">Hapus</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // [DIUBAH] Fungsi submit sekarang juga mencatat transaksi ke histori
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const memberName = memberNameInput.value;
        const psType = memberPsTypeInput.value;
        const price = MEMBER_PASS_PRICES[psType];

        // --- Langkah 1: Buat dan Simpan Member ---
        const newMember = {
            id: `member_${new Date().getTime()}`,
            name: memberName,
            psType: psType,
            timesUsed: 0
        };
        members.push(newMember);
        saveMembers();
        
        // --- Langkah 2: Buat dan Simpan Transaksi ke Histori ---
        const history = JSON.parse(localStorage.getItem('history')) || [];
        const now = new Date();
        
        const historyEntry = {
            date: now.toISOString().split('T')[0],
            consoleName: 'Pendaftaran Member', // Deskripsi jelas
            startTime: now.toLocaleTimeString('id-ID'),
            endTime: now.toLocaleTimeString('id-ID'),
            durationMinutes: 0,
            rentalCost: 0, // Tidak ada biaya sewa
            orderCost: price,  // Pemasukan dari penjualan pass
            totalCost: price,
            billingInfo: `Play Pass ${psType} - ${memberName}`,
            orders: [], // Tidak ada pesanan item
            notes: 'Pembelian Member Play Pass'
        };

        history.push(historyEntry);
        localStorage.setItem('history', JSON.stringify(history));
        
        // --- Langkah 3: Perbarui Tampilan dan Reset Form ---
        renderMembers();
        form.reset();
        alert(`Member baru "${memberName}" berhasil ditambahkan dan transaksi sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(price)} telah dicatat di histori.`);
    });

    tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const memberId = e.target.dataset.id;
            if (confirm('Anda yakin ingin menghapus member ini? Menghapus member tidak akan menghapus transaksi pembeliannya dari histori.')) {
                members = members.filter(member => member.id !== memberId);
                saveMembers();
                renderMembers();
            }
        }
    });

    renderMembers();
});