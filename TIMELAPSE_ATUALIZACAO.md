# Timelapse da Atualizacao

## Objetivo

Registrar, em formato resumido, a evolucao da atualizacao da interface e da logica do projeto TOTVS Field Refresh 2026.

## Linha do tempo

### Sessao 1 - Leitura e fundacao

1. Leitura e consolidacao das diretrizes do `GuiaDev.md`.
2. Revisao dos arquivos correlatos da interface para evitar regressao de clique e fluxo.
3. Estruturacao da nova tela com identidade visual soft em azul escuro e contornos em azul claro.
4. Inclusao de fluxo de login por perfil com gerente e analistas.
5. Centralizacao do estado no `storage.js`, com controle de lotes, usuarios, permissoes e trilha de auditoria.
6. Adequacao do cadastro em lote de hostnames com suporte a reaproveitamento de registros por hostname.
7. Inclusao de data de cronometragem, incidentes tecnicos e observacoes por maquina.
8. Implementacao dos cronometros por etapa e do tempo total por registro.
9. Criacao dos relatÃ³rios geral e individual com modo de impressao para PDF.
10. Inclusao das exportacoes `dados-gerais.json`, arquivo individual do usuario, `usuarios.json` e snapshot completo.
11. Inclusao da troca de senha criptografada por hash e reset de senha com chave mestra.
12. Reescrita do `app.js` para integrar layout, storage, relatorios, exportacao e permissoes reais.
13. Criacao do `start.bat` como launcher (Edge, depois Chrome, depois navegador padrao).
14. Criacao deste arquivo de registro do processo.
15. Correcao de um bug de usabilidade: em viewport estreito o cabecalho fixo crescia
    demais e cobria o formulario, interceptando cliques. Resolvido com
    `.app-header { position: static; }` no breakpoint de 820px.

### Sessao 2 - Correcoes, sincronizacao automatica e validacao

16. **Correcao de defeito real no `start.bat`**: o arquivo comecava com uma linha
    espuria `bat`, executada como comando antes do script rodar.
17. **PDF silencioso**: incluida a regra `@page { size: A4 portrait; margin: 0; }` e
    ajustes de `@media print` (sem margem, sem cabecalho, sem rodape do navegador e
    quebra de pagina correta em tabelas longas).
18. **`start.bat`**: adicionadas as flags `--kiosk-printing`, `--disable-print-preview`
    e `--disable-extensions` nos 4 lancamentos, viabilizando o "Windows + P" automatico.
19. **`writePrintArea()`**: troca do `setTimeout` fragil de 250 ms pelo evento
    `afterprint`, com fallback de 5 s.
20. **Correcao de falha de seguranca**: o botao *Restaurar snapshot* estava exposto ao
    analista e `restoreFullBackup()` nao validava perfil, permitindo sobrescrever a
    base inteira (inclusive senhas). Agora exige gerente, na UI e na funcao.
21. **Correcao de mutacao vazada**: `withProcessedTimer()` fazia copia rasa
    (`{ ...machine }`) e alterava o `stepDurations` do objeto original. Passou a
    clonar `stepDurations` e `history`.
22. **Novo modulo `app/js/github-sync.js`**: sincronizacao automatica com o GitHub via
    Contents API, com leitura do `sha` antes do `PUT`, retry automatico em 409/422,
    base64 UTF-8 correto (preserva acentos como *FORMATAÃ‡ÃƒO*) e fila serializada com
    *debounce* de 1,5 s.
23. **Regra anti-conflito**: cada analista grava somente
    `data/analistas/<usuario>.json`; o gerente grava `data/dados-gerais.json` e
    `data/usuarios.json`.
24. **Merge por data em `storage.js`**: `mergeById` e `mergeRemoteBundle` aplicam a
    versao de `updatedAt` mais recente, nunca rebaixam dado local mais novo e nunca
    sobrescrevem o hash de senha. Analista absorve apenas os proprios registros; o
    gerente absorve todos.
25. **Leitura publica sem token**: `fetchPublishedBundle()` le os JSON publicados no
    GitHub Pages, permitindo que qualquer pessoa veja os dados compartilhados.
