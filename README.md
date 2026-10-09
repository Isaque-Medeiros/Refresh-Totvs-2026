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
|
+- start.bat                  -> abre o sistema no navegador (modo aplicacao + PDF silencioso)
+- README.md
+- TIMELAPSE_ATUALIZACAO.md   -> registro do processo de atualizacao
+- app/
|  +- index.html              -> painel operacional (analistas + gerente)
|  +- gestao.html             -> painel de gestao (status report do gerente)
|  +- css/styles.css          -> tema TOTVS azul escuro soft
|  +- assets/                 -> identidade visual (logos)
|  |  +- totvs-app-icon.png   -> icone do app (1:1, #00E5FF) - favicon e cabecalho
|  |  +- totvs-logo-light.png -> wordmark branco - login (tema escuro)
|  |  +- totvs-logo-print.png -> logo recortada - relatorios impressos
|  |  +- totvs-logo.jpg       -> logo completa de origem (backup)
|  +- js/
|     +- storage.js           -> estado, usuarios, lotes, maquinas, permissoes, senhas
|     +- rollout.js           -> calendario util, plano de trocas, ajustes e KPIs do rollout
|     +- filters.js           -> filtros por SPON/status/data e ordenacao (duas telas)
|     +- reports.js           -> metricas, dashboard e relatorios imprimiveis
|     +- importer-exporter.js -> exportacoes TSV / WhatsApp / JSON
|     +- github-sync.js       -> sincronizacao com o GitHub (Contents API)
|     +- print-layout.js      -> layout A4 dos relatorios (PDF profissional)
|     +- app.js               -> integracao do painel operacional
|     +- gestao.js            -> integracao do painel de gestao
|     +- vendor/chart.umd.js  -> Chart.js 4.4.1 (graficos, uso offline)
+- data/                      -> banco de dados versionado no repositorio
|  +- dados-gerais.json       -> indice geral (gerente)
|  +- usuarios.json           -> usuarios sem hash de senha (gerente)
|  +- gestao.json             -> ajustes, observacoes e frentes (gerente)
|  +- analistas/<usuario>.json
+- tests/smoke.html           -> auto-teste de logica (167 verificacoes)
+- tools/
   +- check-ids.ps1           -> confere se todo ID usado no JS existe no HTML
   +- prepare-logos.ps1       -> prepara as logos (recorte + versao clara)
   +- serve.ps1               -> servidor local (necessario para o fetch dos JSON)
   +- timelapse.ps1           -> gravacao de tela / timelapse do processo
   +- validate.ps1            -> roda toda a validacao e gera last-validation.txt
```

---

## Identidade visual (logos)

As logos ficam em `app/assets/`:

| Arquivo | Onde aparece | Como |
|---|---|---|
| `totvs-app-icon.png` | Favicon e cabecalho das duas telas | Icone 1:1 (fundo `#00E5FF`, simbolo `#001E32`) em 40 px, com brilho ciano |
| `totvs-logo-light.png` | Login e tela de acesso restrito | Wordmark branco com fundo transparente (versao para tema escuro) |
| `totvs-logo-print.png` | Cabecalho dos relatorios em PDF | Logo recortada (azul `#001E32` sobre branco) |
| `totvs-logo.jpg` | Referencia | Logo completa de origem (backup) |

As duas ultimas (**light** e **print**) sao geradas a partir da logo completa por:

```powershell
powershell -ExecutionPolicy Bypass -File tools\prepare-logos.ps1
```

O script remove as sobras brancas (recorte justo) e cria a versao clara convertendo
a luminancia em transparencia, deixando a marca legivel sobre o tema azul escuro.

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

| Usuario | Nome | Perfil | Acesso |
|---|---|---|---|
| `gerente` | Gerente de Projeto | Gerente de projeto | Todos os lotes, todos os registros, arquivos individuais de todos os analistas, criacao/exclusao de lote, `usuarios.json`, `dados-gerais.json`, `gestao.json`, restaurar snapshot |
| `isaque` | Isaque | Analista | Somente os proprios registros |
| `vinicius` | Vinicius | Analista | Somente os proprios registros |
| `guilherme` | Guilherme | Analista | Somente os proprios registros |
| `davi` | Davi | Analista | Somente os proprios registros |

- **Senha inicial de todos os perfis: `FieldTotvs2026`**
- **Chave mestra para resetar a senha de um usuario: `FieldTotvs2026`**

As senhas sao gravadas como **hash SHA-256** (nunca em texto puro) e o hash
**nunca** e exportado para o repositorio.

Cada usuario troca a propria senha no botao **Senhas** do painel operacional; o gerente
reseta a de qualquer analista.

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

> As travas existem **na interface e dentro das funcoes** â€” esconder o botao
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

## Filtros, busca e ordenacao

As duas telas usam o mesmo modulo de filtros (`app/js/filters.js`), cada uma com a
sua barra. O comportamento e identico nos dois paineis:

- **Busca livre** (hostname, analista, etapa, observacao, incidente) e **busca SPON**
  por hostname;
- **Filtro por analista**: o gerente filtra por qualquer responsavel; o analista so
  enxerga o proprio nome;
- **Status**: preparada (aguardando troca), trocada, em andamento, pausada e incidente;
- **Fabricante** (Dell / Lenovo / HP) e **perfil** (usuario local / cloud);
- **Intervalo de datas** de registro, com os atalhos **Hoje**, **Ontem**,
  **Ultimos 7 dias** e **Este mes**;
- **Ordenacao** por ultima atualizacao, data registrada, preparada em, hostname,
  analista, etapa, status ou tempo total, em ordem crescente ou decrescente.

A barra mostra em tempo real o **resumo dos filtros ativos**. O botao
**Selecionar todos os filtrados** marca para a troca em lote exatamente o que esta na
tela, e **Limpar filtros** volta tudo ao estado inicial.

Relatorios e graficos respeitam os mesmos filtros, e o layout de impressao
(`app/js/print-layout.js`) monta o A4 com cabecalho, KPIs, tabelas e graficos
prontos para o PDF.

---


## Graficos e impressao

O dashboard traz graficos em **HTML/CSS puro** â€” sem biblioteca externa, sem CDN,
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

Tela separada em `app/gestao.html`, aberta pelo botao **Painel de GestÃ£o** no topo
(exclusivo do gerente; um analista que abrir o endereco direto ve o bloqueio).

Ela reproduz o status report que o gestor ja usava, nas cores deste projeto, com
**Chart.js 4.4.1 vendorizado** em `app/js/vendor/` â€” os mesmos grÃ¡ficos da referÃªncia,
funcionando offline e imprimindo.

### Blocos da tela

| Bloco | ConteÃºdo |
|---|---|
| **8 KPIs** | trocadas acumulado Â· % de 1.000 Â· preparadas acumulado Â· previsto no plano atÃ© hoje Â· **desvio vs plano** Â· ritmo mÃ©dio Â· projeÃ§Ã£o de tÃ©rmino Â· dias Ãºteis restantes |
| **EvoluÃ§Ã£o acumulada** | linha do plano (tracejada) + trocadas (preenchida) + preparadas, com o futuro cortado |
| **Por analista** | barras agrupadas preparadas Ã— trocadas |
| **Ãšltimos 10 dias** | barras agrupadas trocas Ã— preparadas |
| **LanÃ§amento do dia** | ajuste manual por analista + observaÃ§Ã£o da daily + copiar resumo |
| **Frentes** | superado e pendente, com adicionar / remover / concluir |
| **HistÃ³rico diÃ¡rio** | data Â· prep Â· trocas Â· acumulado Â· plano Â· desvio Â· status Â· observaÃ§Ã£o Â· editar |
| **OperaÃ§Ã£o ao vivo** | em andamento agora Â· aguardando troca Â· incidentes Â· tempo mÃ©dio por etapa Â· atingimento por analista |

### O card do desvio muda de cor

O card inteiro acompanha o desvio, como na referÃªncia do gestor:

| Desvio | Leitura |
|---|---|
| â‰¥ 0 | verde â€” no ritmo ou adiantado |
| entre âˆ’1 e âˆ’20 | laranja â€” atenÃ§Ã£o |
| â‰¤ âˆ’20 | vermelho â€” atrasado |

### LanÃ§amento do dia = ajuste somado

**Preparadas** e **trocadas** entram sozinhas, derivadas das mÃ¡quinas. O formulÃ¡rio serve
para **corrigir divergÃªncia**:

- cada linha mostra o nÃºmero das mÃ¡quinas, o campo de ajuste e o total resultante;
- o ajuste **pode ser negativo** (ex.: `-1` para tirar uma mÃ¡quina contada duas vezes);
- o total nunca fica abaixo de zero e um ajuste zerado Ã© removido automaticamente;
- a observaÃ§Ã£o da daily Ã© gravada junto com o dia.

### Ao vivo

O indicador no topo mostra a hora da Ãºltima atualizaÃ§Ã£o e quanto falta para o prÃ³ximo
ciclo. O botÃ£o alterna entre **15s Â· 30s Â· 60s Â· pausado**.

- **Com token:** cada ciclo puxa do GitHub e mescla o que os analistas enviaram;
- **Sem token:** relÃª apenas os dados locais, em **modo local**.

### Regras do plano (portadas do painel do gestor)

| Regra | Valor |
|---|---|
| Total de maquinas | 1.000 |
| Periodo | 05/10/2026 a 29/01/2027 |
| Inicio das trocas | 19/10/2026 (antes disso e so preparacao) |
| Meta mensal | out 160 Â· nov 300 Â· dez 280 Â· jan 260 |
| Feriados considerados | 12/10, 02/11, 20/11, 24/12, 25/12, 31/12, 01/01 |

O plano distribui a meta do mÃªs nos dias Ãºteis a partir do inÃ­cio das trocas, formando a
linha de "previsto" do burndown. Datas fora do calendÃ¡rio Ãºtil usam o plano do Ãºltimo dia
Ãºtil anterior.

Regras de cÃ¡lculo, idÃªnticas Ã s do painel original:

- **Ritmo mÃ©dio** = mÃ©dia dos Ãºltimos 5 dias lanÃ§ados **que tiveram troca**;
- **ProjeÃ§Ã£o** = data prevista, ou `apÃ³s 29/01 (+N d.u.)` se estourar o prazo, ou `ConcluÃ­do`;
- **Status por dia** no histÃ³rico = `no plano` (desvio â‰¥ 0), `atenÃ§Ã£o` (atÃ© âˆ’20) ou `atrasado`.

### Importar o histÃ³rico antigo

O botÃ£o **Importar apontamentos** aceita vÃ¡rios arquivos de uma vez e reconhece:

- `tipo: "apontamento-analista"` â€” os arquivos do antigo **ImplementarAuto**, convertidos
  em ajustes por dia e analista;
- backup do painel antigo (`{days, config, analistas}`) â€” ajustes + frentes + observaÃ§Ãµes;
- backup deste painel e o prÃ³prio `data/gestao.json`.

O analista Ã© casado pelo nome ou pelo usuÃ¡rio. LanÃ§amentos de analista nÃ£o encontrado
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

O PDF sai direto, **sem dialogo, sem cabecalho e sem rodape** do navegador: as
regras `@page { size: A4 portrait; margin: 12mm 10mm 14mm }` e `@media print` do
`styles.css` enquadram o conteudo em A4 com margem de impressao, e o arquivo e
salvo na pasta de Downloads.

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

### 2. Configure no app (opcional - o sistema se vincula sozinho)

O sistema ja tenta se vincular automaticamente (veja *Vinculacao automatica e
indicador de sincronizacao*). Use o modal **Sync / Exportar** apenas para trocar o
token/parametros manualmente ou quando o botao **Clique para sincronizar** pedir.

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
- **Maquina excluida nao volta.** Cada exclusao entra num registro proprio
  (`deletedMachines`), que viaja junto com os dados. Ele e aplicado **antes** do
  merge -- entao mesmo que um arquivo antigo (do analista ou do gerente) ainda
  liste a maquina apagada, ela e descartada de novo.
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
de senha, merge por data, **exclusao de maquina (que nao pode voltar pelo
repositorio)**, leitura publica, retry em conflito 409 e relatorios.

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

1. **O token nunca fica no repositorio.** Ele e resolvido na propria maquina:
   `localStorage` (modal **Sync / Exportar**) ou o arquivo nao versionado
   `app/assets/github-token.local.js` (veja o `.example.js`). O GitHub bloqueia o
   envio de segredos no push e o repositorio e publico, entao commitar o token
   exporia o acesso de escrita a qualquer pessoa.
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
5. `AGUARDANDO_CHECKLIST` -> **Aguardando checklist final** (bancada pronta, revisao pendente)
6. `CONCLUIDO` -> **Concluída** (checklist aprovado)

> Ao terminar as 4 etapas da bancada a máquina **não** vai mais direto para
> concluída: ela fica em **Aguardando checklist final**. A conclusão só acontece
> depois do checklist. As máquinas antigas que já estavam `CONCLUIDO` permanecem
> como estão (o histórico não retroage).

## Checklist final

No painel operacional, botão **Checklist Final** (ou a ação *Checklist* na linha da
máquina):

1. Pesquise o **SPON** da máquina.
2. Clique em **Realizar checklist final**.
3. Marque os **4 itens obrigatórios**: Certificado Microsoft, Trellix, Drivers HP e
   Windows Update. O botão **Concluir máquina** só libera com os 4 marcados.
4. Ao confirmar, a máquina passa para `CONCLUIDO` (com `completedAt`, histórico e
   auditoria registrados).

## Consulta de SPON

Botão **Consultar SPON** (painel operacional e painel de gestão). Mostra, por máquina:
procedimento por etapa (com tempo de cada uma), problemas encontrados, tempo total,
checklist e linha do tempo. **Analistas** não veem o responsável/autor das ações —
apenas o **gerente** vê quem fez.

---

## Vinculação automática e indicador de sincronização

O sistema tenta se vincular sozinho ao GitHub na abertura do painel. Usuario,
repositorio e branch ja vem preenchidos (`isaque-medeiros / Refresh-Totvs-2026`,
`main`); falta apenas o **token**, que por seguranca **nao fica no repositorio**.

- O **chip no topo** mostra o estado: *Vinculado*, *Verificando vínculo*,
  *Sincronizando* ou *Falha na sincronização*.
- Se não estiver vinculado, aparece o botão **Clique para sincronizar**. Se ele
  falhar novamente, abre a configuração manual (modal **Sync / Exportar**), que
  continua existindo como reserva.
- A validação da conexão roda em segundo plano e nunca trava a tela (timeout de 12s).

### Onde fica o token (ele nao vai para o repositorio)

O GitHub **bloqueia o envio de segredos** (push protection) e o repositorio e
publico, entao o token nao pode ficar no codigo. Ele e resolvido nesta ordem:

1. Configuracao salva NESTA maquina (`localStorage`), pelo modal **Sync / Exportar**;
2. `window.TOTVS_GITHUB_TOKEN`, definido por um arquivo **nao versionado**:
   `app/assets/github-token.local.js`;
3. Chave dedicada no `localStorage`.

Para vincular sozinho, sem pedir nada ao analista, copie uma vez por maquina o
exemplo (que pode ser versionado) e cole o token:

```powershell
copy app\assets\github-token.local.example.js app\assets\github-token.local.js
```

O arquivo real `github-token.local.js` ja esta no `.gitignore`.

> AVISO: use um token **fine-grained** limitado a este repositorio, com
> `Contents: Read and write`, e **rotacione-o** periodicamente. Se um token for
> compartilhado por engano (print, chat, commit), revogue-o imediatamente.
