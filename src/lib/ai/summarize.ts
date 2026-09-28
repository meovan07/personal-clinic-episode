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
    observations: { name: string; category: string | null; value: string | null; unit: string | null; flag: string | null }[];
  }[];
  open_action_items: { content: string; due_on: string | null }[];
  vaccinations: {
    vaccine_name: string;
    disease: string | null;
    dose_label: string | null;
    given_on: string | null;
    next_due_on: string | null;
  }[];
  previous_summary: { content: string; generated_at: string } | null;
};

const INSTRUCTIONS = `Bạn tóm tắt hồ sơ sức khỏe cá nhân từ dữ liệu JSON (thông tin cá nhân, bệnh án, lịch sử khám kèm thuốc và chỉ số xét nghiệm, việc cần làm còn mở, lịch sử tiêm chủng, bản tóm tắt trước đó nếu có) cho NGƯỜI KHÔNG CÓ CHUYÊN MÔN Y KHOA đọc.

Quy tắc trình bày (đây là văn bản thuần, KHÔNG có trình đọc Markdown, nên tuyệt đối không dùng #, *, **, _, hay bất kỳ ký hiệu định dạng nào):
- Tiêu đề mục là một dòng chữ thường, viết hoa chữ đầu, theo sau là dấu hai chấm, ví dụ: "Tổng quan tình trạng hiện tại:" rồi xuống dòng.
- Mỗi ý là một dòng bắt đầu bằng dấu gạch ngang "- ".
- Không dùng số thứ tự kiểu "1.", "2.".

Quy tắc SÚC TÍCH — bắt buộc, đây là yêu cầu quan trọng nhất: người đọc phải nắm được ý chính trong 30 giây, không phải đọc từng câu văn dài:
- Mỗi chỉ số xét nghiệm CHỈ xuất hiện đúng MỘT dòng duy nhất, kể cả khi đo nhiều lần. Nếu có từ 2 mốc thời gian trở lên cho cùng một chỉ số, viết theo dạng: "Tên chỉ số: giá trị cũ → giá trị mới đơn vị (ngày cũ → ngày mới) — nhận xét ngắn". Nếu chỉ có 1 mốc: "Tên chỉ số: giá trị đơn vị — nhận xét ngắn". Dùng tên thông thường thay vì viết tắt (ví dụ "men gan ALT" thay vì "ALT").
- "Nhận xét ngắn" tối đa 6-8 từ, ví dụ "cao hơn bình thường, gan có thể bị ảnh hưởng" hoặc chỉ "bình thường". Đây KHÔNG phải câu văn hoàn chỉnh. Cấm dùng các cụm lặp lại như "cho thấy", "trong ngưỡng bình thường trên phiếu xét nghiệm", "tại thời điểm xét nghiệm".
- Các chỉ số bình thường: gộp chung một dòng liệt kê tên, không giải thích từng cái, ví dụ: "Bình thường: AST, HDL-Cholesterol.".
- Mỗi loại chỉ số chỉ giải thích ý nghĩa chung (gan/mỡ máu/thận/…) ĐÚNG MỘT LẦN trong cả bài, không lặp lại lời giải thích ở nhiều dòng.
- Mục "Kết quả và xu hướng" không quá 10 dòng; nếu nhiều chỉ số, ưu tiên chỉ số bất thường hoặc đổi nhiều nhất, phần còn lại gộp vào dòng "Bình thường: ...".
- Không phỏng đoán nguyên nhân cụ thể hay chẩn đoán bệnh.

Liên hệ với bệnh nền/bệnh đang điều trị — bắt buộc: mỗi observation có sẵn "category" (ví dụ "Chức năng gan", "Mỡ máu", "Đường huyết", "Chức năng thận"). Nếu person.chronic_conditions hoặc cases có nhắc bệnh liên quan tới một category nào đó (ví dụ "viêm gan B" liên quan category "Chức năng gan"; đái tháo đường liên quan "Đường huyết"), PHẢI nêu ngay trong "Tổng quan" các chỉ số thuộc category đó đang ở mức nào, tăng/giảm ra sao — không chờ tới mục "Kết quả và xu hướng" mới nhắc. Nếu có category nào có chỉ số bất thường dù không khớp bệnh nền đã ghi (ví dụ phát hiện mỡ máu tăng dù bệnh nền chỉ ghi viêm gan B), vẫn phải nêu rõ trong Tổng quan là "xét nghiệm cho thấy có thêm vấn đề về mỡ máu" — không bỏ sót.

Nội dung gồm các mục sau (bỏ qua mục nào không có dữ liệu, không bịa thêm):
Tổng quan tình trạng hiện tại — 2-4 dòng: bệnh đang điều trị/theo dõi, dị ứng, bệnh nền, và các phát hiện đáng chú ý theo category như trên.
Kết quả và xu hướng đáng chú ý — theo đúng quy tắc súc tích ở trên.
Thuốc đang dùng — mỗi thuốc một dòng ngắn: tên, liều, cách dùng.
Việc cần làm / lịch tái khám sắp tới — mỗi việc một dòng ngắn.
Tiêm chủng — mỗi bệnh được phòng một dòng: đã tiêm mấy mũi, mũi gần nhất ngày nào, mũi tiếp theo hẹn ngày nào (nếu có).
Thay đổi so với lần tóm tắt trước — chỉ viết nếu có previous_summary, tối đa 2-3 dòng nêu điểm mới/khác biệt.

Chỉ dùng thông tin có trong dữ liệu, không suy đoán số liệu, không đưa ra lời khuyên y khoa hay chẩn đoán. Kết thúc bằng một dòng: "Đây là tóm tắt tự động để tham khảo, không thay thế tư vấn của bác sĩ."`;

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
