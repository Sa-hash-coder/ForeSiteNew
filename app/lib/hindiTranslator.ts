/**
 * ForeSite - Comprehensive Industrial Safety English-to-Hindi Translator
 * Converts all dynamic incident titles, descriptions, recommendations,
 * categories, locations, statuses, and crews into natural Hindi when lang === 'hi'.
 */

export type Language = "en" | "hi";

// ─── 1. Exact Incident Titles ────────────────────────────────────────────────
const TITLE_MAP: Record<string, string> = {
  // Real DB / User reported titles
  "stair is broken in maintenance room": "मेंटेनेंस वर्कशॉप में टूटी सीढ़ी",
  "the stair is broken in maintenance room": "मेंटेनेंस वर्कशॉप में टूटी सीढ़ी",
  "exposed live wiring in mcc room": "एमसीसी कक्ष में खुली लाइव वायरिंग",
  "the wiring is open near the water pool.": "पानी के कुंड के पास खुली वायरिंग व नंगे तार",
  "the wiring is open near the water pool": "पानी के कुंड के पास खुली वायरिंग व नंगे तार",
  "exposed electrical wiring near water pump": "पानी के पंप के पास बिजली का खुला तार",
  "exposed electrical wiring near storage area at electrical panel room": "इलेक्ट्रिकल पैनल कक्ष में स्टोरेज एरिया के पास खुली वायरिंग",
  "exposed electrical wiring near storage area": "स्टोरेज एरिया के पास खुली विद्युत वायरिंग",
  "exposed live wiring": "खुली लाइव वायरिंग",
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
  "worker not wearing harness on elevated platform": "ऊंचाई पर बिना सेफ्टी बेल्ट (हार्नेस) काम",
  "chemical leak detected near storage tanks": "केमिकल टैंक के पास पीले तरल का रिसाव",
  "forklift operating in pedestrian zone without barriers": "पैदल रास्ते में बिना बैरिकेड के फोर्कलिफ्ट",
  "wet floor near staircase without warning signs": "सीढ़ियों के पास पानी का फिसलन भरा फर्श",
  "broken scaffolding tier 3": "टियर 3 मचान के तख्ते टूटे व असुरक्षित",
  "chemical spill in acid storage room": "एसिड भंडारण कक्ष में रासायनिक रिसाव",
  "fire suppression system offline in warehouse c": "वेयरहाउस सी में अग्नि शमन प्रणाली बंद",
  "cnc machine guard removed on shop floor": "शॉप फ्लोर पर सीएनसी मशीन सुरक्षा गार्ड हटा हुआ",
  "worker field hazard report": "कार्यकर्ता फील्ड सुरक्षा रिपोर्ट",
};

// ─── 2. Locations ─────────────────────────────────────────────────────────────
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
  "loading bay": "लोडिंग बे",
  "control room": "कंट्रोल रूम",
  "block d, ground floor": "ब्लॉक D, ग्राउंड फ्लोर",
  "building c, level 3": "बिल्डिंग C, लेवल 3",
  "main warehouse corridor": "मुख्य वेयरहाउस गलियारा",
};

