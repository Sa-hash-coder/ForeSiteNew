export type Language = "en" | "hi";

export interface Translations {
  // Navigation & Common
  appTitle: string;
  workerName: string;
  home: string;
  reportIssue: string;
  myReports: string;
  profile: string;
  dashboard: string;
  languageBtn: string;
  footerText: string;
  backToReports: string;
  loading: string;
  error: string;

  // Danger Levels
  dangerLevels: {
    LOW: { label: string; sub: string };
    MEDIUM: { label: string; sub: string };
    HIGH: { label: string; sub: string };
    CRITICAL: { label: string; sub: string };
  };

  // Status Labels
  status: {
    pending_analysis: string;
    analysis_complete: string;
    under_review: string;
    action_assigned: string;
    resolved: string;
    closed: string;
  };

  // Dashboard
  greeting: string;
  greetingSub: string;
  reportBtnTitle: string;
  reportBtnSub: string;
  statTotal: string;
  statPending: string;
  statResolved: string;
  statCritical: string;
  statUnderReview: string;
  seeHazardTitle: string;
  seeHazardSub: string;
  uploadPhoto: string;
  yourImpact: string;
  yourImpactSub: string;
  aiPoweredAnalysis: string;
  fasterResolution: string;
  saferCommunities: string;
  aiInsights: string;
  recentReports: string;
  seeAll: string;
  noReportsYet: string;
  noReportsSub: string;

  // Simplified Submit Form (Voice-First)
  submitTitle: string;
  submitSubtitle: string;
  locationLabel: string;
  selectLocation: string;
  
  voiceMainTitle: string;
  voiceMainSubtitle: string;
  voiceHoldToSpeak: string;
  voiceTapToSpeak: string;
  voiceListeningNow: string;
  voiceRecordingTimer: string;
  voiceRecordedSuccess: string;
  voiceReRecord: string;
  voiceDelete: string;
  voiceAutoTranscribed: string;

  speakingLanguage: string;
  detectedHindi: string;
  detectedEnglish: string;
  convertedTextTitle: string;

  optionalTextLabel: string;
  optionalTextPlaceholder: string;
  optionalTextHint: string;

  photoLabel: string;
  photoHint: string;
  photoBtn: string;
  removePhoto: string;

  submitBtn: string;
  submitting: string;
  submitSuccessTitle: string;
  submitSuccessMsg: string;
  viewMyReports: string;
  submitAnother: string;

  // Validation
  errLocation: string;
  errNoInput: string;
  errPhotoSize: string;
  errMicPermission: string;

  // Report Details
  dangerLevelTitle: string;
  suggestionsTitle: string;
  reportedDetailsTitle: string;
  actionTakenTitle: string;
  assignedTo: string;
  dueDate: string;
  listenAdviceBtn: string;
  stopListenAdviceBtn: string;

  // Locations
  locations: string[];

  // Officer & Shared Platform UI
  commandCenter: string;
  navOverview: string;
  navReports: string;
  navHeatmap: string;
  navAnalytics: string;
  navAlerts: string;
  navTasks: string;
  signOut: string;
  siteSubtitle: string;
  leadSafetyInspector: string;
  safetyOfficer: string;

  officerDashboardTitle: string;
  totalReportsCard: string;
  criticalHighCard: string;
  requiresAction: string;
  pendingReviewCard: string;
  awaitingAssessment: string;
  resolvedCard: string;
  weeklyReportsTitle: string;
  liveTelemetryBadge: string;
  categoryBreakdownTitle: string;
  activeAlertsTitle: string;
  allAlertsAck: string;
  noAlertsSub: string;
  topRiskZonesTitle: string;
  incidentsLabel: string;
  viewAllLink: string;

  searchReportsPlaceholder: string;
  exportCsvBtn: string;
  exportExcelBtn: string;
  tableColId: string;
  tableColTitle: string;
  tableColLocation: string;
  tableColCategory: string;
  tableColSeverity: string;
  tableColRiskScore: string;
  tableColStatus: string;
  tableColTime: string;
  tableColAction: string;
  viewDetailsBtn: string;
  filterAllLabel: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    appTitle: "ForeSite",
    workerName: "Worker",
    home: "Home",
    dashboard: "Dashboard",
    reportIssue: "Submit Report",
    myReports: "My Reports",
    profile: "Profile",
    languageBtn: "हिंदी में बदलें",
    footerText: "ForeSite Safety Platform • Safer Cities. Stronger Communities.",
    backToReports: "← Back to My Reports",
    loading: "Loading...",
    error: "Something went wrong. Please check your connection.",

