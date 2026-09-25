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
];

let ok = 0;
for (const [nome, conversa, esperado] of casos) {
  const obtido = r.classificar(conversa);
  const certo = obtido === esperado;
  if (certo) ok++;
  console.log(certo ? 'OK  ' : 'ERRO', nome, '->', obtido);
}
console.log(`${ok}/${casos.length}`);
process.exit(ok === casos.length ? 0 : 1);
