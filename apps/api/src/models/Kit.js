import { Schema, model, Types } from "mongoose";

const kitDocSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "generating", "ready", "failed"],
      default: "pending",
    },
    input: {
      jd: { type: String, required: true },
      companyUrl: { type: String, required: true },
      days: { type: Number, required: true },
    },
    // Appendix A structure, stored as-is (validated with zod before saving).
    kit: { type: Schema.Types.Mixed, default: null },
    // generated/edited/pinned tracking — see src/state/kitState.js.
    meta: { type: Schema.Types.Mixed, default: null },
    // Cached retrieval context so a single-section regenerate does not
    // require re-crawling the company site.
    research: { type: Schema.Types.Mixed, default: null },
    warnings: { type: [String], default: [] },
    // Practice-mode confidence log, keyed by flashcard id.
    practice: { type: Schema.Types.Mixed, default: {} },
    error: {
      code: { type: String },
      message: { type: String },
    },
    // Guards against the same description+company being submitted twice
    // in quick succession while a generation is already in flight.
    dedupeKey: { type: String, index: true },
  },
  { timestamps: true }
);

kitDocSchema.index({ userId: 1, dedupeKey: 1 });

export const Kit = model("Kit", kitDocSchema);

export function makeDedupeKey(userId, jd, companyUrl) {
  const normalized = `${jd.trim().toLowerCase()}::${companyUrl.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `${userId}:${hash}`;
}

export { Types };
