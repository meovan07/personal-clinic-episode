import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { buildInstructions } from "@/lib/agent/instructions";
import { createReadTools } from "@/lib/agent/tools";
import { vietnamToday } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

// A question can take several tool calls plus a reasoning model's answer.
export const maxDuration = 300;

// Older turns beyond this are dropped so a long conversation can't grow the request without bound.
const MAX_MESSAGES = 40;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Chưa đăng nhập.", { status: 401 });
  const { data: member } = await supabase.from("members").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!member) return new Response("Tài khoản chưa được cấp quyền.", { status: 403 });

  const body = (await req.json().catch(() => null)) as { messages?: UIMessage[] } | null;
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return new Response("Thiếu nội dung tin nhắn.", { status: 400 });
  }
  const messages = body.messages.slice(-MAX_MESSAGES);

  const tools = createReadTools(supabase);
  const result = streamText({
    model: openai(process.env.OPENAI_MODEL || "gpt-5.5"),
    instructions: await buildInstructions(supabase, vietnamToday()),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(10),
    // Errors here are rarely transient (billing, quota, bad input); don't make the user wait for 3 tries.
    maxRetries: 1,
    providerOptions: {
      openai: {
        // Keep medical data off OpenAI's servers; encrypted reasoning lets multi-step turns work statelessly.
        store: false,
        include: ["reasoning.encrypted_content"],
        reasoningEffort: "low",
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      onError: (error) => {
        console.error("chat error", error);
        const detail = String(error instanceof Error ? error.message : error);
        if (/billing|quota|account is not active/i.test(detail)) {
          return "Tài khoản OpenAI chưa thanh toán hoặc đã hết hạn mức. Kiểm tra mục Billing trên platform.openai.com.";
        }
        return "Trợ lý gặp lỗi khi trả lời. Thử lại sau nhé.";
      },
    }),
  });
}
