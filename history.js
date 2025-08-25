//Untuk mengatur histori transaksi
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('history-date');
    const historyBody = document.getElementById('history-body');
    const totalRevenueEl = document.getElementById('total-revenue');
    const noHistoryMessage = document.getElementById('no-history-message');

    function formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }
    
    // RIWAYAT DENGAN JUMLAH PESANAN
    function renderHistory(date) {
        const allHistory = JSON.parse(localStorage.getItem('history')) || [];
        const filteredHistory = allHistory.filter(item => item.date === date);

        historyBody.innerHTML = '';
        noHistoryMessage.style.display = 'none';

        if (filteredHistory.length === 0) {
            noHistoryMessage.style.display = 'block';
            totalRevenueEl.textContent = '';
            return;
        }

        let dailyTotal = 0;
        filteredHistory.forEach(item => {
            dailyTotal += item.totalCost;
            
            // Tampilkan jumlah pesanan dengan tambahan sub total biaya sewa
            const ordersList = item.orders && item.orders.length > 0 
                ? `<ul>${item.orders.map(o => `<li>${o.name} x ${o.quantity} (${formatCurrency(o.price * o.quantity)})</li>`).join('')}</ul>`
                : '<em>Tidak ada pesanan</em>';
            
            const notesDisplay = item.notes ? `<p><strong>Catatan:</strong> ${item.notes}</p>` : '';

            const row = `
                <tr>
                    <td>${item.consoleName}</td>
                    <td>Mulai: ${item.startTime}<br>Selesai: ${item.endTime}<br>(${item.durationMinutes} menit)</td>
                    <td>
                        Sewa: ${formatCurrency(item.rentalCost)}<br>
                        Pesanan: ${formatCurrency(item.orderCost)}<br>
                        <strong>Total: ${formatCurrency(item.totalCost)}</strong>
                    </td>
                    <td>${ordersList}${notesDisplay}</td>
                </tr>
            `;
            historyBody.innerHTML += row;
        });

        totalRevenueEl.textContent = `Total Pendapatan (${date}): ${formatCurrency(dailyTotal)}`;
    }

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    renderHistory(today);

    dateInput.addEventListener('change', (e) => {
        renderHistory(e.target.value);
    });
});