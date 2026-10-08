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

export const LEVELS = [
  { max: 2, risk: "ok", title: "Postura aceitável", text: "Aceitável se não for mantida ou repetida por longos períodos." },
  { max: 4, risk: "wn", title: "Vale investigar", text: "Convém investigar a tarefa e considerar ajustes." },
  { max: 6, risk: "bd", title: "Mude em breve", text: "Investigue e faça mudanças o quanto antes." },
  { max: 9, risk: "bd", title: "Mude agora", text: "Investigue e mude imediatamente." }
];
export const levelOf = s => LEVELS.find(l => s <= l.max);

// lm: 33 landmarks; o: dados informados no formulário
export function analyze(lm, o) {
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
