## Why

O portão de qualidade deste repositório mede scenarios cobertos e chegou a
249/255, com 28 declarados fora de alcance. A cobertura de linha ficou ao lado,
como diagnóstico, e hoje marca 95,51% de linha, 87,40% de ramo e 94,50% de
função.

Os dois números medem coisas diferentes, e a distância entre eles é informação.
Um scenario coberto diz que uma promessa tem teste; uma linha coberta diz que
aquele código rodou. Um módulo pode ter todos os seus scenarios cobertos e ainda
guardar um ramo que nenhum teste atravessa — `region-yaml.ts` está em 100% de
linha e 79,35% de ramo, e é o código que edita arquivos que o usuário escreveu,
sob promessa de preservação byte a byte.

Mas o diagnóstico atual **mente por omissão**, de duas formas:

- **A medição não atravessa o `spawn`.** `server.ts` aparece com 38,11% e
  `cli.ts` com 69,76%, e ambos estão largamente testados — por subprocesso, que a
  instrumentação não enxerga. Quem lê a tabela conclui que o servidor não tem
  teste, o que é falso.
- **O denominador encolhe.** Só os módulos que algum teste carregou entram no
  relatório. Apagar o último teste de um módulo o remove da tabela e *sobe* a
  média. É exatamente por isso que a capability `quality-gates` proíbe hoje um
  piso sobre essa medida.

A segunda é a que impede o piso. Ela não é uma propriedade da cobertura de linha;
é uma propriedade de *como ela está sendo medida aqui*. Com o denominador fixado
no conjunto de arquivos de produção — e não no conjunto que por acaso foi
carregado — a objeção deixa de valer, e o piso passa a ser honesto: apagar um
teste faz o número cair.

## What Changes

- **A cobertura de linha, de ramo e de função passa a ser 100%, e o portão passa
  a recusar abaixo disso.** As três colunas, não só a primeira. Ramo é a cara: é
  onde moram as guardas defensivas.

- **O denominador passa a ser fixo:** todo arquivo de produção sob `src/` conta,
  tenha ou não sido carregado por algum teste. Um arquivo que nenhum teste
  importa entra no relatório como zero, em vez de desaparecer dele. É o que torna
  o piso próprio, e é a razão pela qual `quality-gates` pode ser modificada sem
  contradizer o argumento que a levou a proibir o piso.

- **A cobertura passa a ser somada através dos subprocessos.** Verificado que a
  variável de ambiente de cobertura do V8 atravessa o `spawn`: os processos
  filhos gravam cobertura bruta e um passo soma tudo. `server.ts` e `cli.ts`
  passam a contar o que já é testado hoje, sem nenhum teste novo.

- **A suíte passa a rodar sobre o JavaScript compilado, não sob `tsx`.**
  Verificado que a diretiva de exclusão de cobertura do Node funciona em JS
  executado por `node` e **não** funciona através do `tsx`. Sem ela não há como
  marcar uma guarda defensiva como deliberadamente não exercitada, e 100% de ramo
  vira ou teste contorcido ou remoção de código defensivo correto. A compilação
  já existe: é a mesma que a verificação de tipos produz e que os testes de
  subprocesso já executam.

- **Uma exclusão de cobertura exige razão escrita, como um scenario fora de
  alcance.** A categoria já existe para scenarios e provou-se estreita — 28
  entradas, uma capability. A mesma disciplina passa a valer para linha e ramo:
  toda exclusão aparece no diff com o porquê ao lado.

- **`process.exit(1)` dá lugar a uma exceção tipada nos caminhos de erro do
  CLI.** É o refactor que a change anterior adiou por escrito — *"fica para uma
  change própria, que já nascerá sobre os testes que esta instala"*. A rede
  existe: 45 scenarios de `cli-interface` estão cobertos e observam código de
  saída e ordem de mensagem. O comportamento observável não muda; o que muda é
  onde o processo termina, que passa a ser um único lugar.

- **Não está no escopo: trocar o critério de scenario coberto.** Ele continua
  sendo o primeiro critério e o que responde "que promessa está defendida". A
  cobertura de linha entra como segundo piso, sobre a pergunta diferente que ela
  sabe responder: "que código nunca rodou".

- **Não está no escopo: integração contínua.** O portão segue local e segue
  contornável, como já está escrito no hook.

## Capabilities

### Modified Capabilities

- `quality-gates`: a cobertura de linha deixa de ser apenas diagnóstico e passa a
  ser um segundo critério, com denominador fixo no conjunto de arquivos de
  produção e não no conjunto carregado; a medição passa a somar o que os
  subprocessos executam; e uma exclusão de cobertura passa a exigir razão
  registrada, como já vale para um scenario fora de alcance.

## Impact

- `package.json`: o script da suíte passa a executar o JavaScript compilado; um
  script novo soma a cobertura dos subprocessos.
- `src/gate/`: o somador de cobertura e a verificação do piso.
- `src/usage.ts`, `src/component.ts`, `src/server.ts`, `src/main.ts`: o refactor
  de `process.exit` para exceção tipada. **É a primeira change deste repositório
  a alterar código de produção desde que o portão existe** — e a rede que a
  torna segura é a que a change anterior instalou.
- `dist/`: reconstruído, por consequência do refactor.
- Consequência de fluxo, deliberada: um arquivo de produção novo passa a recusar
  o commit até ter teste, em vez de entrar no repositório sem nenhum. É o mesmo
  contrato que já vale para um scenario, aplicado ao código.
