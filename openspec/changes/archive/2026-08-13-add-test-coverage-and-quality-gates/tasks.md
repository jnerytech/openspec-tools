## 1. Verificação de tipos no portão

Independente de todo o resto e fecha o buraco de maior consequência imediata: hoje
um erro de tipo atravessa o pre-commit inteiro.

- [x] 1.1 Criar a configuração de compilação para verificação, estendendo a de publicação e removendo a exclusão de `src/**/*.test.ts` e `src/test-fixture.ts`, emitindo para um diretório descartável fora de `dist/`
- [x] 1.2 Adicionar o script que executa essa verificação, e confirmar que ela reprova um erro de tipo introduzido de propósito em um arquivo de teste — que a configuração de publicação não olha
- [x] 1.3 Confirmar que executar a verificação não altera nenhum arquivo sob `dist/`, comparando o estado do Git antes e depois
- [x] 1.4 Colocar a verificação de tipos em `.githooks/pre-commit`, antes da suíte, de modo que ela recuse por si só

## 2. Declaração de scenario coberto

O utilitário de que todo o resto depende. Sem ele nenhum teste consegue declarar o
que cobre.

- [x] 2.1 Escrever o leitor que extrai, de `openspec/specs/`, o conjunto de scenarios por capability, a partir dos cabeçalhos `#### Scenario:`, ignorando `openspec/changes/`
- [x] 2.2 Escrever em `src/test-fixture.ts` o utilitário que registra um teste como cobrindo um par capability/título e falha quando o par não consta das specs
- [x] 2.3 Cobrir o próprio utilitário: título inexistente derruba a execução, capability inexistente derruba a execução, par válido registra
- [x] 2.4 Reescrever os nove testes existentes de `scanner.test.ts` e `renderer.test.ts` para declarar os scenarios de `artifact-ordering` que cobrem, confirmando que a suíte continua verde
- [x] 2.5 Confirmar que renomear um scenario em uma spec faz o teste que o declarava falhar, e desfazer a alteração

## 3. Suíte de unidade — splicing de regiões

Primeiro por raio de explosão: é o código que edita arquivos que o usuário
escreveu, sob promessa explícita de preservação byte a byte, e hoje não tem teste
nenhum. Tudo aqui é função pura.

- [x] 3.1 Cobrir `src/region.ts`: localização por delimitadores, e cada forma que deve ser relatada como danificada — par duplicado, abertura sem fechamento, fechamento sem abertura, fechamento antes da abertura
- [x] 3.2 Cobrir `src/region.ts`: escrita, substituição e excisão de região preservando tudo que está fora dos delimitadores, e a leitura de volta dos parâmetros gravados na abertura
- [x] 3.3 Cobrir `src/region-markdown.ts`: região nova separada do texto já existente, região excisada levando apenas as próprias linhas, arquivo ausente e arquivo em branco
- [x] 3.4 Cobrir `src/region-yaml.ts` — a localização do bloco `context`: chave ausente, chave apenas comentada no arquivo que `openspec init` deixa, escalar dobrado, escalar com indicador, e chave aninhada que não é a de coluna zero
- [x] 3.5 Cobrir `src/region-yaml.ts` — a escrita: criar a chave quando ausente, splicing preservando as demais chaves, comentários e a ordem, linhas em branco finais que pertencem ao arquivo e não ao valor, remoção da chave quando o conteúdo se esvazia, e o fechamento do espaço entre os vizinhos
- [x] 3.6 Declarar em cada teste acima os scenarios de `artifact-language`, `claude-workflow-directives` e `commit-convention-rule` que ele cobre

## 4. Suíte de unidade — componentes e identidade de projeto

