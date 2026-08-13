## Context

Ver `proposal.md` — Why. O que importa aqui é o que já existe e restringe a
solução:

- `init` opera sobre **componentes** (`src/component.ts`): cada um sabe relatar
  seu estado, planejar as escritas e remoções que faria, e aplicá-las. O registro
  em `src/components/index.ts` é fechado e compilado; acrescentar o quarto
  componente não exige nenhuma máquina nova.
- Há duas formas de edição: `PathEdit`, para um arquivo ou diretório inteiro
  aparecer ou desaparecer, e `RegionEdit`, para linhas dentro de um arquivo cujo
  restante é do usuário — esta última é apresentada como diff antes da
  confirmação, porque o caminho sozinho não diz o que acontece com o resto.
- `src/region.ts` implementa a região delimitada de forma independente de formato,
  e `src/region-markdown.ts` a adapta para comentários HTML. `claude-workflow.ts`
  já usa exatamente esse par para escrever em `CLAUDE.md`, incluindo o parâmetro
  `created=1` que registra que o arquivo nasceu do pacote.
- `.claude/rules/` é lido pelo Claude Code a cada sessão; regras sem o campo
  `paths` no frontmatter carregam incondicionalmente, com a mesma prioridade de
  `.claude/CLAUDE.md`. Regras de usuário (`~/.claude/rules/`) carregam antes e
  perdem para as do projeto em caso de conflito.

## Goals / Non-Goals

**Goals:**

- Uma regra que contradiga por escrito o comportamento padrão do agente, em vez de
  apenas repetir "usamos conventional commits" — o padrão a ser vencido é a
  mensagem com corpo e trailer `Co-Authored-By`.
- Um quarto componente que não invente mecanismo nenhum: mesmo `Component`, mesmo
  editor de região, mesmo fluxo de plano e confirmação.
- Nunca perder texto que o usuário tenha escrito no mesmo arquivo, nem em uma
  provisão, nem em uma remoção.

**Non-Goals (de design; os de escopo estão na proposta):**

- Um mecanismo genérico de "escrever qualquer regra". O componente escreve uma
  regra, com um texto que o pacote controla. Um segundo tema de regra, se surgir,
  será um segundo componente — que é o custo que a arquitetura de componentes
  existe para manter baixo.
- Parametrizar a convenção (lista de tipos, limite de coluna, permitir escopo).
  Cada botão desses vira um parâmetro na região, um prompt e uma opção de linha de
  comando; nada nesta change pede isso.

## Decisions

### 1. Região delimitada, e não arquivo inteiro

O componente escreve um `RegionEdit` através do adaptador Markdown, do mesmo modo
que `claude-workflow.ts` escreve em `CLAUDE.md`.

*Alternativa considerada: `PathEdit` de arquivo inteiro*, como faz o componente de
skills. É mais simples — o pacote é dono do arquivo do começo ao fim — e foi
rejeitada por duas razões. Primeiro, `commit-convention.md` é um nome que um
usuário pode já ter escolhido para a própria regra de commit; com arquivo inteiro,
a colisão é resolvida sobrescrevendo, e um `PathEdit` só mostra o caminho e a nota
"differs", nunca o que se perde. Com região, o mesmo caso vira um diff antes da
confirmação. Segundo, a remoção passa a ser cirúrgica: tira as linhas do pacote e
devolve o arquivo ao usuário, em vez de apagar o arquivo dele.

O preço é o de sempre nesse mecanismo: dois comentários HTML visíveis no fonte do
arquivo. Já é o preço aceito em `CLAUDE.md`.

### 2. `.claude/rules/commit-convention.md`, um arquivo por tema

O diretório é descoberto recursivamente e a convenção do Claude Code é um tema por
arquivo. O nome descreve o tema, não o pacote: quem abrir o repositório encontra a
regra pelo nome, e a marca do pacote está no delimitador da região, que é o que o
código usa para reconhecê-la.

*Alternativa considerada: acrescentar a convenção ao bloco já existente em
`CLAUDE.md`*, que é onde as working agreements moram. Rejeitada porque aquele
bloco declara no próprio texto que fala do trabalho sob `openspec/`, e commit não
é isso; ampliar o recorte dele tornaria a promessa daquele componente falsa.

### 3. Sem `paths` no frontmatter — na verdade, sem frontmatter

Escrever uma mensagem de commit não é ler um arquivo do projeto, e uma regra com
`paths` só entra em contexto quando o Claude Code lê um arquivo que casa com o
padrão. Como a regra precisa estar em contexto no momento em que a mensagem é
redigida, ela carrega incondicionalmente — o que, na convenção do Claude Code, é
simplesmente a ausência do campo. E como `paths` é o único campo que interessaria
aqui, o arquivo sai sem frontmatter nenhum.

