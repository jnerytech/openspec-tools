## Context

Ver `proposal.md` — Why para a motivação, e `specs/quality-gates/spec.md` para o
que o portão deve fazer. O que segue são as restrições concretas do repositório
que moldam o como.

- A suíte roda por `tsx --test`, que remove anotações de tipo sem conferi-las. Os
  nove testes existentes usam `node:test` com `withTree`, um utilitário que monta
  uma árvore descartável em diretório temporário. A colocação é ao lado do módulo
  coberto: `src/scanner.test.ts`.
- O `tsconfig.json` **exclui** `src/**/*.test.ts` e `src/test-fixture.ts`. Isso é
  correto para o que é publicado, mas significa que uma verificação de tipos com
  essa configuração não olha para nenhum arquivo de teste.
- `dist/` é **rastreado pelo Git** — 48 arquivos. Qualquer passo do portão que
  emita para lá produz alteração em arquivo versionado no meio de um commit.
- A cobertura de linha nativa do Node 22 funciona através do `tsx` e reporta
  posições no `.ts` original. Ela instrumenta apenas os módulos que algum teste
  carregou; verificado que a opção de inclusão por padrão de caminho não traz para
  o relatório um arquivo que ninguém importou.
- Os títulos de scenario formam chave única quando qualificados pela capability:
  255 títulos, 251 distintos, as quatro colisões todas entre specs diferentes — os
  três componentes de região compartilham a mesma forma — e nenhuma repetição
  dentro de um mesmo arquivo.
- As specs estão em duas línguas: as anteriores ao provisionamento de
  `artifact-language` em inglês, as posteriores em português.

## Goals / Non-Goals

**Goals:**

- Um portão que seja armável no primeiro commit em que exista, sem exigir que os
  255 scenarios estejam cobertos antes.
- Uma correspondência entre scenario e teste que não possa divergir em silêncio.
- Nenhuma alteração em código de produção. Os testes se adaptam ao código, não o
  contrário.
- O portão não toca `dist/`.

**Non-Goals:**

- Medir qualidade de teste. O portão verifica que um scenario tem teste declarado,
  não que a asserção daquele teste seja boa. Nenhum mecanismo automático distingue
  as duas coisas; a revisão humana continua sendo o lugar disso.
- Abrir navegador. `openBrowserAt` chama um programa externo cuja execução um
  teste não pode observar sem interceptar o sistema; fica sem teste próprio, e
  nenhum scenario o exige isoladamente.

## Decisions

### O critério é o scenario coberto; a cobertura de linha permanece como diagnóstico

**Alternativas consideradas:**

- *Piso de percentual de linha com denominador honesto.* Exigiria resolver antes
  que o relatório só enxerga módulos carregados — seja por um módulo que importa
  todos os outros, seja trocando para uma ferramenta que instrumenta arquivos não
  carregados. Ambos são viáveis, mas o número resultante continuaria respondendo
  "quanto código rodou" e não "que promessa está defendida". Num repositório que
  já mantém 255 scenarios revisados, é o denominador pior dos dois.
- *Os dois em camadas.* Rejeitado por manutenção em dois eixos: um piso de linha
  que nunca decide nada é ruído, e um que decide reintroduz a fragilidade acima.

A cobertura de linha continua a ser produzida porque é boa em uma coisa que a
cobertura de scenario não faz: apontar ramos que nenhum teste exercita dentro de
um módulo que já tem testes. Fica como relatório, fora da decisão.

### A chave de um scenario é a capability mais o título literal

Verificado único no estado atual do repositório. A alternativa — incluir também o
título do requirement — foi rejeitada por acoplar a chave a mais um texto que pode
ser reescrito, dobrando a frequência de quebra sem ganhar poder de
desambiguação que hoje não é necessário.

O casamento é por igualdade literal de string, o que torna o mecanismo indiferente
à língua em que a spec está escrita. Isso importa: as specs estão em duas.

### A declaração vive no teste e é conferida contra a spec durante a execução

**Alternativas consideradas:**

- *Convenção no nome do teste*, com um script casando o texto do nome contra os
  títulos das specs. Não exige utilitário novo, mas o casamento acontece fora da
  execução: um título com erro de digitação vira um scenario silenciosamente não
  coberto, que é exatamente o modo de falha que o mecanismo existe para eliminar.
- *Arquivo de mapeamento à parte*, em YAML ou markdown. Declarativo e legível, e
  apodrece na primeira semana: nada obriga quem apaga um teste a editá-lo.

