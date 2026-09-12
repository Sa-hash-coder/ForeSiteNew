import { NextRequest, NextResponse } from "next/server";
import { dbReports, dbAlerts } from "@/app/lib/db";
import { verifyToken } from "@/app/lib/security";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const riskLevel = searchParams.get("riskLevel") || undefined;
    const category = searchParams.get("category") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);

    const result = await dbReports.list({ status, riskLevel, category, limit, page });

    return NextResponse.json({
      success: true,
      data: result.reports.map((r) => ({
        _id: r._id,
        title: r.title,
        location: r.location,
        category: r.category,
        severity: r.severity,
        status: r.status,
        createdAt: r.createdAt,
        riskAssessment: {
          riskScore: r.risk_score,
          riskLevel: r.risk_level,
          sifProbability: r.sif_probability,
          precursors: r.precursors,
          hazards: r.hazards,
          explanation: r.explanation,
        },
        submittedBy: r.submittedBy,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      location,
      category = "unsafe_condition",
      severity = "high",
      imageUrl,
      audioUrl,
    } = body;

    // Optional user authentication extraction
    let user = {
      _id: "usr_guest",
      name: "Site Worker",
      role: "worker",
      department: "Plant Operations",
    };

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const decoded = verifyToken(authHeader.substring(7));
      if (decoded && decoded._id) {
        user = {
          _id: decoded._id,
          name: decoded.name || "Site Worker",
          role: decoded.role || "worker",
          department: decoded.department || "Operations",
        };
      }
    }

    // Call the fine-tuned AI microservice on localhost:8000 with resilient heuristic fallback
    let riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    let riskScore = 45;
    let sifProbability = 0.35;
    let precursors: string[] = ["Operational Hazard"];
    let hazards: string[] = ["General Safety Concern"];
    let explanation = `Automated risk assessment for ${location || "facility"}.`;
    let recommendations: string[] = [];

    try {
      const aiResponse = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.AI_API_KEY || "dev-secret-key-change-in-production",
        },
        body: JSON.stringify({
          report_id: `rep_${Date.now()}`,
          title: title || "Hazard Report",
          description: description && description.length >= 10 ? description : `${description || "Hazard reported"} in ${location || "plant"}`,
          location: location || "Plant Sector 4",
          category: category || "unsafe_condition",
          severity: severity || "medium",
          ...(imageUrl ? { image_base64: imageUrl } : {}),
          ...(audioUrl ? { audio_base64: audioUrl } : {}),
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        riskScore = Number(aiData.risk_score) || riskScore;
        riskLevel = (aiData.risk_level as any) || riskLevel;
        sifProbability = Number(aiData.sif_probability) || sifProbability;
        if (Array.isArray(aiData.precursors) && aiData.precursors.length > 0) precursors = aiData.precursors;
        if (Array.isArray(aiData.hazards) && aiData.hazards.length > 0) hazards = aiData.hazards;
        if (aiData.explanation) explanation = aiData.explanation;
        if (Array.isArray(aiData.recommendations)) recommendations = aiData.recommendations;
      } else {
        throw new Error(`AI service returned ${aiResponse.status}`);
      }
    } catch {
      // Local fallback heuristics if microservice is offline
      const text = `${title || ""} ${description || ""} ${category || ""} ${location || ""}`.toLowerCase();
      
      const isCritical =
        severity === "critical" ||
        /fall|fire|explosion|collapse|gas|electrocution|leak|acid|fatal|crush/i.test(text);
      const isHigh = severity === "high" || /crack|vibration|spill|high pressure|flange|bearing|steam/i.test(text);

      riskLevel = isCritical ? "CRITICAL" : isHigh ? "HIGH" : severity === "low" ? "LOW" : "MEDIUM";
      riskScore = isCritical ? 88 : isHigh ? 72 : 38;
      sifProbability = isCritical ? 0.85 : isHigh ? 0.62 : 0.25;

      if (/scaffold|fall|height|ladder|plank|guardrail|roof|perimeter/i.test(text)) {
        precursors = ["Working at Height Exposure", "Missing Fall Restraint Barrier"];
        hazards = ["Fall from Elevation", "Fatal Traumatic Impact"];
        recommendations = [
          "Red-tag scaffolding and immediately suspend elevated work until inspected (OSHA 1926.451).",
          "Secure all loose planks with certified scaffolding clamps and install 42-inch top guardrails with toe-boards.",
          "Enforce 100% tie-off using dual self-retracting lifelines (SRLs) anchored to certified structural points."
        ];
      } else if (/vibration|bearing|pump|motor|compressor|shaft|rotating|gear/i.test(text)) {
        precursors = ["Rotating Machinery Bearing Failure", "Mechanical Component Degradation"];
        hazards = ["Mechanical Catastrophic Seizure", "Projectile / Fragmentation Risk"];
        recommendations = [
          "Initiate controlled operational throttling/shutdown of unit to prevent catastrophic bearing seizure.",
          "Conduct spectrum vibration FFT analysis and laser shaft alignment on bearing housing.",
          "Inspect lubrication reservoir for metal particles and replace degraded bearings under LOTO protocol."
        ];
      } else if (/chemical|acid|caustic|toxic|solvent|corrosive/i.test(text)) {
        precursors = ["Toxic / Corrosive Chemical Release", "Inadequate Secondary Containment"];
        hazards = ["Chemical Inhalation Hazard", "Skin Chemical Burn"];
        recommendations = [
          "Cordon off area within 50m perimeter and post certified OSHA HAZMAT danger signage.",
          "Deploy neutralizing absorbent boom kit and activate local exhaust ventilation.",
          "Mandate Level B chemical splash suit and full-face respirator for containment crew."
        ];
      } else if (/electric|wire|cable|voltage|breaker|panel|spark|conduit|energized/i.test(text)) {
        precursors = ["Energized Electrical Conductor Exposure", "Inadequate Lockout/Tagout"];
        hazards = ["Fatal Electrocution", "Arc Flash Blast"];
        recommendations = [
          "Enforce zero-energy lockout/tagout (LOTO) at upstream distribution circuit breaker.",
          "Erect perimeter barricade and post 'DANGER - HIGH VOLTAGE' certified signage.",
          "Inspect and re-insulate exposed cabling in flame-retardant industrial conduit."
        ];
      } else if (/steam|flange|pressure|pipe|valve|leak|gasket/i.test(text)) {
        precursors = ["High-Pressure Fluid Line Compromise", "Flange Gasket Degradation"];
        hazards = ["High-Pressure Thermal Scald", "Piping System Depressurization Hazard"];
        recommendations = [
          "Isolate upstream line valves and depressurize affected pipe section immediately.",
          "Deploy thermal splash blast shields and verify flange bolt torques per ASME B16.5.",
          "Replace corroded gasket with high-temp spiral-wound metallic gasket under hot-work permit."
        ];
      } else if (/fire|explosion|combustion|flammable|gas|cylinder/i.test(text)) {
        precursors = ["Flammable Gas / Vapor Accumulation", "Uncontrolled Ignition Source"];
        hazards = ["Catastrophic Vapor Cloud Explosion", "Thermal Radiation Injury"];
        recommendations = [
          "Isolate flammable gas supply headers and initiate continuous LEL combustible gas monitoring.",
          "Verify dry chemical fire suppression systems are armed and clear emergency access paths.",
          "Eliminate all hot work within 35 feet and ground all metal structures to prevent static spark."
        ];
      } else {
        precursors = isCritical
          ? ["High-Consequence Hazard Exposure", "Direct Line of Fire Exposure"]
          : ["Operational Hazard Exposure", "Administrative Control Deficiency"];
        hazards = isCritical
          ? ["Catastrophic Structural Failure", "Fatal Impact Risk"]
          : ["Workplace Injury Risk", "Operational Interruption"];
        recommendations = [
          "Conduct immediate frontline supervisor hazard walkthrough and isolate immediate work zone.",
          "Log findings in plant EHS incident management register and verify PPE compliance.",
          "Schedule formal job safety analysis (JSA) and issue corrective action work order."
        ];
      }

      explanation = `Automated SIF classification calculated risk score ${riskScore}/100 (${riskLevel}) for ${location}. Priority response mandated under OSHA 1910.`;
    }

    const reportTitle = title || (description ? description.slice(0, 60) : `Hazard Report - ${location || "Sector 4"}`);

    const newReport = await dbReports.create({
      title: reportTitle,
      description: description || "Hazard observation submitted from field.",
      location: location || "Industrial Facility",
      category,
      severity: severity as any,
      risk_score: riskScore,
      risk_level: riskLevel,
      sif_probability: sifProbability,
      precursors,
      hazards,
      explanation,
      recommendations,
      imageUrl,
      audioUrl,
      status: riskLevel === "CRITICAL" ? "under_review" : "analysis_complete",
      submittedBy: user,
    });

    // Auto-generate high-risk alert for Safety Officer dashboard if Critical or High
    if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
      await dbAlerts.create({
        reportId: newReport._id,
        reportTitle: newReport.title,
        riskLevel: riskLevel as "CRITICAL" | "HIGH",
        riskScore: newReport.risk_score,
        sifProbability: newReport.sif_probability,
        message: `${riskLevel} SIF HAZARD: ${newReport.title} at ${newReport.location}`,
        precursors: newReport.precursors,
        hazards: newReport.hazards,
        recommendations: newReport.recommendations,
        explanation: newReport.explanation,
        location: newReport.location,
        submittedBy: user.name,
        isAcknowledged: false,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: newReport,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Failed to submit report:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit report" },
      { status: 500 }
    );
  }
}
