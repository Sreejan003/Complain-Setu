import reviews from "./reviews.json";

export interface LanguageDefinition {
  code: string;
  englishName: string;
  nativeName: string;
  script: string;
  dir: "ltr" | "rtl";
  font: string;
  intlLocale: string;
  review: "source" | "draft" | "approved";
  scriptVariants?: string[];
}
const definition = (code:string,englishName:string,nativeName:string,script:string,font:string,intlLocale=code,dir:"ltr"|"rtl"="ltr",scriptVariants?:string[]):LanguageDefinition => ({code,englishName,nativeName,script,font,intlLocale,dir,review:code==="en"?"source":"draft",scriptVariants});
/** Add a locale and reviewed resources here; pages never enumerate languages. */
export const languages: LanguageDefinition[] = [
  definition("en","English","English","Latn","Inter","en-IN"),
  definition("hi","Hindi","हिन्दी","Deva","Noto Sans Devanagari","hi-IN"),
  definition("mr","Marathi","मराठी","Deva","Noto Sans Devanagari","mr-IN"),
  definition("gu","Gujarati","ગુજરાતી","Gujr","Noto Sans Gujarati","gu-IN"),
  definition("ta","Tamil","தமிழ்","Taml","Noto Sans Tamil","ta-IN"),
  definition("te","Telugu","తెలుగు","Telu","Noto Sans Telugu","te-IN"),
  definition("bn","Bengali","বাংলা","Beng","Noto Sans Bengali","bn-IN"),
  definition("kn","Kannada","ಕನ್ನಡ","Knda","Noto Sans Kannada","kn-IN"),
  definition("ml","Malayalam","മലയാളം","Mlym","Noto Sans Malayalam","ml-IN"),
  definition("pa","Punjabi","ਪੰਜਾਬੀ","Guru","Noto Sans Gurmukhi","pa-IN","ltr",["pa-Guru","pa-Arab"]),
  definition("or","Odia","ଓଡ଼ିଆ","Orya","Noto Sans Oriya","or-IN"),
  definition("as","Assamese","অসমীয়া","Beng","Noto Sans Bengali","as-IN"),
  definition("ur","Urdu","اردو","Arab","Noto Naskh Arabic","ur-IN","rtl"),
  definition("ne","Nepali","नेपाली","Deva","Noto Sans Devanagari","ne-IN"),
  definition("sa","Sanskrit","संस्कृतम्","Deva","Noto Sans Devanagari","sa-IN"),
  definition("mai","Maithili","मैथिली","Deva","Noto Sans Devanagari","mai-IN"),
  definition("kok","Konkani","कोंकणी","Deva","Noto Sans Devanagari","kok-IN","ltr",["kok-Deva","kok-Latn"]),
  definition("doi","Dogri","डोगरी","Deva","Noto Sans Devanagari","doi-IN"),
  definition("brx","Bodo","बड़ो","Deva","Noto Sans Devanagari","brx-IN"),
  definition("mni-Mtei","Manipuri","ꯃꯤꯇꯩꯂꯣꯟ","Mtei","Noto Sans Meetei Mayek","en-IN","ltr",["mni-Mtei","mni-Beng"]),
  definition("sat-Olck","Santali","ᱥᱟᱱᱛᱟᱲᱤ","Olck","Noto Sans Ol Chiki","en-IN","ltr",["sat-Olck","sat-Deva","sat-Beng"]),
  definition("ks-Arab","Kashmiri","کٲشُر","Arab","Noto Naskh Arabic","ks-Arab-IN","rtl",["ks-Arab","ks-Deva"]),
  definition("sd-Arab","Sindhi","سنڌي","Arab","Noto Naskh Arabic","sd-Arab-IN","rtl",["sd-Arab","sd-Deva"])
];
export const namespaces=["common","navigation","dashboard","complaints","workflow","overlaps","reports","administration","notifications","validation"] as const;
/** Approval requires a recorded native review, full coverage, and an explicit reference. */
export const isProductionEnabled = (l:LanguageDefinition) => {
  const review=reviews[l.code as keyof typeof reviews];
  return l.code==="en" || (review?.status==="approved" && review.nativeReviewComplete && !!review.approvalReference && "coverageComplete" in review && review.coverageComplete===true);
};
export function findLanguage(input:string): LanguageDefinition | undefined {
  const exact=languages.find(l=>l.code.toLowerCase()===input.toLowerCase());
  if(exact)return exact;
  // Do not silently substitute a different script for an explicitly requested variant.
  const requested=new Intl.Locale(input);
  return languages.find(l=>new Intl.Locale(l.code).language===requested.language && (!requested.script || requested.script===l.script));
}
