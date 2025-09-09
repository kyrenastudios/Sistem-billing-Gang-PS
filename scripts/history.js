document.addEventListener('DOMContentLoaded', () => {
    // Definisi Elemen DOM
    const dateInput = document.getElementById('history-date');
    const historyBody = document.getElementById('history-body');
    const totalRevenueDailyEl = document.getElementById('total-revenue-daily');
    const totalRevenueAllTimeEl = document.getElementById('total-revenue-all-time');
    const noHistoryMessage = document.getElementById('no-history-message');

    // Fungsi format mata uang
    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }
    
    // Fungsi untuk merender tampilan riwayat
    function renderHistory(date) {
        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        
        // --- 1. Hitung dan Tampilkan Total Pendapatan Keseluruhan ---
        const allTimeTotal = allHistory.reduce((sum, item) => sum + item.totalCost, 0);
        totalRevenueAllTimeEl.textContent = `Total Pendapatan Keseluruhan: ${formatCurrency(allTimeTotal)}`;

        // --- 2. Filter dan Tampilkan Riwayat Harian ---
        const dailyTransactions = allHistory
            .map((item, index) => ({ ...item, originalIndex: index }))
            .filter(item => item.date === date);

        historyBody.innerHTML = '';
        noHistoryMessage.style.display = 'none';
        
        if (dailyTransactions.length === 0) {
            noHistoryMessage.style.display = 'block';
            totalRevenueDailyEl.textContent = `Pendapatan Hari Ini: Rp 0`; // Tetap tampilkan nol
            return;
        }

        let dailyTotal = 0;
        dailyTransactions.forEach(item => {
            dailyTotal += item.totalCost;
            
            const consoleAndPackage = `<strong>${item.consoleName}</strong><br><small style="color: #555;">${item.billingInfo || ''}</small>`;
            const ordersList = item.orders && item.orders.length > 0 ? `<ul>${item.orders.map(o => `<li>${o.name} x ${o.quantity} (${formatCurrency(o.price * o.quantity)})</li>`).join('')}</ul>` : '<em>Tidak ada pesanan</em>';
            const notesDisplay = item.notes ? `<p><strong>Catatan:</strong> ${item.notes}</p>` : '';

            const row = `
                <tr>
                    <td>${consoleAndPackage}</td>
                    <td>Mulai: ${item.startTime}<br>Selesai: ${item.endTime}<br>(${item.durationMinutes} menit)</td>
                    <td>Sewa: ${formatCurrency(item.rentalCost)}<br>Pesanan: ${formatCurrency(item.orderCost)}<br><strong>Total: ${formatCurrency(item.totalCost)}</strong></td>
                    <td>${ordersList}${notesDisplay}</td>
                    <td><button class="btn-stop btn-delete-history" data-history-index="${item.originalIndex}">Hapus</button></td>
                </tr>
            `;
            historyBody.innerHTML += row;
        });

        totalRevenueDailyEl.textContent = `Pendapatan Hari Ini (${date}): ${formatCurrency(dailyTotal)}`;
    }

    // Event listener untuk menghapus riwayat
    historyBody.addEventListener('click', (e) => {
        if (e.target.matches('.btn-delete-history')) {
            const indexToDelete = parseInt(e.target.dataset.historyIndex, 10);
            if (confirm('Anda yakin ingin menghapus transaksi ini secara permanen?')) {
                let allHistory = JSON.parse(localStorage.getItem('history')) || [];
                allHistory.splice(indexToDelete, 1);
                localStorage.setItem('history', JSON.stringify(allHistory));
                renderHistory(dateInput.value); // Render ulang setelah hapus
            }
        }
    });

    // Inisialisasi halaman
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    renderHistory(today); // Panggil renderHistory untuk pertama kali

    // Tambahkan event listener untuk perubahan tanggal
    dateInput.addEventListener('change', (e) => {
        renderHistory(e.target.value);
    });
});