import Anthropic from "@anthropic-ai/sdk";
import type { ValuationFacts } from "./facts";
import { verifyNumbers } from "./guard";
import { templateSummary } from "./template";

/** שכבת Provider: ניתן להחליף ספק מודל שפה בלי לגעת בשאר המערכת */
export interface AIProvider {
  readonly id: string;
  summarize(facts: ValuationFacts): Promise<string>;
}

export class TemplateProvider implements AIProvider {
  readonly id = "template";
  async summarize(facts: ValuationFacts) {
    return templateSummary(facts);
  }
}

const SYSTEM_PROMPT = `אתה אנליסט נדל"ן שכותב סיכום הערכת שווי בעברית עבור מתווך.
כללים מחייבים:
- השתמש אך ורק במידע שבגיליון העובדות (JSON) שתקבל. אל תוסיף עסקאות, מחירים, כתובות, מקורות או מגמות שאינם בו.
- כל מספר שאתה כותב חייב להופיע בגיליון העובדות כפי שהוא. אל תחשב מספרים חדשים.
- כשאתה מזכיר עסקה, ציין את המזהה שלה (id) בסוגריים.
- אם usesDemoData=true, פתח במשפט שמבהיר שמדובר בנתוני הדגמה סינתטיים.
- אם status=insufficient_data, אל תציג אומדן; הסבר מה חסר.
- הבחן תמיד בין מחיר עסקה שהושלמה לבין מחיר מבוקש במודעה.
- כתוב 4–7 פסקאות קצרות, בשפה מקצועית וברורה, בלי כותרות ובלי Markdown.
- סיים בנתונים שכדאי למתווך לבדוק (חריגים, מגבלות).`;

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  private client: Anthropic;
  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }
  async summarize(facts: ValuationFacts) {
    const params = {
      model: this.model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: { effort: "low" },
      // ניתוב אוטומטי למודל חלופי אם הבקשה נדחית ע"י מסנני הבטיחות
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: `גיליון העובדות:\n${JSON.stringify(facts, null, 1)}` }],
    };
    const response = await this.client.beta.messages.create(
      params as unknown as Parameters<typeof this.client.beta.messages.create>[0],
    ) as Anthropic.Beta.BetaMessage;
    if (response.stop_reason === "refusal") throw new Error("מודל השפה סירב לבקשה");
    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
}

export function getAIProvider(): AIProvider {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (process.env.AI_PROVIDER !== "template" && key) {
    return new AnthropicProvider(key, process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5");
  }
  return new TemplateProvider();
}

export interface SummaryResult {
  text: string;
  provider: string;
  note: string | null;
}

/**
 * מפיק סיכום ומוודא שאין בו מספרים שאינם בגיליון העובדות.
 * אם המודל נכשל או "המציא" מספר – חוזרים לסיכום התבניתי ומתעדים זאת.
 */
export async function generateSummary(facts: ValuationFacts, provider = getAIProvider()): Promise<SummaryResult> {
  if (provider.id === "template") return { text: templateSummary(facts), provider: "template", note: null };
  try {
    const text = await provider.summarize(facts);
    const check = verifyNumbers(text, facts);
    if (!check.ok) {
      return {
        text: templateSummary(facts),
        provider: "template",
        note: `סיכום מודל השפה נדחה: הופיעו בו מספרים שאינם בנתונים (${check.unsupported.slice(0, 5).join(", ")}).`,
      };
    }
    return { text, provider: provider.id, note: null };
  } catch (err) {
    console.error("[ai] summary failed", err);
    return { text: templateSummary(facts), provider: "template", note: "מודל השפה לא היה זמין; הוצג סיכום מבוסס תבנית." };
  }
}
