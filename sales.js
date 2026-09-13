document.addEventListener('DOMContentLoaded', () => {
    const fromInput = document.getElementById('sales-from');
    const toInput = document.getElementById('sales-to');
    const refreshBtn = document.getElementById('refresh-sales');
    const topList = document.getElementById('top-items-list');
    const tableBody = document.getElementById('sales-table-body');
    const ctx = document.getElementById('top-items-chart').getContext('2d');
    let chart = null;

    function loadHistory() {
        return JSON.parse(localStorage.getItem('history')) || [];
    }

    function parseDateInput(input) {
        if (!input) return null;
        const d = new Date(input);
        if (isNaN(d.getTime())) return null;
        return d; // local midnight
    }

    function aggregateOrders(history, fromDate, toDate) {
        const counts = {}; // name -> qty
        history.forEach(entry => {
            try {
                const entryDate = new Date(entry.date);
                if (fromDate && entryDate < fromDate) return;
                if (toDate && entryDate > toDate) return;
                const orders = entry.orders || [];
                orders.forEach(o => {
                    const name = o.name || o.id || 'Unknown';
                    const qty = parseInt(o.quantity || 0, 10) || 0;
                    counts[name] = (counts[name] || 0) + qty;
                });
            } catch (e) { /* ignore malformed */ }
        });
        return counts;
    }

    function renderTableAndList(counts) {
        // convert to array and sort desc
        const items = Object.keys(counts).map(name => ({ name, qty: counts[name] })).sort((a,b) => b.qty - a.qty);
        tableBody.innerHTML = '';
        topList.innerHTML = '';
        items.forEach((it, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="padding:8px;border-bottom:1px solid #eee">${it.name}</td><td style="padding:8px;border-bottom:1px solid #eee">${it.qty}</td>`;
            tableBody.appendChild(tr);
            if (idx < 10) {
                const li = document.createElement('li');
                li.style.padding = '6px 0';
                li.innerHTML = `<strong>#${idx+1}</strong> ${it.name} — <em>${it.qty} pcs</em>`;
                topList.appendChild(li);
            }
        });
        return items;
    }

    function aggregateSessions(history, fromDate, toDate) {
        // aggregate by consoleName: count of sessions and total duration in seconds
        const summary = {}; // consoleName -> { count, seconds }
        history.forEach(entry => {
            try {
                const entryDate = new Date(entry.date);
                if (fromDate && entryDate < fromDate) return;
                if (toDate && entryDate > toDate) return;
                const name = entry.consoleName || 'Unknown Console';
                // prefer durationSeconds when present; otherwise use durationMinutes * 60
                let seconds = 0;
                if (entry.durationSeconds !== undefined && entry.durationSeconds !== null) {
                    seconds = parseInt(entry.durationSeconds, 10) || 0;
                } else if (entry.durationMinutes !== undefined && entry.durationMinutes !== null) {
                    seconds = (parseInt(entry.durationMinutes, 10) || 0) * 60;
                }
                if (!summary[name]) summary[name] = { count: 0, seconds: 0 };
                summary[name].count += 1;
                summary[name].seconds += seconds;
            } catch (e) { /* ignore */ }
        });
        return summary;
    }

    function renderSessionSummary(summary) {
        const list = document.getElementById('session-summary-list');
        list.innerHTML = '';
        // transform into array with parsed type/index when possible
        const raw = Object.keys(summary).map(k => ({ name: k, ...summary[k] }));
        if (raw.length === 0) {
            list.innerHTML = '<div class="session-card other-card"><div class="session-empty">Tidak ada sesi pada rentang yang dipilih.</div></div>';
            return;
        }

        // parse console names like 'PS3 - 1' or 'PS4 - 2' into { typeNum: 3, idx: 1 }
        function parseConsoleName(n) {
            if (!n) return null;
            const m = n.match(/PS\s*([345])\s*[-:]?\s*(\d+)/i) || n.match(/(\d)[- ](\d+)/); // fallback
            if (m) {
                return { typeNum: parseInt(m[1], 10), idx: parseInt(m[2], 10) };
            }
            // try patterns like 'PS3 - 1'
            const m2 = n.match(/PS\s*([345])/i);
            return m2 ? { typeNum: parseInt(m2[1], 10), idx: 0 } : null;
        }

        // group by typeNum then sort by idx
        const grouped = { 3: [], 4: [], 5: [] };
        raw.forEach(r => {
            const p = parseConsoleName(r.name);
            if (p && [3,4,5].includes(p.typeNum)) grouped[p.typeNum].push({ ...r, typeNum: p.typeNum, idx: p.idx });
        });

        // sort each group by idx
        [3,4,5].forEach(t => grouped[t].sort((a,b) => a.idx - b.idx));

        // render groups in order 3,4,5
        [3,4,5].forEach(key => {
            const arr = grouped[key];
            if (!arr || arr.length === 0) return;
            // helper: format seconds -> H:MM:SS (no leading zero on hours)
            function formatSecondsToHMS(totalSeconds) {
                const ts = parseInt(totalSeconds || 0, 10) || 0;
                const h = Math.floor(ts / 3600);
                const m = Math.floor((ts % 3600) / 60);
                const s = ts % 60;
                return `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }

            const totalSeconds = arr.reduce((sum, e) => sum + ((e.seconds && e.seconds > 0) ? e.seconds : (e.minutes ? e.minutes * 60 : 0)), 0);
            const totalCount = arr.reduce((sum, e) => sum + (e.count || 0), 0);

            const groupDiv = document.createElement('div');
            groupDiv.className = `session-card ${key === 'other' ? 'other-card' : `ps${key}-card`}`;

            const header = document.createElement('h4');
            header.textContent = (key === 'other') ? 'Lainnya' : `PS${key}`;
            groupDiv.appendChild(header);

            const totalLine = document.createElement('div');
            totalLine.className = 'session-total';
            totalLine.textContent = `Total: ${formatSecondsToHMS(totalSeconds)} (${totalCount}x)`;
            groupDiv.appendChild(totalLine);

            arr.forEach(e => {
                const shortName = (() => {
                    if (e.typeNum && e.idx) return `${e.typeNum}-${e.idx}`;
                    const m = (e.name || '').match(/(\d+)[^\d]+(\d+)/);
                    return m ? `${m[1]}-${m[2]}` : e.name;
                })();
                const itemSeconds = (e.seconds && e.seconds > 0) ? e.seconds : (e.minutes ? e.minutes * 60 : 0);
                const hms = formatSecondsToHMS(itemSeconds);
                const itemLine = document.createElement('div');
                itemLine.className = 'session-item';
                itemLine.textContent = `${shortName}: ${hms} (${e.count}x)`;
                groupDiv.appendChild(itemLine);
            });

            list.appendChild(groupDiv);
        });
    }

    function renderChart(items) {
        const topN = items.slice(0, 8);
        const labels = topN.map(i => i.name);
        const data = topN.map(i => i.qty);
        if (chart) chart.destroy();
        chart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Terjual (pcs)', data, backgroundColor: '#3f51b5' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function refresh() {
        const history = loadHistory();
        const from = fromInput.value ? new Date(fromInput.value) : null;
        const to = toInput.value ? new Date(toInput.value) : null;
        // normalize to start/end of day
        const fromDate = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : null;
        const toDate = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23,59,59,999) : null;
        const counts = aggregateOrders(history, fromDate, toDate);
        const items = renderTableAndList(counts);
        renderChart(items);
        const sessions = aggregateSessions(history, fromDate, toDate);
        renderSessionSummary(sessions);
    }

    refreshBtn.addEventListener('click', refresh);

    // CSV export
    const exportBtn = document.getElementById('export-csv');
    function exportCSV() {
        const history = loadHistory();
        const from = parseDateInput(fromInput.value);
        const to = parseDateInput(toInput.value);
        const fromDate = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : null;
        const toDate = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23,59,59,999) : null;

        const groupedByDate = {};
        history.forEach(entry => {
            try {
                const entryDate = new Date(entry.date);
                if (fromDate && entryDate < fromDate) return;
                if (toDate && entryDate > toDate) return;
                const orders = entry.orders || [];
                if (orders.length === 0) return;
                const dateKey = entryDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                if (!groupedByDate[dateKey]) groupedByDate[dateKey] = {};
                orders.forEach(o => {
                    const name = o.name || o.id || 'Unknown';
                    const qty = parseInt(o.quantity || 0, 10) || 0;
                    groupedByDate[dateKey][name] = (groupedByDate[dateKey][name] || 0) + qty;
                });
            } catch (e) { /* ignore malformed entry */ }
        });

        const dateKeys = Object.keys(groupedByDate).sort((a, b) => {
            const parse = s => {
                const [day, month, year] = s.split('/').map(Number);
                return new Date(year, month - 1, day);
            };
            return parse(a) - parse(b);
        });

        if (dateKeys.length === 0) {
            alert('Tidak ada data penjualan untuk diexport.');
            return;
        }

        let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            .date-row td { background: transparent; color: #1f4e79; font-weight: 700; font-size: 14px; padding: 10px 0 4px; border: none; }
            .header-row th { background: #1f4e79; color: #fff; padding: 8px 10px; border: 1px solid #0c2d50; text-align: left; }
            .item-row td { background: #fff; color: #000; padding: 8px 10px; border: 1px solid #d6dde8; }
            .group-table { margin-bottom: 18px; }
        </style></head><body>`;

        dateKeys.forEach(dateKey => {
            html += `<table class="group-table">`;
            html += `<tr class="date-row"><td colspan="2">${dateKey}</td></tr>`;
            html += `<tr class="header-row"><th>Nama Item</th><th>Jumlah Terjual</th></tr>`;
            const items = Object.keys(groupedByDate[dateKey])
                .map(name => ({ name, qty: groupedByDate[dateKey][name] }))
                .sort((a, b) => b.qty - a.qty);
            items.forEach(it => {
                html += `<tr class="item-row"><td>${it.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td><td>${it.qty}</td></tr>`;
            });
            html += `</table>`;
        });

        html += `</body></html>`;

        function fmtDateForFile(d) {
            if (!d) return 'semua';
            const yy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yy}${mm}${dd}`;
        }
        const fromTag = fromInput.value ? fmtDateForFile(new Date(fromInput.value)) : 'semua';
        const toTag = toInput.value ? fmtDateForFile(new Date(toInput.value)) : 'semua';
        const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
        const filename = `laporan_penjualan_${fromTag}_${toTag}_${stamp}.xls`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    // initial
    refresh();
});
