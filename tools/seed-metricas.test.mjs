import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const seed = require(path.join(here, 'seed-metricas.bookmarklet.js'));

const STEPS = [
    '1 FORMATAÇÃO E BIOS',
    '2 WINDOWS UPDATE',
    '3 ATIVAR ADM E SUBIR DRIVERS',
    '4 DOMINIO E ARGUS'
];
const RANGES = seed.CONFIG.rangesMinutes.map((pair) => [pair[0] * 60, pair[1] * 60]);
const GLOBAL_MIN = RANGES.reduce((sum, range) => sum + range[0], 0);
const GLOBAL_MAX = RANGES.reduce((sum, range) => sum + range[1], 0);
const NOW = '2026-10-08T20:00:00.000Z';

let passed = 0;
const lines = [];

function check(name, fn) {
    try {
        fn();
        passed += 1;
        lines.push('PASS  ' + name);
    } catch (error) {
        lines.push('FAIL  ' + name + ' -> ' + error.message);
        process.exitCode = 1;
    }
}

check('faixas mapeadas para segundos', () => {
    assert.deepEqual(RANGES, [[2700, 4200], [1800, 2160], [1200, 1800], [900, 1200]]);
});

check('randSeconds fica dentro da faixa e e inteiro', () => {
    RANGES.forEach((range) => {
        for (let i = 0; i < 3000; i += 1) {
            const value = seed.randSeconds(range[0], range[1], true);
            assert.ok(Number.isInteger(value), 'nao inteiro: ' + value);
            assert.ok(value >= range[0] && value <= range[1], 'fora da faixa: ' + value);
        }
    });
});

check('randSeconds evita minuto redondo quando pedido', () => {
    RANGES.forEach((range) => {
        for (let i = 0; i < 3000; i += 1) {
            const value = seed.randSeconds(range[0], range[1], true);
            assert.notEqual(value % 60, 0, 'caiu em minuto redondo: ' + value);
        }
    });
});

check('generateDurations cobre as 4 etapas e soma o total', () => {
    const result = seed.generateDurations(STEPS, RANGES, true);
    assert.deepEqual(Object.keys(result.stepDurations), STEPS);
    const sum = STEPS.reduce((acc, step) => acc + result.stepDurations[step], 0);
    assert.equal(result.total, sum);
});

check('generateDurations respeita as faixas de cada etapa', () => {
    for (let i = 0; i < 2000; i += 1) {
        const result = seed.generateDurations(STEPS, RANGES, true);
        STEPS.forEach((step, index) => {
            const value = result.stepDurations[step];
            assert.ok(value >= RANGES[index][0] && value <= RANGES[index][1], 'passo ' + index + ' fora: ' + value);
        });
        assert.ok(result.total >= GLOBAL_MIN && result.total <= GLOBAL_MAX, 'total fora: ' + result.total);
    }
});

check('collectTargets filtra por analista', () => {
    const machines = [
        { id: 'a', analystId: 'user_davi', status: 'CONCLUIDO' },
        { id: 'b', analystId: 'user_isaque', status: 'CONCLUIDO' },
        { id: 'c', analystId: 'user_davi', status: 'EM_ANDAMENTO' }
    ];
    const targets = seed.collectTargets(machines, { analystFilter: 'user_davi', onlyNotDone: false });
    assert.deepEqual(targets.map((m) => m.id), ['a', 'c']);
});

check('collectTargets pode pular os ja concluidos', () => {
    const machines = [
        { id: 'a', analystId: 'user_davi', status: 'CONCLUIDO' },
        { id: 'b', analystId: 'user_davi', status: 'EM_ANDAMENTO' }
    ];
    const targets = seed.collectTargets(machines, { analystFilter: null, onlyNotDone: true });
    assert.deepEqual(targets.map((m) => m.id), ['b']);
});

/* __TESTS_PART2__ */

