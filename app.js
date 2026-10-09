(async () => {
  // Chaves padrão (a tela "Chaves de API" ainda pode sobrescrevê-las neste navegador).
  const DEFAULT_KEYS = {
    gk: "AQ.Ab8RN6Lnhkbfug3qDolp6TW0iQpyDmM0V3Kp8v0jTlarevx4Aw", // Google AI Studio (Gemini)
    vk: "AIzaSyBT6dXLbc5CPOFrQmx3s21TuF2HhlHMoTc",               // Google Cloud Vision
    gm: "gemini-3.8-flash"
  };
// Motor RULA (funções puras). Usa worldLandmarks (3D, metros) quando disponíveis.
// Tabelas A/B/C do RULA codificadas em texto. Tabela B corrigida: pescoço 1 / tronco 1 / pernas 2 = 3.
const TA = ["12 22 23 33|22 22 33 33|23 33 33 44", "23 33 34 44|33 33 34 44|34 44 44 55",
  "33 44 44 55|34 44 44 55|44 44 45 55", "44 44 45 55|44 44 45 55|44 45 55 66",
  "55 55 56 67|56 66 67 77|66 67 77 78", "77 77 78 89|88 88 89 99|99 99 99 99"];
const TB = ["13 23 34 55 66 77", "23 23 45 55 67 77", "33 34 45 56 67 77", "55 56 67 77 77 88", "77 77 78 88 88 88", "88 88 88 89 99 99"];
const TC = ["1233455", "2234455", "3334456", "3334566", "4445677", "4456677", "5566777", "5567777"];
const tabA = (u, l, w, t) => +TA[u - 1].split("|")[l - 1].split(" ")[w - 1][t - 1];
const tabB = (n, t, g) => +TB[n - 1].split(" ")[t - 1][g - 1];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) });
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = a => Math.hypot(a.x, a.y, a.z);
const between = (u, v) => Math.acos(clamp(dot(u, v) / (len(u) * len(v) || 1), -1, 1)) * 180 / Math.PI;
const ang = (a, b, c) => between(sub(a, b), sub(c, b)); // ângulo em b
const flat = (v, drop) => drop === "y" ? { x: v.x, y: 0, z: v.z } : { x: v.x, y: v.y, z: 0 };
const planar = (u, v, drop) => between(flat(u, drop), flat(v, drop));

const SIDES = {
  right: { sh: 12, el: 14, wr: 16, pk: 18, ix: 20, hip: 24, ear: 8, s: 1 },
  left:  { sh: 11, el: 13, wr: 15, pk: 17, ix: 19, hip: 23, ear: 7, s: -1 }
};

const LEVELS = [
  { max: 2, risk: "ok", title: "Postura aceitável", text: "Aceitável se não for mantida ou repetida por longos períodos." },
  { max: 4, risk: "wn", title: "Vale investigar", text: "Convém investigar a tarefa e considerar ajustes." },
  { max: 6, risk: "bd", title: "Mude em breve", text: "Investigue e faça mudanças o quanto antes." },
  { max: 9, risk: "bd", title: "Mude agora", text: "Investigue e mude imediatamente." }
];
const levelOf = s => LEVELS.find(l => s <= l.max);