O utilitário escolhido recebe capability, título e o corpo do teste, e falha
quando o par não consta das specs. Duas propriedades caem daí: o erro de digitação
é pego na hora, e renomear um scenario quebra na mesma rodada o teste que o
cobria. Ele fica em `src/test-fixture.ts`, ao lado de `withTree`, que já é o lugar
onde os utilitários de teste deste repositório moram.

### O portão exige cobertura total, e trava por conjunto e não por contagem

Este desenho previa nascer com 9 scenarios cobertos de 255, e argumentava que um
portão exigindo cobertura total recusaria todo commit desde o primeiro — restando
como saída declarar em massa como "fora de alcance" scenarios que estão
perfeitamente ao alcance, o que transformaria a categoria em lixeira.

A implementação tomou o outro caminho: cobrir os 227 que estão ao alcance, de uma
vez, e deixar fora de alcance apenas os 28 de `change-summary`, que descrevem um
`SKILL.md`. O portão nasce literal — um scenario nem coberto nem declarado
recusa — porque não há nenhum nessa situação. O argumento acima continua correto
sobre o que teria acontecido; ele deixou de se aplicar porque a premissa mudou.

As duas verificações permanecem, e são distintas:

- **Nem coberto nem declarado.** Vale para um scenario que chega depois, seja
  escrito de novo, seja promovido por `openspec archive`. É o que faz arquivar
  uma change custar o teste correspondente.
- **Regressão por conjunto.** O registro versionado guarda, por capability, o
  conjunto coberto; perder um deles recusa. Alternativa rejeitada: *trava por
  contagem*, manipulável de forma trivial — apagar o teste de um scenario difícil
  e cobrir um fácil mantém o número e perde a proteção. A verificação por conjunto
  nomeia exatamente o scenario perdido.

A segunda é redundante enquanto a cobertura for total, e deliberadamente mantida:
ela é o que ainda protege se um scenario um dia for declarado fora de alcance, ou
se a exigência total precisar ser afrouxada.

O registro é um arquivo versionado, o que faz de toda variação de cobertura — para
mais ou para menos — uma linha visível no diff do commit que a causou.

### Uma compilação única serve à verificação de tipos e à suíte de subprocesso

Três fatos colidem: a verificação de tipos precisa incluir os arquivos de teste,
que o `tsconfig.json` exclui; os testes de subprocesso precisam de um binário
compilado a partir do código atual; e nada do portão pode escrever em `dist/`, que
é versionado.

A saída é uma configuração de compilação própria para verificação, que estende a
de publicação removendo a exclusão dos testes, e emite para um diretório
descartável. Uma execução resolve as duas necessidades: verificar tipos é efeito
de compilar, e o que sai é o binário que os testes de subprocesso executam.
`dist/` não é lido nem escrito pelo portão.

**Alternativas consideradas:**

- *Verificar tipos sem emitir e rodar os subprocessos por `tsx`.* Elimina a
  compilação, mas paga o custo de inicialização do `tsx` em cada processo gerado,
  repetidamente, dentro de um hook de pre-commit.
- *Compilar para `dist/` e exigir que esteja no commit.* Faz o hook alterar
  arquivo versionado durante o commit, que é uma armadilha conhecida, e acopla a
  decisão de commitar à de publicar.
- *Rodar os subprocessos contra o `dist/` que está no repositório.* Ele pode estar
  desatualizado em relação a `src/`, e um teste que passa contra código antigo é
  pior do que teste nenhum, porque afirma o que não verificou.

### Os scenarios de soquete são cobertos por um leitor de verdade

A primeira versão deste desenho os deixava de fora, como dívida visível. A
decisão foi revista durante a implementação: o portão só significa alguma coisa
se o denominador for o conjunto inteiro, e `server-startup` é a capability em que
a distância entre o que a spec promete e o que alguém já verificou era maior — a
ligação em loopback, a substituição de porta ocupada, a recusa de uma porta
pedida, o comando de encaminhamento numa sessão remota.

O que os cobre é o mesmo utilitário de subprocesso do passo 5, estendido para
subir o leitor, esperar pela URL que ele anuncia, fazer requisições e matá-lo ao
final. Cada fixture é uma raiz de projeto própria, então a porta derivada difere
por caso; uma porta pedida é sondada antes de ser usada, porque arquivos de teste
rodam em paralelo. Custo medido: cerca de 4 s dos 6 s da suíte, e é o que
`design.md` já apontava como a primeira coisa a sair do pre-commit se o tempo
deixar de ser tolerável.