- [x] 4.1 Cobrir `src/component.ts`: o diff de linhas, incluindo o caso da nova linha final que não é uma linha, e o plano renderizado para escrita, remoção e edição de região
- [x] 4.2 Cobrir os três componentes de região — `artifact-language`, `claude-workflow`, `commit-convention` — em `inspect` e `plan`, sobre árvores de fixture: ausente, provisionado, diferente do que o pacote escreve, e não editável com segurança
- [x] 4.3 Cobrir que desmarcar um componente apaga o arquivo que o pacote criou e preserva o que o usuário escreveu, sem tocar em outros arquivos de `.claude/rules/`
- [x] 4.4 Cobrir `src/project.ts`: a raiz resolvida a partir de um subdiretório, `openspec/` vencendo a raiz de repositório, e o recuo para o diretório atual quando nada é encontrado
- [x] 4.5 Cobrir `src/port.ts`: a porta derivada é estável para o mesmo caminho, cai dentro da faixa declarada, e reproduz a porta anterior para a entrada que a fixava
- [x] 4.6 Cobrir `src/skill-destinations.ts` e `src/skill-state.ts`: o destino de projeto resolvido pela mesma regra do leitor, e os estados ausente, idêntico, diferente e ilegível sobre árvores de fixture
- [x] 4.7 Declarar em cada teste acima os scenarios de `project-provisioning`, `skill-installation` e `server-startup` que ele cobre

## 5. Suíte de subprocesso do CLI

Executa o binário compilado no diretório descartável do passo 1. Nenhuma linha de
código de produção é alterada.

- [x] 5.1 Escrever o utilitário que compila uma vez por execução da suíte e executa o binário resultante com argumentos e diretório de trabalho dados, devolvendo saída padrão, saída de erro e código de saída
- [x] 5.2 Cobrir a superfície de invocação: um único executável, cada capability alcançada como subcomando, a invocação sem argumentos mostrando a ajuda e terminando com código 0
- [x] 5.3 Cobrir os erros de uso: código de saída 1, a mensagem antes do ponteiro para a ajuda, e o ponteiro nomeando o comando que falhou e não a raiz
- [x] 5.4 Cobrir o alvo não encontrado: as sugestões de nome próximo, a distinção entre change aberta e arquivada, e o aviso quando existe uma homônima arquivada
- [x] 5.5 Cobrir os caminhos não interativos de `init` e `skill`: provisionar e remover respondendo às confirmações por opção, terminando com código 0 e sem fazer pergunta
- [x] 5.6 Declarar em cada teste acima os scenarios de `cli-interface` que ele cobre
- [x] 5.7 Medir o tempo total da suíte e registrá-lo; se ultrapassar o tolerável para um pre-commit, é esta parte que sai primeiro, conforme `design.md`

## 6. O portão

Só agora, porque um portão precisa de cobertura existente para registrar como
linha de base.

- [x] 6.1 Escrever a declaração dos scenarios fora do alcance de teste de código, com a razão de cada um, começando pelos 28 de `change-summary`, que descrevem um arquivo de instrução lido por um agente
- [x] 6.2 Escrever o verificador que cruza os scenarios de `openspec/specs/` com as declarações coletadas na execução da suíte e com a declaração de fora de alcance, e recusa quando um scenario não consta de nenhuma das duas
- [x] 6.3 Fazer o verificador tratar como não declarada uma entrada de fora de alcance sem razão
- [x] 6.4 Gerar o registro versionado do conjunto coberto por capability e fazer o verificador recusar quando um scenario sai do conjunto, mesmo que outro entre no mesmo commit
- [x] 6.5 Fazer o verificador não recusar quando o scenario sai do conjunto por ter deixado de constar em `openspec/specs/`
- [x] 6.6 Escrever o relato de recusa: cada scenario descoberto nomeado sob sua capability, qual verificação falhou, e o total coberto contra o total especificado
- [x] 6.7 Adicionar o script que executa o portão inteiro na ordem — tipos, suíte, cobertura de scenario — e ligá-lo em `.githooks/pre-commit`
- [x] 6.8 Confirmar por escrito no hook que a opção do Git que pula os hooks contorna o portão deliberadamente, mantendo o texto que já está lá
- [x] 6.9 Registrar a linha de base com a cobertura obtida nos passos 3 a 5 e confirmar que um commit limpo passa pelo portão

## 7. Fechamento

- [x] 7.1 Confirmar que nenhum arquivo sob `src/` que não seja de teste foi modificado, e que `dist/` está inalterado
- [x] 7.2 Confirmar que nenhum componente do `init` e nenhum subcomando expõe ou instala o portão, e que provisionar um projeto de usuário não escreve nenhum arquivo dele
- [x] 7.3 Verificar que remover a cobertura de um scenario faz o portão recusar, e desfazer a alteração
- [x] 7.4 Rodar `openspec validate add-test-coverage-and-quality-gates --strict`
