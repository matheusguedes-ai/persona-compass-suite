// #285B — CONTRASTE NA TELA: o complemento do `python3 scripts/testar_pdf.py contraste`.
//
// O teste de paleta mede as cores; este mede a página ABERTA — cada texto visível contra o fundo real
// atrás dele (sobe pelos ancestrais compondo os fundos translúcidos até achar um opaco, e leva em conta
// a opacidade do caminho). O navegador converte qualquer cor (oklch, color-mix…) para sRGB pelo canvas,
// então vale o que está NA TELA, não o que está no código. Texto sobre imagem é contado à parte (o
// fundo real é a foto, que o cálculo não enxerga). Controles desativados ficam de fora (o WCAG isenta).
//
// Uso: na página aberta (logado com a conta FICTÍCIA de `scripts/fixture_contraste.py`), no console:
//   eval(await (await fetch("/scripts/contraste_na_tela.js")).text())
// Devolve { pagina, tema, largura, textos_medidos, falhas: [...], piores: [...] }. Rodar nos dois
// temas e na largura de celular (375).
(() => {
  // Botão com `transition-colors` leva ~150 ms para chegar à cor nova, e a janela que abre entra
  // esmaecendo; numa aba escondida isso quase não anda, e medir no meio mede uma cor que ninguém vê
  // parada. Leva ao fim toda transição e toda animação que TEM fim (o ícone girando fica como está).
  for (const a of document.getAnimations()) {
    const infinita = a.effect?.getTiming?.().iterations === Infinity;
    if (!infinita) {
      try { a.finish(); } catch { /* sem fim definido: fica como está */ }
    }
  }
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (css) => {
    if (!css || css === "transparent" || css === "none") return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const sobre = (c, b) => [0, 1, 2].map((i) => c[i] * c[3] + b[i] * (1 - c[3])).concat(1);
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const razao = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  const fundoRaiz = () => {
    const b = rgba(getComputedStyle(document.body).backgroundColor);
    return b[3] > 0 ? sobre(b, [255, 255, 255, 1]) : rgba(getComputedStyle(document.documentElement).backgroundColor);
  };

  function fundoDe(el) {
    const camadas = [];
    let imagem = false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== "none") imagem = true;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) {
        camadas.push(c);
        if (c[3] >= 0.999) break;
      }
    }
    let base = camadas.length && camadas[camadas.length - 1][3] >= 0.999 ? camadas.pop() : fundoRaiz();
    for (let i = camadas.length - 1; i >= 0; i--) base = sobre(camadas[i], base);
    return { cor: base, imagem };
  }

  function opacidade(el) {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || "1");
    return o;
  }

  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if (cs.position === "absolute" && cs.clip === "rect(0px, 0px, 0px, 0px)") return false;
    }
    return true;
  };

  const inativo = (el) => !!el.closest("button:disabled, [aria-disabled='true'], fieldset:disabled, input:disabled");

  const medidos = [];
  const falhas = [];
  const vistos = new Set();
  const todos = document.querySelectorAll("body *");
  for (const el of todos) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
    const campo = (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.value ? el.value : "";
    const conteudo = texto || campo;
    if (!conteudo || !visivel(el) || inativo(el)) continue;
    if (el.closest(".sr-only")) continue;
    const cs = getComputedStyle(el);
    const svgTexto = el instanceof SVGElement;
    let fg = rgba(svgTexto ? cs.fill : cs.color);
    const { cor: bg, imagem } = fundoDe(svgTexto ? el.closest("svg")?.parentElement ?? el : el);
    fg = [fg[0], fg[1], fg[2], fg[3] * opacidade(el)];
    const fgVisto = sobre(fg, bg);
    const c = razao(fgVisto, bg);
    const px = parseFloat(cs.fontSize);
    const negrito = parseInt(cs.fontWeight, 10) >= 700;
    const grande = px >= 24 || (px >= 18.66 && negrito);
    const minimo = grande ? 3 : 4.5;
    const item = { texto: conteudo.slice(0, 60), razao: +c.toFixed(2), minimo, fg: hex(fgVisto), bg: hex(bg), imagem,
                   classe: (el.getAttribute("class") || "").slice(0, 120), tag: el.tagName.toLowerCase() };
    medidos.push(item);
    if (c < minimo && !imagem) {
      const chave = `${item.fg}|${item.bg}|${item.texto}`;
      if (!vistos.has(chave)) { vistos.add(chave); falhas.push(item); }
    }
  }
  const tema = document.documentElement.classList.contains("dark") ? "escuro" : "claro";
  const piores = [...medidos].filter((m) => !m.imagem).sort((a, b) => a.razao - b.razao).slice(0, 3);
  return { pagina: location.pathname, tema, largura: innerWidth, textos_medidos: medidos.length,
           com_imagem_atras: medidos.filter((m) => m.imagem).length, falhas, piores };
})()
