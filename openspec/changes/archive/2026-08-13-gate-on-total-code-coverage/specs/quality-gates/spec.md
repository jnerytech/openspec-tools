## REMOVED Requirements

### Requirement: O portão mede scenarios cobertos, não percentual de linha

**Reason**: A segunda metade deste requirement — que percentual de linha SHALL
NOT ser o critério que faz o portão recusar — é exatamente o que esta change
inverte. Os dois scenarios que a sustentavam afirmam o contrário do que passa a
valer: um diz que nenhum piso de linha participa da decisão, o outro que um valor
baixo de linha, por si só, não faz recusar.

O argumento que levou a proibir o piso continua correto e não é descartado: uma
medida cujo denominador é o conjunto de módulos carregados sobe ao se remover
cobertura, e um piso sobre ela é impróprio. O que muda é o denominador, não o
julgamento — ele passa a ser o conjunto de arquivos de produção, fixo, e é isso
que torna o piso honesto. O requirement que entra no lugar carrega essa condição
explicitamente.

**Migration**: A primeira metade — o critério de scenario coberto, com
denominador em `openspec/specs/` — é preservada palavra por palavra no requirement
"O portão mede scenarios cobertos e cobertura total de código", que a mantém como
o primeiro dos dois critérios e como o primeiro a ser verificado. Nenhuma
cobertura de scenario deixa de ser exigida. A obrigação de relatar a cobertura de
linha também é preservada, e reforçada: passam a ser relatadas as três medidas,
em toda execução, e não apenas a de linha.

## ADDED Requirements

### Requirement: O portão mede scenarios cobertos e cobertura total de código

O portão SHALL decidir sobre dois critérios, e SHALL recusar quando qualquer um
deles falhar.

O primeiro critério SHALL ser quantos scenarios especificados têm um teste que os
cobre. O denominador SHALL ser o conjunto de scenarios declarados nos arquivos de
spec canônicos do repositório, sob `openspec/specs/`. Este critério SHALL ser
verificado antes do segundo, porque nomeia qual promessa está descoberta, o que é
mais acionável do que nomear uma linha.

O segundo critério SHALL ser a cobertura de código: linha, ramo e função SHALL
todas alcançar a totalidade do código de produção. Cobrir uma promessa e nunca
executar um ramo são falhas distintas, e nenhuma das duas medidas substitui a
outra: um scenario descoberto SHALL recusar ainda que a cobertura de código seja
total, e código não exercitado SHALL recusar ainda que todo scenario esteja
coberto.

#### Scenario: Um scenario descoberto recusa mesmo com cobertura total de código

- **QUANDO** todo o código de produção é exercitado e um scenario especificado não tem teste que o cobre
- **ENTÃO** o portão recusa
- **E** o relato nomeia esse scenario

#### Scenario: Código não exercitado recusa mesmo com todo scenario coberto

- **QUANDO** todo scenario especificado tem teste e alguma linha, ramo ou função de produção não é exercitada
- **ENTÃO** o portão recusa
- **E** o relato nomeia o arquivo e a posição

#### Scenario: O critério de scenario é verificado primeiro

- **QUANDO** o portão recusa por scenario descoberto e por código não exercitado ao mesmo tempo
- **ENTÃO** o relato apresenta primeiro o scenario descoberto

### Requirement: A cobertura de código é medida sobre um conjunto de arquivos fixo

O denominador da cobertura de código SHALL ser o conjunto de arquivos de produção
do repositório, determinado a partir do que é compilado para publicação, e SHALL
NOT ser o conjunto de arquivos que algum teste carregou.

Um arquivo de produção que nenhum teste importa SHALL constar do relatório com
cobertura nula, e SHALL NOT ser omitido dele. Um denominador formado pelos
arquivos carregados encolhe quando um teste é apagado, de modo que um piso sobre
ele subiria ao se remover cobertura; fixá-lo no conjunto de arquivos é o que torna
o piso próprio.

Arquivos de teste e o código do próprio portão SHALL ser relatados e SHALL NOT
contar para o piso, porque o que o piso protege é o que o pacote entrega.

#### Scenario: Um arquivo que nenhum teste carrega conta como descoberto

