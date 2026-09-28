// Regras da skill rotina-atendimento-decorcolors (Etapa 2), em código.
// Funções puras: não acessam rede nem página, dá pra testar no Node (teste.js).

// Dados da loja (ID do bot, números e nomes ignorados) ficam em config.js,
// que não vai pro GitHub. Modelo em config.exemplo.js.
const CONFIG_LOJA = (typeof CONFIG !== 'undefined' && CONFIG)
  || (typeof require !== 'undefined' ? (() => { try { return require('./config.js'); } catch { return {}; } })() : {});

const REGRAS = {
  BOT_ID: CONFIG_LOJA.BOT_ID,
  DIAS_PADRAO: 7, // com 3, quem espera há mais tempo some da lista

  // Cliente que pediu um tempo só vira cobrança depois disso.
  HORAS_PARA_COBRAR: 48,

  // Números que nunca entram na fila (robôs de empresa). Só dígitos, sem 55.
  TELEFONES_IGNORADOS: CONFIG_LOJA.TELEFONES_IGNORADOS || [],

  // Nomes que nunca entram na fila (outras unidades, fornecedores, internos).
  NOMES_IGNORADOS: CONFIG_LOJA.NOMES_IGNORADOS || [],

  // "Fechado" e "combinado" NÃO entram: na venda querem dizer "topei".
  // Palavras de quem só agradece / encerra. Se a mensagem inteira for feita só
  // delas (mais emoji e pontuação), não precisa de retorno.
  // Precisa ter pelo menos uma palavra de FECHO; as de ENCHIMENTO só acompanham
  // (assim um "Bom dia" sozinho de cliente novo continua na fila).
  PALAVRAS_FECHO: /^(ok+|okay|blz|beleza|obrigad[ao]+s?|obg|obd|obrig|brigad[ao]+|grat[ao]|gratid[aã]o|valeu+|vlw|show|top|perfeito|maravilha|[oó]timo|[oó]tima|legal|certo|certinho|entendi|entendido|tranquilo|am[eé]m)$/i,
  PALAVRAS_ENCHIMENTO: /^(t[aá]|bom|boa|dia|tarde|noite|ah|a|h[aá]|sim|ent[aã]o|muito|mt|mto|pra|voc[eê]|vc|tbm|tamb[eé]m|igualmente|deus|aben[cç]oe|e|o|te|de|nada|por|tudo|isso)$/i,

  // Cliente pediu um tempo: merece cobrança depois.
  PEDIU_TEMPO: /(vou (ver|pensar|analisar|conversar|falar com)|depois (eu )?(te )?(falo|aviso|retorno|chamo)|te (aviso|retorno|chamo|falo)|semana que vem|m[eê]s que vem|mais pra frente|ainda n[aã]o (sei|decidi)|preciso (ver|conversar|falar)|vou decidir|qualquer coisa (eu )?(te )?(chamo|falo|aviso))/i,

  // Mensagens típicas do robô (fluxos automáticos).
  MENSAGEM_ROBO: /(vi que voc[eê] se interessou|escolha uma (das )?op[cç][oõ]es|digite o n[uú]mero|selecione|menu|em breve um (de nossos )?(atendentes|consultores)|seja bem[- ]vind|obrigad[ao] pelo contato|aguarde|clique no bot[aã]o)/i,

  PRODUTOS: [
    { nome: 'Block Total', re: /(block\s*total|infiltra[cç][aã]o|mofo|umidade|parede (molhada|[uú]mida))/i },
    { nome: 'Borracha Líquida', re: /(borracha|emborrachad|laje|telhado|impermeabiliza)/i },
    { nome: 'Aqua Shield', re: /aqua\s*shield/i },
    { nome: 'Cimento Queimado', re: /cimento\s*queimado/i },
    { nome: 'Easyclean', re: /easy\s*clean/i },
    { nome: 'Block Trincas', re: /(block\s*trinca|trinca|rachadura|fissura)/i },
  ],
};

