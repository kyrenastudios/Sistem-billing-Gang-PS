document.addEventListener('DOMContentLoaded', () => {
    const consoleList = document.getElementById('console-list');
    if (!consoleList) return;

    const style = document.createElement('style');
    style.textContent = `
        #console-list.billing-grouped { display:block !important; }
        .billing-console-group { margin:0 0 30px; }
        .billing-console-group:last-child { margin-bottom:0; }
        .billing-group-header { display:flex; align-items:baseline; justify-content:space-between; gap:15px; margin:0 0 14px; padding:0 4px; border-bottom:1px solid #e5e7eb; }
        .billing-group-title { margin:0 0 8px; text-align:left; color:#24273a; font-size:1.35rem; font-weight:600; }
        .billing-group-count { color:#777b88; font-size:.85rem; margin-bottom:8px; }
        .billing-group-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
        .billing-group-grid .console-card { min-width:0; margin:0; box-sizing:border-box; height:250px; padding:12px; display:flex; flex-direction:column; overflow:hidden; }
        .billing-group-grid .console-card h4 { flex:0 0 auto; margin:0 0 8px; }
        .billing-group-grid .console-card .status { margin:4px 0 8px; }
        .billing-group-grid .console-card .timer { margin:4px 0 6px; font-size:1.35em; line-height:1.2; }
        .billing-group-grid .console-card > p { margin:5px 0; line-height:1.25; }
        .billing-group-grid .console-card .session-details { margin:4px 0; font-size:.85rem; line-height:1.25; }
        .billing-group-grid .console-card .card-actions { margin-top:auto; padding-top:6px; display:flex; flex-wrap:wrap; justify-content:center; gap:4px; }
        .billing-group-grid .console-card .card-actions button { margin:0; padding:7px 9px; font-size:.82rem; min-height:36px; touch-action:manipulation; }
        @media (max-width:1000px) { .billing-group-grid { grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; } }
        @media (max-width:760px) {
            .billing-console-group { margin-bottom:22px; }
            .billing-group-header { align-items:center; margin-bottom:10px; }
            .billing-group-title { font-size:1.15rem; margin-bottom:7px; }
            .billing-group-count { font-size:.78rem; margin-bottom:7px; }
            .billing-group-grid { grid-template-columns:1fr; gap:10px; }
            .billing-group-grid .console-card { height:235px; padding:10px; border-radius:10px; }
            .billing-group-grid .console-card h4 { font-size:1.2rem !important; margin-bottom:5px; }
            .billing-group-grid .console-card .status { font-size:1rem; }
            .billing-group-grid .console-card .timer { font-size:1.3rem; }
            .billing-group-grid .console-card .card-actions { gap:5px; }
            .billing-group-grid .console-card .card-actions button { flex:0 1 auto; padding:8px 10px; font-size:.82rem; min-height:38px; }
        }
        @media (max-width:390px) {
            .billing-group-grid .console-card { height:232px; }
            .billing-group-grid .console-card .card-actions button { padding:7px 8px; font-size:.78rem; }
        }
    `;
    document.head.appendChild(style);

    let rebuilding = false;
    function groupConsoles() {
        if (rebuilding) return;
        const cards = Array.from(consoleList.querySelectorAll(':scope > .console-card'));
        if (!cards.length) return;
        const groups = [
            { type:'PS3', title:'PlayStation 3' },
            { type:'PS4', title:'PlayStation 4' },
            { type:'PS5', title:'PlayStation 5' }
        ];
        const grouped = groups.map(group => ({ ...group, cards:cards.filter(card => card.classList.contains(group.type.toLowerCase())) })).filter(group => group.cards.length > 0);
        rebuilding = true;
        consoleList.classList.add('billing-grouped');
        consoleList.innerHTML = '';
        grouped.forEach(group => {
            const section = document.createElement('section');
            section.className = 'billing-console-group';
            section.dataset.consoleType = group.type;
            const header = document.createElement('div');
            header.className = 'billing-group-header';
            header.innerHTML = `<h2 class="billing-group-title">${group.title}</h2><span class="billing-group-count">${group.cards.length} unit</span>`;
            const grid = document.createElement('div');
            grid.className = 'billing-group-grid';
            group.cards.forEach(card => grid.appendChild(card));
            section.appendChild(header);
            section.appendChild(grid);
            consoleList.appendChild(section);
        });
        rebuilding = false;
    }
    const observer = new MutationObserver(() => { if (!rebuilding) groupConsoles(); });
    observer.observe(consoleList, { childList:true });
    groupConsoles();
});
