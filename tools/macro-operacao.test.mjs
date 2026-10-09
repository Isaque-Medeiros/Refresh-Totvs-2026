import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const macro = require(path.join(here, 'macro-operacao.bookmarklet.js'));

const appRoot = path.join(here, '..', 'app');
const appHtml = readFileSync(path.join(appRoot, 'index.html'), 'utf8');
const appJs = readFileSync(path.join(appRoot, 'js', 'app.js'), 'utf8');
const storageJs = readFileSync(path.join(appRoot, 'js', 'storage.js'), 'utf8');

const STEPS = macro.FALLBACK_STEPS;
const RANGES = macro.rangesSeconds(macro.CONFIG.rangesMinutes);
const GLOBAL_MIN = RANGES.reduce((sum, range) => sum + range[0], 0);
const GLOBAL_MAX = RANGES.reduce((sum, range) => sum + range[1], 0);

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

check('etapas do app batem com o bookmarklet', () => {
    const processBlock = storageJs.match(/const PROCESS_STEPS = \[([\s\S]*?)\];/);
    assert.ok(processBlock, 'PROCESS_STEPS nao encontrado em storage.js');
    const steps = Array.from(processBlock[1].matchAll(/'([^']+)'/g)).map((match) => match[1]);
    assert.deepEqual(steps, STEPS);

    const manualBlock = appJs.match(/const MANUAL_STEP_INPUTS = \[([\s\S]*?)\];/);
    assert.ok(manualBlock, 'MANUAL_STEP_INPUTS nao encontrado em app.js');
    const entries = Array.from(manualBlock[1].matchAll(/\{ input: '([^']+)', step: '([^']+)' \}/g))
        .map((match) => ({ input: match[1], step: match[2] }));

    assert.deepEqual(entries.map((entry) => entry.input), macro.SELECTORS.manualStepInputs);
    assert.deepEqual(entries.map((entry) => entry.step), STEPS);
});

check('ids e ganchos do bookmarklet existem na tela do app', () => {
    const hooks = [
        ['data-action="edit" data-machine-id=', 'botao editar da linha'],
        ['data-total-timer=', 'total do registro na linha'],
        ['class="badge', 'selo de status'],
        ['<td class="font-mono">', 'celula do hostname']
    ];
    hooks.forEach((hook) => {
        assert.ok(appJs.includes(hook[0]), 'gancho ausente em app.js (' + hook[1] + '): ' + hook[0]);
    });

    Object.keys(macro.SELECTORS).forEach((key) => {
        const value = macro.SELECTORS[key];
        if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(value)) {
            return;
        }
        assert.ok(appHtml.includes('id="' + value + '"'), 'id ausente em index.html: ' + value);
    });
});

check('faixas mapeadas para segundos', () => {
    assert.deepEqual(RANGES, [[2700, 4200], [1800, 2160], [1200, 1800], [900, 1200]]);
});

check('randSeconds fica dentro da faixa e e inteiro', () => {
    RANGES.forEach((range) => {
        for (let i = 0; i < 3000; i += 1) {
            const value = macro.randSeconds(range[0], range[1], true);
            assert.ok(Number.isInteger(value), 'nao inteiro: ' + value);
            assert.ok(value >= range[0] && value <= range[1], 'fora da faixa: ' + value);
        }
    });
});

check('randSeconds evita minuto redondo quando pedido', () => {
    RANGES.forEach((range) => {
        for (let i = 0; i < 3000; i += 1) {
            assert.notEqual(macro.randSeconds(range[0], range[1], true) % 60, 0);
        }
    });
});

check('minutos fracionados voltam como os mesmos segundos no app', () => {
    for (let i = 0; i < 6000; i += 1) {
        const seconds = macro.randSeconds(GLOBAL_MIN, GLOBAL_MAX, true);
        const text = macro.secondsToMinutesInput(seconds);
        assert.match(text, /^[0-9]+(\.[0-9]+)?$/, 'texto invalido: ' + text);
        assert.equal(macro.minutesInputToSeconds(text), seconds, 'round-trip em ' + seconds);
    }
});

