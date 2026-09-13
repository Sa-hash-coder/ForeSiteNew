/**
 * ForeSite - Industrial Safety Dynamic English-to-Hindi Translator
 * Automatically converts report titles, descriptions, alert messages,
 * SIF precursors, and plant locations to fluent Hindi when lang === 'hi'.
 */

export type Language = "en" | "hi";

// ─── Known Exact Incident Titles ───────────────────────────────────────────
const TITLE_MAP: Record<string, string> = {
  "exposed live wiring in mcc room": "एमसीसी कक्ष में खुली लाइव वायरिंग",
  "the wiring is open near the water pool.": "पानी के कुंड के पास खुली वायरिंग व नंगे तार",
  "the wiring is open near the water pool": "पानी के कुंड के पास खुली वायरिंग व नंगे तार",
  "exposed electrical wiring near storage area at electrical panel room": "इलेक्ट्रिकल पैनल कक्ष में स्टोरेज एरिया के पास खुली वायरिंग",
  "loose scaffolding planks at unit 3": "यूनिट 3 पर मचान (स्कैफोल्डिंग) के ढीले तख्ते",
  "corroded flange line steam leak": "संक्षारित फ्लैंज लाइन से भाप (स्टीम) का रिसाव",
  "tk-80 scaffolding – missing handrail & perimeter barrier": "TK-80 मचान – गायब हैंडरेल व सुरक्षा रेलिंग",
  "tk-80 scaffolding - missing handrail & perimeter barrier": "TK-80 मचान – गायब हैंडरेल व सुरक्षा रेलिंग",
  "v-204 hydrocracker – radial vibration anomaly on bearing": "V-204 हाइड्रोक्रैकर – बेयरिंग में अत्यधिक कंपन विसंगति",
  "v-204 hydrocracker - radial vibration anomaly on bearing": "V-204 हाइड्रोक्रैकर – बेयरिंग में अत्यधिक कंपन विसंगति",
  "ex-12 flange line – minor oily condensation on lower joint": "EX-12 फ्लैंज लाइन – निचले जोड़ पर तैलीय रिसाव",
  "ex-12 flange line - minor oily condensation on lower joint": "EX-12 फ्लैंज लाइन – निचले जोड़ पर तैलीय रिसाव",
  "help help help.": "आपातकालीन सहायता अनुरोध - बॉयलर कक्ष",
  "help help help": "आपातकालीन सहायता अनुरोध - बॉयलर कक्ष",
  "broken scaffolding tier 3": "टियर 3 मचान के तख्ते टूटे व असुरक्षित",
  "chemical spill in acid storage room": "एसिड भंडारण कक्ष में रासायनिक रिसाव",
  "fire suppression system offline in warehouse c": "वेयरहाउस सी में अग्नि शमन प्रणाली बंद",
  "critical sif hazard: exposed live wiring in mcc room at mcc room 2": "गंभीर SIF ख़तरा: एमसीसी कक्ष 2 में खुली लाइव वायरिंग",
  "high sif hazard: exposed electrical wiring near storage area at electrical panel room": "उच्च SIF ख़तरा: इलेक्ट्रिकल पैनल कक्ष में स्टोरेज एरिया के पास खुली वायरिंग",
  "exposed electrical wiring near storage area": "स्टोरेज एरिया के पास खुली विद्युत वायरिंग",
  "exposed live wiring": "खुली लाइव वायरिंग",
  "worker field hazard report": "कार्यकर्ता फील्ड सुरक्षा रिपोर्ट",
};

// ─── Locations ─────────────────────────────────────────────────────────────
const LOCATION_MAP: Record<string, string> = {
  "mcc room 2": "एमसीसी कक्ष 2",
  "mcc room": "एमसीसी कक्ष",
  "electrical panel room": "इलेक्ट्रिकल पैनल कक्ष",
  "boiler room a": "बॉयलर कक्ष A",
  "boiler room b": "बॉयलर कक्ष B",
  "sector 4 north, tank farm": "सेक्टर 4 उत्तर, टैंक फार्म",
  "sector 4 north": "सेक्टर 4 उत्तर",
  "sector 4": "सेक्टर 4",
  "plant sector 4 north": "प्लांट सेक्टर 4 उत्तर",
  "process area 2, hydro unit": "प्रोसेस एरिया 2, हाइड्रो यूनिट",
  "cracking platform east": "क्रैकिंग प्लेटफॉर्म पूर्व",
  "sector 2 elevation deck": "सेक्टर 2 एलिवेशन डेक",
  "refinery unit alpha": "रिफाइनरी यूनिट अल्फा",
  "tank farm sector 4": "टैंक फार्म सेक्टर 4",
  "chemical storage area": "केमिकल स्टोरेज एरिया",
  "maintenance workshop": "मेंटेनेंस वर्कशॉप",
  "roof / height work area": "छत / ऊंचाई कार्य क्षेत्र",
  "water treatment plant": "वाटर ट्रीटमेंट प्लांट",
  "warehouse corridor": "वेयरहाउस मुख्य गलियारा",
  "building 5, exterior west": "बिल्डिंग 5, बाहरी पश्चिम",
  "building 3, basement": "बिल्डिंग 3, बेसमेंट",
  "warehouse c, main floor": "वेयरहाउस सी, मुख्य तल",
  "building 1, shop floor": "बिल्डिंग 1, शॉप फ्लोर",
  "plant floor": "प्लांट फ्लोर",
  "industrial facility": "औद्योगिक परिसर",
};

