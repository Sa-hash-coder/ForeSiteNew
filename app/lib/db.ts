import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { hashPassword } from "./security";

const MONGO_URI = process.env.MONGO_URI;

let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = {
    conn: null,
    promise: null,
    isFallback: false,
  };
}

// ─── Local Resilient Store Path ─────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "foresite_db.json");

export interface StoredUser {
  _id: string;
  name: string;
  email: string;
  password: string; // salt:hash
  role: "worker" | "safety_officer" | "officer" | "maintenance" | "admin";
  department?: string;
  badgeId: string;
  createdAt: string;
}

export interface StoredReport {
  _id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  risk_score: number;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  sif_probability: number;
  precursors: string[];
  hazards: string[];
  explanation: string;
  recommendations?: string[];
  imageUrl?: string;
  audioUrl?: string;
  status: "pending_analysis" | "analysis_complete" | "under_review" | "action_assigned" | "resolved" | "closed";
  submittedBy: {
    _id: string;
    name: string;
    role: string;
    department?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StoredAlert {
  _id: string;
  reportId: string;
  reportTitle: string;
  riskLevel: "CRITICAL" | "HIGH";
  riskScore: number;
  sifProbability: number;
  message: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  precursors?: string[];
  hazards?: string[];
  recommendations?: string[];
  explanation?: string;
  location?: string;
  category?: string;
  zone?: string;
  submittedBy?: string;
  createdAt: string;
}

export interface StoredTask {
  _id: string;
  orderNumber: string;
  reportId?: string;
  title: string;
  description: string;
  equipmentId: string;
  equipmentName: string;
  location: string;
  zone: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "dispatched" | "in_progress" | "clearance_submitted" | "officer_verified";
  assignedCrew: string;
  dispatchedBy: {
    name: string;
    role: string;
    badgeId: string;
  };
  safetyPermitId: string;
  lotoRequired: boolean;
  clearanceNote?: string;
  createdAt: string;
  updatedAt: string;
}

interface LocalDatabase {
  users: StoredUser[];
  reports: StoredReport[];
  alerts: StoredAlert[];
  tasks: StoredTask[];
}

function getInitialDatabase(): LocalDatabase {
  const now = new Date().toISOString();
  return {
    users: [
      {
        _id: "usr_worker_01",
        name: "Rajan Mehta",
        email: "worker@plant.com",
        password: hashPassword("password123"),
        role: "worker",
        department: "Operations · Boiler Room B",
        badgeId: "WRK-1082",
        createdAt: now,
      },
      {
        _id: "usr_officer_01",
        name: "Officer Vikram Sharma",
        email: "officer@plant.com",
        password: hashPassword("password123"),
        role: "officer",
        department: "HSE Central Command",
        badgeId: "SAF-4019",
        createdAt: now,
      },
      {
        _id: "usr_maint_01",
        name: "Devon Vance",
        email: "maintenance@plant.com",
        password: hashPassword("password123"),
        role: "maintenance",
        department: "Unit M-4 Reliability Team",
        badgeId: "MNT-4401",
        createdAt: now,
      },
    ],
    reports: [
      {
        _id: "rep_001",
        title: "TK-80 Scaffolding – Missing handrail & perimeter barrier",
        description: "Frontline walkdown noticed 3 meters of perimeter kickboards and outer handrail absent on Tier 3 scaffolding. High fall hazard (SIF Precursor).",
        location: "Sector 4 North, Tank Farm",
        category: "unsafe_condition",
        severity: "critical",
        risk_score: 92,
        risk_level: "CRITICAL",
        sif_probability: 0.88,
        precursors: ["Working at Height Exposure", "Missing Fall Restraint Barrier"],
        hazards: ["Fall from Elevation", "Fatal Traumatic Impact"],
        explanation: "Tier 3 elevation lacking certified guardrails poses immediate SIF risk under OSHA 1926.451.",
        status: "action_assigned",
        submittedBy: {
          _id: "usr_worker_01",
          name: "Rajan Mehta",
          role: "worker",
          department: "Boiler Room B",
        },
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        updatedAt: now,
      },
      {
        _id: "rep_002",
        title: "V-204 Hydrocracker – Radial vibration anomaly on bearing",
        description: "AI vibration telemetry flagged 4.8 mm/s radial spike on feed pump bearing housing.",
        location: "Process Area 2, Hydro Unit",
        category: "equipment_failure",
        severity: "high",
        risk_score: 78,
        risk_level: "HIGH",
        sif_probability: 0.65,
        precursors: ["Rotating Machinery Bearing Failure", "Hydrocarbon Seal Compromise"],
        hazards: ["Mechanical Catastrophic Seizure", "Volatile Fluid Release"],
        explanation: "Excessive vibration exceeds operational baseline threshold of 2.5 mm/s. Immediate balancing under LOTO required.",
        status: "action_assigned",
        submittedBy: {
          _id: "usr_worker_01",
          name: "Rajan Mehta",
          role: "worker",
          department: "Operations",
        },
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        updatedAt: now,
      },
      {
        _id: "rep_003",
        title: "EX-12 Flange Line – Minor oily condensation on lower joint",
        description: "Worker walkdown observed slight weeping and oily condensation on lower flange joint.",
        location: "Cracking Platform East",
        category: "unsafe_condition",
        severity: "medium",
        risk_score: 45,
        risk_level: "MEDIUM",
        sif_probability: 0.28,
        precursors: ["Flange Gasket Degradation"],
        hazards: ["Fluid Leakage", "Surface Slip"],
        explanation: "Low-pressure condensation detected. Requires torque check and optical gas imaging.",
        status: "under_review",
        submittedBy: {
          _id: "usr_worker_01",
          name: "Rajan Mehta",
          role: "worker",
          department: "Operations",
        },
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        updatedAt: now,
      },
    ],
    alerts: [
      {
        _id: "alt_001",
        reportId: "rep_001",
        reportTitle: "TK-80 Scaffolding – Missing handrail & perimeter barrier",
        riskLevel: "CRITICAL",
        riskScore: 92,
        sifProbability: 0.88,
        message: "CRITICAL SIF PRECURSOR: Working at height without certified perimeter guardrail in Sector 4.",
        isAcknowledged: false,
        precursors: ["Working at Height Exposure", "Missing Fall Restraint Barrier"],
        hazards: ["Fall from Elevation", "Fatal Traumatic Impact"],
        recommendations: [
          "Red-tag scaffolding and immediately suspend elevated work until inspected (OSHA 1926.451).",
          "Secure loose planks with certified scaffolding clamps and install 42-inch top guardrails with toe-boards.",
          "Enforce 100% tie-off using dual self-retracting lifelines (SRLs) anchored to certified structural points."
        ],
        explanation: "Tier 3 elevation lacking certified guardrails poses immediate SIF risk under OSHA 1926.451.",
        location: "Sector 4 North, Tank Farm",
        submittedBy: "Rajan Mehta",
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        _id: "alt_002",
        reportId: "rep_002",
        reportTitle: "V-204 Hydrocracker – Radial vibration anomaly on bearing",
        riskLevel: "HIGH",
        riskScore: 78,
        sifProbability: 0.65,
        message: "HIGH RISK TELEMETRY: 4.8 mm/s radial vibration spike on Hydrocracker Pump C.",
        isAcknowledged: true,
        acknowledgedBy: "Officer Vikram Sharma",
        acknowledgedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        precursors: ["Rotating Machinery Bearing Failure", "Mechanical Component Degradation"],
        hazards: ["Mechanical Catastrophic Seizure", "Projectile / Fragmentation Risk"],
        recommendations: [
          "Initiate controlled operational throttling/shutdown of unit to prevent catastrophic bearing seizure.",
          "Conduct spectrum vibration FFT analysis and laser shaft alignment on bearing housing.",
          "Inspect lubrication reservoir for metal particles and replace degraded bearings under LOTO protocol."
        ],
        explanation: "Excessive vibration exceeds operational baseline threshold of 2.5 mm/s. Immediate balancing under LOTO required.",
        location: "Process Area 2, Hydro Unit",
        submittedBy: "Rajan Mehta",
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
    ],
    tasks: [
      {
        _id: "tsk_001",
        orderNumber: "WO-9038",
        reportId: "rep_001",
        title: "TK-80 Scaffolding – Replace outer handrails & safety gates",
        description: "Erect certified 42-inch top-rails, mid-rails, and toe-boards on Tier 3 access walk.",
        equipmentId: "TK-80",
        equipmentName: "Crude Storage Tank Scaffolding",
        location: "Sector 4 North, Tank Farm",
        zone: "Zone TF-4",
        severity: "critical",
        status: "in_progress",
        assignedCrew: "Scaffolding & Rigging Team M-4",
        dispatchedBy: {
          name: "Officer Vikram Sharma",
          role: "Lead Safety Supervisor",
          badgeId: "SAF-4019",
        },
        safetyPermitId: "PTW-2026-0881",
        lotoRequired: true,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        updatedAt: now,
      },
      {
        _id: "tsk_002",
        orderNumber: "WO-9039",
        reportId: "rep_002",
        title: "V-204 Hydrocracker – Dynamic bearing balance & seal inspection",
        description: "Isolate 480V MCC breaker CB-440B under LOTO padlock. Inspect pump bearings.",
        equipmentId: "V-204",
        equipmentName: "Hydrocracker Reactor Vessel Pump C",
        location: "Process Area 2, Hydro Unit",
        zone: "Zone PR-2",
        severity: "high",
        status: "dispatched",
        assignedCrew: "Rotating Machinery Team M-4",
        dispatchedBy: {
          name: "Officer Priya Patel",
          role: "Operations Incident Officer",
          badgeId: "SAF-2184",
        },
        safetyPermitId: "PTW-2026-0879",
        lotoRequired: true,
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        updatedAt: now,
      },
    ],
  };
}

function loadLocalStore(): LocalDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = getInitialDatabase();
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const data = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading local db store, using memory fallback:", err);
    return getInitialDatabase();
  }
}

function saveLocalStore(db: LocalDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to local db store:", err);
  }
}

