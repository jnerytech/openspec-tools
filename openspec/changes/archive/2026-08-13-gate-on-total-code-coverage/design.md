## Context

Ver `proposal.md` — Why para a motivação. O que segue são os fatos verificados
neste repositório que moldam o como. Todos foram medidos antes de a change ser
escrita, e cada um elimina uma alternativa.

- **A cobertura do V8 atravessa o `spawn`.** Com a variável de ambiente de
  cobertura do V8 definida, um processo que gera outro produz um arquivo de
  cobertura bruta por processo. Verificado: dois arquivos para pai e filho.
- **A diretiva de exclusão do Node não sobrevive ao `tsx`.** Um bloco marcado
  como excluído continua contando como não coberto quando o arquivo é executado
  por `tsx`, e é corretamente excluído quando o mesmo código roda como JS sob
  `node`. Esse único fato decide a mudança de runner.
- **Comentário de topo não conta como linha descoberta.** Verificado num arquivo
  isolado: um bloco de documentação de cinco linhas não reduz o percentual. As
  faixas do tipo `1-13` que hoje aparecem para `out-of-scope.ts` e
  `pipeline.ts` têm outra causa, e o passo 1 é o que a estabelece.
- O estado atual, por arquivo, tem duas formas distintas de buraco: módulos
  exercitados só por subprocesso (`server.ts` 38,11%, `cli.ts` 69,76%) e ramos
  defensivos em módulos com 100% de linha (`region-yaml.ts` 79,35% de ramo,
  `scanner.ts` 77,61%).
- A suíte leva ~6 s, dos quais ~4 s são subprocessos. A compilação para
  verificação leva ~1 s e já acontece a cada execução do portão.

**Medido depois do passo 2**, com os mesmos 333 casos: sob `tsx` ~6,0 s, sobre o
JS compilado ~5,6 s. A queda é de ~7%, e não a que este documento esperava. O
motivo é o mesmo fato da linha acima, que estava escrito aqui e não foi levado a
sério: o custo dominante são os subprocessos, não a inicialização do `tsx`. Dentro
do portão a compilação já era paga pela verificação de tipos, de modo que ali a
troca é ganho líquido; isolada, `npm test` fica ~0,6 s mais lenta por passar a
compilar antes.

**Medido depois do passo 3**: ~6,1 s, com 350 casos. A frase acima — "quem corta
esse custo é o passo 3" — também estava errada, e por uma razão que a própria
change decidiu: o teste de processo separado **permanece**, porque é o que
verifica o código de saída que `cli-interface` especifica. Os testes em processo
somam aos de subprocesso em vez de substituí-los, e a suíte fica mais lenta, não
mais rápida.

O que o passo 3 entrega não é tempo, é verdade: `server.ts` sai de 38,11% para
66,49% e `cli.ts` de 69,76% para 72,75% sem que um único comportamento novo tenha
passado a ser testado — os dois já estavam cobertos, e a medição é que não
enxergava. Perseguir o tempo aqui custaria apagar verificação de código de saída,
que é o oposto do que esta change existe para fazer.

## Goals / Non-Goals

**Goals:**

- Um número de cobertura em que se possa confiar: que suba quando código é
  testado e caia quando teste é apagado.
- Toda exclusão de cobertura visível no diff, com razão ao lado.
- O comportamento observável do CLI inalterado pelo refactor. Os 45 scenarios de
  `cli-interface` são a rede, e nenhum deles pode mudar de sentido.

**Non-Goals:**

- Substituir o critério de scenario coberto. Ele responde "que promessa está
  defendida" e continua sendo o primeiro a recusar.
- Perseguir 100% em código de teste. O denominador é o código de produção; os
  arquivos de teste continuam relatados e fora do piso.

## Decisions

### O denominador é o conjunto de arquivos, não o conjunto carregado

É a decisão que sustenta todas as outras, e a que responde à objeção que a
própria `quality-gates` registra hoje: um piso sobre uma medida cujo denominador
encolhe sobe ao se remover cobertura.

