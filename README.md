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
│  ├─ index.html             -> interface completa
│  ├─ css/styles.css         -> tema TOTVS azul escuro soft
│  └─ js/
│     ├─ storage.js          -> estado, usuarios, lotes, maquinas, permissoes, senhas
│     ├─ reports.js          -> metricas, dashboard e relatorios imprimiveis
│     ├─ importer-exporter.js-> exportacoes TSV / WhatsApp / JSON
│     ├─ github-sync.js      -> sincronizacao com o GitHub (Contents API)
│     └─ app.js              -> integracao da interface com tudo acima
├─ data/                     -> banco de dados versionado no repositorio
│  ├─ dados-gerais.json      -> indice geral (gerente)
│  ├─ usuarios.json          -> usuarios sem hash de senha (gerente)
│  └─ analistas/<usuario>.json
├─ tests/smoke.html          -> auto-teste de logica (53 verificacoes)
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

## Fluxo manual (reserva)

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
