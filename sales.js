document.addEventListener('DOMContentLoaded', () => {
    const fromInput = document.getElementById('sales-from');
    const toInput = document.getElementById('sales-to');
    const refreshBtn = document.getElementById('refresh-sales');
    const topList = document.getElementById('top-items-list');
    const tableBody = document.getElementById('sales-table-body');
    const charts = {};

    function loadHistory() { return JSON.parse(localStorage.getItem('history')) || []; }
    function formatCurrency(amount) { return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(Number(amount)||0); }
    function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function parseDateInput(value) { if (!value) return null; const d=new Date(value); return isNaN(d.getTime())?null:d; }
    function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    function prettyDate(key) { const [y,m,d]=key.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('id-ID',{day:'2-digit',month:'short'}); }
    function parseConsoleType(name) { const m=String(name||'').match(/PS\s*([345])/i); return m ? `PS${m[1]}` : 'Lainnya'; }

    function filterHistory() {
        const history=loadHistory();
        const from=fromInput.value, to=toInput.value;
        return history.filter(item => (!from || item.date >= from) && (!to || item.date <= to));
    }

    function aggregateOrders(history) {
        const counts={};
        history.forEach(entry => (entry.orders||[]).forEach(o => { const name=o.name||o.id||'Unknown'; const qty=parseInt(o.quantity||0,10)||0; counts[name]=(counts[name]||0)+qty; }));
        return Object.keys(counts).map(name=>({name,qty:counts[name]})).sort((a,b)=>b.qty-a.qty);
    }

    function renderTableAndList(items) {
        tableBody.innerHTML=''; topList.innerHTML='';
        items.forEach((it,idx)=>{
            const tr=document.createElement('tr'); tr.innerHTML=`<td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(it.name)}</td><td style="padding:8px;border-bottom:1px solid #eee">${it.qty}</td>`; tableBody.appendChild(tr);
            if(idx<10){ const li=document.createElement('li'); li.style.padding='6px 0'; li.innerHTML=`<strong>#${idx+1}</strong> ${escapeHtml(it.name)} — <em>${it.qty} pcs</em>`; topList.appendChild(li); }
        });
    }

    function aggregateSessions(history) {
        const summary={}; history.forEach(entry=>{ const name=entry.consoleName||'Unknown Console'; let seconds=Number(entry.durationSeconds)||((Number(entry.durationMinutes)||0)*60); if(!summary[name]) summary[name]={count:0,seconds:0}; summary[name].count++; summary[name].seconds+=seconds; }); return summary;
    }

    function formatHMS(totalSeconds){ const ts=Math.max(0,parseInt(totalSeconds||0,10)||0),h=Math.floor(ts/3600),m=Math.floor((ts%3600)/60),s=ts%60; return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
    function renderSessionSummary(summary) {
        const list=document.getElementById('session-summary-list'); list.innerHTML='';
        const raw=Object.keys(summary).map(k=>({name:k,...summary[k]}));
        const grouped={3:[],4:[],5:[]};
        raw.forEach(r=>{ const m=String(r.name).match(/PS\s*([345])\s*[-:]?\s*(\d+)/i); if(m) grouped[Number(m[1])].push({...r,idx:Number(m[2])}); });
        [3,4,5].forEach(t=>grouped[t].sort((a,b)=>a.idx-b.idx));
        [3,4,5].forEach(t=>{ const arr=grouped[t]; if(!arr.length)return; const total=arr.reduce((s,e)=>s+e.seconds,0), count=arr.reduce((s,e)=>s+e.count,0); const div=document.createElement('div'); div.className=`session-card ps${t}-card`; div.innerHTML=`<h4>PS${t}</h4><div class="session-total">Total: ${formatHMS(total)} (${count}x)</div>`; arr.forEach(e=>{const d=document.createElement('div');d.className='session-item';d.textContent=`PS${t}-${e.idx}: ${formatHMS(e.seconds)} (${e.count}x)`;div.appendChild(d);}); list.appendChild(div); });
        if(!list.children.length) list.innerHTML='<div class="session-card"><div class="session-empty">Tidak ada sesi pada rentang yang dipilih.</div></div>';
    }

    function destroyChart(key){ if(charts[key]){charts[key].destroy();charts[key]=null;} }
    function makeChart(key, canvasId, type, labels, datasets, options={}) { destroyChart(key); const canvas=document.getElementById(canvasId); if(!canvas)return; charts[key]=new Chart(canvas.getContext('2d'),{type,data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:datasets.length>1,position:'bottom'}},scales:type==='pie'?{}:{x:{ticks:{maxRotation:45,autoSkip:true,maxTicksLimit:8}},y:{beginAtZero:true}},...options}}); }

    function renderCharts(history) {
        const items=aggregateOrders(history).slice(0,6);
        makeChart('food','top-items-chart','bar',items.map(i=>i.name),[{label:'Terjual',data:items.map(i=>i.qty)}]);

        const daily={}; history.forEach(e=>{const k=e.date;if(k)daily[k]=(daily[k]||0)+1;});
        const days=Object.keys(daily).sort();
        makeChart('visitors','visitor-chart','line',days.map(prettyDate),[{label:'Pengunjung',data:days.map(d=>daily[d]),tension:.3,fill:false}],{plugins:{legend:{display:false}}});

        const psDaily={PS3:{},PS4:{},PS5:{}};
        history.forEach(e=>{const type=parseConsoleType(e.consoleName);if(psDaily[type])psDaily[type][e.date]=(psDaily[type][e.date]||0)+1;});
        makeChart('ps','ps-chart','line',days.map(prettyDate),['PS3','PS4','PS5'].map(type=>({label:type,data:days.map(d=>psDaily[type][d]||0),tension:.3,fill:false})),{});
    }

    function renderMetrics(history) {
        const omzet=history.reduce((sum,item)=>sum+(Number(item.totalCost)||0),0);
        const fixedCost=700000*4;
        const visitors=history.length;
        document.getElementById('monthly-omzet').textContent=formatCurrency(omzet);
        document.getElementById('monthly-net').textContent=formatCurrency(omzet-fixedCost);
        document.getElementById('monthly-visitors').textContent=new Intl.NumberFormat('id-ID').format(visitors);
        const from=fromInput.value,to=toInput.value;
        document.getElementById('omzet-period').textContent=from&&to?`Periode ${from} s/d ${to}`:'Periode laporan';
    }

    function refresh(){ const history=filterHistory(); const items=aggregateOrders(history); renderTableAndList(items); renderCharts(history); renderMetrics(history); renderSessionSummary(aggregateSessions(history)); }

    function setCurrentMonth(){ const now=new Date(); fromInput.value=dateKey(new Date(now.getFullYear(),now.getMonth(),1)); toInput.value=dateKey(new Date(now.getFullYear(),now.getMonth()+1,0)); }
    refreshBtn.addEventListener('click',refresh);

    const exportBtn=document.getElementById('export-csv');
    if(exportBtn) exportBtn.addEventListener('click',()=>{
        const history=filterHistory(); if(!history.length){alert('Tidak ada data penjualan untuk diexport.');return;}
        const rows=['Tanggal,Nama Konsol,Tipe Billing,Waktu Mulai,Waktu Selesai,Durasi (Menit),Biaya Sewa,Biaya Pesanan,Total Biaya,Detail Pesanan,Catatan'];
        history.forEach(item=>{const orders=(item.orders||[]).map(o=>`${o.name} x ${o.quantity}`).join('; '); const q=v=>`"${String(v??'').replace(/"/g,'""')}"`; rows.push([q(item.date),q(item.consoleName),q(item.billingInfo||''),q(item.startTime),q(item.endTime),q(item.durationMinutes),q(item.rentalCost),q(item.orderCost),q(item.totalCost),q(orders),q(item.notes||'')].join(','));});
        const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Laporan Histori GANG PS - ${new Date().toISOString().split('T')[0]}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    });

    setCurrentMonth();
    refresh();
});