// ─── 3. Recommendations & Engineering Actions ─────────────────────────────────
const RECOMMENDATION_MAP: Record<string, string> = {
  "deploy portable high-output led work lights to restore safe illumination levels immediately.":
    "सुरक्षित रोशनी स्तर तुरंत बहाल करने के लिए पोर्टेबल हाई-आउटपुट एलईडी वर्क लाइट्स लगाएं।",
  "remove damaged ladder from service and destroy or tag out immediately.":
    "क्षतिग्रस्त सीढ़ी को तुरंत सेवा से हटाएं और नष्ट करें या सुरक्षा टैग आउट लगाएं।",
  "replace blown fluorescent/led tubes in stairwells and primary access pathways.":
    "सीढ़ियों और प्राथमिक रास्तों में खराब फ्लोरोसेंट/एलईडी ट्यूब बदलें।",
  "isolate the electrical junction box immediately and cut power to nearby water pumps.":
    "इलेक्ट्रिकल जंक्शन बॉक्स को तुरंत अलग करें और नजदीकी पानी पंपों की बिजली काटें।",
  "immediately de-energize and lock out (loto) electrical feed at source breaker.":
    "स्रोत ब्रेकर पर तुरंत बिजली बंद (LOTO) करें और सुरक्षा लॉक लगाएं।",
  "conduct on-site supervisor inspection and log incident in daily hazard register.":
    "साइट सुपरवाइजर द्वारा निरीक्षण कराएं और दैनिक सुरक्षा रजिस्टर में दर्ज करें।",
  "verify area is cordoned off if active risk persists.":
    "यदि सक्रिय जोखिम बना रहे तो क्षेत्र की सुरक्षा घेराबंदी सत्यापित करें।",
  "schedule preventive maintenance review.":
    "निवारक मेंटेनेंस समीक्षा का समय निर्धारित करें।",
  "execute thermal isolation and verify emergency steam pressure relief venting.":
    "थर्मल आइसोलेशन करें और आपातकालीन भाप दबाव वेंटिंग सत्यापित करें।",
  "deploy certified boiler technician in level b thermal ppe to inspect safety relief valves.":
    "सुरक्षा वाल्वों के निरीक्षण हेतु लेवल B थर्मल पीपीई में प्रमाणित बॉयलर तकनीशियन भेजें।",
  "establish a 50-meter safety cordon and log shift incident report in compliance with osha 1910.261.":
    "50 मीटर का सुरक्षा घेरा बनाएं और शिफ्ट घटना रिपोर्ट दर्ज करें।",
  "red-tag scaffold as 'do not use' until re-inspected by certified competent person under osha 1926.451.":
    "सक्षम व्यक्ति द्वारा पुनः निरीक्षण होने तक मचान पर 'उपयोग न करें' का लाल टैग लगाएं।",
  "fasten all wooden planks with steel cleats and install 4-inch toe boards along work platform.":
    "लकड़ी के तख्तों को स्टील क्लैट से बांधें और प्लेटफॉर्म पर 4-इंच टो-बोर्ड लगाएं।",
  "verify structural tie-ins to permanent walls and install full diagonal cross-bracing.":
    "दीवारों से संरचनात्मक जोड़ सत्यापित करें और क्रॉस-ब्रेसिंग लगाएं।",
  "depressurize line tk-80 and verify 0 psi reading on calibrated gauges before opening couplings.":
    "कपलिंग खोलने से पहले TK-80 लाइन का दबाव शून्य (0 PSI) सत्यापित करें।",
  "deploy certified pipefitter crew in thermal protective gear to replace corroded spiral-wound gasket.":
    "संक्षारित गास्केट बदलने के लिए थर्मल सुरक्षा गियर में पाइपफिटर दल भेजें।",
  "torque flange bolts to 185 ft-lbs in star sequence and conduct ultrasonic steam leak audit.":
    "फ्लैंज बोल्ट को स्टार क्रम में 185 ft-lbs पर कसें और अल्ट्रासोनिक स्टीम लीक जांच करें।",
  "issue immediate stop-work notice on tier 3 until full-body harness 100% tie-off compliance is enforced.":
    "फुल-बॉडी हार्नेस अनुपालन होने तक टियर 3 पर काम रोकने का नोटिस जारी करें।",
  "install osha-compliant 42-inch top-rail, 21-inch mid-rail, and 4-inch toe-boards along tier 3.":
    "टियर 3 पर 42-इंच टॉप-रेल, 21-इंच मिड-रेल और 4-इंच टो-बोर्ड लगाएं।",
  "conduct daily competent-person scaffolding structural re-certification before shift commencement.":
    "शिफ्ट शुरू होने से पहले प्रतिदिन मचान का संरचनात्मक प्रमाणीकरण करें।",
  "perform high-resolution fft vibration spectral analysis to identify inner raceway bearing fatigue.":
    "बेयरिंग खराबी पहचानने के लिए उच्च-रिज़ॉल्यूशन एफएफटी कंपन स्पेक्ट्रल विश्लेषण करें।",
  "drain and flush contaminated bearing lubricant reservoir, checking for metal particulate wear.":
    "दूषित लुब्रिकेंट निकालें और साफ करें, धातु कणों की जांच करें।",
  "replace worn spherical roller bearing assembly and verify dynamic shaft alignment within 0.05 mm.":
    "खराब बेयरिंग असेंबली बदलें और 0.05 मिमी के भीतर शाफ्ट संरेखण सत्यापित करें।",
  "install secondary chemical drip containment pan beneath ex-12 lower flange joint.":
    "EX-12 निचले फ्लैंज जोड़ के नीचे द्वितीयक रासायनिक रोकथाम ट्रे लगाएं।",
  "perform calibrated torque wrench verification on flange studs to oem 145 ft-lbs specification.":
    "ओईएम 145 ft-lbs विनिर्देश के अनुसार फ्लैंज स्टड को टॉर्क रिंच से सत्यापित करें।",
  "conduct ultrasonic wall thickness measurement and voc sniff test to confirm joint integrity.":
    "जोड़ की मजबूती की पुष्टि के लिए अल्ट्रासोनिक दीवार मोटाई माप और वीओसी परीक्षण करें।",
  "halt hazardous operation immediately under stop-work authority.":
    "स्टॉप-वर्क अधिकार के तहत खतरनाक कार्य तुरंत रोकें।",
  "report situation to unit supervisor and maintain safe distance.":
    "स्थिति की सूचना यूनिट सुपरवाइजर को दें और सुरक्षित दूरी बनाए रखें।",
  "red-tag scaffolding and suspend elevated work until re-certified.":
    "मचान पर लाल टैग लगाएं और पुनः प्रमाणित होने तक ऊंचाई पर काम स्थगित करें।",
  "initiate operational throttling/shutdown to prevent bearing seizure.":
    "बेयरिंग जाम होने से बचाने के लिए परिचालन गति धीमी या बंद करें।",
  "evacuate sector and deploy neutralising chemical absorbent boom kit.":
    "सेक्टर खाली कराएं और रासायनिक अवशोषक किट तैनात करें।",
  "enforce zero-energy lockout/tagout (loto) at upstream distribution breaker.":
    "अपस्ट्रीम डिस्ट्रीब्यूशन ब्रेकर पर जीरो-एनर्जी LOTO लागू करें।",
  "isolate upstream line valves and depressurize affected pipe section.":
    "अपस्ट्रीम लाइन वाल्व बंद करें और प्रभावित पाइप सेक्शन का दबाव खत्म करें।",
  "conduct frontline supervisor hazard walkthrough and isolate immediate zone.":
    "सुपरवाइजर द्वारा निरीक्षण कराएं और तत्काल क्षेत्र को अलग करें।",
  "issue stop-work notice on elevated structure until 100% harness tie-off compliance is confirmed.":
    "हार्नेस सुरक्षा सुनिश्चित होने तक संरचना पर काम रोकने का नोटिस जारी करें।",
  "red-tag scaffold access ladders as 'do not use' under osha 1926.451.":
    "मचान पहुंच सीढ़ी पर OSHA 1926.451 के तहत 'उपयोग न करें' लाल टैग लगाएं।",
  "fasten all wooden/metal planks with cleats and install 4-inch toe boards and midrails.":
    "तख्तों को क्लैट से कसें और 4-इंच टो-बोर्ड व मिड-रेल लगाएं।",
  "inspect all structural cross-bracing and anchor tie-ins to permanent walls.":
    "सभी क्रॉस-ब्रेसिंग और स्थायी दीवारों से एंकर टाई-इन की जांच करें।",
  "isolate steam feed valves immediately and verify pressure bleeder drop to 0 psi.":
    "भाप आपूर्ति वाल्व तुरंत बंद करें और दबाव 0 PSI तक कम होना सत्यापित करें।",
  "establish a 30-meter high-temperature exclusion zone with red thermal warning signage.":
    "लाल चेतावनी बोर्ड के साथ 30 मीटर का उच्च-तापमान निषेध क्षेत्र बनाएं।",
  "depressurize line to 0 psi and verify zero stored thermal energy before servicing couplings.":
    "कपलिंग सर्विस करने से पहले लाइन को 0 PSI तक डिप्रेशराइज करें।",
  "deploy certified mechanical team in level b thermal ppe to replace damaged spiral-wound gasket.":
    "क्षतिग्रस्त गास्केट बदलने के लिए लेवल B थर्मल पीपीई में मैकेनिकल टीम भेजें।",
  "torque flange studs in cross-star pattern to 185 ft-lbs and perform ultrasonic leak check.":
    "फ्लैंज स्टड्स को क्रॉस-स्टार पैटर्न में 185 ft-lbs पर कसें और अल्ट्रासोनिक लीक टेस्ट करें।",
  "de-energize circuit breaker at source and lock out with master padlock under loto protocol.":
    "स्रोत पर सर्किट ब्रेकर बंद करें और मास्टर पैडलॉक से LOTO लगाएं।",
  "barricade wet floor area and disconnect all adjacent conductive electrical equipment.":
    "गीले फर्श क्षेत्र की घेराबंदी करें और सभी विद्युत उपकरण अलग करें।",
  "lock out and tag out (loto) primary electrical feed at source panel and verify zero energy state.":
    "स्रोत पैनल पर मुख्य विद्युत आपूर्ति पर LOTO लगाएं और शून्य ऊर्जा सत्यापित करें।",
  "erect red boundary perimeter barricades with 'danger - high voltage' warning placards.":
    "'ख़तरा - हाई वोल्टेज' बोर्ड के साथ लाल सुरक्षा बैरिकेड लगाएं।",
  "replace damaged wiring with ip67-rated industrial conduit and perform megger insulation test.":
    "क्षतिग्रस्त तारों को IP67 रेटेड कंड्यूट से बदलें और मेगर इंसुलेशन टेस्ट करें।",
  "halt drive motor immediately and engage emergency stop pull-cord.":
    "ड्राइव मोटर तुरंत रोकें और आपातकालीन स्टॉप कॉर्ड खींचें।",
  "lock out drive power breaker and attach safety tag prohibiting unauthorized restart.":
    "ड्राइव पावर ब्रेकर पर ताला लगाएं और सुरक्षा टैग लगाएं।",
  "perform high-resolution fft vibration spectral analysis to identify bearing raceway degradation.":
    "बेयरिंग खराबी पहचानने के लिए उच्च-रिज़ॉल्यूशन एफएफटी कंपन स्पेक्ट्रल विश्लेषण करें।",
  "flush contaminated lubricant reservoir and install replacement spherical roller bearings.":
    "दूषित लुब्रिकेंट साफ करें और नए रोलर बेयरिंग लगाएं।",
  "verify dynamic shaft alignment within 0.05 mm tolerance before re-energizing drive.":
    "चालू करने से पहले शाफ्ट संरेखण 0.05 मिमी सहनशीलता के भीतर सत्यापित करें।",
  "evacuate affected area immediately and deploy forced-air positive ventilation blowers.":
    "प्रभावित क्षेत्र तुरंत खाली कराएं और वेंटिलेशन ब्लोअर चालू करें।",
  "don level b chemical protective suit, full-face respirator, and neoprene gloves.":
    "लेवल B केमिकल प्रोटेक्टिव सूट, रेस्पिरेटर और दस्ताने पहनें।",
  "deploy chemical spill containment kit, place neutralizing absorbent berms, and stop active leak.":
    "केमिकल स्पिल किट लगाएं, अवशोषक बैरियर लगाएं और सक्रिय रिसाव रोकें।",
  "perform 4-gas atmospheric sweep to verify zero toxic gas ppm before re-entry.":
    "पुनः प्रवेश से पहले शून्य विषैली गैस सुनिश्चित करने हेतु 4-गैस परीक्षण करें।",
  "log hazardous material manifest and replace corroded primary storage vessel.":
    "खतरनाक सामग्री विवरण दर्ज करें और संक्षारित भंडारण पात्र को बदलें।",
  "sound local sector alarm and clear all combustible materials within 35-foot perimeter.":
    "स्थानीय अलार्म बजाएं और 35-फुट दायरे से सभी ज्वलनशील सामग्री हटाएं।",
  "prohibit all hot work and verify automatic deluge/sprinkler valves are fully operational.":
    "सभी हॉट वर्क पर रोक लगाएं और स्प्रिंकलर वाल्व चालू होना सत्यापित करें।",
  "post 24-hour continuous fire watch personnel until fire suppression system is recertified.":
    "फायर सिस्टम पुनः प्रमाणित होने तक 24 घंटे फायर वॉच कर्मी तैनात रखें।",
  "inspect and replace all depressurized dry-chemical extinguishers with certified units.":
    "दबाव रहित अग्निशामक यंत्रों की जांच कर प्रमाणित यंत्रों से बदलें।",
  "audit hot work permit logs and inspect combustible storage clearances per nfpa 30.":
    "हॉट वर्क परमिट लॉग की समीक्षा करें और भंडारण सुरक्षित दूरी जांचें।",
  "dispatch field supervisor rapid-response team to physically inspect and secure the sector.":
    "सेक्टर का भौतिक निरीक्षण और सुरक्षा सुनिश्चित करने त्वरित टीम भेजें।",
  "halt operations in immediate hazard vicinity under stop-work authority.":
    "स्टॉप-वर्क अधिकार के तहत तत्काल खतरे वाले क्षेत्र में कार्य रोकें।",
  "conduct comprehensive physical walkdown inspection with area supervisor to determine root hazard.":
    "मूल खतरे का पता लगाने क्षेत्र सुपरवाइजर के साथ व्यापक वॉकडाउन निरीक्षण करें।",
  "verify that all safety clearances, loto locks, and perimeter guards are intact before sign-off.":
    "हस्ताक्षर से पहले सभी सुरक्षा क्लीयरेंस, LOTO ताले और सुरक्षा गार्ड सत्यापित करें।",
};

