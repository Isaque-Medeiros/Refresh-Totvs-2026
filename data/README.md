# Pasta de dados do TOTVS Field Refresh 2026

Esta pasta guarda os dados do sistema **dentro do proprio repositorio**, para que
tudo apareca versionado no GitHub e seja lido por todos que abrirem o site publicado.

## Estrutura

| Arquivo | Quem grava | Conteudo |
|---|---|---|
| `dados-gerais.json` | Gerente | Indice geral: lotes, organizacao, manifest dos analistas e todos os registros |
| `usuarios.json` | Gerente | Usuarios do sistema **sem hash de senha** (id, usuario, nome, **e-mail**, perfil, ativo) |
| `gestao.json` | Gerente | Ajustes do lancamento diario, observacoes da daily e frentes (superado/pendente) |
| `analistas/<usuario>.json` | Cada analista | Arquivo individual com os registros daquele analista |

## Como funciona

- **Envio automatico:** cada analista configura uma vez o token do GitHub no app
  (botao *Sync / Exportar*). A partir disso, todo salvamento grava direto aqui.
- **Regra anti-conflito:** cada analista escreve **somente o proprio arquivo**.
  O gerente escreve o `dados-gerais.json` e o `usuarios.json`. Assim dois
  analistas nunca disputam a mesma gravacao.
- **Leitura publica:** ao abrir o sistema, ele tenta carregar estes arquivos
  publicados. Se o token estiver configurado, ele baixa pela API (mais atual);
  se nao estiver, faz a leitura publica dos JSON publicados no GitHub Pages.
- **Export manual continua disponivel:** os botoes de download no modal de sync
  geram exatamente os mesmos arquivos, caso voce prefira subir na mao.

## Conflitos

O merge e feito por `id` do registro, e a versao com `updatedAt` **mais recente vence**.
Nenhum dado local mais novo e perdido, e o hash de senha **nunca** e sobrescrito
por um arquivo remoto.

## Nao coloque token aqui

O token do GitHub fica salvo no `localStorage` de cada navegador, nunca no repositorio.
