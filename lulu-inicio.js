/* =============================================================
   PARTE EXTRA DA LULU (25/11/2026): Início (dashboard).
   Junta numa tela só: ganhos do mês por fonte, vendas x meta do TikTok,
   o que tem para hoje e o que está pendente. Depende do lulu.js (window.LULU_FIN).
   Fica fora dos arquivos do curso (a atualização do Ryan não mexe aqui).
   ============================================================= */
(function () {
  "use strict";
  window.PAINEL_EXTRAS = window.PAINEL_EXTRAS || [];
  // o painel passa a abrir no Início (o resto do endereço, como o link de senha nova, continua valendo)
  try { if (!location.hash) history.replaceState(null, "", "#inicio"); } catch (_) {}

  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const ICONE = '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>';

  window.PAINEL_EXTRAS.push(function (P) {
    const { esc, real } = P;
    const hoje = () => P.hojeISO();
    const sb = () => window.LULU_TESTE_SB || P.sb();
    const pega = async (tab) => { try { const { data, error } = await sb().from(tab).select("*").order("criado_em", { ascending: false }); if (error) throw error; return data || []; } catch (_) { return []; } };

    async function telaInicio(el) {
      const S = P.S, h = hoje(), mes = h.slice(0, 7), d = new Date(h + "T12:00:00");
      const fin = window.LULU_FIN;
      if (fin && sb()) await fin.carregar();
      const [cal, rots] = sb() ? await Promise.all([pega("calendario"), pega("roteiros")]) : [[], []];
      const Ldados = fin ? fin.dados() : { publis: [] };
      const G = fin ? fin.ganhos("mes") : null;

      // TikTok: vendas do mês contra a meta (mesma conta da aba Hoje)
      const doMes = (S.pedidos || []).filter((x) => x.mes === mes);
      const t = P.somar ? P.somar(doMes) : { g: 0, c: 0, pedidos: 0 };
      const meta = P.metaAtual ? P.metaAtual() : 0;
      const pctMeta = meta ? Math.min(100, Math.round((t.g / meta) * 100)) : 0;
      // vídeos de hoje (aba Vídeos)
      const vids = S.videosHoje || [], feitos = vids.filter((v) => v.status !== "rascunho").length, metaV = +((S.perfil || {}).meta_videos) || vids.length;
      // trabalhos com marca
      const publis = Ldados.publis || [];
      const aReceber = publis.filter((p) => ["fechada", "gravando", "entregue"].includes(p.status));
      const atrasadas = fin ? aReceber.filter(fin.atrasada) : [];
      const entregas7 = publis.filter((p) => p.entrega_em && p.entrega_em >= h && p.entrega_em <= P.somaDias(h, 7) && !["paga", "cancelada", "entregue"].includes(p.status));
      const amostrasAtr = (S.amostras || []).filter((a) => a.decisao === "testando" && a.prazo_postar && a.prazo_postar < h);
      const prontos = rots.filter((r) => r.status === "pronto");
      // agenda de hoje
      const agendaHoje = [
        ...cal.filter((c) => c.data === h).map((c) => ({ hora: c.hora, txt: c.titulo, feito: c.feito, tipo: c.tipo })),
        ...vids.map((v) => ({ hora: v.hora, txt: "TikTok: " + v.produto, feito: v.status === "postado", tipo: "tiktok", st: { rascunho: "a gravar", agendado: "agendado", postado: "postado" }[v.status] })),
        ...publis.filter((p) => p.entrega_em === h && !["paga", "cancelada", "entregue"].includes(p.status)).map((p) => ({ txt: "Entregar publi: " + p.titulo, tipo: "entrega" }))
      ].sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99"));
      const pend = [
        ...atrasadas.map((p) => ({ txt: `Cobrar ${p.titulo}`, det: `${real(p.valor)} · venceu ${P.dataBR(fin.venc(p))}`, tela: "financeiro", ruim: true })),
        ...amostrasAtr.map((a) => ({ txt: `Postar amostra: ${a.produto}`, det: `prazo era ${P.dataBR(a.prazo_postar)}`, tela: "amostras", ruim: true })),
        ...entregas7.map((p) => ({ txt: `Entregar ${p.titulo}`, det: `até ${P.dataBR(p.entrega_em)}`, tela: "publis" })),
        ...(prontos.length ? [{ txt: `${prontos.length} roteiro(s) pronto(s) para gravar`, det: prontos.slice(0, 3).map((r) => r.titulo).join(", "), tela: "roteiros" }] : [])
      ];
      const nome = ((S.perfil || {}).apelido || (S.perfil || {}).nome || "").trim().split(" ")[0];
      const hr = new Date().getHours(), saudacao = hr < 12 ? "Bom dia" : hr < 18 ? "Boa tarde" : "Boa noite";

      el.innerHTML = `<div class="cabeca"><div><h1>${saudacao}${nome ? `, <em>${esc(nome)}</em>` : ""}.</h1><p>${SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}. ${S.ultimo ? `Pedidos do TikTok lidos até ${P.dataBR(S.ultimo)}.` : "Ainda sem pedidos do TikTok importados."}</p></div></div>
        <div class="grade g4 lu-kpis">
          <div class="card kpi escuro"><p class="rot">Ganhos no mês</p><p class="val">${G ? real(G.total) : "-"}</p><small>TikTok, publis, UGC e outros</small></div>
          <div class="card kpi"><p class="rot">Vendas TikTok no mês</p><p class="val">${real(t.g)}</p><small>${meta ? `${pctMeta}% da meta de ${real(meta)}` : `${t.pedidos || 0} pedido(s)`}</small>${meta ? `<div class="lu-meta"><span style="width:${pctMeta}%"></span></div>` : ""}</div>
          <div class="card kpi"><p class="rot">A receber das marcas</p><p class="val${atrasadas.length ? " lu-vermelho" : ""}">${real(aReceber.reduce((a, p) => a + (+p.valor || 0), 0))}</p><small>${atrasadas.length ? `${atrasadas.length} atrasada(s)` : `${aReceber.length} trabalho(s) fechado(s)`}</small></div>
          <div class="card kpi"><p class="rot">Vídeos de hoje</p><p class="val">${feitos} de ${metaV || 0}</p><small>${vids.length ? "agendados ou postados" : "nada lançado na aba Vídeos"}</small></div>
        </div>
        <div class="grade g2">
          ${G ? window.LULU_FIN.cardGanhos(G) : '<div class="card"><p class="vazio">Os ganhos aparecem aqui depois de rodar o banco_lulu.sql.</p></div>'}
          <div class="lu-col">
            <div class="card"><div class="card-topo"><h2>Hoje</h2><span class="sub">${agendaHoje.length} item(ns)</span><span class="espaco"></span><button class="link" type="button" data-tela="calendario">abrir calendário</button></div>
              <ul class="lista-foco">${agendaHoje.map((x) => `<li class="${x.feito ? "lu-feito" : ""}"><span class="nome"><i class="lu-ponto t-${x.tipo}"></i>${x.hora ? `<b>${x.hora.slice(0, 5)}</b> ` : ""}${esc(x.txt)}</span>${x.st ? `<span class="selo">${x.st}</span>` : ""}</li>`).join("") || '<li><span class="nome">Nada marcado para hoje.</span></li>'}</ul></div>
            <div class="card"><div class="card-topo"><h2>Pendências</h2><span class="sub">${pend.length}</span></div>
              <ul class="lista-foco">${pend.map((x) => `<li><span class="nome${x.ruim ? " lu-vermelho" : ""}">${esc(x.txt)}</span><button class="link" type="button" data-tela="${x.tela}">ver</button><small>${esc(x.det || "")}</small></li>`).join("") || '<li><span class="nome">Tudo em dia. 🎉</span></li>'}</ul></div>
          </div>
        </div>
        <div class="card"><div class="card-topo"><h2>Atalhos</h2></div><div class="controles">
          <button class="btn sec pequeno" type="button" data-tela="importar">Subir extrato do TikTok</button>
          <button class="btn sec pequeno" type="button" data-tela="criar">Modelar uma copy</button>
          <button class="btn sec pequeno" type="button" data-tela="roteiros">Roteiros</button>
          <button class="btn sec pequeno" type="button" data-tela="publis">Nova publi</button>
          <button class="btn sec pequeno" type="button" data-tela="financeiro">Financeiro</button>
        </div></div>`;
      el.onclick = null; el.onchange = null;
    }

    P.DESENHOS.inicio = telaInicio;
    P.NOMES.inicio = "Início";
    const desenharMenu = () => {
      const itens = document.getElementById("menuItens"); if (!itens || document.getElementById("menuInicio")) return;
      const grupoTikTok = itens.previousElementSibling;   // o título "TikTok"
      const box = document.createElement("div"); box.id = "menuInicio";
      box.innerHTML = `<nav class="menu-itens"><button class="menu-item" type="button" data-tela="inicio" data-dica="Início"><svg class="i" viewBox="0 0 24 24">${ICONE}</svg><span class="rotulo">Início</span></button></nav>`;
      itens.parentNode.insertBefore(box, grupoTikTok && grupoTikTok.classList.contains("menu-grupo") ? grupoTikTok : itens);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", desenharMenu); else desenharMenu();
  });
})();
