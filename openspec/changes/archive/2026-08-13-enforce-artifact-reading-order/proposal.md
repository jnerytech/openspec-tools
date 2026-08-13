## Why

A capability `artifact-ordering` diz que o reader apresenta os artefatos de uma
change na ordem em que ela é melhor entendida — summary, proposal, specs,
design, tasks, review. A regra existe, está implementada e está correta. Só que
ela mora em `src/scanner.ts`, e um dos caminhos do servidor não passa por lá.

Quando o reader é apontado para uma change específica — `opsx-tools read
<nome-da-change>`, ou um caminho de diretório dentro de `openspec/changes/` — o
servidor monta o objeto da change à mão em `src/server.ts:85`, chamando
`collectMarkdownFiles` e entregando a lista crua ao renderizador. Nenhuma
ordenação é aplicada. A página sai na ordem do disco:

```
alvo = a change             design, proposal, review, spec, spec, spec, spec, summary, tasks
alvo = nenhum (índice)      summary, proposal, spec…, design, tasks, review
```

A mesma change, lida de dois jeitos, recomenda dois caminhos de leitura
diferentes — e o `summary.md`, escrito exatamente para orientar quem chega, cai
no meio da página. O modo `dir`, que serve uma pasta qualquer de Markdown, tem o
mesmo furo em `src/server.ts:98`.

O defeito é de implementação, não de spec: o requisito nunca distinguiu como a
change foi alcançada. Mas o requisito também nunca disse isso em voz alta, e foi
por esse vão que o bug entrou. Pior: o repositório não tem um único teste, então
nada percebeu a divergência entre os dois caminhos, e nada perceberia a próxima.
Corrigir a ordem sem fechar esse vão é consertar o sintoma e deixar a causa.

## What Changes

- A ordenação passa a ser aplicada na **camada de apresentação**, em
  `renderChange`, e não apenas no scanner. Toda rota que renderiza uma change
  — índice, `/change/:slug`, `/archived/:slug` e o modo de change única —
  recebe a mesma ordem, porque passam todas pelo mesmo ponto. O scanner
  continua ordenando, para o subtítulo do índice, mas deixa de ser a única
  linha de defesa.
- O modo `dir` (pasta genérica de Markdown) passa a usar a mesma ordem de
  leitura em `renderFiles`. Uma pasta que não é change não tem `summary.md`
  nem `proposal.md`, então na prática nada muda para ela; o que muda é não
  haver mais dois comportamentos para explicar.
- O requisito de ordem ganha uma exigência explícita de **independência do
  alvo**: a ordem é a mesma qualquer que seja o caminho pelo qual a change foi
  alcançada.
- O repositório ganha sua **primeira suíte de testes**, com o runner nativo
  `node:test`, cobrindo a ordem de leitura: as posições nomeadas, a change
  incompleta, o artefato desconhecido no fim, o desempate estável e — o caso
  que teria pego este bug — a igualdade entre os dois caminhos de serviço.
- O repositório ganha um **hook de `pre-commit` versionado** em `.githooks/`,
  ativado por `git config core.hooksPath .githooks`, que roda a suíte antes de
  cada commit. Sem dependência nova: o hook é um script `sh` de poucas linhas.
- `package.json` ganha o script `test`, e o `README` ganha a linha de ativação
  do hook, que é manual por clone — é assim que `core.hooksPath` funciona.
- **Fora de escopo**: provisionar o hook via `opsx-tools init`. Seria um
  componente novo, com região delimitada, diff e desinstalação, como os demais
  — uma change própria. Aqui o hook é ferramenta deste repositório, não algo
  que o pacote entrega a terceiros.
- **Fora de escopo**: cobrir de teste qualquer outra parte do pacote. A suíte
  nasce cobrindo a ordem e nada mais; ampliá-la é trabalho contínuo, não desta
  change.

## Capabilities

### New Capabilities

Nenhuma. A suíte de testes e o hook de `pre-commit` são ferramental de
desenvolvimento deste repositório, não comportamento do produto que o pacote
entrega: não mudam o que `opsx-tools` faz, não aparecem em nenhuma invocação e
não são instalados em projeto nenhum. Specs descrevem comportamento, e escrever
uma capability para o hook seria inventar requisito. Eles ficam registrados no
design, com as decisões que os produziram, e no `tasks.md`.

### Modified Capabilities

- `artifact-ordering`: o requisito da ordem nomeada passa a exigir que ela
  valha independentemente de como a change foi alcançada — servida sozinha,
  aberta a partir do índice, ou aberta a partir do arquivo. Hoje o requisito é
  silencioso sobre isso, e o silêncio foi lido como se só o índice importasse.

## Impact

- `src/renderer.ts`: `renderChange` e `renderFiles` passam a ordenar o que
  recebem.
- `src/scanner.ts`: o comparador deixa de ser privado, para poder ser usado
  pelo renderizador e pelos testes.
- `src/server.ts`: os dois pontos que hoje entregam lista crua
  (`kind: "change"` e `kind: "dir"`) deixam de depender de ordenar por conta
  própria.
- `package.json`: script `test`. Nenhuma dependência nova — `node:test` é do
  Node e `tsx` já está em `devDependencies`.
- `.githooks/pre-commit`: novo, versionado e executável.
- `README.md`: a linha de ativação do hook.
- Páginas afetadas: apenas as servidas em modo de change única e em modo `dir`.
  Quem lê pelo índice já via a ordem correta e não percebe diferença.
