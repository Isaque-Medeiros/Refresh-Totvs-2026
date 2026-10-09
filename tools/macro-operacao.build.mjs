import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, 'macro-operacao.bookmarklet.js');
const outputPath = path.join(here, 'macro-operacao.url.txt');

const source = readFileSync(sourcePath, 'utf8');

/* Remove comentarios de bloco e colapsa espacos/quebras de linha.
 * Seguro porque a fonte nao tem comentarios de linha (//), nao usa template
 * strings e nenhuma string literal tem dois espacos seguidos. */
const minified = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

if (minified.includes('/*') || minified.includes('*/')) {
    throw new Error('A minificacao deixou residuo de comentario. Revise a fonte.');
}

const lineComment = source.split(/\r?\n/).find((line) => /^\s*\/\//.test(line));
if (lineComment) {
    throw new Error('A fonte tem comentario de linha (//): ' + lineComment.trim());
}

/* Confere que a fonte e o resultado minificado compilam. */
new Function(source);
new Function(minified);

/* Sentinela: trechos com espaco interno precisam sobreviver intactos. */
const require = createRequire(import.meta.url);
const api = require(sourcePath);
const sentinels = [
    "'" + api.FALLBACK_STEPS[0] + "'",
    "'" + api.FALLBACK_STEPS[api.FALLBACK_STEPS.length - 1] + "'",
    "'Registro atualizado com sucesso.'"
];

sentinels.forEach((sentinela) => {
    if (!source.includes(sentinela) || !minified.includes(sentinela)) {
        throw new Error('Sentinela corrompida pela minificacao: ' + sentinela);
    }
});

const bookmarklet = 'javascript:' + minified;
writeFileSync(outputPath, bookmarklet + '\n', 'utf8');

console.log('Bookmarklet gerado: macro-operacao.url.txt');
console.log('Tamanho: ' + bookmarklet.length + ' caracteres');