*Alternativa considerada: `paths: ["**/*"]`.* Casa com tudo, mas continua sendo
disparado por leitura de arquivo, o que é justamente a condição errada, e sugere
um escopo que não existe.

### 4. O texto da regra, em inglês, prescritivo e curto

```markdown
## Commit messages

Every commit message is exactly one line, in Conventional Commits form:

    type(scope): description

- `type` is one of: feat, fix, docs, style, refactor, perf, test, build,
  ci, chore, revert.
- `scope` is optional and names the area touched, in lowercase.
- Mark a breaking change with `!` before the colon: `feat(cli)!: ...`.
- The description is imperative and lowercase, with no trailing period.
- Keep the whole line at 72 characters or fewer.
- Write nothing after that line: no body, no footer, no trailers — in
  particular no `Co-Authored-By` line.
```

Em inglês porque é o idioma das demais diretivas que o pacote escreve, e porque a
diretiva de idioma em `openspec/config.yaml` já declara, no próprio texto, que não
governa mensagens de commit. Prescritivo e curto porque uma regra sem `paths` ocupa
contexto em toda sessão.

A última linha é o ponto inteiro da regra: sem ela, a instrução de fábrica do
agente continua produzindo o trailer, e a regra teria custo sem efeito.

### 5. O ciclo de vida do arquivo é o de `claude-workflow.ts`

Mesma mecânica, sem variação: o parâmetro `created=1` no delimitador de abertura
registra que o arquivo nasceu do pacote; na remoção, um arquivo criado pelo pacote
que fique em branco é apagado, e um que já existia é mantido. O diretório
`.claude/rules/` nunca é apagado — inferir da remoção de uma regra a remoção do
diretório que pode conter outras não é uma conclusão que uma caixa desmarcada
carregue.

A criação do diretório é anunciada com a mesma ressalva de reinício já usada para
o diretório de skills, e pela mesma razão: um diretório que não existia quando a
ferramenta começou só é notado depois que ela reinicia, então uma provisão correta
pareceria ter falhado.

### 6. Só projeto, e nenhum prompt próprio

O componente não tem escolhas a fazer: não há idioma, não há lista de agreements,
não há destino. `choose` devolve uma seleção vazia e nunca pergunta nada, o que
faz `--commit-rule` e `--no-commit-rule` serem suficientes para operá-lo sem
terminal — a seleção interativa do `init` já cobre o resto.

*Alternativa considerada: oferecer `~/.claude/rules/` como o componente de skills
faz.* Rejeitada: skills são ferramentas que a pessoa carrega consigo; uma convenção
de commit é do repositório, e uma regra de usuário aplicada a todo projeto que a
pessoa abrir imporia a convenção desta casa a repositórios de terceiros.

### 7. As quatro skills `claude-code-*` entram como conteúdo

Copiar os diretórios para `skills/` basta: a fonte instalável é descoberta em
tempo de execução por `listPackagedSkills()`, que lista todo diretório com um
`SKILL.md`. Não há registro a atualizar, e é por isso que a proposta não declara
nenhuma capability modificada por essa parte.

As cópias em `.claude/skills/` deste repositório continuam existindo e devem
permanecer idênticas às de `skills/` — é a comparação que `skill list` faz, e
divergência aqui apareceria como "differs" no próprio repositório do pacote.

## Risks / Trade-offs

- **A regra não impede nada** → É uma instrução, e o texto da proposta e do
  `--help` diz isso. Quem quiser enforcement de verdade tem duas portas fora desta
  change: um hook `PreToolUse` do Claude Code, que pode recusar a chamada de
  ferramenta, ou um hook `commit-msg` do Git, que recusa a mensagem. Nenhuma das
  duas é escrita aqui.
- **Contradizer a instrução de fábrica do agente** → A regra de projeto e a
  instrução do sistema podem discordar, e o resultado é do agente, não do pacote.
  A mitigação é a regra ser explícita a ponto de nomear o trailer, em vez de
  descrever o formato desejado e deixar a contradição implícita.
- **Um repositório onde outros commits já trazem o trailer** → A regra vale daqui
  para a frente; nada é reescrito. Histórico misto é o resultado esperado.
- **Colisão de nome com uma regra de commit do usuário** → Detectada como região
  ausente em arquivo existente, resolvida acrescentando a região ao arquivo dele e
  mostrando o diff. Nada é sobrescrito sem aparecer antes.
- **Seis skills instaladas de uma vez** → O componente de skills é atômico por
  requisito, então quem quer só as de OpenSpec passa a precisar do
  `opsx-tools skill install`, nomeando-as. É o custo de manter o item único, e a
  superfície fina continua existindo exatamente para isso.
- **Contexto ocupado por uma regra sempre carregada** → Mitigado pelo tamanho: uma
  dúzia de linhas, sem prosa explicativa.