26. **Envio automatico a cada salvamento**: `scheduleSyncAfterChange()` foi ligado a
    criar/editar/excluir maquina, iniciar/pausar/avancar etapa, criar/alterar/excluir
    lote e troca/reset de senha.
27. **UI de sincronizacao**: novo card no modal *Sync / Exportar* com usuario,
    repositorio, branch e token, botoes *Salvar configuracao*, *Testar conexao*,
    *Enviar agora*, *Baixar agora*, *Carregar dados publicados*, indicador de status
    colorido e rotulo de ultima sincronizacao.
28. **Acesso do gerente aos arquivos individuais**: seletor de analista com download do
    arquivo individual e opcao de baixar todos de uma vez.
29. **Padronizacao dos exports manuais**: os arquivos baixados passaram a usar
    exatamente os mesmos nomes e formato do repositorio (`dados-gerais.json`,
    `usuarios.json`, `analista-<usuario>.json`).
30. **Banco versionado**: criada a pasta `data/` com `dados-gerais.json`,
    `usuarios.json`, os arquivos dos 4 analistas e um `README.md` explicativo.
31. **Ferramentas de validacao**: `tools/check-ids.ps1` (IDs do JS x HTML),
    `tests/smoke.html` (53 verificacoes de logica), `tools/serve.ps1` (servidor local
    para o `fetch`) e `tools/validate.ps1` (executa tudo e gera `tools/last-validation.txt`).
32. **Gravacao de tela / timelapse**: `tools/timelapse.ps1` captura frames da tela em
    intervalos regulares para `docs/timelapse/` e gera um reprodutor `index.html`.
33. **Documentacao**: criacao do `README.md` com publicacao no GitHub Pages, criacao do
    token fine-grained, fluxo manual de JSON, validacao e limitacoes conhecidas.

### Sessao 3 - Publicacao por link, graficos, permissoes e lancamento manual

34. **Correcao na leitura publica** (`fetchPublishedBundle`): o `usuarios.json` ja era
    baixado mas ignorado. Agora os nomes dos analistas vem do manifest **e** do
    `usuarios.json`, entao um analista novo aparece na leitura publica mesmo que o
    gerente ainda nao tenha sincronizado o arquivo geral.
35. **`vercel.json`**: redirect de `/` para `/app/` (307 temporario), permitindo o link
    limpo `https://projeto.vercel.app/` sem mexer em nenhuma linha do app. `permanent: false`
    evita cache de redirect no navegador da equipe.
36. **Documentacao do Vercel** no README: quadro comparando os dois modos de uso
    (local pelo `start.bat` vs online pelo link), configuracao do projeto, URLs finais,
    como operar sem token e o alerta de exposicao da senha em deploy publico.
37. **Travas de permissao**: o botao *Baixar snapshot completo* estava acessivel ao
    analista, expondo a base inteira com todos os usuarios. Agora e `manager-only`,
    junto com a aba *Visao geral*, os graficos gerais e o *Imprimir visao geral*.
38. **Guarda nas funcoes**: `downloadSnapshot`, `printGeneralReport`, `printGeneralCharts`
    e `printAnalystCharts` recusam perfil de analista â€” esconder o botao sozinho nao bastava.
39. **Graficos em HTML/CSS puro** (zero dependencia, imprime com qualidade):
    progresso da meta global, distribuicao por status, tempo medio por etapa e
    comparativo de atingimento por analista; mais o conjunto individual (meta 250).
40. **Impressao de graficos**: novos botoes *Imprimir grafico geral* e
    *Imprimir grafico do analista* (manager-only), e os graficos passam a integrar
    tambem os relatorios imprimiveis gerais e individuais.
41. **Metricas numericas**: `stepAvgSeconds` (tempo medio por etapa em segundos) para
    alimentar os graficos com escala real, e `manualCount` para contar lancamentos manuais.
42. **Lancamento manual de tempos**: checkbox *Lancamento manual (sem cronometro)*,
    4 campos de tempo por etapa em minutos, total somado ao vivo, data retroativa livre,
    registro marcado com `manualEntry`, `manualEntryBy` e `manualEntryAt` para auditoria.
43. **Validacao do lancamento manual**: exige tempo em pelo menos uma etapa (evita
    lancamento vazio) e reaproveita o *upsert* por hostname, regravando os tempos sem duplicar.
