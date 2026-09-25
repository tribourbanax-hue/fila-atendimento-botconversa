// Painel "Fila de Atendimento" dentro do Bot Conversa.
// Só LÊ a lista de conversas (a mesma que a própria página usa). Não abre
// conversa, não marca como lida, não envia nada. O login não sai do navegador.

(() => {
  const API_CHATS = 'https://chats-service.botconversa.com.br/jwt_api/chat/get_chats/';
  const API_CARD = (id) => `https://backend.botconversa.com.br/api/v1/pipelines/user_card/${id}/?bot_id=${REGRAS.BOT_ID}`;
  const MAX_PAGINAS = 40;
  const ATUALIZAR_A_CADA_MIN = 5;

  const GRUPOS = [
    { id: 'vermelho', titulo: '🔴 Não lidas / esperando a loja' },
    { id: 'laranja', titulo: '🟠 Perguntaram e ficaram sem resposta' },
    { id: 'amarelo', titulo: '🟡 Pediram um tempo — cobrar' },
    { id: 'branco', titulo: '⚪ Só falaram com o robô' },
  ];

  // Conversas marcadas como "encerrado" ficam guardadas só neste navegador.
  // A chave inclui a data da última mensagem: se o cliente escrever de novo,
  // a chave muda e ele volta pra fila sozinho.
  const CHAVE_ENCERRADOS = 'fad-encerrados';
  const chaveConversa = (c) => `${c.id}|${c.data ? c.data.toISOString() : ''}`;

  function lerEncerrados() {
    try { return JSON.parse(localStorage.getItem(CHAVE_ENCERRADOS)) || {}; } catch { return {}; }
  }

  function salvarEncerrados(mapa) {
    const limite = Date.now() - 30 * 864e5; // esquece marcações com mais de 30 dias
    const limpo = Object.fromEntries(Object.entries(mapa).filter(([, quando]) => quando > limite));
    try { localStorage.setItem(CHAVE_ENCERRADOS, JSON.stringify(limpo)); } catch { /* sem armazenamento: só não lembra */ }
  }

  function marcarEncerrado(c, encerrar) {
    const mapa = lerEncerrados();
    if (encerrar) mapa[chaveConversa(c)] = Date.now();
    else delete mapa[chaveConversa(c)];
    salvarEncerrados(mapa);
    render(ultimasConversas, ultimosDias);
  }

  let ultimasConversas = [];
  let ultimosDias = REGRAS.DIAS_PADRAO;
  const cacheTelefone = new Map();
  let ultimoBruto = null;
  let carregando = false;

  function sessao() {
    const bruto = localStorage.getItem('authToken');
    if (!bruto) return null;
    try { return JSON.parse(bruto); } catch { return bruto.replace(/"/g, ''); }
  }

  async function api(url, opcoes = {}) {
    const token = sessao();
    if (!token) throw new Error('Não achei o login do Bot Conversa nesta aba. Entre no painel e recarregue.');
    const r = await fetch(url, {
      ...opcoes,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opcoes.headers || {}) },
    });
    if (r.status === 401 || r.status === 403) throw new Error('Sessão do Bot Conversa expirou. Recarregue a página.');
    if (!r.ok) throw new Error(`Bot Conversa respondeu ${r.status}`);
    return r.json();
  }

  // A resposta pode vir como lista direta ou como objeto com a lista dentro.
  function extrairLista(resp) {
    if (Array.isArray(resp)) return resp;
    for (const k of ['results', 'chats', 'data', 'items']) if (Array.isArray(resp?.[k])) return resp[k];
    return Object.values(resp || {}).find(Array.isArray) || [];
  }

  function extrairCursor(resp) {
    if (!resp || Array.isArray(resp)) return null;
    return resp.cursor ?? resp.next_cursor ?? resp.nextCursor ?? resp.pagination?.cursor ?? resp.next ?? null;
  }

  function normalizar(item) {
    const doConta = item.is_from_account;
    return {
      id: item.subscriber_id ?? item.subscriber?.id ?? item.id,
      nome: item.subscriber_full_name ?? item.full_name ?? item.name ?? '(sem nome)',
      telefone: item.subscriber_phone ?? item.phone ?? null,
      naoLidas: Number(item.count_of_unread_messages ?? item.unread_count ?? 0),
      doCliente: doConta === false || doConta === 'false',
      mensagem: typeof item.last_message === 'string' ? item.last_message : (item.last_message?.text ?? ''),
      tipo: item.message_type ?? '',
      data: lerDataUTC(item.last_message_datetime ?? item.updated_at),
    };
  }

  async function buscarConversas(dias) {
    const limite = new Date(Date.now() - dias * 864e5);
    const todas = [];
    let cursor = null;
    for (let pag = 0; pag < MAX_PAGINAS; pag++) {
      const corpo = { bot_id: REGRAS.BOT_ID };
      if (cursor) corpo.cursor = cursor;
      const resp = await api(API_CHATS, { method: 'POST', body: JSON.stringify(corpo) });
      if (pag === 0) ultimoBruto = resp;
      const lista = extrairLista(resp).map(normalizar);
      todas.push(...lista);
      const maisAntiga = lista.reduce((m, c) => (c.data && (!m || c.data < m) ? c.data : m), null);
      cursor = extrairCursor(resp);
      if (!cursor || !lista.length || (maisAntiga && maisAntiga < limite)) break;
    }
    return todas.filter((c) => !c.data || c.data >= limite);
  }

  function acharTelefone(obj, prof = 0) {
    if (!obj || typeof obj !== 'object' || prof > 4) return null;
    for (const [k, v] of Object.entries(obj)) {
      if (/phone|telefone|whatsapp/i.test(k) && typeof v === 'string' && /\d{8,}/.test(v.replace(/\D/g, ''))) return v;
    }
    for (const v of Object.values(obj)) {
      const achado = acharTelefone(v, prof + 1);
      if (achado) return achado;
    }
    return null;
  }

  async function completarTelefones(conversas) {
    const faltando = conversas.filter((c) => !c.telefone && c.id != null);
    const fila = [...faltando];
    const trabalhador = async () => {
      while (fila.length) {
        const c = fila.shift();
        if (cacheTelefone.has(c.id)) { c.telefone = cacheTelefone.get(c.id); continue; }
        try {
          const card = await api(API_CARD(c.id));
          c.telefone = acharTelefone(card);
          cacheTelefone.set(c.id, c.telefone);
        } catch { /* sem telefone, segue */ }
      }
    };
    await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
  }

  // ---------- Interface ----------

  function el(tag, props = {}, ...filhos) {
    const e = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    filhos.flat().forEach((f) => f != null && e.append(f.nodeType ? f : document.createTextNode(String(f))));
    return e;
  }

  function tempoAtras(data) {
    if (!data) return '';
    const min = Math.round((Date.now() - data) / 6e4);
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.round(h / 24)} dia(s)`;
  }

  const botao = el('button', { class: 'fad-botao', title: 'Fila de atendimento', onclick: () => alternarPainel() }, '📋 Fila', el('span', { class: 'fad-badge' }, ''));
  const painel = el('aside', { class: 'fad-painel fad-oculto' });
  document.body.append(botao, painel);

  function alternarPainel() {
    painel.classList.toggle('fad-oculto');
    if (!painel.classList.contains('fad-oculto') && !painel.dataset.carregado) atualizar();
  }

  function cartao(c, encerrado = false) {
    const produto = deduzirProduto(c.mensagem);
    const janela = horasRestantesJanela(c);
    const tel = formatarTelefone(c.telefone);
    return el('div', { class: 'fad-cartao' },
      el('div', { class: 'fad-linha1' },
        el('strong', {}, c.nome),
        el('span', { class: 'fad-quando' }, tempoAtras(c.data)),
      ),
      el('div', { class: 'fad-tel' }, tel || 'telefone não encontrado', c.naoLidas ? el('span', { class: 'fad-nl' }, ` · ${c.naoLidas} não lida(s)`) : null),
      el('div', { class: 'fad-msg' }, c.mensagem ? `“${c.mensagem.slice(0, 220)}”` : `(${c.tipo || 'mídia'})`),
      el('div', { class: 'fad-tags' },
        produto ? el('span', { class: 'fad-tag' }, `produto: ${produto}`) : null,
        janela != null ? el('span', { class: `fad-tag ${janela < 3 ? 'fad-alerta' : ''}` }, janela > 0 ? `janela 24h: faltam ${Math.floor(janela)}h` : 'fora da janela 24h — só modelo') : null,
      ),
      el('div', { class: 'fad-acoes' },
        tel ? el('button', { onclick: () => navigator.clipboard.writeText(soDigitos(c.telefone)) }, 'copiar número') : null,
        encerrado
          ? el('button', { onclick: () => marcarEncerrado(c, false) }, 'voltar pra fila')
          : el('button', { class: 'fad-encerrar', title: 'Cliente encerrou a conversa. Sai da fila até mandar mensagem nova.', onclick: () => marcarEncerrado(c, true) }, '✓ encerrado'),
      ),
    );
  }

  function render(conversas, dias) {
    ultimasConversas = conversas;
    ultimosDias = dias;
    const encerrados = lerEncerrados();
    const grupos = Object.fromEntries(GRUPOS.map((g) => [g.id, []]));
    const listaEncerrados = [];
    conversas.forEach((c) => {
      const g = classificar(c);
      if (!g) return;
      if (encerrados[chaveConversa(c)]) listaEncerrados.push(c);
      else grupos[g].push(c);
    });
    Object.values(grupos).forEach((l) => l.sort((a, b) => (a.data || 0) - (b.data || 0)));

    const urgentes = grupos.vermelho.length + grupos.laranja.length;
    botao.querySelector('.fad-badge').textContent = urgentes ? String(urgentes) : '';

    painel.replaceChildren(
      el('header', { class: 'fad-topo' },
        el('strong', {}, 'Fila de atendimento'),
        el('span', { class: 'fad-sub' }, `${conversas.length} conversas nos últimos ${dias} dia(s) · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`),
        el('div', { class: 'fad-controles' },
          el('select', { id: 'fad-dias', onchange: () => atualizar() },
            ...[1, 2, 3, 5, 7].map((d) => { const o = el('option', { value: d }, `${d} dia(s)`); if (d === dias) o.selected = true; return o; })),
          el('button', { onclick: () => atualizar() }, 'atualizar'),
          el('button', { onclick: () => diagnostico() }, 'diagnóstico'),
          el('button', { onclick: () => alternarPainel() }, '✕'),
        ),
        el('p', { class: 'fad-aviso' }, 'Só leitura. Abrir a conversa marca como lida — abra só quando for responder.'),
      ),
      ...GRUPOS.map((g) => el('details', { class: `fad-grupo fad-${g.id}`, ...(g.id !== 'branco' ? { open: '' } : {}) },
        el('summary', {}, `${g.titulo} (${grupos[g.id].length})`),
        grupos[g.id].length ? grupos[g.id].map((c) => cartao(c)) : el('p', { class: 'fad-vazio' }, 'ninguém aqui'),
      )),
      listaEncerrados.length
        ? el('details', { class: 'fad-grupo fad-encerrados' },
          el('summary', {}, `✓ Encerrados (${listaEncerrados.length})`),
          listaEncerrados.map((c) => cartao(c, true)))
        : null,
    );
    painel.dataset.carregado = '1';
  }

  async function atualizar() {
    if (carregando) return;
    carregando = true;
    const dias = Number(painel.querySelector('#fad-dias')?.value) || REGRAS.DIAS_PADRAO;
    if (!painel.dataset.carregado) painel.replaceChildren(el('p', { class: 'fad-vazio' }, 'Buscando conversas…'));
    try {
      const conversas = await buscarConversas(dias);
      // Telefone só pra quem vai aparecer na fila (evita centenas de consultas).
      const naFila = conversas.filter((c) => classificar({ ...c, telefone: null }));
      await completarTelefones(naFila);
      render(conversas, dias);
    } catch (e) {
      painel.replaceChildren(el('p', { class: 'fad-erro' }, `Erro: ${e.message}`), el('button', { onclick: () => atualizar() }, 'tentar de novo'));
    } finally {
      carregando = false;
    }
  }

  // Mostra só a ESTRUTURA da resposta (nomes de campos e tipos), sem conteúdo,
  // pra ajustar a extensão se o Bot Conversa usar nomes diferentes.
  function diagnostico() {
    const tipos = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Array.isArray(v) ? `lista(${v.length})` : v === null ? 'null' : typeof v]));
    const item = extrairLista(ultimoBruto)[0];
    const texto = JSON.stringify({
      topo: Array.isArray(ultimoBruto) ? `lista(${ultimoBruto.length})` : tipos(ultimoBruto),
      campos_de_uma_conversa: tipos(item),
      exemplo_data: item?.last_message_datetime ?? null,
    }, null, 2);
    navigator.clipboard.writeText(texto);
    painel.prepend(el('pre', { class: 'fad-diag' }, 'Copiado (cole no chat do Claude):\n' + texto));
  }

  // Atualiza o contador do botão em segundo plano, mesmo com o painel fechado.
  setInterval(() => { if (!document.hidden) atualizar(); }, ATUALIZAR_A_CADA_MIN * 6e4);
  setTimeout(atualizar, 4000);
})();
