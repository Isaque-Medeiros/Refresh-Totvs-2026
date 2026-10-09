# Seed de métricas — bookmarklet

Ferramenta de apoio para **semear dados de teste/homologação**. Ela pega os
registros que **já existem** na fila e regrava os tempos das 4 etapas como
**lançamento manual**, com **segundos quebrados** sorteados dentro das faixas
configuradas, marcando cada registro como **CONCLUIDO**.

> Não cria registros novos. Não apaga nada. Só edita os registros visíveis para
> quem está logado (o analista vê só os dele; o gerente vê o lote inteiro).

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `seed-metricas.bookmarklet.js` | Fonte legível. É aqui que você mexe na configuração |
| `seed-metricas.url.txt` | O bookmarklet pronto (`javascript:(...)`) — gerado pelo build |
| `seed-metricas.build.mjs` | Gera o `.url.txt` a partir do `.js` |
| `seed-metricas.test.mjs` | Testes da lógica pura (faixas, segundos quebrados, total, fila) |

## Como usar

1. Gere o bookmarklet depois de qualquer mudança no `.js`:

   ```powershell
   node OO\tools\seed-metricas.build.mjs
   ```

2. Copie o conteúdo de `seed-metricas.url.txt` e crie um favorito no navegador
   com esse texto no campo de URL (nome sugerido: `Seed métricas`).
3. Abra o app (`app/index.html`), faça login e clique no favorito.
4. Ao clicar, ele mostra um `console.table` com a prévia dos tempos e pede
   confirmação. Confirmando, aplica em todos os registros, salva, sincroniza
   (se o GitHub estiver configurado) e recarrega a página.
5. Para ensaiar sem salvar nada, mude `dryRun` para `true` na fonte, rode
   `node OO\tools\seed-metricas.build.mjs` e clique de novo: aí ele apenas
   mostra a prévia e não clica em nada.

## Configuração

```js
var CONFIG = {
    rangesMinutes: [      // faixas em minutos, na ordem das 4 etapas do PROCESS_STEPS
        [45, 70],         // 1 FORMATAÇÃO E BIOS ......... 2700–4200s
        [30, 36],         // 2 WINDOWS UPDATE ............ 1800–2160s
        [20, 30],         // 3 ATIVAR ADM E SUBIR DRIVERS . 1200–1800s
        [15, 20]          // 4 DOMINIO E ARGUS ...........  900–1200s
    ],
    dryRun: false,            // false = aplica de verdade (pede confirmação); true = só prévia
    analystFilter: null,      // null = todos visíveis; ou 'user_davi', etc.
    onlyNotDone: false,       // true = pula os que já estão CONCLUIDO
    avoidRoundMinutes: true,  // sorteia de novo se cair em :00 (segundos quebrados)
    sync: true,               // envia para o GitHub ao final, se configurado
    reload: true              // recarrega a página ao final
};
```

O total do registro é sempre a **soma das 4 etapas** e o status final é
`CONCLUIDO` (`currentStepIndex = 4`, `timerRunning = false`).

## O que é gravado em cada registro

- `stepDurations` (4 etapas) e `totalElapsedSeconds` recalculado;
- `manualEntry: true`, `manualEntryBy`, `manualEntryAt`;
- `status: 'CONCLUIDO'`, `currentStep`, `currentStepIndex`, `timerRunning: false`;
- um item novo no `history` (`machine_edited_manual`);
- `updatedAt` com o horário atual → **vence o merge** do GitHub;
- campos de identidade (`id`, `hostname`, `analystId`, `brand`, `processDate`,
  `createdAt`, `completedAt` etc.) são **preservados**.

## Testes

```powershell
node OO\tools\seed-metricas.test.mjs
```

Cobre: faixas por etapa, valor inteiro dentro da faixa, ausência de minuto
redondo, cobertura das 4 etapas, soma do total, filtro por analista e por
status, preservação de identidade e formatação `HH:MM:SS`.
