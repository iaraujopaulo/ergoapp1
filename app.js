import { PoseLandmarker, ObjectDetector, FilesetResolver, DrawingUtils }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { analyze, levelOf } from "./rula.js";
import { visionContext, geminiAdvice } from "./apis.js";

const $ = s => document.querySelector(s);
const cv = $("#cv"), c2d = cv.getContext("2d"), vid = document.createElement("video");
vid.playsInline = true; vid.muted = true;
let pose, detector, media, last, result, playing = false, raf = 0, lastT = -1;
const status = t => ($("#status").textContent = t);
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const GCS = "https://storage.googleapis.com/mediapipe-models/";

async function init() {
  try {
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
const dlg = $("#dlg"), store = k => localStorage.getItem(k) || "";
$("#btnSettings").onclick = () => { $("#vk").value = store("vk"); $("#gk").value = store("gk"); $("#gm").value = store("gm") || "gemini-2.5-flash"; dlg.showModal(); };
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
