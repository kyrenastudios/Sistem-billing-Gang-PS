document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('history-table');
    const body = document.getElementById('history-body');
    if (!table || !body) return;

    //======== Pagination 5 Transaksi ========
    const pageSize = 5;
    let currentPage = 1;

    const pagination = document.createElement('div');
    pagination.id = 'history-pagination';
    pagination.setAttribute('aria-label', 'Navigasi halaman riwayat');
    table.insertAdjacentElement('afterend', pagination);

    const style = document.createElement('style');
    style.textContent = `
        #history-table th:first-child,
        #history-table td:first-child {
            width: 55px;
            min-width: 55px;
            text-align: center;
            white-space: nowrap;
        }
        #history-table th:nth-child(2), #history-table td:nth-child(2) { width: 17%; }
        #history-table th:nth-child(3), #history-table td:nth-child(3) { width: 17%; }
        #history-table th:nth-child(4), #history-table td:nth-child(4) { width: 18%; }
        #history-table th:nth-child(5), #history-table td:nth-child(5) { width: 27%; }
        #history-table th:nth-child(6), #history-table td:nth-child(6) { width: 10%; min-width: 80px; text-align: center; }
        #history-table td { vertical-align: top; overflow-wrap: anywhere; }
        #history-table td ul { margin: 0; padding-left: 18px; }
        #history-pagination { display:flex; justify-content:center; align-items:center; gap:6px; flex-wrap:wrap; margin:20px 0 8px; }
        #history-pagination button { min-width:38px; height:38px; padding:0 11px; border:1px solid #d9dce3; border-radius:7px; background:#fff; color:#3f4354; cursor:pointer; font-weight:600; }
        #history-pagination button:hover { background:#f1f3f7; }
        #history-pagination button.active { background:#3f51b5; border-color:#3f51b5; color:#fff; }
        #history-pagination button:disabled { opacity:.45; cursor:not-allowed; }
        #history-pagination .pagination-info { width:100%; text-align:center; color:#777b88; font-size:.85rem; margin-top:3px; }
        @media(max-width:600px) {
            #history-table th:first-child,
            #history-table td:first-child { width:42px; min-width:42px; }
            #history-table { font-size:.85rem; }
            #history-table th, #history-table td { padding:7px; }
        }
    `;
    document.head.appendChild(style);

    function renderPagination() {
        const rows = Array.from(body.querySelectorAll('tr'));
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;

        rows.forEach((row, index) => {
            //======== Nomor Transaksi ========
            const numberCell = row.firstElementChild;
            if (numberCell) {
                numberCell.classList.add('history-row-number');
                numberCell.textContent = String(index + 1);
            }

            const page = Math.floor(index / pageSize) + 1;
            row.style.display = page === currentPage ? '' : 'none';
        });

        pagination.innerHTML = '';
        if (rows.length <= pageSize) {
            pagination.style.display = 'none';
            return;
        }
        pagination.style.display = 'flex';

        const previous = document.createElement('button');
        previous.type = 'button';
        previous.textContent = '‹';
        previous.title = 'Halaman sebelumnya';
        previous.disabled = currentPage === 1;
        previous.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPagination();
            }
        });
        pagination.appendChild(previous);

        for (let page = 1; page <= totalPages; page++) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = page;
            button.classList.toggle('active', page === currentPage);
            button.setAttribute('aria-current', page === currentPage ? 'page' : 'false');
            button.addEventListener('click', () => {
                currentPage = page;
                renderPagination();
            });
            pagination.appendChild(button);
        }

        const next = document.createElement('button');
        next.type = 'button';
        next.textContent = '›';
        next.title = 'Halaman berikutnya';
        next.disabled = currentPage === totalPages;
        next.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPagination();
            }
        });
        pagination.appendChild(next);

        const info = document.createElement('div');
        info.className = 'pagination-info';
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, rows.length);
        info.textContent = `Menampilkan ${start}-${end} dari ${rows.length} transaksi`;
        pagination.appendChild(info);
    }

    //======== Refresh Saat Data History Berubah ========
    let refreshTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            currentPage = 1;
            renderPagination();
        }, 0);
    });
    observer.observe(body, { childList: true });

    renderPagination();
});
