/*
 * TOTVS Field Refresh 2026 - Regras do rollout
 * ---------------------------------------------------------------------------
 * Calendario util, plano de trocas e KPIs de gestao.
 * As regras foram portadas do painel que o gestor ja usa
 * (status-report-rollout-totvs-local.html) para o painel desta aplicacao.
 */
const TOTVSRollout = (() => {
    const TOTAL_MACHINES = 1000;
    const START_DATE = '2026-10-05';
    const END_DATE = '2027-01-29';
    const SWAP_START_DATE = '2026-10-19';
    const RATE_WINDOW_DAYS = 5;

    const HOLIDAYS = [
        '2026-10-12',
        '2026-11-02',
        '2026-11-20',
        '2026-12-24',
        '2026-12-25',
        '2026-12-31',
        '2027-01-01'
    ];

    const MONTH_TARGET = {
        '2026-10': 160,
        '2026-11': 300,
        '2026-12': 280,
        '2027-01': 260
    };

    const HOLIDAY_SET = new Set(HOLIDAYS);

    /* ------------------------------- Datas ------------------------------- */

    function toDateKey(value) {
        if (!value) {
            return null;
        }

        const raw = String(value);

        // Data pura (YYYY-MM-DD) entra como esta, sem conversao de fuso.
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return raw;
        }

        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    function brDate(dateKey) {
        if (!dateKey) {
            return '--';
        }
        return `${String(dateKey).slice(8, 10)}/${String(dateKey).slice(5, 7)}`;
    }

    function todayKey() {
        return toDateKey(new Date());
    }

    /* --------------------------- Datas oficiais ---------------------------
     * A data que vale no relatorio e a **data registrada** pelo analista
     * ("Data da cronometragem"), e nao o instante em que o registro foi salvo
     * no sistema. Sem isso, uma maquina trabalhada no dia 5 e lancada hoje
     * aparecia com a data de hoje no painel de gestao.
     * -------------------------------------------------------------------- */

    function isPrepared(machine) {
        return Boolean(machine) && (
            machine.status === 'CONCLUIDO'
            || machine.status === 'AGUARDANDO_CHECKLIST'
            || Boolean(machine.preparedAt)
        );
    }

    function officialPrepDateKey(machine) {
        if (!isPrepared(machine)) {
            return null;
        }
        return toDateKey(machine.processDate) || toDateKey(machine.preparedAt) || toDateKey(machine.completedAt);
    }

    function officialSwapDateKey(machine) {
        if (!machine || !machine.swappedAt) {
            return null;
        }
        return toDateKey(machine.swappedAt);
    }

    // Verdadeiro quando a data registrada difere da data em que o sistema salvou
    // o registro: o painel mostra as duas e marca a divergencia.
    function hasDateDivergence(machine) {
        const registered = toDateKey(machine && machine.processDate);
        const saved = toDateKey(machine && (machine.preparedAt || machine.completedAt));
        return Boolean(registered && saved && registered !== saved);
    }

    function addDays(dateKey, amount) {
        const date = new Date(`${dateKey}T12:00:00`);
        date.setDate(date.getDate() + amount);
        return toDateKey(date);
    }

    function isBusinessDay(dateKey) {
        if (!dateKey) {
            return false;
        }

        const weekday = new Date(`${dateKey}T12:00:00`).getDay();
        const isWeekend = weekday === 0 || weekday === 6;
        return !isWeekend && !HOLIDAY_SET.has(dateKey);
    }

    function listBusinessDays(from, to) {
        const days = [];
        let cursor = from;

        while (cursor && cursor <= to) {
            if (isBusinessDay(cursor)) {
                days.push(cursor);
            }
            cursor = addDays(cursor, 1);
        }

        return days;
    }

    const BUSINESS_DAYS = listBusinessDays(START_DATE, END_DATE);

    /* ------------------------------- Plano ------------------------------- */

    // Plano de trocas acumulado: distribui a meta do mes entre os dias uteis
    // a partir do inicio das trocas, formando a linha "previsto" do burndown.
    const PLAN_CUMULATIVE = (() => {
        const businessDaysInMonth = {};
        BUSINESS_DAYS.forEach((day) => {
            if (day < SWAP_START_DATE) {
                return;
            }
            const month = day.slice(0, 7);
            businessDaysInMonth[month] = (businessDaysInMonth[month] || 0) + 1;
        });

        const ratePerDay = {};
        Object.keys(businessDaysInMonth).forEach((month) => {
            ratePerDay[month] = (MONTH_TARGET[month] || 0) / businessDaysInMonth[month];
        });

        const plan = {};
        let cumulative = 0;
        BUSINESS_DAYS.forEach((day) => {
            if (day >= SWAP_START_DATE) {
                cumulative += ratePerDay[day.slice(0, 7)] || 0;
            }
            plan[day] = Math.min(TOTAL_MACHINES, Math.round(cumulative));
        });

        return plan;
    })();

    function planForDay(dateKey) {
        if (!dateKey) {
            return 0;
        }

        if (Object.prototype.hasOwnProperty.call(PLAN_CUMULATIVE, dateKey)) {
            return PLAN_CUMULATIVE[dateKey];
        }

        // Para dias fora do calendario util, devolve o plano do ultimo dia util anterior.
        let best = 0;
        BUSINESS_DAYS.forEach((day) => {
            if (day <= dateKey) {
                best = PLAN_CUMULATIVE[day];
            }
        });
        return best;
    }

    function businessDaysBetween(from, to) {
        if (!from || !to || to < from) {
            return 0;
        }
        return listBusinessDays(from, to).length;
    }

    /* ------------------------- Consolidacao por dia ------------------------- */

    function emptyBucket(date) {
        return {
            date,
            prep: 0,
            swap: 0,
            prepHosts: [],
            swapHosts: [],
            byAnalyst: {}
        };
    }

    function ensureAnalyst(bucket, analystId, analystName) {
        if (!bucket.byAnalyst[analystId]) {
            bucket.byAnalyst[analystId] = {
                id: analystId,
                name: analystName,
                prep: 0,
                swap: 0,
                prepHosts: [],
                swapHosts: []
            };
        }
        return bucket.byAnalyst[analystId];
    }

    // Deriva "preparadas" (conclusao das 4 etapas) e "trocadas" (acao separada,
    // com data propria) a partir dos registros, agrupando por dia e por analista.
    // Chaveado por analystId para que renomear o usuario nao quebre o historico.
    function buildDailyRollup(state, machines) {
        const days = {};

        (machines || []).forEach((machine) => {
            const analystId = machine.analystId;
            const analystName = TOTVSStorage.getAnalystName(state, analystId);
            const preparedKey = officialPrepDateKey(machine);
            const swappedKey = officialSwapDateKey(machine);

            if (preparedKey) {
                if (!days[preparedKey]) { days[preparedKey] = emptyBucket(preparedKey); }
                days[preparedKey].prep += 1;
                days[preparedKey].prepHosts.push(machine.hostname);
                ensureAnalyst(days[preparedKey], analystId, analystName).prep += 1;
            }

            if (swappedKey) {
                if (!days[swappedKey]) { days[swappedKey] = emptyBucket(swappedKey); }
                days[swappedKey].swap += 1;
                days[swappedKey].swapHosts.push(machine.hostname);
                const entry = ensureAnalyst(days[swappedKey], analystId, analystName);
                entry.swap += 1;
                entry.swapHosts.push(machine.hostname);
            }
        });

        return days;
    }

    function sumRollup(days) {
        return Object.values(days || {}).reduce((acc, day) => {
            acc.prep += day.prep;
            acc.swap += day.swap;
            return acc;
        }, { prep: 0, swap: 0 });
    }

    const EMPTY_MANAGEMENT = { adjustments: {}, notes: {}, frentes: { ok: [], pd: [] } };

    // Linha de cada dia = derivado das maquinas + ajuste manual do gestor.
    function buildDayRows(state, machines, management) {
        const store = (management && management.adjustments) || {};
        const notes = (management && management.notes) || {};
        const derived = buildDailyRollup(state, machines);
        const dates = Array.from(new Set(Object.keys(derived).concat(Object.keys(store)))).sort();

        return dates.map((date) => {
            const bucket = derived[date] || emptyBucket(date);
            const dayAdjustments = store[date] || {};
            const analysts = {};

            Object.keys(bucket.byAnalyst).forEach((analystId) => {
                const entry = bucket.byAnalyst[analystId];
                analysts[analystId] = {
                    id: analystId,
                    name: entry.name,
                    basePrep: entry.prep,
                    baseSwap: entry.swap,
                    prepHosts: entry.prepHosts.slice(),
                    swapHosts: entry.swapHosts.slice(),
                    adjPrep: 0,
                    adjSwap: 0,
                    prep: entry.prep,
                    swap: entry.swap
                };
            });

            Object.keys(dayAdjustments).forEach((analystId) => {
                const adjustment = dayAdjustments[analystId] || {};
                if (!analysts[analystId]) {
                    analysts[analystId] = {
                        id: analystId,
                        name: adjustment.name || TOTVSStorage.getAnalystName(state, analystId),
                        basePrep: 0,
                        baseSwap: 0,
                        prepHosts: [],
                        swapHosts: [],
                        adjPrep: 0,
                        adjSwap: 0,
                        prep: 0,
                        swap: 0
                    };
                }

                const row = analysts[analystId];
                row.adjPrep = Number(adjustment.prep || 0);
                row.adjSwap = Number(adjustment.troca || 0);
                row.prep = Math.max(0, row.basePrep + row.adjPrep);
                row.swap = Math.max(0, row.baseSwap + row.adjSwap);
            });

            const analystList = Object.keys(analysts).map((key) => analysts[key]);

            return {
                date,
                analysts,
                analystList,
                prep: analystList.reduce((sum, row) => sum + row.prep, 0),
                swap: analystList.reduce((sum, row) => sum + row.swap, 0),
                basePrep: bucket.prep,
                baseSwap: bucket.swap,
                prepHosts: bucket.prepHosts,
                swapHosts: bucket.swapHosts,
                note: notes[date] || ''
            };
        });
    }

    // Totais por analista (inclui ajustes) e tambem os numeros vivos do operacional.
    // O gerente entra como responsavel quando assume registros no proprio nome.
    function buildAnalystRows(state, machines, management) {
        const rows = buildDayRows(state, machines, management);

        return TOTVSStorage.getResponsibleUsers(state).map((analyst) => {
            let prep = 0;
            let swap = 0;

            rows.forEach((day) => {
                const entry = day.analysts[analyst.id];
                if (entry) {
                    prep += entry.prep;
                    swap += entry.swap;
                }
            });

            const owned = (machines || []).filter((machine) => machine.analystId === analyst.id);

            return {
                id: analyst.id,
                name: analyst.displayName,
                isManager: analyst.role === 'manager',
                prep,
                swap,
                total: owned.length,
                concluded: owned.filter((machine) => machine.status === 'CONCLUIDO').length,
                inProgress: owned.filter((machine) => machine.status === 'EM_ANDAMENTO').length,
                waitingSwap: owned.filter((machine) => isPrepared(machine) && !machine.swappedAt).length,
                errors: owned.filter((machine) => machine.hasError || machine.status === 'ERRO').length
            };
        });
    }

    // Equivalente ao stats() do painel de referencia do gestor.
    function buildStats(state, machines, management, referenceDate) {
        const refDate = toDateKey(referenceDate) || todayKey();
        const rows = buildDayRows(state, machines, management);

        let cumT = 0;
        let cumP = 0;
        const withCumulative = rows.map((row) => {
            cumT += row.swap;
            cumP += row.prep;
            return { ...row, cumT, cumP };
        });

        const planToday = planForDay(refDate);
        const deviation = cumT - planToday;
        const rest = TOTAL_MACHINES - cumT;
        const remainingBusinessDays = BUSINESS_DAYS.filter((day) => day > refDate).length;

        // Ritmo: media dos dias COM troca dentro dos ultimos 5 dias lancados
        // (mesma regra do painel de referencia).
        const recent = withCumulative.slice(-RATE_WINDOW_DAYS).filter((row) => row.swap > 0);
        const avgRate = recent.length
            ? recent.reduce((sum, row) => sum + row.swap, 0) / recent.length
            : 0;

        let projected = '—';
        if (rest <= 0) {
            projected = 'Concluído';
        } else if (avgRate > 0) {
            const needed = Math.ceil(rest / avgRate);
            let startIndex = BUSINESS_DAYS.findIndex((day) => day > refDate);
            if (startIndex < 0) {
                startIndex = BUSINESS_DAYS.length;
            }
            const targetIndex = startIndex + needed - 1;
            projected = targetIndex < BUSINESS_DAYS.length
                ? brDate(BUSINESS_DAYS[targetIndex])
                : `após ${brDate(END_DATE)} (+${targetIndex - BUSINESS_DAYS.length + 1} d.u.)`;
        }

        const byDate = {};
        withCumulative.forEach((row) => { byDate[row.date] = row; });

        return {
            referenceDate: refDate,
            rows: withCumulative,
            byDate,
            cumT,
            cumP,
            planToday,
            deviation,
            avgRate,
            rest,
            remainingBusinessDays,
            projected,
            percent: TOTAL_MACHINES ? Math.round((cumT / TOTAL_MACHINES) * 100) : 0,
            onTrack: deviation >= 0,
            analystRows: buildAnalystRows(state, machines, management)
        };
    }

    function dayStatus(deviation) {
        if (deviation >= 0) {
            return { key: 'ok', label: 'no plano' };
        }
        if (deviation > -20) {
            return { key: 'warn', label: 'atenção' };
        }
        return { key: 'bad', label: 'atrasado' };
    }

    // Serie do grafico de evolucao: todos os dias uteis do periodo,
    // com o realizado cortado na data de referencia (futuro = null).
    function buildBurndownSeries(state, machines, management, referenceDate) {
        const stats = buildStats(state, machines, management, referenceDate);
        const labels = BUSINESS_DAYS.slice();
        const plan = BUSINESS_DAYS.map((day) => PLAN_CUMULATIVE[day] || 0);
        const realizedSwap = [];
        const realizedPrep = [];

        let cumT = 0;
        let cumP = 0;

        BUSINESS_DAYS.forEach((day) => {
            const row = stats.byDate[day];
            if (row) {
                cumT = row.cumT;
                cumP = row.cumP;
            }
            realizedSwap.push(day <= stats.referenceDate ? cumT : null);
            realizedPrep.push(day <= stats.referenceDate ? cumP : null);
        });

        return { labels, plan, realizedSwap, realizedPrep };
    }

    return {
        BUSINESS_DAYS,
        END_DATE,
        HOLIDAYS,
        MONTH_TARGET,
        PLAN_CUMULATIVE,
        RATE_WINDOW_DAYS,
        START_DATE,
        SWAP_START_DATE,
        TOTAL_MACHINES,
        addDays,
        brDate,
        buildAnalystRows,
        buildBurndownSeries,
        buildDailyRollup,
        buildDayRows,
        buildStats,
        businessDaysBetween,
        dayStatus,
        EMPTY_MANAGEMENT,
        hasDateDivergence,
        isBusinessDay,
        isPrepared,
        listBusinessDays,
        officialPrepDateKey,
        officialSwapDateKey,
        planForDay,
        sumRollup,
        toDateKey,
        todayKey
    };
})();
