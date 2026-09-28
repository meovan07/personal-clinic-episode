import OpenAI from "openai";

// Only used on the server: OPENAI_API_KEY must never reach the browser.

const INSTRUCTIONS = `Người dùng gõ nhanh một việc cần làm hoặc lời dặn của bác sĩ, có thể viết tắt, thiếu dấu, sai chính tả. Viết lại thành một câu ngắn gọn, đúng chính tả, đủ ý bằng tiếng Việt, giữ nguyên nghĩa gốc. Không thêm ý mới ngoài những gì được cung cấp, không thêm lời khuyên y khoa. Chỉ trả về câu đã viết lại, không giải thích gì thêm.

Nếu có "Bối cảnh thêm" đi kèm: đó là thông tin người dùng bổ sung để làm rõ câu gốc (ví dụ nói rõ một người được nhắc mơ hồ là ai, hoặc việc cụ thể là gì). Hãy DÙNG bối cảnh đó để viết lại câu cho rõ nghĩa hơn, nhưng vẫn giữ ngắn gọn (một câu, không liệt kê lại toàn bộ bối cảnh).`;

export async function polishActionItem(text: string, context?: string | null): Promise<string> {
  const client = new OpenAI();
  const input = context?.trim() ? `${text}\n\nBối cảnh thêm: ${context.trim()}` : text;
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    reasoning: { effort: "low" },
    store: false,
    instructions: INSTRUCTIONS,
    input: [{ role: "user", content: input }],
  });
  const polished = response.output_text.trim();
  return polished || text;
}

// ---------- Editing an existing to-do with real family/record context ----------

const REFINE_INSTRUCTIONS = `Người dùng đang sửa TIÊU ĐỀ một việc cần làm trong hồ sơ sức khỏe gia đình (hiển thị trong một danh sách, phải đọc lướt được trong 1 giây), và gõ thêm vài từ ghi chú để làm rõ ý.

Bạn được cung cấp: tiêu đề hiện tại, ghi chú người dùng vừa thêm (nếu có), danh sách thành viên gia đình, và một vài lần khám/bệnh án gần đây của người liên quan — CHỈ để tra cứu, không phải để nhét hết vào câu trả lời.

Việc DUY NHẤT cần làm: thay các chỗ MƠ HỒ trong tiêu đề gốc bằng thông tin CỤ THỂ NGẮN suy ra được từ dữ liệu — ví dụ danh xưng mơ hồ ("chồng", "vợ") → tên riêng của người đó nếu suy luận được từ danh sách gia đình; tên xét nghiệm chung chung → tên chính xác NẾU khớp rõ với một lần khám gần đây. Đây là 1-2 từ thay thế, KHÔNG phải viết thêm câu mới, KHÔNG kể lại ngày khám/tên phòng khám/tên bệnh án/lý do khám dù có trong dữ liệu — những chi tiết đó không thuộc về tiêu đề.

QUY TẮC ĐỘ DÀI — bắt buộc: tối đa 8-10 từ, ngắn hơn hoặc bằng độ dài câu gốc cộng phần thay thế. Nếu không chắc chắn suy ra được điều gì cụ thể từ dữ liệu, GIỮ NGUYÊN tiêu đề gốc, không cố nhét thêm chi tiết mơ hồ.
Ví dụ ĐÚNG: gốc "Xét nghiệm cho chồng" + ghi chú "chồng là anh Nam, xét nghiệm máu" + gia đình có "Nguyễn Văn Nam (nam)" → "Xét nghiệm máu cho Nam". Ví dụ SAI (quá dài, thừa chi tiết): "Xét nghiệm máu cho chồng là anh Nguyễn Văn Nam, liên quan đến bệnh án đang điều trị, khám gần nhất ngày 01/03/2026 tại phòng khám ABC".

Không bịa thông tin không có trong dữ liệu. Không thêm lời khuyên y khoa. Chỉ trả về tiêu đề đã sửa, không giải thích gì thêm.`;

export async function refineActionItem(params: {
  content: string;
  notes?: string | null;
  people: { id: string; full_name: string; sex: string | null }[];
  forPersonName: string;
  recentContext: string;
}): Promise<string> {
  const { content, notes, people, forPersonName, recentContext } = params;
  const client = new OpenAI();
  const roster = people.map((p) => `- ${p.full_name}${p.sex ? ` (${p.sex})` : ""}`).join("\n");
  const input = `Việc cần làm hiện tại (thuộc về ${forPersonName}): ${content}
${notes?.trim() ? `\nGhi chú người dùng vừa thêm: ${notes.trim()}` : ""}

Thành viên gia đình:
${roster}

Lần khám/bệnh án gần đây của ${forPersonName}:
${recentContext || "(không có)"}`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    reasoning: { effort: "low" },
    store: false,
    instructions: REFINE_INSTRUCTIONS,
    input: [{ role: "user", content: input }],
  });
  const refined = response.output_text.trim();
  return refined || content;
}
