import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { BUYER_PROFILING_SYSTEM_PROMPT, extractProfileFromResponse } from "@/lib/ai/profiling";
import { NextResponse } from "next/server";
import { spawn } from "child_process";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE id = $1",
    [session.user.id]
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { messages, conversationId } = await req.json();

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const conv = await queryOne<{ id: string }>(
      `INSERT INTO ai_conversations (user_id, type, messages, status)
       VALUES ($1, 'buyer_profile', $2, 'active')
       RETURNING id`,
      [user.id, JSON.stringify(messages)]
    );
    convId = conv?.id;
  } else {
    const owned = await queryOne<{ id: string }>(
      "SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2",
      [convId, user.id]
    );
    if (!owned) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    await query(
      `UPDATE ai_conversations SET messages = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(messages), convId]
    );
  }

  // Build prompt for Claude CLI
  const conversationText = messages
    .map((m: { role: string; content: string }) =>
      m.role === "user" ? `Human: ${m.content}` : `Assistant: ${m.content}`
    )
    .join("\n\n");

  const fullPrompt = `${BUYER_PROFILING_SYSTEM_PROMPT}\n\nHere is the conversation so far:\n\n${conversationText}\n\nRespond as the assistant. Continue the buyer profiling conversation naturally.`;

  // Stream response from Claude CLI
  const encoder = new TextEncoder();
  let fullResponse = "";

  const readableStream = new ReadableStream({
    start(controller) {
      const proc = spawn("claude", ["-p", "--output-format", "text", fullPrompt], {
        env: { ...process.env, HOME: "/root" },
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        fullResponse += text;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
        );
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        console.error("Claude CLI stderr:", chunk.toString());
      });

      proc.on("close", async () => {
        // Check if profile is complete
        const profile = extractProfileFromResponse(fullResponse);
        if (profile) {
          // Save buyer profile (skip embedding for now — use rule-based matching)
          const existing = await queryOne<{ id: string }>(
            "SELECT id FROM buyer_profiles WHERE user_id = $1",
            [user.id]
          );

          const profileFields = [
            profile.use_case,
            JSON.stringify(profile.budget_range),
            JSON.stringify(profile.boat_type_prefs),
            JSON.stringify(profile.spec_preferences),
            JSON.stringify(profile.location_prefs),
            profile.experience_level,
            profile.deal_breakers,
            profile.timeline,
            profile.refit_tolerance,
            convId,
          ];

          if (existing) {
            await query(
              `UPDATE buyer_profiles SET
                use_case = $1, budget_range = $2, boat_type_prefs = $3,
                spec_preferences = $4, location_prefs = $5, experience_level = $6,
                deal_breakers = $7, timeline = $8, refit_tolerance = $9,
                ai_conversation_id = $10, updated_at = NOW()
              WHERE user_id = $11`,
              [...profileFields, user.id]
            );
          } else {
            await query(
              `INSERT INTO buyer_profiles
                (user_id, use_case, budget_range, boat_type_prefs, spec_preferences,
                 location_prefs, experience_level, deal_breakers, timeline,
                 refit_tolerance, ai_conversation_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [user.id, ...profileFields]
            );
          }

          await query(
            `UPDATE ai_conversations SET status = 'completed', extracted_data = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(profile), convId]
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ profileComplete: true, profile })}\n\n`
            )
          );
        }

        // Update conversation
        const allMessages = [
          ...messages,
          { role: "assistant", content: fullResponse },
        ];
        await query(
          `UPDATE ai_conversations SET messages = $1, token_count = token_count + $2, updated_at = NOW() WHERE id = $3`,
          [JSON.stringify(allMessages), fullResponse.length, convId]
        );

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ conversationId: convId })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });

      proc.on("error", (err) => {
        console.error("Claude CLI error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: "Sorry, I'm having trouble connecting. Please try again." })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
