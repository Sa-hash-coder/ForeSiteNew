import { NextRequest, NextResponse } from "next/server";
import { dbReports, dbAlerts, connectToDatabase } from "@/app/lib/db";
import { verifyToken } from "@/app/lib/security";
import mongoose from "mongoose";

// MongoDB Models
const UserSubmissionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    location: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        "near_miss",
        "unsafe_condition",
        "unsafe_act",
        "equipment_failure",
        "chemical_exposure",
        "other",
      ],
      default: "other",
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    imageUrl: { type: String, default: null },
    audioUrl: { type: String, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, default: null },
    userEmail: { type: String, default: null },
    department: { type: String, default: null },
    status: {
      type: String,
      enum: [
        "pending_analysis",
        "analysis_complete",
        "under_review",
        "action_assigned",
        "resolved",
        "closed",
      ],
      default: "pending_analysis",
    },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: "MEDIUM" },
    sifProbability: { type: Number, default: 0 },
    precursors: { type: [String], default: [] },
    hazards: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    explanation: { type: String, default: "" },
    rawData: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: false }
);

const UserSubmission =
  mongoose.models.UserSubmission || mongoose.model("UserSubmission", UserSubmissionSchema, "reports");

export function getSmartRemediationTasks(category?: string, text?: string, precursors?: string[]): string[] {
  const t = (text || "").toLowerCase();
  const c = (category || "").toLowerCase();
  const p = (precursors || []).join(" ").toLowerCase();
  const combined = `${t} ${c} ${p}`;

  if (/scaffold|fall|ladder|height|roof|harness|plank|platform/i.test(combined) || c === "fall") {
    return [
      "Red-tag scaffold as 'DO NOT USE' until re-inspected by certified competent person under OSHA 1926.451.",
      "Install 4-inch toe boards, midrails, and verify 100% harness tie-off compliance.",
      "Inspect all structural cross-bracing and anchor tie-ins to permanent walls."
    ];
  }
  if (/steam|boiler|pressure|flange|pipe|leak|valve|psi|gasket|thermal/i.test(combined)) {
    return [
      "Depressurize line to 0 PSI and verify zero stored thermal energy before loosening couplings.",
      "Deploy certified mechanical team in Level B thermal PPE to replace damaged spiral-wound gasket.",
      "Torque flange studs in cross-star pattern to specified torque and perform ultrasonic leak check."
    ];
  }
  if (/wire|electric|voltage|conduit|breaker|loto|cable|shock|energiz/i.test(combined) || c === "electrical") {
    return [
      "Lock out and tag out (LOTO) primary electrical feed at source panel and verify Zero Energy State.",
      "Erect red boundary perimeter barricades with 'DANGER - HIGH VOLTAGE' warning placards.",
      "Replace damaged wiring with IP67-rated industrial conduit and perform insulation resistance test."
    ];
  }
  if (/bearing|vibration|pump|motor|gear|shaft|conveyor|rotating|nip/i.test(combined) || c === "machinery") {
    return [
      "Halt drive unit immediately and isolate electrical drive under lockout/tagout protocol.",
      "Perform high-resolution FFT vibration spectral analysis to identify bearing race degradation.",
      "Flush lubrication reservoir, install replacement bearing assembly, and verify shaft alignment."
    ];
  }
  if (/chemical|acid|toxic|spill|fume|gas|corrosive|drum|drain/i.test(combined) || c === "chemical" || c === "chemical_exposure") {
    return [
      "Deploy emergency spill containment kit, place absorbent berms, and evacuate non-essential personnel.",
      "Don Level B chemical protective suits, full-face respirators, and chemical-resistant gloves.",
      "Neutralize pooled chemical substance, verify atmosphere with multi-gas detector, and log manifest."
    ];
  }
  if (/fire|smoke|flame|combustible|extinguisher/i.test(combined) || c === "fire") {
    return [
      "Activate local sector fire alarm and clear combustible materials within 35-foot perimeter.",
      "Verify operability of automatic deluge/sprinkler valves and inspect all fire hose stations.",
      "Post 24-hour continuous fire watch personnel until fire suppression system recertification is signed."
    ];
  }
  return [
    "Dispatch area safety supervisor to establish a controlled perimeter around the reported hazard.",
    "Halt affected operations under Stop-Work Authority until a competent person inspection is completed.",
    "Issue preventive maintenance order to inspect, repair, and verify clearance before resuming service."
  ];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const riskLevel = searchParams.get("riskLevel") || undefined;
    const category = searchParams.get("category") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);

    // Try MongoDB first, fallback to local JSON
    let reports = [];
    let total = 0;

    try {
      await connectToDatabase();
      const query: any = {};
      if (status) query.status = status;
      if (riskLevel) query.riskLevel = riskLevel;
      if (category) query.category = category;

      const skip = (page - 1) * limit;
      const [mongoReports, mongoTotal] = await Promise.all([
        UserSubmission.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        UserSubmission.countDocuments(query),
      ]);

      reports = mongoReports.map((r: any) => {
        const computedLevel = r.riskLevel || r.risk_level || (r.severity === "critical" ? "CRITICAL" : r.severity === "high" ? "HIGH" : "MEDIUM");
        const computedScore = r.riskScore ?? r.risk_score ?? (computedLevel === "CRITICAL" ? 88 : computedLevel === "HIGH" ? 72 : 45);
        const computedSif = r.sifProbability ?? r.sif_probability ?? (computedLevel === "CRITICAL" ? 0.85 : computedLevel === "HIGH" ? 0.65 : 0.25);
        const recs = r.recommendations || (r as any).riskAssessment?.recommendations || [];
        const precs = r.precursors || (r as any).riskAssessment?.precursors || [];
        const expl = r.explanation || (r as any).riskAssessment?.explanation || "";
        return {
          _id: r._id,
          title: r.title,
          location: r.location,
          category: r.category,
          severity: r.severity,
          status: r.status,
          createdAt: r.createdAt,
          recommendations: recs,
          precursors: precs,
          explanation: expl,
          riskAssessment: {
            riskScore: computedScore,
            riskLevel: computedLevel,
            sifProbability: computedSif,
            precursors: precs,
            hazards: r.hazards || [],
            explanation: expl,
            recommendations: recs,
          },
          submittedBy: r.submittedBy,
        };
      });
      total = mongoTotal;
    } catch (mongoErr) {
      console.warn("MongoDB unavailable, falling back to local JSON store:", mongoErr);
      const result = await dbReports.list({ status, riskLevel, category, limit, page });
      reports = result.reports.map((r) => {
        const computedLevel = r.risk_level || (r.severity === "critical" ? "CRITICAL" : r.severity === "high" ? "HIGH" : "MEDIUM");
        const computedScore = r.risk_score ?? (computedLevel === "CRITICAL" ? 88 : computedLevel === "HIGH" ? 72 : 45);
        const computedSif = r.sif_probability ?? (computedLevel === "CRITICAL" ? 0.85 : computedLevel === "HIGH" ? 0.65 : 0.25);
        const recs = (r as any).recommendations || (r as any).riskAssessment?.recommendations || [];
        const precs = (r as any).precursors || (r as any).riskAssessment?.precursors || [];
        const expl = (r as any).explanation || (r as any).riskAssessment?.explanation || "";
        return {
          _id: r._id,
          title: r.title,
          location: r.location,
          category: r.category,
          severity: r.severity,
          status: r.status,
          createdAt: r.createdAt,
          recommendations: recs,
          precursors: precs,
          explanation: expl,
          riskAssessment: {
            riskScore: computedScore,
            riskLevel: computedLevel,
            sifProbability: computedSif,
            precursors: precs,
            hazards: r.hazards || [],
            explanation: expl,
            recommendations: recs,
          },
          submittedBy: r.submittedBy,
        };
      });
      total = result.total;
    }

    return NextResponse.json({
      success: true,
      data: reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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
          description:
            description && description.length >= 10
              ? description
              : `${description || "Hazard reported"} in ${location || "plant"}`,
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
      const combinedText = `${title || ""} ${description || ""}`.toLowerCase();

      const isMinorCosmetic =
        /\b(paint|peeling|flicker|flickering|tube light|bulb|light bulb|dim light|burnt bulb|cosmetic|trash|litter|water bottle|dust|cleaning|dirty|smudge)\b/i.test(combinedText) &&
        !/\b(fire|explosion|toxic|gas leak|electric shock|480v|high voltage|electrocution|amputation|crush)\b/i.test(combinedText);

      const isCritical =
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
        !isMinorCosmetic && !isCritical && !isSlipNearStairs && (
          severity === "high" ||
          /\b(steam leak|high pressure|flange leak|chemical spill|acid|corrosive|bearing failure|heavy vibration|damaged stair|broken stair|missing guardrail)\b/i.test(combinedText)
        );

      const isGeneralSlip =
        !isMinorCosmetic &&
        /\b(wet floor|slippery|water spill|puddle|liquid spill|trip|cluttered)\b/i.test(combinedText);

      if (isMinorCosmetic) {
        riskLevel = "LOW";
        riskScore = 18;
        sifProbability = 0.08;
        precursors = ["General Facility Illumination / Housekeeping"];
        hazards = ["Minor First Aid Event / Visibility Inconvenience"];
        explanation = `Minor housekeeping or illumination observation (${combinedText.slice(0, 45)}...). Low danger with negligible SIF risk. Standard maintenance routine applies.`;
      } else if (isCritical) {
        riskLevel = "CRITICAL";
        riskScore = 88;
        sifProbability = 0.85;
        precursors = /wire|electr/i.test(combinedText)
          ? ["Energized Equipment Exposure", "Proximity to Electrical Hazard"]
          : /fall|scaffold|railing|roof|edge/i.test(combinedText)
          ? ["Working at Height / Unsecured Perimeter", "Direct Line of Fire Exposure"]
          : ["Fire and Explosion SIF Precursor", "Critical Process Safety Failure"];
        hazards = /wire|electr/i.test(combinedText)
          ? ["Electrocution", "Arc Flash"]
          : /fall|scaffold|railing|roof|edge/i.test(combinedText)
          ? ["Fatal Fall Impact", "Severe Trauma"]
          : ["Catastrophic Fire Damage", "Fatal Inhalation / Thermal Burn"];
        explanation = `CRITICAL SIF PRECURSOR identified. Immediate life-safety intervention mandated under OSHA 1910 / 1926 standards.`;
      } else if (isSlipNearStairs || isHigh) {
        riskLevel = "HIGH";
        riskScore = isSlipNearStairs ? 65 : 72;
        sifProbability = isSlipNearStairs ? 0.55 : 0.62;
        precursors = isSlipNearStairs
          ? ["Slippery Walkways at Elevated Staircase", "Stairway Slip and Fall Precursor"]
          : ["Mechanical Component Degradation", "Fluid Pressure Anomaly"];
        hazards = isSlipNearStairs
          ? ["Stairway Fall Trauma", "Fracture / Impact Injury"]
          : ["Unplanned Machine Trip", "Hot Fluid Contact"];
        explanation = isSlipNearStairs
          ? `Wet slippery floor directly adjacent to stairs presents elevated fall and trauma risk. Immediate barricading and dry-mopping required.`
          : `High operational risk detected. Prompt supervisor inspection and corrective action required within shift.`;
      } else if (isGeneralSlip || severity === "medium") {
        riskLevel = "MEDIUM";
        riskScore = 42;
        sifProbability = 0.28;
        precursors = ["Slippery Walkways and Minor Trip Hazards"];
        hazards = ["Same-Level Slip and Fall", "Minor Contusion"];
        explanation = `Slippery walkway condition on same level. Non-fatal trip/slip risk. Yellow caution cone and cleanup required.`;
      } else {
        riskLevel = "LOW";
        riskScore = 24;
        sifProbability = 0.12;
        precursors = ["Operational Maintenance"];
        hazards = ["Minor Operational Delay"];
        explanation = `Routine facility observation. Standard operational follow-up.`;
      }
    }

    if (!recommendations || recommendations.length === 0) {
      recommendations = getSmartRemediationTasks(category, `${title || ""} ${description || ""}`, precursors);
    }

    const reportTitle = (title && title.trim()) || (description && description.trim()) || `Hazard Report - ${location || "Sector 4"}`;

    let savedReport: any = null;

    // Try to save to MongoDB first
    try {
      await connectToDatabase();
      const mongoReport = await UserSubmission.create({
        title: reportTitle,
        description: description || "Hazard observation submitted from field.",
        location: location || "Industrial Facility",
        category,
        severity: severity as any,
        riskScore,
        riskLevel,
        sifProbability,
        precursors,
        hazards,
        recommendations,
        explanation,
        imageUrl,
        audioUrl,
        status: riskLevel === "CRITICAL" ? "under_review" : "analysis_complete",
        submittedBy: user._id !== "usr_guest" ? user._id : null,
        userName: user.name,
        userEmail: user._id !== "usr_guest" ? undefined : null,
        department: user.department,
        rawData: body,
      });

      savedReport = mongoReport.toObject();
      console.log("✅ Report saved to MongoDB:", mongoReport._id);
    } catch (mongoErr) {
      // Fallback to local JSON store if MongoDB fails
      console.warn("MongoDB save failed, falling back to local JSON store:", mongoErr);

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
        recommendations,
        explanation,
        imageUrl,
        audioUrl,
        status: riskLevel === "CRITICAL" ? "under_review" : "analysis_complete",
        submittedBy: user,
      });

      savedReport = newReport;
      console.log("⚠️  Report saved to local JSON store:", newReport._id);
    }

    // Auto-generate high-risk alert for Safety Officer dashboard if Critical or High
    if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
      try {
        await dbAlerts.create({
          reportId: savedReport._id,
          reportTitle: reportTitle,
          riskLevel: riskLevel as "CRITICAL" | "HIGH",
          riskScore: riskScore,
          sifProbability: sifProbability,
          message: `${riskLevel} SIF HAZARD: ${reportTitle} at ${location}`,
          precursors,
          hazards,
          recommendations,
          explanation,
          location,
          submittedBy: user.name,
          isAcknowledged: false,
        });
      } catch (alertErr) {
        console.warn("Failed to create alert:", alertErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: savedReport,
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
