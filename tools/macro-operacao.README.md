# Macro de operação (fila SPON) — bookmarklet

Ferramenta de apoio para **homologar a operação de ponta a ponta**: ela cadastra
os hostnames SPON e depois edita cada registro **1 por 1, clicando de verdade na
tela do app** — status **CONCLUIDO**, **lançamento manual** ligado e as 4 etapas
com **tempos sorteados de segundos quebrados** dentro das faixas configuradas.

> Nada é escrito direto no `localStorage`: tudo passa pelo formulário do app
> (`submit` de `#machineForm`), exatamente como um humano faria. Por isso o app
> registra histórico, `manualEntry`, `completedAt` e sincroniza o GitHub igual.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `macro-operacao.bookmarklet.js` | Fonte legível. É aqui que você mexe na configuração |
| `macro-operacao.url.txt` | O bookmarklet pronto (`javascript:(...)`) — gerado pelo build |
| `macro-operacao.build.mjs` | Gera o `.url.txt` a partir do `.js` (minifica e valida) |
| `macro-operacao.test.mjs` | Testes: etapas/ids do app, faixas, segundos quebrados, fila |

## Como usar

1. Gere o bookmarklet depois de qualquer mudança no `.js`:

   ```powershell
   node OO\tools\macro-operacao.build.mjs
   ```

2. Copie o conteúdo de `macro-operacao.url.txt` e crie um favorito no navegador
   com esse texto no campo de URL (nome sugerido: `Macro fila SPON`).
3. Abra o app (`app/index.html`), **faça login** e clique no favorito.
4. Ele abre um `prompt` pedindo os hostnames, **um por linha** (formato
   `SPON010132303` ou `SPON010132303;Dell;Local;user_davi`). Deixe vazio para
   rodar só a edição do que já está na tela.
5. Confira o resumo/preview e confirme. Aparece o painel no canto inferior
   direito com **Pausar / Parar / Copiar log**; no fim ele mostra o relatório e
   sincroniza com o GitHub (se estiver configurado).

## O que ele faz em cada fase

| Fase | O que acontece |
|---|---|
| 1. Cadastro | Para cada hostname: limpa o formulário, digita o hostname, escolhe analista/fabricante/perfil/etapa e envia. O sucesso é confirmado quando o campo de hostnames esvazia; se vier aviso de recusa, só esse item falha e a fila continua |
| 2. Edição | Tira um **snapshot** da tabela (id + hostname, na ordem do DOM) e depois, para cada linha: clica em **Editar**, espera `#editMachineId` virar aquele id, marca a etapa como **CONCLUIDO**, liga o **lançamento manual**, digita os 4 tempos (minutos fracionados) e envia |
| 3. Conferência | Lê o estado salvo e confere `totalElapsedSeconds`, `currentStep` e `status` de cada registro editado, item por item no log e no relatório final |
| 4. Acabamento | Sincroniza com o GitHub (se configurado) e, se `reload: true`, recarrega a página |

A tabela se reordena por `updatedAt` a cada gravação; é justamente por isso que a
fila de edição é fixada **antes** do primeiro clique e a edição segue por `id`.

## Garantias

- Cada etapa fica **dentro da sua faixa**, em segundos inteiros.
- **Sem minuto redondo**: se o sorteio cair em `:00`, ele é refeito — vale para
  cada etapa e também para o **total** (`00:47:23`, nunca `00:47:00`).
- O total é a **soma das 4 etapas** e bate com o rótulo do formulário
  (`#manualTotalLabel`) antes do envio; se não bater, ele redispara os eventos.
- Como o campo manual do app só aceita minutos (`step="1"`), o macro troca para
  `step='any'` em runtime e escreve `45.25` (= 2715s); o app reconverte com
  `Math.round(minutos * 60)`, devolvendo exatamente os segundos sorteados.
- O cadastro **não dispara cronômetro** (`registerDefaults.autoStart: false`): o
  registro nasce **PAUSADO**, sem tempo inventado, e a edição grava o tempo manual.
- Uma etapa com falha não derruba a fila: o item é registrado no relatório e a
  macro segue para o próximo (o log mostra o motivo).

## Painel (HUD)

Fica fixo no canto inferior direito, com fase atual, item `n/total`, barra de
progresso, log colorido e três botões:

| Controle | Efeito |
|---|---|
| **Pausar / Continuar** | Congela a fila entre um item e outro (nada é clicado enquanto pausado) |
| **Parar** | Encerra ao terminar o item atual e mostra o relatório do que já foi feito |
| **Copiar log** | Copia o log inteiro para a área de transferência |
| **Esc** | Mesmo efeito do botão **Parar** |

