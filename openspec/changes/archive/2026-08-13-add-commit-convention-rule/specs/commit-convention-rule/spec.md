## Purpose

Define o componente provisionável que fixa o formato da mensagem de commit do
repositório: onde a regra é escrita para que o Claude Code a leia em toda sessão,
o que ela prescreve e o que proíbe, como o estado dela é lido de volta a partir do
próprio arquivo, como ela é removida sem levar junto o que o usuário escreveu, e o
que o pacote não promete a respeito do agente segui-la.

## ADDED Requirements

### Requirement: A regra é escrita onde o Claude Code lê regras de projeto

A regra SHALL ser escrita em `.claude/rules/commit-convention.md`, relativo à raiz
de projeto resolvida. O componente SHALL criar o diretório `.claude/rules/` quando
ele não existir e SHALL relatar que o criou, informando que um diretório de regras
que não existia quando a ferramenta de IA começou só é percebido depois que ela é
reiniciada. A regra SHALL NOT ser escrita em `CLAUDE.md`, em `AGENTS.md` ou no
arquivo de configuração do OpenSpec.

#### Scenario: A regra vai para o diretório de regras do projeto

- **QUANDO** o usuário provisiona a convenção de commit
- **ENTÃO** a regra é escrita em `.claude/rules/commit-convention.md` sob a raiz de projeto resolvida

#### Scenario: Um diretório de regras ausente é criado e a criação é relatada

- **QUANDO** o projeto não tem `.claude/rules/` e o usuário provisiona a convenção de commit
- **ENTÃO** o diretório é criado
- **E** o relato diz que um diretório de regras que não existia quando a ferramenta de IA começou só é detectado após reiniciá-la

#### Scenario: Os outros arquivos de instrução não são tocados

- **QUANDO** a convenção de commit é provisionada
- **ENTÃO** `CLAUDE.md` permanece inalterado, exista ele ou não
- **E** `AGENTS.md` permanece inalterado, exista ele ou não
- **E** o arquivo de configuração do OpenSpec permanece inalterado

### Requirement: A regra carrega em toda sessão

A regra SHALL ser escrita sem o campo `paths` no frontmatter, de modo que o Claude
Code a carregue no início de toda sessão em vez de apenas ao ler arquivos que
casem com um padrão. Escrever uma mensagem de commit não é a leitura de um arquivo
do projeto, e uma regra escopada por caminho não estaria em contexto no momento em
que a mensagem é redigida.

#### Scenario: Nenhum escopo por caminho é declarado

- **QUANDO** a regra é escrita
- **ENTÃO** ela não declara o campo `paths`

### Requirement: A regra prescreve uma única linha em Conventional Commits

O texto escrito SHALL prescrever que toda mensagem de commit seja **uma única
linha** na forma `tipo(escopo): descrição`, com o escopo opcional e uma marca de
mudança incompatível disponível antes dos dois-pontos. Ele SHALL nomear os tipos
aceitos em vez de apenas remeter à convenção pelo nome, e SHALL fixar a forma da
descrição e um limite de comprimento para a linha, para que a regra seja
verificável por leitura e não por interpretação.

#### Scenario: O formato de uma linha é declarado

- **QUANDO** a regra é lida
- **ENTÃO** ela declara que a mensagem de commit é uma única linha na forma `tipo(escopo): descrição`
- **E** declara que o escopo é opcional
- **E** nomeia os tipos aceitos
- **E** declara um limite de comprimento para a linha

### Requirement: A regra proíbe corpo, footer e trailers

O texto escrito SHALL proibir explicitamente corpo, footer e qualquer trailer
depois da primeira linha, e SHALL nomear o trailer `Co-Authored-By` entre os
proibidos. A instrução padrão do agente produz exatamente essas linhas, e uma
regra que não a contradiz por escrito não altera o resultado.

#### Scenario: O trailer de coautoria é nomeado como proibido

- **QUANDO** a regra é lida
- **ENTÃO** ela proíbe corpo e footer
- **E** proíbe trailers, nomeando `Co-Authored-By` explicitamente

### Requirement: A regra ocupa uma região delimitada do arquivo

O texto SHALL ser escrito dentro de uma região delimitada que o pacote reconhece
pelos seus próprios delimitadores, e não por semelhança com o que ele escreve.
Tudo que estiver fora dos delimitadores SHALL ser preservado sem alteração. O
componente SHALL localizar a região apenas pelos delimitadores; um arquivo em que
os delimitadores estejam ausentes, duplicados ou fora de ordem SHALL ser relatado
como não editável com segurança, e nada SHALL ser escrito nele.

#### Scenario: Texto do usuário no mesmo arquivo é preservado

- **QUANDO** `.claude/rules/commit-convention.md` já existe com texto que o pacote não escreveu e a convenção é provisionada
- **ENTÃO** esse texto permanece byte a byte igual
- **E** a região do pacote é escrita sem se misturar a ele

#### Scenario: Delimitadores danificados impedem a escrita