check('generateDurations cobre as 4 etapas, respeita faixas e soma o total', () => {
    for (let i = 0; i < 2000; i += 1) {
        const result = macro.generateDurations(STEPS, RANGES, true);
        assert.deepEqual(Object.keys(result.stepDurations), STEPS);
        const sum = STEPS.reduce((acc, step) => acc + result.stepDurations[step], 0);
        assert.equal(result.total, sum);
        assert.ok(result.total >= GLOBAL_MIN && result.total <= GLOBAL_MAX, 'total fora: ' + result.total);
        STEPS.forEach((step, index) => {
            const value = result.stepDurations[step];
            assert.ok(value >= RANGES[index][0] && value <= RANGES[index][1], 'etapa ' + index + ' fora: ' + value);
            assert.notEqual(value % 60, 0, 'minuto redondo na etapa ' + index + ': ' + value);
        });
        assert.notEqual(result.total % 60, 0, 'minuto redondo no total: ' + result.total);
    }
});

check('formatSeconds formata HH:MM:SS', () => {
    assert.equal(macro.formatSeconds(2843), '00:47:23');
    assert.equal(macro.formatSeconds(3900), '01:05:00');
    assert.equal(macro.formatSeconds(900), '00:15:00');
    assert.equal(macro.formatSeconds(0), '00:00:00');
});

check('parseQueueLine aceita SPON simples e com extras', () => {
    assert.deepEqual(macro.parseQueueLine('spon010132303'), {
        hostname: 'SPON010132303', brand: '', profile: '', analystId: ''
    });
    assert.deepEqual(macro.parseQueueLine('SPON010132303;Dell;Local;user_davi'), {
        hostname: 'SPON010132303', brand: 'Dell', profile: 'Local', analystId: 'user_davi'
    });
    assert.equal(macro.parseQueueLine('   '), null);
});

check('parseQueue deduplica, ignora vazios e aceita objetos', () => {
    const list = macro.parseQueue('SPON010132303\n\nspon010132303\nSPON010132304;HP;Local');
    assert.deepEqual(list.map((item) => item.hostname), ['SPON010132303', 'SPON010132304']);
    assert.equal(list[1].brand, 'HP');
    assert.equal(list[1].profile, 'Local');

    const fromObjects = macro.parseQueue([
        { hostname: 'SPON010132305', brand: 'Lenovo' },
        { spon: 'SPON010132306' }
    ]);
    assert.deepEqual(fromObjects.map((item) => item.hostname), ['SPON010132305', 'SPON010132306']);
    assert.equal(fromObjects[0].brand, 'Lenovo');
});

check('isDoneRow reconhece concluido e trocada', () => {
    assert.equal(macro.isDoneRow({ rowCompleted: true, statusText: 'Parcial' }), true);
    assert.equal(macro.isDoneRow({ id: 'a', statusText: 'Concluido' }), true);
    assert.equal(macro.isDoneRow({ id: 'a', status: 'CONCLUIDO' }), true);
    assert.equal(macro.isDoneRow({ id: 'a', statusText: 'Trocada' }), true);
    assert.equal(macro.isDoneRow({ id: 'a', statusText: 'Em andamento' }), false);
    assert.equal(macro.isDoneRow({ id: 'a', statusText: 'Pausado' }), false);
    assert.equal(macro.isDoneRow(null), false);
});

check('pickQueue filtra por SPON, pula concluidos, ordena e corta', () => {
    const rows = [
        { id: '1', hostname: 'SPON010132304', statusText: 'Em andamento' },
        { id: '2', hostname: 'SPON010132303', statusText: 'Concluido' },
        { id: '3', hostname: 'SPON010132305', statusText: 'Em andamento' },
        { id: '4', hostname: 'SPON010132306', statusText: 'Em andamento' }
    ];

    const sponOnly = macro.pickQueue(rows, {
        sponList: ['SPON010132303', 'SPON010132305'], order: 'hostname', maxItems: 60
    });
    assert.deepEqual(sponOnly.map((item) => item.id), ['2', '3']);

    const notDone = macro.pickQueue(rows, { order: 'hostname', onlyNotDone: true });
    assert.deepEqual(notDone.map((item) => item.hostname), [
        'SPON010132304', 'SPON010132305', 'SPON010132306'
    ]);

    const limited = macro.pickQueue(rows, { order: 'hostname-desc', maxItems: 2 });
    assert.deepEqual(limited.map((item) => item.id), ['4', '3']);

    assert.deepEqual(macro.pickQueue(rows, { analystFilter: 'user_davi' }), []);
});