O somador enumera os arquivos de produção a partir do disco — o que a
configuração de publicação compila — e não a partir do relatório. Um arquivo sem
nenhum dado de cobertura entra como zero, em vez de não entrar. Apagar o último
teste de um módulo passa a derrubar o número, que é o comportamento que torna um
piso honesto.

**Alternativas consideradas:**

- *A opção de inclusão por padrão de caminho do próprio Node.* Já verificada na
  change anterior: não traz para o relatório um arquivo que ninguém importou. Ela
  filtra o que está lá, não acrescenta o que falta.
- *Um módulo que importa todos os outros, carregado pela suíte.* Resolve o
  denominador e mente sobre o resto: um arquivo importado e nunca chamado passa a
  contar suas linhas de topo como cobertas.

### A suíte roda sobre o JavaScript compilado

Decorre de um fato medido, não de preferência: a diretiva que marca um bloco como
deliberadamente não exercitado é ignorada quando o código passa pelo `tsx`, e
funciona quando o mesmo código roda como JS sob `node`. Sem ela, 100% de ramo só
é alcançável testando toda guarda defensiva — inclusive as que existem para nunca
acontecer, como o `throw` que mantém honesto o tipo de retorno de uma busca por
id fechado — ou removendo código defensivo correto. As duas saídas são piores que
o problema.

A compilação já existe e já é paga: é a mesma que a verificação de tipos produz, e
é dela que sai o binário que os testes de subprocesso executam. A suíte passa a
executar o mesmo artefato, o que também elimina o custo de inicialização do `tsx`
por arquivo de teste.

**Alternativas consideradas:**

- *Manter `tsx` e não excluir nada.* Empurra o custo para o teste: cada guarda
  defensiva ganha um caso artificial que existe só para o contador.
- *Manter `tsx` e remover as guardas.* Troca um número por robustez real. O
  `catch` que faz um caminho irresolvível ainda virar identidade existe por uma
  razão escrita no código.
- *Trocar por uma ferramenta de cobertura de terceiros.* Uma dependência nova
  para resolver o que o runtime já resolve, e que reintroduz a questão do
  denominador na configuração dela.

### A tabela do Node decide; o lcov só ajuda a achar o lugar

Descoberto ao levar o ramo à totalidade: **a tabela que o Node imprime não diz
onde um ramo não exercitado está.** Ela lista posições de linha e, para ramo e
função, apenas percentuais. Sem isso, perseguir ramo é tentativa e erro.

O reporter lcov dá as posições, em registros `BRDA`. Mas ele e a tabela
discordam: um bloco marcado como excluído sai da tabela e **continua aparecendo
como não tomado** no `BRDA`, embora os totais `BRF`/`BRH` do mesmo arquivo já
contem a exclusão. Verificado em `skill-destinations.ts`, que a tabela dá como
100% e o lcov ainda aponta na linha 55.

A consequência para o verificador é direta: **a tabela é a autoridade** — é ela
que honra as exclusões —, e o lcov entra como auxílio de diagnóstico para achar
o lugar, com a ressalva de que suas posições incluem o que foi excluído. O
relato de recusa nomeia posição onde a medição a fornece, e nomeia arquivo e
medida onde não fornece.

### Uma linha sem código executável não pode ser exigida

O shebang de `main.ts`, uma linha em branco entre blocos e a própria linha de uma
diretiva de exclusão aparecem como não cobertas: não há execução que as alcance
porque não há nada nelas para executar. Nenhuma diretiva as resolve — a de
`main.ts` não pode preceder o shebang, que tem de ser a primeira linha do
arquivo.

O verificador desconta essas linhas em vez de o código se contorcer para
satisfazê-las. É uma regra com razão, e geral: o piso exige que todo código de
produção seja exercitado, e uma linha que não é código não é exercitável.