// ─── Mongoose Schemas & Models ─────────────────────────────────────────────

const UserSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    department: { type: String },
    badgeId: { type: String },
    createdAt: { type: String },
  },
  { _id: false, timestamps: false, strict: false }
);

const ReportSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, required: true },
    severity: { type: String, required: true },
    risk_score: { type: Number, default: 0 },
    risk_level: { type: String, default: "LOW" },
    sif_probability: { type: Number, default: 0 },
    precursors: [String],
    hazards: [String],
    explanation: { type: String, default: "" },
    recommendations: [String],
    imageUrl: { type: String },
    audioUrl: { type: String },
    status: { type: String, default: "pending_analysis" },
    submittedBy: {
      _id: String,
      name: String,
      role: String,
      department: String,
    },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { _id: false, timestamps: false, strict: false }
);

const AlertSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    reportId: { type: String, required: true },
    reportTitle: { type: String, required: true },
    riskLevel: { type: String, required: true },
    riskScore: { type: Number, required: true },
    sifProbability: { type: Number, required: true },
    message: { type: String, required: true },
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: String },
    acknowledgedAt: { type: String },
    precursors: [String],
    hazards: [String],
    recommendations: [String],
    explanation: { type: String },
    location: { type: String },
    category: { type: String },
    zone: { type: String },
    submittedBy: { type: String },
    createdAt: { type: String },
  },
  { _id: false, timestamps: false, strict: false }
);

const TaskSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    orderNumber: { type: String, required: true },
    reportId: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    equipmentId: { type: String, required: true },
    equipmentName: { type: String, required: true },
    location: { type: String, required: true },
    zone: { type: String, required: true },
    severity: { type: String, required: true },
    status: { type: String, required: true },
    assignedCrew: { type: String, required: true },
    dispatchedBy: {
      name: String,
      role: String,
      badgeId: String,
    },
    safetyPermitId: { type: String, required: true },
    lotoRequired: { type: Boolean, default: false },
    clearanceNote: { type: String },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { _id: false, timestamps: false, strict: false }
);

export const UserModel = mongoose.models.ForesiteUser || mongoose.model("ForesiteUser", UserSchema, "users");
export const ReportModel = mongoose.models.ForesiteReport || mongoose.model("ForesiteReport", ReportSchema, "reports");
export const AlertModel = mongoose.models.ForesiteAlert || mongoose.model("ForesiteAlert", AlertSchema, "alerts");
export const TaskModel = mongoose.models.ForesiteTask || mongoose.model("ForesiteTask", TaskSchema, "tasks");

let initialSyncDone = false;
async function syncLocalToMongo() {
  if (initialSyncDone) return;
  try {
    const local = loadLocalStore();
    const userCount = await UserModel.countDocuments();
    if (userCount === 0 && local.users.length > 0) {
      console.log(`[DB] Seeding ${local.users.length} users to MongoDB...`);
      await UserModel.insertMany(local.users);
    }
    const reportCount = await ReportModel.countDocuments();
    if (reportCount === 0 && local.reports.length > 0) {
      console.log(`[DB] Seeding ${local.reports.length} reports to MongoDB...`);
      await ReportModel.insertMany(local.reports);
    }
    const alertCount = await AlertModel.countDocuments();
    if (alertCount === 0 && local.alerts.length > 0) {
      console.log(`[DB] Seeding ${local.alerts.length} alerts to MongoDB...`);
      await AlertModel.insertMany(local.alerts);
    }
    const taskCount = await TaskModel.countDocuments();
    if (taskCount === 0 && local.tasks.length > 0) {
      console.log(`[DB] Seeding ${local.tasks.length} tasks to MongoDB...`);
      await TaskModel.insertMany(local.tasks);
    }
    initialSyncDone = true;
    console.log("[DB] MongoDB synchronization verified.");
  } catch (err) {
    console.warn("[DB] Initial sync to MongoDB encountered an error:", err);
  }
}