// ─── 4. Maintenance Crews ─────────────────────────────────────────────────────
const CREW_MAP: Record<string, string> = {
  "rotating machinery team m-4": "घूर्णन मशीनरी टीम M-4",
  "electrical & high-voltage crew e-2": "विद्युत एवं हाई-वोल्टेज दल E-2",
  "hydraulics & pressure valve crew h-1": "हाइड्रोलिक्स एवं प्रेशर वाल्व दल H-1",
  "scaffolding & structural rigging team s-3": "मचान एवं संरचनात्मक दल S-3",
  "hazardous material containment team c-1": "खतरनाक सामग्री नियंत्रण दल C-1",
  "pump specialist crew m-4": "पंप विशेषज्ञ दल M-4",
  "general plant reliability team g-5": "सामान्य प्लांट विश्वसनीयता दल G-5",
};

// ─── 5. Categories ────────────────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  electrical: "विद्युत (Electrical)",
  fall: "गिरावट जोखिम (Fall Risk)",
  chemical: "रासायनिक (Chemical)",
  fire: "अग्नि (Fire)",
  machinery: "मशीनरी (Machinery)",
  structural: "संरचनात्मक (Structural)",
  ppe: "पीपीई सुरक्षा (PPE)",
  unsafe_condition: "असुरक्षित स्थिति",
  unsafe_act: "असुरक्षित कार्य",
  equipment_failure: "उपकरण खराबी",
  chemical_exposure: "रासायनिक रिसाव",
  environmental_hazard: "पर्यावरणीय ख़तरा",
};

