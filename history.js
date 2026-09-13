document.addEventListener('DOMContentLoaded', () => {
    // Definisi Elemen DOM
    const dateInput = document.getElementById('history-date');
    const historyBody = document.getElementById('history-body');
    const noHistoryMessage = document.getElementById('no-history-message');
    
    // [DIUBAH] Ambil elemen-elemen baru untuk ringkasan
    const dailyTotalMainEl = document.getElementById('daily-total-main');
    const dailyRentalTotalEl = document.getElementById('daily-rental-total');
    const dailySalesTotalEl = document.getElementById('daily-sales-total');

    // Elemen untuk fitur rekap
    const openRecapBtn = document.getElementById('open-recap-btn');
    const recapModal = document.getElementById('recap-modal');
    const generateRecapBtn = document.getElementById('generate-recap-btn');
    const recapResultsEl = document.getElementById('recap-results');
    const recapStartDateEl = document.getElementById('recap-start-date');
    const recapEndDateEl = document.getElementById('recap-end-date');
    
    // Elemen untuk Print & Export (jika ada)
    const printBtn = document.getElementById('print-btn');
    const exportBtn = document.getElementById('export-btn');

    // Fungsi format mata uang
    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }
    
    // [DIUBAH] Fungsi renderHistory sekarang menghitung dan menampilkan rincian
    function renderHistory(date) {
        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        
        const dailyTransactions = allHistory
            .map((item, index) => ({ ...item, originalIndex: index }))
            .filter(item => item.date === date);

        historyBody.innerHTML = '';
        noHistoryMessage.style.display = 'none';
        
        // Inisialisasi variabel untuk rincian
        let dailyTotal = 0;
        let dailyRentalTotal = 0;
        let dailySalesTotal = 0;
        
        if (dailyTransactions.length === 0) {
            noHistoryMessage.style.display = 'block';
        } else {
            dailyTransactions.forEach(item => {
                // Akumulasi total dan rinciannya
                dailyTotal += item.totalCost;
                dailyRentalTotal += item.rentalCost || 0;
                dailySalesTotal += item.orderCost || 0;

                // Render baris tabel
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
                    </tr>`;
                historyBody.innerHTML += row;
            });
        }

        // Tampilkan semua total di elemen masing-masing
        if(dailyTotalMainEl) {
            dailyTotalMainEl.innerHTML = `Pendapatan Hari Ini (${date}): <strong>${formatCurrency(dailyTotal)}</strong>`;
        }
        if(dailyRentalTotalEl) {
            dailyRentalTotalEl.textContent = `Total Sewa : ${formatCurrency(dailyRentalTotal)}`;
        }
        if(dailySalesTotalEl) {
            dailySalesTotalEl.textContent = `Total F&B : ${formatCurrency(dailySalesTotal)}`;
        }
    }

    // Fungsi untuk menghasilkan rekap penjualan
    function generateRecap() {
        const startDate = recapStartDateEl.value;
        const endDate = recapEndDateEl.value;
        if (!startDate || !endDate || startDate > endDate) {
            alert("Rentang tanggal tidak valid.");
            return;
        }
        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        const filteredHistory = allHistory.filter(item => item.date >= startDate && item.date <= endDate);
        if (filteredHistory.length === 0) {
            recapResultsEl.innerHTML = "<p>Tidak ada transaksi pada rentang tanggal yang dipilih.</p>";
            return;
        }
        let totalRental = 0, totalSales = 0, grandTotal = 0;
        filteredHistory.forEach(item => {
            totalRental += item.rentalCost || 0;
            totalSales += item.orderCost || 0;
            grandTotal += item.totalCost || 0;
        });
        recapResultsEl.innerHTML = `
            <div style="text-align:center; margin-bottom: 15px;"><strong>Rekap dari ${startDate} sampai ${endDate}</strong></div>
            <div style="font-size: 1.2em; line-height: 1.8;">
                <div style="display:flex; justify-content: space-between;"><span>Pemasukan dari Sewa PS:</span><strong>${formatCurrency(totalRental)}</strong></div>
                <div style="display:flex; justify-content: space-between;"><span>Pemasukan dari Penjualan (Kasir):</span><strong>${formatCurrency(totalSales)}</strong></div>
                <hr>
                <div style="display:flex; justify-content: space-between; font-size: 1.5em; color: #1a237e;"><span>TOTAL PEMASUKAN:</span><strong>${formatCurrency(grandTotal)}</strong></div>
            </div>`;
    }

    // Fungsi untuk Export ke file CSV (Excel)
    function exportToCsv() {
        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        if (allHistory.length === 0) {
            alert("Tidak ada data histori untuk diexport.");
            return;
        }
        const headers = ["Tanggal", "Nama Konsol", "Tipe Billing", "Waktu Mulai", "Waktu Selesai", "Durasi (Menit)", "Biaya Sewa", "Biaya Pesanan", "Total Biaya", "Detail Pesanan", "Catatan"];
        let csvContent = headers.join(',') + '\n';
        allHistory.forEach(item => {
            const ordersString = (item.orders || []).map(o => `${o.name} x ${o.quantity}`).join('; ');
            const row = [
                item.date, item.consoleName, item.billingInfo || '', item.startTime, item.endTime,
                item.durationMinutes, item.rentalCost, item.orderCost, item.totalCost,
                `"${ordersString}"`, `"${(item.notes || '').replace(/"/g, '""')}"`
            ];
            csvContent += row.join(',') + '\n';
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Laporan Histori GANG PS - ${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Event listener untuk menghapus riwayat
    historyBody.addEventListener('click', (e) => {
        if (e.target.matches('.btn-delete-history')) {
            const indexToDelete = parseInt(e.target.dataset.historyIndex, 10);
            if (confirm('Anda yakin ingin menghapus transaksi ini secara permanen?')) {
                let allHistory = JSON.parse(localStorage.getItem('history')) || [];
                allHistory.splice(indexToDelete, 1);
                localStorage.setItem('history', JSON.stringify(allHistory));
                renderHistory(dateInput.value);
            }
        }
    });
    
    // Event listener untuk tombol-tombol
    if(openRecapBtn) {
        openRecapBtn.addEventListener('click', () => {
            recapResultsEl.innerHTML = '';
            const today = new Date().toISOString().split('T')[0];
            recapStartDateEl.value = today;
            recapEndDateEl.value = today;
            recapModal.style.display = 'block';
        });
    }

    if(generateRecapBtn) {
        generateRecapBtn.addEventListener('click', generateRecap);
    }
    
    if(printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }

    if(exportBtn) {
        exportBtn.addEventListener('click', exportToCsv);
    }

    // Menutup modal
    if(recapModal) {
        recapModal.querySelector('.close-btn').onclick = () => {
            recapModal.style.display = 'none';
        };
    }
    window.onclick = e => {
        if (e.target.classList.contains("modal")) {
            e.target.style.display = "none";
        }
    };

    // Inisialisasi halaman
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    renderHistory(today);
    dateInput.addEventListener('change', (e) => {
        renderHistory(e.target.value);
    });
});