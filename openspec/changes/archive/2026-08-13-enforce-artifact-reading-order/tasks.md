## 1. A suíte nasce reprovando o código atual

- [x] 1.1 Adicionar o script `"test": "tsx --test src/**/*.test.ts"` ao `package.json`, sem nenhuma dependência nova — `node:test` vem do Node e `tsx` já está em `devDependencies`
- [x] 1.2 Confirmar que o glob realmente expande no ambiente: rodar `npm test` com um teste trivial e verificar que a contagem de testes executados é maior que zero, e não um comando vazio passando em silêncio — o padrão **precisa estar entre aspas**, porque o `sh` não expande `**` recursivo e deixaria de fora justamente os testes em `src/*.test.ts`; entre aspas quem expande é o runner do Node
- [x] 1.3 Criar `src/scanner.test.ts` com um utilitário de fixture que monta uma change em `mkdtemp(os.tmpdir())`, escreve os `.md` pedidos — inclusive em `specs/<capability>/spec.md` — e remove tudo no fim — a fixture ficou em `src/test-fixture.ts`, e não dentro do arquivo de teste: importar um `.test.ts` de outro faria seus testes rodarem duas vezes
- [x] 1.4 Escrever em `src/renderer.test.ts` o teste que reprova o código de hoje: entregar a `renderChange` uma lista de artefatos fora de ordem e afirmar que o sumário "On this page" sai como summary, proposal, spec, design, tasks, review
- [x] 1.5 Rodar `npm test` e confirmar que 1.4 **falha** antes de qualquer correção — um teste que já passa não é o teste deste bug — 3 de 4 reprovaram no código intocado

## 2. Uma ordem só, no ponto por onde tudo passa

- [x] 2.1 Exportar `compareArtifacts` de `src/scanner.ts`, mantendo a regra num comparador único
- [x] 2.2 Fazer `renderChange` ordenar a lista que recebe, em `src/renderer.ts`, antes de montar o sumário e as seções — as duas listagens saem da mesma sequência
- [x] 2.3 Fazer `renderFiles` ordenar do mesmo modo, para o modo `dir`
- [x] 2.4 Manter a ordenação em `scanChanges` e `scanArchivedChanges`: `renderIndex` mostra os nomes dos artefatos no subtítulo sem passar por `renderChange`
- [x] 2.5 Deixar `collectMarkdownFiles` como está, devolvendo a ordem de leitura do diretório: coletar e ranquear seguem sendo coisas diferentes
- [x] 2.6 Rodar `npm test` e confirmar que 1.4 agora **passa** — 4 de 4 passam

## 3. Os testes que fecham o requisito

- [x] 3.1 Change completa: summary, proposal, um spec, design, tasks e review saem exatamente nessa ordem
- [x] 3.2 Change incompleta: só proposal, um spec e tasks — saem nessa ordem, sem que a ausência dos outros abra buraco
- [x] 3.3 Artefato fora da ordem nomeada: um `.md` desconhecido sai depois de todos os nomeados e não separa dois nomeados
- [x] 3.4 Desempate estável: uma change com quatro delta specs devolve a mesma sequência em leituras repetidas do diretório inalterado
- [x] 3.5 Independência do alvo: montar a mesma change pelos dois caminhos — a lista crua de `collectMarkdownFiles`, como faz o modo de change única, e o resultado de `scanChanges`, como faz o índice — e afirmar que `renderChange` produz a mesma ordem nos dois
- [x] 3.6 Paridade aberto/arquivado: uma change aberta e uma arquivada com os mesmos artefatos saem na mesma ordem

## 4. O portão

- [x] 4.1 Criar `.githooks/pre-commit`: script `sh` com `set -e` que roda `npm test`, e dar-lhe permissão de execução (`chmod +x`, versionado pelo Git)
- [x] 4.2 Adicionar `"prepare": "git config core.hooksPath .githooks || true"` ao `package.json`, para que o hook se ative sozinho no `npm install` local, e não quebre onde não há repositório Git
- [x] 4.3 Rodar `npm install` num clone limpo e confirmar que `git config core.hooksPath` passa a devolver `.githooks` — verificado pelo `npm run prepare`, que é o que o `install` dispara: em diretório recém-inicializado grava `.githooks`, sem `.git` sai com 0 graças ao `|| true`, e o `core.hooksPath` global segue vazio
- [x] 4.4 Provar o portão nas duas direções: quebrar de propósito uma asserção, confirmar que o commit é recusado, restaurar e confirmar que o commit passa — a recusa foi provada com um `git commit` real (1 teste falhando, nada entrou no histórico); a direção verde foi provada rodando `.githooks/pre-commit` diretamente (`exit=0`), sem criar commit, porque commitar esta change ainda não foi pedido
- [x] 4.5 Documentar no `README` a ativação (`git config core.hooksPath .githooks`), o que o `prepare` faz na máquina de quem instala, e a saída consciente `git commit --no-verify`

## 5. Verificação de ponta

- [x] 5.1 Compilar com `npm run compile` e confirmar que nada quebrou na tipagem
- [x] 5.2 Rodar `opsx-tools read <uma-change-com-summary>` apontando direto para a change e conferir na tela que o summary vem primeiro e o review por último — o caminho que originou o bug — a página serve `summary, proposal, spec, design, tasks, review`, contra `design, proposal, review, spec, summary, tasks` que o disco entrega
- [x] 5.3 Rodar `opsx-tools read` sem alvo, abrir a mesma change pelo índice e conferir que a página é idêntica à de 5.2
- [x] 5.4 Repetir 5.2 para uma change arquivada, pelo nome com prefixo de data — e também pelo nome sem o prefixo, que é o outro jeito de alcançá-la
- [x] 5.5 Servir uma pasta genérica de Markdown (modo `dir`) e confirmar que ela continua legível, sem erro e sem ordem estranha
- [x] 5.6 Rodar `openspec validate --strict enforce-artifact-reading-order` e confirmar que o delta de `artifact-ordering` está íntegro
- [x] 5.7 Excluir `src/**/*.test.ts` e `src/test-fixture.ts` do `tsconfig.json`: sem isso o `compile` os leva para `dist/`, e o pacote publicaria seus próprios testes junto com o produto
