# TOTVS Field Refresh 2026

**DB4 Serv for Totvs by Isaque de Medeiros**

Sistema estatico de gestao de bancada Field Service em tempo real: o gerente de
projeto acompanha todas as maquinas, processos e quem esta em cada etapa, e cada
analista opera a propria fila. Os dados ficam salvos no proprio repositorio do
GitHub, com sincronizacao automatica.

---

## Estrutura do projeto

```
TOTVS_Refresh_2026/
├─ start.bat                 -> abre o sistema no navegador (modo aplicacao + PDF silencioso)
├─ README.md
├─ TIMELAPSE_ATUALIZACAO.md  -> registro do processo de atualizacao
├─ app/
│  ├─ index.html             -> painel operacional (analistas + gerente)
│  ├─ gestao.html            -> painel de gestao (status report do gerente)
│  ├─ css/styles.css         -> tema TOTVS azul escuro soft
│  └─ js/
│     ├─ storage.js          -> estado, usuarios, lotes, maquinas, permissoes, senhas
│     ├─ rollout.js          -> calendario util, plano de trocas, ajustes e KPIs do rollout
│     ├─ reports.js          -> metricas, dashboard e relatorios imprimiveis
│     ├─ importer-exporter.js-> exportacoes TSV / WhatsApp / JSON
│     ├─ github-sync.js      -> sincronizacao com o GitHub (Contents API)
│     ├─ app.js              -> integracao do painel operacional
│     ├─ gestao.js           -> integracao do painel de gestao
│     └─ vendor/chart.umd.js -> Chart.js 4.4.1 (graficos, uso offline)
├─ data/                     -> banco de dados versionado no repositorio
│  ├─ dados-gerais.json      -> indice geral (gerente)
│  ├─ usuarios.json          -> usuarios sem hash de senha (gerente)
│  ├─ gestao.json            -> ajustes, observacoes e frentes (gerente)
│  └─ analistas/<usuario>.json
├─ tests/smoke.html          -> auto-teste de logica (119 verificacoes)
└─ tools/
   ├─ check-ids.ps1          -> confere se todo ID usado no JS existe no HTML
   ├─ serve.ps1              -> servidor local (necessario para o fetch dos JSON)
   ├─ timelapse.ps1          -> gravacao de tela / timelapse do processo
   └─ validate.ps1           -> roda toda a validacao e gera last-validation.txt
```

---

## Como executar

### Opcao 1 - Uso normal (Windows)

Duplo clique em **`start.bat`**. Ele abre o sistema em modo aplicacao no Edge ou Chrome,
com as flags de PDF silencioso ja ativas.

### Opcao 2 - Durante o desenvolvimento

O sistema le `data/*.json` via `fetch`, e o navegador bloqueia isso em `file://`.
Para trabalhar, suba o servidor local:

```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
# abra http://localhost:8765/app/index.html
```

---

## Usuarios e senha

| Usuario | Perfil | Acesso |
|---|---|---|
| `gerente` | Gerente de projeto | Todos os lotes, todos os registros, arquivos individuais de todos os analistas, criacao/exclusao de lote, `usuarios.json`, `dados-gerais.json`, restaurar snapshot |
| `isaque` | Analista | Somente os proprios registros |
| `vinicius` | Analista | Somente os proprios registros |
| `guilherme` | Analista | Somente os proprios registros |
| `davi` | Analista | Somente os proprios registros |

- **Senha inicial de todos os perfis: `FieldTotvs2026`**
- **Chave mestra para resetar a senha de um usuario: `FieldTotvs2026`**

As senhas sao gravadas como **hash SHA-256** (nunca em texto puro) e o hash
**nunca** e exportado para o repositorio: o `usuarios.json` guarda apenas
id, usuario, nome, perfil e ativo.

Cada usuario pode trocar a propria senha no botao **Senhas**. O gerente pode
resetar a senha de qualquer analista informando a chave mestra.

---

## Permissoes por perfil

### Gerente de projeto
- Ve todos os lotes e todos os registros.
- Aba **Visao geral** com meta global, medias gerais e comparativo por analista.
- **Graficos gerais** e **graficos por analista**, imprimiveis.
- Cria e exclui lotes; baixa `dados-gerais.json`, `usuarios.json` e snapshot completo.
- Restaura snapshot, reseta a senha de qualquer usuario e baixa o arquivo
  individual de qualquer analista.

### Analista
- Ve e opera **somente os proprios registros**.
- Ve os proprios KPIs, a propria tabela, os filtros e as copias (planilha / WhatsApp).
- **Marca a troca** das proprias maquinas ja preparadas (individual ou em lote).
- Imprime **o proprio relatorio**.
- Faz **lancamento manual** apenas para si.

