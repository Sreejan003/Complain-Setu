import fs from "node:fs";
import { fileURLToPath } from "node:url";

// All content is synthetic draft material. No operational Store/import/seed module is used.
const languages = ["en", "hi", "gu", "ta", "te", "bn", "kn", "mixed"];
const themes = [
  { category: "Capitation Fee / Overcharging", relatedCategory: "Admission Guideline Violations", en: ["The institution collected an additional admission fee from students in this programme.", "Students request verification of admission receipts for the same programme and admission round.", "The institution requests information about next year's library purchase budget."],
    hi: ["संस्थान ने इस पाठ्यक्रम के छात्रों से अतिरिक्त प्रवेश शुल्क लिया।", "छात्र उसी पाठ्यक्रम और प्रवेश दौर की शुल्क रसीदों की जाँच चाहते हैं।", "संस्थान अगले वर्ष के पुस्तकालय खरीद बजट की जानकारी चाहता है।"],
    gu: ["સંસ્થાએ આ અભ્યાસક્રમના વિદ્યાર્થીઓ પાસેથી વધારાની પ્રવેશ ફી લીધી.", "વિદ્યાર્થીઓ એ જ અભ્યાસક્રમ અને પ્રવેશ ચક્રની ફીની રસીદોની તપાસ માંગે છે.", "સંસ્થા આવતા વર્ષના પુસ્તકાલય ખરીદી બજેટની માહિતી માંગે છે."],
    ta: ["இந்தப் படிப்பின் மாணவர்களிடமிருந்து நிறுவனம் கூடுதல் சேர்க்கைக் கட்டணம் வசூலித்தது.", "அதே படிப்பு மற்றும் சேர்க்கைச் சுற்றின் கட்டண ரசீதுகளைச் சரிபார்க்க மாணவர்கள் கோருகின்றனர்.", "அடுத்த ஆண்டின் நூலகக் கொள்முதல் நிதி பற்றிய தகவலை நிறுவனம் கோருகிறது."],
    te: ["ఈ కోర్సు విద్యార్థుల నుంచి సంస్థ అదనపు ప్రవేశ రుసుము వసూలు చేసింది.", "అదే కోర్సు మరియు ప్రవేశ దశకు సంబంధించిన రుసుము రసీదుల తనిఖీని విద్యార్థులు కోరుతున్నారు.", "వచ్చే ఏడాది గ్రంథాలయ కొనుగోలు బడ్జెట్ వివరాలను సంస్థ కోరుతోంది."],
    bn: ["প্রতিষ্ঠান এই পাঠক্রমের ছাত্রদের থেকে অতিরিক্ত ভর্তি ফি নিয়েছে।", "ছাত্ররা একই পাঠক্রম ও ভর্তি পর্বের ফি রসিদ যাচাই চাইছে।", "প্রতিষ্ঠান আগামী বছরের গ্রন্থাগারের কেনাকাটার বাজেট সম্পর্কে তথ্য চাইছে।"],
    kn: ["ಈ ಕೋರ್ಸಿನ ವಿದ್ಯಾರ್ಥಿಗಳಿಂದ ಸಂಸ್ಥೆಯು ಹೆಚ್ಚುವರಿ ಪ್ರವೇಶ ಶುಲ್ಕವನ್ನು ಸಂಗ್ರಹಿಸಿದೆ.", "ಅದೇ ಕೋರ್ಸ್ ಮತ್ತು ಪ್ರವೇಶ ಸುತ್ತಿನ ಶುಲ್ಕ ರಸೀದಿಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ವಿದ್ಯಾರ್ಥಿಗಳು ಕೋರಿದ್ದಾರೆ.", "ಮುಂದಿನ ವರ್ಷದ ಗ್ರಂಥಾಲಯ ಖರೀದಿ ಬಜೆಟ್ ಮಾಹಿತಿಯನ್ನು ಸಂಸ್ಥೆ ಕೇಳುತ್ತಿದೆ."],
    mixed: ["Students से इस programme के लिए extra admission fee ली गई।", "उसी admission round की fee receipts का verification चाहिए।", "Next year की library purchase budget information चाहिए।"] },
  { category: "Withholding of Certificates & Documents", relatedCategory: "Harassment & Grievance Redressal Failure", en: ["Original certificates have not been returned after students completed this programme.", "The same students request verification of their completed clearance records before release of the certificates.", "The institution asks about the cataloguing of new library books."],
    hi: ["पाठ्यक्रम पूरा होने के बाद भी छात्रों के मूल प्रमाणपत्र वापस नहीं किए गए।", "उन्हीं छात्रों ने प्रमाणपत्र जारी होने से पहले पूरी हुई निकासी प्रक्रिया के रिकॉर्ड की जाँच माँगी है।", "संस्थान पुस्तकालय की नई पुस्तकों की सूची बनाने की जानकारी चाहता है।"],
    gu: ["અભ્યાસક્રમ પૂર્ણ થયા પછી પણ વિદ્યાર્થીઓના મૂળ પ્રમાણપત્રો પરત કરાયા નથી.", "એ જ વિદ્યાર્થીઓએ પ્રમાણપત્રો છોડતા પહેલાં પૂર્ણ થયેલી મંજૂરી પ્રક્રિયાના રેકોર્ડની તપાસ માંગી છે.", "સંસ્થા પુસ્તકાલયના નવા પુસ્તકોની સૂચિ બનાવવા વિશે પૂછે છે."],
    ta: ["படிப்பை முடித்த பின்னரும் மாணவர்களின் அசல் சான்றிதழ்கள் திருப்பித் தரப்படவில்லை.", "அதே மாணவர்கள் சான்றிதழ் வழங்குவதற்கு முன் முடிக்கப்பட்ட அனுமதிப் பதிவுகளைச் சரிபார்க்கக் கோருகின்றனர்.", "புதிய நூலகப் புத்தகங்களைப் பட்டியலிடுவது பற்றி நிறுவனம் கேட்கிறது."],
    te: ["కోర్సు పూర్తయినా విద్యార్థుల అసలు ధ్రువపత్రాలు తిరిగి ఇవ్వలేదు.", "అదే విద్యార్థులు ధ్రువపత్రాల విడుదలకు ముందు పూర్తయిన అనుమతి ప్రక్రియ రికార్డుల తనిఖీ కోరుతున్నారు.", "కొత్త గ్రంథాలయ పుస్తకాల జాబితా తయారీ గురించి సంస్థ అడుగుతోంది."],
    bn: ["পাঠক্রম শেষ হওয়ার পরেও ছাত্রদের মূল শংসাপত্র ফেরত দেওয়া হয়নি।", "একই ছাত্ররা শংসাপত্র ছাড়ার আগে সম্পূর্ণ ছাড়পত্রের নথি যাচাই চাইছে।", "প্রতিষ্ঠান নতুন গ্রন্থাগারের বইয়ের তালিকা তৈরি সম্পর্কে জানতে চাইছে।"],
    kn: ["ಕೋರ್ಸ್ ಪೂರ್ಣಗೊಂಡರೂ ವಿದ್ಯಾರ್ಥಿಗಳ ಮೂಲ ಪ್ರಮಾಣಪತ್ರಗಳನ್ನು ಹಿಂದಿರುಗಿಸಿಲ್ಲ.", "ಅದೇ ವಿದ್ಯಾರ್ಥಿಗಳು ಪ್ರಮಾಣಪತ್ರ ಬಿಡುಗಡೆಗೆ ಮುನ್ನ ಪೂರ್ಣಗೊಂಡ ಅನುಮತಿ ದಾಖಲೆಗಳ ಪರಿಶೀಲನೆ ಕೋರಿದ್ದಾರೆ.", "ಹೊಸ ಗ್ರಂಥಾಲಯ ಪುಸ್ತಕಗಳ ಪಟ್ಟಿ ಮಾಡುವ ಬಗ್ಗೆ ಸಂಸ್ಥೆ ಕೇಳುತ್ತಿದೆ."],
    mixed: ["Course complete होने पर भी original certificates वापस नहीं मिले।", "उन्हीं students के clearance records की verification चाहिए।", "New library books की cataloguing information चाहिए।"] },
  { category: "Infrastructure & Lab Deficiencies", relatedCategory: "Approval Norms Violation", en: ["Required equipment is missing from the laboratory used by this programme's current students.", "An inspection request asks which laboratory equipment records were supplied for the same programme and period.", "A separate request asks about the institution's sports-day invitation design."],
    hi: ["इस पाठ्यक्रम के वर्तमान छात्रों की प्रयोगशाला में आवश्यक उपकरण उपलब्ध नहीं हैं।", "निरीक्षण अनुरोध में उसी पाठ्यक्रम और अवधि के प्रयोगशाला उपकरण रिकॉर्ड की जाँच माँगी गई है।", "एक अलग अनुरोध संस्थान के खेल दिवस के निमंत्रण के डिज़ाइन के बारे में है।"],
    gu: ["આ અભ્યાસક્રમના વર્તમાન વિદ્યાર્થીઓની પ્રયોગશાળામાં જરૂરી સાધનો નથી.", "નિરીક્ષણ વિનંતીમાં એ જ અભ્યાસક્રમ અને સમયના પ્રયોગશાળા સાધનોના રેકોર્ડની તપાસ માંગી છે.", "અલગ વિનંતી સંસ્થાના રમત દિવસના આમંત્રણની રચના વિશે છે."],
    ta: ["இந்தப் படிப்பின் தற்போதைய மாணவர்கள் பயன்படுத்தும் ஆய்வகத்தில் தேவையான உபகரணங்கள் இல்லை.", "அதே படிப்பு மற்றும் காலத்திற்கான ஆய்வக உபகரணப் பதிவுகளை ஆய்வு கோரிக்கை கேட்கிறது.", "தனியான கோரிக்கை நிறுவனத்தின் விளையாட்டு நாள் அழைப்பிதழ் வடிவமைப்பைப் பற்றியது."],
    te: ["ఈ కోర్సు ప్రస్తుత విద్యార్థులు ఉపయోగించే ప్రయోగశాలలో అవసరమైన పరికరాలు లేవు.", "అదే కోర్సు మరియు కాలానికి సంబంధించిన ప్రయోగశాల పరికరాల రికార్డులను తనిఖీ అభ్యర్థన కోరుతోంది.", "వేరొక అభ్యర్థన సంస్థ క్రీడా దినోత్సవ ఆహ్వాన పత్ర రూపకల్పన గురించి ఉంది."],
    bn: ["এই পাঠক্রমের বর্তমান ছাত্রদের পরীক্ষাগারে প্রয়োজনীয় সরঞ্জাম নেই।", "পরিদর্শনের অনুরোধে একই পাঠক্রম ও সময়ের পরীক্ষাগারের সরঞ্জামের নথি চাওয়া হয়েছে।", "একটি আলাদা অনুরোধ প্রতিষ্ঠানের ক্রীড়া দিবসের আমন্ত্রণের নকশা সম্পর্কে।"],
    kn: ["ಈ ಕೋರ್ಸಿನ ಪ್ರಸ್ತುತ ವಿದ್ಯಾರ್ಥಿಗಳು ಬಳಸುವ ಪ್ರಯೋಗಶಾಲೆಯಲ್ಲಿ ಅಗತ್ಯ ಉಪಕರಣಗಳಿಲ್ಲ.", "ಅದೇ ಕೋರ್ಸ್ ಮತ್ತು ಅವಧಿಯ ಪ್ರಯೋಗಶಾಲಾ ಉಪಕರಣ ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲನಾ ವಿನಂತಿ ಕೇಳುತ್ತದೆ.", "ಬೇರೊಂದು ವಿನಂತಿಯು ಸಂಸ್ಥೆಯ ಕ್ರೀಡಾ ದಿನದ ಆಹ್ವಾನ ವಿನ್ಯಾಸದ ಬಗ್ಗೆ ಇದೆ."],
    mixed: ["इस programme की laboratory में required equipment missing है।", "उसी period के lab equipment records की inspection चाहिए।", "Separate request sports-day invitation design के बारे में है।"] },
  { category: "Faculty Shortage / Irregularities", relatedCategory: "Approval Norms Violation", en: ["Students report a shortage of qualified teachers for this programme during the current teaching period.", "A related verification request asks for the faculty appointment records for the same programme and teaching period.", "A separate request asks for the next holiday cultural-event timetable."],
    hi: ["छात्र वर्तमान शिक्षण अवधि में इस पाठ्यक्रम के योग्य शिक्षकों की कमी बताते हैं।", "संबंधित जाँच अनुरोध उसी पाठ्यक्रम और अवधि के शिक्षक नियुक्ति रिकॉर्ड माँगता है।", "अलग अनुरोध अगले अवकाश के सांस्कृतिक कार्यक्रम की समय-सारणी के लिए है।"],
    gu: ["વિદ્યાર્થીઓ હાલના શિક્ષણ સમયગાળામાં આ અભ્યાસક્રમના લાયક શિક્ષકોની અછત જણાવે છે.", "સંબંધિત તપાસ વિનંતી એ જ અભ્યાસક્રમ અને સમયના શિક્ષક નિમણૂકના રેકોર્ડ માંગે છે.", "અલગ વિનંતી આગામી રજાના સાંસ્કૃતિક કાર્યક્રમના સમયપત્રક માટે છે."],
    ta: ["நடப்பு கற்பித்தல் காலத்தில் இந்தப் படிப்பிற்குத் தகுதியான ஆசிரியர்கள் குறைவாக இருப்பதாக மாணவர்கள் தெரிவிக்கின்றனர்.", "தொடர்புடைய சரிபார்ப்புக் கோரிக்கை அதே படிப்பு மற்றும் காலத்திற்கான ஆசிரியர் நியமனப் பதிவுகளைக் கேட்கிறது.", "தனியான கோரிக்கை அடுத்த விடுமுறைக் கலை நிகழ்ச்சியின் நேர அட்டவணையைக் கேட்கிறது."],
    te: ["ప్రస్తుత బోధన కాలంలో ఈ కోర్సుకు అర్హతగల అధ్యాపకుల కొరత ఉందని విద్యార్థులు తెలిపారు.", "సంబంధిత తనిఖీ అభ్యర్థన అదే కోర్సు మరియు కాలానికి సంబంధించిన అధ్యాపక నియామక రికార్డులను కోరుతోంది.", "వేరొక అభ్యర్థన వచ్చే సెలవు సాంస్కృతిక కార్యక్రమ సమయ పట్టికను కోరుతోంది."],
    bn: ["ছাত্ররা বর্তমান শিক্ষণ পর্বে এই পাঠক্রমের যোগ্য শিক্ষকের ঘাটতির কথা জানায়।", "সম্পর্কিত যাচাইয়ের অনুরোধে একই পাঠক্রম ও সময়ের শিক্ষক নিয়োগের নথি চাওয়া হয়েছে।", "একটি আলাদা অনুরোধ আগামী ছুটির সাংস্কৃতিক অনুষ্ঠানের সময়সূচির জন্য।"],
    kn: ["ಪ್ರಸ್ತುತ ಬೋಧನಾ ಅವಧಿಯಲ್ಲಿ ಈ ಕೋರ್ಸಿಗೆ ಅರ್ಹ ಶಿಕ್ಷಕರ ಕೊರತೆಯನ್ನು ವಿದ್ಯಾರ್ಥಿಗಳು ತಿಳಿಸಿದ್ದಾರೆ.", "ಸಂಬಂಧಿತ ಪರಿಶೀಲನಾ ವಿನಂತಿಯು ಅದೇ ಕೋರ್ಸ್ ಮತ್ತು ಅವಧಿಯ ಶಿಕ್ಷಕರ ನೇಮಕಾತಿ ದಾಖಲೆಗಳನ್ನು ಕೇಳುತ್ತದೆ.", "ಬೇರೊಂದು ವಿನಂತಿಯು ಮುಂದಿನ ರಜೆಯ ಸಾಂಸ್ಕೃತಿಕ ಕಾರ್ಯಕ್ರಮದ ವೇಳಾಪಟ್ಟಿಯನ್ನು ಕೇಳುತ್ತದೆ."],
    mixed: ["Current teaching period में qualified faculty की shortage है।", "उसी programme और period के faculty appointment records चाहिए।", "Separate request next holiday cultural-event timetable के लिए है।"] }
];

