import assert from "node:assert/strict";
import http from "node:http";
import { analyzeOriginalText, unicodeTokens, lexicalCosine, PREPROCESSING_VERSION } from "../services/unicodeText.js";
import { compareTexts, querySimilarityService } from "../services/similarityProvider.js";
type Result = { status: number; body: any };
export async function runLanguageChecks(context: { request: (actor: string, route: string, method?: string, body?: unknown) => Promise<Result>; check: (name: string, operation: () => Promise<void>) => Promise<void> }) {
  const { request, check } = context;
  const examples = ["शिक्षकों का वेतन तीन महीने से नहीं मिला", "શિક્ષકોનો પગાર ત્રણ મહિનાથી મળ્યો નથી", "ஆசிரியர்களுக்கு மூன்று மாதங்களாக சம்பளம் வழங்கப்படவில்லை", "అధ్యాపకులకు మూడు నెలలుగా జీతాలు చెల్లించలేదు", "শিক্ষকদের তিন মাসের বেতন দেওয়া হয়নি", "ಶಿಕ್ಷಕರಿಗೆ ಮೂರು ತಿಂಗಳಿನಿಂದ ವೇತನ ಪಾವತಿಸಿಲ್ಲ"];
  await check("All six Indian-script examples retain meaningful tokens, combining marks and numbers", async () => {
    for (const text of examples) { const tokens = unicodeTokens(text); assert.ok(tokens.length >= 3); assert.equal(lexicalCosine(text, text), 100); assert.ok(tokens.some(token => /\p{M}/u.test(token))); }
    assert.ok(unicodeTokens("कक्षा १२३ ₹ 2026").includes("१२३")); assert.ok(unicodeTokens("தமிழ் English 2026").includes("தமிழ்"));
    assert.equal(analyzeOriginalText("", examples[0]).language.code, "und"); assert.equal(analyzeOriginalText("", examples[4]).language.code, "und"); assert.equal(analyzeOriginalText("", examples[2]).language.code, "ta");
    assert.equal(analyzeOriginalText("English", examples[2]).language.code, "mul");
    for (const text of examples) assert.equal(analyzeOriginalText("", text).translation.text, undefined);
  });
  const initial = await request("head", "complaints", "POST", { institutionId: "north", category: "Faculty Shortage / Irregularities", title: "Original multilingual fixture", description: examples[0], receivingBureauId: "RB", assignedOfficerId: "officer", priority: "Medium" });
  assert.equal(initial.status, 201); const id = initial.body.complaint.id;
  let state = (await request("officer", `complaint-language/${id}`)).body;
  await check("Intake persists original-language metadata and never fabricates a translation", async () => {
    assert.equal(initial.body.complaint.description, examples[0]); assert.equal(initial.body.complaint.textAnalysis.preprocessingVersion, PREPROCESSING_VERSION); assert.equal(state.analysis.translation.status, "not_requested"); assert.equal(state.analysis.translation.text, undefined);
    assert.equal((await request("peer", `complaint-language/${id}`)).status, 404); assert.equal((await request("admin", `complaint-language/${id}`)).status, 404);
  });
  await check("An official can declare a shared-script language without inventing detection confidence", async () => {
    const result = await request("officer", `complaint-language/${id}`, "POST", { action: "declare_language", language: "hi", sourceHash: state.analysis.sourceHash, reason: "Synthetic Hindi source reviewed by fixture officer" }); assert.equal(result.status, 200); state = result.body;
    assert.equal(state.analysis.language.method, "human_declared"); assert.equal(state.analysis.language.code, "hi"); assert.equal(state.analysis.language.confidence, undefined);
    assert.equal((await request("officer", `complaint-language/${id}`, "POST", { action: "declare_language", language: "hi", sourceHash: "stale", reason: "Reject changed source" })).status, 409);
    assert.equal((await request("officer", `complaint-language/${id}`, "POST", { action: "declare_language", language: "unknown", sourceHash: state.analysis.sourceHash, reason: "Reject unsupported language" })).status, 400);
  });
  await check("Original text cannot masquerade as a translation; drafts require independent authorized review", async () => {
    assert.equal((await request("officer", `complaint-language/${id}`, "POST", { action: "supply_translation", targetLanguage: "en", text: examples[0], sourceHash: state.analysis.sourceHash, reason: "This must not count as translation" })).status, 400);
    const draft = await request("officer", `complaint-language/${id}`, "POST", { action: "supply_translation", targetLanguage: "en", text: "Synthetic draft: teachers have not received salary for three months.", sourceHash: state.analysis.sourceHash, reason: "Human-supplied synthetic translation draft" }); assert.equal(draft.status, 200); state = draft.body; assert.equal(state.analysis.translation.status, "draft"); assert.equal(state.analysis.translation.method, "human_supplied");
    assert.equal((await request("officer", `complaint-language/${id}`, "POST", { action: "review_translation", sourceHash: state.analysis.sourceHash, reason: "Self-review must be denied" })).status, 403);
    const review = await request("authority", `complaint-language/${id}`, "POST", { action: "review_translation", sourceHash: state.analysis.sourceHash, reason: "Independent synthetic translation review" }); assert.equal(review.status, 200); state = review.body; assert.equal(state.analysis.translation.status, "reviewed"); assert.equal(state.analysis.translation.reviewedBy, "authority");
    const original = (await request("officer", `complaints/${id}`)).body.complaint; assert.equal(original.description, examples[0]); assert.equal(original.textAnalysis.sourceHash, state.analysis.sourceHash);
  });
  await check("Language annotation APIs inherit sealed-case denial", async () => {
    const policy = (await request("authority", `case-security/${id}`)).body;
    assert.equal((await request("authority", `case-security/${id}`, "PUT", { version: policy.version, level: "sealed", grants: [], reason: "Synthetic sealed annotation isolation" })).status, 200);
    assert.equal((await request("officer", `complaint-language/${id}`)).status, 404); assert.equal((await request("officer", `complaint-language/${id}`, "POST", { action: "declare_language", language: "hi", sourceHash: state.analysis.sourceHash, reason: "Sealed annotations must stay hidden" })).status, 404);
  });
  await check("Provider outage and unavailable mode remain honest and do not imply cross-language semantics", async () => {
    const original = process.env.SIMILARITY_MODE;
    try {
      process.env.SIMILARITY_MODE = "lexical"; const fallback = await compareTexts(examples[0], examples[1]); assert.equal(fallback.mode, "lexical_fallback"); assert.equal(fallback.score, 0); assert.ok(fallback.limitation.includes("does not provide semantic"));
      process.env.SIMILARITY_MODE = "unavailable"; const unavailable = await compareTexts(examples[0], examples[0]); assert.equal(unavailable.mode, "unavailable"); assert.equal(unavailable.score, undefined);
    } finally { if (original === undefined) delete process.env.SIMILARITY_MODE; else process.env.SIMILARITY_MODE = original; }
  });
  await check("Provider deadlines and stale preprocessing metadata cause a safe local fallback", async () => {
    let slow = false;
    const fixture = http.createServer((_req, res) => { const respond = () => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ mode: "multilingual_embeddings", similarity_score: 100, model: "fixture-only", revision: "test", preprocessing_version: "stale-version" })); }; if (slow) setTimeout(respond, 250); else respond(); });
    await new Promise<void>(resolve => fixture.listen(0, "127.0.0.1", resolve));
    const previous = { url: process.env.AI_SERVICE_URL, timeout: process.env.AI_TIMEOUT_MS, mode: process.env.SIMILARITY_MODE };
    try {
      process.env.AI_SERVICE_URL = `http://127.0.0.1:${(fixture.address() as import("node:net").AddressInfo).port}`; process.env.AI_TIMEOUT_MS = "100"; process.env.SIMILARITY_MODE = "auto";
      assert.equal(await querySimilarityService(examples[0], examples[0]), null); slow = true;
      const result = await compareTexts(examples[2], examples[2]); assert.equal(result.mode, "lexical_fallback"); assert.equal(result.score, 100);
    } finally {
      for (const [key, value] of [["AI_SERVICE_URL", previous.url], ["AI_TIMEOUT_MS", previous.timeout], ["SIMILARITY_MODE", previous.mode]]) { if (value === undefined) delete process.env[key!]; else process.env[key!] = value; }
      fixture.closeAllConnections(); await new Promise<void>(resolve => fixture.close(() => resolve()));
    }
  });
}
