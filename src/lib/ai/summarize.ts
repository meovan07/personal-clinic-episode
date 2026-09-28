import OpenAI from "openai";

// Only used on the server: OPENAI_API_KEY must never reach the browser.

export type PersonSnapshot = {
  person: {
    full_name: string;
    sex: string | null;
    birth_date: string | null;
    blood_type: string | null;
    allergies: string | null;
    chronic_conditions: string | null;
  };
  cases: { title: string; status: string; started_on: string | null; ended_on: string | null }[];
  visits: {
    visit_date: string | null;
    facility: string | null;
    department: string | null;
    doctor: string | null;
    reason: string | null;
    case_title: string | null;
    document_summaries: string[];
    medications: { name: string; dose: string | null; schedule: string | null }[];
    observations: { name: string; value: string | null; unit: string | null; flag: string | null }[];
  }[];
  open_action_items: { content: string; due_on: string | null }[];
  previous_summary: { content: string; generated_at: string } | null;
};

const INSTRUCTIONS = `Bạn tóm tắt hồ sơ sức khỏe cá nhân (không phải chẩn đoán y khoa) từ dữ liệu JSON gồm: thông tin cá nhân, bệnh án, lịch sử khám (mỗi lần khám kèm tóm tắt tài liệu, thuốc, chỉ số xét nghiệm), việc cần làm còn mở, và bản tóm tắt trước đó (nếu có).

Viết bằng tiếng Việt, giọng văn ngắn gọn, dễ đọc, dùng gạch đầu dòng khi hợp lý. Gồm các phần:
1. Tổng quan tình trạng hiện tại (bệnh đang điều trị/theo dõi, dị ứng, bệnh nền).
2. Xu hướng đáng chú ý qua các lần khám (chỉ số xét nghiệm tăng/giảm bất thường theo thời gian nếu dữ liệu cho thấy, dựa trên các lần khám có ngày).
3. Thuốc đang dùng (nếu có, dùng lần khám gần nhất còn hiệu lực).
4. Việc cần làm / lịch tái khám sắp tới.
5. "Thay đổi so với lần tóm tắt trước" — chỉ viết phần này nếu có previous_summary; nêu điểm mới/khác biệt.

Chỉ dùng thông tin có trong dữ liệu, không suy đoán số liệu, không đưa ra lời khuyên y khoa mới ngoài những gì đã ghi nhận. Nếu thiếu dữ liệu ở phần nào, bỏ qua phần đó thay vì bịa.`;

export async function summarizePerson(snapshot: PersonSnapshot): Promise<string> {
  const client = new OpenAI();
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    reasoning: { effort: "low" },
    store: false, // don't keep medical data on OpenAI's side
    instructions: INSTRUCTIONS,
    input: [{ role: "user", content: JSON.stringify(snapshot) }],
  });
  if (!response.output_text.trim()) throw new Error("AI không trả về kết quả. Thử lại sau.");
  return response.output_text.trim();
}
