## Context

Ver `proposal.md` — Why para o defeito e para a divergência entre os dois
caminhos de serviço.

O que importa aqui é a forma do código hoje:

```
src/scanner.ts     compareArtifacts()  ← privado, a regra de ordem vive aqui
                   scanChanges()            .sort(compareArtifacts)  ✅
                   scanArchivedChanges()    .sort(compareArtifacts)  ✅
                   collectMarkdownFiles()   ← devolve ordem de readdir

src/server.ts:85   kind:"change"  →  collectMarkdownFiles()  →  renderChange()  ❌
src/server.ts:98   kind:"dir"     →  collectMarkdownFiles()  →  renderFiles()   ❌
src/server.ts:120  /change/:slug  →  scanChanges()           →  renderChange()  ✅
src/server.ts:141  /archived/:slug→  scanArchivedChanges()   →  renderChange()  ✅
```

Quatro rotas renderizam uma change; duas ordenam. A garantia está a uma camada
de distância do lugar onde o requisito fala ("o reader apresenta"), e é essa
distância que o bug ocupou.

Duas restrições de fundo: o pacote tem hoje três dependências de runtime e três
de desenvolvimento, e nenhuma infraestrutura de teste — não há runner, script
`test`, fixture ou hook. Tudo o que esta change acrescenta nasce do zero, e o
que for escolhido aqui vira o padrão do repositório.

## Goals / Non-Goals

**Goals:**

- Uma ordem só, garantida num ponto por onde toda rota que mostra uma change
  obrigatoriamente passa.
- Um teste que falharia hoje, no código atual, e que passa depois do fix — não
  um teste escrito para o código consertado.
- Um portão que roda essa suíte sem ninguém precisar lembrar.
- Custo de dependência zero, coerente com o tamanho atual do pacote.

**Non-Goals:**

- Cobertura de teste de qualquer outra parte do pacote.
- Rodar `tsc`, lint ou formatação no hook. Não existe lint neste repositório, e
  um portão que faz mais do que foi pedido é um portão que as pessoas contornam.
- Fazer o hook funcionar sem nenhuma ativação. Git não versiona `.git/hooks/`;
  nenhuma solução sem dependência elimina a ativação, ela só pode ser barata e
  automática o suficiente (ver Decisão 4).

## Decisions

### Decisão 1 — A ordem é aplicada no renderizador, não no servidor

`renderChange` ordena a lista que recebe, e `renderFiles` também. As quatro
rotas passam a herdar a ordem por construção, e uma quinta rota que apareça
amanhã já nasce ordenada.

Isso exige exportar `compareArtifacts` de `src/scanner.ts` — hoje privado. O
scanner continua ordenando: `renderIndex` mostra os nomes dos artefatos no
subtítulo de cada change a partir de `change.artifacts`, sem passar por
`renderChange`, e essa lista também precisa sair na ordem certa.

A ordem passa então a ser aplicada em dois lugares, o que parece redundância —
e é, deliberadamente. A regra é uma só, num comparador só; o que se duplica é a
aplicação. Ordenar uma lista já ordenada custa nada e é idempotente, enquanto
uma rota que esquece de ordenar custou exatamente este bug.

*Alternativas consideradas:*

- **Ordenar dentro de `collectMarkdownFiles`.** Um lugar só, fecha os quatro
  chamadores de uma vez. Rejeitada por dois motivos: a função é recursiva e
  passaria a ordenar em cada nível para o pai reordenar tudo no fim, e o nome
  promete coletar, não ranquear — um chamador futuro que queira a ordem do
  disco perde a opção sem perceber.
- **Exportar `sortArtifacts()` e chamar nos dois pontos do `server.ts`.** É a
  correção mínima e conserta o bug de hoje. Rejeitada porque deixa a regra
  opcional para quem escrever a próxima rota: é a mesma configuração que
  produziu o defeito, com um chamador a menos.

### Decisão 2 — `node:test` rodado por `tsx`

`"test": "tsx --test src/**/*.test.ts"`. Zero dependência nova: o runner é do
Node 20+, que o `engines` já exige, e `tsx` já está em `devDependencies` e já é
usado pelo script `dev`. Os testes ficam ao lado do código que testam
(`src/scanner.test.ts`), padrão que o repositório ainda não tem e que esta
change estabelece.

*Alternativa considerada:* **Vitest** — melhores mensagens de falha, watch,
TypeScript sem intermediário. Rejeitada pelo peso: uma dependência de
desenvolvimento grande e um arquivo de configuração, num pacote com três
dependências de runtime, para uma suíte que hoje tem um punhado de asserções
sobre ordem de strings. A porta continua aberta: migrar de `node:test` para
Vitest é reescrever `assert.deepEqual` como `expect().toEqual`, não repensar a
suíte.