- **QUANDO** um arquivo de produção não é importado por nenhum teste
- **ENTÃO** ele consta do relatório com cobertura nula
- **E** o portão recusa por causa dele

#### Scenario: Apagar um teste faz a cobertura cair

- **QUANDO** o último teste que exercitava um módulo é removido
- **ENTÃO** a cobertura relatada para esse módulo cai
- **E** o portão recusa

#### Scenario: O código de teste e o do portão ficam fora do piso

- **QUANDO** a cobertura é verificada
- **ENTÃO** os arquivos de teste e o código do próprio portão são relatados
- **E** não fazem o portão recusar por não alcançarem a totalidade

### Requirement: O código de produção é exercitado onde a medição o enxerga

Todo código de produção SHALL ser exercitado dentro do processo em que a
cobertura é medida. Um teste que observa um processo separado — para verificar um
código de saída, ou o que foi escrito em cada saída — MAY existir além disso, e
SHALL NOT ser o único exercício de um código de produção.

A medição não atravessa a fronteira do processo: um módulo exercitado apenas em
um processo gerado é relatado como não exercitado, ainda que esteja coberto. Isso
faz o relatório afirmar o contrário do que é verdade, e é o que tornaria o número
inútil como critério.

Um caminho de erro SHALL, portanto, ser alcançável sem terminar o processo, de
modo que o teste que o exercita possa rodar dentro do processo de medição. Onde o
comportamento especificado é o término em si, o teste em processo separado
permanece como verificação adicional daquele término.

#### Scenario: Nenhum código de produção é exercitado apenas fora da medição

- **QUANDO** a cobertura é medida
- **ENTÃO** nenhum módulo de produção depende de um processo gerado para ser exercitado

#### Scenario: O teste de processo separado permanece como verificação adicional

- **QUANDO** o comportamento especificado é o código de saída de uma invocação
- **ENTÃO** existe um teste que executa o binário e observa esse código de saída
- **E** o mesmo caminho é também exercitado dentro do processo de medição

#### Scenario: Cobertura não medida é distinguida de cobertura ausente

- **QUANDO** algum dado de cobertura esperado não pode ser obtido
- **ENTÃO** o relato distingue esse caso de um código que não foi exercitado
- **E** não apresenta o código como descoberto

### Requirement: Uma exclusão de cobertura é declarada com razão

Um trecho de código deliberadamente não exercitado SHALL ser marcado como
excluído da cobertura, e a marca SHALL ser acompanhada da razão pela qual aquele
trecho não é alcançável por teste. Uma marca sem razão SHALL ser tratada como
ausente, de modo que o trecho volte a contar como não exercitado.

A exclusão SHALL ficar junto do trecho que ela cobre, e SHALL NOT ser mantida em
um arquivo separado, pelo mesmo motivo que a correspondência entre scenario e
teste não é: apagar o trecho apaga a exclusão junto.

#### Scenario: Um trecho excluído com razão não faz recusar

- **QUANDO** um trecho está marcado como excluído da cobertura com a razão registrada
- **ENTÃO** o portão não recusa por causa dele

#### Scenario: Uma exclusão sem razão não vale

- **QUANDO** um trecho está marcado como excluído sem razão registrada
- **ENTÃO** ele é tratado como não excluído e o portão recusa

#### Scenario: A exclusão vive junto do código que ela cobre

- **QUANDO** o trecho excluído é removido do código
- **ENTÃO** a exclusão desaparece com ele, sem que nenhum outro arquivo precise ser editado

### Requirement: O relato de uma recusa por cobertura nomeia o que falta

Ao recusar por cobertura de código, o portão SHALL nomear cada arquivo que não
alcança a totalidade, a medida que falhou — linha, ramo ou função — e as posições
não exercitadas. O portão SHALL relatar as três medidas em toda execução, e não
apenas quando recusa.

#### Scenario: O arquivo e a medida que falharam são nomeados

- **QUANDO** o portão recusa por cobertura de código
- **ENTÃO** cada arquivo abaixo da totalidade é nomeado junto da medida que falhou

#### Scenario: As três medidas são relatadas mesmo quando o portão aceita

- **QUANDO** o portão é executado e a cobertura é total
- **ENTÃO** linha, ramo e função são relatadas