check('patchMachine liga modo manual e concluido', () => {
    const machine = { id: 'x', hostname: 'SPON010132303', analystId: 'user_davi', status: 'EM_ANDAMENTO', stepDurations: {}, history: [], completedAt: null };
    const durations = seed.generateDurations(STEPS, RANGES, true);
    seed.patchMachine(machine, durations, 'user_davi', NOW);
    assert.equal(machine.manualEntry, true);
    assert.equal(machine.manualEntryBy, 'user_davi');
    assert.equal(machine.manualEntryAt, NOW);
    assert.equal(machine.status, 'CONCLUIDO');
    assert.equal(machine.currentStep, 'CONCLUIDO');
    assert.equal(machine.currentStepIndex, 4);
    assert.equal(machine.timerRunning, false);
    assert.equal(machine.lastTickAt, null);
    assert.equal(machine.totalElapsedSeconds, durations.total);
    assert.equal(machine.history[0].action, 'machine_edited_manual');
    assert.equal(machine.history[0].actorId, 'user_davi');
    assert.equal(machine.history[0].createdAt, NOW);
});

check('patchMachine preserva identidade, hostname e datas antigas', () => {
    const machine = {
        id: 'x', hostname: 'SPON010132303', analystId: 'user_davi', brand: 'HP',
        profile: 'Local', processDate: '2026-10-06', createdAt: '2026-10-06T10:00:00.000Z',
        stepDurations: {}, history: [], completedAt: '2026-10-06T12:00:00.000Z'
    };
    const durations = seed.generateDurations(STEPS, RANGES, true);
    seed.patchMachine(machine, durations, 'user_davi', NOW);
    assert.equal(machine.id, 'x');
    assert.equal(machine.hostname, 'SPON010132303');
    assert.equal(machine.analystId, 'user_davi');
    assert.equal(machine.brand, 'HP');
    assert.equal(machine.profile, 'Local');
    assert.equal(machine.processDate, '2026-10-06');
    assert.equal(machine.createdAt, '2026-10-06T10:00:00.000Z');
    assert.equal(machine.completedAt, '2026-10-06T12:00:00.000Z');
    assert.equal(machine.updatedAt, NOW);
});

check('patchMachine nao deixa regua com minuto redondo', () => {
    const machine = { id: 'x', hostname: 'H', analystId: 'u', status: 'EM_ANDAMENTO', stepDurations: {}, history: [] };
    const durations = seed.generateDurations(STEPS, RANGES, true);
    seed.patchMachine(machine, durations, 'u', NOW);
    Object.values(machine.stepDurations).forEach((value) => assert.notEqual(value % 60, 0, 'minuto redondo: ' + value));
});

check('fila cobre todos os 42 registros com total realista', () => {
    const machines = Array.from({ length: 42 }, (_, i) => ({
        id: 'nb_' + i,
        hostname: 'SPON0101323' + String(i).padStart(2, '0'),
        analystId: 'user_davi',
        status: 'EM_ANDAMENTO',
        stepDurations: {},
        history: []
    }));
    const targets = seed.collectTargets(machines, { analystFilter: null, onlyNotDone: false });
    assert.equal(targets.length, 42);
    const plan = targets.map((machine) => ({ machine, durations: seed.generateDurations(STEPS, RANGES, true) }));
    plan.forEach((item) => seed.patchMachine(item.machine, item.durations, 'user_davi', NOW));
    machines.forEach((machine) => {
        assert.equal(machine.manualEntry, true);
        assert.equal(machine.status, 'CONCLUIDO');
        assert.ok(machine.totalElapsedSeconds >= GLOBAL_MIN && machine.totalElapsedSeconds <= GLOBAL_MAX);
        STEPS.forEach((step, index) => {
            assert.ok(machine.stepDurations[step] >= RANGES[index][0] && machine.stepDurations[step] <= RANGES[index][1]);
        });
    });
});

check('formatSeconds formata HH:MM:SS', () => {
    assert.equal(seed.formatSeconds(2843), '00:47:23');
    assert.equal(seed.formatSeconds(3900), '01:05:00');
    assert.equal(seed.formatSeconds(900), '00:15:00');
    assert.equal(seed.formatSeconds(0), '00:00:00');
});

check('configuracao pronta para aplicar de verdade', () => {
    assert.equal(seed.CONFIG.dryRun, false);
    assert.equal(seed.CONFIG.avoidRoundMinutes, true);
    assert.equal(seed.CONFIG.rangesMinutes.length, 4);
});

console.log(lines.join('\n'));
console.log('\n' + passed + ' verificacoes passaram.');
if (process.exitCode) {
    console.log('Existem verificacoes com falha.');
}

