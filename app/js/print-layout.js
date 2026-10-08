/*
 * TOTVS Field Refresh 2026 - Layout de impressao (PDF profissional)
 * ---------------------------------------------------------------------------
 * Modulo de strings: monta o documento A4 usado pelos relatorios do painel
 * operacional e pelo painel de gestao. Sem acesso ao DOM (nao usa el()/
 * getElementById), justamente para poder ser carregado nas duas paginas.
 *
 * Regras seguidas para nao cortar nada no papel:
 *   - tabelas com `table-layout: fixed` e quebra de palavra;
 *   - blocos e linhas com `break-inside: avoid`;
 *   - cabecalho de tabela repetido nas quebras de pagina;
 *   - imagens limitadas a largura da area util.
 */
const TOTVSPrintLayout = (() => {
    function escapeHtml(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function header(options) {
        const config = options || {};
        const meta = Array.isArray(config.meta) ? config.meta : [];

        return `
            <header class="print-head">
                <div class="print-brand">
                    <span class="print-logo">TOTVS</span>
                    <span class="print-logo-tag">REFRESH 2026</span>
                </div>
                <div class="print-head-text">
                    <h1>${escapeHtml(config.title || 'Relatório')}</h1>
                    <p class="print-sub">${escapeHtml(config.subtitle || '')}</p>
                </div>
                ${meta.length ? `
                    <div class="print-meta">
                        ${meta.map((item) => `
                            <span><strong>${escapeHtml(item.label)}</strong>${escapeHtml(item.value)}</span>
                        `).join('')}
                    </div>
                ` : ''}
            </header>
        `;
    }

    function kpis(cards) {
        const list = Array.isArray(cards) ? cards : [];
        if (!list.length) {
            return '';
        }

        return `
            <section class="print-kpis">
                ${list.map((card) => `
                    <div class="print-kpi">
                        <span class="print-kpi-label">${escapeHtml(card.label)}</span>
                        <span class="print-kpi-value">${escapeHtml(card.value)}</span>
                        ${card.hint ? `<span class="print-kpi-hint">${escapeHtml(card.hint)}</span>` : ''}
                    </div>
                `).join('')}
            </section>
        `;
    }

    function sectionTitle(text, hint) {
        return `
            <h2 class="print-section">${escapeHtml(text)}${hint ? `<span>${escapeHtml(hint)}</span>` : ''}</h2>
        `;
    }

    function table(options) {
        const config = options || {};
        const headers = Array.isArray(config.headers) ? config.headers : [];
        const rows = Array.isArray(config.rows) ? config.rows : [];
        const rightAlign = config.rightAlign || [];
        const extraClass = config.className ? ` ${config.className}` : '';

        if (!rows.length) {
            return `<p class="print-empty">${escapeHtml(config.emptyText || 'Sem dados para exibir.')}</p>`;
        }

        return `
            <table class="print-table${extraClass}">
                <thead>
                    <tr>
                        ${headers.map((cell, index) => `<th${rightAlign.indexOf(index) !== -1 ? ' class="n"' : ''}>${escapeHtml(cell)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((row) => `
                        <tr>
                            ${row.map((cell, index) => `<td${rightAlign.indexOf(index) !== -1 ? ' class="n"' : ''}>${escapeHtml(cell)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function chartBlock(source, title, caption) {
        if (!source) {
            return '';
        }

        return `
            <figure class="print-figure">
                <figcaption>${escapeHtml(title)}</figcaption>
                <img src="${source}" alt="${escapeHtml(title)}">
                ${caption ? `<p class="print-caption">${escapeHtml(caption)}</p>` : ''}
            </figure>
        `;
    }

    function chartGrid(blocks) {
        const list = (Array.isArray(blocks) ? blocks : []).filter(Boolean);
        if (!list.length) {
            return '';
        }
        return `<section class="print-chart-grid">${list.join('')}</section>`;
    }

    function document(options) {
        const config = options || {};
        return `
            <article class="print-report">
                ${header(config)}
                ${config.body || ''}
                <footer class="print-foot">
                    <span>${escapeHtml(config.footerNote || 'Documento gerado pelo sistema TOTVS Field Refresh 2026.')}</span>
                    <span>${escapeHtml(config.signature || 'DB4 Serv for Totvs by Isaque de Medeiros')}</span>
                </footer>
            </article>
        `;
    }

    function nowStamp() {
        return new Date().toLocaleString('pt-BR');
    }

    return {
        chartBlock,
        chartGrid,
        document,
        escapeHtml,
        header,
        kpis,
        nowStamp,
        sectionTitle,
        table
    };
})();