// lm: 33 landmarks; o: dados informados no formulário
function analyze(lm, o) {
  const P = i => lm[i];
  const shL = P(11), shR = P(12), hipL = P(23), hipR = P(24);
  const shM = mid(shL, shR), hipM = mid(hipL, hipR), earM = mid(P(7), P(8));
  const lat = sub(shR, shL), hipAxis = sub(hipR, hipL), earAxis = sub(P(8), P(7));
  const torso = sub(shM, hipM), torsoLen = len(torso) || 1;

  // Pescoço: flexão vs. tronco (sinal pela direção do rosto); extensão = 4
  const neckAng = between(sub(earM, shM), torso);
  const facing = Math.sign(P(0).x - earM.x) || 1;
  const forward = (earM.x - shM.x) * facing > 0;
  let neck = !forward && neckAng > 5 ? 4 : neckAng <= 10 ? 1 : neckAng <= 20 ? 2 : 3;
  const neckTwist = planar(earAxis, lat, "y") > 20, neckBend = planar(earAxis, lat, "z") > 15;
  const neckTotal = clamp(neck + neckTwist + neckBend, 1, 6);

  // Tronco: inclinação em relação à vertical
  const tilt = Math.acos(clamp(Math.abs(torso.y) / torsoLen, 0, 1)) * 180 / Math.PI;
  const trunk = tilt <= 5 ? 1 : tilt <= 20 ? 2 : tilt <= 60 ? 3 : 4;
  const trunkTwist = planar(lat, hipAxis, "y") > 15, trunkBend = planar(lat, hipAxis, "z") > 10;
  const trunkTotal = clamp(trunk + trunkTwist + trunkBend, 1, 6);

  const legs = o.legs || 1;
  const scoreB = clamp(tabB(neckTotal, trunkTotal, legs) + (o.muscLeg || 0) + (o.forceLeg || 0), 1, 7);

  const side = k => {
    const d = SIDES[k], sh = P(d.sh), el = P(d.el), wr = P(d.wr), hand = mid(P(d.pk), P(d.ix));
    // Braço
    const flex = ang(P(d.hip), sh, el);
    let ua = flex <= 20 ? 1 : flex <= 45 ? 2 : flex <= 90 ? 3 : 4;
    const raised = len(sub(sh, P(d.ear))) / torsoLen < 0.3;
    const u = sub(el, sh);
    const abducted = flex > 20 && Math.abs(dot(u, lat) / len(lat)) / (len(u) || 1) > 0.5;
    const uaTotal = clamp(ua + raised + abducted - (o.supported ? 1 : 0), 1, 6);
    // Antebraço: flexão do cotovelo ideal entre 60° e 100°; +1 se cruza a linha média ou sai para o lado
    const elbowFlex = 180 - ang(sh, el, wr);
    const t = (dot(sub(wr, shM), lat) / (len(lat) ** 2 || 1)) * d.s;
    const across = t < 0 || t > 0.95;
    const laTotal = clamp((elbowFlex >= 60 && elbowFlex <= 100 ? 1 : 2) + across, 1, 3);
    // Punho: desvio de 180° (reto); desvio lateral informado no formulário
    const wristFlex = 180 - ang(el, wr, hand);
    const wBase = wristFlex <= 5 ? 1 : wristFlex <= 15 ? 2 : 3;
    const wTotal = clamp(wBase + (o.wristDev ? 1 : 0), 1, 4);
    const twist = o.wristTwist || 1;
    const scoreA = clamp(tabA(uaTotal, laTotal, wTotal, twist) + (o.muscArm || 0) + (o.forceArm || 0), 1, 8);
    const score = TC[scoreA - 1][scoreB - 1];
    return { score: +score, scoreA, upper: uaTotal, lower: laTotal, wrist: wTotal, twist,
      deg: { upper: flex, elbow: elbowFlex, wrist: wristFlex } };
  };

  const right = side("right"), left = side("left");
  const worst = right.score >= left.score ? "right" : "left";
  return { right, left, worst, score: Math.max(right.score, left.score), scoreB,
    neck: neckTotal, trunk: trunkTotal, legs, deg: { neck: neckAng, trunk: tilt } };
}
// Integrações opcionais com APIs do Google. As chaves ficam só no navegador (localStorage).
async function visionContext(base64, key) {
  const r = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content: base64 },
      features: [{ type: "OBJECT_LOCALIZATION", maxResults: 10 }, { type: "LABEL_DETECTION", maxResults: 8 }] }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Cloud Vision respondeu ${r.status}`);
  const a = j.responses[0] || {};
  return [...new Set([...(a.localizedObjectAnnotations || []).map(o => o.name), ...(a.labelAnnotations || []).map(l => l.description)])];
}

async function geminiAdvice(summary, key, model = "gemini-3.8-flash") {
  const prompt = `Você é um ergonomista. Com base na avaliação RULA abaixo (JSON), escreva em português do Brasil:
