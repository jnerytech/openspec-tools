## Why

O `init` já provisiona as skills, o idioma dos artefatos e as working agreements
do `CLAUDE.md`, mas não tem nada a dizer sobre a forma das mensagens de commit —
e é justamente aí que o padrão de fábrica do agente contraria a convenção da
casa: o Claude Code escreve commits com corpo e com um trailer `Co-Authored-By`,
enquanto o que se quer aqui é uma única linha em Conventional Commits. Hoje isso
só se resolve escrevendo o arquivo à mão em cada repositório, e depois lembrando
de mantê-lo igual em todos.

O Claude Code tem um lugar próprio para esse tipo de instrução — `.claude/rules/`,
carregado a cada sessão —, que o pacote ainda não usa. Uma regra ali é a peça que
falta para que `opsx-tools init` deixe o repositório inteiro pronto, em vez de
quase pronto.

## What Changes

- Novo componente **`commit-convention`** no `init`: escreve uma regra do Claude
  Code em `.claude/rules/commit-convention.md`, no projeto, prescrevendo commit
  de **uma única linha** no formato Conventional Commits.
- A regra proíbe explicitamente corpo, footer e qualquer trailer — inclusive
  `Co-Authored-By` —, porque a instrução padrão do agente produz exatamente essas
  linhas e uma regra que não a contradiz não muda nada.
- A regra é escrita **sem o campo `paths`** no frontmatter, e portanto carrega em
  toda sessão: um commit não é a leitura de um arquivo, e uma regra escopada por
  caminho não estaria em contexto na hora em que a mensagem é redigida.
- O texto vai para dentro de uma **região delimitada**, o mesmo mecanismo já usado
  em `CLAUDE.md` e em `openspec/config.yaml`. O arquivo passa a poder conter texto
  do usuário sem que o componente o perca, a remoção tira só as linhas do pacote,
  e a mudança aparece como diff antes da confirmação.
- O componente é **só de projeto**: uma convenção de commit é do repositório, e
  `~/.claude/rules/` não é oferecido.
- `init` ganha `--commit-rule` e `--no-commit-rule`, para que a escolha exista
  também quando a entrada não é um terminal.
- O pacote passa a **distribuir as quatro bases de conhecimento sobre o Claude
  Code** que este repositório versiona — `claude-code-skills`, `claude-code-memory`,
  `claude-code-hooks` e `claude-code-subagents` —, movendo-as para `skills/`. O
  pack sai de duas para seis skills, e o `init` as instala como o item único que
  já é. Isso não altera nenhum requisito: a instalação sempre foi definida como
  "o que estiver em `skills/`", e esta change apenas põe mais coisa lá.

## Capabilities

### New Capabilities
- `commit-convention-rule`: o componente que fixa o formato da mensagem de commit
  do repositório — onde a regra é escrita, o que ela prescreve, por que carrega em
  toda sessão, como o estado é lido de volta, como é removida e o que o pacote
  não promete sobre o agente obedecê-la.

### Modified Capabilities
<!-- Nenhuma. `project-provisioning` define componente e reconciliação de forma
     genérica, e `skill-installation` define o conjunto instalável como aquilo que
     o pacote empacota; nem o quarto componente nem as quatro skills novas mudam
     um requisito existente. -->

## Impact

- `src/components/commit-convention.ts`: novo, produzindo `RegionEdit` pelo
  adaptador Markdown já existente.
- `src/components/index.ts`: registra o quarto componente, depois das working
  agreements.
- `src/init-cli.ts`: as duas flags novas e o mapeamento delas para o componente.
- `skills/`: recebe `claude-code-skills`, `claude-code-memory`, `claude-code-hooks`
  e `claude-code-subagents`.
- `README.md`: o pack de skills, o componente novo e a árvore do projeto.
- `dist/`: versionado, porque o pacote instala sem build.
- Sem mudança no reader, no servidor, no renderer, no scanner, em `skills-cli.ts`
  ou nos outros três componentes.

## Non-goals

- **Impedir um commit fora do formato.** Isto é uma instrução entregue ao
  contexto do agente, não um mecanismo de enforcement. Um hook do Claude Code
  poderia recusar a ferramenta, e um `commit-msg` do Git poderia recusar a
  mensagem; nenhum dos dois está nesta change. O pacote responde pela regra estar
  presente, correta e removível — não pelo comportamento a jusante dela.
- **Instalar ou configurar commitlint, husky ou qualquer hook de Git.** Isso
  significaria escrever em `package.json` e em `.git/`, que não são território do
  `init`, e faria o resultado depender de outro programa.
- **Escrever em `~/.claude/rules/`.** `init` prepara um repositório. Uma
  convenção de commit válida para toda máquina é uma escolha do usuário, feita à
  mão, não uma consequência de provisionar um projeto.
- **Fixar o idioma da mensagem de commit.** O componente de idioma dos artefatos
  já diz, no seu próprio texto, que não governa commits; esta change mantém isso.
  A regra prescreve forma, não língua.
- **Escolher a convenção por escopo.** Não há lista de escopos permitidos nem
  validação de escopo: o vocabulário de escopos é de cada repositório.
- **Levar as working agreements do `CLAUDE.md` para `.claude/rules/`.** As duas
  ficam onde estão; a regra de commit nasce em `.claude/rules/` porque não tem
  relação com o trabalho sob `openspec/`, que é o recorte declarado daquele bloco.