### Restrito ao gerente

| Recurso | Onde |
|---|---|
| Aba "Visao geral" (meta global e medias gerais) | Dashboard e relatorios |
| Graficos gerais e comparativo por analista | Dashboard e relatorios |
| Imprimir visao geral / grafico geral / grafico do analista | Dashboard e relatorios |
| Criar e excluir lote | Contexto do lote |
| Baixar `dados-gerais.json` e `usuarios.json` | Sync / Exportar |
| Baixar snapshot completo e restaurar snapshot | Sync / Exportar |
| Resetar a senha de outro usuario | Senhas |
| **Painel de Gestao** (`gestao.html`), a barra de troca em lote e o `gestao.json` | Topo do sistema |

> As travas existem **na interface e dentro das funcoes** — esconder o botao
> sozinho nao seria suficiente.

---

## Lancamento manual de tempos

Serve para quando nao deu para cronometrar na hora, ou quando a metrica foi feita
em outro lugar e precisa ser lancada depois.

No formulario, ligue **"Lancamento manual (sem cronometro)"**:

- O cronometro automatico e desligado naquele lancamento;
- Aparecem **4 campos, um por etapa, em minutos**;
- O **tempo total e somado automaticamente** e exibido ao lado;
- A **data da cronometragem e livre** (aceita data retroativa);
- O registro fica marcado como manual (campo `manualEntry`, com autor e data do
  lancamento) para dar para auditar depois;
- E obrigatorio informar tempo em **pelo menos uma etapa**.

O tempo por etapa alimenta normalmente as medias e os graficos, entao o historico
continua consistente.

---

## Graficos e impressao

O dashboard traz graficos em **HTML/CSS puro** — sem biblioteca externa, sem CDN,
funcionando offline e imprimindo com qualidade:

- **Gerais:** progresso da meta global (1.000), distribuicao por status, tempo medio
  por etapa e comparativo de atingimento por analista;
- **Por analista:** meta individual (250), distribuicao por status e tempo medio por etapa.

Os botoes **"Imprimir grafico geral"** e **"Imprimir grafico do analista"** sao
exclusivos do gerente. Combinados com o `start.bat`, geram o PDF direto, sem dialogo.

---

## Rollout: preparadas x trocadas

O processo tem duas contagens por dia, e elas sao **eventos diferentes**:

| Conceito | Como e registrado |
|---|---|
| **Preparada** | Automatico: a maquina conclui as 4 etapas da bancada. A data entra sozinha em `preparedAt`. |
| **Trocada** | Acao separada, com **data propria** escolhida pelo analista (`swappedAt`). So maquinas ja concluidas podem ser trocadas. |

### Marcar trocas (inclusive em lote)

Para lancar o dia inteiro rapido:

1. Marque as maquinas na tabela (checkbox da primeira coluna, ao lado do numero);
2. Escolha a **data da troca**;
3. Clique em **Marcar como trocadas**.

Tambem da para marcar uma unica maquina pelo botao **Trocada** na coluna de acoes, e
desfazer pelo **Desfazer troca**. O sistema ignora maquinas ainda em preparacao e ja
trocadas, avisando quantas foram ignoradas.

Filtros uteis adicionados: **Preparada (aguardando troca)** e **Trocada**.

---

## Painel de Gestao (tela do gerente)

Tela separada em `app/gestao.html`, aberta pelo botao **Painel de Gestão** no topo
(exclusivo do gerente; um analista que abrir o endereco direto ve o bloqueio).

Ela reproduz o status report que o gestor ja usava, nas cores deste projeto, com
**Chart.js 4.4.1 vendorizado** em `app/js/vendor/` — os mesmos gráficos da referência,
funcionando offline e imprimindo.

### Blocos da tela

| Bloco | Conteúdo |
|---|---|
| **8 KPIs** | trocadas acumulado · % de 1.000 · preparadas acumulado · previsto no plano até hoje · **desvio vs plano** · ritmo médio · projeção de término · dias úteis restantes |
| **Evolução acumulada** | linha do plano (tracejada) + trocadas (preenchida) + preparadas, com o futuro cortado |
| **Por analista** | barras agrupadas preparadas × trocadas |
| **Últimos 10 dias** | barras agrupadas trocas × preparadas |
| **Lançamento do dia** | ajuste manual por analista + observação da daily + copiar resumo |
| **Frentes** | superado e pendente, com adicionar / remover / concluir |
| **Histórico diário** | data · prep · trocas · acumulado · plano · desvio · status · observação · editar |
| **Operação ao vivo** | em andamento agora · aguardando troca · incidentes · tempo médio por etapa · atingimento por analista |

