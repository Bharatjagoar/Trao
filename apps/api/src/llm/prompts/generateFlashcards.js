import { z } from "zod";
import { generateJson } from "../client.js";

const cardSchema = z.object({
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
});
const responseSchema = z.object({ flashcards: z.array(cardSchema) });

const SYSTEM = `You turn interview requirements into short recall flashcards: a concise front (a prompt
or question) and a concise back (the key point to remember). Each card should stand alone without
needing the original question for context. requirement_ids must use only the ids given to you.
Respond with JSON only.`;

export async function generateFlashcards(requirements) {
  if (requirements.length === 0) return [];

  const reqList = requirements.map((r) => `- ${r.id}: ${r.text}`).join("\n");
  const prompt = `Requirements:
${reqList}

Generate exactly one flashcard per requirement above.
Return JSON: { "flashcards": [{ "front": string, "back": string, "requirement_ids": string[] }] }`;

  const raw = await generateJson({ systemInstruction: SYSTEM, prompt, temperature: 0.5 });
  return responseSchema.parse(raw).flashcards;
}
