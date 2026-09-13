import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_API_KEY = process.env.AI_API_KEY || "dev-secret-key-change-in-production";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      imageBase64?: string;
      transcript?: string;
      lang?: string;
      title?: string;
      description?: string;
      location?: string;
      category?: string;
      severity?: string;
      report_id?: string;
    };

    const {
      imageBase64,
      transcript = "",
      lang = "en",
      title,
      description,
      location = "Plant Sector 4",
      category = "unsafe_condition",
      severity = "medium",
      report_id = `rep_${Date.now()}`
    } = body;

    const reportTitle = (title && title.trim()) || (transcript && transcript.trim()) || "Visual Hazard Inspection";
    const reportDesc = description || (transcript && transcript.length >= 10
      ? transcript
      : `${transcript || "Visual hazard inspection reported"} at ${location}.`);

    let riskScore = 50;
    let riskLevel = "MEDIUM";
    let sifProbability = 0.35;
    let precursors: string[] = ["Operational Hazard"];
    let hazards: string[] = ["General Safety Concern"];
    let recommendations: string[] = ["Conduct immediate site inspection and isolate area."];
    let explanation = `Automated ForeSite MiniLM risk assessment for ${location}.`;
    let modelSource = "custom-finetuned-minilm";
    let isFallback = false;

    // Call local Fine-Tuned MiniLM AI microservice
    try {
      const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": AI_API_KEY,
        },
        body: JSON.stringify({
          report_id,
          title: reportTitle,
          description: reportDesc.length >= 10 ? reportDesc : `${reportDesc} - requires physical verification`,
          location,
          category,
          severity,
          ...(imageBase64 ? { image_base64: imageBase64 } : {}),
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        riskScore = Number(aiData.risk_score) || riskScore;
        riskLevel = String(aiData.risk_level || riskLevel).toUpperCase();
        sifProbability = Number(aiData.sif_probability) || sifProbability;
        if (Array.isArray(aiData.precursors) && aiData.precursors.length > 0) precursors = aiData.precursors;
        if (Array.isArray(aiData.hazards) && aiData.hazards.length > 0) hazards = aiData.hazards;
        if (Array.isArray(aiData.recommendations) && aiData.recommendations.length > 0) recommendations = aiData.recommendations;
        if (aiData.explanation) explanation = aiData.explanation;
        if (aiData.model_source) modelSource = aiData.model_source;
      } else {
        throw new Error(`AI service returned status ${aiResponse.status}`);
      }
    } catch (aiErr) {
      console.warn("[ForeSite AI] Local MiniLM offline, executing deterministic heuristic analysis:", aiErr);
      isFallback = true;
      const combinedText = `${reportTitle} ${reportDesc}`.toLowerCase();

      const isMinorCosmetic =
        /\b(paint|peeling|flicker|flickering|tube light|bulb|light bulb|dim light|burnt bulb|cosmetic|trash|litter|water bottle|dust|cleaning|dirty|smudge)\b/i.test(combinedText) &&
        !/\b(fire|explosion|toxic|gas leak|electric shock|480v|high voltage|electrocution|amputation|crush)\b/i.test(combinedText);

      const isCrit =
        !isMinorCosmetic && (
          severity === "critical" ||
          /\b(fire|explosion|toxic gas|gas leak|480v|high voltage|electrocution|arc flash|cave-in|trench collapse|amputation)\b/i.test(combinedText) ||
          /\b(bare wire|exposed wire|naked wire|live wire|conductor)\b/i.test(combinedText) ||
          /\b(fall from|falling from|scaffold|scaffolding|no harness|no railing|unprotected edge|open shaft|open hole|roof edge)\b/i.test(combinedText) ||
          /\b(structural collapse|cracked pillar|sagging roof)\b/i.test(combinedText)
        );

      const isSlipNearStairs =
        !isMinorCosmetic &&
        /\b(wet floor|slippery|water spill|puddle|liquid spill)\b/i.test(combinedText) &&
        /\b(stair|stairs|staircase|steps|ladder)\b/i.test(combinedText);

      const isHigh =
        !isMinorCosmetic && !isCrit && !isSlipNearStairs && (
          severity === "high" ||
          /\b(steam leak|high pressure|flange leak|chemical spill|acid|corrosive|bearing failure|heavy vibration|damaged stair|broken stair|missing guardrail)\b/i.test(combinedText)
        );

      const isGeneralSlip =
        !isMinorCosmetic &&
        /\b(wet floor|slippery|water spill|puddle|liquid spill|trip|cluttered)\b/i.test(combinedText);

      if (isMinorCosmetic) {
        riskScore = 18;
        riskLevel = "LOW";
        sifProbability = 0.08;
        precursors = ["General Facility Illumination / Housekeeping"];
        hazards = ["Minor First Aid Event / Visibility Inconvenience"];
        recommendations = [
          "Log standard work order for routine maintenance or housekeeping crew.",
          "Check again during scheduled shift inspection."
        ];
        explanation = `Minor housekeeping observation. No life-safety SIF precursor detected. Standard operational maintenance routine.`;
      } else if (isCrit) {
        riskScore = 88;
        riskLevel = "CRITICAL";
        sifProbability = 0.85;
        precursors = /wire|electr/i.test(combinedText)
          ? ["Energized Exposure / Fall Risk", "Critical System Stress"]
          : ["Working at Height / Unsecured Perimeter", "Direct Line of Fire Exposure"];
        hazards = /wire|electr/i.test(combinedText)
          ? ["Arc Flash / Structural Fall", "Combustion Potential"]
          : ["Fatal Fall Impact", "Severe Trauma"];
        recommendations = [
          "Isolate energy source and enforce strict Lockout/Tagout (LOTO) protocols.",
          "Establish red perimeter safety barricade and restrict unauthorized personnel access.",
          "Dispatch certified maintenance crew for immediate emergency remediation."
        ];
        explanation = `Deterministic safety triage triggered: detected high risk keywords in '${reportTitle}'. Priority remediation mandated.`;
      } else if (isSlipNearStairs || isHigh) {
        riskScore = isSlipNearStairs ? 65 : 72;
        riskLevel = "HIGH";
        sifProbability = isSlipNearStairs ? 0.55 : 0.62;
        precursors = isSlipNearStairs
          ? ["Slippery Walkways at Elevated Staircase", "Stairway Slip and Fall Precursor"]
          : ["Equipment Degradation", "Fluid Containment Integrity"];
        hazards = isSlipNearStairs
          ? ["Stairway Fall Trauma", "Impact Fracture"]
          : ["Mechanical Shear", "High Pressure Jet"];
        recommendations = isSlipNearStairs
          ? [
              "Deploy high-visibility caution signs at both stair approaches immediately.",
              "Mop dry and squeegee pooling liquid from stair landing.",
              "Inspect handrails and apply anti-skid abrasive strips."
            ]
          : [
              "Inspect mechanical seal and flange integrity.",
              "Restrict personnel within direct line of spray or vibration zone."
            ];
        explanation = isSlipNearStairs
          ? `Slippery floor adjacent to staircase introduces elevated fall hazard. Rapid response required.`
          : `High operational risk identified. Supervisor review required.`;
      } else if (isGeneralSlip || severity === "medium") {
        riskScore = 42;
        riskLevel = "MEDIUM";
        sifProbability = 0.28;
        precursors = ["Slippery Walkways and Minor Trip Hazards"];
        hazards = ["Same-Level Slip and Fall", "Minor Contusion"];
        recommendations = [
          "Place caution signs around the affected walkway.",
          "Clean up fluid or remove clutter from pedestrian path."
        ];
        explanation = `Routine walkway hazard. Non-fatal slip/trip potential. Clean and signpost.`;
      } else {
        riskScore = 24;
        riskLevel = "LOW";
        sifProbability = 0.12;
        precursors = ["Operational Maintenance"];
        hazards = ["Minor Operational Delay"];
        recommendations = ["Log for standard shift maintenance."];
        explanation = `Routine facility observation. Standard operational follow-up.`;
      }
    }

    const analysis = {
      hazard_detected: riskScore >= 30,
      hazard_type: hazards[0]?.toLowerCase().replace(/\s+/g, '_') || "machinery",
      danger_level: riskLevel,
      risk_score: riskScore,
      sif_probability: sifProbability,
      precursors,
      hazards,
      title_en: reportTitle,
      title_hi: `${reportTitle} (विश्लेषण पूर्ण)`,
      what_was_observed: explanation,
      immediate_actions: recommendations.slice(0, 2),
      suggestions_en: recommendations,
      suggestions_hi: recommendations.map(r => `कार्रवाई: ${r}`),
      repair_tasks: recommendations.map(r => `Maintenance Task: ${r}`),
      model_source: modelSource,
      is_fallback: isFallback,
      engine: "ForeSite Custom Fine-Tuned SIF MiniLM (all-MiniLM-L6-v2)"
    };

    return NextResponse.json({
      success: true,
      analysis,
      lang,
      model_source: modelSource
    });

  } catch (err: unknown) {
    console.error("Analysis route error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