// ─── Unified Database Connection ───────────────────────────────────────────

let lastFailedAttempt = 0;
const RETRY_INTERVAL_MS = 30000;

export async function connectToDatabase() {
  if (!MONGO_URI) {
    cached.isFallback = true;
    return null;
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If recently failed, skip waiting to avoid blocking requests
  if (cached.isFallback && Date.now() - lastFailedAttempt < RETRY_INTERVAL_MS) {
    return null;
  }

  try {
    if (!cached.promise) {
      cached.promise = mongoose.connect(MONGO_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 2000,
      });
    }
    cached.conn = await cached.promise;
    cached.isFallback = false;
    await syncLocalToMongo();
    return cached.conn;
  } catch (err) {
    console.warn("[DB] MongoDB connection unavailable. Falling back to resilient local JSON store.");
    cached.isFallback = true;
    cached.promise = null;
    cached.conn = null;
    lastFailedAttempt = Date.now();
    return null;
  }
}

// ─── Data Access Helpers (Dual-Persistence Across Mongo & Local Store) ─────

export const dbUsers = {
  async findByEmail(email: string): Promise<StoredUser | null> {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const u = await UserModel.findOne({ email: new RegExp(`^${email.trim()}$`, "i") }).lean();
        if (u) return u as StoredUser;
      }
    } catch {
      // Gracefully fall back to local JSON store
    }
    const db = loadLocalStore();
    return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  },

  async findById(id: string): Promise<StoredUser | null> {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const u = await UserModel.findOne({ _id: id }).lean();
        if (u) return u as StoredUser;
      }
    } catch {
      // Gracefully fall back to local JSON store
    }
    const db = loadLocalStore();
    return db.users.find((u) => u._id === id) || null;
  },

  async create(userData: Omit<StoredUser, "_id" | "createdAt">): Promise<StoredUser> {
    const db = loadLocalStore();
    const newUser: StoredUser = {
      ...userData,
      _id: "usr_" + Math.random().toString(36).substring(2, 10),
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    saveLocalStore(db);

    try {
      const conn = await connectToDatabase();
      if (conn) {
        await UserModel.create(newUser);
      }
    } catch (e) {
      console.warn("[DB] User persisted locally (MongoDB write bypassed):", e);
    }
    return newUser;
  },

  async list(): Promise<StoredUser[]> {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const users = await UserModel.find().lean();
        if (users && users.length > 0) return users as StoredUser[];
      }
    } catch {
      // Fallback
    }
    const db = loadLocalStore();
    return db.users;
  },
};