check('fila de 42 registros fica realista e sem minuto redondo', () => {
    const plan = Array.from({ length: 42 }, (_, index) => ({
        hostname: 'SPON0101323' + String(index).padStart(2, '0'),
        durations: macro.generateDurations(STEPS, RANGES, macro.CONFIG.avoidRoundMinutes)
    }));

    plan.forEach((item) => {
        const oQueOAppVaiLer = {};
        Object.keys(item.durations.stepDurations).forEach((step) => {
            const text = macro.secondsToMinutesInput(item.durations.stepDurations[step]);
            oQueOAppVaiLer[step] = macro.minutesInputToSeconds(text);
            assert.equal(oQueOAppVaiLer[step], item.durations.stepDurations[step]);
            assert.notEqual(oQueOAppVaiLer[step] % 60, 0);
        });
        const total = STEPS.reduce((sum, step) => sum + oQueOAppVaiLer[step], 0);
        assert.equal(total, item.durations.total);
        assert.ok(total >= GLOBAL_MIN && total <= GLOBAL_MAX);
        assert.match(macro.formatSeconds(total), /^\d{2}:\d{2}:(0[1-9]|[1-5][0-9])$/);
    });
});

check('CONFIG esta pronto para aplicar de verdade', () => {
    assert.equal(macro.CONFIG.dryRun, false);
    assert.equal(macro.CONFIG.mode, 'ambos');
    assert.equal(macro.CONFIG.avoidRoundMinutes, true);
    assert.equal(macro.CONFIG.askQueue, true);
    assert.equal(macro.CONFIG.rangesMinutes.length, STEPS.length);
    assert.ok(macro.CONFIG.delayRangeMs[0] > 0);
    assert.ok(macro.CONFIG.delayRangeMs[1] >= macro.CONFIG.delayRangeMs[0]);
    assert.ok(macro.CONFIG.timeoutMs >= 1000);
    assert.ok(macro.CONFIG.maxItems > 0);
    assert.equal(macro.CONFIG.registerDefaults.step, STEPS[0]);
    assert.equal(macro.CONFIG.registerDefaults.autoStart, false);
});

check('build gerado compila e nao tem residuo', () => {
    const url = readFileSync(path.join(here, 'macro-operacao.url.txt'), 'utf8').trim();
    assert.ok(url.indexOf('javascript:') === 0, 'sem prefixo javascript:');
    const code = url.slice('javascript:'.length);
    assert.ok(code.indexOf('/*') === -1 && code.indexOf('*/') === -1, 'residuo de comentario');
    new Function(code);
    STEPS.forEach((step) => {
        assert.ok(code.includes("'" + step + "'"), 'etapa perdida no build: ' + step);
    });

    /* Toda string literal da fonte precisa sobreviver intacta (a minificacao
     * colapsa espacos; se uma string tiver dois espacos, ela seria corrompida). */
    const source = readFileSync(path.join(here, 'macro-operacao.bookmarklet.js'), 'utf8');
    const literals = Array.from(source.matchAll(/'((?:[^'\\]|\\.)*)'/g))
        .map((match) => match[1])
        .filter((text) => text.trim() !== '');
    assert.ok(literals.length > 250, 'poucas strings encontradas: ' + literals.length);
    literals.forEach((literal) => {
        assert.ok(code.includes("'" + literal + "'"), 'string corrompida no build: ' + literal);
    });
});

console.log(lines.join('\n'));
console.log('\n' + passed + ' verificacoes passaram.');
if (process.exitCode) {
    console.log('Existem verificacoes com falha.');
}
