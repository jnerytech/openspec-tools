## Why

Este repositório especifica 255 scenarios em 88 requirements, distribuídos por dez
capabilities, e sustenta nove testes — todos escritos para um único requirement de
`artifact-ordering`. Os outros 243 scenarios não têm nada que falhe quando o
comportamento que eles descrevem parar de valer.

Isso não é uma dívida abstrata. `commit-convention-rule` afirma que o texto do
usuário no mesmo arquivo *"permanece byte a byte igual"*; `artifact-language` e
`claude-workflow-directives` afirmam o mesmo sobre `openspec/config.yaml` e
`CLAUDE.md`. Essas promessas são cumpridas por splicing de linhas em
`src/region-yaml.ts` e `src/region-markdown.ts`, código que edita arquivos que o
usuário escreveu e que hoje não tem um único teste. A promessa de maior
consequência do pacote é a menos protegida.

E o portão que existe não checa o que deveria: `.githooks/pre-commit` roda
`npm test`, que é `tsx --test` — que apaga tipos sem verificá-los. `tsc` só roda em
`npm run compile`, que nada obriga. Um erro de tipo passa por todo o portão atual
sem encostar em nada.

## What Changes

- Uma capability nova define o portão de qualidade do próprio repositório: o que
  ele mede, quando ele recusa, e o que ele não é.

- **O denominador do portão passa a ser o scenario, não a linha.** Num repositório
  spec-driven os scenarios já são o plano de teste: estão escritos em Gherkin,
  revisados, e dizem em que condição cada comportamento vale. Cobertura de linha
  responde "quanto código rodou"; cobertura de scenario responde "que promessa
  está defendida". Cobertura de linha continua sendo medida, como diagnóstico para
  encontrar código não exercitado, mas não é o critério que decide o portão.

- **O mapeamento de scenario para teste é derivado do código, nunca declarado à
  parte.** Um teste nomeia a capability e o título do scenario que cobre, e essa
  nomeação é conferida contra a spec durante a própria execução: um título que não
  existe em `openspec/specs/` faz o teste falhar. Isso é o que impede o mapa de
  apodrecer — renomear um scenario quebra na mesma rodada o teste que o cobria, em
  vez de deixar um documento em silêncio desatualizado.

- **Um scenario que nenhum teste alcança é declarado, com razão, em vez de
  omitido.** A capability `change-summary` especifica um `SKILL.md`: são 28
  scenarios sobre um prompt, não sobre TypeScript, e nenhum teste de código chega
  lá. Sem uma categoria explícita para isso o portão nasceria impossível de
  satisfazer, e a saída seria baixar o piso até ele não significar mais nada.

- **`tsc` entra no portão**, antes da suíte, fechando o buraco em que um erro de
  tipo atravessa o pre-commit inteiro.

- Uma suíte de unidade cobre o código que é função pura e hoje está descoberto,
  começando pelo splicing de regiões, que é o de maior consequência.

- Os caminhos de erro do CLI — código de saída, ordem das mensagens, sugestão de
  digitação — passam a ser cobertos por testes que executam o binário compilado
  como subprocesso, sem que nenhum código de produção seja alterado para isso.

- **Não está no escopo: trocar `process.exit(1)` por exceção tipada.** Esse
  refactor tornaria os caminhos de erro testáveis dentro do processo, mas altera
  código cujo comportamento `cli-interface` já especifica em 45 scenarios que hoje
  nenhum teste sustenta. Refatorar antes da rede existir é mexer às cegas
  exatamente onde há mais promessa e menos proteção. Fica para uma change própria,
  que já nascerá sobre os testes que esta instala.

- **Não está no escopo: oferecer o portão como componente do `init`.** O que esta
  change constrói é a engenharia deste repositório, não uma funcionalidade do
  `opsx-tools`. A distinção já existe no repositório: `commit-convention-rule`
  declara que o pacote não instala hook de Git, e ainda assim este repositório tem
  o seu próprio em `.githooks/`. Enforcement é interno; nunca produto.

- **Não está no escopo: integração contínua.** O portão é local, roda no
  pre-commit, e permanece pulável com `--no-verify` — deliberadamente, como o hook
  já documenta. Levar o portão para um servidor é uma decisão separada, com
  consequências próprias, e não é pré-requisito de nada aqui.

## Capabilities

### New Capabilities

- `quality-gates`: o portão de qualidade do próprio repositório — o que ele mede
  (scenarios especificados cobertos por teste, e não percentual de linha), como o
  mapeamento entre scenario e teste é derivado e conferido de modo que não possa
  ficar desatualizado, como um scenario fora do alcance de teste de código é
  declarado com razão em vez de omitido, que verificações compõem o portão e em
  que ordem, e o que o portão deliberadamente não é: não é componente
  provisionável, não é integração contínua, e não é uma barreira impossível de
  contornar.

### Modified Capabilities

Nenhuma. Nada do que esta change constrói altera o que o `opsx-tools` faz para
quem o usa: nenhum comando novo, nenhuma opção nova, nenhuma saída diferente. Os
testes de subprocesso observam os códigos de saída e as mensagens que
`cli-interface` já especifica, sem mudá-los; é justamente por não mudarem que
servem de rede para o refactor que virá depois.

## Impact

- `.githooks/pre-commit`: passa a rodar a verificação de tipos e o portão de
  cobertura de scenario, além da suíte.
- `package.json`: scripts para a verificação de tipos, para a cobertura de linha
  como diagnóstico e para o portão. Nenhuma dependência nova de runtime; a
  cobertura já é fornecida pelo Node 22 que o repositório exige.
- `src/**/*.test.ts`: arquivos de teste novos, ao lado dos módulos que cobrem,
  seguindo a colocação que `scanner.test.ts` e `renderer.test.ts` já usam.
- `src/test-fixture.ts`: ganha o utilitário que nomeia e confere o scenario
  coberto, ao lado do `withTree` que já existe.
- Nenhum arquivo sob `src/` que não seja de teste é modificado. Nenhuma capability
  existente muda de comportamento.
- Consequência de fluxo, deliberada: uma vez que o portão exista, arquivar uma
  change passa a exigir teste para os scenarios que ela torna canônicos. Enquanto
  a spec vive em `openspec/changes/` ela não conta para o denominador; o portão
  passa a cobrá-la no momento em que `openspec archive` a promove para
  `openspec/specs/`. Escrever spec continua livre; arquivá-la passa a custar o
  teste correspondente.
