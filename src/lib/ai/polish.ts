import OpenAI from "openai";

// Only used on the server: OPENAI_API_KEY must never reach the browser.

const INSTRUCTIONS = `Người dùng gõ nhanh một việc cần làm hoặc lời dặn của bác sĩ, có thể viết tắt, thiếu dấu, sai chính tả. Viết lại thành một câu ngắn gọn, đúng chính tả, đủ ý bằng tiếng Việt, giữ nguyên nghĩa gốc. Không thêm ý mới, không thêm lời khuyên y khoa. Chỉ trả về câu đã viết lại, không giải thích gì thêm.`;

export async function polishActionItem(text: string): Promise<string> {
  const client = new OpenAI();
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    reasoning: { effort: "low" },
    store: false,
    instructions: INSTRUCTIONS,
    input: [{ role: "user", content: text }],
  });
  const polished = response.output_text.trim();
  return polished || text;
}
