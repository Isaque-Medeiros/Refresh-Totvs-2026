import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, 'seed-metricas.bookmarklet.js');
const outputPath = path.join(here, 'seed-metricas.url.txt');

const source = readFileSync(sourcePath, 'utf8');

/* Remove comentarios de bloco e colapsa espacos/quebras de linha.
 * Seguro porque a fonte nao tem comentarios de linha (//) nem "/*" dentro de strings. */
const minified = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

if (minified.includes('/*') || minified.includes('*/')) {
    throw new Error('A minificacao deixou residuo de comentario. Revise a fonte.');
}

const bookmarklet = 'javascript:' + minified;
writeFileSync(outputPath, bookmarklet + '\n', 'utf8');

console.log('Bookmarklet gerado: seed-metricas.url.txt');
console.log('Tamanho: ' + bookmarklet.length + ' caracteres');
