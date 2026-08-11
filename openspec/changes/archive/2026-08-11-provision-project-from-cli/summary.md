# provision-project-from-cli

**Em uma frase:** adiciona o subcomando `opsx-tools init`, que provisiona o repositório atual com tudo o que o pacote oferece, apresentado como um único checklist de componentes com seus estados atuais.

## Por quê
Depois de instalar o pacote, nada acontece no repositório do usuário: configurá-lo exige saber que `skill` existe, que `--project` é a flag e que as skills são o que se instala — fatos que só o README conta. Não há um comando que responda "o que este pacote tem para este repo, e quanto disso já está configurado?". Hoje isso é pequeno, com uma única coisa provisionável; deixa de ser no momento em que surge a segunda, cada uma com seu verbo, seu estado e suas flags.

## O que muda
- Novo subcomando `init`, que exige um projeto OpenSpec já existente e nunca cria um: sem `openspec/` na raiz resolvida, reporta, indica `openspec init` e sai com código 1.
- Introduz o **componente** como unidade sobre a qual `init` opera: sabe reportar seu estado, nomear escritas e remoções, aplicá-las e desfazê-las. Três componentes chegam com a mudança: **Skills** (todas as skills do pacote como item atômico), **Idioma dos artefatos** e **Acordos de trabalho do Claude Code**.
- O idioma dos artefatos é escrito no campo `context` de `openspec/config.yaml`, por edição textual cirúrgica — nunca parse-and-rewrite, que destruiria os comentários do arquivo. A região delimitada registra o idioma escolhido, para que `init` reporte *qual* está configurado.
- Os acordos de trabalho vão para `CLAUDE.md`, não para a configuração do OpenSpec, porque nomeiam ferramentas que só um cliente possui. Mesmo mecanismo de região delimitada, formatos diferentes.
- `init` é um **reconciliador**: item presente e desmarcado é removido, dispensando um verbo de desinstalação. Como pode apagar linhas de um arquivo do usuário, edições dentro de arquivos existentes são exibidas como **diff** antes da confirmação; região editada à mão é reportada, nunca casada por semelhança.
- Toda pergunta ganha flag equivalente, para uso sem terminal interativo.
- Torna explícita a invariante já seguida: **nada que o `opsx-tools` decide ou reporta depende da saída ou do código de saída de outro programa.**
- `src/project.ts` passa a informar por qual regra a raiz foi escolhida (`openspec`, `git` ou `cwd`).

**Fora de escopo:** instalar ou inicializar o OpenSpec; invocar qualquer CLI de terceiros, inclusive `openspec update`; escrever em `AGENTS.md`; garantir que o agente obedeça a uma diretiva; usar o campo `rules` por artefato; fixar o idioma de qualquer coisa além dos artefatos OpenSpec; provisionar o diretório do usuário como propósito do `init`; um sistema de plugins de propósito geral.

## Capacidades afetadas
- `project-provisioning` (nova) — a precondição do `init`, a apresentação de todos os componentes com seu estado, a semântica de reconciliação, a nomeação e confirmação de cada escrita e remoção, as flags para uso não interativo, a proibição de depender de outro programa e os códigos de saída.
- `artifact-language` (nova) — onde a diretiva de idioma é gravada, como é delimitada e relida, como é editada cirurgicamente, como é removida sem deixar chave vazia, e o que ocorre quando o usuário a editou ou os delimitadores estão danificados.
- `claude-workflow-directives` (nova) — os dois acordos oferecidos (manter lista de tarefas; perguntar em vez de assumir), independentemente alternáveis, gravados em `CLAUDE.md`, escopados a trabalho sob `openspec/`, com a proibição de prometer obediência do agente.
- `cli-interface` (modificada) — o requisito de um subcomando por capacidade e a cena de ajuda raiz passam a incluir `init` ao lado de `read` e `skill`.

## Decisões principais
- **Abstração de componente já agora** — escolhida em vez de uma fachada fina sobre o fluxo de `skill`, ou de esperar o terceiro componente: os componentes desta mudança têm formatos diferentes (copiar diretórios vs. editar região em arquivo alheio), e uma interface derivada de um só estaria errada.
- **`context` em vez de `rules`** — `rules` é semanticamente melhor, mas é chaveado por id de artefato, e obter essa lista exigiria invocar a CLI do OpenSpec, o que a proposta proíbe; ler os arquivos de schema instalados foi considerado e é pior.
- **`CLAUDE.md` em vez de `openspec/config.yaml`, `operations.apply.guidance` ou `AGENTS.md`** — o eixo decisivo é quem lê o arquivo: uma diretiva que nomeia ferramentas de um só cliente não pertence à configuração compartilhada por ~30 clientes; `guidance` ainda cobriria só `apply`/`archive` e só quando um comando roda.
- **Entrega, não obediência** — a especificação é escrita em torno do que o pacote garante (diretiva presente, correta, escopada, removível), em vez de prometer comportamento do agente, porque nenhum mecanismo disponível força uma chamada de ferramenta.
- **Edição de linhas cirúrgica, sem dependência YAML** — escolhida em vez de carregar e reserializar o arquivo, o que apagaria comentários, ordem de chaves e formatação de um arquivo que é ~90% documentação comentada; o editor separa núcleo independente de formato e adaptadores por formato.
- **Delimitadores como texto literal dentro do escalar** — aceitos sobre alternativas (comentários YAML reais, delimitador em prosa) porque nenhuma outra opção é ao mesmo tempo interna ao escalar e casável de forma confiável; o custo são duas linhas de ruído no prompt injetado.
- **Flags não interativas são aditivas** — escolhidas em vez de uma lista separada por vírgulas como o `init --tools` do OpenSpec, que traria o risco de "não citado significa desligado" e apagaria silenciosamente componentes futuros.
- **`resolveProject` informa a regra vencedora** — em vez de o `init` fazer sua própria busca por `openspec/`, mantendo uma única definição de "qual projeto é este".
- **Skills como item atômico no `init`** — mantém o checklist curto e preserva um único lugar óbvio para a escolha fina, que continua em `opsx-tools skill`.

## Onde aprofundar
`proposal.md` · `design.md` · `specs/project-provisioning/spec.md` · `specs/artifact-language/spec.md` · `specs/claude-workflow-directives/spec.md` · `specs/cli-interface/spec.md`
