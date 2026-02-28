import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { BUYER_PROFILING_SYSTEM_PROMPT, extractProfileFromResponse } from "@/lib/ai/profiling";
import { generateEmbedding, profileToEmbeddingText } from "@/lib/ai/embeddings";
import { NextResponse } from "next/server";

const anthropic = new Anthropic();

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
    await query(
      `UPDATE ai_conversations SET messages = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(messages), convId]
    );
  }

  // Stream response from Claude
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 1024,
    system: BUYER_PROFILING_SYSTEM_PROMPT,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
          );
        }
      }

      // Check if profile is complete
      const profile = extractProfileFromResponse(fullResponse);
      if (profile) {
        // Generate embedding
        const embeddingText = profileToEmbeddingText(profile);
        const embedding = await generateEmbedding(embeddingText);
        const embeddingStr = `[${embedding.join(",")}]`;

        // Save or update buyer profile
        const existing = await queryOne<{ id: string }>(
          "SELECT id FROM buyer_profiles WHERE user_id = $1",
          [user.id]
        );

        if (existing) {
          await query(
            `UPDATE buyer_profiles SET
              use_case = $1, budget_range = $2, boat_type_prefs = $3,
              spec_preferences = $4, location_prefs = $5, experience_level = $6,
              deal_breakers = $7, timeline = $8, refit_tolerance = $9,
              dna_embedding = $10, ai_conversation_id = $11, updated_at = NOW()
            WHERE user_id = $12`,
            [
              profile.use_case,
              JSON.stringify(profile.budget_range),
              JSON.stringify(profile.boat_type_prefs),
              JSON.stringify(profile.spec_preferences),
              JSON.stringify(profile.location_prefs),
              profile.experience_level,
              profile.deal_breakers,
              profile.timeline,
              profile.refit_tolerance,
              embeddingStr,
              convId,
              user.id,
            ]
          );
        } else {
          await query(
            `INSERT INTO buyer_profiles
              (user_id, use_case, budget_range, boat_type_prefs, spec_preferences,
               location_prefs, experience_level, deal_breakers, timeline,
               refit_tolerance, dna_embedding, ai_conversation_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              user.id,
              profile.use_case,
              JSON.stringify(profile.budget_range),
              JSON.stringify(profile.boat_type_prefs),
              JSON.stringify(profile.spec_preferences),
              JSON.stringify(profile.location_prefs),
              profile.experience_level,
              profile.deal_breakers,
              profile.timeline,
              profile.refit_tolerance,
              embeddingStr,
              convId,
            ]
          );
        }

        // Update conversation status
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

      // Update conversation messages
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