## Configuração

```js
var CONFIG = {
    rangesMinutes: [          // faixas em minutos, na ordem das 4 etapas
        [45, 70],             // 1 FORMATAÇÃO E BIOS .......... 2700–4200s
        [30, 36],             // 2 WINDOWS UPDATE ............. 1800–2160s
        [20, 30],             // 3 ATIVAR ADM E SUBIR DRIVERS ... 1200–1800s
        [15, 20]              // 4 DOMINIO E ARGUS ............  900–1200s
    ],
    mode: 'ambos',            // 'registrar' | 'editar' | 'ambos'
    registerQueue: [],        // vazio = pergunta no prompt (um por linha)
    askQueue: true,           // false = nunca pergunta; usa só registerQueue
    registerDefaults: {
        brand: '',            // vazio = mantém o que já está no formulário
        profile: '',
        processDate: '',      // vazio = hoje
        step: '1 FORMATAÇÃO E BIOS',
        autoStart: false,     // não liga o cronômetro no cadastro
        notes: ''
    },
    analystFilter: null,      // só no cadastro: 'user_davi', etc. (edição segue a tela)
    sponList: [],             // edita só estes SPONs (vazio = todos os visíveis)
    order: 'tela',            // 'tela' (ordem atual do DOM) | 'hostname' | 'hostname-desc'
    onlyNotDone: false,       // true = pula quem já está Concluido/Trocada
    avoidRoundMinutes: true,  // refaz o sorteio que cair em minuto cheio
    delayRangeMs: [350, 900], // pausa aleatória entre ações (parece humano)
    timeoutMs: 6000,          // tempo máximo esperando a tela responder
    pollMs: 60,               // intervalo da espera acima
    maxItems: 60,             // teto de registros editados por rodada
    dryRun: false,            // true = só prévia no console, não clica em nada
    finalSync: true,          // sincroniza com o GitHub no fim, se configurado
    reload: false             // recarrega a página no fim
};
```

Depois de mexer no CONFIG, **rode o build de novo** — o favorito é um retrato do
arquivo `.js` no momento em que foi copiado.

## Limites e cuidados

- O app **não foi alterado**: o `step='any'` dos campos manuais é aplicado em
  runtime pelo próprio bookmarklet.
- `maxItems` existe para você dosar a rodada (a fila de edição é a tabela
  visível, que respeita os filtros da tela).
- `dryRun: true` mostra `console.table` com tempos de exemplo e não toca na tela.
- O relatório final lista as falhas (`hostname (motivo)`), separadas entre
  cadastro e edição, e informa quantos registros foram conferidos no estado salvo.

## Solução de problemas

| Sintoma | Causa provável / o que fazer |
|---|---|
| `Abra a pagina do sistema (app/index.html)...` | Você clicou o favorito fora do app, ou o `app.js` não carregou nessa página |
| `Faca login no sistema antes de rodar o bookmarklet.` | Sessão expirada: faça login e clique de novo |
| `Fila vazia: preencha CONFIG.registerQueue...` | Sem hostnames para cadastrar e sem linhas editáveis visíveis na tabela |
| `linha/botao Editar nao esta na tabela agora` | A linha saiu do filtro da tela no meio da rodada (ex.: filtro que esconde Concluido). Limpe os filtros ou use `order`/`sponList` |
| `recusado pelo app: ...` | O próprio app recusou aquele item (duplicado/validação). A fila continua nos outros |
| `tempo esgotado esperando ...` | A tela demorou mais que `timeoutMs`; aumente para 10000 e rode de novo |
| O teste `macro-operacao.test.mjs` falha em "ids e ganchos..." | Um `id` mudou no `app/index.html` ou no `app.js`; atualize `SELECTORS` |
| Nada acontece ao clicar | O favorito perdeu o prefixo `javascript:`; cole novamente o conteúdo de `macro-operacao.url.txt` |

## Validação

```powershell
node OO\tools\macro-operacao.build.mjs      # gera macro-operacao.url.txt
node OO\tools\macro-operacao.test.mjs       # 15 verificações da lógica + ids do app
node OO\tools\seed-metricas.test.mjs        # 13 verificações da ferramenta irmã
powershell -ExecutionPolicy Bypass -File OO\tools\validate.ps1
```

## Relacionado

`seed-metricas.bookmarklet.js` é a ferramenta irmã: ela edita os registros
**direto no estado salvo** (sem clicar na tela), ótima para semear volume rápido.
Esta macro é a que **reproduz a operação real**, usando o formulário e a tabela do
app — inclusive disparando o histórico e o fluxo de sincronização normais.