**Descoberto também**: a diretiva tem de vir **antes** do comentário que a
justifica. Um bloco de comentário entre o código anterior e a diretiva fica fora
da região desabilitada e conta como descoberto — o oposto da ordem que a
convenção de scenario usa.

### Uma exclusão de cobertura exige razão, como um scenario fora de alcance

A categoria de "fora de alcance" para scenarios provou-se estreita na prática: 28
entradas, todas de uma capability, uma razão só. A mesma forma é aplicada à
cobertura — a exclusão fica no código, junto do bloco que ela cobre, com a razão
ao lado.

Isso importa mais aqui do que lá: uma exclusão de cobertura é bem mais fácil de
espalhar do que uma de scenario, porque é uma linha de comentário e não uma
entrada num arquivo que alguém revisa. A mitigação é a mesma e é fraca de
propósito: aparece no diff, e a lista é curta o bastante para que crescer chame
atenção.

### O refactor de `process.exit` acontece agora, e não antes

A proposta anterior o adiou por escrito, e a razão que deu era boa: refatorar 45
scenarios de código de saída e ordem de mensagem antes de existir um teste é
mexer às cegas onde há mais promessa e menos proteção. Essa condição deixou de
valer — os 45 estão cobertos, por subprocesso, e observam exatamente o que o
refactor não pode mudar.

A troca é de mecanismo, não de comportamento: os caminhos de erro lançam uma
exceção tipada e um único lugar a converte em código de saída. O ganho de
cobertura é consequência, não motivo: o motivo é que hoje um caminho de erro só é
observável gerando um processo, o que custa ~4 s da suíte.

**Alternativa considerada:** *deixar como está e cobrir por subprocesso.* É o que
já se faz, e é o que mantém a suíte lenta. O piso de 100% seria alcançável assim
— a soma através do `spawn` resolve a medição —, mas manteria o custo por caso.

### O piso é verificado depois do de scenario, não antes

A ordem do portão passa a ser: tipos, suíte, scenario coberto, cobertura de
linha. O critério de scenario vem primeiro porque responde à pergunta mais
importante, e porque seu relato é acionável — nomeia a promessa descoberta. O
piso de linha vem depois e nomeia arquivo e linha.

Os dois recusam. Nenhum substitui o outro: 100% de linha com um scenario
descoberto continua sendo recusa, e todo scenario coberto com uma linha morta
também.

## Risks / Trade-offs

- **100% vira um número que se persegue em vez de um que se merece** → O risco
  real desta change. Cobertura total convida ao teste que executa sem asseverar,
  que sobe o contador e não defende nada. Mitigação parcial: o critério de
  scenario continua primeiro, e ele exige que o teste nomeie a promessa que
  cobre. Não é detectável por máquina, e está registrado como Non-Goal na
  capability desde a change anterior.

- **A exclusão de cobertura pode virar lixeira** → Mais fácil de espalhar que a
  de scenario, por ser um comentário. A razão é obrigatória e aparece no diff.
  Um crescimento dessa lista é sinal a olhar em revisão.

- **Trocar o runner muda como todo teste executa** → A suíte inteira passa a
  rodar sobre outro artefato. Se um teste depender de detalhe do `tsx`, quebra
  aqui. É trabalho de uma vez, e a suíte de 333 casos é o que diz se quebrou.

- **O refactor toca código de produção que 45 scenarios especificam** → É a razão
  pela qual ele foi adiado, e a rede que faltava agora existe. Se algum daqueles
  scenarios falhar durante o refactor, é o mecanismo funcionando.

- **O piso de 100% recusa um arquivo de produção novo até ter teste** → A
  consequência pretendida, e a mais cara. Escrever código passa a custar o teste
  no mesmo commit.

- **A soma através de subprocessos depende de uma variável de ambiente do V8** →
  Não é uma interface estável de contrato. Se mudar numa versão futura do Node, o
  número cai de repente e o portão recusa sem que nada tenha piorado. O relato
  precisa distinguir "não coberto" de "não medido".
