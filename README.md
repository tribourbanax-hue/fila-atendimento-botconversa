# Fila de Atendimento para Bot Conversa

Extensão do Chrome que mostra, dentro do [Bot Conversa](https://botconversa.com.br),
quem precisa de resposta, separado em 4 grupos:

| Grupo | Quando |
|---|---|
| 🔴 Não lidas / esperando a loja | última mensagem é do cliente e ninguém leu |
| 🟠 Perguntaram e ficaram sem resposta | última mensagem é do cliente, já lida, sem resposta |
| 🟡 Pediram um tempo — cobrar | cliente disse "vou ver", "te aviso", "semana que vem"... |
| ⚪ Só falaram com o robô | última mensagem foi de um fluxo automático |

Cada cliente aparece com nome, número, o que mandou, há quanto tempo, o produto
deduzido da mensagem e quanto falta da janela de 24h do WhatsApp.

**Só leitura.** Usa a mesma lista de conversas que a página do Bot Conversa já
carrega, com o login que já está aberto no navegador. Não abre conversa, não marca
como lida, não envia mensagem, e o login não sai do navegador.

## Instalar
1. Baixe/clone esta pasta.
2. Copie `config.exemplo.js` para `config.js` e preencha o ID do seu bot e, se
   quiser, os números e nomes que nunca devem entrar na fila.
3. No Chrome, abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e escolha a pasta.
5. Abra (ou recarregue) a caixa de entrada do Bot Conversa. Aparece o botão
   **📋 Fila** no canto inferior esquerdo, com o número de urgentes.

## Usar
- **📋 Fila** abre o painel. Escolha quantos dias olhar (padrão 3). Atualiza sozinho
  a cada 5 minutos.
- **✓ encerrado** tira da fila quem encerrou a conversa, sem mandar mensagem (evita
  o ciclo "obrigado" ↔ "por nada"). Fica guardado só no seu navegador, e o cliente
  **volta pra fila sozinho se mandar mensagem nova**.
- **diagnóstico** copia só os nomes dos campos que o Bot Conversa devolveu (sem
  conteúdo nem login), útil se algo parar de funcionar.

## Regras
Ficam em `regras.js` (funções puras). Fora da fila: quem só agradeceu/encerrou
("Obrigadaa", "perfeito então", "Maravilha" — um "Bom dia" sozinho continua na
fila), conversas em que a loja já respondeu, e os números/nomes do `config.js`.

Testar as regras: `node teste.js`

Depois de mudar qualquer arquivo: `chrome://extensions` → ↻ da extensão →
recarregar a aba do Bot Conversa.

## Aviso
Projeto independente, sem ligação com o Bot Conversa. Usa endpoints internos da
página, que podem mudar sem aviso.