// ─── 6. Statuses ──────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  pending: "लंबित",
  pending_analysis: "AI जांच कर रहा है...",
  under_review: "जांच के अधीन",
  action_assigned: "सुधार कार्य जारी है",
  analysis_complete: "सत्यापित",
  resolved: "हल किया गया",
  closed: "बंद",
  in_progress: "मरम्मत चालू है",
  clearance_submitted: "क्लीयरेंस जमा किया गया",
  done: "पूर्ण एवं सुरक्षित",
  officer_verified: "अधिकारी द्वारा सत्यापित",
};

// ─── 7. Severities ────────────────────────────────────────────────────────────
const SEVERITY_MAP: Record<string, string> = {
  low: "कम ख़तरा (Low)",
  medium: "मध्यम ख़तरा (Medium)",
  high: "उच्च ख़तरा (High)",
  critical: "गंभीर ख़तरा (Critical)",
};

// ─── 8. Word / Phrase Replacements ────────────────────────────────────────────
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
  [/Found stripped bare electrical wiring near the water pump\. Water is nearby on the floor\. Extreme risk of shock\./gi, "पानी के पंप के पास बिजली का तार छिला हुआ खुला पड़ा है। पास में फर्श पर पानी भी है। करंट लगने का गंभीर ख़तरा है।"],
  [/Stair is broken in maintenance room/gi, "मेंटेनेंस वर्कशॉप में टूटी सीढ़ी"],
  [/broken stair in maintenance/gi, "मेंटेनेंस में टूटी सीढ़ी"],

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

  // Domain vocabulary
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
  [/\bstair\b/gi, "सीढ़ी"],
  [/\bstairs\b/gi, "सीढ़ियां"],
  [/\bladder\b/gi, "सीढ़ी"],
  [/\bbroken\b/gi, "टूटी हुई"],
  [/\bdamaged\b/gi, "क्षतिग्रस्त"],
  [/\bimmediate\b/gi, "तत्काल"],
  [/\baction\b/gi, "कार्रवाई"],
];