export const dbReports = {
  async list(filters?: { status?: string; riskLevel?: string; category?: string; limit?: number; page?: number }) {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const query: any = {};
        if (filters?.status) query.status = filters.status;
        if (filters?.riskLevel) query.risk_level = filters.riskLevel;
        if (filters?.category) query.category = filters.category;

        const page = filters?.page || 1;
        const limit = filters?.limit || 50;
        const skip = (page - 1) * limit;

        const total = await ReportModel.countDocuments(query);
        const reports = await ReportModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        if (reports && reports.length > 0) {
          return { reports: reports as StoredReport[], total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
        }
      }
    } catch {
      // Gracefully fall back to local JSON store
    }

    const db = loadLocalStore();
    let result = [...db.reports];

    if (filters?.status) {
      result = result.filter((r) => r.status === filters.status);
    }
    if (filters?.riskLevel) {
      result = result.filter((r) => r.risk_level === filters.riskLevel);
    }
    if (filters?.category) {
      result = result.filter((r) => r.category === filters.category);
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = result.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;
    const paginated = result.slice(skip, skip + limit);

    return { reports: paginated, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  },

  async findById(id: string): Promise<StoredReport | null> {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const r = await ReportModel.findOne({ _id: id }).lean();
        if (r) return r as StoredReport;
      }
    } catch {
      // Gracefully fall back to local JSON store
    }
    const db = loadLocalStore();
    return db.reports.find((r) => r._id === id) || null;
  },

  async create(reportData: Omit<StoredReport, "_id" | "createdAt" | "updatedAt">): Promise<StoredReport> {
    const db = loadLocalStore();
    const now = new Date().toISOString();
    const newReport: StoredReport = {
      ...reportData,
      _id: "rep_" + Math.random().toString(36).substring(2, 10),
      createdAt: now,
      updatedAt: now,
    };
    db.reports.unshift(newReport);
    saveLocalStore(db);

    try {
      const conn = await connectToDatabase();
      if (conn) {
        await ReportModel.create(newReport);
      }
    } catch (e) {
      console.warn("[DB] Report persisted locally (MongoDB write bypassed):", e);
    }
    return newReport;
  },

  async updateById(id: string, updates: Partial<StoredReport>): Promise<StoredReport | null> {
    const db = loadLocalStore();
    const idx = db.reports.findIndex((r) => r._id === id);
    if (idx !== -1) {
      db.reports[idx] = {
        ...db.reports[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      saveLocalStore(db);
    }

    try {
      const conn = await connectToDatabase();
      if (conn) {
        await ReportModel.updateOne(
          { _id: id },
          { $set: { ...updates, updatedAt: new Date().toISOString() } }
        );
      }
    } catch (e) {
      console.warn("[DB] Could not update report in MongoDB:", e);
    }
    return idx !== -1 ? db.reports[idx] : null;
  },
};

export const dbAlerts = {
  async list(unacknowledgedOnly = false): Promise<StoredAlert[]> {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const query = unacknowledgedOnly ? { isAcknowledged: false } : {};
        const alerts = await AlertModel.find(query).sort({ createdAt: -1 }).lean();
        if (alerts && alerts.length > 0) return alerts as StoredAlert[];
      }
    } catch {
      // Gracefully fall back
    }
    const db = loadLocalStore();
    let list = [...db.alerts];
    if (unacknowledgedOnly) {
      list = list.filter((a) => !a.isAcknowledged);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async create(alertData: Omit<StoredAlert, "_id" | "createdAt">): Promise<StoredAlert> {
    const db = loadLocalStore();
    const newAlert: StoredAlert = {
      ...alertData,
      _id: "alt_" + Math.random().toString(36).substring(2, 10),
      createdAt: new Date().toISOString(),
    };
    db.alerts.unshift(newAlert);
    saveLocalStore(db);

    try {
      const conn = await connectToDatabase();
      if (conn) {
        await AlertModel.create(newAlert);
      }
    } catch (e) {
      console.warn("[DB] Alert persisted locally (MongoDB write bypassed):", e);
    }
    return newAlert;
  },

  async acknowledge(id: string, officerName: string, state = true): Promise<StoredAlert | null> {
    const db = loadLocalStore();
    const idx = db.alerts.findIndex((a) => a._id === id);
    const now = new Date().toISOString();
    if (idx !== -1) {
      db.alerts[idx] = {
        ...db.alerts[idx],
        isAcknowledged: state,
        acknowledgedBy: state ? officerName : undefined,
        acknowledgedAt: state ? now : undefined,
      };
      saveLocalStore(db);
    }

    try {
      const conn = await connectToDatabase();
      if (conn) {
        await AlertModel.updateOne(
          { _id: id },
          {
            $set: {
              isAcknowledged: state,
              acknowledgedBy: state ? officerName : null,
              acknowledgedAt: state ? now : null,
            },
          }
        );
      }
    } catch (e) {
      console.warn("[DB] Could not update alert in MongoDB:", e);
    }
    return idx !== -1 ? db.alerts[idx] : null;
  },
};

export const dbTasks = {
  async list(filter?: { status?: string }): Promise<StoredTask[]> {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const query = filter?.status ? { status: filter.status } : {};
        const tasks = await TaskModel.find(query).sort({ createdAt: -1 }).lean();
        if (tasks && tasks.length > 0) return tasks as StoredTask[];
      }
    } catch {
      // Gracefully fall back
    }
    const db = loadLocalStore();
    let list = [...db.tasks];
    if (filter?.status) {
      list = list.filter((t) => t.status === filter.status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async findById(id: string): Promise<StoredTask | null> {
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const task = await TaskModel.findOne({ $or: [{ _id: id }, { orderNumber: id }] }).lean();
        if (task) return task as StoredTask;
      }
    } catch {
      // Gracefully fall back
    }
    const db = loadLocalStore();
    return db.tasks.find((t) => t._id === id || t.orderNumber === id) || null;
  },

  async create(taskData: Omit<StoredTask, "_id" | "createdAt" | "updatedAt">): Promise<StoredTask> {
    const db = loadLocalStore();
    const now = new Date().toISOString();
    const orderNum = "WO-" + (9040 + db.tasks.length);
    const newTask: StoredTask = {
      ...taskData,
      orderNumber: taskData.orderNumber || orderNum,
      _id: "tsk_" + Math.random().toString(36).substring(2, 10),
      createdAt: now,
      updatedAt: now,
    };
    db.tasks.unshift(newTask);
    saveLocalStore(db);

    try {
      const conn = await connectToDatabase();
      if (conn) {
        await TaskModel.create(newTask);
      }
    } catch (e) {
      console.warn("[DB] Task persisted locally (MongoDB write bypassed):", e);
    }
    return newTask;
  },

  async updateStatus(id: string, status: StoredTask["status"], clearanceNote?: string): Promise<StoredTask | null> {
    const db = loadLocalStore();
    const idx = db.tasks.findIndex((t) => t._id === id || t.orderNumber === id);
    const now = new Date().toISOString();
    if (idx !== -1) {
      db.tasks[idx] = {
        ...db.tasks[idx],
        status,
        ...(clearanceNote ? { clearanceNote } : {}),
        updatedAt: now,
      };
      saveLocalStore(db);
    }

    try {
      const conn = await connectToDatabase();
      if (conn) {
        await TaskModel.updateOne(
          { $or: [{ _id: id }, { orderNumber: id }] },
          {
            $set: {
              status,
              ...(clearanceNote ? { clearanceNote } : {}),
              updatedAt: now,
            },
          }
        );
      }
    } catch (e) {
      console.warn("[DB] Could not update task in MongoDB:", e);
    }
    return idx !== -1 ? db.tasks[idx] : null;
  },
};

export const dbStats = {
  async getDashboardStats() {
    const db = loadLocalStore();
    const totalReports = db.reports.length;
    const criticalAlerts = db.alerts.filter((a) => !a.isAcknowledged && a.riskLevel === "CRITICAL").length;
    const openTasks = db.tasks.filter((t) => t.status === "dispatched" || t.status === "in_progress").length;
    const resolvedToday = db.tasks.filter((t) => t.status === "clearance_submitted" || t.status === "officer_verified").length;

    const riskDistribution = {
      CRITICAL: db.reports.filter((r) => r.risk_level === "CRITICAL").length,
      HIGH: db.reports.filter((r) => r.risk_level === "HIGH").length,
      MEDIUM: db.reports.filter((r) => r.risk_level === "MEDIUM").length,
      LOW: db.reports.filter((r) => r.risk_level === "LOW").length,
    };

    return {
      stats: {
        totalReports,
        criticalAlerts,
        openTasks,
        resolvedToday,
      },
      recentReports: db.reports.slice(0, 5),
      recentAlerts: db.alerts.slice(0, 5),
      riskDistribution,
    };
  },
};

