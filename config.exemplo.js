// Copie este arquivo para config.js e preencha com os dados da sua conta.
const CONFIG = {
  // ID do seu bot no Bot Conversa (aparece nas chamadas da página de atendimento).
  BOT_ID: 0,
  // Números que nunca entram na fila (robôs de outras empresas etc.). Só dígitos, com DDD, sem 55.
  TELEFONES_IGNORADOS: [],
  // Nomes que nunca entram na fila (outras unidades, fornecedores, equipe interna).
  NOMES_IGNORADOS: [/fornecedor/i],
};

if (typeof module !== 'undefined') module.exports = CONFIG;
