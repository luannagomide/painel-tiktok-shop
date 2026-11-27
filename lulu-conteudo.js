/* =============================================================
   PARTE EXTRA DA LULU (25/11/2026): Conteúdo = Calendário e Roteiros.
   Fica fora dos arquivos do curso (a atualização do Ryan não mexe aqui).
   Banco: public.roteiros e public.calendario (banco_lulu.sql).
   O calendário também mostra, só para ver, as entregas das publis e o prazo das amostras.
   ============================================================= */
(function () {
  "use strict";
  window.PAINEL_EXTRAS = window.PAINEL_EXTRAS || [];

  const TIPOS = { gravar: "Gravar", editar: "Editar", postar: "Postar", live: "Live", outro: "Outro" };
  const PLATAFORMAS = { tiktok: "TikTok", instagram: "Instagram", ambos: "TikTok e Instagram", outro: "Outra" };
  const STATUS_ROT = { ideia: "Ideia", pronto: "Pronto pra gravar", gravado: "Gravado", postado: "Postado" };
  const FORMATOS = ["POV", "Explicativo", "Sem aparecer", "Storytelling", "Demonstração", "Narrado", "Live", "Outro"];
  const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const ICONES = {
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 18h2"/>',
    roteiros: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 15h7M9 19h4"/>'
  };
  const TELAS = [["calendario", "Calendário"], ["roteiros", "Roteiros"]];

  window.PAINEL_EXTRAS.push(function (P) {
    const { esc, toast, irPara } = P;
    const L = { rot: [], cal: [], publis: [], videos: [], refs: [], dentro: false, ok: false, erro: "", mes: null, dia: null, editCal: null, editRot: null, prefill: null, filtro: "", busca: "" };
    const hoje = () => P.hojeISO();
    const pad = (x) => String(x).padStart(2, "0");
    const sb = () => window.LULU_TESTE_SB || P.sb();
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const amigavel = (e) => {
      const t = String((e && (e.message || e.details)) || e || "");
      if (/relation .*(roteiros|calendario).* does not exist|could not find the table|schema cache|column .*(links|transcricoes)/i.test(t)) return "Falta rodar o banco_lulu.sql (a versão com calendário e roteiros) no Supabase: SQL Editor > New query > cole > Run.";
      return P.traduz ? P.traduz(e) : t;
    };
    async function carregar(forcar) {
      if (L.ok && !forcar) return;
      if (!sb()) { L.erro = "No modo demonstração esta parte não funciona."; return; }
      try {
        L.rot = ok(await sb().from("roteiros").select("*").order("criado_em", { ascending: false }));
        L.cal = ok(await sb().from("calendario").select("*").order("data"));
        try { L.publis = ok(await sb().from("publis").select("*").order("criado_em")); } catch (_) { L.publis = []; }
        // do painel do curso: a agenda da aba Vídeos e as copies prontas da aba Criar
        try { L.videos = ok(await sb().from("videos").select("*").order("data")); } catch (_) { L.videos = []; }
        try { L.refs = ok(await sb().from("referencias").select("*").order("criado_em", { ascending: false })).filter((r) => (r.copy || "").trim()); } catch (_) { L.refs = []; }
        try { L.pastas = ok(await sb().from("pastas").select("*").order("criado_em", { ascending: false })); L.prefs = ok(await sb().from("pasta_refs").select("*").order("criado_em")); L.semPastas = false; } catch (_) { L.pastas = []; L.prefs = []; L.semPastas = true; }
        L.ok = true; L.erro = "";
      } catch (e) { L.erro = amigavel(e); }
    }
    const salvar = async (tab, d, id) => (id ? ok(await sb().from(tab).update(d).eq("id", id).select("*").single()) : ok(await sb().from(tab).insert(d).select("*").single()));
    const apagar = async (tab, id) => ok(await sb().from(tab).delete().eq("id", id));
    const trocar = (lista, item) => { const i = lista.findIndex((x) => x.id === item.id); if (i >= 0) lista[i] = item; else lista.unshift(item); };
    const opcoes = (obj, atual) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${atual === k ? " selected" : ""}>${v}</option>`).join("");
    const val = (el, id) => { const i = el.querySelector("#" + id); return i ? i.value.trim() : ""; };
    const cabeca = (t, p, extra = "") => `<div class="cabeca"><div><h1>${t}</h1><p>${p}</p></div>${extra}</div>`;
    const rotDe = (id) => L.rot.find((r) => r.id === id) || null;
    const refDe = (id) => L.refs.find((r) => String(r.id) === String(id)) || null;
    const tituloRef = (r) => r.titulo || r.autor || (r.texto ? r.texto.split(/\s+/).slice(0, 10).join(" ") + "…" : "Copy da aba Criar");
    const STATUS_V = { rascunho: "a gravar", agendado: "agendado", postado: "postado" };
    // abre o roteiro de gravação de um item: da biblioteca (roteiro_id) ou da aba Criar (referencia_id)
    const abrirDoItem = (x) => { const r = x.roteiro_id && rotDe(x.roteiro_id), f = x.referencia_id && refDe(x.referencia_id); if (r && r.texto) P.abrirRoteiro(r.texto, r.produto || r.titulo); else if (f) P.abrirRoteiro(f.copy, tituloRef(f)); else toast("Esse roteiro não tem texto.", true); };
    const hora = (h) => (h ? h.slice(0, 5) : "");
    // Pedido para o Claude com TUDO da pasta: um roteiro por vídeo de referência e um por ideia.
    // Os blocos vêm como "ROTEIRO 1: ...", "ROTEIRO 2: ...": o Ver roteiro de gravação separa cada um numa aba.
    function pedidoMultiplo(pa, refs, ideias) {
      const nomeEtq = (k) => ({ gancho: "gancho", demonstracao: "demonstração", prova: "prova", cta: "CTA", formato: "formato", outro: "outro" }[k] || "");
      const blocos = refs.map((x, i) => {
        const tx = (x.texto || "").trim();
        return [`REFERÊNCIA ${i + 1} · ${rotuloLink(x.link)} · ${x.link}`,
          x.etiqueta ? `O que esse vídeo tem de bom: ${nomeEtq(x.etiqueta)}` : "",
          (x.nota || "").trim() ? `Minha anotação: ${x.nota.trim()}` : "",
          tx ? `O que a pessoa fala no vídeo:\n"""\n${tx}\n"""` : "Ainda sem transcrição. Você não consegue abrir o link: modele pelo que eu anotei. Se a minha anotação não for suficiente, escreva só a linha \"Transcreva esse vídeo no painel e me mande de novo\" no lugar das cenas desse roteiro."
        ].filter(Boolean).join("\n");
      }).join("\n\n");
      const abertas = ideias.filter((i) => !i.feito);
      const nRef = refs.length, nId = abertas.length, total = nRef + nId;
      const qual = pa.tipo === "tema" ? "TEMA" : "PRODUTO";
      return `Use a skill roteiro-tiktok-shop. Quero VÁRIOS roteiros de TikTok Shop a partir da minha pasta de pesquisa: ${nRef ? `um roteiro para CADA vídeo de referência (${nRef})` : ""}${nRef && nId ? " e " : ""}${nId ? `um roteiro para CADA ideia minha (${nId})` : ""}, ${total} roteiros no total. Em cada roteiro baseado numa referência, mantenha a estrutura, a ordem e o ritmo daquele vídeo, mas sem copiar frases.

${qual}: ${pa.nome}${pa.tipo === "tema" ? " (o produto eu escolho depois; deixe [produto] entre colchetes)" : ""}
${(pa.notas || "").trim() ? `\nMINHAS ANOTAÇÕES SOBRE ESSE ${qual}:\n${pa.notas.trim()}\n` : ""}${nRef ? `\nVÍDEOS DE REFERÊNCIA (${nRef}):\n\n${blocos}\n` : ""}${nId ? `\nMINHAS IDEIAS (${nId}):\n${abertas.map((i, k) => `${k + 1}. ${i.texto}`).join("\n")}\n` : ""}
ENTREGUE, em português do Brasil, ${total} blocos seguidos, numerados de 1 a ${total}${nRef ? `: primeiro os ${nRef} das referências, na ordem` : ""}${nId ? `${nRef ? ", depois" : ":"} os ${nId} das ideias, na ordem` : ""}. Cada bloco EXATAMENTE neste formato, sem comentários entre as cenas:

ROTEIRO 1: um nome curto para o roteiro · ${nRef ? "referência 1" : "ideia 1"}
ESTRUTURA DA REFERÊNCIA: as partes (gancho, problema, demonstração, prova, chamada pro carrinho) com os segundos de cada uma (palavras ÷ 3,25 = segundos). Nos roteiros de ideia, escreva a estrutura que você escolheu.
POR QUE PRENDE: 1 frase sobre o gancho.
CENA 1
FALA: o que eu falo, do jeito que eu falo
IMAGEM: o que aparece na tela (enquadramento, produto, demonstração)
TEXTO NA TELA: só se tiver (na cena 1, a headline do gancho)
CENA 2
(e assim por diante)
3 GANCHOS ALTERNATIVOS: um por linha.

Depois do último bloco, uma linha: QUAL GRAVAR PRIMEIRO: qual roteiro tem mais chance de vender e por quê, em 1 frase.

REGRAS: o que eu não informei fica [entre colchetes] para eu ajustar. Não invente preço, desconto nem característica do produto. Nada de promessa de cura, resultado garantido ou urgência que a loja não deu. Sem emoji e sem travessão.`;
    }
    // Pedido para o Claude: modelar um roteiro parecido com as referências deste roteiro.
    // A saída usa o mesmo formato da aba Criar (CENA / FALA / IMAGEM / TEXTO NA TELA), que o Ver roteiro de gravação lê.
    function montarPedido(r, refs) {
      const blocos = refs.map((x, i) => `REFERÊNCIA ${i + 1} (${rotuloLink(x.u)} · ${x.u}):\n"""\n${x.tx}\n"""`).join("\n\n");
      return `Use a skill roteiro-tiktok-shop. Quero um roteiro de TikTok Shop parecido com ${refs.length > 1 ? "estes vídeos de referência" : "este vídeo de referência"}: mantenha a estrutura, a ordem e o ritmo, mas sem copiar frases.

${blocos}

PRODUTO DO MEU VÍDEO: ${r.produto || "[nome do produto]"}
${r.formato ? `FORMATO: ${r.formato}\n` : ""}${r.titulo ? `IDEIA DO ROTEIRO: ${r.titulo}\n` : ""}${r.obs ? `O QUE EU SEI / OBSERVAÇÕES: ${r.obs}\n` : ""}${r.extra ? r.extra + "\n" : ""}
ENTREGUE, em português do Brasil, nesta ordem:
MAPA DA REFERÊNCIA: as partes ${refs.length > 1 ? "que as referências têm em comum" : "do vídeo"} numeradas (gancho, problema, demonstração, prova, chamada pro carrinho), com os segundos de cada uma (palavras ÷ 3,25 = segundos).
POR QUE PRENDE: 1 frase sobre o gancho.
ROTEIRO NOVO: pronto para gravar, dividido em cenas. Use EXATAMENTE este formato, sem comentários entre as cenas:
CENA 1
FALA: o que eu falo, do jeito que eu falo
IMAGEM: o que aparece na tela (enquadramento, produto, demonstração)
TEXTO NA TELA: só se tiver (na cena 1, a headline do gancho)
3 GANCHOS ALTERNATIVOS: um por linha.

REGRAS: o que eu não informei fica [entre colchetes] para eu ajustar. Não invente preço, desconto nem característica do produto. Nada de promessa de cura, resultado garantido ou urgência que a loja não deu. Sem emoji e sem travessão.`;
    }
    // pega todos os endereços de um texto colado (só http/https, sem repetir)
    const linksDoTexto = (txt) => [...new Set(String(txt).split(/[\s,;]+/).map((x) => x.trim().replace(/[)\].,]+$/, "")).filter(Boolean).map((x) => (/^www\./i.test(x) ? "https://" + x : x)).filter((x) => /^https?:\/\/[^\s]+\.[^\s]+/i.test(x)))];
    // "tiktok · @athaisfavero" em vez do endereço inteiro
    const rotuloLink = (u) => { try { const x = new URL(u), h = x.hostname.replace(/^www\.|^m\.|^vm\./, ""), arroba = (x.pathname.match(/@[\w.]+/) || [""])[0], base = h.split(".")[0]; return arroba ? `${base} · ${arroba}` : (h + x.pathname).replace(/\/$/, "").slice(0, 40); } catch (_) { return u.slice(0, 40); } };

    /* ============ CALENDÁRIO ============ */
    // tudo que cai num dia: itens da agenda + (só para ver) entregas de publi e prazo de amostra
    function doDia(iso) {
      const meus = L.cal.filter((c) => c.data === iso).sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99")).map((c) => ({ ...c, origem: "agenda" }));
      const entregas = L.publis.filter((p) => p.entrega_em === iso && !["paga", "cancelada", "entregue"].includes(p.status)).map((p) => ({ id: "p" + p.id, titulo: "Entregar publi: " + p.titulo, tipo: "entrega", origem: "publi" }));
      const amostras = (P.S.amostras || []).filter((a) => a.decisao === "testando" && a.prazo_postar === iso).map((a) => ({ id: "a" + a.id, titulo: "Postar amostra: " + a.produto, tipo: "amostra", origem: "amostra" }));
      const tiktok = L.videos.filter((v) => v.data === iso).map((v) => ({ id: "v" + v.id, vid: v.id, hora: v.hora, titulo: "TikTok: " + v.produto, tipo: "tiktok", origem: "video", status: v.status, feito: v.status === "postado" }));
      return [...meus, ...tiktok, ...entregas, ...amostras].sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99"));
    }
    async function telaCalendario(el) {
      await carregar(!L.dentro); L.dentro = true;
      if (L.erro) { el.innerHTML = cabeca("Calendário", "O que gravar, editar, postar e fazer de live em cada dia.") + `<div class="aviso">${esc(L.erro)}</div>`; return; }
      L.mes = L.mes || hoje().slice(0, 7); L.dia = L.dia || hoje();
      const [a, m] = L.mes.split("-").map(Number), primeiro = new Date(a, m - 1, 1), nDias = new Date(a, m, 0).getDate();
      const celulas = []; for (let k = 0; k < primeiro.getDay(); k++) celulas.push(null); for (let d = 1; d <= nDias; d++) celulas.push(`${L.mes}-${pad(d)}`); while (celulas.length % 7) celulas.push(null);
      const c = L.editCal ? L.cal.find((x) => x.id === L.editCal) || {} : {};
      const pre = L.prefill || {};
      const itensDia = doDia(L.dia);
      const dLongo = (iso) => { const d = new Date(iso + "T12:00:00"); return `${["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
      const semana = (() => { const out = []; for (let k = 0; k < 7; k++) { const iso = P.somaDias(hoje(), k); doDia(iso).filter((x) => !x.feito).forEach((x) => out.push({ ...x, dia: iso })); } return out; })();
      el.innerHTML = cabeca("Calendário", "O que gravar, editar, postar e fazer de live em cada dia. As entregas das publis e o prazo das amostras aparecem sozinhos.") + `
        <div class="grade g21">
          <div class="card"><div class="card-topo lu-cal-topo"><button class="btn sec pequeno" type="button" data-lu="mes" data-n="-1" aria-label="Mês anterior">‹</button><h2>${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} de ${a}</h2><button class="btn sec pequeno" type="button" data-lu="mes" data-n="1" aria-label="Próximo mês">›</button><span class="espaco"></span><button class="link" type="button" data-lu="hoje">hoje</button></div>
            <div class="lu-cal">${DIAS.map((d) => `<div class="lu-cal-sem">${d}</div>`).join("")}
              ${celulas.map((iso) => { if (!iso) return '<div class="lu-cal-dia vazio"></div>'; const it = doDia(iso); return `<button type="button" class="lu-cal-dia${iso === hoje() ? " hoje" : ""}${iso === L.dia ? " sel" : ""}" data-lu="dia" data-d="${iso}" aria-label="${dLongo(iso)}, ${it.length} item(ns)"><span class="lu-cal-n">${+iso.slice(8)}</span>${it.slice(0, 3).map((x) => `<span class="lu-chip t-${x.tipo}${x.feito ? " feito" : ""}">${esc(x.titulo)}</span>`).join("")}${it.length > 3 ? `<span class="lu-mais-itens">+${it.length - 3}</span>` : ""}</button>`; }).join("")}
            </div>
            <div class="lu-legenda">${["gravar", "editar", "postar", "live", "tiktok", "entrega", "amostra"].map((t) => `<span><i class="lu-ponto t-${t}"></i>${{ tiktok: "vídeo da aba Vídeos", entrega: "entrega de publi", amostra: "prazo de amostra" }[t] || TIPOS[t]}</span>`).join("")}</div>
          </div>
          <div class="card"><div class="card-topo"><h2>Próximos 7 dias</h2><span class="sub">o que falta fazer</span></div>
            <ul class="lista-foco">${semana.map((x) => `<li><span class="nome"><i class="lu-ponto t-${x.tipo}"></i>${esc(x.titulo)}</span><span class="val">${P.dataBR(x.dia)}${x.hora ? " " + hora(x.hora) : ""}</span></li>`).join("") || '<li><span class="nome">Nada marcado para os próximos dias.</span></li>'}</ul></div>
        </div>
        <div class="grade g2">
          <div class="card"><div class="card-topo"><h2>${dLongo(L.dia)}</h2><span class="sub">${itensDia.length} item(ns)</span></div>
            <ul class="lista-foco">${itensDia.map((x) => x.origem === "agenda" ? `<li class="${x.feito ? "lu-feito" : ""}"><span class="nome"><label class="lu-check"><input type="checkbox" data-lu="feito" data-id="${x.id}"${x.feito ? " checked" : ""}> <i class="lu-ponto t-${x.tipo}"></i>${x.hora ? `<b>${hora(x.hora)}</b> ` : ""}${esc(x.titulo)}</label></span><span class="lu-acoes">${(x.roteiro_id && rotDe(x.roteiro_id)) || (x.referencia_id && refDe(x.referencia_id)) ? `<button class="link" type="button" data-lu="ver-item" data-id="${x.id}">roteiro</button>` : ""}<button class="link" type="button" data-lu="editar-cal" data-id="${x.id}">editar</button><button class="x" type="button" data-lu="apagar-cal" data-id="${x.id}" aria-label="Apagar">×</button></span><small>${TIPOS[x.tipo]} · ${PLATAFORMAS[x.plataforma]}${x.obs ? " · " + esc(x.obs) : ""}</small></li>`
              : x.origem === "video" ? `<li class="${x.feito ? "lu-feito" : ""}"><span class="nome"><i class="lu-ponto t-tiktok"></i>${x.hora ? `<b>${hora(x.hora)}</b> ` : ""}${esc(x.titulo)}</span><span class="lu-acoes"><button class="chip lu-st" type="button" data-lu="status-video" data-id="${x.vid}" title="Mudar status">${STATUS_V[x.status] || x.status}</button></span><small>vem da aba Vídeos · toque no status para mudar (a gravar, agendado, postado)</small></li>`
              : `<li><span class="nome"><i class="lu-ponto t-${x.tipo}"></i>${esc(x.titulo)}</span><small>vem de ${x.origem === "publi" ? "Publis" : "Amostras"}</small></li>`).join("") || '<li><span class="nome">Nada neste dia. Use o formulário ao lado.</span></li>'}</ul></div>
          <div class="card"><div class="card-topo"><h2>${L.editCal ? "Editar item" : "Adicionar na agenda"}</h2>${L.editCal || L.prefill ? '<span class="espaco"></span><button class="link" type="button" data-lu="cancelar-cal">cancelar</button>' : ""}</div>
            <form class="lu-form" id="luFormCal">
              <div class="lu-grade lu-grade-2">
                <div><label class="lbl" for="cTitulo">O quê *</label><input class="inp" id="cTitulo" required maxlength="160" value="${esc(c.titulo || pre.titulo || "")}" placeholder="Ex.: gravar 3 vídeos da creatina"></div>
                <div><label class="lbl" for="cData">Dia *</label><input class="inp" id="cData" type="date" required value="${esc(c.data || L.dia)}"></div>
                <div><label class="lbl" for="cHora">Hora</label><input class="inp" id="cHora" type="time" value="${esc(hora(c.hora))}"></div>
                <div><label class="lbl" for="cTipo">Tipo</label><select class="inp" id="cTipo">${opcoes(TIPOS, c.tipo || pre.tipo || "postar")}</select></div>
                <div><label class="lbl" for="cPlat">Onde</label><select class="inp" id="cPlat">${opcoes(PLATAFORMAS, c.plataforma || "tiktok")}</select></div>
                <div><label class="lbl" for="cRot">Roteiro</label><select class="inp" id="cRot"><option value="">(nenhum)</option>${L.rot.length ? `<optgroup label="Biblioteca de roteiros">${L.rot.map((r) => `<option value="r:${r.id}"${(c.roteiro_id || pre.roteiro_id) === r.id ? " selected" : ""}>${esc(r.titulo)}</option>`).join("")}</optgroup>` : ""}${L.refs.length ? `<optgroup label="Copies da aba Criar">${L.refs.map((f) => `<option value="f:${esc(f.id)}"${String(c.referencia_id || pre.referencia_id || "") === String(f.id) ? " selected" : ""}>${esc(tituloRef(f).slice(0, 70))}</option>`).join("")}</optgroup>` : ""}</select></div>
              </div>
              <div><label class="lbl" for="cObs">Anotação</label><input class="inp" id="cObs" maxlength="1000" value="${esc(c.obs || "")}"></div>
              <div class="controles"><button class="btn pequeno" type="submit">${L.editCal ? "Salvar" : "Adicionar"}</button></div>
            </form></div>
        </div>`;

      el.querySelector("#luFormCal").addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = { titulo: val(el, "cTitulo"), data: val(el, "cData"), hora: val(el, "cHora") || null, tipo: val(el, "cTipo"), plataforma: val(el, "cPlat"), roteiro_id: null, referencia_id: null, obs: val(el, "cObs") || null };
        const qual = val(el, "cRot"); if (qual.startsWith("r:")) d.roteiro_id = +qual.slice(2); else if (qual.startsWith("f:")) d.referencia_id = qual.slice(2);
        if (!d.titulo || !d.data) return;
        try { trocar(L.cal, await salvar("calendario", d, L.editCal)); toast(L.editCal ? "Salvo." : "Adicionado na agenda."); L.editCal = null; L.prefill = null; L.dia = d.data; L.mes = d.data.slice(0, 7); telaCalendario(el); }
        catch (er) { toast(amigavel(er), true); }
      });
      el.onchange = async (e) => {
        const t = e.target.closest("[data-lu='feito']"); if (!t) return;
        try { trocar(L.cal, await salvar("calendario", { feito: t.checked }, +t.dataset.id)); telaCalendario(el); } catch (er) { toast(amigavel(er), true); }
      };
      el.onclick = async (e) => {
        const t = e.target.closest("[data-lu]"); if (!t || t.dataset.lu === "feito") return; const a = t.dataset.lu, id = +t.dataset.id;
        if (a === "mes") { const [y, mm] = L.mes.split("-").map(Number), d = new Date(y, mm - 1 + +t.dataset.n, 1); L.mes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; telaCalendario(el); }
        else if (a === "hoje") { L.mes = hoje().slice(0, 7); L.dia = hoje(); telaCalendario(el); }
        else if (a === "dia") { L.dia = t.dataset.d; telaCalendario(el); }
        else if (a === "editar-cal") { L.editCal = id; const x = L.cal.find((y) => y.id === id); if (x) L.dia = x.data; telaCalendario(el); }
        else if (a === "cancelar-cal") { L.editCal = null; L.prefill = null; telaCalendario(el); }
        else if (a === "ver-item") { const x = L.cal.find((y) => y.id === id); if (x) abrirDoItem(x); }
        else if (a === "status-video") {
          const v = L.videos.find((y) => y.id === id); if (!v) return; const prox = { rascunho: "agendado", agendado: "postado", postado: "rascunho" }[v.status] || "rascunho";
          try { ok(await sb().from("videos").update({ status: prox }).eq("id", id)); v.status = prox; telaCalendario(el); } catch (er) { toast(amigavel(er), true); }
        }
        else if (a === "apagar-cal") { const x = L.cal.find((y) => y.id === id); if (!x || !confirm(`Tirar "${x.titulo}" da agenda?`)) return; try { await apagar("calendario", id); L.cal = L.cal.filter((y) => y.id !== id); telaCalendario(el); } catch (er) { toast(amigavel(er), true); } }
      };
    }

    /* ============ ROTEIROS ============ */
    async function telaRoteiros(el) {
      await carregar(!L.dentro); L.dentro = true;
      if (L.erro) { el.innerHTML = cabeca("Roteiros", "A sua biblioteca de roteiros.") + `<div class="aviso">${esc(L.erro)}</div>`; return; }
      const r = L.editRot ? rotDe(L.editRot) || {} : (L.prefillRot || {});
      if (L.linksDe !== (L.editRot || (L.prefillRot ? "p" + (L.prefillRot.pasta_id || "") : 0))) { L.linksRasc = Array.isArray(r.links) ? [...r.links] : []; L.transRasc = { ...(r.transcricoes || {}) }; L.linksDe = L.editRot || (L.prefillRot ? "p" + (L.prefillRot.pasta_id || "") : 0); }
      const b = L.busca.toLowerCase();
      const lista = L.rot.filter((x) => (!L.filtro || x.status === L.filtro) && (!b || `${x.titulo} ${x.produto || ""} ${x.texto || ""} ${(x.links || []).join(" ")}`.toLowerCase().includes(b)));
      const cont = (s) => L.rot.filter((x) => x.status === s).length;
      const gancho = (t) => { const l = String(t || "").replace(/\*\*/g, "").split("\n").map((x) => x.trim()).find((x) => /^FALA\s*:/i.test(x)); return (l ? l.replace(/^FALA\s*:\s*/i, "") : String(t || "").trim().split("\n")[0] || "").slice(0, 170); };
      el.innerHTML = cabeca("Roteiros", "A sua biblioteca de roteiros. Cole a resposta do Claude inteira: o botão Ver roteiro de gravação separa fala, cena e texto na tela, igual na aba Criar.") + `
        <div class="card"><div class="card-topo"><h2>${L.editRot ? "Editar roteiro" : L.prefillRot ? "Novo roteiro da pasta " + esc(L.prefillRot.nomePasta || "") : "Novo roteiro"}</h2>${L.editRot || L.prefillRot ? '<span class="espaco"></span><button class="link" type="button" data-lu="cancelar-rot">cancelar edição</button>' : ""}</div>
          <form class="lu-form" id="luFormRot">
            <div class="lu-grade">
              <div><label class="lbl" for="rTitulo">Nome do roteiro *</label><input class="inp" id="rTitulo" required maxlength="160" value="${esc(r.titulo || "")}" placeholder="Ex.: creatina, gancho da areia"></div>
              <div><label class="lbl" for="rProd">Produto</label><input class="inp" id="rProd" maxlength="200" value="${esc(r.produto || "")}"></div>
              <div><label class="lbl" for="rFormato">Formato</label><select class="inp" id="rFormato"><option value="">(escolher)</option>${FORMATOS.map((f) => `<option${r.formato === f ? " selected" : ""}>${f}</option>`).join("")}</select></div>
              <div><label class="lbl" for="rStatus">Situação</label><select class="inp" id="rStatus">${opcoes(STATUS_ROT, r.status || "ideia")}</select></div>
            </div>
            <div><label class="lbl" for="rTexto">Roteiro (cole aqui)</label><textarea class="inp" id="rTexto" rows="9" maxlength="20000" placeholder="CENA 1&#10;FALA: ...&#10;IMAGEM: ...&#10;TEXTO NA TELA: ...">${esc(r.texto || "")}</textarea></div>
            <div><label class="lbl" for="rLink">Links de referência</label>
              <div class="lu-link-add"><textarea class="inp" id="rLink" rows="2" placeholder="Cole um ou vários links (TikTok, Instagram, YouTube…), um por linha"></textarea><button class="btn sec pequeno" type="button" data-lu="add-link">Adicionar</button></div>
              <ul class="lu-links" id="rLinks"></ul></div>
            <div><label class="lbl" for="rObs">Anotações</label><input class="inp" id="rObs" maxlength="2000" value="${esc(r.obs || "")}"></div>
            <div class="controles"><button class="btn pequeno" type="submit">${L.editRot ? "Salvar roteiro" : "Guardar roteiro"}</button><button class="btn sec pequeno" type="button" data-lu="previa">Ver roteiro de gravação</button><button class="btn sec pequeno" type="button" data-lu="copiar-pedido">Copiar o pedido para o Claude</button></div>
            <p class="frase" style="margin-top:0">Para um roteiro parecido com as referências: transcreva os links, clique em <b>Copiar o pedido para o Claude</b>, cole na conversa com o Claude e traga a resposta para a caixa <b>Roteiro</b>.</p>
          </form></div>
        <div class="card"><div class="card-topo"><h2>Biblioteca</h2><span class="sub">${L.rot.length} roteiro(s)</span><span class="espaco"></span><input class="inp lu-busca" id="rBusca" type="search" placeholder="buscar" value="${esc(L.busca)}" aria-label="Buscar roteiro"></div>
          <div class="chips" style="margin-bottom:12px"><button class="chip" type="button" data-lu="filtro" data-v="" aria-pressed="${!L.filtro}">Todos</button>${Object.entries(STATUS_ROT).map(([k, v]) => `<button class="chip" type="button" data-lu="filtro" data-v="${k}" aria-pressed="${L.filtro === k}">${v} (${cont(k)})</button>`).join("")}</div>
          <div class="lu-rot-lista">${lista.map((x) => `<div class="lu-rot">
              <div class="lu-rot-topo"><b>${esc(x.titulo)}</b><select class="inp" data-lu="status-rot" data-id="${x.id}" aria-label="Situação">${opcoes(STATUS_ROT, x.status)}</select></div>
              <small class="lu-cinza">${[x.produto, x.formato, P.dataBR((x.criado_em || "").slice(0, 10))].filter(Boolean).map(esc).join(" · ")}</small>
              ${x.texto ? `<p class="lu-rot-gancho">${esc(gancho(x.texto))}</p>` : '<p class="lu-rot-gancho lu-cinza">sem texto ainda</p>'}
              ${(x.links || []).length ? `<div class="lu-rot-links"><span class="lu-cinza">${x.links.length} referência(s):</span> ${x.links.slice(0, 4).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(rotuloLink(u))}</a>`).join("")}${x.links.length > 4 ? `<span class="lu-cinza">+${x.links.length - 4}</span>` : ""}</div>` : ""}
              <div class="controles">${x.texto ? `<button class="btn sec pequeno" type="button" data-lu="ver-rot" data-id="${x.id}">Ver roteiro de gravação</button>` : ""}<button class="link" type="button" data-lu="agendar" data-id="${x.id}">agendar gravação</button><button class="link" type="button" data-lu="editar-rot" data-id="${x.id}">editar</button><button class="x" type="button" data-lu="apagar-rot" data-id="${x.id}" aria-label="Apagar">×</button></div>
            </div>`).join("") || '<p class="vazio">Nenhum roteiro aqui ainda.</p>'}</div></div>
        <div class="card"><div class="card-topo"><h2>Copies da aba Criar</h2><span class="sub">${L.refs.length} copy(s) pronta(s) · continuam guardadas lá; aqui é para ver e agendar</span><span class="espaco"></span><button class="link" type="button" data-tela="criar">abrir Criar</button></div>
          <div class="lu-rot-lista">${L.refs.filter((f) => !b || `${tituloRef(f)} ${f.copy}`.toLowerCase().includes(b)).map((f) => `<div class="lu-rot">
              <div class="lu-rot-topo"><b>${esc(tituloRef(f))}</b>${L.cal.some((c) => String(c.referencia_id) === String(f.id)) ? '<span class="selo sobe">na agenda</span>' : ""}</div>
              <small class="lu-cinza">${[f.autor, P.dataBR((f.criado_em || "").slice(0, 10))].filter(Boolean).map(esc).join(" · ")}</small>
              <p class="lu-rot-gancho">${esc(gancho(f.copy))}</p>
              <div class="controles"><button class="btn sec pequeno" type="button" data-lu="ver-ref" data-ref="${esc(f.id)}">Ver roteiro de gravação</button><button class="link" type="button" data-lu="agendar-ref" data-ref="${esc(f.id)}">agendar gravação</button></div>
            </div>`).join("") || '<p class="vazio">Nenhuma copy pronta na aba Criar.</p>'}</div></div>`;

      el.querySelector("#luFormRot").addEventListener("submit", async (e) => {
        e.preventDefault();
        adicionarLinks();
        const d = { titulo: val(el, "rTitulo"), produto: val(el, "rProd") || null, formato: val(el, "rFormato") || null, status: val(el, "rStatus"), texto: el.querySelector("#rTexto").value || null, obs: val(el, "rObs") || null, pasta_id: r.pasta_id || null, links: L.linksRasc.slice(0, 50), transcricoes: Object.fromEntries(L.linksRasc.slice(0, 50).filter((u) => (L.transRasc[u] || "").trim()).map((u) => [u, String(L.transRasc[u]).slice(0, 8000)])) };
        if (!d.titulo) return;
        try { trocar(L.rot, await salvar("roteiros", d, L.editRot)); toast(L.editRot ? "Roteiro salvo." : "Roteiro guardado."); L.editRot = null; L.prefillRot = null; L.linksDe = null; telaRoteiros(el); }
        catch (er) { toast(amigavel(er), true); }
      });
      function desenharLinks() {
        const ul = el.querySelector("#rLinks"); if (!ul) return;
        ul.innerHTML = L.linksRasc.map((u, i) => { const tx = L.transRasc[u] || ""; return `<li class="lu-link-item"><div class="lu-link-linha"><a href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(u)}">${esc(rotuloLink(u))}</a>
          <button class="link" type="button" data-lu="transcrever" data-i="${i}">${tx ? "transcrever de novo" : "Transcrever"}</button><button class="x" type="button" data-lu="tira-link" data-i="${i}" aria-label="Tirar este link">×</button></div>
          <details${tx ? "" : ""}><summary>${tx ? `texto do vídeo (${(tx.match(/\S+/g) || []).length} palavras)` : "sem texto ainda · cole aqui se preferir"}</summary><textarea class="inp" rows="4" data-lu-texto="${i}" placeholder="O que a pessoa fala no vídeo">${esc(tx)}</textarea></details></li>`; }).join("");
        ul.querySelectorAll("[data-lu-texto]").forEach((ta) => ta.addEventListener("input", () => { const u = L.linksRasc[+ta.dataset.luTexto]; if (u) L.transRasc[u] = ta.value; }));
      }
      function adicionarLinks() {
        const ta = el.querySelector("#rLink"); if (!ta || !ta.value.trim()) return 0;
        const novos = linksDoTexto(ta.value).filter((u) => !L.linksRasc.includes(u));
        L.linksRasc.push(...novos); ta.value = ""; desenharLinks();
        return novos.length;
      }
      desenharLinks();
      el.querySelector("#rLink").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!adicionarLinks()) toast("Não achei link nesse texto.", true); } });
      const busca = el.querySelector("#rBusca");
      busca.addEventListener("input", () => { L.busca = busca.value; clearTimeout(busca.t); busca.t = setTimeout(() => { telaRoteiros(el).then(() => { const b2 = el.querySelector("#rBusca"); if (b2) { b2.focus(); b2.setSelectionRange(b2.value.length, b2.value.length); } }); }, 250); });
      el.onchange = async (e) => {
        const t = e.target.closest("[data-lu='status-rot']"); if (!t) return;
        try { trocar(L.rot, await salvar("roteiros", { status: t.value }, +t.dataset.id)); toast("Situação atualizada."); } catch (er) { toast(amigavel(er), true); }
      };
      el.onclick = async (e) => {
        const t = e.target.closest("[data-lu]"); if (!t || t.tagName === "SELECT") return; const a = t.dataset.lu, id = +t.dataset.id;
        if (a === "filtro") { L.filtro = t.dataset.v; telaRoteiros(el); }
        else if (a === "add-link") { const q = adicionarLinks(); toast(q ? `${q} link(s) adicionado(s).` : "Não achei link novo nesse texto.", !q); }
        else if (a === "tira-link") { const u = L.linksRasc[+t.dataset.i]; L.linksRasc.splice(+t.dataset.i, 1); if (u) delete L.transRasc[u]; desenharLinks(); }
        else if (a === "transcrever") {
          const u = L.linksRasc[+t.dataset.i]; if (!u) return;
          if (!P.transcrever) { toast("A transcrição não está ligada neste painel.", true); return; }
          t.disabled = true; toast("Ouvindo o vídeo. Leva até 3 minutos, pode deixar a aba aberta.");
          const res = await P.transcrever(u, (seg) => { const b2 = el.querySelector(`[data-lu="transcrever"][data-i="${t.dataset.i}"]`); if (b2) b2.textContent = `Ouvindo... ${seg}s`; });
          if (res && res.texto) { L.transRasc[u] = res.texto; desenharLinks(); toast("Texto chegou. Lembre de salvar o roteiro."); }
          else { t.disabled = false; desenharLinks(); toast((res && res.erro) || "Não deu para transcrever.", true); }
        }
        else if (a === "copiar-pedido") {
          adicionarLinks();
          const refs = L.linksRasc.map((u) => ({ u, tx: (L.transRasc[u] || "").trim() })).filter((x) => x.tx);
          if (!refs.length) { toast("Transcreva pelo menos um link (ou cole o texto dele) antes.", true); return; }
          const pedido = montarPedido({ titulo: val(el, "rTitulo"), produto: val(el, "rProd"), formato: val(el, "rFormato"), obs: val(el, "rObs") }, refs);
          try { await navigator.clipboard.writeText(pedido); toast("Pedido copiado. Cole na conversa com o Claude."); }
          catch (_) { const ta2 = document.createElement("textarea"); ta2.value = pedido; document.body.appendChild(ta2); ta2.select(); try { document.execCommand("copy"); toast("Pedido copiado. Cole na conversa com o Claude."); } catch (__) { toast("Não consegui copiar sozinho.", true); } ta2.remove(); }
        }
        else if (a === "previa") { const tx = el.querySelector("#rTexto").value; if (!tx.trim()) { toast("Cole o roteiro primeiro.", true); return; } P.abrirRoteiro(tx, val(el, "rProd") || val(el, "rTitulo")); }
        else if (a === "ver-rot") { const x = rotDe(id); if (x) P.abrirRoteiro(x.texto || "", x.produto || x.titulo); }
        else if (a === "editar-rot") { L.editRot = id; telaRoteiros(el); window.scrollTo(0, 0); }
        else if (a === "cancelar-rot") { L.editRot = null; L.prefillRot = null; L.linksDe = null; telaRoteiros(el); }
        else if (a === "ver-ref") { const f = refDe(t.dataset.ref); if (f) P.abrirRoteiro(f.copy, tituloRef(f)); }
        else if (a === "agendar-ref") { const f = refDe(t.dataset.ref); L.prefill = { referencia_id: t.dataset.ref, titulo: "Gravar: " + (f ? tituloRef(f).slice(0, 120) : "copy"), tipo: "gravar" }; L.editCal = null; irPara("calendario"); }
        else if (a === "agendar") { const x = rotDe(id); L.prefill = { roteiro_id: id, titulo: "Gravar: " + (x ? x.titulo : ""), tipo: "gravar" }; L.editCal = null; irPara("calendario"); }
        else if (a === "apagar-rot") { const x = rotDe(id); if (!x || !confirm(`Apagar o roteiro "${x.titulo}"? Não dá para desfazer.`)) return; try { await apagar("roteiros", id); L.rot = L.rot.filter((y) => y.id !== id); L.cal.forEach((c) => { if (c.roteiro_id === id) c.roteiro_id = null; }); toast("Roteiro apagado."); telaRoteiros(el); } catch (er) { toast(amigavel(er), true); } }
      };
    }

    /* ============ REFERÊNCIAS (pastas por produto ou tema) ============ */
    const STATUS_PASTA = { pesquisando: "Pesquisando", vou_gravar: "Vou gravar", gravado: "Gravado", pausado: "Pausado" };
    const ETIQUETAS = { "": "o que ele tem de bom?", gancho: "Gancho", demonstracao: "Demonstração", prova: "Prova", cta: "CTA", formato: "Formato", outro: "Outro" };
    const pastaDe = (id) => L.pastas.find((x) => x.id === id) || null;
    const refsDa = (id) => L.prefs.filter((x) => x.pasta_id === id);
    const roteirosDa = (pa) => L.rot.filter((r) => r.pasta_id === pa.id || (!r.pasta_id && pa.tipo === "produto" && r.produto && r.produto.trim().toLowerCase() === pa.nome.trim().toLowerCase()));
    const novaIdeiaId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    // atalhos: amostras e produtos que vendem e ainda não têm pasta
    function sugestoesPasta() {
      const ja = new Set(L.pastas.map((x) => x.nome.trim().toLowerCase()));
      const am = (P.S.amostras || []).filter((a) => a.decisao !== "pausar").map((a) => a.produto);
      const vend = {}; (P.S.pedidos || []).filter((x) => x.dia >= P.somaDias(hoje(), -30)).forEach((x) => { vend[x.nome] = (vend[x.nome] || 0) + (x.c || 0); });
      const top = Object.entries(vend).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
      return [...new Set([...am, ...top])].filter((n) => n && !ja.has(n.trim().toLowerCase())).slice(0, 10);
    }
    async function telaReferencias(el) {
      await carregar(!L.dentro); L.dentro = true;
      if (L.erro) { el.innerHTML = cabeca("Referências", "Pastas de pesquisa por produto ou tema.") + `<div class="aviso">${esc(L.erro)}</div>`; return; }
      if (L.semPastas) { el.innerHTML = cabeca("Referências", "Pastas de pesquisa por produto ou tema.") + '<div class="aviso">Falta rodar o banco_lulu.sql atualizado no Supabase (SQL Editor > New query > cole > Run).</div>'; return; }
      if (L.pastaAberta && pastaDe(L.pastaAberta)) return telaPasta(el, pastaDe(L.pastaAberta));
      L.pastaAberta = null;
      const sug = sugestoesPasta();
      el.innerHTML = cabeca("Referências", "Uma pasta por produto (que você tem ou não) ou por tema, como \"maquiagem em geral\". Dentro: os vídeos de referência, o texto deles e as suas ideias.") + `
        <div class="card"><div class="card-topo"><h2>Nova pasta</h2></div>
          <form class="form-linha" id="luFormPasta">
            <div><label class="lbl" for="pNome">Nome do produto ou tema *</label><input class="inp" id="pNome" required maxlength="160" placeholder="Ex.: sérum Lisinha, maquiagem em geral"></div>
            <div class="curto" style="flex-basis:170px"><label class="lbl" for="pTipoP">É um</label><select class="inp" id="pTipoP"><option value="produto">Produto</option><option value="tema">Tema</option></select></div>
            <button class="btn pequeno" type="submit">Criar pasta</button>
          </form>
          ${sug.length ? `<p class="lbl" style="margin:14px 0 6px">Atalho: suas amostras e produtos que vendem</p><div class="chips">${sug.map((n) => `<button class="chip" type="button" data-lu="sug-pasta" data-n="${esc(n)}">+ ${esc(n.length > 42 ? n.slice(0, 42) + "…" : n)}</button>`).join("")}</div>` : ""}</div>
        <div class="lu-pastas">${L.pastas.map((pa) => { const nr = refsDa(pa.id).length, ni = (pa.ideias || []).filter((i) => !i.feito).length, nro = roteirosDa(pa).length; return `<button type="button" class="card lu-pasta" data-lu="abrir-pasta" data-id="${pa.id}">
            <span class="lu-pasta-topo"><b>${esc(pa.nome)}</b><span class="selo">${pa.tipo === "tema" ? "tema" : "produto"}</span></span>
            <span class="lu-cinza">${STATUS_PASTA[pa.status] || pa.status}</span>
            <span class="lu-pasta-num"><span><b>${nr}</b> referência(s)</span><span><b>${ni}</b> ideia(s)</span><span><b>${nro}</b> roteiro(s)</span></span></button>`; }).join("") || '<p class="vazio">Nenhuma pasta ainda. Crie a primeira aqui em cima.</p>'}</div>`;
      const criar = async (nome, tipo) => {
        try { const pa = await salvar("pastas", { nome: nome.slice(0, 160), tipo }); L.pastas.unshift(pa); L.pastaAberta = pa.id; toast("Pasta criada."); telaReferencias(el); } catch (er) { toast(amigavel(er), true); }
      };
      el.querySelector("#luFormPasta").addEventListener("submit", (e) => { e.preventDefault(); const n = val(el, "pNome"); if (n) criar(n, val(el, "pTipoP")); });
      el.onchange = null;
      el.onclick = (e) => {
        const t = e.target.closest("[data-lu]"); if (!t) return;
        if (t.dataset.lu === "abrir-pasta") { L.pastaAberta = +t.dataset.id; L.rotPastaEdit = null; telaReferencias(el); window.scrollTo(0, 0); }
        else if (t.dataset.lu === "sug-pasta") criar(t.dataset.n, "produto");
      };
    }
    function telaPasta(el, pa) {
      const refs = refsDa(pa.id), ideias = pa.ideias || [], rots = roteirosDa(pa);
      const agenda = L.cal.filter((c) => c.roteiro_id && rots.some((r) => r.id === c.roteiro_id) && c.data >= hoje());
      el.innerHTML = `<div class="cabeca"><div><button class="link" type="button" data-lu="voltar">‹ todas as pastas</button><h1>${esc(pa.nome)}</h1><p>${pa.tipo === "tema" ? "Tema" : "Produto"} · ${refs.length} referência(s) · ${ideias.filter((i) => !i.feito).length} ideia(s) em aberto</p></div>
          <div class="controles"><button class="btn pequeno" type="button" data-lu="pedido-pasta">Copiar o pedido para o Claude</button><button class="btn sec pequeno" type="button" data-lu="roteiro-pasta">Criar roteiro</button></div></div>
        <div class="card"><div class="lu-grade">
          <div><label class="lbl" for="paNome">Nome</label><input class="inp" id="paNome" data-campo="nome" maxlength="160" value="${esc(pa.nome)}"></div>
          <div><label class="lbl" for="paTipo">É um</label><select class="inp" id="paTipo" data-campo="tipo"><option value="produto"${pa.tipo === "produto" ? " selected" : ""}>Produto</option><option value="tema"${pa.tipo === "tema" ? " selected" : ""}>Tema</option></select></div>
          <div><label class="lbl" for="paStatus">Situação</label><select class="inp" id="paStatus" data-campo="status">${opcoes(STATUS_PASTA, pa.status)}</select></div>
          ${pa.tipo === "produto" ? `<div><label class="lbl" for="paLink">Link do produto no TikTok Shop</label><input class="inp" id="paLink" data-campo="link_produto" maxlength="400" value="${esc(pa.link_produto || "")}" placeholder="https://"></div>
          <div><label class="lbl" for="paCom">Comissão (%)</label><input class="inp" id="paCom" data-campo="comissao" type="number" min="0" max="100" step="0.5" value="${pa.comissao ?? ""}"></div>` : ""}
        </div>${pa.link_produto && /^https?:\/\//i.test(pa.link_produto) ? `<p class="frase"><a href="${esc(pa.link_produto)}" target="_blank" rel="noopener noreferrer">abrir o produto</a></p>` : ""}</div>
        <div class="grade g2">
          <div class="card"><div class="card-topo"><h2>Vídeos de referência</h2><span class="sub">${refs.length}</span></div>
            <div class="lu-link-add"><textarea class="inp" id="paLinks" rows="2" placeholder="Cole um ou vários links, um por linha"></textarea><button class="btn sec pequeno" type="button" data-lu="add-ref">Adicionar</button></div>
            <ul class="lu-refs">${refs.map((x) => `<li class="lu-ref">
              <div class="lu-link-linha"><a href="${esc(x.link)}" target="_blank" rel="noopener noreferrer" title="${esc(x.link)}">${esc(rotuloLink(x.link))}</a>
                <select class="inp lu-etq" data-ref-campo="etiqueta" data-id="${x.id}" aria-label="O que ele tem de bom">${Object.entries(ETIQUETAS).map(([k, v]) => `<option value="${k}"${(x.etiqueta || "") === k ? " selected" : ""}>${v}</option>`).join("")}</select>
                <button class="link" type="button" data-lu="transcrever-ref" data-id="${x.id}">${x.texto ? "transcrever de novo" : "Transcrever"}</button><button class="x" type="button" data-lu="apagar-ref" data-id="${x.id}" aria-label="Tirar">×</button></div>
              <textarea class="inp lu-nota" data-ref-campo="nota" data-id="${x.id}" maxlength="1000" rows="3" placeholder="sua anotação: o que te chamou atenção nesse vídeo">${esc(x.nota || "")}</textarea>
              <details><summary>${x.texto ? `texto do vídeo (${(x.texto.match(/\S+/g) || []).length} palavras)` : "sem texto ainda · cole aqui se preferir"}</summary><textarea class="inp" rows="4" data-ref-campo="texto" data-id="${x.id}" maxlength="8000">${esc(x.texto || "")}</textarea></details>
            </li>`).join("") || '<li class="vazio">Nenhum vídeo ainda. Cole os links aqui em cima.</li>'}</ul></div>
          <div class="lu-col">
            <div class="card"><div class="card-topo"><h2>Minhas ideias</h2></div>
              <form class="lu-link-add" id="luFormIdeia"><input class="inp" id="paIdeia" maxlength="300" placeholder="Uma ideia de gancho, ângulo ou cena"><button class="btn sec pequeno" type="submit">Anotar</button></form>
              <ul class="lista-foco" style="margin-top:10px">${ideias.map((i) => `<li class="${i.feito ? "lu-feito" : ""}"><span class="nome"><label class="lu-check"><input type="checkbox" data-lu="ideia-feita" data-i="${esc(i.id)}"${i.feito ? " checked" : ""}> ${esc(i.texto)}</label></span><span class="lu-acoes"><button class="link" type="button" data-lu="ideia-roteiro" data-i="${esc(i.id)}">virar roteiro</button><button class="x" type="button" data-lu="ideia-apagar" data-i="${esc(i.id)}" aria-label="Apagar">×</button></span></li>`).join("") || '<li><span class="nome lu-cinza">Nenhuma ideia anotada.</span></li>'}</ul>
              <label class="lbl" for="paNotas" style="margin-top:14px">Anotações livres</label><textarea class="inp" id="paNotas" data-campo="notas" rows="6" maxlength="10000" placeholder="Tudo o que você pensar sobre esse produto ou tema">${esc(pa.notas || "")}</textarea>
              <p class="frase" style="margin-top:6px">Salva sozinho quando você sai do campo.</p></div>
            <div class="card"><div class="card-topo"><h2>O que já saiu daqui</h2></div>
              <ul class="lista-foco">${rots.map((r) => `<li><span class="nome">${esc(r.titulo)}</span><span class="selo">${STATUS_ROT[r.status] || r.status}</span><small>${r.texto ? `<button class="link" type="button" data-lu="ver-rot-pasta" data-id="${r.id}">ver roteiro de gravação</button> · ` : ""}<button class="link" type="button" data-lu="editar-rot-pasta" data-id="${r.id}">editar aqui</button></small></li>`).join("") || '<li><span class="nome lu-cinza">Nenhum roteiro ainda.</span></li>'}
              ${agenda.map((c) => `<li><span class="nome"><i class="lu-ponto t-${c.tipo}"></i>${esc(c.titulo)}</span><span class="val">${P.dataBR(c.data)}</span></li>`).join("")}</ul>
              <button class="link" type="button" data-lu="apagar-pasta" style="margin-top:12px">apagar esta pasta</button></div>
          </div>
        </div>
        ${(() => { const er = L.rotPastaEdit ? rotDe(L.rotPastaEdit) : null; return `<div class="card" id="luEscrever"><div class="card-topo"><h2>${er ? "Editar roteiro" : "Escrever um roteiro aqui"}</h2><span class="sub">fica salvo também na aba Roteiros</span>${er ? '<span class="espaco"></span><button class="link" type="button" data-lu="cancelar-rot-pasta">cancelar edição</button>' : ""}</div>
          <form class="lu-form" id="luFormRotPasta">
            <div class="lu-grade">
              <div><label class="lbl" for="rpTitulo">Nome do roteiro *</label><input class="inp" id="rpTitulo" required maxlength="160" value="${esc(er ? er.titulo : "")}" placeholder="Ex.: gancho da pele oleosa"></div>
              <div><label class="lbl" for="rpFormato">Formato</label><select class="inp" id="rpFormato"><option value="">(escolher)</option>${FORMATOS.map((f) => `<option${er && er.formato === f ? " selected" : ""}>${f}</option>`).join("")}</select></div>
              <div><label class="lbl" for="rpStatus">Situação</label><select class="inp" id="rpStatus">${opcoes(STATUS_ROT, er ? er.status : "pronto")}</select></div>
            </div>
            <div><label class="lbl" for="rpTexto">Roteiro (escreva ou cole a resposta do Claude)</label><textarea class="inp" id="rpTexto" rows="10" maxlength="20000" placeholder="CENA 1&#10;FALA: ...&#10;IMAGEM: ...&#10;TEXTO NA TELA: ...">${esc(er ? er.texto || "" : "")}</textarea></div>
            <div class="controles"><button class="btn pequeno" type="submit">${er ? "Salvar roteiro" : "Guardar roteiro"}</button><button class="btn sec pequeno" type="button" data-lu="previa-pasta">Ver roteiro de gravação</button></div>
          </form></div>`; })()}`;

      const salvarPasta = async (d, msg) => { try { trocar(L.pastas, await salvar("pastas", d, pa.id)); if (msg) toast(msg); } catch (er) { toast(amigavel(er), true); } };
      const salvarRef = async (id, d) => { try { const x = await salvar("pasta_refs", d, id); const i = L.prefs.findIndex((y) => y.id === id); if (i >= 0) L.prefs[i] = x; } catch (er) { toast(amigavel(er), true); } };
      const salvarIdeias = async (l) => { await salvarPasta({ ideias: l }); telaPasta(el, pastaDe(pa.id)); };
      // a caixa da anotação cresce com o texto, para ler tudo sem rolar
      const ajusta = (ta) => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
      el.querySelectorAll("textarea.lu-nota").forEach((ta) => { ajusta(ta); ta.addEventListener("input", () => ajusta(ta)); });
      el.querySelector("#luFormRotPasta").addEventListener("submit", async (e) => {
        e.preventDefault(); const pa2 = pastaDe(pa.id) || pa;
        const d = { titulo: val(el, "rpTitulo"), formato: val(el, "rpFormato") || null, status: val(el, "rpStatus"), texto: el.querySelector("#rpTexto").value || null };
        if (!d.titulo) return;
        if (!L.rotPastaEdit) {   // roteiro novo: leva a pasta, o produto e as referências junto
          const rs = refsDa(pa2.id);
          Object.assign(d, { pasta_id: pa2.id, produto: pa2.tipo === "produto" ? pa2.nome : null, links: rs.map((x) => x.link).slice(0, 50), transcricoes: Object.fromEntries(rs.filter((x) => x.texto).map((x) => [x.link, x.texto])) });
        }
        try { trocar(L.rot, await salvar("roteiros", d, L.rotPastaEdit)); toast(L.rotPastaEdit ? "Roteiro salvo." : "Roteiro guardado. Ele também está na aba Roteiros."); L.rotPastaEdit = null; telaPasta(el, pastaDe(pa.id) || pa2); }
        catch (er) { toast(amigavel(er), true); }
      });
      el.querySelector("#luFormIdeia").addEventListener("submit", (e) => { e.preventDefault(); const tx = val(el, "paIdeia"); if (!tx) return; const atual = (pastaDe(pa.id) || pa).ideias || []; salvarIdeias([...atual, { id: novaIdeiaId(), texto: tx.slice(0, 300), feito: false }]); });
      el.onchange = async (e) => {
        pa = pastaDe(pa.id) || pa; const ideias = pa.ideias || [];
        const c = e.target.closest("[data-campo]"), rc = e.target.closest("[data-ref-campo]"), id_ = e.target.closest("[data-lu='ideia-feita']");
        if (c) {
          let v = c.value.trim(); const k = c.dataset.campo;
          if (k === "nome" && !v) { c.value = pa.nome; return; }
          if (k === "comissao") v = v === "" ? null : Math.min(100, Math.max(0, +v));
          await salvarPasta({ [k]: v === "" ? null : v }, "Salvo.");
          if (k === "tipo" || k === "nome" || k === "status") telaPasta(el, pastaDe(pa.id));
        } else if (rc) { await salvarRef(+rc.dataset.id, { [rc.dataset.refCampo]: rc.value.trim() || null }); toast("Salvo."); if (rc.dataset.refCampo === "texto") telaPasta(el, pastaDe(pa.id)); }
        else if (id_) salvarIdeias(ideias.map((i) => (i.id === id_.dataset.i ? { ...i, feito: id_.checked } : i)));
      };
      el.onclick = async (e) => {
        const t = e.target.closest("[data-lu]"); if (!t || t.tagName === "SELECT" || t.dataset.lu === "ideia-feita") return; const a = t.dataset.lu, id = +t.dataset.id;
        pa = pastaDe(pa.id) || pa; const ideias = pa.ideias || [], refs = refsDa(pa.id);
        if (a === "voltar") { L.pastaAberta = null; L.rotPastaEdit = null; telaReferencias(el); }
        else if (a === "ver-rot-pasta") { const r = rotDe(id); if (r && r.texto) P.abrirRoteiro(r.texto, r.produto || r.titulo); }
        else if (a === "editar-rot-pasta") { L.rotPastaEdit = id; telaPasta(el, pa); const c = el.querySelector("#luEscrever"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); }
        else if (a === "cancelar-rot-pasta") { L.rotPastaEdit = null; telaPasta(el, pa); }
        else if (a === "previa-pasta") { const tx = el.querySelector("#rpTexto").value; if (!tx.trim()) { toast("Escreva ou cole o roteiro primeiro.", true); return; } P.abrirRoteiro(tx, pa.tipo === "produto" ? pa.nome : val(el, "rpTitulo")); }
        else if (a === "add-ref") {
          const ta = el.querySelector("#paLinks"), ja = new Set(refs.map((x) => x.link)), novos = linksDoTexto(ta.value).filter((u) => !ja.has(u));
          if (!novos.length) { toast("Não achei link novo nesse texto.", true); return; }
          try { for (const u of novos) L.prefs.push(await salvar("pasta_refs", { pasta_id: pa.id, link: u })); toast(`${novos.length} vídeo(s) adicionado(s).`); telaPasta(el, pa); } catch (er) { toast(amigavel(er), true); }
        }
        else if (a === "apagar-ref") { const x = L.prefs.find((y) => y.id === id); if (!x || !confirm("Tirar esse vídeo da pasta?")) return; try { await apagar("pasta_refs", id); L.prefs = L.prefs.filter((y) => y.id !== id); telaPasta(el, pa); } catch (er) { toast(amigavel(er), true); } }
        else if (a === "transcrever-ref") {
          const x = L.prefs.find((y) => y.id === id); if (!x) return;
          if (!P.transcrever) { toast("A transcrição não está ligada neste painel.", true); return; }
          t.disabled = true; toast("Ouvindo o vídeo. Leva até 3 minutos, pode deixar a aba aberta.");
          const res = await P.transcrever(x.link, (seg) => { const b2 = el.querySelector(`[data-lu="transcrever-ref"][data-id="${id}"]`); if (b2) b2.textContent = `Ouvindo... ${seg}s`; });
          if (res && res.texto) { await salvarRef(id, { texto: String(res.texto).slice(0, 8000) }); toast("Texto chegou e foi salvo."); } else toast((res && res.erro) || "Não deu para transcrever.", true);
          if (L.pastaAberta === pa.id && P.S.tela === "referencias") telaPasta(el, pastaDe(pa.id));
        }
        else if (a === "ideia-apagar") salvarIdeias(ideias.filter((i) => i.id !== t.dataset.i));
        else if (a === "ideia-roteiro" || a === "roteiro-pasta") {
          const ideia = a === "ideia-roteiro" ? ideias.find((i) => i.id === t.dataset.i) : null;
          L.prefillRot = { pasta_id: pa.id, nomePasta: pa.nome, titulo: ideia ? ideia.texto.slice(0, 160) : pa.nome, produto: pa.tipo === "produto" ? pa.nome : "", links: refs.map((x) => x.link), transcricoes: Object.fromEntries(refs.filter((x) => x.texto).map((x) => [x.link, x.texto])), obs: ideia ? "" : (pa.notas || "").slice(0, 2000) };
          L.editRot = null; L.linksDe = null; irPara("roteiros");
        }
        else if (a === "pedido-pasta") {
          if (!refs.length && !ideias.filter((i) => !i.feito).length) { toast("Adicione um vídeo de referência ou anote uma ideia antes.", true); return; }
          const sem = refs.filter((x) => !(x.texto || "").trim()).length;
          const pedido = pedidoMultiplo(pa, refs, ideias);
          const aviso = sem ? ` Atenção: ${sem} vídeo(s) ainda sem transcrição.` : "";
          try { await navigator.clipboard.writeText(pedido); toast("Pedido copiado. Cole na conversa com o Claude." + aviso, !!sem); }
          catch (_) { const ta2 = document.createElement("textarea"); ta2.value = pedido; document.body.appendChild(ta2); ta2.select(); try { document.execCommand("copy"); toast("Pedido copiado. Cole na conversa com o Claude." + aviso, !!sem); } catch (__) { toast("Não consegui copiar sozinho.", true); } ta2.remove(); }
        }
        else if (a === "apagar-pasta") { if (!confirm(`Apagar a pasta "${pa.nome}" com as referências e ideias dela? Os roteiros que saíram dela continuam.`)) return; try { await apagar("pastas", pa.id); L.pastas = L.pastas.filter((y) => y.id !== pa.id); L.prefs = L.prefs.filter((y) => y.pasta_id !== pa.id); L.pastaAberta = null; toast("Pasta apagada."); telaReferencias(el); } catch (er) { toast(amigavel(er), true); } }
      };
    }

    /* ---------- registra telas e menu ---------- */
    // saiu para outra tela do menu: na volta, recarrega
    document.addEventListener("click", (e) => { const b = e.target.closest("[data-tela]"); if (b && !["calendario", "roteiros", "referencias"].includes(b.dataset.tela)) L.dentro = false; }, true);
    Object.assign(P.DESENHOS, { calendario: telaCalendario, roteiros: telaRoteiros, referencias: telaReferencias });
    P.NOMES.referencias = "Referências";
    P.ICONES.referencias = '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 11.5v4l3.5-2z"/>';
    if (P.TELAS && !P.TELAS.some((t) => t[0] === "referencias")) { const i = P.TELAS.findIndex((t) => t[0] === "criar"); P.TELAS.splice(i >= 0 ? i + 1 : P.TELAS.length, 0, ["referencias", "Referências"]); }
    TELAS.forEach(([id, nome]) => { P.NOMES[id] = nome; });
    const desenharMenu = () => {
      const box = document.getElementById("menuExtra"); if (!box) return;
      let g = box.querySelector('[data-grupo="conteudo"]'); if (!g) { g = document.createElement("div"); g.dataset.grupo = "conteudo"; box.appendChild(g); }
      g.innerHTML = `<div class="menu-grupo">Conteúdo</div><nav class="menu-itens">${TELAS.map(([id, nome]) => `<button class="menu-item" type="button" data-tela="${id}" data-dica="${nome}"><svg class="i" viewBox="0 0 24 24">${ICONES[id]}</svg><span class="rotulo">${nome}</span></button>`).join("")}</nav>`;
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", desenharMenu); else desenharMenu();
  });
})();