// ─── Word / Phrase Replacements for Dynamic Safety Text ────────────────────
const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  // Alert headers
  [/^CRITICAL SIF HAZARD:\s*/i, "गंभीर SIF ख़तरा: "],
  [/^HIGH SIF HAZARD:\s*/i, "उच्च SIF ख़तरा: "],
  [/^MEDIUM SIF HAZARD:\s*/i, "मध्यम SIF ख़तरा: "],
  [/^LOW SIF HAZARD:\s*/i, "सामान्य सुरक्षा सूचना: "],
  [/^CRITICAL SIF PRECURSOR:\s*/i, "गंभीर SIF पूर्वसूचक: "],
  [/^HIGH RISK TELEMETRY:\s*/i, "उच्च जोखिम टेलीमेट्री: "],

  // Specific common phrases
  [/Exposed live wiring in MCC Room at MCC Room 2/gi, "एमसीसी कक्ष 2 में नंगे तार व खुली लाइव वायरिंग"],
  [/Exposed live wiring in MCC Room/gi, "एमसीसी कक्ष में खुली लाइव वायरिंग"],
  [/The wiring is open near the water pool\.?/gi, "पानी के कुंड के पास खुली वायरिंग व नंगे तार मिले।"],
  [/Exposed electrical wiring near storage area at Electrical Panel Room/gi, "इलेक्ट्रिकल पैनल कक्ष स्टोरेज एरिया के पास खुली वायरिंग"],
  [/Loose scaffolding planks at Unit 3/gi, "यूनिट 3 पर मचान के ढीले तख्ते"],
  [/Corroded flange line steam leak/gi, "संक्षारित फ्लैंज लाइन से भाप का रिसाव"],
  [/High risk safety precursor active\.?/gi, "सक्रिय उच्च जोखिम SIF पूर्वसूचक।"],
  [/High pressure steam leak observed on flange line TK-80/gi, "फ्लैंज लाइन TK-80 पर उच्च दबाव भाप का रिसाव देखा गया"],
  [/Fire and burn risk\.?/gi, "आग व जलने का गंभीर जोखिम।"],
  [/Radial vibration anomaly on bearing/gi, "बेयरिंग पर अत्यधिक रेडियल कंपन विसंगति"],
  [/Minor oily condensation on lower joint/gi, "निचले जोड़ पर हल्का तैलीय रिसाव"],
  [/Bare 480V copper conductors hanging near wet conduit/gi, "गीले पाइप के पास 480V नंगे तांबे के तार लटक रहे हैं"],
  [/Working at height without certified perimeter guardrail/gi, "प्रमाणित सुरक्षा गार्डरेल के बिना ऊंचाई पर कार्य"],
  [/Missing handrail & perimeter barrier/gi, "हैंडरेल व सुरक्षा रेलिंग गायब"],
  [/Help help help\.?/gi, "आपातकालीन सहायता अनुरोध - तुरंत सुरक्षा दल भेजें।"],

  // Precursor & Hazard terms
  [/Working at Height Exposure|Working at Height Without Protection/gi, "ऊंचाई पर बिना सुरक्षा कार्य"],
  [/Missing Fall Restraint Barrier/gi, "गिरावट सुरक्षा बैरियर गायब"],
  [/Unsecured or Damaged Scaffolding/gi, "असुरक्षित या क्षतिग्रस्त मचान"],
  [/Energized Equipment Exposure/gi, "सक्रिय विद्युत उपकरण संपर्क"],
  [/Proximity to Electrical Hazard/gi, "विद्युत खतरे के निकटता"],
  [/Uncontrolled Stored Energy Release/gi, "अनियंत्रित संचित ऊर्जा रिसाव"],
  [/Corroded Pressure Piping/gi, "संक्षारित दबाव पाइपिंग"],
  [/Rotating Parts and Nip Point Exposure/gi, "घूमते पुर्जे व पिंच पॉइंट संपर्क"],
  [/Mechanical Component Degradation/gi, "यांत्रिक घटकों की खराबी"],
  [/Fluid Pressure Anomaly/gi, "तरल दबाव असामान्यता"],
  [/Thermal Energy Release Hazard/gi, "तापीय ऊर्जा रिसाव ख़तरा"],
  [/Uncontrolled Steam Boiler Pressure/gi, "अनियंत्रित भाप बॉयलर दबाव"],
  [/Operational Hazard/gi, "परिचालन ख़तरा"],
  [/Fall from Elevation/gi, "ऊंचाई से गिरना"],
  [/Fatal Traumatic Impact/gi, "घातक चोट का ख़तरा"],
  [/Steam Scalding/gi, "भाप से झुलसना"],
  [/Pressure Vessel Failure/gi, "प्रेशर वेसल खराबी"],

  // Domain terms
  [/\bscaffolding\b/gi, "मचान (स्कैफोल्डिंग)"],
  [/\bscaffold\b/gi, "मचान"],
  [/\blive wiring\b/gi, "खुली लाइव वायरिंग"],
  [/\bwiring\b/gi, "वायरिंग"],
  [/\bwire\b/gi, "तार"],
  [/\bexposed\b/gi, "खुला"],
  [/\bconduit\b/gi, "कंड्यूट पाइप"],
  [/\bbreaker\b/gi, "सर्किट ब्रेकर"],
  [/\bsteam leak\b/gi, "भाप रिसाव"],
  [/\bsteam\b/gi, "भाप"],
  [/\bboiler\b/gi, "बॉयलर"],
  [/\bflange\b/gi, "फ्लैंज"],
  [/\bgasket\b/gi, "गास्केट"],
  [/\bpressure\b/gi, "दबाव"],
  [/\bvibration\b/gi, "कंपन"],
  [/\bbearing\b/gi, "बेयरिंग"],
  [/\bhydrocracker\b/gi, "हाइड्रोक्रैकर"],
  [/\bchemical spill\b/gi, "रासायनिक रिसाव"],
  [/\bchemical\b/gi, "रासायनिक"],
  [/\belectrical\b/gi, "विद्युत"],
  [/\belectric\b/gi, "विद्युत"],
  [/\bstorage area\b/gi, "भंडारण क्षेत्र"],
  [/\bpanel room\b/gi, "पैनल कक्ष"],
  [/\bwater pool\b/gi, "पानी का कुंड"],
  [/\bwater pump\b/gi, "पानी पंप"],
  [/\bwater\b/gi, "पानी"],
  [/\bhandrail\b/gi, "हैंडरेल"],
  [/\bguardrail\b/gi, "सुरक्षा रेलिंग"],
  [/\bplanks\b/gi, "तख्ते"],
  [/\bplank\b/gi, "तख्ता"],
  [/\bharness\b/gi, "सेफ्टी हार्नेस"],
  [/\bdepressurize\b/gi, "दबाव कम करें"],
  [/\bde-energize\b/gi, "बिजली बंद करें"],
  [/\blockout\b|\bloto\b/gi, "LOTO (लॉकआउट-टैगआउट)"],
  [/\binspection\b/gi, "निरीक्षण"],
  [/\bmaintenance\b/gi, "मेंटेनेंस"],
  [/\bcrew\b/gi, "कार्य दल"],
  [/\bdispatched\b/gi, "भेजा गया"],
  [/\breview\b/gi, "समीक्षा"],
  [/\bcleared\b/gi, "सुरक्षित घोषित"],
  [/\bnear storage area\b/gi, "स्टोरेज एरिया के पास"],
  [/\bnear\b/gi, "के पास"],
  [/\bat\b/gi, "पर"],
];