### O card do desvio muda de cor

O card inteiro acompanha o desvio, como na referência do gestor:

| Desvio | Leitura |
|---|---|
| ≥ 0 | verde — no ritmo ou adiantado |
| entre −1 e −20 | laranja — atenção |
| ≤ −20 | vermelho — atrasado |

### Lançamento do dia = ajuste somado

**Preparadas** e **trocadas** entram sozinhas, derivadas das máquinas. O formulário serve
para **corrigir divergência**:

- cada linha mostra o número das máquinas, o campo de ajuste e o total resultante;
- o ajuste **pode ser negativo** (ex.: `-1` para tirar uma máquina contada duas vezes);
- o total nunca fica abaixo de zero e um ajuste zerado é removido automaticamente;
- a observação da daily é gravada junto com o dia.

### Ao vivo

O indicador no topo mostra a hora da última atualização e quanto falta para o próximo
ciclo. O botão alterna entre **15s · 30s · 60s · pausado**.

- **Com token:** cada ciclo puxa do GitHub e mescla o que os analistas enviaram;
- **Sem token:** relê apenas os dados locais, em **modo local**.

### Regras do plano (portadas do painel do gestor)

| Regra | Valor |
|---|---|
| Total de maquinas | 1.000 |
| Periodo | 05/10/2026 a 29/01/2027 |
| Inicio das trocas | 19/10/2026 (antes disso e so preparacao) |
| Meta mensal | out 160 · nov 300 · dez 280 · jan 260 |
| Feriados considerados | 12/10, 02/11, 20/11, 24/12, 25/12, 31/12, 01/01 |

O plano distribui a meta do mês nos dias úteis a partir do início das trocas, formando a
linha de "previsto" do burndown. Datas fora do calendário útil usam o plano do último dia
útil anterior.

Regras de cálculo, idênticas às do painel original:

- **Ritmo médio** = média dos últimos 5 dias lançados **que tiveram troca**;
- **Projeção** = data prevista, ou `após 29/01 (+N d.u.)` se estourar o prazo, ou `Concluído`;
- **Status por dia** no histórico = `no plano` (desvio ≥ 0), `atenção` (até −20) ou `atrasado`.

### Importar o histórico antigo

O botão **Importar apontamentos** aceita vários arquivos de uma vez e reconhece:

- `tipo: "apontamento-analista"` — os arquivos do antigo **ImplementarAuto**, convertidos
  em ajustes por dia e analista;
- backup do painel antigo (`{days, config, analistas}`) — ajustes + frentes + observações;
- backup deste painel e o próprio `data/gestao.json`.

O analista é casado pelo nome ou pelo usuário. Lançamentos de analista não encontrado
aparecem na contagem de ignorados do aviso.

### Arquivos de referencia do cliente

`ImplementarAuto.html` e `status-report-rollout-totvs-local.html` na raiz sao os
originais do analista e do gestor, mantidos como referencia. O sistema novo substitui o
fluxo antigo em que cada analista preenchia o formulario e enviava o JSON para o gestor
consolidar: agora os dois lados leem os mesmos dados sincronizados no GitHub.

---

## Gerar PDF sem dialogo (o "Windows + P" automatico)

1. Configure o impressor padrao do Windows como **Microsoft Print to PDF**.
2. Abra o sistema pelo **`start.bat`** (ele passa `--kiosk-printing` ao navegador).
3. Em **Dashboard & Relatorios**, use **Imprimir visao geral** ou
   **Imprimir analista selecionado**.

O PDF sai direto, **sem dialogo, sem margem, sem cabecalho e sem rodape** do
navegador: o `@page { margin: 0 }` do `styles.css` cuida do enquadramento e o
arquivo e salvo na pasta de Downloads.

---

## Sincronizacao automatica com o GitHub

O objetivo: **cada analista salva e o dado ja aparece versionado no repositorio**,
sem exportar e importar JSON manualmente. O export/import manual continua
disponivel (e crucial como reserva).

### 1. Crie o token

No GitHub: **Settings -> Developer settings -> Personal access tokens ->
Fine-grained tokens -> Generate new token**.

- **Repository access:** apenas o repositorio deste projeto.
- **Permissions -> Repository permissions -> Contents: Read and write.**
- Copie o token (`github_pat_...`).

### 2. Configure no app (uma vez por maquina)

