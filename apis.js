// Integrações opcionais com APIs do Google. As chaves ficam só no navegador (localStorage).
export async function visionContext(base64, key) {
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

export async function geminiAdvice(summary, key, model = "gemini-2.5-flash") {
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