// ─── Exported Translation Functions ──────────────────────────────────────────

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
    .replace(/\bFloor\b/gi, "तल")
    .replace(/\bWorkshop\b/gi, "वर्कशॉप");
}

/**
 * Translates incident titles, descriptions, alert messages, and recommendations
 */
export function translateSafetyText(text?: string, lang: Language = "hi"): string {
  if (!text || lang === "en") return text || "";

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Exact Title match
  if (TITLE_MAP[lower]) {
    return TITLE_MAP[lower];
  }

  // 2. Exact Recommendation match
  if (RECOMMENDATION_MAP[lower]) {
    return RECOMMENDATION_MAP[lower];
  }

  // 3. Alert pattern: 'CRITICAL SIF HAZARD: <title> at <location>'
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

  // 4. Recommendation partial matches
  for (const [recKey, recVal] of Object.entries(RECOMMENDATION_MAP)) {
    if (lower === recKey || lower.includes(recKey.slice(0, 30))) {
      return recVal;
    }
  }

  // 5. Fallback phrase replacements
  let translated = trimmed;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  return translated;
}

/**
 * Translates incident category
 */
export function translateCategory(cat?: string, lang: Language = "hi"): string {
  if (!cat || lang === "en") return cat || "";
  const key = cat.trim().toLowerCase();
  return CATEGORY_MAP[key] || cat;
}

