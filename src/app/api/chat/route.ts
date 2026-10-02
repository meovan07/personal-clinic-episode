import { openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  pruneMessages,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { after } from "next/server";
import { z } from "zod";
import { buildInstructions } from "@/lib/agent/instructions";
import {
  CHAT_MODEL,
  compactIfNeeded,
  loadMemories,
  loadOrCreateThread,
  messageText,
  saveNewMessages,
  updateMemoriesFromExchange,
} from "@/lib/agent/memory";
import { createReadTools } from "@/lib/agent/tools";
import { vietnamToday } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

// A question can take several tool calls plus the model's answer, and sometimes a compaction pass first.
export const maxDuration = 300;

// The client sends only its newest message; the history lives in chat_messages.
const Body = z.object({
  id: z.string().uuid(),
  message: z
    .object({ id: z.string().min(1).max(100), role: z.literal("user"), parts: z.array(z.unknown()) })
    .passthrough(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Chưa đăng nhập.", { status: 401 });
  const { data: members } = await supabase.from("members").select("user_id, display_name");
  const member = members?.find((m) => m.user_id === user.id);
  if (!member) return new Response("Tài khoản chưa được cấp quyền.", { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Yêu cầu không hợp lệ.", { status: 400 });
  const { id: threadId } = parsed.data;
  const message = parsed.data.message as unknown as UIMessage;
  if (messageText(message).length > 4000) return new Response("Tin nhắn quá dài.", { status: 400 });

  const loaded = await loadOrCreateThread(supabase, threadId, message);
  if (!loaded) return new Response("Không tìm thấy cuộc trò chuyện.", { status: 404 });

  const tools = createReadTools(supabase);
  let history: UIMessage[];
  try {
    history = await validateUIMessages({ messages: [...loaded.messages, message], tools });
  } catch (e) {
    // e.g. a stored tool call from an older version whose input no longer matches; better a clear error than a crash.
    console.error("chat history invalid", e);
    return new Response("Cuộc trò chuyện này không mở tiếp được. Hãy bắt đầu cuộc trò chuyện mới.", { status: 409 });
  }

  // Short-term memory: the running summary stands in for older messages; only the recent ones go in full.
  const thread = await compactIfNeeded(supabase, loaded.thread, history);
  const [memories, today] = [await loadMemories(supabase), vietnamToday()];
  const recent = pruneMessages({
    messages: await convertToModelMessages(history.slice(thread.summarized_count)),
    // Old lookup results are bulky; the model only needs them for the last few turns.
    toolCalls: "before-last-4-messages",
    reasoning: "before-last-message",
  });

  const result = streamText({
    model: openai(CHAT_MODEL),
    instructions: await buildInstructions(supabase, today, {
      memories,
      summary: thread.summary,
      speaker: member.display_name,
      memberNames: new Map((members ?? []).map((m) => [m.user_id, m.display_name])),
    }),
    messages: recent,
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
  // Finish (and save) the answer even if the user closes the panel or loses connection mid-stream.
  result.consumeStream();

  // Long-term memory updates silently after the answer is out, so the chat never waits for it.
  let finishExchange: (messages: UIMessage[]) => void = () => {};
  const exchange = new Promise<UIMessage[]>((resolve) => {
    finishExchange = resolve;
    setTimeout(() => resolve([]), (maxDuration - 30) * 1000); // never outlive the function if the stream fails
  });
  after(async () => updateMemoriesFromExchange(supabase, threadId, await exchange, member.display_name));

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: history,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onEnd: async ({ messages }) => {
        await saveNewMessages(supabase, threadId, messages, loaded.messages.length);
        finishExchange(messages.slice(loaded.messages.length));
      },
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
