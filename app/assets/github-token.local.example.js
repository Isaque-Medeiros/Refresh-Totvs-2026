/*
 * TOTVS Field Refresh 2026 - Token local do GitHub (arquivo de EXEMPLO)
 * ---------------------------------------------------------------------------
 * O token NUNCA vai para o repositorio: como o site e estatico e o repositorio
 * e publico, o GitHub bloqueia o envio (protecao a segredos) e qualquer pessoa
 * poderia usar o token.
 *
 * Para o sistema se vincular sozinho nesta maquina, sem pedir nada ao analista:
 *
 *   1. Copie este arquivo para:  app/assets/github-token.local.js
 *   2. Cole o token fine-grained dentro das aspas abaixo.
 *
 * Use um token fine-grained limitado a este repositorio, com
 * "Contents: Read and write". Se preferir nao usar arquivo, basta abrir o modal
 * "Sync / Exportar" uma vez nesta maquina e salvar o token por la.
 *
 * O arquivo real (github-token.local.js) esta no .gitignore e nao deve ser
 * publicado. Este exemplo pode ser versionado.
 */
window.TOTVS_GITHUB_TOKEN = 'github_pat_cole_o_seu_token_aqui';
