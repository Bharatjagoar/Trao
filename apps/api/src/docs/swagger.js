import swaggerJSDoc from "swagger-jsdoc";

const schemas = {
  Error: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
  User: {
    type: "object",
    properties: {
      id: { type: "string" },
      email: { type: "string" },
    },
  },
  Requirement: {
    type: "object",
    properties: {
      id: { type: "string" },
      text: { type: "string" },
      kind: { type: "string", enum: ["technical", "behavioural", "domain"] },
      priority: { type: "string", enum: ["must", "nice"] },
    },
  },
  Question: {
    type: "object",
    properties: {
      id: { type: "string" },
      requirement_ids: { type: "array", items: { type: "string" } },
      category: {
        type: "string",
        enum: ["technical", "behavioural", "system-design", "company-fit"],
      },
      prompt: { type: "string" },
      answer_outline: { type: "string" },
      difficulty: { type: "integer", minimum: 1, maximum: 3 },
    },
  },
  Flashcard: {
    type: "object",
    properties: {
      id: { type: "string" },
      front: { type: "string" },
      back: { type: "string" },
      requirement_ids: { type: "array", items: { type: "string" } },
    },
  },
  ScheduleDay: {
    type: "object",
    properties: {
      day: { type: "integer" },
      focus: { type: "string" },
      question_ids: { type: "array", items: { type: "string" } },
      minutes: { type: "integer" },
    },
  },
  Kit: {
    type: "object",
    description: "Appendix A structure — the generated interview prep kit.",
    properties: {
      source: {
        type: "object",
        properties: {
          company: { type: "string" },
          company_url: { type: "string" },
          role: { type: "string" },
          location: { type: "string" },
          jd_chars: { type: "integer" },
          researched_at: { type: "string", format: "date-time" },
          pages_used: { type: "array", items: { type: "string" } },
        },
      },
      company_brief: {
        type: "object",
        properties: {
          summary: { type: "string" },
          what_they_do: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
        },
      },
      role: {
        type: "object",
        properties: {
          title: { type: "string" },
          seniority: { type: "string" },
          responsibilities: { type: "array", items: { type: "string" } },
          requirements: { type: "array", items: { $ref: "#/components/schemas/Requirement" } },
        },
      },
      questions: { type: "array", items: { $ref: "#/components/schemas/Question" } },
      flashcards: { type: "array", items: { $ref: "#/components/schemas/Flashcard" } },
      schedule: {
        type: "object",
        properties: {
          days_available: { type: "integer" },
          days: { type: "array", items: { $ref: "#/components/schemas/ScheduleDay" } },
        },
      },
      coverage: {
        type: "object",
        properties: {
          uncovered_requirement_ids: { type: "array", items: { type: "string" } },
          passes: { type: "integer" },
        },
      },
    },
  },
  KitMeta: {
    type: "object",
    description: "generated/edited/pinned state, sibling of the kit object.",
    properties: {
      company_brief: {
        type: "object",
        properties: { state: { type: "string", enum: ["generated", "edited"] } },
      },
      schedule: {
        type: "object",
        properties: { state: { type: "string", enum: ["generated", "edited"] } },
      },
      questions: {
        type: "object",
        additionalProperties: { type: "string", enum: ["generated", "edited", "pinned"] },
      },
      flashcards: {
        type: "object",
        additionalProperties: { type: "string", enum: ["generated", "edited", "pinned"] },
      },
    },
  },
  KitDocSummary: {
    type: "object",
    properties: {
      id: { type: "string" },
      status: { type: "string", enum: ["pending", "generating", "ready", "failed"] },
      title: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  KitDocFull: {
    type: "object",
    properties: {
      id: { type: "string" },
      status: { type: "string", enum: ["pending", "generating", "ready", "failed"] },
      input: {
        type: "object",
        properties: {
          jd: { type: "string" },
          companyUrl: { type: "string" },
          days: { type: "integer" },
        },
      },
      kit: { $ref: "#/components/schemas/Kit" },
      meta: { $ref: "#/components/schemas/KitMeta" },
      warnings: { type: "array", items: { type: "string" } },
      error: {
        type: "object",
        nullable: true,
        properties: { code: { type: "string" }, message: { type: "string" } },
      },
    },
  },
};

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "AI Interview Prep Kit API",
      version: "1.0.0",
      description:
        "Turns a job description + a company URL into a structured, editable interview " +
        "preparation kit. Session auth is a signed JWT in an httpOnly cookie — call " +
        "/api/auth/login first and the cookie is sent automatically by the browser " +
        "(or by curl with -c/-b) on every subsequent request.",
    },
    servers: [{ url: "/", description: "Same origin as this docs page" }],
    components: {
      schemas,
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "session",
        },
      },
    },
    tags: [
      { name: "Auth", description: "Registration, login, session" },
      { name: "Kits", description: "Create, read, and reshape interview prep kits" },
      { name: "Builder", description: "Inline edits, reordering, and pinning kit items" },
      { name: "Regenerate", description: "Regenerate a single kit section" },
      { name: "Practice", description: "Flashcard practice mode" },
    ],
  },
  apis: ["./src/auth/routes.js", "./src/routes/kits.js", "./src/server.js"],
};

export const swaggerSpec = swaggerJSDoc(options);
