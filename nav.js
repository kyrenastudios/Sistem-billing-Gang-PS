//======== Authentication Guard ========
(() => {
    const loginPage = 'login.html';
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === loginPage) return;

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', './api/auth.php?action=me', false);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send();
        const result = JSON.parse(xhr.responseText || '{}');
        if (!result.authenticated || !result.user) {
            window.location.replace(`./${loginPage}`);
            return;
        }
        window.gangPsUser = result.user;
    } catch (error) {
        console.error('Auth: gagal memeriksa login.', error);
        window.location.replace(`./${loginPage}`);
    }
})();

//======== Shared Navigation ========
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('nav');
    if (!nav) return;

    const user = window.gangPsUser || null;
    const items = [
        { href:'./index.html', label:'Billing', icon:'▣', match:'index.html' },
        { href:'./history.html', label:'Riwayat Penjualan', icon:'▤', match:'history.html' },
        { href:'./menu.html', label:'Menu Pesanan', icon:'☷', match:'menu.html' },
        { href:'./members.html', label:'Kartu Play Pass', icon:'▭', match:'members.html' },
        { href:'./paket.html', label:'Kelola Paket', icon:'◇', match:'paket.html' },
        { href:'./manage.html', label:'Kelola PS', icon:'▤', match:'manage.html' }
    ];
    if (user && user.role === 'admin') {
        items.push({ href:'./sales.html', label:'Laporan Penjualan', icon:'▥', match:'sales.html' });
        items.push({ href:'./users.html', label:'Pengguna', icon:'♙', match:'users.html' });
    }

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    nav.innerHTML = `<button type="button" id="gang-ps-sidebar-toggle" aria-label="Minimize navigasi" title="Minimize navigasi"><span class="gang-ps-toggle-icon">‹</span><span class="gang-ps-toggle-text">Minimize</span></button>`
        + items.map(item => {
            const active = currentPage === item.match;
            return `<a href="${item.href}"${active ? ' class="active"' : ''}><span class="gang-ps-nav-icon">${item.icon}</span><span class="gang-ps-nav-label">${item.label}</span></a>`;
        }).join('') + `<div class="gang-ps-user-box"><span>${user ? user.username : ''} · ${user && user.role === 'admin' ? 'Admin' : 'Kasir'}</span><button type="button" id="gang-ps-logout">Keluar</button></div>`;

    const logoutBtn = document.getElementById('gang-ps-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        try {
            await fetch('./api/auth.php?action=logout', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
        } finally {
            window.location.replace('./login.html');
        }
    });

    //======== Sidebar Layout ========
    if (!document.getElementById('gang-ps-sidebar-style')) {
        const style = document.createElement('style');
        style.id = 'gang-ps-sidebar-style';
        style.textContent = `
            :root { --gang-sidebar-width:200px; --gang-sidebar-mini-width:68px; }
            body { padding:20px; padding-bottom:90px; }
            nav { position:fixed !important; left:8px !important; top:14px !important; bottom:14px !important; width:var(--gang-sidebar-width) !important; height:auto !important; box-sizing:border-box !important; z-index:900 !important; margin:0 !important; padding:24px 14px !important; background:#fff !important; border:1px solid #e7e9ee !important; border-radius:16px !important; box-shadow:0 4px 18px rgba(25,24,59,.08) !important; text-align:left !important; display:flex !important; flex-direction:column !important; gap:4px !important; transition:width .2s ease,padding .2s ease !important; }
            nav::before { content:'GANG PS'; display:block; padding:8px 14px 26px; color:#19183B; font-size:28px; font-weight:600; letter-spacing:.5px; transition:opacity .15s ease !important; }
            #gang-ps-sidebar-toggle { width:100%; margin:0 0 8px; padding:9px 12px; display:flex; align-items:center; gap:10px; border:1px solid #e7e9ee; border-radius:10px; background:#f7f8fb; color:#4b4d5f; cursor:pointer; font:600 .82rem/1.2 inherit; }
            #gang-ps-sidebar-toggle:hover { background:#eef0f8; }
            .gang-ps-toggle-icon { font-size:20px; line-height:14px; }
            nav a { display:flex !important; align-items:center !important; gap:11px !important; margin:0 !important; padding:11px 14px !important; color:#4b4d5f !important; background:transparent !important; border-radius:10px !important; text-decoration:none !important; font-weight:600 !important; line-height:1.45 !important; transition:background-color .2s,color .2s !important; overflow:hidden !important; }
            nav a:hover { background:#f1f3ff !important; color:#303f9f !important; }
            nav a.active { background:#4b56bd !important; color:#fff !important; }
            .gang-ps-nav-icon { width:22px; min-width:22px; text-align:center; font-size:18px; line-height:1; }
            .gang-ps-nav-label { white-space:nowrap; overflow:hidden; transition:opacity .15s ease !important; }
            .gang-ps-user-box { margin-top:auto; padding:12px 10px 2px; border-top:1px solid #e7e9ee; color:#555966; font-size:.78rem; transition:opacity .15s ease !important; }
            .gang-ps-user-box span { display:block; margin-bottom:8px; font-weight:600; white-space:nowrap; overflow:hidden; }
            #gang-ps-logout { width:100%; margin:0; padding:8px 10px; background:#f44336; color:#fff; border:0; border-radius:8px; cursor:pointer; font-family:inherit; }
            #gang-ps-logout:hover { background:#d32f2f; }
            body > .container { max-width:none !important; margin:20px 20px 20px calc(var(--gang-sidebar-width) + 28px) !important; min-height:calc(100vh - 110px); box-sizing:border-box; transition:margin-left .2s ease !important; }
            body > footer { position:fixed !important; left:calc(var(--gang-sidebar-width) + 28px) !important; right:20px !important; bottom:0 !important; width:auto !important; box-sizing:border-box !important; margin:0 !important; padding:14px 20px !important; z-index:800 !important; background:#f5f6f8 !important; border-top:1px solid #e0e3e8 !important; color:#000 !important; text-align:center !important; transition:left .2s ease !important; }
            body > footer #copyright-year { display:inline; color:#000 !important; }
            body.gang-ps-sidebar-collapsed { --gang-sidebar-width:var(--gang-sidebar-mini-width); }
            body.gang-ps-sidebar-collapsed nav { padding:24px 8px !important; }
            body.gang-ps-sidebar-collapsed nav::before { content:'GP'; text-align:center; padding-left:0; padding-right:0; }
            body.gang-ps-sidebar-collapsed #gang-ps-sidebar-toggle { justify-content:center; padding-left:8px; padding-right:8px; }
            body.gang-ps-sidebar-collapsed .gang-ps-toggle-icon { transform:rotate(180deg); }
            body.gang-ps-sidebar-collapsed .gang-ps-toggle-text,
            body.gang-ps-sidebar-collapsed .gang-ps-nav-label,
            body.gang-ps-sidebar-collapsed .gang-ps-user-box { display:none !important; }
            body.gang-ps-sidebar-collapsed nav a { justify-content:center !important; padding-left:8px !important; padding-right:8px !important; }
            body.gang-ps-sidebar-collapsed .gang-ps-nav-icon { width:26px; min-width:26px; }
            @media (max-width:700px) {
                body { padding:0 0 70px; overflow-x:hidden; }
                nav { position:relative !important; left:auto !important; top:auto !important; bottom:auto !important; width:100% !important; min-height:0 !important; height:auto !important; margin:0 0 12px !important; padding:8px max(8px, env(safe-area-inset-left)) 8px max(8px, env(safe-area-inset-right)) !important; border:0 !important; border-radius:0 !important; box-shadow:0 1px 8px rgba(25,24,59,.08) !important; flex-direction:row !important; align-items:center !important; gap:5px !important; overflow-x:auto !important; overflow-y:hidden !important; -webkit-overflow-scrolling:touch !important; scrollbar-width:none !important; }
                nav::-webkit-scrollbar { display:none; }
                nav::before { display:none !important; }
                #gang-ps-sidebar-toggle { display:none !important; }
                nav a { flex:0 0 auto !important; white-space:nowrap !important; padding:9px 12px !important; min-height:40px !important; box-sizing:border-box !important; display:flex !important; align-items:center !important; justify-content:center !important; font-size:.82rem !important; line-height:1.2 !important; touch-action:manipulation !important; }
                .gang-ps-nav-icon { display:none !important; }
                .gang-ps-user-box { flex:0 0 auto; margin:0 0 0 5px; padding:0 0 0 8px; border-top:0; border-left:1px solid #e7e9ee; white-space:nowrap; }
                .gang-ps-user-box span { display:inline; margin:0 6px 0 0; }
                #gang-ps-logout { width:auto; display:inline-block; padding:8px 10px; }
                body > .container { width:auto !important; max-width:none !important; margin:0 !important; padding:12px !important; border-radius:0 !important; box-shadow:none !important; min-height:0 !important; }
                body > footer { position:fixed !important; left:0 !important; right:0 !important; bottom:0 !important; padding:10px 12px max(10px,env(safe-area-inset-bottom)) !important; font-size:.8rem !important; }
                body.billing-page > .container { padding-top:8px !important; }
                body.gang-ps-sidebar-collapsed { --gang-sidebar-width:100%; }
            }
        `;
        document.head.appendChild(style);
    }

    //======== Sidebar Minimize ========
    const sidebarToggle = document.getElementById('gang-ps-sidebar-toggle');
    const sidebarCollapsed = localStorage.getItem('gangPsSidebarCollapsed') === '1';
    if (sidebarCollapsed && window.innerWidth > 700) document.body.classList.add('gang-ps-sidebar-collapsed');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 700) return;
        const collapsed = document.body.classList.toggle('gang-ps-sidebar-collapsed');
        localStorage.setItem('gangPsSidebarCollapsed', collapsed ? '1' : '0');
        sidebarToggle.setAttribute('aria-label', collapsed ? 'Buka navigasi' : 'Minimize navigasi');
        sidebarToggle.setAttribute('title', collapsed ? 'Buka navigasi' : 'Minimize navigasi');
    });

    //======== Tahun Lokal PC ========
    const footer = document.querySelector('footer');
    if (footer) {
        const year = new Date().getFullYear();
        footer.innerHTML = `GANG PS Ponorogo &copy; <span id="copyright-year">${year}</span>`;
    }
});
