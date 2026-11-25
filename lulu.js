/* =============================================================
   PARTE EXTRA DA LULU (25/11/2026): Marcas, Publis, Financeiro e Contrato.
   Fica separada do painel do curso de propósito: a atualização do Ryan troca
   index.html / app.js / app.css, mas NÃO mexe neste arquivo, no lulu.css nem
   no banco_lulu.sql. Depois de atualizar, só recolocar os 4 pontos marcados
   com "LULU-HOOK" no app.js e no index.html.
   Banco: tabelas public.marcas e public.publis (banco_lulu.sql).
   ============================================================= */
(function () {
  "use strict";
  window.PAINEL_EXTRAS = window.PAINEL_EXTRAS || [];

  const STATUS_MARCA = { prospeccao: "Quero abordar", conversando: "Conversando", parceira: "Parceira", pausada: "Pausada" };
  const STATUS_PUBLI = { proposta: "Proposta", fechada: "Fechada", gravando: "Gravando", entregue: "Entregue", paga: "Paga", cancelada: "Cancelada" };
  const A_RECEBER = ["fechada", "gravando", "entregue"];
  const ICONES = {
    marcas: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-5h6v5M9 11h6"/>',
    publis: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    financeiro: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    contrato: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h3M14 18l1.5 1.5L19 16"/>'
  };
  const TELAS = [["marcas", "Marcas"], ["publis", "Publis"], ["financeiro", "Financeiro"], ["contrato", "Contrato"]];

  window.PAINEL_EXTRAS.push(function (P) {
    const { esc, real, toast, $, irPara } = P;
    const L = { marcas: [], publis: [], ok: false, erro: "", editMarca: null, editPubli: null, publiContrato: null };

    /* ---------- datas e números ---------- */
    const hoje = () => P.hojeISO();
    const dataLonga = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
    const mesDe = (iso) => (iso || "").slice(0, 7);
    const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const nomeMes = (m) => `${MESES[+m.slice(5, 7) - 1]}/${m.slice(2, 4)}`;
    const n = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
    const venc = (p) => p.vence_em || (p.entrega_em && p.prazo_pagamento != null ? P.somaDias(p.entrega_em, p.prazo_pagamento) : null);
    const atrasada = (p) => A_RECEBER.includes(p.status) && venc(p) && venc(p) < hoje();
    const marcaDe = (id) => L.marcas.find((m) => m.id === id) || null;
    const nomeMarca = (id) => (marcaDe(id) || {}).nome || "sem marca";

    /* ---------- banco ---------- */
    const sb = () => window.LULU_TESTE_SB || P.sb();   // LULU_TESTE_SB só existe no teste local
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const amigavel = (e) => {
      const t = String((e && (e.message || e.details)) || e || "");
      if (/relation .*(marcas|publis).* does not exist|could not find the table|schema cache/i.test(t)) return "Falta rodar o banco_lulu.sql no Supabase (SQL Editor > New query > cole > Run).";
      return P.traduz ? P.traduz(e) : t;
    };
    async function carregar(forcar) {
      if (L.ok && !forcar) return;
      if (!sb()) { L.erro = "No modo demonstração esta parte não funciona."; return; }
      try {
        L.marcas = ok(await sb().from("marcas").select("*").order("nome"));
        L.publis = ok(await sb().from("publis").select("*").order("criado_em", { ascending: false }));
        L.ok = true; L.erro = "";
      } catch (e) { L.erro = amigavel(e); }
    }
    const salvar = async (tabela, dados, id) => (id
      ? ok(await sb().from(tabela).update(dados).eq("id", id).select("*").single())
      : ok(await sb().from(tabela).insert(dados).select("*").single()));
    const apagar = async (tabela, id) => ok(await sb().from(tabela).delete().eq("id", id));
    const trocar = (lista, item) => { const i = lista.findIndex((x) => x.id === item.id); if (i >= 0) lista[i] = item; else lista.unshift(item); };

    /* ---------- pedaços de tela ---------- */
    const cabeca = (t, p, extra = "") => `<div class="cabeca"><div><h1>${t}</h1><p>${p}</p></div>${extra}</div>`;
    const erroTela = () => `<div class="aviso">${esc(L.erro)}</div>`;
    const opcoes = (obj, atual) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${atual === k ? " selected" : ""}>${v}</option>`).join("");
    const campo = (id, rot, valor, tipo = "text", extra = "") => `<div><label class="lbl" for="${id}">${rot}</label><input class="inp" id="${id}" type="${tipo}" value="${esc(valor ?? "")}" ${extra}></div>`;
    const val = (el, id) => { const i = el.querySelector("#" + id); return i ? i.value.trim() : ""; };

    /* ============ MARCAS ============ */
    async function telaMarcas(el) {
      await carregar();
      if (L.erro) { el.innerHTML = cabeca("Marcas", "As marcas com quem você fala, fechou ou quer fechar.") + erroTela(); return; }
      const m = L.editMarca ? marcaDe(L.editMarca) || {} : {};
      const resumo = (id) => { const ps = L.publis.filter((p) => p.marca_id === id && p.status !== "cancelada"); return { qtd: ps.length, total: ps.reduce((s, p) => s + (+p.valor || 0), 0) }; };
      el.innerHTML = cabeca("Marcas", "As marcas com quem você fala, fechou ou quer fechar. Os dados de empresa entram sozinhos no contrato.") + `
        <div class="card"><div class="card-topo"><h2>${L.editMarca ? "Editar marca" : "Nova marca"}</h2>${L.editMarca ? '<span class="espaco"></span><button class="link" type="button" data-lu="cancelar-marca">cancelar edição</button>' : ""}</div>
          <form class="lu-form" id="luFormMarca">
            <div class="lu-grade">
              ${campo("mNome", "Nome da marca *", m.nome, "text", 'required maxlength="120"')}
              <div><label class="lbl" for="mStatus">Situação</label><select class="inp" id="mStatus">${opcoes(STATUS_MARCA, m.status || "prospeccao")}</select></div>
              ${campo("mContato", "Pessoa de contato", m.contato, "text", 'maxlength="120"')}
              ${campo("mEmail", "E-mail", m.email, "email", 'maxlength="160"')}
              ${campo("mWhats", "WhatsApp", m.whatsapp, "tel", 'maxlength="30"')}
              ${campo("mInsta", "Instagram", m.instagram, "text", 'maxlength="80" placeholder="@marca"')}
            </div>
            <details class="lu-mais"${m.razao_social || m.cnpj ? " open" : ""}><summary>Dados da empresa (para o contrato)</summary>
              <div class="lu-grade">
                ${campo("mRazao", "Razão social", m.razao_social, "text", 'maxlength="200" placeholder="Ex.: Marca Brasil Ltda."')}
                ${campo("mCnpj", "CNPJ", m.cnpj, "text", 'maxlength="30" placeholder="00.000.000/0000-00"')}
                ${campo("mRep", "Representante legal", m.representante, "text", 'maxlength="120" placeholder="Quem assina pela marca"')}
                ${campo("mEnd", "Endereço da empresa", m.endereco, "text", 'maxlength="300"')}
              </div></details>
            <div><label class="lbl" for="mObs">Anotações</label><textarea class="inp" id="mObs" rows="2" maxlength="2000">${esc(m.obs || "")}</textarea></div>
            <div class="controles"><button class="btn pequeno" type="submit">${L.editMarca ? "Salvar marca" : "Adicionar marca"}</button></div>
          </form></div>
        <div class="card"><div class="tabela-caixa"><table><thead><tr><th>Marca</th><th>Contato</th><th>Situação</th><th class="num">Publis</th><th class="num">Valor fechado</th><th></th></tr></thead><tbody>
          ${L.marcas.map((x) => { const r = resumo(x.id); return `<tr><td><div class="td-nome">${esc(x.nome)}</div>${x.instagram ? `<small class="lu-cinza">${esc(x.instagram)}</small>` : ""}</td>
            <td>${esc(x.contato || "")}${x.whatsapp ? `<br><small class="lu-cinza">${esc(x.whatsapp)}</small>` : ""}${x.email ? `<br><small class="lu-cinza">${esc(x.email)}</small>` : ""}</td>
            <td><select class="inp" data-lu="status-marca" data-id="${x.id}" aria-label="Situação">${opcoes(STATUS_MARCA, x.status)}</select></td>
            <td class="num">${r.qtd}</td><td class="num">${real(r.total)}</td>
            <td class="lu-acoes"><button class="link" type="button" data-lu="editar-marca" data-id="${x.id}">editar</button><button class="x" type="button" data-lu="apagar-marca" data-id="${x.id}" aria-label="Apagar">×</button></td></tr>`; }).join("") || '<tr><td colspan="6"><p class="vazio">Nenhuma marca ainda. Comece pelas que já te mandaram recebidos.</p></td></tr>'}
        </tbody></table></div></div>`;

      el.querySelector("#luFormMarca").addEventListener("submit", async (e) => {
        e.preventDefault();
        const dados = { nome: val(el, "mNome"), status: val(el, "mStatus"), contato: val(el, "mContato") || null, email: val(el, "mEmail") || null, whatsapp: val(el, "mWhats") || null, instagram: val(el, "mInsta") || null, razao_social: val(el, "mRazao") || null, cnpj: val(el, "mCnpj") || null, representante: val(el, "mRep") || null, endereco: val(el, "mEnd") || null, obs: val(el, "mObs") || null };
        if (!dados.nome) return;
        try { trocar(L.marcas, await salvar("marcas", dados, L.editMarca)); L.marcas.sort((a, b) => a.nome.localeCompare(b.nome)); toast(L.editMarca ? "Marca salva." : "Marca adicionada."); L.editMarca = null; telaMarcas(el); }
        catch (er) { toast(amigavel(er), true); }
      });
      el.onchange = async (e) => {
        const t = e.target.closest("[data-lu='status-marca']"); if (!t) return;
        try { trocar(L.marcas, await salvar("marcas", { status: t.value }, +t.dataset.id)); toast("Situação atualizada."); } catch (er) { toast(amigavel(er), true); }
      };
      el.onclick = async (e) => {
        const t = e.target.closest("[data-lu]"); if (!t) return; const id = +t.dataset.id, a = t.dataset.lu;
        if (a === "editar-marca") { L.editMarca = id; telaMarcas(el); window.scrollTo(0, 0); }
        else if (a === "cancelar-marca") { L.editMarca = null; telaMarcas(el); }
        else if (a === "apagar-marca") {
          const x = marcaDe(id); if (!x || !confirm(`Apagar a marca "${x.nome}"? As publis dela continuam, só ficam sem marca.`)) return;
          try { await apagar("marcas", id); L.marcas = L.marcas.filter((y) => y.id !== id); L.publis.forEach((p) => { if (p.marca_id === id) p.marca_id = null; }); toast("Marca apagada."); telaMarcas(el); } catch (er) { toast(amigavel(er), true); }
        }
      };
    }

    /* ============ PUBLIS ============ */
    async function telaPublis(el) {
      await carregar();
      if (L.erro) { el.innerHTML = cabeca("Publis", "Cada trabalho pago, da proposta até o dinheiro cair.") + erroTela(); return; }
      const p = L.editPubli ? L.publis.find((x) => x.id === L.editPubli) || {} : {};
      const ativas = L.publis.filter((x) => x.status !== "cancelada");
      el.innerHTML = cabeca("Publis", "Cada trabalho pago, da proposta até o dinheiro cair. Quando marcar como Paga, ela entra no Financeiro.") + `
        <div class="card"><div class="card-topo"><h2>${L.editPubli ? "Editar publi" : "Nova publi"}</h2>${L.editPubli ? '<span class="espaco"></span><button class="link" type="button" data-lu="cancelar-publi">cancelar edição</button>' : ""}</div>
          <form class="lu-form" id="luFormPubli">
            <div class="lu-grade">
              <div><label class="lbl" for="pMarca">Marca</label><select class="inp" id="pMarca"><option value="">(sem marca)</option>${L.marcas.map((m) => `<option value="${m.id}"${p.marca_id === m.id ? " selected" : ""}>${esc(m.nome)}</option>`).join("")}</select></div>
              ${campo("pTitulo", "Nome da publi *", p.titulo, "text", 'required maxlength="160" placeholder="Ex.: J-San, terça em dobro"')}
              <div><label class="lbl" for="pStatus">Situação</label><select class="inp" id="pStatus">${opcoes(STATUS_PUBLI, p.status || "proposta")}</select></div>
              ${campo("pValor", "Valor total (R$) *", p.valor, "number", 'min="0" step="0.01" required')}
              ${campo("pVideos", "Quantidade de vídeos", p.qtd_videos ?? 1, "number", 'min="0" max="100"')}
              ${campo("pDuracao", "Duração de cada vídeo", p.duracao_video, "text", 'maxlength="60" placeholder="Ex.: 30 a 60 segundos"')}
              ${campo("pFotos", "Quantidade de fotos", p.qtd_fotos ?? 0, "number", 'min="0" max="100"')}
              ${campo("pEntrega", "Entregar até", p.entrega_em, "date")}
              ${campo("pForma", "Forma de pagamento", p.forma_pagamento ?? "PIX ou transferência", "text", 'maxlength="120"')}
              ${campo("pPrazo", "Pagar em quantos dias após a entrega", p.prazo_pagamento ?? 30, "number", 'min="0" max="365"')}
              ${campo("pLicenca", "Licença de mídia paga (meses, 0 = não)", p.licenca_meses ?? 0, "number", 'min="0" max="120"')}
            </div>
            <div><label class="lbl" for="pEntregaveis">O que vai entregar (detalhes)</label><textarea class="inp" id="pEntregaveis" rows="2" maxlength="2000" placeholder="Ex.: 1 reels no meu Instagram + 3 stories com link">${esc(p.entregaveis || "")}</textarea></div>
            <div><label class="lbl" for="pObs">Anotações</label><textarea class="inp" id="pObs" rows="2" maxlength="2000">${esc(p.obs || "")}</textarea></div>
            <div class="controles"><button class="btn pequeno" type="submit">${L.editPubli ? "Salvar publi" : "Adicionar publi"}</button>${L.marcas.length ? "" : '<button class="link" type="button" data-tela="marcas">cadastrar uma marca antes</button>'}</div>
          </form></div>
        <div class="card"><div class="tabela-caixa"><table><thead><tr><th>Publi</th><th>Entrega</th><th>Pagamento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
          ${L.publis.map((x) => { const v = venc(x), atr = atrasada(x); return `<tr${x.status === "cancelada" ? ' class="lu-apagada"' : ""}><td><div class="td-nome">${esc(x.titulo)}</div><small class="lu-cinza">${esc(nomeMarca(x.marca_id))} · ${x.qtd_videos || 0} vídeo(s)${x.qtd_fotos ? ` · ${x.qtd_fotos} foto(s)` : ""}</small></td>
            <td>${x.entrega_em ? P.dataBR(x.entrega_em) : "<small class='lu-cinza'>sem data</small>"}</td>
            <td>${x.status === "paga" ? `<span class="selo sobe">paga ${P.dataBR(x.pago_em)}</span>` : v ? `<span class="selo ${atr ? "desce" : ""}">${atr ? "atrasada · " : "vence "}${P.dataBR(v)}</span>` : ""}</td>
            <td class="num">${real(x.valor)}</td>
            <td><select class="inp" data-lu="status-publi" data-id="${x.id}" aria-label="Situação">${opcoes(STATUS_PUBLI, x.status)}</select></td>
            <td class="lu-acoes"><button class="link" type="button" data-lu="contrato-publi" data-id="${x.id}">contrato</button><button class="link" type="button" data-lu="editar-publi" data-id="${x.id}">editar</button><button class="x" type="button" data-lu="apagar-publi" data-id="${x.id}" aria-label="Apagar">×</button></td></tr>`; }).join("") || '<tr><td colspan="6"><p class="vazio">Nenhuma publi ainda.</p></td></tr>'}
        </tbody></table></div>
        <p class="frase">${ativas.length} publi(s) · ${real(ativas.reduce((s, x) => s + (+x.valor || 0), 0))} no total. Ao mudar a situação para Paga, a data de hoje vira a data do pagamento.</p></div>`;

      el.querySelector("#luFormPubli").addEventListener("submit", async (e) => {
        e.preventDefault();
        const dados = { marca_id: n(val(el, "pMarca")), titulo: val(el, "pTitulo"), status: val(el, "pStatus"), valor: n(val(el, "pValor")) || 0, qtd_videos: n(val(el, "pVideos")) ?? 0, duracao_video: val(el, "pDuracao") || null, qtd_fotos: n(val(el, "pFotos")) ?? 0, entrega_em: val(el, "pEntrega") || null, forma_pagamento: val(el, "pForma") || null, prazo_pagamento: n(val(el, "pPrazo")), licenca_meses: n(val(el, "pLicenca")), entregaveis: val(el, "pEntregaveis") || null, obs: val(el, "pObs") || null };
        if (!dados.titulo) return;
        dados.vence_em = dados.entrega_em && dados.prazo_pagamento != null ? P.somaDias(dados.entrega_em, dados.prazo_pagamento) : null;
        if (dados.status === "paga" && !(p && p.pago_em)) dados.pago_em = hoje();
        if (dados.status !== "paga") dados.pago_em = null;
        try { trocar(L.publis, await salvar("publis", dados, L.editPubli)); toast(L.editPubli ? "Publi salva." : "Publi adicionada."); L.editPubli = null; telaPublis(el); }
        catch (er) { toast(amigavel(er), true); }
      });
      el.onchange = async (e) => {
        const t = e.target.closest("[data-lu='status-publi']"); if (!t) return;
        const atual = L.publis.find((x) => x.id === +t.dataset.id) || {};
        const dados = { status: t.value, pago_em: t.value === "paga" ? atual.pago_em || hoje() : null };
        try { trocar(L.publis, await salvar("publis", dados, +t.dataset.id)); toast(t.value === "paga" ? "Marcada como paga hoje." : "Situação atualizada."); telaPublis(el); } catch (er) { toast(amigavel(er), true); }
      };
      el.onclick = async (e) => {
        const t = e.target.closest("[data-lu]"); if (!t) return; const id = +t.dataset.id, a = t.dataset.lu;
        if (a === "editar-publi") { L.editPubli = id; telaPublis(el); window.scrollTo(0, 0); }
        else if (a === "cancelar-publi") { L.editPubli = null; telaPublis(el); }
        else if (a === "contrato-publi") { L.publiContrato = id; irPara("contrato"); }
        else if (a === "apagar-publi") {
          const x = L.publis.find((y) => y.id === id); if (!x || !confirm(`Apagar a publi "${x.titulo}"? Não dá para desfazer.`)) return;
          try { await apagar("publis", id); L.publis = L.publis.filter((y) => y.id !== id); toast("Publi apagada."); telaPublis(el); } catch (er) { toast(amigavel(er), true); }
        }
      };
    }

    /* ============ FINANCEIRO ============ */
    async function telaFinanceiro(el) {
      await carregar(true);
      if (L.erro) { el.innerHTML = cabeca("Financeiro", "O dinheiro das publis.") + erroTela(); return; }
      const mes = hoje().slice(0, 7), ano = hoje().slice(0, 4);
      const pagas = L.publis.filter((p) => p.status === "paga" && p.pago_em);
      const soma = (l) => l.reduce((s, p) => s + (+p.valor || 0), 0);
      const aReceber = L.publis.filter((p) => A_RECEBER.includes(p.status)).sort((a, b) => (venc(a) || "9999").localeCompare(venc(b) || "9999"));
      const atras = aReceber.filter(atrasada);
      const propostas = L.publis.filter((p) => p.status === "proposta");
      const meses = []; for (let k = 5; k >= 0; k--) { const d = new Date(+mes.slice(0, 4), +mes.slice(5, 7) - 1 - k, 1); meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
      const porMes = meses.map((m) => ({ m, v: soma(pagas.filter((p) => mesDe(p.pago_em) === m)) })), maior = Math.max(1, ...porMes.map((x) => x.v));
      const porMarca = Object.values(pagas.reduce((o, p) => { const k = p.marca_id || 0; (o[k] = o[k] || { nome: nomeMarca(p.marca_id), v: 0, q: 0 }); o[k].v += +p.valor || 0; o[k].q++; return o; }, {})).sort((a, b) => b.v - a.v);
      el.innerHTML = cabeca("Financeiro", "O dinheiro das publis: o que já caiu, o que falta cair e o que está atrasado. As comissões do TikTok Shop continuam em Resultados.") + `
        <div class="grade g4 lu-kpis">
          <div class="card kpi escuro"><p class="rot">Recebido no mês</p><p class="val">${real(soma(pagas.filter((p) => mesDe(p.pago_em) === mes)))}</p><small>${pagas.filter((p) => mesDe(p.pago_em) === mes).length} publi(s) paga(s)</small></div>
          <div class="card kpi"><p class="rot">A receber</p><p class="val">${real(soma(aReceber))}</p><small>${aReceber.length} publi(s) fechada(s)</small></div>
          <div class="card kpi"><p class="rot">Atrasado</p><p class="val${atras.length ? " lu-vermelho" : ""}">${real(soma(atras))}</p><small>${atras.length ? `${atras.length} passou do vencimento` : "nada atrasado"}</small></div>
          <div class="card kpi"><p class="rot">Recebido em ${ano}</p><p class="val">${real(soma(pagas.filter((p) => p.pago_em.slice(0, 4) === ano)))}</p><small>${propostas.length ? `${propostas.length} proposta(s) em aberto: ${real(soma(propostas))}` : "nenhuma proposta em aberto"}</small></div>
        </div>
        <div class="grade g2">
          <div class="card"><div class="card-topo"><h2>Falta receber</h2><span class="sub">a que vence primeiro no topo</span></div>
            <ul class="lista-foco">${aReceber.map((p) => { const v = venc(p); return `<li><span class="nome">${esc(p.titulo)} · ${esc(nomeMarca(p.marca_id))}</span><span class="val">${real(p.valor)}</span><small>${STATUS_PUBLI[p.status]}${v ? ` · ${atrasada(p) ? "<b class='lu-vermelho'>atrasada desde " + P.dataBR(v) + "</b>" : "vence " + P.dataBR(v)}` : " · sem data de pagamento"} <button class="link" type="button" data-lu="pagou" data-id="${p.id}">marcar como paga</button></small></li>`; }).join("") || '<li><span class="nome">Nada para receber agora.</span></li>'}</ul></div>
          <div class="card"><div class="card-topo"><h2>Recebido por mês</h2><span class="sub">últimos 6 meses</span></div>
            <div class="lu-barras">${porMes.map((x) => `<div class="lu-barra"><span class="lu-barra-v">${x.v ? real(x.v) : ""}</span><span class="lu-barra-c" style="height:${Math.round((x.v / maior) * 100)}%"></span><span class="lu-barra-m">${nomeMes(x.m)}</span></div>`).join("")}</div>
            <div class="card-topo" style="margin-top:18px"><h2>Por marca</h2><span class="sub">tudo que já foi pago</span></div>
            <ul class="lista-foco">${porMarca.map((x) => `<li><span class="nome">${esc(x.nome)}</span><span class="val">${real(x.v)}</span><small>${x.q} publi(s)</small></li>`).join("") || '<li><span class="nome">Ainda não tem publi paga.</span></li>'}</ul></div>
        </div>`;
      el.onchange = null;
      el.onclick = async (e) => {
        const t = e.target.closest("[data-lu='pagou']"); if (!t) return;
        try { trocar(L.publis, await salvar("publis", { status: "paga", pago_em: hoje() }, +t.dataset.id)); toast("Marcada como paga hoje."); telaFinanceiro(el); } catch (er) { toast(amigavel(er), true); }
      };
    }

    /* ============ CONTRATO ============ */
    const CHAVE_EU = "lulu-contrato-meus-dados";
    const lerEu = () => { try { return JSON.parse(localStorage.getItem(CHAVE_EU) || "{}"); } catch (_) { return {}; } };
    const guardarEu = (d) => { try { localStorage.setItem(CHAVE_EU, JSON.stringify(d)); } catch (_) {} };

    async function telaContrato(el) {
      await carregar();
      if (L.erro) { el.innerHTML = cabeca("Contrato", "Gera o contrato de uma publi pronto para imprimir ou salvar em PDF.") + erroTela(); return; }
      const p = L.publis.find((x) => x.id === L.publiContrato) || {};
      const m = marcaDe(p.marca_id) || {};
      const eu = lerEu();
      const perfil = P.S.perfil || {};
      el.innerHTML = cabeca("Contrato", "Escolha a publi, confira os dados e gere o contrato pronto para imprimir ou salvar em PDF.") + `
        <div class="card"><div class="card-topo"><h2>1. De qual publi?</h2></div>
          <select class="inp" id="cPubli"><option value="">(preencher tudo à mão)</option>${L.publis.filter((x) => x.status !== "cancelada").map((x) => `<option value="${x.id}"${x.id === p.id ? " selected" : ""}>${esc(x.titulo)} · ${esc(nomeMarca(x.marca_id))} · ${real(x.valor)}</option>`).join("")}</select>
          <p class="frase">Escolhendo a publi, os dados dela e da marca entram sozinhos. O que faltar, complete aqui embaixo (e, se quiser guardar, complete também em Marcas ou Publis).</p></div>
        <form class="lu-form" id="luFormContrato">
          <div class="card"><div class="card-topo"><h2>2. A marca (contratante)</h2></div><div class="lu-grade">
            ${campo("kRazao", "Razão social *", m.razao_social || m.nome, "text", "required")}
            ${campo("kCnpj", "CNPJ *", m.cnpj, "text", 'required placeholder="00.000.000/0000-00"')}
            ${campo("kRep", "Representante legal", m.representante, "text", 'placeholder="Quem assina pela marca"')}
            ${campo("kEnd", "Endereço da empresa", m.endereco)}
            ${campo("kEmail", "E-mail da marca", m.email, "email")}
          </div></div>
          <div class="card"><div class="card-topo"><h2>3. Você (contratada)</h2><span class="sub">fica guardado só neste aparelho</span></div><div class="lu-grade">
            ${campo("eNome", "Nome completo ou razão social *", eu.nome || perfil.nome, "text", "required")}
            ${campo("eDoc", "CPF ou CNPJ *", eu.doc, "text", "required")}
            ${campo("eEnd", "Endereço", eu.end)}
            ${campo("eCidade", "Cidade / UF (foro do contrato)", eu.cidade, "text", 'placeholder="Ex.: Vitória / ES"')}
            ${campo("eEmail", "Seu e-mail", eu.email)}
            ${campo("ePix", "Chave PIX ou dados bancários", eu.pix)}
          </div></div>
          <div class="card"><div class="card-topo"><h2>4. O trabalho</h2></div><div class="lu-grade">
            ${campo("tTitulo", "Campanha / publi *", p.titulo, "text", "required")}
            ${campo("tValor", "Valor total (R$) *", p.valor, "number", 'min="0" step="0.01" required')}
            ${campo("tVideos", "Quantidade de vídeos", p.qtd_videos ?? 1, "number", 'min="0"')}
            ${campo("tDuracao", "Duração de cada vídeo", p.duracao_video, "text", 'placeholder="Ex.: 30 a 60 segundos"')}
            ${campo("tFotos", "Quantidade de fotos", p.qtd_fotos ?? 0, "number", 'min="0"')}
            ${campo("tEntrega", "Entregar até", p.entrega_em, "date")}
            ${campo("tForma", "Forma de pagamento", p.forma_pagamento ?? "PIX ou transferência bancária")}
            ${campo("tPrazo", "Pagar em quantos dias após a entrega", p.prazo_pagamento ?? 30, "number", 'min="0"')}
            ${campo("tLicenca", "Licença de mídia paga (meses, 0 = não autoriza)", p.licenca_meses ?? 0, "number", 'min="0"')}
            ${campo("tAjustes", "Rodadas de ajuste incluídas", 1, "number", 'min="0" max="5"')}
          </div>
          <div style="margin-top:12px"><label class="lbl" for="tEntregaveis">Detalhes da entrega</label><textarea class="inp" id="tEntregaveis" rows="2" placeholder="Ex.: 1 reels no meu Instagram + 3 stories com link">${esc(p.entregaveis || "")}</textarea></div>
          <div class="controles" style="margin-top:14px"><button class="btn" type="submit">Gerar contrato</button></div></div>
        </form>`;
      el.onchange = (e) => { if (e.target.id === "cPubli") { L.publiContrato = n(e.target.value); telaContrato(el); } };
      el.onclick = null;
      el.querySelector("#luFormContrato").addEventListener("submit", (e) => {
        e.preventDefault();
        const d = (id) => val(el, id);
        guardarEu({ nome: d("eNome"), doc: d("eDoc"), end: d("eEnd"), cidade: d("eCidade"), email: d("eEmail"), pix: d("ePix") });
        abrirContrato({
          marca: { razao: d("kRazao"), cnpj: d("kCnpj"), rep: d("kRep"), end: d("kEnd"), email: d("kEmail") },
          eu: { nome: d("eNome"), doc: d("eDoc"), end: d("eEnd"), cidade: d("eCidade"), email: d("eEmail"), pix: d("ePix") },
          t: { titulo: d("tTitulo"), valor: +d("tValor") || 0, videos: +d("tVideos") || 0, duracao: d("tDuracao"), fotos: +d("tFotos") || 0, entrega: d("tEntrega"), forma: d("tForma"), prazo: d("tPrazo"), licenca: +d("tLicenca") || 0, ajustes: +d("tAjustes") || 0, detalhes: d("tEntregaveis") }
        });
      });
    }

    function abrirContrato({ marca, eu, t }) {
      const lin = (rot, v) => (v ? `${rot} ${esc(v)}` : "");
      const partes = [lin("inscrita no CNPJ sob o nº", marca.cnpj), lin("com sede em", marca.end), lin("neste ato representada por", marca.rep)].filter(Boolean).join(", ");
      const itens = [t.videos ? `${t.videos} vídeo(s)${t.duracao ? ` de ${esc(t.duracao)}` : ""}` : "", t.fotos ? `${t.fotos} foto(s)` : ""].filter(Boolean).join(" e ") || "o conteúdo descrito abaixo";
      const hojeTxt = (() => { const d = new Date(); return `${d.getDate()} de ${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][d.getMonth()]} de ${d.getFullYear()}`; })();
      let k = 0; const cl = (titulo, corpo) => `<h3>Cláusula ${++k}ª · ${titulo}</h3>${corpo}`;
      const antigo = document.getElementById("luContrato"); if (antigo) antigo.remove();
      const box = document.createElement("div"); box.id = "luContrato"; box.className = "lu-contrato-tela"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Contrato");
      box.innerHTML = `<div class="lu-contrato-caixa">
        <div class="lu-contrato-barra"><span>Confira o texto antes de mandar. Para salvar em PDF, clique em Imprimir e escolha "Salvar como PDF".</span><span class="controles"><button class="btn sec pequeno" type="button" data-k="imprimir">Imprimir</button><button class="btn pequeno" type="button" data-k="fechar">Fechar</button></span></div>
        <article class="lu-contrato" contenteditable="true" spellcheck="false">
          <h2>Contrato de prestação de serviços de criação de conteúdo</h2>
          <p><b>CONTRATANTE:</b> ${esc(marca.razao)}${partes ? ", " + partes : ""}${marca.email ? `, e-mail ${esc(marca.email)}` : ""}.</p>
          <p><b>CONTRATADA:</b> ${esc(eu.nome)}, inscrita no CPF/CNPJ sob o nº ${esc(eu.doc)}${eu.end ? `, com endereço em ${esc(eu.end)}` : ""}${eu.email ? `, e-mail ${esc(eu.email)}` : ""}.</p>
          <p>As partes acima combinam o seguinte:</p>
          ${cl("Objeto", `<p>A CONTRATADA vai criar e entregar para a CONTRATANTE ${itens}, referente à campanha <b>${esc(t.titulo)}</b>.${t.detalhes ? ` Detalhes da entrega: ${esc(t.detalhes)}.` : ""}</p>`)}
          ${cl("Prazo e aprovação", `<p>O conteúdo será entregue até <b>${t.entrega ? dataLonga(t.entrega) : "[data combinada]"}</b>, desde que a CONTRATANTE envie o briefing e, quando for o caso, o produto com antecedência suficiente. A CONTRATANTE terá 2 (dois) dias úteis para aprovar ou pedir ajustes. Estão incluídas ${t.ajustes} rodada(s) de ajuste sem custo; regravações por mudança de briefing depois da aprovação serão combinadas e cobradas à parte.</p>`)}
          ${cl("Valor e pagamento", `<p>Pelo serviço, a CONTRATANTE pagará <b>${real(t.valor)}</b>, por ${esc(t.forma || "PIX ou transferência bancária")}${eu.pix ? ` (${esc(eu.pix)})` : ""}, em até <b>${esc(t.prazo || "30")} dias corridos</b> após a entrega. O atraso gera multa de 2% e juros de 1% ao mês sobre o valor devido.</p>`)}
          ${cl("Uso do conteúdo e da imagem", `<p>A CONTRATANTE pode repostar o conteúdo nos seus próprios perfis e canais, sempre com o crédito da CONTRATADA. ${t.licenca ? `O uso em mídia paga (anúncios e impulsionamento) está autorizado por <b>${t.licenca} ${t.licenca === 1 ? "mês" : "meses"}</b> contados da entrega; depois disso, a renovação precisa ser combinada e paga à parte.` : "O uso em mídia paga (anúncios e impulsionamento) <b>não</b> está incluído e, se desejado, será combinado e pago à parte."} O uso em televisão, mídia impressa ou fora das redes sociais também depende de acordo por escrito.</p>`)}
          ${cl("Exclusividade", `<p>Não há exclusividade: a CONTRATADA pode trabalhar com outras marcas, inclusive do mesmo segmento, salvo acordo diferente por escrito.</p>`)}
          ${cl("Responsabilidades", `<p>A CONTRATANTE responde pelas informações do produto que passar à CONTRATADA. A CONTRATADA não fará promessas sobre o produto além das aprovadas pela CONTRATANTE, e o conteúdo publicado será identificado como publicidade, conforme as regras do CONAR.</p>`)}
          ${cl("Cancelamento", `<p>Se a CONTRATANTE cancelar depois de a produção começar, pagará 50% do valor; depois da entrega, o valor integral.</p>`)}
          ${cl("Foro", `<p>As partes elegem o foro da comarca de ${esc(eu.cidade || "[cidade da contratada]")} para resolver qualquer questão deste contrato.</p>`)}
          <p class="lu-data">${esc(eu.cidade || "[cidade]")}, ${hojeTxt}.</p>
          <div class="lu-assinaturas"><div><span></span>${esc(marca.razao)}<br><small>CONTRATANTE${marca.rep ? " · " + esc(marca.rep) : ""}</small></div><div><span></span>${esc(eu.nome)}<br><small>CONTRATADA</small></div></div>
        </article>
        <p class="lu-aviso-legal">Este é um modelo de referência e não substitui a revisão de um advogado. Você pode clicar no texto e mudar o que quiser antes de imprimir.</p>
      </div>`;
      document.body.appendChild(box); document.body.classList.add("com-contrato");
      const fechar = () => { box.remove(); document.body.classList.remove("com-contrato"); };
      box.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) { if (b.dataset.k === "imprimir") window.print(); else fechar(); } else if (e.target === box) fechar(); });
    }

    /* ---------- registra telas e menu ---------- */
    Object.assign(P.DESENHOS, { marcas: telaMarcas, publis: telaPublis, financeiro: telaFinanceiro, contrato: telaContrato });
    TELAS.forEach(([id, nome]) => { P.NOMES[id] = nome; });
    const desenharMenu = () => {
      const box = document.getElementById("menuExtra"); if (!box) return;
      box.innerHTML = `<div class="menu-grupo">Publis</div><nav class="menu-itens">${TELAS.map(([id, nome]) => `<button class="menu-item" type="button" data-tela="${id}" data-dica="${nome}"><svg class="i" viewBox="0 0 24 24">${ICONES[id]}</svg><span class="rotulo">${nome}</span></button>`).join("")}</nav>`;
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", desenharMenu); else desenharMenu();
  });
})();
