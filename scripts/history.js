//Untuk mengatur histori Histori
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('history-date');
    const historyBody = document.getElementById('history-body');
    const totalRevenueEl = document.getElementById('total-revenue');
    const noHistoryMessage = document.getElementById('no-history-message');

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }
    
    // [DIUBAH] Fungsi renderHistory sekarang menampilkan detail paket dan tombol hapus
    function renderHistory(date) {
        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        // Kita perlu array asli untuk menghapus item, jadi kita tidak filter dulu
        const dailyTransactions = allHistory
            .map((item, index) => ({ ...item, originalIndex: index })) // Simpan index asli
            .filter(item => item.date === date);

        historyBody.innerHTML = '';
        noHistoryMessage.style.display = 'none';

        if (dailyTransactions.length === 0) {
            noHistoryMessage.style.display = 'block';
            totalRevenueEl.textContent = '';
            return;
        }

        let dailyTotal = 0;
        dailyTransactions.forEach(item => {
            dailyTotal += item.totalCost;
            
            // [BARU] Tampilkan detail paket/billing di bawah nama konsol
            const consoleAndPackage = `
                <strong>${item.consoleName}</strong><br>
                <small style="color: #555;">${item.billingInfo || ''}</small>
            `;
            
            const ordersList = item.orders && item.orders.length > 0 
                ? `<ul>${item.orders.map(o => `<li>${o.name} x ${o.quantity} (${formatCurrency(o.price * o.quantity)})</li>`).join('')}</ul>`
                : '<em>Tidak ada pesanan</em>';
            
            const notesDisplay = item.notes ? `<p><strong>Catatan:</strong> ${item.notes}</p>` : '';

            // [DIUBAH] Baris tabel sekarang mencakup kolom dan data baru
            const row = `
                <tr>
                    <td>${consoleAndPackage}</td>
                    <td>Mulai: ${item.startTime}<br>Selesai: ${item.endTime}<br>(${item.durationMinutes} menit)</td>
                    <td>
                        Sewa: ${formatCurrency(item.rentalCost)}<br>
                        Pesanan: ${formatCurrency(item.orderCost)}<br>
                        <strong>Total: ${formatCurrency(item.totalCost)}</strong>
                    </td>
                    <td>${ordersList}${notesDisplay}</td>
                    <td>
                        <button class="btn-stop btn-delete-history" data-history-index="${item.originalIndex}">Hapus</button>
                    </td>
                </tr>
            `;
            historyBody.innerHTML += row;
        });

        totalRevenueEl.textContent = `Total Pendapatan (${date}): ${formatCurrency(dailyTotal)}`;
    }

    // [BARU] Event listener untuk menangani klik pada tombol hapus
    historyBody.addEventListener('click', (e) => {
        // Cek apakah yang diklik adalah tombol hapus
        if (e.target.matches('.btn-delete-history')) {
            const indexToDelete = parseInt(e.target.dataset.historyIndex, 10);
            
            // Minta konfirmasi sebelum menghapus
            if (confirm('Anda yakin ingin menghapus transaksi ini secara permanen?')) {
                // Ambil semua data riwayat dari localStorage
                let allHistory = JSON.parse(localStorage.getItem('history')) || [];
                
                // Hapus item dari array berdasarkan index aslinya
                allHistory.splice(indexToDelete, 1);
                
                // Simpan kembali array yang sudah diperbarui ke localStorage
                localStorage.setItem('history', JSON.stringify(allHistory));
                
                // Muat ulang (render ulang) tampilan riwayat untuk tanggal yang sedang aktif
                renderHistory(dateInput.value);
            }
        }
    });

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    renderHistory(today);

    dateInput.addEventListener('change', (e) => {
        renderHistory(e.target.value);
    });
});