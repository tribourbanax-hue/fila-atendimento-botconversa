// Testa as regras de separação: node teste.js
const r = require('./regras.js');

const casos = [
  ['não lida, pergunta', { nome: 'Maria', naoLidas: 2, doCliente: true, mensagem: 'qual o valor do block total 18L?' }, 'vermelho'],
  ['lida sem resposta', { nome: 'João', naoLidas: 0, doCliente: true, mensagem: 'tem pra entrega em Jacareí?' }, 'laranja'],
  ['pediu tempo', { nome: 'Ana', naoLidas: 0, doCliente: true, mensagem: 'vou ver com meu marido e te aviso' }, 'amarelo'],
  ['só robô', { nome: 'Lead', doCliente: false, mensagem: 'Vi que você se interessou pelo Block Total...' }, 'branco'],
  ['loja respondeu', { nome: 'Pedro', doCliente: false, mensagem: 'Temos sim, R$ 389' }, null],
  ['Obd.bom dia', { nome: 'x', doCliente: true, mensagem: 'Obd.bom dia' }, null],
  ['Obrigadaa', { nome: 'x', doCliente: true, mensagem: 'Obrigadaa' }, null],
  ['perfeito então', { nome: 'x', doCliente: true, mensagem: 'Há sim perfeito então' }, null],
  ['Maravilha 🙏', { nome: 'x', doCliente: true, mensagem: 'Maravilha 🙏🙏' }, null],
  ['Bom dia sozinho fica', { nome: 'x', doCliente: true, mensagem: 'Bom dia' }, 'laranja'],
  ['obrigado + pergunta fica', { nome: 'x', doCliente: true, mensagem: 'obrigado, e o de 18 litros quanto fica?' }, 'laranja'],
  // v0.3
  ['Fechado = topei, fica', { nome: 'x', doCliente: true, mensagem: 'Fechado' }, 'laranja'],
  ['combinado obrigado fica', { nome: 'x', doCliente: true, mensagem: 'Combinado, obrigado' }, 'laranja'],
  ['robô passou pro Jefferson, não lida', { nome: 'x', doCliente: false, sistema: true, naoLidas: 1, mensagem: 'Conversa atribuída a Jefferson' }, 'vermelho'],
  ['robô passou pro Jefferson, lida', { nome: 'x', doCliente: false, sistema: true, naoLidas: 0, mensagem: '' }, 'laranja'],
  ['pediu tempo mas não lida = vermelho', { nome: 'x', doCliente: true, naoLidas: 1, mensagem: 'vou pensar e te aviso' }, 'vermelho'],
  ['encerrada com cliente por último', { nome: 'x', doCliente: true, encerrada: true, mensagem: 'tem na cor cinza?' }, 'encerrada'],
  ['encerrada com loja por último sai', { nome: 'x', doCliente: false, encerrada: true, mensagem: 'Temos sim' }, null],
  ['encerrada com robô por último sai', { nome: 'x', doCliente: false, encerrada: true, mensagem: 'Vi que você se interessou pelo Block Total' }, null],
  ['campo is_from_account sumiu fica', { nome: 'x', doCliente: null, mensagem: 'oi' }, 'laranja'],
  ['robô de empresa ignorado', { nome: 'x', telefone: '5511973471502', doCliente: true, mensagem: 'oi' }, null],
];

let ok = 0;
for (const [nome, conversa, esperado] of casos) {
  const obtido = r.classificar(conversa);
  const certo = obtido === esperado;
  if (certo) ok++;
  console.log(certo ? 'OK  ' : 'ERRO', nome, '->', obtido);
}
// Cobrança só 48h depois; janela usa o prazo do Bot Conversa.
const base = new Date('2026-09-26T12:00:00Z');
const extras = [
  ['cobrar 48h depois', r.cobrarAPartirDe({ data: base }).toISOString() === '2026-09-28T12:00:00.000Z'],
  ['janela pelo send_until', Math.round(r.horasRestantesJanela({ janelaAte: new Date('2026-09-26T20:00:00Z') }, base)) === 8],
  ['janela sem send_until', Math.round(r.horasRestantesJanela({ doCliente: true, data: base }, base)) === 24],
];
for (const [nome, certo] of extras) { casos.push(0); if (certo) ok++; console.log(certo ? 'OK  ' : 'ERRO', nome); }
console.log(`${ok}/${casos.length}`);
process.exit(ok === casos.length ? 0 : 1);
