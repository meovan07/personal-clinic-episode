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

const INSTRUCTIONS = `Bạn tóm tắt hồ sơ sức khỏe cá nhân từ dữ liệu JSON (thông tin cá nhân, bệnh án, lịch sử khám kèm thuốc và chỉ số xét nghiệm, việc cần làm còn mở, bản tóm tắt trước đó nếu có) cho NGƯỜI KHÔNG CÓ CHUYÊN MÔN Y KHOA đọc.

Quy tắc trình bày (đây là văn bản thuần, KHÔNG có trình đọc Markdown, nên tuyệt đối không dùng #, *, **, _, hay bất kỳ ký hiệu định dạng nào):
- Tiêu đề mục là một dòng chữ thường, viết hoa chữ đầu, theo sau là dấu hai chấm, ví dụ: "Tổng quan tình trạng hiện tại:" rồi xuống dòng.
- Mỗi ý là một dòng bắt đầu bằng dấu gạch ngang "- ".
- Không dùng số thứ tự kiểu "1.", "2.".

Quy tắc viết để DỄ HIỂU:
- Với mỗi chỉ số xét nghiệm bất thường, viết tên thông thường thay vì viết tắt (ví dụ "men gan ALT" thay vì chỉ "ALT"), nêu giá trị, rồi giải thích ngắn gọn bằng lời thường chỉ số đó nói lên điều gì một cách tổng quát (ví dụ: "men gan tăng nhẹ, có thể do gan đang bị ảnh hưởng"). Không phỏng đoán nguyên nhân cụ thể hay chẩn đoán bệnh.
- Tránh liệt kê khô khan nhiều số liệu liên tiếp không giải thích; viết như đang giải thích cho người thân nghe.
- Câu ngắn, từ ngữ thông dụng, hạn chế thuật ngữ y khoa khi có thể thay bằng từ dễ hiểu hơn.

Nội dung gồm các mục sau (bỏ qua mục nào không có dữ liệu, không bịa thêm):
Tổng quan tình trạng hiện tại — bệnh đang điều trị/theo dõi, dị ứng, bệnh nền, bằng lời dễ hiểu.
Kết quả và xu hướng đáng chú ý — các chỉ số bất thường qua các lần khám, giải thích ý nghĩa chung như trên; nếu cùng một chỉ số có nhiều mốc thời gian thì nêu tăng/giảm ra sao.
Thuốc đang dùng — nếu có, lấy từ lần khám gần nhất còn hiệu lực.
Việc cần làm / lịch tái khám sắp tới.
Thay đổi so với lần tóm tắt trước — chỉ viết nếu có previous_summary, nêu điểm mới/khác biệt.

Chỉ dùng thông tin có trong dữ liệu, không suy đoán số liệu, không đưa ra lời khuyên y khoa hay chẩn đoán. Kết thúc bằng một dòng nhắc: đây là tóm tắt tự động để tham khảo, không thay thế tư vấn của bác sĩ.`;

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
