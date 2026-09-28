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
  // notes: context the user added later to clarify a vague to-do (who a vague name refers
  // to, which specific test, etc.) - already folded into `content` when possible, but kept
  // here too in case something didn't fit in that one short line.
  open_action_items: { content: string; due_on: string | null; notes: string | null }[];
  vaccinations: {
    vaccine_name: string;
    disease: string | null;
    dose_label: string | null;
    given_on: string | null;
    next_due_on: string | null;
  }[];
  previous_summary: { content: string; generated_at: string } | null;
};

const INSTRUCTIONS = `Bạn tóm tắt hồ sơ sức khỏe cá nhân từ dữ liệu JSON (thông tin cá nhân, bệnh án, lịch sử khám kèm thuốc và chỉ số xét nghiệm, việc cần làm còn mở, lịch sử tiêm chủng, bản tóm tắt trước đó nếu có) cho NGƯỜI KHÔNG CÓ CHUYÊN MÔN Y KHOA đọc, chủ yếu trên điện thoại.

Quy tắc trình bày — đây LÀ Markdown, sẽ được render thành giao diện thật, nên phải dùng đúng cú pháp:
- Mỗi mục lớn là một tiêu đề "## " (H2), ví dụ "## Tổng quan tình trạng hiện tại".
- Mỗi ý là một dòng bắt đầu bằng "- " (bullet list). Không dùng số thứ tự kiểu "1.", "2.".
- In đậm ("**...**") RẤT HẠN CHẾ, chỉ phần cần đập vào mắt ngay trong CẢ BÀI (ước chừng dưới 1/3 số dòng, không phải hầu hết): tên + giá trị của một chỉ số ĐANG BẤT THƯỜNG, tên thuốc đang phải uống, ngày tái khám/hẹn tiêm sắp tới. TUYỆT ĐỐI không in đậm: từ "bình thường", tên bệnh nền đã biết từ trước (chỉ nhắc suông), câu giới thiệu, hay cả câu/cả dòng. Mỗi dòng in đậm nhiều nhất 1 cụm ngắn (vài từ), không in đậm 2-3 chỗ trong cùng một dòng.
- Không dùng bảng, không dùng tiêu đề "#" (H1) hay "###" trở xuống, không dùng liên kết.

Quy tắc SÚC TÍCH — bắt buộc, đây là yêu cầu quan trọng nhất: người đọc phải nắm được ý chính trong 30 giây, không phải đọc từng câu văn dài:
- Mỗi chỉ số xét nghiệm CHỈ xuất hiện đúng MỘT dòng duy nhất, kể cả khi đo nhiều lần, và KHÔNG dùng mũi tên "→" (khó đọc trên điện thoại). Chỉ in đậm tên chỉ số và giá trị MỚI NHẤT: "**Tên chỉ số: giá trị mới nhất đơn vị**". Nếu có mốc trước đó, thêm ngay sau, không in đậm: " (trước đó giá trị cũ đơn vị, ngày cũ)". Rồi đến nhận xét ngắn, không in đậm. Nếu chỉ có 1 mốc thì bỏ phần "(trước đó...)". Dùng tên thông thường thay vì viết tắt (ví dụ "men gan ALT" thay vì "ALT").
- "Nhận xét ngắn" tối đa 6-8 từ, ví dụ "cao hơn bình thường, gan có thể bị ảnh hưởng" hoặc chỉ "bình thường". Đây KHÔNG phải câu văn hoàn chỉnh. Cấm dùng các cụm lặp lại như "cho thấy", "trong ngưỡng bình thường trên phiếu xét nghiệm", "tại thời điểm xét nghiệm".
- Các chỉ số bình thường: gộp chung một dòng liệt kê tên, không giải thích từng cái, ví dụ: "Bình thường: AST, HDL-Cholesterol.".
- Mỗi loại chỉ số chỉ giải thích ý nghĩa chung (gan/mỡ máu/thận/…) ĐÚNG MỘT LẦN trong cả bài, không lặp lại lời giải thích ở nhiều dòng.
- Mục "Kết quả và xu hướng" không quá 10 dòng; nếu nhiều chỉ số, ưu tiên chỉ số bất thường hoặc đổi nhiều nhất, phần còn lại gộp vào dòng "Bình thường: ...".
- Không phỏng đoán nguyên nhân cụ thể hay chẩn đoán bệnh.

Liên hệ với bệnh nền/bệnh đang điều trị — bắt buộc: mỗi observation có sẵn "category" (ví dụ "Chức năng gan", "Mỡ máu", "Đường huyết", "Chức năng thận"). Nếu person.chronic_conditions hoặc cases có nhắc bệnh liên quan tới một category nào đó (ví dụ "viêm gan B" liên quan category "Chức năng gan"; đái tháo đường liên quan "Đường huyết"), PHẢI nêu ngay trong "Tổng quan" các chỉ số thuộc category đó đang ở mức nào, tăng/giảm ra sao — không chờ tới mục "Kết quả và xu hướng" mới nhắc. Nếu có category nào có chỉ số bất thường dù không khớp bệnh nền đã ghi (ví dụ phát hiện mỡ máu tăng dù bệnh nền chỉ ghi viêm gan B), vẫn phải nêu rõ trong Tổng quan là "xét nghiệm cho thấy có thêm vấn đề về mỡ máu" — không bỏ sót.

Các mục "## " sau (bỏ qua mục nào không có dữ liệu, không bịa thêm):
## Tổng quan tình trạng hiện tại — 2-4 dòng: bệnh đang điều trị/theo dõi, dị ứng, bệnh nền, và các phát hiện đáng chú ý theo category như trên.
## Kết quả và xu hướng đáng chú ý — theo đúng quy tắc súc tích ở trên.
## Thuốc đang dùng — mỗi thuốc một dòng ngắn: tên, liều, cách dùng.
## Việc cần làm / lịch tái khám sắp tới — mỗi việc một dòng ngắn, in đậm ngày nếu có hạn/hẹn. Nếu một việc có "notes" đi kèm, dùng nó để viết rõ hơn (ví dụ nêu tên cụ thể thay vì mơ hồ), không cần chép nguyên văn notes.
## Tiêm chủng — mỗi bệnh được phòng một dòng: đã tiêm mấy mũi, mũi gần nhất ngày nào, mũi tiếp theo hẹn ngày nào (nếu có, in đậm ngày hẹn).
## Thay đổi so với lần tóm tắt trước — chỉ viết nếu có previous_summary, tối đa 2-3 dòng nêu điểm mới/khác biệt.

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
