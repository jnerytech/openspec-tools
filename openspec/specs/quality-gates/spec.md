# quality-gates Specification

## Purpose
Define o portão de qualidade do próprio repositório `openspec-tools`: o que ele
mede — scenarios especificados que têm teste, e não percentual de linha —, como a
correspondência entre um scenario e o teste que o cobre é derivada do código e
conferida de modo que não possa ficar desatualizada, como um scenario fora do
alcance de um teste de código é declarado com razão em vez de omitido, que
verificações compõem o portão e em que ordem elas recusam, e o que o portão
deliberadamente não é.
## Requirements
### Requirement: O denominador é o que já é canônico, não o que está em planejamento

Somente os scenarios sob `openspec/specs/` SHALL contar para o portão. Os
scenarios que uma change ainda em planejamento declara em seus próprios arquivos
de delta, sob `openspec/changes/`, SHALL NOT contar enquanto a change não for
arquivada.

Isso mantém livre o ato de especificar e cobra o teste no momento em que o
comportamento passa a valer para o repositório: arquivar uma change promove seus
scenarios para o denominador, e a partir daí eles são exigidos como qualquer
outro.

#### Scenario: Uma change em planejamento não é cobrada

- **QUANDO** uma change aberta declara scenarios em seus arquivos de delta e nenhum teste os cobre
- **ENTÃO** o portão não recusa por causa deles

#### Scenario: Arquivar promove os scenarios ao denominador

- **QUANDO** uma change é arquivada e seus scenarios passam a constar sob `openspec/specs/`
- **ENTÃO** esses scenarios passam a ser exigidos pelo portão como qualquer outro

### Requirement: Um teste declara qual scenario cobre, e a declaração é conferida contra a spec

Um teste que cobre um scenario SHALL declarar qual, nomeando a capability e o
título literal do scenario. A correspondência SHALL ser derivada dessa declaração
no próprio código de teste e SHALL NOT ser mantida em um documento separado, que
poderia divergir do código sem que nada o notasse.

A declaração SHALL ser conferida contra os arquivos de spec durante a execução dos
testes: uma declaração que nomeie uma capability inexistente, ou um título de
scenario que não conste da spec daquela capability, SHALL fazer a execução falhar.
O par capability mais título literal identifica um scenario sem ambiguidade, e a
conferência é o que impede a correspondência de apodrecer — renomear um scenario
quebra, na mesma execução, o teste que o cobria, em vez de deixá-lo silenciosamente
apontando para nada.

#### Scenario: Um título inexistente derruba a execução

- **QUANDO** um teste declara cobrir um scenario cujo título não consta da spec da capability nomeada
- **ENTÃO** a execução dos testes falha
- **E** o relato nomeia a capability e o título declarado

#### Scenario: Renomear um scenario quebra o teste que o cobria

- **QUANDO** o título de um scenario é alterado na spec e o teste que o cobria continua declarando o título anterior
- **ENTÃO** a execução dos testes falha

#### Scenario: A correspondência não é mantida à parte

- **QUANDO** a correspondência entre scenarios e testes é consultada
- **ENTÃO** ela é derivada das declarações no código de teste e dos arquivos de spec
- **E** nenhum arquivo separado precisa ser editado à mão para mantê-la correta

### Requirement: Um scenario fora do alcance de um teste de código é declarado com razão

Um scenario que nenhum teste de código pode cobrir SHALL ser declarado como tal,
acompanhado da razão pela qual está fora de alcance. A capability
`change-summary` especifica o conteúdo de um arquivo de instrução lido por um
agente, e não o comportamento de código deste pacote; seus scenarios são o caso
que motiva esta categoria.

Um scenario que não esteja coberto por teste nem declarado fora de alcance SHALL
fazer o portão recusar. Uma declaração sem razão SHALL ser tratada como ausente.
A declaração existe para tornar a ausência de teste visível e justificada; sem
ela, um portão impossível de satisfazer seria resolvido baixando o critério até
ele não significar mais nada.

#### Scenario: Um scenario nem coberto nem declarado faz recusar

- **QUANDO** a spec de uma capability declara um scenario que nenhum teste cobre e que não consta como fora de alcance
- **ENTÃO** o portão recusa
- **E** o relato nomeia esse scenario

#### Scenario: Um scenario declarado fora de alcance não faz recusar

- **QUANDO** um scenario está declarado fora de alcance com a razão registrada
- **ENTÃO** o portão não recusa por causa dele

#### Scenario: Uma declaração sem razão não vale

- **QUANDO** um scenario consta como fora de alcance sem razão registrada
- **ENTÃO** ele é tratado como não declarado e o portão recusa

### Requirement: A cobertura já obtida não pode regredir