### Decisão 3 — Fixtures em diretório temporário, criadas pelo teste

Cada teste cria sua change com `mkdtemp` em `os.tmpdir()`, escreve os `.md`
vazios de que precisa e remove tudo no fim.

O motivo é um requisito específico: a ordem não pode depender da ordem de
leitura do diretório. Provar isso exige controlar quais arquivos existem e com
que nomes — inclusive casos que o repositório real não tem, como uma change com
artefato desconhecido, ou uma change com quatro delta specs.

*Alternativas consideradas:*

- **Apontar os testes para `openspec/changes/` deste repositório.** Fixture de
  graça, mas o teste passa a falhar quando alguém arquiva uma change ou escreve
  um `summary.md` — falha por mudança de conteúdo, não de comportamento.
- **Fixtures versionadas em `test/fixtures/`.** Estáveis, porém invisíveis: o
  leitor do teste precisa abrir outra pasta para saber o que está sendo
  ordenado. Com `mkdtemp` a fixture está escrita na própria asserção.

### Decisão 4 — Hook versionado em `.githooks/`, ativado por `core.hooksPath`

`.githooks/pre-commit` é um script `sh` versionado que roda `npm test` e falha
o commit com `set -e`. A ativação é `git config core.hooksPath .githooks`, uma
vez por clone.

Para que "uma vez por clone" não vire "ninguém ativou", o `package.json` ganha
`"prepare": "git config core.hooksPath .githooks || true"`. O `prepare` roda no
`npm install` local, então quem clona e instala fica com o hook ativo sem ler
o README. O `|| true` é o que impede que a instalação quebre onde não há
repositório Git — um tarball extraído, um contexto de CI sem `.git`.

A ativação também vai para o `README`, porque um `prepare` silencioso que
configura Git na máquina de quem instala precisa estar escrito em algum lugar.

*Alternativas consideradas:*

- **husky.** Faz exatamente isso, com auto-instalação, e é o que o mercado
  reconhece. Rejeitada porque o valor que ela agrega sobre quatro linhas de
  `sh` — hooks compartilhados, ordenação, integração com lint-staged — é valor
  que este repositório não usa; sobra a dependência.
- **Escrever direto em `.git/hooks/pre-commit`.** Sem configuração nenhuma, mas
  também sem versionamento: o hook deixa de existir para todo mundo que não o
  copiou à mão, que é a situação que se quer evitar.

### Decisão 5 — O teste que teria pego este bug é sobre o renderizador

Além dos testes de ordem no comparador, um teste entrega ao `renderChange` uma
lista **fora de ordem** e verifica a sequência do sumário ("On this page") no
HTML produzido. É a asserção que reprova o código atual, porque o defeito nunca
esteve no comparador — esteve em quem não o chamou.

*Alternativa considerada:* **subir o servidor numa porta efêmera e comparar as
duas rotas via HTTP.** Cobre o caminho inteiro, ponta a ponta, e seria o teste
mais fiel. Rejeitada por agora: exige ciclo de vida de servidor e porta dentro
de um `pre-commit`, e a invariante que interessa — o renderizador ordena o que
recebe, venha de onde vier — é verificável sem nada disso. Fica como ampliação
natural quando a suíte crescer.

## Risks / Trade-offs

- **O `prepare` mexe na configuração Git de quem instala o pacote** →
  `core.hooksPath` é local ao repositório, escrito em `.git/config` e nunca
  global; `|| true` cobre o caso sem `.git`. O README declara o comportamento.
- **Ordenar em dois lugares pode divergir se alguém editar um dos dois** → o
  que se duplica é a chamada, não a regra: existe um comparador só, exportado.
  Uma segunda ordem exigiria escrever um segundo comparador de propósito.
- **O hook atrasa cada commit** → a suíte é pequena e roda em segundos; `tsx`
  não faz type-check, só transpila. Se um dia doer, o `--no-verify` do próprio
  Git continua sendo a saída, e é saída consciente.
- **`tsx --test src/**/*.test.ts` depende de expansão de glob do shell** → em
  ambientes sem glob recursivo o padrão não expande e o comando roda vazio,
  passando sem testar. A task de implementação verifica que a suíte realmente
  executa (contagem de testes > 0) antes de dar o script por pronto.
- **O modo `dir` passa a ranquear arquivos de uma pasta que não é change** →
  efeito nulo na prática, porque o ranqueamento só reordena nomes conhecidos
  (`summary`, `proposal`, `spec`, `design`, `tasks`, `review`) e o resto cai no
  desempate por slug, que é a ordem alfabética que já se via.