No sistema, botao **Sync / Exportar**, card *Sincronizacao automatica (GitHub)*:

| Campo | Exemplo |
|---|---|
| Usuario / Organizacao | `isaque-medeiros` |
| Repositorio | `TOTVS_Refresh_2026` |
| Branch | `main` |
| Token | `github_pat_...` |

Clique em **Salvar configuracao** e depois em **Testar conexao**.
Marque **Enviar automaticamente a cada salvamento**: a partir dai toda gravacao
vai para o repositorio sem intervencao.

### 3. Botoes disponiveis

| Botao | O que faz |
|---|---|
| Salvar configuracao | Guarda usuario, repositorio, branch e token naquela maquina |
| Testar conexao | Valida o token e confirma a permissao de escrita |
| Enviar agora | Forca o envio dos dados atuais |
| Baixar agora | Le os dados do repositorio e mescla com os locais |
| Carregar dados publicados | Le os JSON publicados **sem token** (qualquer visitante) |

### Como os dados sao organizados (anti-conflito)

- Cada analista escreve **somente o seu proprio arquivo** (`data/analistas/<usuario>.json`).
- O gerente escreve `data/dados-gerais.json` e `data/usuarios.json`.
- Assim **dois analistas nunca disputam a mesma gravacao**.

### Como os conflitos sao resolvidos

- Merge por `id`, e vence a versao com `updatedAt` **mais recente**.
- Dado local mais novo nunca e rebaixado.
- A gravacao tem retry automatico quando o GitHub responde 409/422 (sha desatualizado).
- O **hash de senha nunca** e sobrescrito por um arquivo remoto.

### Publicando no GitHub Pages

Suba o repositorio e em **Settings -> Pages** publique a raiz (`/`).
A aplicacao fica em `https://<usuario>.github.io/<repositorio>/app/`. Nada precisa
ser compilado.

---

## Exportacao manual de JSON (reserva)

O modal **Sync / Exportar** gera arquivos com os mesmos nomes e formato da
sincronizacao automatica:

- `dados-gerais.json` -> `data/`
- `usuarios.json` -> `data/`
- `analista-<usuario>.json` -> `data/analistas/<usuario>.json`
- Snapshot completo -> backup/restauracao integral (somente gerente)

---

## Validacao

```powershell
powershell -ExecutionPolicy Bypass -File tools\validate.ps1
```

Roda a verificacao de IDs (JS x HTML), o smoke test de logica no navegador
(`tests/smoke.html`) e o teste de carregamento da aplicacao. Gera
`tools/last-validation.txt`.

O smoke test cobre cadastro em lote, o bug antigo de nao conseguir salvar
maquinas depois do primeiro lote, timers, permissoes por perfil, troca e reset
de senha, merge por data, leitura publica, retry em conflito 409 e relatorios.

---

## Timelapse / gravacao de tela

```powershell
powershell -ExecutionPolicy Bypass -File tools\timelapse.ps1
# powershell -ExecutionPolicy Bypass -File tools\timelapse.ps1 -IntervalSeconds 15 -Frames 60 -Scale 50
```

Captura a tela em intervalos regulares para `docs/timelapse/frame-NNNN.png` e gera
`docs/timelapse/index.html`, um reprodutor pronto para assistir a sequencia.
Veja tambem `TIMELAPSE_ATUALIZACAO.md`.

---

## Limitacoes conhecidas (transparencia)

1. **O token fica no navegador de cada maquina** (`localStorage`), nunca no
   repositorio. Use um token fine-grained limitado a este repositorio e revogue-o
   se a maquina for compartilhada.
2. Um token com `Contents: Read and write` tecnicamente pode escrever qualquer
   arquivo do repositorio. A separacao gerente/analista e garantida **pelo app**,
   nao pelo GitHub. Bloqueio real exigiria um backend ou um GitHub App.
3. Os arquivos em `data/` ficam visiveis no repositorio (dado operacional, sem
   informacao sensivel). Os hashes de senha nunca sao exportados.
4. Nao existe servidor: a sincronizacao depende de configurar o token uma vez por
   maquina. O botao **Carregar dados publicados** permite que qualquer pessoa veja
   os dados publicados sem credencial.

---

## Metas configuradas

- Meta global do projeto: **1.000** maquinas
- Meta por analista: **250** maquinas

## Etapas do processo

1. `1 FORMATAÇÃO E BIOS`
2. `2 WINDOWS UPDATE`
3. `3 ATIVAR ADM E SUBIR DRIVERS`
4. `4 DOMINIO E ARGUS`
5. `CONCLUIDO`
