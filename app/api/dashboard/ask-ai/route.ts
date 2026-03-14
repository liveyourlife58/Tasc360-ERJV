import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { buildAskAiContext } from "@/lib/ask-ai-context";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

function ndjsonLine(obj: object): string {
  return JSON.stringify(obj) + "\n";
}

function userFriendlyError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const message = (err as Error)?.message ?? "";
  if (status === 429 || message.toLowerCase().includes("rate limit"))
    return "The AI service is busy. Please try again in a minute.";
  if (
    status === 401 ||
    status === 403 ||
    message.toLowerCase().includes("invalid") ||
    message.toLowerCase().includes("api key")
  )
    return "AI is not configured or the API key is invalid. Check OPENAI_API_KEY.";
  if (message.toLowerCase().includes("timeout") || message.toLowerCase().includes("econnreset"))
    return "The request timed out. Please try again.";
  return "The AI service is temporarily unavailable. Please try again in a moment.";
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const session = getSessionFromCookie(cookieHeader);
  if (!session?.tenantId || !session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const canRead = await hasPermission(session.userId, PERMISSIONS.entitiesRead);
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { question?: string; moduleSlug?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  const moduleSlug = body.moduleSlug ?? null;
  if (!question) {
    return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
  }

  const built = await buildAskAiContext(session.tenantId, question, moduleSlug);
  if ("noData" in built && built.noData) {
    return NextResponse.json({ answer: built.message, citedRecords: undefined });
  }
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }
  const { context, citedRecords, sys } = built as {
    context: string;
    citedRecords: { entityId: string; moduleSlug: string; moduleName: string }[];
    sys: string;
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI is not configured (OPENAI_API_KEY)." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(ndjsonLine({ type: "meta", citedRecords })));

        const client = new OpenAI({ apiKey });
        const streamResponse = await client.chat.completions.create({
          model: "gpt-4o-mini",
          stream: true,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
          ],
        });

        for await (const chunk of streamResponse) {
          const content = chunk.choices[0]?.delta?.content;
          if (typeof content === "string" && content) {
            controller.enqueue(encoder.encode(ndjsonLine({ type: "chunk", text: content })));
          }
        }
        controller.enqueue(encoder.encode(ndjsonLine({ type: "done" })));
      } catch (err) {
        controller.enqueue(
          encoder.encode(ndjsonLine({ type: "error", message: userFriendlyError(err) }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
