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

    const reportTitle = title || (transcript ? transcript.slice(0, 60) : "Visual Hazard Inspection");
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
      const isCrit = /fall|scaffold|wire|electr|fire|explosion|collapse|gas leak|toxic|high voltage/i.test(combinedText);
      const isHigh = /leak|steam|flange|crack|vibration|spill|pressure|bearing|pump|corrosion/i.test(combinedText);

      riskScore = isCrit ? 91 : isHigh ? 74 : 42;
      riskLevel = isCrit ? "CRITICAL" : isHigh ? "HIGH" : "MEDIUM";
      sifProbability = isCrit ? 0.89 : isHigh ? 0.65 : 0.28;
      precursors = isCrit ? ["Energized Exposure / Fall Risk", "Critical System Stress"] : ["Equipment Degradation", "Fluid Containment Integrity"];
      hazards = isCrit ? ["Arc Flash / Structural Fall", "Combustion Potential"] : ["Mechanical Shear", "High Pressure Jet"];
      recommendations = [
        "Isolate energy source and enforce strict Lockout/Tagout (LOTO) protocols.",
        "Establish red perimeter safety barricade and restrict unauthorized personnel access.",
        "Dispatch certified maintenance crew for comprehensive mechanical / electrical remediation."
      ];
      explanation = `Deterministic safety triage triggered: detected high risk keywords in '${reportTitle}'. Priority remediation mandated.`;
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