O conjunto de scenarios cobertos SHALL ser registrado por capability, e o portão
SHALL recusar quando um scenario que constava como coberto deixar de estar. A
verificação SHALL ser feita sobre o conjunto de scenarios, e não sobre a
quantidade deles, de modo que cobrir um scenario novo não compense a perda da
cobertura de outro.

Um scenario SHALL deixar de ser exigido sem que isso seja uma regressão apenas
quando ele próprio deixar de constar em `openspec/specs/`, ou seja, quando o
comportamento que ele descrevia for removido da spec.

#### Scenario: Perder a cobertura de um scenario faz recusar

- **QUANDO** um scenario constava como coberto e o teste que o cobria é removido ou deixa de declará-lo
- **ENTÃO** o portão recusa, nomeando esse scenario

#### Scenario: Cobrir outro scenario não compensa a perda

- **QUANDO** a cobertura de um scenario é perdida e a de outro é acrescentada na mesma alteração
- **ENTÃO** o portão recusa

#### Scenario: Remover o scenario da spec não é regressão

- **QUANDO** um scenario deixa de constar em `openspec/specs/` junto com o teste que o cobria
- **ENTÃO** o portão não recusa por causa dele

### Requirement: A verificação de tipos precede a suíte e recusa por si só

O portão SHALL verificar os tipos do código antes de executar a suíte, e SHALL
recusar quando essa verificação falhar, independentemente de a suíte passar. A
suíte é executada por um runner que remove as anotações de tipo sem conferi-las,
de modo que um erro de tipo atravessa a execução dos testes sem ser notado; sem
uma verificação própria, ele atravessaria o portão inteiro.

#### Scenario: Um erro de tipo recusa mesmo com a suíte passando

- **QUANDO** o código tem um erro de tipo e todos os testes passam
- **ENTÃO** o portão recusa
- **E** o relato aponta o erro de tipo

#### Scenario: A verificação de tipos vem antes

- **QUANDO** o portão é executado e a verificação de tipos falha
- **ENTÃO** o portão recusa sem que o resultado da suíte seja necessário para decidir

### Requirement: O relato de uma recusa nomeia o que falta

Ao recusar, o portão SHALL nomear o que precisa ser feito para satisfazê-lo: quais
scenarios estão descobertos, sob que capability cada um está, e qual verificação
falhou. Um relato que apenas informe que o portão recusou obriga quem o recebeu a
reconstruir por conta própria a lista que o portão já tinha.

#### Scenario: Os scenarios descobertos são listados

- **QUANDO** o portão recusa por scenarios descobertos
- **ENTÃO** cada scenario descoberto é nomeado junto da capability a que pertence

#### Scenario: A verificação que falhou é identificada

- **QUANDO** o portão recusa
- **ENTÃO** o relato diz qual verificação falhou

### Requirement: O portão roda antes de cada commit e é contornável deliberadamente

O portão SHALL ser executado antes de cada commit, a partir do diretório de hooks
versionado do repositório. Ele SHALL permanecer contornável pela opção do Git que
pula os hooks, e essa possibilidade SHALL constar por escrito junto do hook, como
uma escolha deliberada de quem contorna e não como uma falha do portão.

#### Scenario: Um commit passa pelo portão

- **QUANDO** um commit é feito no repositório
- **ENTÃO** o portão é executado antes de o commit ser criado
- **E** um portão que recusa impede a criação do commit

#### Scenario: Contornar é possível e está escrito

- **QUANDO** o hook é lido
- **ENTÃO** ele registra que a opção do Git que pula os hooks contorna o portão deliberadamente

### Requirement: O portão é interno ao repositório e não é produto

O portão SHALL ser engenharia deste repositório e SHALL NOT ser oferecido como
funcionalidade do `opsx-tools`. Nenhum componente provisionável SHALL instalá-lo,
nenhum subcomando SHALL expô-lo, e nada dele SHALL ser escrito em um projeto de
usuário.

A mesma linha já está traçada no repositório: `commit-convention-rule` declara que
o pacote não instala hook de Git, e ainda assim este repositório mantém o seu em
seu diretório de hooks versionado. O que o pacote entrega a outros projetos e o
que este repositório impõe a si mesmo são coisas distintas, e confundi-las
transformaria uma decisão de engenharia interna em uma promessa a terceiros.

#### Scenario: Nenhum componente provisiona o portão

- **QUANDO** os componentes que o `init` oferece são listados
- **ENTÃO** nenhum deles instala o portão, o hook que o executa ou qualquer de suas verificações

#### Scenario: Nenhum subcomando expõe o portão

- **QUANDO** os subcomandos do `opsx-tools` são listados
- **ENTÃO** nenhum deles executa o portão

#### Scenario: Nada do portão alcança um projeto de usuário

- **QUANDO** um projeto de usuário é provisionado
- **ENTÃO** nenhum arquivo do portão é escrito nele

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