    dangerLevels: {
      LOW: { label: "Low Danger", sub: "Minor issue • Stay alert" },
      MEDIUM: { label: "Medium Danger", sub: "Take caution • Needs attention" },
      HIGH: { label: "High Danger", sub: "Serious risk • Keep safe distance" },
      CRITICAL: { label: "Severe Danger", sub: "Immediate threat • Do not enter area" },
    },

    status: {
      pending_analysis: "AI Analyzing...",
      analysis_complete: "Verified",
      under_review: "Under Review",
      action_assigned: "Fix In Progress",
      resolved: "Resolved",
      closed: "Closed",
    },

    greeting: "Welcome Back!",
    greetingSub: "Thanks for keeping your worksite safe.",
    reportBtnTitle: "Report a Hazard / Danger",
    reportBtnSub: "Upload a photo, let AI analyze it, and help make your facility safer.",
    statTotal: "Total Reports",
    statPending: "Under Review",
    statResolved: "Resolved",
    statCritical: "Critical",
    statUnderReview: "Under Review",
    seeHazardTitle: "See a hazard? Report it now.",
    seeHazardSub: "Upload a photo, let AI analyze it, and help make your facility safer.",
    uploadPhoto: "Upload Photo",
    yourImpact: "Your Impact",
    yourImpactSub: "Your reports help create safer and more compliant workplaces.",
    aiPoweredAnalysis: "AI-powered analysis",
    fasterResolution: "Faster resolution",
    saferCommunities: "Safer workplaces",
    aiInsights: "AI Insights",
    recentReports: "Recent Reports",
    seeAll: "View All →",
    noReportsYet: "No reports yet",
    noReportsSub: "When you report an issue, it will appear here.",

    submitTitle: "Report a Hazard",
    submitSubtitle: "Press & hold the mic to speak. Our AI will automatically analyze the danger and alert the team.",
    locationLabel: "1. Where is the danger located? *",
    selectLocation: "-- Select Location --",

    voiceMainTitle: "2. Speak into the microphone (Main)",
    voiceMainSubtitle: "Hold the button and describe what you see. We'll automatically convert it into text.",
    voiceHoldToSpeak: "Press & Hold to Speak",
    voiceTapToSpeak: "Tap or Hold to Speak",
    voiceListeningNow: "🔴 Listening... Speak clearly now",
    voiceRecordingTimer: "Recording",
    voiceRecordedSuccess: "Voice message recorded",
    voiceReRecord: "🔄 Re-record",
    voiceDelete: "✕ Delete Audio",
    voiceAutoTranscribed: "Transcribed from your voice:",

    speakingLanguage: "Speaking in:",
    detectedHindi: "🇮🇳 Spoken in Hindi (हिंदी)",
    detectedEnglish: "🇬🇧 Spoken in English",
    convertedTextTitle: "Converted Text from your Voice:",

    optionalTextLabel: "3. Extra written notes (Optional)",
    optionalTextPlaceholder: "Your speech appears here automatically. You can also type manually if you prefer...",
    optionalTextHint: "You can leave this blank if you have recorded your voice or added a photo.",

    photoLabel: "4. Add a Photo (Optional)",
    photoHint: "AI analyzes the photo to identify the danger automatically",
    photoBtn: "📷 Take or Pick a Photo",
    removePhoto: "✕ Remove Photo",

    submitBtn: "Send Report Now",
    submitting: "Sending to AI Analysis...",
    submitSuccessTitle: "Report Sent Successfully!",
    submitSuccessMsg: "Your voice & photo have been sent. AI is analyzing the danger level and assigning technicians.",
    viewMyReports: "View My Reports",
    submitAnother: "Report Another Issue",

    errLocation: "Please select where the hazard is located.",
    errNoInput: "Please record your voice, type a description, or attach a photo.",
    errPhotoSize: "Photo is too large. Please choose a photo under 10 MB.",
    errMicPermission: "Microphone permission is required. Please allow mic access.",

    dangerLevelTitle: "Danger Level (AI Assessed)",
    suggestionsTitle: "Safety Advice & Next Steps",
    reportedDetailsTitle: "What was reported",
    actionTakenTitle: "Repair & Action Progress",
    assignedTo: "Assigned To",
    dueDate: "Expected Fix Date",
    listenAdviceBtn: "🔊 Read Aloud (Listen)",
    stopListenAdviceBtn: "⏹️ Stop Voice",

