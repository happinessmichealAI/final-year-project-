import { NextRequest, NextResponse } from "next/server";

// IMPORTANT: this route never decides whether the student's action was
// correct — the procedure engine (lib/procedureEngine.ts) already decided
// that deterministically before this is called. The model's only job here is
// to turn context into a short, specific, non-generic response. This keeps
// the engineering/error-detection logic traceable to rules and keeps the AI
// tutor focused on explanation, in both of this route's two modes:
//   - action feedback (existing): explains a verdict already reached
//   - free question (new): answers a student's own question using only the
//     supplied machine/component/procedure/engineering-state context

const FEEDBACK_SYSTEM_PROMPT = `You are a machine-operation lab tutor for a Nigerian mechanical
engineering course, supporting four machines: a robotic manipulator, a
vertical milling machine, an electric hydraulic press, and a 3D printer. You will be given: which machine, the
current procedure step, whether it's safety-critical, the student's action
(and, for parameter-validated steps, the actual numeric parameters they
entered), a verdict already determined by a rules engine (correct /
incorrect / safety_violation / out_of_order), and a template message that
already contains any engineering numbers/formulas relevant to this verdict.

Rules, in order of importance:
1. Do not re-judge correctness — the verdict is final. Never claim the
   student is right if the verdict says otherwise, and never soften a
   safety_violation.
2. Never invent engineering facts, limits, formulas, or numbers beyond what's
   in the template message. If parameters are supplied, you may restate or
   rephrase the numbers already given — you may not calculate new ones or
   assert limits that weren't provided to you.
3. If safetyCritical is true and the verdict is not "correct", be firm and
   direct, not gentle — this is a stop-work correction, not encouragement.
4. Otherwise, be a short (1-3 sentence), specific, encouraging-but-direct lab
   instructor. Reference the actual step/machine context you were given
   rather than speaking generically.
5. If this is a repeated wrong attempt on the same step (attemptNumber > 1),
   acknowledge that plainly ("second time on this one") rather than repeating
   the exact same phrasing as if it were the first attempt.`;

const QUESTION_SYSTEM_PROMPT = `You are an engineering education tutor for a Nigerian mechanical
engineering course, supporting four machines: a robotic manipulator, a
vertical milling machine, an electric hydraulic press, and a 3D printer. A
student has asked a free-form question while using the training simulator.
You will be given: which machine, which component (if any) they currently
have selected and its stated function, the current procedure step, and the
current engineering/simulation state (e.g. cutter diameter/RPM/cutting
speed, press pressure/stroke, printer temperatures) where applicable.

Rules, in order of importance:
1. You do not determine whether an operation is correct or safe
   independently. The deterministic procedure engine and engineering rule
   engine in this application are authoritative for that. If the student
   asks whether something is correct/safe, defer to what the supplied
   context already states rather than judging it yourself.
2. Do not invent engineering values, machine specifications, formulas, or
   safety limits beyond what is supplied in the context below. You may
   explain and reason using those given numbers; you may not assert new
   ones.
3. If a component is selected, ground your answer in its actual stated
   function and its role in the current procedure step, rather than
   answering generically.
4. Be concise: 2-4 sentences, direct, appropriate for a student actively
   operating the machine right now, not a textbook excerpt.
5. If the question is unrelated to the machine, component, or procedure,
   answer briefly and steer back to the training context.`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3-32b";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not set on the server. See .env.example.", fallback: true },
      { status: 200 }
    );
  }

  try {
    const body = await req.json();
    const isQuestion = typeof body.studentQuestion === "string" && body.studentQuestion.trim().length > 0;

    let systemPrompt: string;
    let userContent: string;

    if (isQuestion) {
      const {
        machineTitle,
        selectedComponentName,
        selectedComponentFunction,
        stepTitle,
        stepInstruction,
        engineeringState,
        studentQuestion,
      } = body;

      const contextLines = [
        `Machine: ${machineTitle ?? "unspecified"}`,
        selectedComponentName
          ? `Selected component: ${selectedComponentName} — ${selectedComponentFunction ?? "(no function text supplied)"}`
          : "Selected component: none currently selected",
        stepTitle ? `Current procedure step: "${stepTitle}" — ${stepInstruction ?? ""}` : "Current procedure step: none active",
        engineeringState ? `Current engineering/simulation state: ${JSON.stringify(engineeringState)}` : null,
        `Student question: ${studentQuestion}`,
      ].filter(Boolean);

      systemPrompt = QUESTION_SYSTEM_PROMPT;
      userContent = `${contextLines.join("\n")}\n\nAnswer the student's question now.`;
    } else {
      const {
        machineTitle,
        stepTitle,
        stepInstruction,
        studentAction,
        result,
        templateMessage,
        safetyCritical,
        parameters,
        attemptNumber,
      } = body;

      const contextLines = [
        `Machine: ${machineTitle ?? "unspecified"}`,
        `Current step: "${stepTitle}" — ${stepInstruction}`,
        `Safety-critical step: ${safetyCritical ? "yes" : "no"}`,
        `Student action: ${studentAction}`,
        parameters ? `Student-entered parameters: ${JSON.stringify(parameters)}` : null,
        `Attempt number on this step: ${attemptNumber ?? 1}`,
        `Rules-engine verdict: ${result}`,
        `Template message (contains any engineering numbers you may reference): ${templateMessage}`,
      ].filter(Boolean);

      systemPrompt = FEEDBACK_SYSTEM_PROMPT;
      userContent = `${contextLines.join("\n")}\n\nWrite the coaching response now.`;
    }

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 220,
        temperature: 0.3,
        reasoning_effort: "none",
      }),
    });

    if (!response.ok) {
      console.error("Groq tutor request failed:", response.status, await response.text());
      return NextResponse.json(
        { error: "Tutor call failed", fallback: true },
        { status: 200 }
      );
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      console.error("Groq tutor returned no text:", data);
      return NextResponse.json(
        { error: "Tutor returned no feedback", fallback: true },
        { status: 200 }
      );
    }

    return NextResponse.json({ feedback: text, fallback: false });
  } catch (err) {
    console.error("Groq tutor route error:", err);
    // Deliberate degraded mode: the deterministic procedure verdict remains
    // available even when the external AI service is unavailable.
    return NextResponse.json(
      { error: "Tutor call failed", fallback: true },
      { status: 200 }
    );
  }
}

