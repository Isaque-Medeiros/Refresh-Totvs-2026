(function () {
    'use strict';

    /* Seed de metricas - TOTVS Field Refresh 2026.
     * Ajusta os tempos das 4 etapas dos registros existentes, em modo manual,
     * marcando como CONCLUIDO, com segundos quebrados sorteados dentro das
     * faixas configuradas. Nao cria registros novos; apenas edita os visiveis.
     * Rode na pagina do app (app/index.html), estando logado.
     */
    var CONFIG = {
        /* Faixas (em minutos) na ordem das 4 etapas do PROCESS_STEPS */
        rangesMinutes: [
            [45, 70],
            [30, 36],
            [20, 30],
            [15, 20]
        ],
        dryRun: false,
        analystFilter: null,
        onlyNotDone: false,
        avoidRoundMinutes: true,
        sync: true,
        reload: true
    };

    var STATE_KEY = 'TOTVS_REFRESH_2026_STATE_V3';

    /* Le um global (inclusive const de topo) pelo nome, sem quebrar se faltar. */
    function resolveGlobal(name) {
        try {
            return (0, eval)('typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined');
        } catch (error) {
            return undefined;
        }
    }

    function randSeconds(minSeconds, maxSeconds, avoidRoundMinutes) {
        var lo = Math.min(minSeconds, maxSeconds);
        var hi = Math.max(minSeconds, maxSeconds);
        var span = hi - lo + 1;
        var value = lo + Math.floor(Math.random() * span);
        if (avoidRoundMinutes) {
            var attempts = 0;
            while (value % 60 === 0 && attempts < 25) {
                value = lo + Math.floor(Math.random() * span);
                attempts += 1;
            }
        }
        return value;
    }

    function generateDurations(steps, rangesSeconds, avoidRoundMinutes) {
        var stepDurations = {};
        var total = 0;
        for (var index = 0; index < steps.length; index += 1) {
            var range = rangesSeconds[index] || rangesSeconds[rangesSeconds.length - 1];
            var value = randSeconds(range[0], range[1], avoidRoundMinutes);
            stepDurations[steps[index]] = value;
            total += value;
        }
        return { stepDurations: stepDurations, total: total };
    }

    function collectTargets(machines, options) {
        var filter = options || {};
        return machines.filter(function (machine) {
            if (filter.analystFilter && machine.analystId !== filter.analystFilter) {
                return false;
            }
            if (filter.onlyNotDone && machine.status === 'CONCLUIDO') {
                return false;
            }
            return true;
        });
    }

    function formatSeconds(value) {
        var total = Number(value || 0);
        var hrs = Math.floor(total / 3600);
        var mins = Math.floor((total % 3600) / 60);
        var secs = total % 60;
        return String(hrs).padStart(2, '0') + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    function patchMachine(machine, durations, actorId, momentIso) {
        machine.stepDurations = Object.assign({}, machine.stepDurations, durations.stepDurations);
        machine.totalElapsedSeconds = durations.total;
        machine.manualEntry = true;
        machine.manualEntryBy = actorId;
        machine.manualEntryAt = momentIso;
        machine.currentStep = 'CONCLUIDO';
        machine.currentStepIndex = Object.keys(durations.stepDurations).length;
        machine.status = 'CONCLUIDO';
        machine.timerRunning = false;
        machine.lastTickAt = null;
        machine.completedAt = machine.completedAt || momentIso;
        machine.preparedAt = machine.preparedAt || machine.completedAt || momentIso;
        machine.updatedAt = momentIso;
        if (!Array.isArray(machine.history)) {
            machine.history = [];
        }
        machine.history.unshift({
            action: 'machine_edited_manual',
            actorId: actorId,
            note: 'Tempos ajustados no lancamento manual',
            createdAt: momentIso
        });
        return machine;
    }

    function run() {
        var Storage = resolveGlobal('TOTVSStorage');
        var Sync = resolveGlobal('TOTVSGithubSync');
        var view = (typeof window !== 'undefined') ? window : {};

        if (!Storage || typeof Storage.loadState !== 'function' || typeof Storage.saveState !== 'function') {
            view.alert('Abra a pagina do sistema (app/index.html) e clique o bookmarklet nela.');
            return;
        }

        var state = Storage.loadState();
        var user = Storage.getCurrentUser(state);
        if (!user) {
            view.alert('Faca login no sistema antes de executar o bookmarklet.');
            return;
        }

        if (!Array.isArray(Storage.PROCESS_STEPS)) {
            view.alert('PROCESS_STEPS indisponivel. Recarregue a pagina do sistema e tente de novo.');
            return;
        }

        var steps = Storage.PROCESS_STEPS;
        var rangesSeconds = CONFIG.rangesMinutes.map(function (pair) {
            return [Math.round(pair[0] * 60), Math.round(pair[1] * 60)];
        });

        var visible = typeof Storage.getVisibleMachines === 'function'
            ? Storage.getVisibleMachines(state, user)
            : state.machines;
        var targets = collectTargets(visible, {
            analystFilter: CONFIG.analystFilter,
            onlyNotDone: CONFIG.onlyNotDone
        });

        if (!targets.length) {
            view.alert('Nenhum registro elegivel foi encontrado.');
            return;
        }

        var momentIso = new Date().toISOString();
        var plan = targets.map(function (machine) {
            return {
                machine: machine,
                durations: generateDurations(steps, rangesSeconds, CONFIG.avoidRoundMinutes)
            };
        });
        var preview = plan.map(function (item) {
            var row = { hostname: item.machine.hostname };
            steps.forEach(function (step, index) {
                row['fase' + (index + 1)] = formatSeconds(item.durations.stepDurations[step]);
            });
            row.total = formatSeconds(item.durations.total);
            return row;
        });

        if (view.console && view.console.table) {
            view.console.table(preview);
        }

        if (CONFIG.dryRun) {
            view.alert('[SIMULACAO] ' + targets.length + ' registros seriam ajustados.'
                + ' Nada foi salvo; veja a previa no console (F12).'
                + ' Coloque dryRun false para aplicar.');
            return;
        }

        var sample = preview[0];
        var message = 'Ajustar ' + targets.length + ' registros como lancamento manual'
            + ' e status CONCLUIDO?' + ' Exemplo ' + sample.hostname + ': '
            + sample.fase1 + ' / ' + sample.fase2 + ' / ' + sample.fase3 + ' / ' + sample.fase4;
        if (!view.confirm(message)) {
            return;
        }

        plan.forEach(function (item) {
            patchMachine(item.machine, item.durations, user.id, momentIso);
        });
        Storage.saveState(state);

        var canSync = CONFIG.sync && Sync && typeof Sync.syncNow === 'function'
            && typeof Sync.isConfigured === 'function' && Sync.isConfigured();

        var finish = function (syncMessage) {
            view.alert('Concluido: ' + targets.length + ' registros atualizados. ' + syncMessage);
            if (CONFIG.reload) {
                view.location.reload();
            }
        };

        if (canSync) {
            Promise.resolve(Sync.syncNow(state, user))
                .then(function () { finish('Sincronizado com o GitHub.'); })
                .catch(function () { finish('Salvo localmente, mas a sincronizacao falhou.'); });
        } else {
            finish('Salvo localmente (sincronizacao nao configurada).');
        }
    }

    var api = {
        CONFIG: CONFIG,
        STATE_KEY: STATE_KEY,
        collectTargets: collectTargets,
        formatSeconds: formatSeconds,
        generateDurations: generateDurations,
        patchMachine: patchMachine,
        randSeconds: randSeconds,
        resolveGlobal: resolveGlobal,
        run: run
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        run();
    }
})();
