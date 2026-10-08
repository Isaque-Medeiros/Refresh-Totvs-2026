/*
 * TOTVS Field Refresh 2026 - Painel de Gestao (Status Report do rollout)
 * ---------------------------------------------------------------------------
 * Replica o painel que o gestor ja usava, nas cores deste projeto e alimentado
 * automaticamente pelos mesmos dados (localStorage + sincronizacao GitHub).
 *
 * "Preparada" = maquina concluiu as 4 etapas da bancada (data automatica).
 * "Trocada"   = acao separada, com data propria escolhida pelo analista.
 * Ajuste      = correcao manual do gestor, SOMADA ao numero das maquinas.
 */
(function () {
    const LIVE_INTERVALS = [0, 15, 30, 60]; // 0 = pausado

    const runtime = {
        state: null,
        currentUser: null,
        management: null,
        stats: null,
        charts: { burn: null, analyst: null, daily: null },
        clockInterval: null,
        liveInterval: null,
        liveIndex: 0,
        lastLiveAt: null,
        secondsLeft: 0,
        toastTimeout: null,
        busy: false
    };

    function el(id) {
        return document.getElementById(id);
    }

    function formatNumber(value, digits) {
        return Number(value || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: digits || 0,
            maximumFractionDigits: digits || 0
        });
    }

    function formatDuration(seconds) {
        const total = Number(seconds || 0);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function showToast(message, icon) {
        const toast = el('toastNotification');
        const iconEl = el('toastIcon');
        const messageEl = el('toastMessage');
        if (!toast || !iconEl || !messageEl) {
            return;
        }

        iconEl.innerText = icon || 'i';
        messageEl.innerText = message;
        toast.classList.add('show');

        if (runtime.toastTimeout) {
            clearTimeout(runtime.toastTimeout);
        }
        runtime.toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function updateClock() {
        const current = new Date();
        const timeEl = el('managementClock');
        const dateEl = el('managementDate');
        if (timeEl) {
            timeEl.innerText = current.toLocaleTimeString('pt-BR');
        }
        if (dateEl) {
            dateEl.innerText = current.toLocaleDateString('pt-BR');
        }
    }

    /* ------------------------------ Acesso --------------------------------- */

    function loadSession() {
        runtime.state = TOTVSStorage.loadState();
        runtime.currentUser = TOTVSStorage.getCurrentUser(runtime.state);
        runtime.management = TOTVSStorage.loadManagement();
        return runtime.currentUser;
    }

    function hasAccess() {
        return Boolean(runtime.currentUser && runtime.currentUser.role === 'manager');
    }

    function renderAccess() {
        const allowed = hasAccess();
        el('deniedView').classList.toggle('hidden', allowed);
        el('managementView').classList.toggle('hidden', !allowed);

        if (allowed) {
            el('managementUser').innerText = runtime.currentUser.displayName;
            el('managementSubtitle').innerText =
                `${formatNumber(TOTVSRollout.TOTAL_MACHINES)} máquinas · `
                + `${TOTVSRollout.brDate(TOTVSRollout.START_DATE)}/${TOTVSRollout.START_DATE.slice(0, 4)} a `
                + `${TOTVSRollout.brDate(TOTVSRollout.END_DATE)}/${TOTVSRollout.END_DATE.slice(0, 4)}`;
            return true;
        }

        el('deniedMessage').innerText = runtime.currentUser
            ? 'Esta tela é exclusiva do gerente de projeto. Sua sessão atual é de analista.'
            : 'Nenhuma sessão ativa. Entre como gerente no painel operacional para abrir esta tela.';
        return false;
    }

    /* -------------------------------- KPIs --------------------------------- */

    function renderKpis(stats) {
        const host = el('managementKpis');
        if (!host) {
            return;
        }

        const deviation = stats.deviation;
        const deviationTone = deviation >= 0 ? 'is-green' : (deviation > -20 ? 'is-warn' : 'is-red');
        const deviationText = `${deviation >= 0 ? '+' : ''}${formatNumber(deviation)}`;
        const projectedLate = String(stats.projected).indexOf('ap') === 0;

        const cards = [
            {
                label: 'Trocadas (acumulado)',
                value: formatNumber(stats.cumT),
                sub: 'máquinas efetivamente trocadas',
                tone: 'is-orange',
                bar: stats.percent
            },
            {
                label: `Do total de ${formatNumber(TOTVSRollout.TOTAL_MACHINES)}`,
                value: `${stats.percent}%`,
                sub: `${formatNumber(Math.max(0, stats.rest))} restantes`,
                tone: '',
                bar: stats.percent
            },
            {
                label: 'Preparadas (acumulado)',
                value: formatNumber(stats.cumP),
                sub: 'aguardando troca ou já trocadas',
                tone: '',
                bar: TOTVSRollout.TOTAL_MACHINES ? (stats.cumP / TOTVSRollout.TOTAL_MACHINES) * 100 : 0
            },
            {
                label: 'Previsto no plano até hoje',
                value: formatNumber(stats.planToday),
                sub: `referência ${TOTVSRollout.brDate(stats.referenceDate)}`,
                tone: '',
                bar: TOTVSRollout.TOTAL_MACHINES ? (stats.planToday / TOTVSRollout.TOTAL_MACHINES) * 100 : 0
            },
            {
                label: 'Desvio vs plano (trocas)',
                value: deviationText,
                sub: stats.onTrack ? 'no ritmo ou adiantado' : 'atrasado em relação ao plano',
                tone: deviationTone,
                bar: stats.planToday ? Math.min(100, (stats.cumT / stats.planToday) * 100) : 0
            },
            {
                label: 'Ritmo médio (5 dias)',
                value: stats.avgRate ? `${stats.avgRate.toFixed(1)}/dia` : '—',
                sub: 'média dos dias com troca',
                tone: '',
                bar: stats.avgRate ? Math.min(100, stats.avgRate * 10) : 0
            },
            {
                label: 'Projeção de término',
                value: stats.projected,
                sub: `contratual ${TOTVSRollout.brDate(TOTVSRollout.END_DATE)}`,
                tone: stats.projected === '—' ? '' : (projectedLate ? 'is-red' : 'is-green'),
                bar: 0
            },
            {
                label: 'Dias úteis restantes',
                value: formatNumber(stats.remainingBusinessDays),
                sub: `até ${TOTVSRollout.brDate(TOTVSRollout.END_DATE)}`,
                tone: '',
                bar: 0
            }
        ];

        host.innerHTML = cards.map((card) => `
            <div class="kpi-card ${card.tone}">
                <div class="kpi-header">
                    <span>${card.label}</span>
                </div>
                <div class="kpi-body">
                    <span class="kpi-value">${card.value}</span>
                    <span class="kpi-sub">${card.sub}</span>
                </div>
                <div class="kpi-progress">
                    <div class="kpi-progress-bar" style="width:${Math.max(0, Math.min(100, card.bar)).toFixed(2)}%"></div>
                </div>
            </div>
        `).join('');
    }

    /* ------------------------------ Graficos ------------------------------- */

    function withAlpha(color, alpha) {
        const value = String(color || '').trim();

        if (value.charAt(0) === '#' && (value.length === 7 || value.length === 4)) {
            const hex = value.length === 4
                ? value.slice(1).split('').map((char) => char + char).join('')
                : value.slice(1);
            const int = parseInt(hex, 16);
            return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
        }

        return value;
    }

    function chartTheme() {
        const styles = getComputedStyle(document.documentElement);
        const read = (name, fallback) => (styles.getPropertyValue(name) || '').trim() || fallback;

        return {
            ink: read('--text', '#eef5ff'),
            line: read('--border', 'rgba(98, 165, 255, 0.26)'),
            plan: read('--cyan', '#67d7ff'),
            swap: read('--orange', '#ffb020'),
            prep: read('--primary', '#1f7cff')
        };
    }

    function baseOptions(theme) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { labels: { color: theme.ink, boxWidth: 12 } }
            },
            scales: {
                x: { ticks: { color: theme.ink, maxTicksLimit: 12 }, grid: { color: theme.line } },
                y: { ticks: { color: theme.ink }, grid: { color: theme.line }, beginAtZero: true }
            }
        };
    }

    function ensureCanvas(hostId) {
        const host = el(hostId);
        if (!host) {
            return null;
        }

        let canvas = host.querySelector('canvas');
        if (!canvas) {
            host.innerHTML = '';
            canvas = document.createElement('canvas');
            host.appendChild(canvas);
        }
        return canvas;
    }

    function chartsAvailable() {
        return typeof Chart !== 'undefined';
    }

    function renderCharts(stats) {
        if (!chartsAvailable()) {
            return;
        }

        const theme = chartTheme();
        const base = baseOptions(theme);

        // Evolucao acumulada: plano x trocadas x preparadas.
        const burnCanvas = ensureCanvas('burndownChart');
        if (burnCanvas) {
            const series = TOTVSRollout.buildBurndownSeries(
                runtime.state,
                runtime.state.machines,
                runtime.management,
                stats.referenceDate
            );

            if (runtime.charts.burn) { runtime.charts.burn.destroy(); }

            runtime.charts.burn = new Chart(burnCanvas, {
                type: 'line',
                data: {
                    labels: series.labels.map((day) => TOTVSRollout.brDate(day)),
                    datasets: [
                        {
                            label: 'Plano (trocas)',
                            data: series.plan,
                            borderColor: theme.plan,
                            borderDash: [6, 4],
                            pointRadius: 0,
                            borderWidth: 2
                        },
                        {
                            label: 'Trocadas',
                            data: series.realizedSwap,
                            borderColor: theme.swap,
                            backgroundColor: withAlpha(theme.swap, 0.15),
                            fill: true,
                            pointRadius: 0,
                            borderWidth: 3,
                            spanGaps: false
                        },
                        {
                            label: 'Preparadas',
                            data: series.realizedPrep,
                            borderColor: theme.prep,
                            pointRadius: 0,
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    ...base,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        ...base.scales,
                        y: { ...base.scales.y, max: TOTVSRollout.TOTAL_MACHINES }
                    }
                }
            });
        }

        // Por analista (acumulado): barras agrupadas.
        const analystCanvas = ensureCanvas('analystChart');
        if (analystCanvas) {
            if (runtime.charts.analyst) { runtime.charts.analyst.destroy(); }

            runtime.charts.analyst = new Chart(analystCanvas, {
                type: 'bar',
                data: {
                    labels: stats.analystRows.map((row) => row.name),
                    datasets: [
                        {
                            label: 'Preparadas',
                            data: stats.analystRows.map((row) => row.prep),
                            backgroundColor: theme.prep
                        },
                        {
                            label: 'Trocadas',
                            data: stats.analystRows.map((row) => row.swap),
                            backgroundColor: theme.swap
                        }
                    ]
                },
                options: base
            });
        }

        // Ultimos 10 dias lancados.
        const dailyCanvas = ensureCanvas('dailyChart');
        if (dailyCanvas) {
            const last = stats.rows.slice(-10);
            if (runtime.charts.daily) { runtime.charts.daily.destroy(); }

            runtime.charts.daily = new Chart(dailyCanvas, {
                type: 'bar',
                data: {
                    labels: last.map((row) => TOTVSRollout.brDate(row.date)),
                    datasets: [
                        {
                            label: 'Trocas',
                            data: last.map((row) => row.swap),
                            backgroundColor: theme.swap
                        },
                        {
                            label: 'Preparadas',
                            data: last.map((row) => row.prep),
                            backgroundColor: theme.prep
                        }
                    ]
                },
                options: base
            });
        }
    }

    /* -------------------------- Lancamento do dia -------------------------- */

    function bySelector(selector) {
        return Array.from(document.querySelectorAll(selector));
    }

    function buildAdjustRows() {
        const host = el('adjustRows');
        if (!host) {
            return;
        }

        host.innerHTML = TOTVSStorage.getAnalystUsers(runtime.state).map((analyst) => `
            <div class="adjust-grid adjust-row" data-analyst-id="${analyst.id}" data-base-prep="0" data-base-swap="0">
                <span class="adjust-name">${analyst.displayName}</span>
                <div class="adjust-cell">
                    <span class="adjust-base" data-base="prep">0</span>
                    <input type="number" class="form-control adjust-input" data-adjust="prep" step="1"
                           placeholder="0" title="Use valor negativo para corrigir para menos">
                </div>
                <div class="adjust-cell">
                    <span class="adjust-base" data-base="troca">0</span>
                    <input type="number" class="form-control adjust-input" data-adjust="troca" step="1"
                           placeholder="0" title="Use valor negativo para corrigir para menos">
                </div>
                <span class="adjust-total" data-total="row">0 prep · 0 trocas</span>
                <span class="adjust-hosts" data-hosts="row">--</span>
            </div>
        `).join('');
    }

    function updateRowTotals() {
        bySelector('.adjust-row').forEach((row) => {
            const basePrep = Number(row.getAttribute('data-base-prep') || 0);
            const baseSwap = Number(row.getAttribute('data-base-swap') || 0);
            const adjPrep = Number(row.querySelector('[data-adjust="prep"]').value || 0);
            const adjSwap = Number(row.querySelector('[data-adjust="troca"]').value || 0);

            const prep = Math.max(0, basePrep + adjPrep);
            const swap = Math.max(0, baseSwap + adjSwap);

            row.querySelector('[data-total="row"]').innerText =
                `${formatNumber(prep)} prep · ${formatNumber(swap)} trocas`;
        });
    }

    function fillAdjustForm(dateKey) {
        const date = dateKey || TOTVSRollout.todayKey();
        el('fDate').value = date;

        const dayRows = TOTVSRollout.buildDayRows(runtime.state, runtime.state.machines, runtime.management);
        const day = dayRows.filter((row) => row.date === date)[0] || null;

        el('fObs').value = day ? day.note : '';
        el('loadMsg').innerText = day ? 'Editando lançamento existente' : 'Novo lançamento';

        TOTVSStorage.getAnalystUsers(runtime.state).forEach((analyst) => {
            const row = document.querySelector(`.adjust-row[data-analyst-id="${analyst.id}"]`);
            if (!row) {
                return;
            }

            const entry = day && day.analysts[analyst.id] ? day.analysts[analyst.id] : null;
            const basePrep = entry ? entry.basePrep : 0;
            const baseSwap = entry ? entry.baseSwap : 0;
            const adjPrep = entry ? entry.adjPrep : 0;
            const adjSwap = entry ? entry.adjSwap : 0;

            row.setAttribute('data-base-prep', String(basePrep));
            row.setAttribute('data-base-swap', String(baseSwap));

            row.querySelector('[data-base="prep"]').innerText = formatNumber(basePrep);
            row.querySelector('[data-base="troca"]').innerText = formatNumber(baseSwap);
            row.querySelector('[data-adjust="prep"]').value = adjPrep ? String(adjPrep) : '';
            row.querySelector('[data-adjust="troca"]').value = adjSwap ? String(adjSwap) : '';

            const hosts = entry ? entry.prepHosts.concat(entry.swapHosts) : [];
            row.querySelector('[data-hosts="row"]').innerText = hosts.length ? hosts.join(', ') : '--';
        });

        updateRowTotals();
    }

    function readAdjustForm() {
        const day = {
            date: el('fDate').value,
            note: el('fObs').value.trim(),
            rows: []
        };

        bySelector('.adjust-row').forEach((row) => {
            day.rows.push({
                analystId: row.getAttribute('data-analyst-id'),
                name: row.querySelector('.adjust-name').innerText,
                prep: Number(row.querySelector('[data-adjust="prep"]').value || 0),
                troca: Number(row.querySelector('[data-adjust="troca"]').value || 0)
            });
        });

        return day;
    }

    function saveAdjustDay() {
        const day = readAdjustForm();
        if (!day.date) {
            showToast('Informe a data do lançamento.', '!');
            return;
        }

        try {
            day.rows.forEach((row) => {
                runtime.management = TOTVSStorage.setDayAdjustment(
                    day.date,
                    row.analystId,
                    row.name,
                    { prep: row.prep, troca: row.troca },
                    runtime.currentUser.id
                );
            });

            runtime.management = TOTVSStorage.setDailyNote(day.date, day.note, runtime.currentUser.id);

            el('saveMsg').innerText = 'Salvo';
            showToast('Lançamento salvo.', 'ok');
            refresh();
            queueSync();
        } catch (error) {
            el('saveMsg').innerText = 'Erro ao salvar';
            showToast(error.message, '!');
        }
    }

    function deleteAdjustDay() {
        const date = el('fDate').value;
        if (!date) {
            showToast('Informe a data.', '!');
            return;
        }

        if (!window.confirm(`Excluir os ajustes e observações de ${TOTVSRollout.brDate(date)}?`)) {
            return;
        }

        try {
            TOTVSStorage.getAnalystUsers(runtime.state).forEach((analyst) => {
                runtime.management = TOTVSStorage.setDayAdjustment(
                    date,
                    analyst.id,
                    analyst.displayName,
                    { prep: 0, troca: 0 },
                    runtime.currentUser.id
                );
            });

            runtime.management = TOTVSStorage.setDailyNote(date, '', runtime.currentUser.id);
            showToast('Ajustes do dia removidos.', 'ok');
            refresh();
            fillAdjustForm(date);
            queueSync();
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    // Texto pronto para colar na daily (mesmo espirito do painel de referencia).
    function copyDailySummary() {
        const stats = runtime.stats;
        const date = el('fDate').value || stats.referenceDate;
        const day = stats.byDate[date];

        const lines = [
            `Status Rollout TOTVS · ${TOTVSRollout.brDate(date)}`,
            `Trocadas: ${stats.cumT}/${TOTVSRollout.TOTAL_MACHINES} (${stats.percent}%)`
                + ` · plano até hoje: ${stats.planToday}`
                + ` · desvio: ${stats.deviation >= 0 ? '+' : ''}${stats.deviation}`,
            `Preparadas: ${stats.cumP}`
                + ` · ritmo: ${stats.avgRate ? `${stats.avgRate.toFixed(1)}/dia` : '—'}`
                + ` · projeção: ${stats.projected}`
        ];

        if (day) {
            lines.push(`Hoje: ${day.prep} preparadas, ${day.swap} trocadas`);
            day.analystList.forEach((row) => {
                if (row.prep || row.swap) {
                    lines.push(`- ${row.name}: ${row.prep} prep / ${row.swap} trocas`);
                }
            });
            if (day.note) {
                lines.push(`Obs: ${day.note}`);
            }
        }

        const pending = (runtime.management.frentes && runtime.management.frentes.pd) || [];
        if (pending.length) {
            lines.push(`Pendências: ${pending.join('; ')}`);
        }

        const text = lines.join('\n');
        const writing = navigator.clipboard
            ? navigator.clipboard.writeText(text)
            : Promise.reject(new Error('clipboard indisponivel'));

        writing
            .then(() => {
                el('saveMsg').innerText = 'Resumo copiado';
                showToast('Resumo copiado para a daily.', 'ok');
            })
            .catch(() => window.prompt('Copie o texto:', text));
    }

    /* -------------------------------- Frentes ------------------------------ */

    function renderFrentes() {
        const frentes = (runtime.management && runtime.management.frentes) || { ok: [], pd: [] };
        renderFrenteList('okList', frentes.ok || [], 'ok');
        renderFrenteList('pdList', frentes.pd || [], 'pd');
    }

    function renderFrenteList(hostId, items, key) {
        const host = el(hostId);
        if (!host) {
            return;
        }

        if (!items.length) {
            host.innerHTML = '<p class="helper-text">Nada registrado.</p>';
            return;
        }

        host.innerHTML = items.map((text, index) => `
            <div class="frente-chip">
                <span class="frente-text">${key === 'ok' ? '✅' : '⏳'} ${text}</span>
                <button class="btn btn-sm btn-outline" data-frente="${key}" data-index="${index}">
                    ${key === 'ok' ? 'remover' : 'concluir'}
                </button>
            </div>
        `).join('');
    }

    function updateFrentes(key, action, index) {
        const frentes = {
            ok: ((runtime.management.frentes && runtime.management.frentes.ok) || []).slice(),
            pd: ((runtime.management.frentes && runtime.management.frentes.pd) || []).slice()
        };

        if (key === 'ok' && action === 'remove') {
            frentes.ok.splice(index, 1);
        } else if (key === 'pd' && action === 'conclude') {
            const moved = frentes.pd.splice(index, 1)[0];
            if (moved) {
                frentes.ok.push(moved);
            }
        }

        runtime.management = TOTVSStorage.setFrentes(frentes, runtime.currentUser.id);
        renderFrentes();
        queueSync();
    }

    function addFrente(key) {
        const input = el(key === 'ok' ? 'okNew' : 'pdNew');
        const value = String(input.value || '').trim();
        if (!value) {
            return;
        }

        const frentes = {
            ok: ((runtime.management.frentes && runtime.management.frentes.ok) || []).slice(),
            pd: ((runtime.management.frentes && runtime.management.frentes.pd) || []).slice()
        };
        frentes[key].push(value);

        runtime.management = TOTVSStorage.setFrentes(frentes, runtime.currentUser.id);
        input.value = '';
        renderFrentes();
        queueSync();
    }

    /* ------------------------------ Historico ------------------------------ */

    function renderHistory(stats) {
        const body = el('historyTableBody');
        if (!body) {
            return;
        }

        const rows = stats.rows.slice().reverse();
        const label = el('historyCountLabel');
        if (label) {
            label.innerText = `${rows.length} dia(s) lançado(s)`;
        }

        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:28px; color: var(--text-muted);">Nenhum apontamento registrado ainda.</td></tr>';
            return;
        }

        body.innerHTML = rows.map((row) => {
            const plan = TOTVSRollout.planForDay(row.date);
            const deviation = row.cumT - plan;
            const status = TOTVSRollout.dayStatus(deviation);

            return `
                <tr>
                    <td>${TOTVSRollout.brDate(row.date)}</td>
                    <td class="n">${formatNumber(row.prep)}</td>
                    <td class="n">${formatNumber(row.swap)}</td>
                    <td class="n">${formatNumber(row.cumT)}</td>
                    <td class="n">${formatNumber(plan)}</td>
                    <td class="n">${deviation >= 0 ? '+' : ''}${formatNumber(deviation)}</td>
                    <td><span class="pill pill-${status.key}">${status.label}</span></td>
                    <td class="history-note">${row.note || '--'}</td>
                    <td><button class="btn btn-xs btn-outline" data-edit-day="${row.date}">editar</button></td>
                </tr>
            `;
        }).join('');
    }

    /* --------------------------- Operacao ao vivo --------------------------- */

    function emptyRow(colspan, text) {
        return `<tr><td colspan="${colspan}" class="table-empty">${text}</td></tr>`;
    }

    // Media por etapa calculada aqui para o painel nao depender do modulo de relatorios.
    function stepAverageSeconds(machines) {
        const result = {};

        TOTVSStorage.PROCESS_STEPS.forEach((step) => {
            const durations = machines
                .map((machine) => Number(machine.stepDurations[step] || 0))
                .filter((duration) => duration > 0);

            result[step] = durations.length
                ? Math.round(durations.reduce((sum, item) => sum + item, 0) / durations.length)
                : 0;
        });

        return result;
    }

    function renderOperational(stats) {
        const machines = runtime.state.machines.slice();
        const nowMs = Date.now();

        // Em andamento agora: quem esta em qual etapa neste instante.
        const inProgress = machines
            .filter((machine) => machine.status === 'EM_ANDAMENTO')
            .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));

        el('inProgressCount').innerText = String(inProgress.length);
        el('inProgressBody').innerHTML = inProgress.length
            ? inProgress.map((machine) => {
                const delta = Math.max(0, Math.floor((nowMs - new Date(machine.lastTickAt || nowMs).getTime()) / 1000));
                const elapsed = machine.currentStep === 'CONCLUIDO'
                    ? 0
                    : Number(machine.stepDurations[machine.currentStep] || 0) + delta;

                return `
                    <tr>
                        <td class="font-mono">${machine.hostname}</td>
                        <td>${TOTVSStorage.getAnalystName(runtime.state, machine.analystId)}</td>
                        <td>${machine.currentStep}</td>
                        <td class="n font-mono">${formatDuration(elapsed)}</td>
                    </tr>
                `;
            }).join('')
            : emptyRow(4, 'Nenhuma máquina em andamento agora.');

        // Preparadas aguardando troca.
        const waiting = machines
            .filter((machine) => machine.status === 'CONCLUIDO' && !machine.swappedAt)
            .sort((left, right) => String(left.preparedAt || '').localeCompare(String(right.preparedAt || '')));

        el('waitingCount').innerText = String(waiting.length);
        el('waitingSwapBody').innerHTML = waiting.length
            ? waiting.slice(0, 12).map((machine) => `
                <tr>
                    <td class="font-mono">${machine.hostname}</td>
                    <td>${TOTVSStorage.getAnalystName(runtime.state, machine.analystId)}</td>
                    <td>${TOTVSRollout.brDate(TOTVSRollout.toDateKey(machine.preparedAt))}</td>
                </tr>
            `).join('')
            : emptyRow(3, 'Nada aguardando troca.');

        // Incidentes.
        const incidents = machines.filter((machine) => machine.hasError || machine.status === 'ERRO');

        el('incidentCount').innerText = String(incidents.length);
        el('incidentsBody').innerHTML = incidents.length
            ? incidents.slice(0, 12).map((machine) => `
                <tr>
                    <td class="font-mono">${machine.hostname}</td>
                    <td>${TOTVSStorage.getAnalystName(runtime.state, machine.analystId)}</td>
                    <td>${machine.currentStep}</td>
                    <td class="history-note">${machine.errorDetails ? (machine.errorDetails.description || 'Sem descrição') : 'Sem descrição'}</td>
                </tr>
            `).join('')
            : emptyRow(4, 'Nenhum incidente aberto.');

        // Tempo medio por etapa.
        const stepHost = el('stepTimesBody');
        if (stepHost) {
            const averages = stepAverageSeconds(machines);
            const max = Math.max(...TOTVSStorage.PROCESS_STEPS.map((step) => Number(averages[step] || 0)), 1);

            stepHost.innerHTML = TOTVSStorage.PROCESS_STEPS.map((step) => {
                const seconds = Number(averages[step] || 0);
                return `
                    <div class="chart-row">
                        <span class="chart-row-label">${step}</span>
                        <div class="chart-track">
                            <div class="chart-bar is-step" style="width:${((seconds / max) * 100).toFixed(2)}%"></div>
                        </div>
                        <span class="chart-row-value">${TOTVSImporterExporter.formatTimeFriendly(seconds)}</span>
                    </div>
                `;
            }).join('');
        }

        // Atingimento por analista.
        const analystHost = el('analystOpsBody');
        if (analystHost) {
            analystHost.innerHTML = stats.analystRows.map((row) => `
                <tr>
                    <td>${row.name}</td>
                    <td class="n text-green">${formatNumber(row.prep)}</td>
                    <td class="n text-orange">${formatNumber(row.swap)}</td>
                    <td class="n">${formatNumber(row.waitingSwap)}</td>
                    <td class="n">${formatNumber(row.inProgress)}</td>
                    <td class="n ${row.errors ? 'text-red' : ''}">${formatNumber(row.errors)}</td>
                </tr>
            `).join('');
        }
    }

    /* ------------------------- Impressao e backup --------------------------- */

    function canvasImage(hostId) {
        const host = el(hostId);
        const canvas = host ? host.querySelector('canvas') : null;
        return canvas ? canvas.toDataURL('image/png') : '';
    }

    function printDashboard() {
        const stats = runtime.stats;
        const burn = canvasImage('burndownChart');
        const analyst = canvasImage('analystChart');
        const daily = canvasImage('dailyChart');

        const html = `
            <article class="print-report">
                <h1>Status Report - Rollout de maquinas TOTVS</h1>
                <h3>DB4 Serv for Totvs by Isaque de Medeiros</h3>
                <p>Emitido em ${new Date().toLocaleString('pt-BR')} | referencia ${TOTVSRollout.brDate(stats.referenceDate)}</p>

                <section class="print-grid">
                    <div class="print-card"><strong>Trocadas</strong><div>${formatNumber(stats.cumT)}</div></div>
                    <div class="print-card"><strong>Preparadas</strong><div>${formatNumber(stats.cumP)}</div></div>
                    <div class="print-card"><strong>Plano ate hoje</strong><div>${formatNumber(stats.planToday)}</div></div>
                    <div class="print-card"><strong>Desvio</strong><div>${stats.deviation >= 0 ? '+' : ''}${formatNumber(stats.deviation)}</div></div>
                    <div class="print-card"><strong>% do total</strong><div>${stats.percent}%</div></div>
                    <div class="print-card"><strong>Ritmo medio</strong><div>${stats.avgRate ? `${stats.avgRate.toFixed(1)}/dia` : '—'}</div></div>
                    <div class="print-card"><strong>Projecao</strong><div>${stats.projected}</div></div>
                    <div class="print-card"><strong>Dias uteis restantes</strong><div>${formatNumber(stats.remainingBusinessDays)}</div></div>
                </section>

                ${burn ? `<h2>Evolucao acumulada - plano x realizado</h2><img class="print-chart" src="${burn}" alt="Evolucao acumulada">` : ''}
                ${analyst ? `<h2>Por analista (acumulado)</h2><img class="print-chart" src="${analyst}" alt="Por analista">` : ''}
                ${daily ? `<h2>Ultimos 10 dias lancados</h2><img class="print-chart" src="${daily}" alt="Ultimos 10 dias">` : ''}
                ${printTables(stats)}
            </article>
        `;

        const area = el('printArea');
        area.innerHTML = html;

        const cleanup = () => {
            area.innerHTML = '';
            window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup);
        window.print();
        setTimeout(cleanup, 5000);
    }

    function printTables(stats) {
        return `
            <h2>Historico diario</h2>
            <table>
                <thead>
                    <tr><th>Data</th><th>Prep.</th><th>Trocas</th><th>Acum.</th><th>Plano</th><th>Desvio</th><th>Status</th></tr>
                </thead>
                <tbody>
                    ${stats.rows.slice().reverse().map((row) => {
                        const plan = TOTVSRollout.planForDay(row.date);
                        const deviation = row.cumT - plan;
                        const status = TOTVSRollout.dayStatus(deviation);
                        return `<tr>
                            <td>${TOTVSRollout.brDate(row.date)}</td>
                            <td>${row.prep}</td>
                            <td>${row.swap}</td>
                            <td>${row.cumT}</td>
                            <td>${plan}</td>
                            <td>${deviation >= 0 ? '+' : ''}${deviation}</td>
                            <td>${status.label}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>

            <h2>Atingimento por analista</h2>
            <table>
                <thead>
                    <tr><th>Analista</th><th>Preparadas</th><th>Trocadas</th><th>Aguardando troca</th><th>Em andamento</th><th>Incidentes</th></tr>
                </thead>
                <tbody>
                    ${stats.analystRows.map((row) => `<tr>
                        <td>${row.name}</td>
                        <td>${row.prep}</td>
                        <td>${row.swap}</td>
                        <td>${row.waitingSwap}</td>
                        <td>${row.inProgress}</td>
                        <td>${row.errors}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `;
    }

    function exportBackup() {
        const stats = runtime.stats;
        const payload = {
            kind: 'status-rollout-totvs',
            exportedAt: new Date().toISOString(),
            organization: runtime.state.organization,
            referenceDate: stats.referenceDate,
            totals: {
                preparadas: stats.cumP,
                trocadas: stats.cumT,
                planoAteHoje: stats.planToday,
                desvio: stats.deviation,
                percentual: stats.percent,
                ritmo: Number(stats.avgRate.toFixed(2)),
                projecao: stats.projected
            },
            management: {
                adjustments: runtime.management.adjustments,
                notes: runtime.management.notes,
                frentes: runtime.management.frentes
            },
            dailyRollup: stats.rows,
            analystRows: stats.analystRows,
            machines: runtime.state.machines
        };

        TOTVSImporterExporter.downloadJson(`status-rollout-totvs-${TOTVSRollout.todayKey()}.json`, payload);
        showToast('Backup do painel exportado.', 'ok');
    }

    /* ------------------------------ Importacao ------------------------------ */

    function findAnalystIdByName(name) {
        const target = String(name || '').trim().toLowerCase();
        const found = TOTVSStorage.getAnalystUsers(runtime.state).filter(
            (user) => user.displayName.toLowerCase() === target || user.username.toLowerCase() === target
        )[0];
        return found ? found.id : null;
    }

    // Formato do ImplementarAuto: {tipo:"apentamento-analista", analista, days:{...}}
    function importLegacyApontamento(payload) {
        const analystId = findAnalystIdByName(payload.analista);
        if (!analystId) {
            return { imported: 0, reason: `analista "${payload.analista}" nao encontrado` };
        }

        let imported = 0;

        Object.keys(payload.days || {}).forEach((date) => {
            const day = payload.days[date];
            if (!day || !day.date) {
                return;
            }

            runtime.management = TOTVSStorage.setDayAdjustment(
                day.date,
                analystId,
                payload.analista,
                { prep: Number(day.prep || 0), troca: Number(day.troca || 0) },
                runtime.currentUser.id
            );

            if (day.obs) {
                const current = (runtime.management.notes && runtime.management.notes[day.date]) || '';
                const tag = `${payload.analista}: ${day.obs}`;
                const parts = current
                    ? current.split(' | ').filter((part) => part.indexOf(`${payload.analista}: `) !== 0)
                    : [];
                parts.push(tag);
                runtime.management = TOTVSStorage.setDailyNote(day.date, parts.join(' | '), runtime.currentUser.id);
            }

            imported += 1;
        });

        return { imported };
    }

    // Formato do painel de referencia: {days:{...}, config:{ok,pd}, analistas:[...]}
    function importLegacyBackup(payload) {
        let imported = 0;
        let skipped = 0;

        Object.keys(payload.days || {}).forEach((date) => {
            const day = payload.days[date];
            if (!day || !day.date) {
                return;
            }

            const perAnalyst = day.an || {};
            const names = Object.keys(perAnalyst);

            if (!names.length) {
                skipped += 1;
                return;
            }

            names.forEach((name) => {
                const entry = perAnalyst[name] || {};
                const analystId = findAnalystIdByName(name);

                if (!analystId) {
                    skipped += 1;
                    return;
                }

                runtime.management = TOTVSStorage.setDayAdjustment(
                    day.date,
                    analystId,
                    name,
                    { prep: Number(entry.prep || 0), troca: Number(entry.troca || 0) },
                    runtime.currentUser.id
                );
                imported += 1;
            });

            if (day.obs) {
                runtime.management = TOTVSStorage.setDailyNote(day.date, day.obs, runtime.currentUser.id);
            }
        });

        if (payload.config) {
            runtime.management = TOTVSStorage.setFrentes(
                { ok: payload.config.ok || [], pd: payload.config.pd || [] },
                runtime.currentUser.id
            );
        }

        return { imported, skipped };
    }

    function handleImport(payload) {
        if (!payload || typeof payload !== 'object') {
            return { ok: false, message: 'Arquivo inválido.' };
        }

        if (payload.kind === 'management') {
            runtime.management = TOTVSStorage.replaceManagement({
                adjustments: payload.adjustments || {},
                notes: payload.notes || {},
                frentes: payload.frentes || { ok: [], pd: [] }
            }, runtime.currentUser.id);
            return { ok: true, message: 'Configuração de gestão importada.' };
        }

        if (payload.kind === 'status-rollout-totvs' && payload.management) {
            runtime.management = TOTVSStorage.replaceManagement(payload.management, runtime.currentUser.id);
            return { ok: true, message: 'Backup do painel importado.' };
        }

        if (payload.tipo === 'apontamento-analista' && payload.days) {
            const result = importLegacyApontamento(payload);
            return {
                ok: true,
                message: result.reason || `Apontamento de ${payload.analista} importado (${result.imported} dia(s)).`
            };
        }

        if (payload.days) {
            const result = importLegacyBackup(payload);
            return {
                ok: true,
                message: `Backup importado: ${result.imported} lançamento(s), ${result.skipped} ignorado(s).`
            };
        }

        return { ok: false, message: 'Formato de arquivo não reconhecido.' };
    }

    function handleImportFiles(files) {
        const list = Array.from(files || []);
        if (!list.length) {
            return;
        }

        const messages = [];
        let pending = list.length;

        list.forEach((file) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const result = handleImport(JSON.parse(event.target.result));
                    messages.push(result.ok ? result.message : `${file.name}: ${result.message}`);
                } catch (error) {
                    messages.push(`${file.name}: arquivo inválido`);
                }

                pending -= 1;
                if (pending === 0) {
                    refresh();
                    fillAdjustForm(el('fDate').value);
                    queueSync();
                    showToast(messages.join(' | '), 'ok');
                }
            };

            reader.readAsText(file);
        });

        el('fileImport').value = '';
    }

    /* ----------------------------- Sincronizacao ---------------------------- */

    function renderSyncLabel() {
        const node = el('managementSync');
        if (!node) {
            return;
        }

        const status = TOTVSGithubSync.getStatus();
        if (!status.configured) {
            node.innerText = 'Sincronização: não configurada';
            return;
        }

        node.innerText = status.lastSyncAt
            ? `Sincronização: ${TOTVSStorage.formatDateTime(status.lastSyncAt)}`
            : 'Sincronização: pendente';
    }

    function queueSync() {
        if (!TOTVSGithubSync.isConfigured()) {
            return;
        }

        TOTVSGithubSync.scheduleAutoSync(async () => {
            const freshState = TOTVSStorage.processRunningTimers();
            const user = TOTVSStorage.getCurrentUser(freshState);
            if (!user) {
                return;
            }

            await TOTVSGithubSync.syncNow(freshState, user);
            TOTVSGithubSync.markSuccess('Painel de gestao enviado para o GitHub.');
            renderSyncLabel();
        });
    }

    async function pushNow() {
        if (!TOTVSGithubSync.isConfigured()) {
            showToast('Configure a sincronizacao no painel operacional.', '!');
            return;
        }

        runtime.state = TOTVSStorage.processRunningTimers();
        TOTVSGithubSync.markBusy('Enviando dados para o GitHub...');

        await TOTVSGithubSync.enqueue(async () => {
            await TOTVSGithubSync.syncNow(runtime.state, runtime.currentUser);
            TOTVSGithubSync.markSuccess('Painel de gestao enviado para o GitHub.');
        });

        refresh();
        const status = TOTVSGithubSync.getStatus();
        showToast(
            status.status === 'error' ? status.message : 'Envio concluído.',
            status.status === 'error' ? '!' : 'ok'
        );
    }

    async function pullNow(silent) {
        if (!TOTVSGithubSync.isConfigured()) {
            if (!silent) {
                showToast('Configure a sincronizacao no painel operacional.', '!');
            }
            return;
        }

        TOTVSGithubSync.markBusy('Baixando dados do GitHub...');

        try {
            const bundle = await TOTVSGithubSync.fetchBundle();
            const result = TOTVSStorage.mergeRemoteBundle(bundle, runtime.currentUser);
            refresh();
            TOTVSGithubSync.markSuccess(`GitHub sincronizado: ${result.applied} novo(s).`);
            if (!silent) {
                showToast(`Dados recebidos: ${result.applied} novo(s) registro(s).`, 'ok');
            }
        } catch (error) {
            TOTVSGithubSync.markError(error.message);
            if (!silent) {
                showToast(error.message, '!');
            }
        }

        renderSyncLabel();
    }

    /* -------------------------------- Ao vivo ------------------------------ */

    function liveIntervalSeconds() {
        return LIVE_INTERVALS[runtime.liveIndex];
    }

    function renderLiveIndicator() {
        const label = el('liveLabel');
        const detail = el('liveDetail');
        const dot = el('liveDot');
        const button = el('btnToggleLive');
        if (!label || !detail || !button) {
            return;
        }

        const seconds = liveIntervalSeconds();
        const paused = seconds === 0;

        if (dot) {
            dot.classList.toggle('is-paused', paused);
        }

        label.innerText = paused ? 'Pausado' : 'Ao vivo';

        if (paused) {
            detail.innerText = 'Atualização automática desligada';
            button.innerText = 'Ativar';
            return;
        }

        const updatedAt = runtime.lastLiveAt
            ? new Date(runtime.lastLiveAt).toLocaleTimeString('pt-BR')
            : '--:--:--';

        detail.innerText = `Atualizado ${updatedAt} · próximo em ${runtime.secondsLeft}s (${seconds}s)`;
        button.innerText = 'Pausar';
    }

    function stepLive() {
        const seconds = liveIntervalSeconds();
        if (!seconds) {
            renderLiveIndicator();
            return;
        }

        runtime.secondsLeft -= 1;

        if (runtime.secondsLeft <= 0) {
            runtime.secondsLeft = seconds;

            if (TOTVSGithubSync.isConfigured()) {
                pullNow(true);
            } else {
                refresh();
                runtime.lastLiveAt = Date.now();
            }
        }

        renderLiveIndicator();
    }

    function toggleLiveInterval() {
        runtime.liveIndex = (runtime.liveIndex + 1) % LIVE_INTERVALS.length;
        runtime.secondsLeft = liveIntervalSeconds();
        renderLiveIndicator();

        showToast(
            liveIntervalSeconds() === 0
                ? 'Atualização automática pausada.'
                : `Atualização automática a cada ${liveIntervalSeconds()}s.`,
            'ok'
        );
    }

    function startLive() {
        if (runtime.liveInterval) {
            clearInterval(runtime.liveInterval);
        }

        runtime.secondsLeft = liveIntervalSeconds();
        runtime.liveInterval = setInterval(stepLive, 1000);
        renderLiveIndicator();
    }

    /* -------------------------------- Estado -------------------------------- */

    function refresh() {
        runtime.state = TOTVSStorage.loadState();
        runtime.management = TOTVSStorage.loadManagement();
        runtime.stats = TOTVSRollout.buildStats(runtime.state, runtime.state.machines, runtime.management);

        renderKpis(runtime.stats);
        renderCharts(runtime.stats);
        renderHistory(runtime.stats);
        renderOperational(runtime.stats);
        renderFrentes(runtime.stats);
        renderSyncLabel();
    }

    /* ------------------------------- Acoes --------------------------------- */

    function handleFrenteClick(event) {
        const button = event.target.closest('[data-frente]');
        if (!button) {
            return;
        }

        const key = button.getAttribute('data-frente');
        const index = Number(button.getAttribute('data-index'));
        updateFrentes(key, key === 'ok' ? 'remove' : 'conclude', index);
    }

    function bindActions() {
        el('btnPrintDashboard').addEventListener('click', printDashboard);
        el('btnExportBackup').addEventListener('click', exportBackup);
        el('fileImport').addEventListener('change', (event) => handleImportFiles(event.target.files));
        el('btnPushGh').addEventListener('click', pushNow);
        el('btnPullGh').addEventListener('click', () => pullNow(false));
        el('btnToggleLive').addEventListener('click', toggleLiveInterval);

        el('bSaveDay').addEventListener('click', saveAdjustDay);
        el('bDeleteDay').addEventListener('click', deleteAdjustDay);
        el('bCopyDaily').addEventListener('click', copyDailySummary);

        el('fDate').addEventListener('change', (event) => fillAdjustForm(event.target.value));
        el('adjustRows').addEventListener('input', updateRowTotals);

        el('okAdd').addEventListener('click', () => addFrente('ok'));
        el('pdAdd').addEventListener('click', () => addFrente('pd'));
        el('okList').addEventListener('click', handleFrenteClick);
        el('pdList').addEventListener('click', handleFrenteClick);

        el('historyTableBody').addEventListener('click', (event) => {
            const button = event.target.closest('[data-edit-day]');
            if (!button) {
                return;
            }

            fillAdjustForm(button.getAttribute('data-edit-day'));
            el('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    function init() {
        loadSession();
        updateClock();
        runtime.clockInterval = setInterval(updateClock, 1000);

        if (!renderAccess()) {
            return;
        }

        buildAdjustRows();
        bindActions();
        refresh();
        fillAdjustForm(TOTVSRollout.todayKey());
        startLive();
        pullNow(true);

        console.log('TOTVS Field Refresh 2026 - painel de gestao inicializado.');
    }

    document.addEventListener('DOMContentLoaded', init);
})();