44. **Aba inicial automatica**: quando a aba padrao do dashboard esta oculta para o
    perfil (caso do analista com a *Visao geral* restrita), o sistema ativa
    automaticamente a primeira aba visivel.
45. **CSS**: estilos dos graficos, dos campos de tempo manual e regras de impressao
    dos graficos (fundo branco, borda visivel, sem quebrar no meio da pagina).
46. **Testes**: o smoke test subiu de **53 para 71** verificacoes, cobrindo lancamento
    manual, leitura publica com manifest desatualizado e os geradores de grafico.

---

### Sessao 4 - Modelo real do cliente, painel de gestao e marcacao de trocas

47. **Identificados os HTML originais do cliente** na raiz do projeto
    (`ImplementarAuto.html` = formulario do analista; `status-report-rollout-totvs-local.html`
    = painel do gestor). A analise revelou que o processo real conta
    **preparadas e trocadas por dia**, como eventos independentes â€” diferente das
    4 etapas cronometradas que vieram do `GuiaDev.md`.
    Decisao: manter as duas visoes, com preparada/trocada **derivadas** das etapas.
48. **Modelo de troca**: `preparedAt` gravado automaticamente ao concluir as 4 etapas
    (com retrocompatibilidade para registros antigos) e `swappedAt` + `swappedBy` como
    acao separada, com data escolhida pelo analista.
49. **Marcacao em lote**: `markMachinesSwapped` marca varias maquinas de uma vez,
    valida elegibilidade (so concluidas, nao trocadas, respeitando permissao) e devolve
    quantas foram ignoradas e o motivo. `unmarkMachineSwapped` desfaz a troca.
50. **Novo modulo `rollout.js`**: calendario Ãºtil com feriados, metas mensais,
    plano de trocas acumulado, consolidacao por dia e por analista, KPIs
    (ritmo medio dos Ãºltimos 5 dias Ãºteis, projecao de termino, desvio vs plano,
    dias Ãºteis restantes) e serie de burndown. Conversao de data imune a fuso horario.
51. **Tela nova `app/gestao.html` + `gestao.js`**: painel do gerente nas cores deste
    projeto, com burndown em **SVG** e demais graficos em **CSS puro** (nenhuma
    biblioteca ou CDN), historico diario, impressao e backup. Acesso bloqueado para analista.
52. **UI de troca no painel operacional**: checkbox por linha, barra de acao em lote com
    data da troca, botoes *Trocada* / *Desfazer troca* na linha, filtros
    *Preparada (aguardando troca)* e *Trocada*, e badge de status *Trocada*.
53. **`check-ids.ps1` reescrito para validar POR PAGINA**: descobre quais scripts cada HTML
    carrega e confere os IDs naquela pagina. Isso elimina falso positivo e passa a pegar
    tambem script carregado na pagina errada.
54. **Smoke test a prova de falha silenciosa**: handlers de `error` e `unhandledrejection`
    fecham o resultado como falha em vez de deixar o resumo em "Executando...".
    E o `validate.ps1` passou a gravar o relatorio **incrementalmente**, para que uma
    execucao interrompida nao perca o resultado.
55. **Testes**: o smoke test subiu de **74 para 105** verificacoes, cobrindo troca em lote,
    elegibilidade, desfazer troca, calendario Ãºtil, plano acumulado, consolidacao por
    analista, KPIs de gestao e serie de burndown.
56. **README**: novas secoes de rollout (preparadas x trocadas), painel de gestao e as
    regras do plano, alem da matriz de permissoes atualizada.

---

### Sessao 5 - Painel de gestao completo, com o layout do status-report e ao vivo

57. **Modelo definido**: os numeros de preparadas/trocadas continuam **derivados das
    maquinas** e o lancamento manual do gestor entra como **ajuste somado** â€” permite
    corrigir divergencia sem risco de contagem dobrada.
58. **`rollout.js` alinhado a referencia**: ritmo medio passa a ser a media dos ultimos
    5 dias lancados **que tiveram troca**, projecao vira `DD/MM` ou
    `apos 29/01 (+N d.u.)` ou `Concluido`, percentual inteiro arredondado, status por dia
    (`no plano` / `atencao` / `atrasado`) e novas funcoes `buildDayRows`, `buildAnalystRows`,
    `buildStats` e `buildBurndownSeries`.