const cases: any[] = [], pairs: any[] = [];
for (let index = 0; index < 28; index++) {
  const family = `EVAL-${String(index + 1).padStart(3, "0")}`, language = languages[index % languages.length];
  const theme = themes[(index + Math.floor(index / 4)) % themes.length], translated = (theme as any)[language] as string[];
  const split = index < 20 ? "tuning" : "heldout", institutionId = `SYNTHETIC-INSTITUTION-${index + 1}`;
  const date = `2025-${String(index % 12 + 1).padStart(2, "0")}-10`, programme = `SYNTHETIC-PROGRAMME-${index + 1}`;
  const suffix = ` [${family} | ${date} | ${programme}]`;
  const makeCase = (variant: string, description: string, lang: string, overrides = {}) => ({ id: family + "-" + variant, familyId: family + (variant === "D" ? "-independent" : "-core"), institutionId, institutionName: `Synthetic Institution ${index + 1}`, aictePermanentId: institutionId, language: lang,
    category: theme.category, title: "", description: description + suffix, receivedDate: date, currentBureauId: variant === "A" ? "RB" : "PGRC", receivingBureauId: variant === "A" ? "RB" : "PGRC", status: "Under Process", priority: "Medium", expectedDisposalDate: "2099-01-01", hasOverlapAlert: false, createdAt: date + "T00:00:00.000Z", updatedAt: date + "T00:00:00.000Z",
    metadata: { recordKind: "complaint", caseTypeId: "grievance", sourceChannelId: variant === "A" ? "portal" : "letter", externalReference: family + "-SOURCE", normalizedExternalReference: family + "-SOURCE", sourceReceivedDate: date, programme, provenance: { method: "manual_intake", enteredBy: "synthetic-evaluation", enteredAt: date + "T00:00:00.000Z", configurationVersion: 1 } }, ...overrides });
  const a = makeCase("A", theme.en[0], "en"), b = makeCase("B", translated[0], language);
  const c = makeCase("C", translated[1], language, { category: theme.relatedCategory });
  c.metadata.externalReference = family + "-VERIFY"; c.metadata.normalizedExternalReference = c.metadata.externalReference;
  let d = makeCase("D", translated[2], language, { category: "Infrastructure & Lab Deficiencies" });
  let negativeRationale = "Same institution but an independent administrative subject, despite shared period/programme wording.";
  if (index % 3 === 0) { d = makeCase("D", translated[0], language, { institutionId: institutionId + "-OTHER", institutionName: "Other synthetic institution", aictePermanentId: institutionId + "-OTHER" }); negativeRationale = "Similar complaint wording at a different institution; no shared proceeding or source obligation."; }
  if (index % 3 === 1) { d = makeCase("D", translated[0], language, { receivedDate: "2023-01-10", status: "Disposed", disposalDate: "2023-03-01", createdAt: "2023-01-10T00:00:00.000Z", updatedAt: "2023-03-01T00:00:00.000Z" }); d.metadata.sourceReceivedDate = "2023-01-10"; d.metadata.programme = programme + "-OLD-COHORT"; d.description = translated[0] + ` [${family}-OLD | 2023-01-10 | ${programme}-OLD-COHORT]`; negativeRationale = "Similar issue at the same institution in a completed, separate 2023 cohort; no common transaction or pending obligation."; }
  d.metadata.externalReference = family + "-INDEPENDENT"; d.metadata.normalizedExternalReference = d.metadata.externalReference;
  cases.push(a, b, c, d);
  for (const [variant, candidate, label, rationale] of [
    ["duplicate", b, "duplicate", "Same synthetic incident, institution, programme, period and source transaction reported through two channels."],
    ["related", c, "related", "A distinct verification proceeding concerns the same programme/event/period and supporting records; coordination is proposed, not duplication."],
    ["unrelated", d, "unrelated", negativeRationale]
  ] as const) pairs.push({ id: `${family}-${variant}`, groupId: family, caseFamilyIds: [...new Set([a.familyId, candidate.familyId])], split, caseA: a.id, caseB: candidate.id, label, rationale, labelReviewStatus: "draft_not_independently_reviewed" });
}
const dataset = { version: "synthetic-overlap-v1", createdBy: "synthetic fixture generator", description: "84 draft-labeled pairs in 28 disjoint family groups. No operational records, official findings, statutory rules or approved translations.", smokeFamiliesExcluded: ["smoke-only-salary-not-in-tuning-or-heldout"], splitRule: "First 20 family groups are tuning; final 8 held out. Labels/splits fixed before any evaluation. No held-out tuning.", cases, pairs };
const output = fileURLToPath(new URL("./fixtures/overlap-pairs.json", import.meta.url)), content = JSON.stringify(dataset, null, 2) + "\n";
if (fs.existsSync(output) && fs.readFileSync(output, "utf8") !== content) throw new Error("Existing labels/splits differ. Preserve the measured dataset and create an explicitly versioned replacement; do not silently regenerate held-out data.");
fs.mkdirSync(fileURLToPath(new URL("./fixtures/", import.meta.url)), { recursive: true }); fs.writeFileSync(output, content);
console.log(JSON.stringify({ output, cases: cases.length, pairs: pairs.length, tuning: pairs.filter(pair => pair.split === "tuning").length, heldout: pairs.filter(pair => pair.split === "heldout").length, labels: "unreviewed synthetic drafts" }));
