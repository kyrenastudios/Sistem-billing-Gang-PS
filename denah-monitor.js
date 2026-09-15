document.addEventListener('DOMContentLoaded', () => {
    const billingMain = document.getElementById('billing-main-view');
    const denahView = document.getElementById('denah-view');
    const showDenahBtn = document.getElementById('show-denah-btn');
    const showBillingBtn = document.getElementById('show-billing-btn');
    const cashierBtn = document.getElementById('open-cashier-btn');
    const overlays = document.getElementById('denah-overlays');
    if (!billingMain || !denahView || !showDenahBtn || !showBillingBtn || !overlays) return;

    // Positions are percentages of the 387x300 SVG viewBox.
    const positions = {
        ps4: {
            1:{left:'3%',top:'34%',width:'44%',height:'29%'},
            2:{left:'3%',top:'7%',width:'44%',height:'29%'},
            3:{left:'32%',top:'7%',width:'43%',height:'29%'},
            4:{left:'32%',top:'34%',width:'43%',height:'29%'}
        },
        ps3: {
            1:{left:'71%',top:'7%',width:'26%',height:'17%'},
            2:{left:'71%',top:'29%',width:'26%',height:'17%'},
            3:{left:'71%',top:'51%',width:'26%',height:'17%'},
            4:{left:'71%',top:'73%',width:'26%',height:'17%'}
        }
    };

    function getConsoles(){
        try { const data=JSON.parse(localStorage.getItem('consoles')||'[]'); return Array.isArray(data)?data:[]; }
        catch(_){ return []; }
    }
    function consoleNumber(c){ const m=String(c?.name||'').match(/(\d+)\s*$/); return m?parseInt(m[1],10):999; }
    function byType(type){ return getConsoles().filter(c=>String(c.type||'').toUpperCase()===type).sort((a,b)=>consoleNumber(a)-consoleNumber(b)); }
    function duration(ms){
        ms=Math.max(0,ms||0); const t=Math.floor(ms/1000),h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    function remaining(ms){ return ms<=0?'WAKTU HABIS':duration(ms); }
    function mode(c){
        const s=c?.session; if(!s)return 'KOSONG'; if(s.type==='open')return 'OPEN';
        const info=String(s.billingInfo||'');
        if(info.startsWith('Member Pass:'))return 'Member Pass';
        const main=info.match(/^Main\s+(.+)$/i); if(main)return main[1];
        const total=info.match(/Total\s+(\d+(?:\.\d+)?)\s*Jam/i); if(total)return `${total[1]} Jam`;
        if(s.totalPaketMinutes){const mins=Number(s.totalPaketMinutes);return mins>=60?`${mins/60} Jam`:`${mins} Menit`;}
        return info||'Paket';
    }
    function data(c,type,no){
        const active=c?.status==='in-use'&&c.session, paused=c?.status==='paused'&&c.session, s=c?.session;
        let timer='KOSONG';
        if(active)timer=s.type==='open'?duration(Date.now()-s.startTime-(s.totalPausedDuration||0)):remaining((s.endTime||Date.now())-Date.now());
        else if(paused)timer=s.frozenTimeDisplay||'DIJEDA';
        return {type:type.toLowerCase(),name:type==='PS5'?'PS5':`${type} No.${no}`,use:mode(c),active:!!active,paused:!!paused,timer};
    }
    function station(d,pos){
        const el=document.createElement('div');
        el.className=`denah-station ${d.type} ${d.active?'in-use':''} ${d.paused?'paused':''}`;
        Object.assign(el.style,positions[d.type][pos]||{});
        el.innerHTML=(d.active||d.paused)
            ? `<div class="station-name">${d.name}</div><div class="station-timer">${d.timer}</div><div class="station-use">Dipakai : ${d.use}</div>`
            : `<div class="station-name">${d.name}</div><div class="station-empty">KOSONG</div>`;
        return el;
    }
    function stationPS5(d){
        const el=station(d,3);
        el.style.left='32%';el.style.top='7%';el.style.width='43%';el.style.height='29%';
        return el;
    }
    function render(){
        overlays.innerHTML='';
        const ps3=byType('PS3'),ps4=byType('PS4'),ps5=byType('PS5');
        // Left side: PS4 uses physical NO.1, NO.2 and NO.4. NO.3 is reserved for PS5.
        [1,2,4].forEach((physicalNo,i)=>{if(ps4[i])overlays.appendChild(station(data(ps4[i],'PS4',i+1),physicalNo));});
        if(ps5[0])overlays.appendChild(stationPS5(data(ps5[0],'PS5',3)));
        // Right side: PS3 NO.1 through NO.4.
        ps3.slice(0,4).forEach((c,i)=>overlays.appendChild(station(data(c,'PS3',i+1),i+1)));
    }
    function setView(view){
        const denah=view==='denah';denahView.hidden=!denah;billingMain.hidden=denah;
        showDenahBtn.classList.toggle('active',denah);showBillingBtn.classList.toggle('active',!denah);
        showDenahBtn.setAttribute('aria-selected',String(denah));showBillingBtn.setAttribute('aria-selected',String(!denah));
        if(cashierBtn)cashierBtn.style.display=denah?'none':'';
        if(denah)render();
    }
    showDenahBtn.addEventListener('click',()=>setView('denah'));
    showBillingBtn.addEventListener('click',()=>setView('billing'));
    setView('billing');
    setInterval(render,1000);
});