/**
 * Translates report or task status
 */
export function translateStatus(status?: string, lang: Language = "hi"): string {
  if (!status || lang === "en") return status || "";
  const key = status.trim().toLowerCase();
  return STATUS_MAP[key] || status;
}

/**
 * Translates severity / risk level
 */
export function translateSeverity(sev?: string, lang: Language = "hi"): string {
  if (!sev || lang === "en") return sev || "";
  const key = sev.trim().toLowerCase();
  return SEVERITY_MAP[key] || sev;
}

/**
 * Translates assigned maintenance crew
 */
export function translateCrew(crew?: string, lang: Language = "hi"): string {
  if (!crew || lang === "en") return crew || "";
  const key = crew.trim().toLowerCase();
  return CREW_MAP[key] || crew;
}

/**
 * Translates relative time ('Just now', '5m ago', '2h ago', '1d ago')
 */
export function translateTimeAgo(timeStr?: string, lang: Language = "hi"): string {
  if (!timeStr || lang === "en") return timeStr || "";
  if (timeStr === "Just now") return "अभी";
  if (timeStr === "Live") return "लाइव";
  return timeStr
    .replace(/(\d+)\s*m\s*ago/gi, "$1 मिनट पहले")
    .replace(/(\d+)\s*h\s*ago/gi, "$1 घंटे पहले")
    .replace(/(\d+)\s*d\s*ago/gi, "$1 दिन पहले");
}
