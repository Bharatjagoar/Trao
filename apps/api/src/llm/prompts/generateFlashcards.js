import { z } from "zod";
import { createStructuredChain } from "../client.js";

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

const chain = createStructuredChain({
  name: "generate_flashcards",
  system: SYSTEM,
  schema: responseSchema,
  temperature: 0.5,
});

export async function generateFlashcards(requirements) {
  if (requirements.length === 0) return [];

  const reqList = requirements.map((r) => `- ${r.id}: ${r.text}`).join("\n");
  const prompt = `Requirements:
${reqList}

Generate exactly one flashcard per requirement above.`;

  const result = await chain.invoke(prompt);
  return result.flashcards;
}