/**
 * Translates plant locations into natural Hindi
 */
export function translateLocation(loc?: string, lang: Language = "hi"): string {
  if (!loc || lang === "en") return loc || "";
  const key = loc.trim().toLowerCase();
  if (LOCATION_MAP[key]) return LOCATION_MAP[key];

  for (const [enKey, hiVal] of Object.entries(LOCATION_MAP)) {
    if (key.includes(enKey)) {
      return loc.replace(new RegExp(enKey, "i"), hiVal);
    }
  }

  return loc
    .replace(/\bRoom\b/gi, "कक्ष")
    .replace(/\bBuilding\b/gi, "बिल्डिंग")
    .replace(/\bSector\b/gi, "सेक्टर")
    .replace(/\bUnit\b/gi, "यूनिट")
    .replace(/\bArea\b/gi, "क्षेत्र")
    .replace(/\bDeck\b/gi, "डेक")
    .replace(/\bFloor\b/gi, "तल");
}

/**
 * Translates incident titles, descriptions, alert messages, and recommendations
 */
export function translateSafetyText(text?: string, lang: Language = "hi"): string {
  if (!text || lang === "en") return text || "";

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct title mapping
  if (TITLE_MAP[lower]) {
    return TITLE_MAP[lower];
  }

  // 2. Alert message pattern with location: 'CRITICAL SIF HAZARD: <title> at <location>'
  const alertMatch = trimmed.match(/^(CRITICAL|HIGH|MEDIUM|LOW)\s+SIF\s+HAZARD:\s*(.+?)\s+at\s+(.+)$/i);
  if (alertMatch) {
    const levelStr = alertMatch[1].toUpperCase();
    const hazardTitle = alertMatch[2];
    const loc = alertMatch[3];
    const levelHi = levelStr === "CRITICAL" ? "गंभीर SIF ख़तरा" : levelStr === "HIGH" ? "उच्च SIF ख़तरा" : "मध्यम SIF ख़तरा";
    const titleHi = translateSafetyText(hazardTitle, "hi");
    const locHi = translateLocation(loc, "hi");
    return `${levelHi}: ${locHi} में ${titleHi}`;
  }

  // 3. Fallback phrase replacements
  let translated = trimmed;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  return translated;
}
