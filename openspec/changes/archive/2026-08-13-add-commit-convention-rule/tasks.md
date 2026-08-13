## 1. Empacotar as skills do Claude Code

- [x] 1.1 Copiar `.claude/skills/claude-code-memory/`, `.claude/skills/claude-code-hooks/` e `.claude/skills/claude-code-subagents/` para `skills/`, preservando a árvore inteira (`SKILL.md`, `cheatsheet.md`, `glossary.md`, `patterns.md`, `chapters/`)
- [x] 1.2 Conferir, com `diff -r`, que cada cópia em `skills/` é idêntica à de `.claude/skills/`
- [x] 1.3 Rodar `opsx-tools skill list` e confirmar que as seis skills aparecem, todas como instaladas no projeto e nenhuma como diferente

## 2. Componente da convenção de commit

- [x] 2.1 Criar `src/components/commit-convention.ts` com o `Component`, o id `commit-convention` e o rótulo e resumo que o `init` mostra — o resumo apresentando a regra como instrução escrita para o agente ler
- [x] 2.2 Implementar a resolução do caminho `.claude/rules/commit-convention.md` a partir da raiz de projeto resolvida, sem oferecer nenhum outro destino
- [x] 2.3 Implementar o texto da regra conforme a decisão 4 do design: uma linha, `tipo(escopo): descrição`, tipos nomeados, escopo opcional, marca de mudança incompatível, forma da descrição, limite de 72 caracteres, e a proibição de corpo, footer e trailers nomeando `Co-Authored-By`
- [x] 2.4 Confirmar que o arquivo escrito não tem frontmatter e, em particular, não declara `paths`
- [x] 2.5 Implementar `inspect` sobre `findMarkdownRegion`: ausente, provisionado, diferente, e não editável com segurança quando os delimitadores estiverem danificados
- [x] 2.6 Implementar `plan` produzindo um `RegionEdit` pelo adaptador Markdown, com o parâmetro `created=1` quando o arquivo nascer do pacote
- [x] 2.7 Implementar a remoção: excisar a região, apagar o arquivo apenas quando o pacote o criou e ele fica em branco, e nunca apagar outro arquivo de `.claude/rules/` nem o diretório
- [x] 2.8 Implementar `applyEdit` criando `.claude/rules/` quando ausente e relatando a criação com a mesma ressalva de reinício usada para o diretório de skills
- [x] 2.9 Implementar `choose` sem prompt algum, devolvendo uma seleção vazia, já que o componente não tem escolha a fazer

## 3. Ligar ao `init`

- [x] 3.1 Registrar o componente em `src/components/index.ts`, depois das working agreements
- [x] 3.2 Adicionar `--commit-rule` e `--no-commit-rule` em `src/init-cli.ts` e mapeá-las para o componente em `intentsFromFlags`
- [x] 3.3 Acrescentar o componente aos exemplos do `--help` do `init`
- [x] 3.4 Confirmar que um `init` que não nomeia a convenção de commit não escreve nem apaga `.claude/rules/commit-convention.md`

## 4. Verificação em arquivos reais

- [x] 4.1 Provisionar em um projeto sem `.claude/rules/`: o diretório é criado, a criação é relatada com a ressalva de reinício, e o arquivo contém só a região
- [x] 4.2 Provisionar sobre um `.claude/rules/commit-convention.md` escrito pelo usuário: o texto dele permanece byte a byte igual e a região é acrescentada
- [x] 4.3 Editar a região à mão e provisionar de novo: o componente relata a diferença e mostra o diff antes da confirmação
- [x] 4.4 Danificar um delimitador e rodar `init`: o componente é relatado como não editável com segurança, nada é escrito e o processo termina com código 1
- [x] 4.5 Remover em um arquivo criado pelo pacote: o arquivo é apagado; remover em um arquivo com texto do usuário: só a região sai
- [x] 4.6 Remover com outro arquivo de regra presente em `.claude/rules/`: esse arquivo e o diretório continuam lá
- [x] 4.7 Rodar `init --commit-rule --yes` e `init --no-commit-rule --yes` com a entrada não sendo um terminal, e confirmar que ambos terminam com código 0 sem perguntar nada
- [x] 4.8 Rodar `openspec validate add-commit-convention-rule --strict`

## 5. Documentação e distribuição

- [x] 5.1 Atualizar o `README.md`: o pack passa a seis skills, com uma linha por skill nova
- [x] 5.2 Documentar o componente da convenção de commit na tabela de componentes do `init` e nas suas flags, dizendo o que a regra prescreve e que ela não é imposta
- [x] 5.3 Atualizar a árvore de estrutura do projeto no `README.md` com as skills novas e o módulo do componente
- [x] 5.4 Rodar `npm run compile` e versionar o `dist/` resultante, porque o pacote instala sem build
