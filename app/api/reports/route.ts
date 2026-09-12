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
  { timestamps: true }
);

const UserSubmission =
  mongoose.models.UserSubmission || mongoose.model("UserSubmission", UserSubmissionSchema, "test");

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

      reports = mongoReports.map((r: any) => ({
        _id: r._id,
        title: r.title,
        location: r.location,
        category: r.category,
        severity: r.severity,
        status: r.status,
        createdAt: r.createdAt,
        riskAssessment: {
          riskScore: r.riskScore,
          riskLevel: r.riskLevel,
          sifProbability: r.sifProbability,
          precursors: r.precursors,
          hazards: r.hazards,
          explanation: r.explanation,
        },
        submittedBy: r.submittedBy,
      }));
      total = mongoTotal;
    } catch (mongoErr) {
      console.warn("MongoDB unavailable, falling back to local JSON store:", mongoErr);
      const result = await dbReports.list({ status, riskLevel, category, limit, page });
      reports = result.reports.map((r) => ({
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
      }));
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
      const isCritical =
        severity === "critical" ||
        (description && /fall|fire|explosion|collapse|gas|electrocution|leak/i.test(description));
      const isHigh =
        severity === "high" || (description && /crack|vibration|spill|high pressure/i.test(description));

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