59. **Ajustes persistidos**: `setDayAdjustment`, `setDailyNote`, `setFrentes` e
    `replaceManagement` no `storage.js`, chaveados por **analystId** (renomear usuario nao
    quebra o historico) e com `mergeManagement` para o remoto.
60. **`data/gestao.json`**: novo arquivo versionado com ajustes, observacoes e frentes,
    escrito pelo gerente e incluido no push, no pull e no merge.
61. **Chart.js 4.4.1 vendorizado** em `app/js/vendor/chart.umd.js` (205 KB): os mesmos
    graficos da referencia, funcionando offline e imprimindo.
62. **Painel de gestao reescrito** com o layout completo da referencia: 8 KPIs (com o
    **card do desvio mudando de cor inteiro**), evolucao acumulada com 3 series, barras
    agrupadas por analista e por dia, lancamento do dia como ajuste, frentes
    superado/pendente, historico diario com status e botao editar, e **operacao ao vivo**
    (em andamento agora, aguardando troca, incidentes, tempo medio por etapa e
    atingimento por analista).
63. **Ao vivo**: ciclo automatico de 15/30/60s com indicador de ultima atualizacao,
    contagem para o proximo ciclo e botao de pausar/retomar. Com token ele puxa do GitHub
    a cada ciclo; sem token, trabalha em modo local.
64. **Impressao do painel** embutindo os graficos como imagem, mais backup com todos os
    numeros e **importacao do historico antigo** (arquivos do `ImplementarAuto` e backups
    do painel anterior) convertendo tudo em ajustes.
65. **Acoplamento corrigido**: o `check-ids` por pagina revelou que o `gestao.html`
    carregava o `reports.js`, que depende do DOM do modal do `index.html`. A media por
    etapa passou a ser calculada dentro do proprio painel e o modulo saiu da pagina.
66. **Testes**: o smoke test subiu de **105 para 119** verificacoes, cobrindo ajustes
    somando ao derivado, limite em zero, remocao de ajuste zerado, observacao da daily,
    frentes, payload de gestao e a serie do burndown cortando o futuro.

---

## Resultado da validacao

Executado por `tools/validate.ps1` (Edge headless sobre servidor local):

| Etapa | Resultado |
|---|---|
| Verificacao de IDs (por pagina) | 2 paginas, 287 referencias no JS, todas validas |
| Smoke test de logica | **144/144 testes aprovados** |
| Carregamento da aplicacao real | 31/31 verificacoes aprovadas |
| Painel de gestao do gerente | 31/31 verificacoes aprovadas |

---

## Pendente / observacoes

**Painel de gestao entregue** com o layout do status report do gestor, nas cores deste
projeto e alimentado automaticamente pelos mesmos dados. O fluxo antigo â€” cada analista
preenchia o formulario e enviava o JSON para o gestor consolidar â€” deixa de ser
necessario, mas os arquivos originais ficaram na raiz como referencia.

Ponto de atencao aberto: **as 4 etapas de bancada nao existem no processo atual do
cliente** (que trabalha com preparadas/trocadas). Elas vieram do `GuiaDev.md` e foram
mantidas a pedido. Se a equipe nao usar o cronometro por etapa na pratica, vale reavaliar
se elas devem continuar no formulario ou virar um modo opcional.



## Como gerar o timelapse em imagens

```powershell
powershell -ExecutionPolicy Bypass -File tools\timelapse.ps1
powershell -ExecutionPolicy Bypass -File tools\timelapse.ps1 -IntervalSeconds 15 -Frames 60 -Scale 50
```

Os frames vao para `docs/timelapse/frame-NNNN.png` e o visualizador fica em
`docs/timelapse/index.html`.

## Observacoes

- O projeto esta pronto para publicacao manual no GitHub Pages ou em hospedagem estatica semelhante.
- Com o token do GitHub configurado, os dados sao versionados automaticamente no repositorio.
  Sem token, o sistema continua funcionando localmente e ainda le os dados publicados.
- O export/import manual de JSON foi mantido de proposito, como reserva obrigatoria.
- O arquivo serve como registro funcional da atualizacao, atendendo ao pedido de
  acompanhamento do processo.