function soDigitos(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  return d;
}

function formatarTelefone(tel) {
  const d = soDigitos(tel);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel || '';
}

// O Bot Conversa manda a data em UTC; às vezes sem o "Z" no final.
function lerDataUTC(valor) {
  if (!valor) return null;
  if (typeof valor === 'number') return new Date(valor > 1e12 ? valor : valor * 1000);
  let s = String(valor);
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += 'Z';
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function deduzirProduto(texto) {
  for (const p of REGRAS.PRODUTOS) if (p.re.test(texto || '')) return p.nome;
  return null;
}

function soEncerramento(msg) {
  const palavras = String(msg || '')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ') // tira emoji, número e pontuação
    .split(/\s+/)
    .filter(Boolean);
  return palavras.some((p) => REGRAS.PALAVRAS_FECHO.test(p))
    && palavras.every((p) => REGRAS.PALAVRAS_FECHO.test(p) || REGRAS.PALAVRAS_ENCHIMENTO.test(p));
}

function deveIgnorar(conversa) {
  const nome = conversa.nome || '';
  if (REGRAS.NOMES_IGNORADOS.some((re) => re.test(nome))) return true;
  const tel = soDigitos(conversa.telefone);
  if (tel && REGRAS.TELEFONES_IGNORADOS.includes(tel)) return true;
  return false;
}

// Recebe uma conversa já normalizada:
// { nome, telefone, naoLidas, doCliente (true/false/null = campo não veio),
//   sistema (última msg é aviso do sistema, ex. robô passou pro atendente),
//   encerrada (equipe encerrou no Bot Conversa), mensagem, data }
// Devolve 'vermelho' | 'laranja' | 'amarelo' | 'branco' | 'encerrada' | null (fora da fila).
function classificar(c) {
  if (deveIgnorar(c)) return null;
  const msg = c.mensagem || '';
  let grupo = null;

  if (c.sistema) {
    // Aviso do sistema NÃO é resposta da loja: o cliente espera um humano.
    grupo = c.naoLidas > 0 ? 'vermelho' : 'laranja';
  } else if (c.doCliente === true || c.doCliente == null) {
    // doCliente == null: o Bot Conversa não mandou o campo. Fica na lista (com aviso).
    if (c.doCliente === true && soEncerramento(msg)) return null;
    if (c.naoLidas > 0) grupo = 'vermelho'; // ninguém viu ainda, mesmo que tenha dito "vou pensar"
    else if (REGRAS.PEDIU_TEMPO.test(msg)) grupo = 'amarelo';
    else grupo = 'laranja';
  } else {
    // Última mensagem foi da loja/robô.
    if (c.encerrada) return null;
    return REGRAS.MENSAGEM_ROBO.test(msg) ? 'branco' : null;
  }

  return c.encerrada ? 'encerrada' : grupo;
}

// A partir de quando dá pra cobrar quem pediu um tempo.
function cobrarAPartirDe(c) {
  if (!c.data) return null;
  return new Date(c.data.getTime() + REGRAS.HORAS_PARA_COBRAR * 36e5);
}

// Janela de 24h do WhatsApp. Usa o prazo que o Bot Conversa já manda
// (send_until_datetime); se não vier, conta da última mensagem do cliente.
function horasRestantesJanela(c, agora = new Date()) {
  let fim = c.janelaAte;
  if (!fim) {
    if (c.doCliente !== true || !c.data) return null;
    fim = new Date(c.data.getTime() + 24 * 36e5);
  }
  const restante = (fim - agora) / 36e5;
  return restante > 0 ? restante : 0;
}

if (typeof module !== 'undefined') {
  module.exports = { REGRAS, soDigitos, formatarTelefone, lerDataUTC, deduzirProduto, soEncerramento, deveIgnorar, classificar, cobrarAPartirDe, horasRestantesJanela };
}