    locations: [
      "Boiler Room A",
      "Boiler Room B",
      "Chemical Storage Area",
      "Control Room",
      "Electrical Panel Room",
      "Loading Bay",
      "Maintenance Workshop",
      "Roof / Height Work Area",
      "Water Treatment Plant",
      "Warehouse Corridor",
      "Other Location",
    ],

    // Officer & Shared Platform UI
    commandCenter: "Command Center",
    navOverview: "Overview",
    navReports: "Reports",
    navHeatmap: "Heatmap",
    navAnalytics: "Analytics",
    navAlerts: "Alerts",
    navTasks: "Tasks",
    signOut: "Sign Out",
    siteSubtitle: "Site: Refinery Unit Alpha · Live Grid Active",
    leadSafetyInspector: "Lead Safety Inspector",
    safetyOfficer: "Safety Officer",

    officerDashboardTitle: "Executive Safety Dashboard",
    totalReportsCard: "Total Reports",
    criticalHighCard: "Critical / High",
    requiresAction: "Requires immediate action",
    pendingReviewCard: "Pending Review",
    awaitingAssessment: "Awaiting assessment",
    resolvedCard: "Resolved",
    weeklyReportsTitle: "Weekly Reports (Last 8 Weeks)",
    liveTelemetryBadge: "Live Telemetry",
    categoryBreakdownTitle: "Category Breakdown",
    activeAlertsTitle: "Active Alerts",
    allAlertsAck: "All Active Alerts Acknowledged",
    noAlertsSub: "No critical or high-risk SIF alerts currently require officer intervention.",
    topRiskZonesTitle: "Top Risk Zones",
    incidentsLabel: "incidents",
    viewAllLink: "View all →",

