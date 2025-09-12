document.addEventListener('DOMContentLoaded', () => {
    // Definisi Elemen DOM
    const dateInput = document.getElementById('history-date');
    const historyBody = document.getElementById('history-body');
    const dailyTotalContainer = document.getElementById('daily-total-container');
    const noHistoryMessage = document.getElementById('no-history-message');
    
    // Elemen untuk fitur rekap
    const openRecapBtn = document.getElementById('open-recap-btn');
    const recapModal = document.getElementById('recap-modal');
    const generateRecapBtn = document.getElementById('generate-recap-btn');
    const recapResultsEl = document.getElementById('recap-results');
    const recapStartDateEl = document.getElementById('recap-start-date');
    const recapEndDateEl = document.getElementById('recap-end-date');
    const recapActionsEl = document.getElementById('recap-actions');
    const printPdfBtn = document.getElementById('print-recap-pdf-btn');

    // Variabel untuk menyimpan data rekap sementara
    let currentRecapData = null;

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }
    
    function renderHistory(date) {
        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        const dailyTransactions = allHistory.map((item, index) => ({ ...item, originalIndex: index })).filter(item => item.date === date);
        historyBody.innerHTML = '';
        noHistoryMessage.style.display = 'none';
        if (dailyTransactions.length === 0) {
            noHistoryMessage.style.display = 'block';
            if (dailyTotalContainer) dailyTotalContainer.innerHTML = `Pendapatan Hari Ini: Rp 0`;
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
                </tr>`;
            historyBody.innerHTML += row;
        });
        if (dailyTotalContainer) dailyTotalContainer.innerHTML = `Pendapatan Hari Ini (${date}): ${formatCurrency(dailyTotal)}`;
    }

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
            recapActionsEl.style.display = 'none';
            currentRecapData = null;
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
        
        currentRecapData = { startDate, endDate, transactions: filteredHistory };
        recapActionsEl.style.display = 'block';
    }
    
    // [BARU] Fungsi untuk membuat PDF dengan rincian lengkap
    function printRecapToPdf() {
        if (!currentRecapData) {
            alert("Tidak ada data rekap untuk dicetak.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // --- 1. Proses dan Kelompokkan Data ---
        let rentalSummary = {
            PS3: { count: 0, totalMinutes: 0, totalRevenue: 0 },
            PS4: { count: 0, totalMinutes: 0, totalRevenue: 0 },
            PS5: { count: 0, totalMinutes: 0, totalRevenue: 0 }
        };
        let salesSummary = {};
        let totalRental = 0, totalSales = 0;
        
        currentRecapData.transactions.forEach(item => {
            totalRental += item.rentalCost || 0;
            totalSales += item.orderCost || 0;
            if (item.rentalCost > 0) {
                const type = item.consoleName.includes('PS3') ? 'PS3' : item.consoleName.includes('PS4') ? 'PS4' : 'PS5';
                if (rentalSummary[type]) {
                    rentalSummary[type].count++;
                    rentalSummary[type].totalMinutes += item.durationMinutes;
                    rentalSummary[type].totalRevenue += item.rentalCost;
                }
            }
            if (item.orders && item.orders.length > 0) {
                item.orders.forEach(order => {
                    if (!salesSummary[order.name]) {
                        salesSummary[order.name] = { quantity: 0, totalRevenue: 0 };
                    }
                    salesSummary[order.name].quantity += order.quantity;
                    salesSummary[order.name].totalRevenue += (order.price * order.quantity);
                });
            }
        });

        // --- 2. Buat Dokumen PDF ---
        doc.setFontSize(18);
        doc.text("Laporan Rekap Rinci", 105, 20, { align: "center" });
        doc.setFontSize(12);
        doc.text(`Periode: ${currentRecapData.startDate} s/d ${currentRecapData.endDate}`, 105, 28, { align: "center" });

        doc.autoTable({
            startY: 40,
            head: [['Deskripsi', 'Jumlah']],
            body: [
                ["Pemasukan dari Sewa PS", formatCurrency(totalRental)],
                ["Pemasukan dari Penjualan", formatCurrency(totalSales)],
            ],
            foot: [['TOTAL KESELURUHAN', formatCurrency(totalRental + totalSales)]],
            footStyles: { fontStyle: 'bold', fontSize: 12, fillColor: [230, 230, 230] },
            theme: 'grid',
        });
        
        doc.setFontSize(14);
        doc.text("Rincian Pendapatan Sewa", 14, doc.autoTable.previous.finalY + 15);
        const rentalBody = Object.keys(rentalSummary).filter(psType => rentalSummary[psType].count > 0).map(psType => {
            const data = rentalSummary[psType];
            const totalHours = (data.totalMinutes / 60).toFixed(1).replace('.', ',');
            return [psType, `${data.count} kali`, `${totalHours} jam`, formatCurrency(data.totalRevenue)];
        });
        doc.autoTable({
            startY: doc.autoTable.previous.finalY + 20,
            head: [['Tipe PS', 'Jumlah Sewa', 'Total Durasi', 'Total Pemasukan']],
            body: rentalBody,
            theme: 'striped',
        });
        
        doc.setFontSize(14);
        doc.text("Rincian Pendapatan Penjualan", 14, doc.autoTable.previous.finalY + 15);
        const salesBody = Object.keys(salesSummary).sort().map(itemName => {
            const data = salesSummary[itemName];
            return [itemName, `${data.quantity} item`, formatCurrency(data.totalRevenue)];
        });
        doc.autoTable({
            startY: doc.autoTable.previous.finalY + 20,
            head: [['Nama Item', 'Jumlah Terjual', 'Total Pemasukan']],
            body: salesBody,
            theme: 'striped',
        });

        doc.save(`rekap-rinci-${currentRecapData.startDate}-sd-${currentRecapData.endDate}.pdf`);
    }

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
    
    if(openRecapBtn) {
        openRecapBtn.addEventListener('click', () => {
            recapResultsEl.innerHTML = '';
            recapActionsEl.style.display = 'none';
            currentRecapData = null;
            const today = new Date().toISOString().split('T')[0];
            recapStartDateEl.value = today;
            recapEndDateEl.value = today;
            recapModal.style.display = 'block';
        });
    }

    if(generateRecapBtn) generateRecapBtn.addEventListener('click', generateRecap);
    if(printPdfBtn) printPdfBtn.addEventListener('click', printRecapToPdf);
    
    if(recapModal) {
        recapModal.querySelector('.close-btn').onclick = () => {
            recapModal.style.display = 'none';
        };
    }
    window.onclick = e => { if (e.target.classList.contains("modal")) e.target.style.display = "none" };

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    renderHistory(today);
    dateInput.addEventListener('change', (e) => renderHistory(e.target.value));
});