**Alternativa considerada:** declarar esses scenarios fora de alcance. Rejeitada
pela mesma razão que a categoria existe: eles estão perfeitamente ao alcance de
um teste, e usá-la aqui a transformaria na lixeira que o resto deste documento
argumenta contra.

### Os caminhos de erro do CLI são cobertos por subprocesso, não por refactor

`usageError` e `applyPlan` chamam `process.exit(1)`, o que impede testá-los dentro
do processo de teste. Trocar isso por exceção tipada é o desenho melhor e está
declarado fora de escopo em `proposal.md`: são 45 scenarios de `cli-interface`
descrevendo códigos de saída e ordem de mensagens, sustentados hoje por nenhum
teste, e refatorar antes da rede existir é alterar às cegas o ponto de maior
promessa e menor proteção. O subprocesso cobre o mesmo comportamento sem tocar em
uma linha de produção, e é o que torna aquele refactor seguro depois.

### A suíte é escrita por raio de explosão, não por facilidade

A ordem em `tasks.md` começa por `region-yaml.ts` e `region-markdown.ts`. Não são
os módulos mais fáceis nem os de pior cobertura: são os que editam arquivos que o
usuário escreveu — `openspec/config.yaml`, `CLAUDE.md`, `.claude/rules/` — por
splicing de linhas, sob uma promessa explícita de preservação byte a byte. Toda
função ali é pura, o que torna esses testes baratos além de valiosos.

### O portão é local e permanece contornável

Não há integração contínua neste repositório, e esta change não a introduz. O
portão roda no diretório de hooks versionado que já existe. Contornar com a opção
que pula hooks continua possível e continua registrado por escrito no hook, como
já está. Um portão local que se pode contornar deliberadamente é honesto sobre o
que é; um que se apresenta como inescapável sem ser convida a ser desligado de vez.

## Risks / Trade-offs

- **A chave é um título de texto, e reescrever specs é comum neste repositório** →
  Toda reescrita de título quebra o teste correspondente. É o mecanismo
  funcionando, não um defeito: a alternativa é o teste continuar apontando para
  nada em silêncio. O custo é real e recai sobre quem reescreve a spec, que é
  quem tem o contexto para reapontar.

- **Um teste pode declarar cobrir um scenario e não asseverá-lo de verdade** →
  Não detectável por máquina. Mitigação: a declaração torna o par
  scenario/asserção visível lado a lado no diff, que é a menor unidade em que uma
  revisão consegue julgar isso. Está registrado como Non-Goal para não ser
  confundido com garantia.

- **A categoria "fora de alcance" pode virar lixeira** → A razão é obrigatória e
  aparece no diff. Hoje o único caso é `change-summary`, cujos scenarios
  descrevem um arquivo de instrução lido por um agente. Um crescimento dessa lista
  é sinal a ser olhado em revisão, não algo que o portão possa julgar sozinho.

- **O pre-commit fica mais lento: compilação mais suíte mais subprocessos** →
  Medido: verificação de tipos ~1 s, testes de unidade ~0,7 s, subprocessos e
  leitores ~4 s, portão inteiro ~7 s. A previsão de que a compilação dominaria
  estava errada; o custo está nos subprocessos, que é justamente a parte que
  `tasks.md` já nomeava como a primeira a sair do pre-commit — por ser a mais cara
  por scenario coberto, e não a verificação de tipos, que é barata e fecha o
  buraco de maior consequência.

- **Cobertura total é um piso que sobe sozinho** → Todo scenario que entrar em
  `openspec/specs/` a partir de agora recusa o commit até ser coberto ou declarado
  fora de alcance com razão. É a consequência pretendida, e é a mais cara desta
  change: escrever spec continua livre, arquivá-la passa a custar o teste. Se
  isso um dia pesar demais, afrouxar é uma decisão a tomar por escrito — a trava
  por conjunto continua funcionando abaixo dela.

- **Cobertura parcial pode ser lida como cobertura suficiente** → O relato do
  portão informa o total coberto contra o total especificado, de modo que a
  distância apareça em toda execução em vez de precisar ser procurada.

- **A trava por conjunto congela erros de escopo** → Um scenario coberto por
  engano passa a ser exigido para sempre. Removê-lo do conjunto é possível e
  aparece no diff como remoção deliberada, que é o tratamento correto: reversível,
  mas nunca silencioso.