1) uma leitura curta do risco; 2) até 5 ajustes práticos, em ordem de impacto; 3) o que reavaliar depois.
Seja direto, sem diagnóstico médico. Lembre que os ângulos vêm de estimativa automática por vídeo/foto.
${JSON.stringify(summary)}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Gemini respondeu ${r.status}`);
  return (j.candidates?.[0]?.content?.parts || []).map(p => p.text).join("") || "Sem resposta do modelo.";
}

let PoseLandmarker, ObjectDetector, FilesetResolver, DrawingUtils;
const $ = s => document.querySelector(s);
const cv = $("#cv"), c2d = cv.getContext("2d"), vid = document.createElement("video");
vid.playsInline = true; vid.muted = true;
let pose, detector, media, last, result, playing = false, raf = 0, lastT = -1;
const status = t => ($("#status").textContent = t);
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const GCS = "https://storage.googleapis.com/mediapipe-models/";

async function init() {
  try {
    ({ PoseLandmarker, ObjectDetector, FilesetResolver, DrawingUtils } = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"));
    const fs = await FilesetResolver.forVisionTasks(WASM);
    pose = await PoseLandmarker.createFromOptions(fs, { runningMode: "IMAGE", numPoses: 1,
      baseOptions: { modelAssetPath: GCS + "pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task", delegate: "GPU" } });
    detector = await ObjectDetector.createFromOptions(fs, { runningMode: "IMAGE", scoreThreshold: 0.4, maxResults: 8,
      baseOptions: { modelAssetPath: GCS + "object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite", delegate: "GPU" } });
    status("Modelos prontos. Envie uma foto ou um vídeo.");
  } catch (e) { console.error(e); status("Não foi possível carregar os modelos: " + e.message); }
}

function frame() {
  if (!pose || !media) return;
  const r = media === vid ? pose.detectForVideo(vid, performance.now()) : pose.detect(media);
  c2d.drawImage(media, 0, 0, cv.width, cv.height);
  const lm = r.landmarks[0];
  if (lm) {
    const du = new DrawingUtils(c2d);
    du.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: "#8fd3ff", lineWidth: 3 });
    du.drawLandmarks(lm, { color: "#0e211f", fillColor: "#efe8d8", radius: 3 });
  }
  last = lm ? { lm, world: r.worldLandmarks[0] } : null;
  status(lm ? "Pessoa detectada. Ajuste o contexto ao lado se preciso." : "Nenhuma pessoa detectada neste quadro.");
  render();
}

const form = () => {
  const f = new FormData($("#ctx")), n = k => +f.get(k);
  return { supported: f.has("supported"), wristDev: f.has("wristDev"), wristTwist: n("wristTwist"),
    muscArm: n("muscArm"), forceArm: n("forceArm"), legs: n("legs"), muscLeg: n("muscLeg"), forceLeg: n("forceLeg") };
};

function render() {
  const ring = $("#ring");
  if (!last) { result = null; ring.dataset.r = ""; $("#sc").textContent = "–"; $("#lvl").textContent = "Aguardando uma pessoa no quadro"; $("#sub").textContent = ""; $("#bd").innerHTML = ""; return; }
  result = analyze(last.world || last.lm, form());
  const lv = levelOf(result.score);
  ring.dataset.r = lv.risk; ring.style.setProperty("--p", (result.score / 7) * 100);
  $("#sc").textContent = result.score; $("#lvl").textContent = lv.title;
  $("#sub").textContent = `${lv.text} Lado mais exigido: ${result.worst === "right" ? "direito" : "esquerdo"}.`;
  const R = result.right, L = result.left, row = (n, a, b) => `<tr><th>${n}</th><td>${a}</td><td>${b ?? a}</td></tr>`;
  $("#bd").innerHTML = `<tr><th></th><td>Direito</td><td>Esquerdo</td></tr>` +
    row("Braço", R.upper, L.upper) + row("Antebraço", R.lower, L.lower) + row("Punho", R.wrist, L.wrist) +
    row("Grupo A (braço e punho)", R.scoreA, L.scoreA) + row("Pescoço", result.neck) + row("Tronco", result.trunk) +
    row("Grupo B (pescoço, tronco, pernas)", result.scoreB) + row("Pontuação final", R.score, L.score);
}

function showChips(items, src) {
  $("#chips").innerHTML = items.length ? `<span>${src}:</span>` + items.map(i => `<b>${i.replace(/[<>&]/g, "")}</b>`).join("") : "";
}
const localObjects = () => detector && media && showChips([...new Set(detector.detect(media).detections.map(d => d.categories[0].categoryName))], "Objetos (ML local)");

async function load(file) {
  if (!pose) return status("Aguarde o carregamento dos modelos.");
  playing = false; cancelAnimationFrame(raf);
  const url = URL.createObjectURL(file), isVideo = file.type.startsWith("video/");
  await pose.setOptions({ runningMode: isVideo ? "VIDEO" : "IMAGE" });
  if (isVideo) {
    vid.src = url; await new Promise(r => (vid.onloadeddata = r));
    cv.width = vid.videoWidth; cv.height = vid.videoHeight; media = vid;
  } else {
    const img = new Image(); img.src = url; await img.decode();
    cv.width = img.naturalWidth; cv.height = img.naturalHeight; media = img;
  }
  $("#drop").classList.add("has"); $("#vctl").hidden = !isVideo; $("#chips").innerHTML = "";
  frame(); if (!isVideo) localObjects();
}

const loop = () => { if (!playing) return; if (vid.currentTime !== lastT) { lastT = vid.currentTime; frame(); } raf = requestAnimationFrame(loop); };
$("#play").onclick = () => {
  playing = !playing; $("#play").textContent = playing ? "Pausar" : "Reproduzir";
  if (playing) { vid.play(); loop(); } else { vid.pause(); cancelAnimationFrame(raf); frame(); localObjects(); }
};
const step = d => { if (!playing) vid.currentTime = Math.max(0, vid.currentTime + d / 30); };
$("#prev").onclick = () => step(-1); $("#next").onclick = () => step(1);
vid.onseeked = () => { if (!playing) frame(); };

$("#file").onchange = e => e.target.files[0] && load(e.target.files[0]);
const stage = $("#stage");
stage.ondragover = e => { e.preventDefault(); $("#drop").classList.add("over"); };
stage.ondragleave = () => $("#drop").classList.remove("over");
stage.ondrop = e => { e.preventDefault(); $("#drop").classList.remove("over"); e.dataTransfer.files[0] && load(e.dataTransfer.files[0]); };
$("#ctx").onchange = render;

// Configurações de API
const dlg = $("#dlg"), store = k => localStorage.getItem(k) || DEFAULT_KEYS[k] || "";
$("#btnSettings").onclick = () => { $("#vk").value = store("vk"); $("#gk").value = store("gk"); $("#gm").value = store("gm") || "gemini-3.8-flash"; dlg.showModal(); };
$("#save").onclick = () => { localStorage.setItem("vk", $("#vk").value.trim()); localStorage.setItem("gk", $("#gk").value.trim()); localStorage.setItem("gm", $("#gm").value.trim()); };

$("#btnVision").onclick = async () => {
  if (!media) return status("Envie uma imagem primeiro.");
  if (!store("vk")) return $("#btnSettings").click();
  try {
    status("Consultando o Cloud Vision…");
    const o = document.createElement("canvas"); o.width = cv.width; o.height = cv.height;
    o.getContext("2d").drawImage(media, 0, 0, o.width, o.height);
    showChips(await visionContext(o.toDataURL("image/jpeg", 0.85).split(",")[1], store("vk")), "Cloud Vision");
    status("Contexto do ambiente atualizado.");
  } catch (e) { status("Cloud Vision: " + e.message); }
};
$("#btnAI").onclick = async () => {
  if (!result) return status("Analise uma pessoa primeiro.");
  if (!store("gk")) return $("#btnSettings").click();
  $("#ai").textContent = "Gerando recomendações…";
  try {
    const summary = { pontuacaoFinal: result.score, ladoMaisExigido: result.worst, nivel: levelOf(result.score).title,
      grupoA: { direito: result.right, esquerdo: result.left }, grupoB: result.scoreB, pescoco: result.neck, tronco: result.trunk,
      contexto: form(), ambiente: [...document.querySelectorAll("#chips b")].map(b => b.textContent) };
    $("#ai").textContent = await geminiAdvice(summary, store("gk"), store("gm") || undefined);
  } catch (e) { $("#ai").textContent = "Gemini: " + e.message; }
};
init();
})();