    searchReportsPlaceholder: "Search reports by title, location...",
    exportCsvBtn: "Export CSV",
    exportExcelBtn: "Export Excel",
    tableColId: "Report ID",
    tableColTitle: "Incident / Title",
    tableColLocation: "Location Details",
    tableColCategory: "Category",
    tableColSeverity: "Severity",
    tableColRiskScore: "Risk Score",
    tableColStatus: "Status",
    tableColTime: "Reported",
    tableColAction: "Action",
    viewDetailsBtn: "View Details",
    filterAllLabel: "All",
  },

  hi: {
    appTitle: "फ़ोरसाइट (ForeSite)",
    workerName: "कार्यकर्ता",
    home: "मुख्य पृष्ठ",
    dashboard: "डैशबोर्ड",
    reportIssue: "रिपोर्ट दर्ज करें",
    myReports: "मेरी रिपोर्ट्स",
    profile: "प्रोफ़ाइल",
    languageBtn: "Switch to English",
    footerText: "फ़ोरसाइट सुरक्षा मंच • सुरक्षित शहर, सशक्त समुदाय।",
    backToReports: "← वापस मेरी रिपोर्ट्स पर जाएं",
    loading: "लोड हो रहा है...",
    error: "कुछ गड़बड़ हुई। कृपया इंटरनेट कनेक्शन जांचें।",

    dangerLevels: {
      LOW: { label: "कम ख़तरा (Low)", sub: "मामूली समस्या • सतर्क रहें" },
      MEDIUM: { label: "मध्यम ख़तरा (Medium)", sub: "सावधानी बरतें • ध्यान देने योग्य" },
      HIGH: { label: "भारी ख़तरा (High)", sub: "गंभीर ख़तरा • सुरक्षित दूरी बनाए रखें" },
      CRITICAL: { label: "अत्यधिक ख़तरा (Critical)", sub: "जानलेवा ख़तरा • तुरंत दूर हटें" },
    },

    status: {
      pending_analysis: "AI जांच कर रहा है...",
      analysis_complete: "सत्यापित",
      under_review: "जांच के अधीन",
      action_assigned: "सुधार कार्य जारी है",
      resolved: "हल किया गया",
      closed: "बंद",
    },

    greeting: "स्वागत है!",
    greetingSub: "अपने कार्यस्थल को सुरक्षित रखने के लिए धन्यवाद।",
    reportBtnTitle: "ख़तरा / समस्या दर्ज करें",
    reportBtnSub: "फ़ोटो अपलोड करें, AI जांच करेगा और कार्यस्थल को सुरक्षित बनाएगा।",
    statTotal: "कुल रिपोर्ट्स",
    statPending: "जांच के अधीन",
    statResolved: "हल किया गया",
    statCritical: "गंभीर ख़तरा",
    statUnderReview: "जांच के अधीन",
    seeHazardTitle: "कोई ख़तरा देखा? अभी रिपोर्ट करें।",
    seeHazardSub: "फ़ोटो अपलोड करें, AI जांच करेगा और कार्यस्थल को सुरक्षित बनाएगा।",
    uploadPhoto: "फ़ोटो अपलोड करें",
    yourImpact: "आपका प्रभाव",
    yourImpactSub: "आपकी रिपोर्ट सुरक्षित और बेहतर कार्यस्थल बनाने में मदद करती हैं।",
    aiPoweredAnalysis: "AI चालित विश्लेषण",
    fasterResolution: "त्वरित समाधान",
    saferCommunities: "सुरक्षित कार्यस्थल",
    aiInsights: "AI अंतर्दृष्टि",
    recentReports: "हालिया रिपोर्ट्स",
    seeAll: "सभी देखें →",
    noReportsYet: "अभी तक कोई रिपोर्ट नहीं है",
    noReportsSub: "जब आप कोई समस्या दर्ज करेंगे, वह यहाँ दिखाई देगी।",

    submitTitle: "ख़तरा दर्ज करें",
    submitSubtitle: "माइक दबाकर बोलें। AI अपने आप ख़तरे की गंभीरता समझकर सुरक्षा टीम को भेजेगा।",
    locationLabel: "1. ख़तरा कहाँ है? (स्थान चुनें) *",
    selectLocation: "-- स्थान चुनें --",

    voiceMainTitle: "2. माइक दबाकर बोलें (मुख्य विकल्प)",
    voiceMainSubtitle: "माइक बटन दबाकर रखें और बोलें। आपकी आवाज़ अपने आप नीचे लिख दी जाएगी।",
    voiceHoldToSpeak: "माइक दबाकर रखें और बोलें",
    voiceTapToSpeak: "दबाकर रखें या टैप करके बोलें",
    voiceListeningNow: "🔴 सुन रहा हूँ... अभी बोलिए",
    voiceRecordingTimer: "रिकॉर्डिंग",
    voiceRecordedSuccess: "आपकी आवाज़ रिकॉर्ड हो गई",
    voiceReRecord: "🔄 दोबारा बोलें",
    voiceDelete: "✕ रिकॉर्डिंग हटाएं",
    voiceAutoTranscribed: "आपकी आवाज़ से लिखा गया विवरण:",

    speakingLanguage: "बोलने की भाषा:",
    detectedHindi: "🇮🇳 हिंदी में बोला गया (Hindi)",
    detectedEnglish: "🇬🇧 अंग्रेजी में बोला गया (English)",
    convertedTextTitle: "आपकी आवाज़ से बना टेक्स्ट (Converted Text):",

    optionalTextLabel: "3. लिखकर विवरण दें (ऐच्छिक - जरूरी नहीं)",
    optionalTextPlaceholder: "जो आप बोलेंगे वह यहाँ अपने आप लिख जाएगा। चाहें तो खुद भी लिख सकते हैं...",
    optionalTextHint: "अगर आपने आवाज़ रिकॉर्ड कर दी है या फ़ोटो लगा दी है, तो इसे खाली छोड़ सकते हैं।",

    photoLabel: "4. फ़ोटो जोड़ें (ऐच्छिक)",
    photoHint: "AI फ़ोटो देखकर ख़तरा अपने आप पहचान लेगा",
    photoBtn: "📷 फ़ोटो खींचें या चुनें",
    removePhoto: "✕ फ़ोटो हटाएं",

    submitBtn: "रिपोर्ट तुरंत भेजें",
    submitting: "AI जांच हेतु भेजा जा रहा है...",
    submitSuccessTitle: "रिपोर्ट सफलतापूर्वक दर्ज हो गई!",
    submitSuccessMsg: "आपकी आवाज़ और फ़ोटो प्राप्त हो गई है। AI ख़तरे की जांच करके तुरंत सुधार टीम को भेज रहा है।",
    viewMyReports: "मेरी रिपोर्ट्स देखें",
    submitAnother: "एक और ख़तरा दर्ज करें",

    errLocation: "कृपया स्थान चुनें कि ख़तरा कहाँ है।",
    errNoInput: "कृपया माइक दबाकर बोलें, विवरण लिखें, या फ़ोटो लगाएं।",
    errPhotoSize: "फ़ोटो का आकार बहुत बड़ा है। कृपया छोटी फ़ोटो चुनें।",
    errMicPermission: "आवाज़ रिकॉर्ड करने के लिए माइक की अनुमति (Permission) दें।",

    dangerLevelTitle: "ख़तरे का स्तर (AI द्वारा आंका गया)",
    suggestionsTitle: "सुरक्षा निर्देश एवं सुझाव (What to do)",
    reportedDetailsTitle: "दर्ज की गई समस्या",
    actionTakenTitle: "सुधार व कार्रवाई की स्थिति",
    assignedTo: "किसे सौंपा गया",
    dueDate: "सुधार की अंतिम तिथि",
    listenAdviceBtn: "🔊 बोलकर सुनाएं (आवाज़ में सुनें)",
    stopListenAdviceBtn: "⏹️ आवाज़ रोकें",

    locations: [
      "बॉयलर रूम A (Boiler Room A)",
      "बॉयलर रूम B (Boiler Room B)",
      "केमिकल स्टोरेज (Chemical Storage)",
      "कंट्रोल रूम (Control Room)",
      "इलेक्ट्रिकल पैनल रूम (Electrical Room)",
      "लोडिंग बे (Loading Bay)",
      "मेंटेनेंस वर्कशॉप (Workshop)",
      "छत / ऊंचाई कार्य क्षेत्र (Roof / Height)",
      "वाटर ट्रीटमेंट प्लांट (Water Treatment)",
      "वेयरहाउस / मुख्य गलियारा (Warehouse)",
      "अन्य स्थान (Other Location)",
    ],

    // Officer & Shared Platform UI
    commandCenter: "कमांड सेंटर",
    navOverview: "अवलोकन",
    navReports: "रिपोर्ट्स",
    navHeatmap: "हीटमैप",
    navAnalytics: "एनालिटिक्स",
    navAlerts: "चेतावनी",
    navTasks: "सुधार कार्य",
    signOut: "लॉग आउट",
    siteSubtitle: "साइट: रिफाइनरी यूनिट अल्फा · लाइव ग्रिड सक्रिय",
    leadSafetyInspector: "मुख्य सुरक्षा निरीक्षक",
    safetyOfficer: "सुरक्षा अधिकारी",

    officerDashboardTitle: "कार्यकारी सुरक्षा डैशबोर्ड",
    totalReportsCard: "कुल रिपोर्ट्स",
    criticalHighCard: "गंभीर / उच्च ख़तरा",
    requiresAction: "तत्काल कार्रवाई आवश्यक",
    pendingReviewCard: "समीक्षाधीन",
    awaitingAssessment: "मूल्यांकन की प्रतीक्षा",
    resolvedCard: "हल किया गया",
    weeklyReportsTitle: "साप्ताहिक रिपोर्ट्स (पिछले 8 सप्ताह)",
    liveTelemetryBadge: "लाइव टेलीमेट्री",
    categoryBreakdownTitle: "श्रेणीवार विवरण",
    activeAlertsTitle: "सक्रिय चेतावनियाँ",
    allAlertsAck: "सभी सक्रिय चेतावनियाँ स्वीकृत हैं",
    noAlertsSub: "वर्तमान में किसी भी गंभीर SIF चेतावनी पर अधिकारी हस्तक्षेप की आवश्यकता नहीं है।",
    topRiskZonesTitle: "सर्वाधिक जोखिम वाले क्षेत्र",
    incidentsLabel: "घटनाएं",
    viewAllLink: "सभी देखें →",

    searchReportsPlaceholder: "शीर्षक, स्थान से रिपोर्ट खोजें...",
    exportCsvBtn: "सीएसवी निर्यात",
    exportExcelBtn: "एक्सेल निर्यात",
    tableColId: "रिपोर्ट ID",
    tableColTitle: "घटना / शीर्षक",
    tableColLocation: "स्थान विवरण",
    tableColCategory: "श्रेणी",
    tableColSeverity: "गंभीरता",
    tableColRiskScore: "जोखिम स्कोर",
    tableColStatus: "स्थिति",
    tableColTime: "समय",
    tableColAction: "कार्रवाई",
    viewDetailsBtn: "विवरण देखें",
    filterAllLabel: "सभी",
  },
};