- **QUANDO** o arquivo contém um delimitador de abertura sem o de fechamento, mais de um par, ou o fechamento antes da abertura
- **ENTÃO** o componente relata que o arquivo não pode ser editado com segurança, nada é escrito e o processo termina com código 1

### Requirement: O estado é lido do próprio arquivo

O componente SHALL relatar seu estado comparando o que está no arquivo com o que
o pacote escreveria: **ausente**, **provisionado**, **diferente do que o pacote
escreve**, ou **não editável com segurança**. Esse estado SHALL ser derivado do
arquivo a cada consulta e SHALL NOT depender de qualquer registro deixado por um
provisionamento anterior.

#### Scenario: Uma regra editada à mão é relatada como diferente

- **QUANDO** a região existe mas seu conteúdo difere do que o pacote escreve
- **ENTÃO** o componente relata a regra como diferente, e não simplesmente como provisionada

#### Scenario: Uma regra idêntica é relatada como provisionada

- **QUANDO** a região existe e seu conteúdo é o que o pacote escreve
- **ENTÃO** o componente relata a regra como provisionada
- **E** aplicar a seleção sem alterá-la não escreve nada

#### Scenario: Substituir uma regra editada é mostrado como diff

- **QUANDO** o usuário provisiona a convenção sobre uma região que foi editada à mão
- **ENTÃO** a diferença é relatada e as linhas adicionadas e removidas são mostradas antes da confirmação

### Requirement: Remover tira a regra e não mais do que ela

Desmarcar o componente SHALL remover a região do arquivo. Quando o arquivo tiver
sido criado pelo pacote e nada restar nele além da região removida, o arquivo
SHALL ser apagado; quando o arquivo já existia ou contiver outro texto, ele SHALL
ser mantido com o restante intacto. A remoção SHALL NOT apagar nenhum outro
arquivo de `.claude/rules/` e SHALL NOT apagar o diretório.

#### Scenario: Um arquivo criado pelo pacote sai inteiro

- **QUANDO** o pacote criou o arquivo, ele contém apenas a região, e o usuário desmarca o componente
- **ENTÃO** o arquivo é apagado

#### Scenario: Um arquivo do usuário é mantido

- **QUANDO** o arquivo contém texto que o pacote não escreveu e o usuário desmarca o componente
- **ENTÃO** apenas a região é removida e o restante do arquivo permanece inalterado

#### Scenario: Outras regras não são tocadas

- **QUANDO** `.claude/rules/` contém outros arquivos de regra e o componente é removido
- **ENTÃO** esses arquivos não são listados, não são oferecidos para remoção e não são modificados
- **E** o diretório `.claude/rules/` não é apagado

### Requirement: O componente é apenas de projeto

A convenção de commit SHALL ser provisionada somente na raiz de projeto resolvida.
Nenhum outro destino SHALL ser oferecido para ela, em particular o diretório de
regras do usuário, e nada SHALL ser escrito fora do projeto.

#### Scenario: Nenhum destino de usuário é oferecido

- **QUANDO** a seleção é apresentada
- **ENTÃO** a convenção de commit não oferece destino além do projeto
- **E** nada é escrito em um diretório de regras sob a pasta pessoal do usuário

### Requirement: A escolha existe também sem um terminal

Provisionar e remover a convenção de commit SHALL ter, cada um, uma opção
equivalente na linha de comando, e SHALL respeitar a opção que responde
afirmativamente a toda confirmação. Um componente que o usuário não nomeou SHALL
ser deixado exatamente como está.

#### Scenario: Provisionar sem prompt

- **QUANDO** o usuário fornece a opção que provisiona a convenção de commit junto da opção que responde às confirmações, com a entrada não sendo um terminal
- **ENTÃO** a regra é escrita sem que nenhuma pergunta seja feita e o processo termina com código 0

#### Scenario: Remover sem prompt

- **QUANDO** o usuário fornece a opção que remove a convenção de commit junto da opção que responde às confirmações
- **ENTÃO** a região é removida sem que nenhuma pergunta seja feita e o processo termina com código 0

#### Scenario: Um componente não nomeado é deixado como está

- **QUANDO** o usuário nomeia outro componente na linha de comando e não nomeia a convenção de commit
- **ENTÃO** `.claude/rules/commit-convention.md` não é escrito nem apagado

### Requirement: A regra é uma instrução, não um mecanismo de enforcement

O pacote SHALL ser responsável pela regra estar presente, correta e removível, e
SHALL NOT afirmar que ela impede um commit fora do formato. O componente SHALL
NOT instalar hook de Git, hook do Claude Code ou qualquer verificador de mensagem,
e SHALL NOT executar nenhum outro programa para provisionar, relatar ou remover a
regra.

#### Scenario: Nada além do arquivo é provisionado

- **QUANDO** a convenção de commit é provisionada
- **ENTÃO** nenhum hook de Git é instalado, nenhuma configuração de hook do Claude Code é escrita e nenhum outro programa é executado

#### Scenario: O relato não promete obediência

- **QUANDO** o componente é descrito ao usuário
- **ENTÃO** a descrição apresenta a regra como uma instrução escrita para o agente ler, e não como uma restrição imposta a ele
