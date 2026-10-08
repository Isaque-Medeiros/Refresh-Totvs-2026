const TOTVSReports = (() => {
    function calculateMetrics(state, machines) {
        const total = machines.length;
        const doneList = machines.filter((machine) => machine.status === 'CONCLUIDO');
        const wipList = machines.filter((machine) => machine.status === 'EM_ANDAMENTO');
        const pausedList = machines.filter((machine) => machine.status === 'PAUSADO');
        const errorList = machines.filter((machine) => machine.hasError || machine.status === 'ERRO');

        const totalDoneTime = doneList.reduce((sum, machine) => sum + (machine.totalElapsedSeconds || 0), 0);
        const avgTimeSeconds = doneList.length ? Math.round(totalDoneTime / doneList.length) : 0;

        const stepAvgTimes = {};
        const stepAvgSeconds = {};
        TOTVSStorage.PROCESS_STEPS.forEach((step) => {
            const durations = machines
                .map((machine) => Number(machine.stepDurations[step] || 0))
                .filter((duration) => duration > 0);
            const avgSeconds = durations.length
                ? Math.round(durations.reduce((sum, item) => sum + item, 0) / durations.length)
                : 0;
            stepAvgSeconds[step] = avgSeconds;
            stepAvgTimes[step] = TOTVSImporterExporter.formatTimeFriendly(avgSeconds);
        });

        const analystStats = TOTVSStorage.getAnalystUsers(state).map((analyst) => {
            const analystMachines = machines.filter((machine) => machine.analystId === analyst.id);
            const analystDone = analystMachines.filter((machine) => machine.status === 'CONCLUIDO').length;
            const analystErrors = analystMachines.filter((machine) => machine.hasError || machine.status === 'ERRO').length;
            return {
                analystId: analyst.id,
                name: analyst.displayName,
                total: analystMachines.length,
                done: analystDone,
                wip: analystMachines.filter((machine) => machine.status === 'EM_ANDAMENTO').length,
                paused: analystMachines.filter((machine) => machine.status === 'PAUSADO').length,
                errors: analystErrors,
                goalPercent: TOTVSStorage.ANALYST_GOAL
                    ? ((analystDone / TOTVSStorage.ANALYST_GOAL) * 100).toFixed(1)
                    : '0.0'
            };
        });

        return {
            total,
            doneCount: doneList.length,
            wipCount: wipList.length,
            pausedCount: pausedList.length,
            errorCount: errorList.length,
            successRate: total ? (((total - errorList.length) / total) * 100).toFixed(0) : '100',
            globalPercent: TOTVSStorage.TOTAL_PROJECT_GOAL
                ? ((doneList.length / TOTVSStorage.TOTAL_PROJECT_GOAL) * 100).toFixed(1)
                : '0.0',
            avgTimeString: TOTVSImporterExporter.formatTimeFriendly(avgTimeSeconds),
            manualCount: machines.filter((machine) => machine.manualEntry).length,
            stepAvgTimes,
            stepAvgSeconds,
            analystStats,
            errorList
        };
    }

    function buildOverviewCards(metrics) {
        return [
            {
                title: 'Progresso da meta global',
                value: `${metrics.globalPercent}%`,
                sub: `${metrics.doneCount} de ${TOTVSStorage.TOTAL_PROJECT_GOAL} concluídas`
            },
            {
                title: 'Tempo médio total',
                value: metrics.avgTimeString,
                sub: 'Base nas máquinas concluídas'
            },
            {
                title: 'Taxa de eficiência',
                value: `${metrics.successRate}%`,
                sub: `${metrics.errorCount} registros com incidente`
            },
            {
                title: 'Pausadas',
                value: `${metrics.pausedCount}`,
                sub: 'Aguardando retomada'
            }
        ];
    }

    function renderAnalystCharts(state, machines, currentUser, analystId) {
        const container = document.getElementById('analystChartsContainer');
        if (!container) {
            return;
        }

        // Graficos por analista sao exclusivos do gerente.
        if (!currentUser || currentUser.role !== 'manager' || !analystId || analystId === 'ALL') {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = buildAnalystCharts(state, machines, analystId);
    }

    function renderReportsModal(state, machines, currentUser) {
        const metrics = calculateMetrics(state, machines);
        const isManager = currentUser && currentUser.role === 'manager';
        const visibleAnalystStats = isManager
            ? metrics.analystStats
            : metrics.analystStats.filter((stat) => stat.analystId === currentUser.id);
        const analystOptions = isManager
            ? [
                '<option value="ALL">Todos os analistas</option>',
                ...TOTVSStorage.getAnalystUsers(state).map((user) => `<option value="${user.id}">${user.displayName}</option>`)
            ]
            : [`<option value="${currentUser.id}">${currentUser.displayName}</option>`];
        const overviewGrid = document.getElementById('reportsOverviewGrid');
        const stepList = document.getElementById('repStepAvgTimeList');
        const analystCards = document.getElementById('analystsCardsContainer');
        const errorTableBody = document.getElementById('errorLogTableBody');
        const textPreview = document.getElementById('txtReportPreview');
        const analystSelect = document.getElementById('reportAnalystSelect');
        const generalCharts = document.getElementById('generalChartsContainer');
        const analystCharts = document.getElementById('analystChartsContainer');

        overviewGrid.innerHTML = buildOverviewCards(metrics).map((card) => `
            <article class="metric-box">
                <span class="metric-title">${card.title}</span>
                <strong class="metric-num">${card.value}</strong>
                <span class="kpi-sub">${card.sub}</span>
                <div class="burndown-bar-container">
                    <div class="burndown-bar" style="width: ${card.title === 'Tempo médio total' ? '100' : Math.min(parseFloat(card.value) || 0, 100)}%"></div>
                </div>
            </article>
        `).join('');

        stepList.innerHTML = TOTVSStorage.PROCESS_STEPS.map((step) => `
            <div class="metric-box">
                <span class="metric-title">${step}</span>
                <strong class="metric-num">${metrics.stepAvgTimes[step]}</strong>
                <span class="kpi-sub">Média da etapa considerando o lote visível</span>
            </div>
        `).join('');

        if (generalCharts) {
            generalCharts.innerHTML = isManager ? buildGeneralCharts(state, metrics) : '';
        }

        analystCards.innerHTML = visibleAnalystStats.map((stat) => `
            <article class="analyst-stat-card">
                <div class="analyst-card-title">${stat.name}</div>
                <div class="analyst-metric-row"><span>Total visível</span><strong>${stat.total}</strong></div>
                <div class="analyst-metric-row"><span>Concluídas</span><strong class="text-green">${stat.done}</strong></div>
                <div class="analyst-metric-row"><span>Em andamento</span><strong class="text-orange">${stat.wip}</strong></div>
                <div class="analyst-metric-row"><span>Pausadas</span><strong>${stat.paused}</strong></div>
                <div class="analyst-metric-row"><span>Incidentes</span><strong class="text-red">${stat.errors}</strong></div>
                <div class="analyst-metric-row"><span>Atingimento</span><strong>${stat.goalPercent}%</strong></div>
                <div class="kpi-progress"><div class="kpi-progress-bar bg-green" style="width:${Math.min(parseFloat(stat.goalPercent), 100)}%"></div></div>
            </article>
        `).join('');

        errorTableBody.innerHTML = metrics.errorList.length
            ? metrics.errorList.map((machine) => `
                <tr>
                    <td class="font-mono">${machine.hostname}</td>
                    <td>${TOTVSStorage.getAnalystName(state, machine.analystId)}</td>
                    <td>${machine.currentStep}</td>
                    <td>${machine.errorDetails ? (machine.errorDetails.description || 'Sem descrição') : 'Sem descrição'}</td>
                    <td>${machine.processDate || '--'}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Nenhum incidente registrado neste recorte.</td></tr>';

        analystSelect.innerHTML = analystOptions.join('');

        textPreview.value = TOTVSImporterExporter.exportToWhatsAppReport(state, machines, currentUser);

        if (analystCharts) {
            analystCharts.innerHTML = '';
        }

        return metrics;
    }

    function statusChartData(metrics) {
        return [
            { label: 'Concluidas', value: metrics.doneCount, className: 'is-done' },
            { label: 'Em andamento', value: metrics.wipCount, className: 'is-wip' },
            { label: 'Pausadas', value: metrics.pausedCount, className: 'is-paused' },
            { label: 'Incidentes', value: metrics.errorCount, className: 'is-error' },
            { label: 'Lancamento manual', value: metrics.manualCount, className: 'is-manual' }
        ];
    }

    function buildBarChart(title, rows, baseTotal) {
        const values = rows.map((row) => Number(row.value) || 0);
        const max = Math.max(baseTotal || 0, ...values, 1);

        const body = rows.map((row) => {
            const value = Number(row.value) || 0;
            const percent = (value / max) * 100;
            const share = baseTotal ? Math.round((value / baseTotal) * 100) : 0;
            return `
                <div class="chart-row">
                    <span class="chart-row-label">${row.label}</span>
                    <div class="chart-track">
                        <div class="chart-bar ${row.className || ''}" style="width:${percent.toFixed(2)}%"></div>
                    </div>
                    <span class="chart-row-value">${value}${baseTotal ? ` (${share}%)` : ''}</span>
                </div>
            `;
        }).join('');

        return `
            <section class="chart-block">
                <h4 class="chart-title">${title}</h4>
                ${body || '<p class="helper-text">Sem dados para exibir.</p>'}
            </section>
        `;
    }

    function buildGoalChart(title, done, goal) {
        const safeGoal = Number(goal) || 0;
        const percent = safeGoal ? Math.min(100, (done / safeGoal) * 100) : 0;
        return `
            <section class="chart-block">
                <h4 class="chart-title">${title}</h4>
                <div class="chart-goal-head">
                    <strong>${done}</strong><span> de ${safeGoal} maquinas</span>
                    <em>${percent.toFixed(1)}%</em>
                </div>
                <div class="chart-track chart-track-tall">
                    <div class="chart-bar is-goal" style="width:${percent.toFixed(2)}%"></div>
                </div>
            </section>
        `;
    }

    function buildStepChart(title, stepAvgSeconds) {
        const max = Math.max(...TOTVSStorage.PROCESS_STEPS.map((step) => Number(stepAvgSeconds[step] || 0)), 1);

        const rows = TOTVSStorage.PROCESS_STEPS.map((step) => {
            const seconds = Number(stepAvgSeconds[step] || 0);
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

        return `
            <section class="chart-block">
                <h4 class="chart-title">${title}</h4>
                ${rows}
            </section>
        `;
    }

    function buildAnalystComparisonChart(metrics) {
        const goal = Number(TOTVSStorage.ANALYST_GOAL) || 0;
        const rows = metrics.analystStats.map((stat) => {
            const percent = goal ? Math.min(100, (stat.done / goal) * 100) : 0;
            return `
                <div class="chart-row">
                    <span class="chart-row-label">${stat.name}</span>
                    <div class="chart-track">
                        <div class="chart-bar is-analyst" style="width:${percent.toFixed(2)}%"></div>
                    </div>
                    <span class="chart-row-value">${stat.done}/${goal} &middot; ${stat.total} reg.</span>
                </div>
            `;
        }).join('');

        return `
            <section class="chart-block">
                <h4 class="chart-title">Atingimento da meta por analista</h4>
                ${rows || '<p class="helper-text">Sem analistas cadastrados.</p>'}
            </section>
        `;
    }

    function buildGeneralCharts(state, metrics) {
        return `
            <div class="charts-grid">
                ${buildGoalChart('Progresso da meta global', metrics.doneCount, TOTVSStorage.TOTAL_PROJECT_GOAL)}
                ${buildBarChart('Distribuicao por status', statusChartData(metrics), metrics.total)}
                ${buildStepChart('Tempo medio por etapa', metrics.stepAvgSeconds)}
                ${buildAnalystComparisonChart(metrics)}
            </div>
        `;
    }

    function buildAnalystCharts(state, machines, analystId) {
        const analyst = TOTVSStorage.getUserById(state, analystId);
        const scoped = machines.filter((machine) => machine.analystId === analystId);
        const metrics = calculateMetrics(state, scoped);

        return `
            <div class="charts-grid">
                ${buildGoalChart(`Meta de ${analyst ? analyst.displayName : 'analista'}`, metrics.doneCount, TOTVSStorage.ANALYST_GOAL)}
                ${buildBarChart('Distribuicao por status', statusChartData(metrics), metrics.total)}
                ${buildStepChart('Tempo medio por etapa', metrics.stepAvgSeconds)}
            </div>
        `;
    }

    function buildPrintableGeneralCharts(state, metrics) {
        const dataset = TOTVSStorage.getDatasetById(state, state.activeDatasetId);
        return `
            <article class="print-report">
                <h1>Graficos Gerais - TOTVS Field Refresh 2026</h1>
                <h3>${state.organization.signature}</h3>
                <p>Lote: ${dataset ? dataset.name : 'Operacao Principal'} | Emitido em ${new Date().toLocaleString('pt-BR')}</p>
                ${buildGeneralCharts(state, metrics)}
            </article>
        `;
    }

    function buildPrintableAnalystCharts(state, machines, analystId) {
        const analyst = TOTVSStorage.getUserById(state, analystId);
        return `
            <article class="print-report">
                <h1>Graficos por Analista - TOTVS Field Refresh 2026</h1>
                <h3>${analyst ? analyst.displayName : 'Analista'}</h3>
                <p>Emitido em ${new Date().toLocaleString('pt-BR')}</p>
                ${buildAnalystCharts(state, machines, analystId)}
            </article>
        `;
    }

    function buildPrintableGeneralReport(state, metrics, machines) {
        const dataset = TOTVSStorage.getDatasetById(state, state.activeDatasetId);
        return `
            <article class="print-report">
                <h1>TOTVS Field Refresh 2026</h1>
                <h3>${state.organization.signature}</h3>
                <p>Lote: ${dataset ? dataset.name : 'Operação Principal'} | Emitido em ${new Date().toLocaleString('pt-BR')}</p>
                <section class="print-grid">
                    <div class="print-card"><strong>Total</strong><div>${metrics.total}</div></div>
                    <div class="print-card"><strong>Concluídas</strong><div>${metrics.doneCount}</div></div>
                    <div class="print-card"><strong>Em andamento</strong><div>${metrics.wipCount}</div></div>
                    <div class="print-card"><strong>Incidentes</strong><div>${metrics.errorCount}</div></div>
                </section>
                ${buildGeneralCharts(state, metrics)}
                <h2>Média por etapa</h2>
                <table>
                    <thead>
                        <tr><th>Etapa</th><th>Média</th></tr>
                    </thead>
                    <tbody>
                        ${TOTVSStorage.PROCESS_STEPS.map((step) => `<tr><td>${step}</td><td>${metrics.stepAvgTimes[step]}</td></tr>`).join('')}
                    </tbody>
                </table>
                <h2>Resumo de máquinas</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Hostname</th>
                            <th>Analista</th>
                            <th>Etapa</th>
                            <th>Status</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${machines.map((machine) => `
                            <tr>
                                <td>${machine.processDate || '--'}</td>
                                <td>${machine.hostname}</td>
                                <td>${TOTVSStorage.getAnalystName(state, machine.analystId)}</td>
                                <td>${machine.currentStep}</td>
                                <td>${machine.status}</td>
                                <td>${TOTVSImporterExporter.formatTimeFriendly(machine.totalElapsedSeconds)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </article>
        `;
    }

    function buildPrintableAnalystReport(state, machines, analystId) {
        const analyst = TOTVSStorage.getUserById(state, analystId);
        const analystMachines = machines.filter((machine) => machine.analystId === analystId);
        const metrics = calculateMetrics(state, analystMachines);
        return `
            <article class="print-report">
                <h1>Relatório Individual</h1>
                <h3>${analyst ? analyst.displayName : 'Analista'}</h3>
                <p>Emitido em ${new Date().toLocaleString('pt-BR')}</p>
                <section class="print-grid">
                    <div class="print-card"><strong>Total</strong><div>${metrics.total}</div></div>
                    <div class="print-card"><strong>Concluídas</strong><div>${metrics.doneCount}</div></div>
                    <div class="print-card"><strong>Em andamento</strong><div>${metrics.wipCount}</div></div>
                    <div class="print-card"><strong>Incidentes</strong><div>${metrics.errorCount}</div></div>
                </section>
                ${buildAnalystCharts(state, machines, analystId)}
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Hostname</th>
                            <th>Etapa</th>
                            <th>Status</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analystMachines.map((machine) => `
                            <tr>
                                <td>${machine.processDate || '--'}</td>
                                <td>${machine.hostname}</td>
                                <td>${machine.currentStep}</td>
                                <td>${machine.status}</td>
                                <td>${TOTVSImporterExporter.formatTimeFriendly(machine.totalElapsedSeconds)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </article>
        `;
    }

    return {
        buildAnalystCharts,
        buildGeneralCharts,
        buildPrintableAnalystCharts,
        buildPrintableAnalystReport,
        buildPrintableGeneralCharts,
        buildPrintableGeneralReport,
        calculateMetrics,
        renderAnalystCharts,
        renderReportsModal
    };
})();
