## 1. Estabelecer a medição em que se pode confiar

Antes de perseguir qualquer número, o número precisa querer dizer o que aparenta.
Hoje ele não quer.

**Ordem revista durante a implementação.** A seção 3 vem antes desta. O somador
de cobertura bruta que 1.2 pedia deixou de ser necessário: com a exceção tipada,
o CLI e o servidor passam a ser chamados dentro do processo de teste, e a
instrumentação normal os enxerga. Somar cobertura entre processos exigiria
reimplementar a atribuição por source map, e errar ali produziria exatamente o
número desonesto que esta change existe para corrigir.

- [x] 1.1 Estabelecer a causa das faixas do tipo `1-13` que hoje aparecem para `out-of-scope.ts` e `pipeline.ts`, já verificado que comentário de topo não conta como linha descoberta em arquivo isolado
- [x] 1.2 Confirmar que nenhum módulo de produção depende de um processo gerado para ser exercitado, depois da seção 3
- [x] 1.3 Fazer o denominador ser o conjunto de arquivos de produção lido do disco, com um arquivo sem dado nenhum entrando como zero em vez de sumir do relatório
- [x] 1.4 Confirmar que apagar o último teste de um módulo derruba o número em vez de subi-lo, e desfazer a alteração
- [x] 1.5 Confirmar que `server.ts` e `cli.ts` passam a refletir o que já é testado, agora que o exercício acontece em processo
- [x] 1.6 Fazer o relato distinguir "não medido" de "não exercitado"

## 2. Trocar o runner da suíte

Decorre do fato de que a diretiva de exclusão do Node não sobrevive ao `tsx`.
Sem isso, o passo 4 não tem saída honesta.

- [x] 2.1 Fazer a suíte executar o JavaScript compilado no diretório descartável que a verificação de tipos já produz, em vez de rodar sob `tsx`
- [x] 2.2 Rodar os 333 casos existentes sobre o novo runner e resolver o que depender de detalhe do `tsx`
- [x] 2.3 Confirmar que a diretiva de exclusão de cobertura passa a valer, com um bloco marcado de propósito
- [x] 2.4 Medir o tempo da suíte antes e depois, e registrá-lo — a expectativa é que caia, por não pagar a inicialização do `tsx` por arquivo

## 3. O refactor adiado

A change anterior o deixou escrito para esta. A rede são os 45 scenarios de
`cli-interface`, que observam código de saída e ordem de mensagem.

- [x] 3.1 Introduzir a exceção tipada e fazer `usageError` lançá-la em vez de terminar o processo
- [x] 3.2 Fazer o mesmo para a recusa por arquivo não editável com segurança e para a falha de escrita de `applyPlan`
- [x] 3.3 Fazer as falhas de bind de `server.ts` lançarem em vez de terminar o processo
- [x] 3.4 Converter a exceção em código de saída num único lugar, em `main.ts`
- [x] 3.5 Confirmar que os 45 scenarios de `cli-interface` continuam passando sem que nenhum teste tenha sido alterado — é isso que diz que o comportamento observável não mudou
- [x] 3.6 Reescrever para dentro do processo os testes de caminho de erro que hoje geram um subprocesso, mantendo por subprocesso apenas o que só lá se observa
- [x] 3.7 Medir de novo o tempo da suíte

## 4. Levar as três medidas à totalidade

Ramo é a parte cara: é onde moram as guardas defensivas.

- [x] 4.1 Cobrir o que falta de linha em `renderer.ts`, `component.ts` e `init-cli.ts`
- [x] 4.2 Cobrir o que falta de função em `renderer.ts` e `components/index.ts`
- [x] 4.3 Cobrir os ramos de `region-yaml.ts` e `scanner.ts` — os dois módulos com 100% de linha e ramo descoberto, e o primeiro é o que edita arquivo que o usuário escreveu
- [x] 4.4 Cobrir os ramos de `skills.ts`, `skill-actions.ts` e `claude-workflow.ts`
- [x] 4.5 Para cada guarda defensiva que nenhum teste pode alcançar, decidir entre cobrir, remover ou excluir com razão — e registrar a decisão junto do código
- [x] 4.6 Confirmar que nenhuma exclusão foi usada onde um teste era possível, revendo a lista inteira de uma vez

## 5. O piso no portão

- [x] 5.1 Escrever a verificação que recusa quando linha, ramo ou função ficam abaixo da totalidade
- [x] 5.2 Fazer o verificador tratar como não excluída uma marca de exclusão sem razão
- [x] 5.3 Escrever o relato: cada arquivo abaixo da totalidade, qual das três medidas falhou, e as posições
- [x] 5.4 Fazer as três medidas serem relatadas também quando o portão aceita
- [x] 5.5 Ligar a verificação no portão depois da de scenario coberto, e confirmar que as duas recusam de forma independente
- [x] 5.6 Declarar nos testes acima os scenarios de `quality-gates` que eles cobrem — **feito no arquivamento**: os scenarios novos ainda estão sob `openspec/changes/`, e declará-los agora reprova a própria conferência que mantém a declaração honesta
- [x] 5.7 Confirmar que um commit limpo passa pelo portão inteiro

## 6. Fechamento

- [x] 6.1 Confirmar que arquivo de teste e código do próprio portão são relatados e não contam para o piso
- [x] 6.2 Reconstruir `dist/` e confirmar que nada do portão entrou nele
- [x] 6.3 Confirmar que nenhum componente do `init` e nenhum subcomando expõe a nova verificação
- [x] 6.4 Rodar `openspec validate gate-on-total-code-coverage --strict`
