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
      const isCritical =
        severity === "critical" ||
        (description && /fall|fire|explosion|collapse|gas|electrocution|leak/i.test(description));
      const isHigh = severity === "high" || (description && /crack|vibration|spill|high pressure/i.test(description));

      riskLevel = isCritical ? "CRITICAL" : isHigh ? "HIGH" : severity === "low" ? "LOW" : "MEDIUM";
      riskScore = isCritical ? 88 : isHigh ? 72 : 38;
      sifProbability = isCritical ? 0.85 : isHigh ? 0.62 : 0.25;
      precursors = isCritical
        ? ["Working at Height / Unsecured Perimeter", "Direct Line of Fire Exposure"]
        : isHigh
        ? ["Mechanical Component Degradation", "Fluid Pressure Anomaly"]
        : ["Operational Fatigue"];
      hazards = isCritical
        ? ["Catastrophic Structural Failure", "Fatal Fall Impact"]
        : isHigh
        ? ["Unplanned Machine Trip", "Hot Fluid Contact"]
        : ["Minor First Aid Event"];
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
