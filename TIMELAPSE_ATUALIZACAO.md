# Timelapse da Atualizacao

## Objetivo

Registrar, em formato resumido, a evolucao da atualizacao da interface e da logica do projeto TOTVS Field Refresh 2026.

## Linha do tempo

1. Leitura e consolidacao das diretrizes do `GuiaDev.md`.
2. Revisao dos arquivos correlatos da interface para evitar regressao de clique e fluxo.
3. Estruturacao da nova tela com identidade visual soft em azul escuro e contornos em azul claro.
4. Inclusao de fluxo de login por perfil com gerente e analistas.
5. Centralizacao do estado no `storage.js`, com controle de lotes, usuarios, permissoes e trilha de auditoria.
6. Adequacao do cadastro em lote de hostnames com suporte a reaproveitamento de registros por hostname.
7. Inclusao de data de cronometragem, incidentes tecnicos e observacoes por maquina.
8. Implementacao dos cronometros por etapa e do tempo total por registro.
9. Criacao dos relatórios geral e individual com modo de impressao para PDF.
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
    base64 UTF-8 correto (preserva acentos como *FORMATAÇÃO*) e fila serializada com
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

## Resultado da validacao

Executado por `tools/validate.ps1` (Edge headless sobre servidor local):

| Etapa | Resultado |
|---|---|
| Verificacao de IDs (JS x HTML) | 161 referencias no JS, todas apontando para IDs existentes |
| Smoke test de logica | **53/53 testes aprovados** |
| Carregamento da aplicacao real | 12/12 verificacoes aprovadas |

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
