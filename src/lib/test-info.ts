// Plain-Vietnamese explanations for the tests in test_catalog, for readers without medical training:
// what the test measures, and what a high or low result usually points to. General information only,
// never a diagnosis; the doctor's reading of the whole result is what counts.

export type TestInfo = { what: string; high?: string; low?: string };

export const TEST_INFO: Record<string, TestInfo> = {
  // Chỉ số cơ thể
  BMI: { what: "Chỉ số khối cơ thể, tính từ cân nặng và chiều cao", high: "Thừa cân hoặc béo phì", low: "Thiếu cân" },
  BP_SYS: { what: "Huyết áp lúc tim co bóp (số trên)", high: "Huyết áp cao", low: "Huyết áp thấp" },
  BP_DIA: { what: "Huyết áp lúc tim nghỉ giữa hai nhịp (số dưới)", high: "Huyết áp cao", low: "Huyết áp thấp" },
  HEIGHT: { what: "Chiều cao" },
  WEIGHT: { what: "Cân nặng" },
  PULSE: { what: "Nhịp tim mỗi phút", high: "Tim đập nhanh", low: "Tim đập chậm" },

  // Gan
  ALT: {
    what: "Men gan, tăng khi tế bào gan bị tổn thương",
    high: "Gan đang bị ảnh hưởng (viêm, mỡ, rượu bia, thuốc…)",
  },
  AST: { what: "Men gan (cũng có ở tim, cơ)", high: "Gan hoặc cơ đang bị ảnh hưởng" },
  GGT: { what: "Men gan liên quan đường mật", high: "Thường gặp khi uống rượu bia, gan nhiễm mỡ hoặc tắc mật" },
  ALB: { what: "Đạm chính trong máu do gan tạo ra", low: "Thiếu dinh dưỡng, bệnh gan hoặc thận" },
  PROT: {
    what: "Tổng lượng đạm trong máu",
    high: "Mất nước hoặc viêm mạn tính",
    low: "Thiếu dinh dưỡng, bệnh gan hoặc thận",
  },
  BILI_T: {
    what: "Sắc tố vàng từ hồng cầu cũ, do gan xử lý",
    high: "Có thể gây vàng da; liên quan gan, mật hoặc tan máu",
  },
  BILI_D: { what: "Phần bilirubin đã được gan xử lý", high: "Thường liên quan gan hoặc đường mật" },

  // Thận
  CREA: { what: "Chất thải từ cơ, lọc qua thận", high: "Thận lọc kém hơn bình thường" },
  EGFR: { what: "Ước tính mức lọc của thận", low: "Chức năng thận giảm" },
  UREA: { what: "Chất thải từ đạm, lọc qua thận", high: "Thận lọc kém hoặc mất nước, ăn nhiều đạm" },
  URIC: { what: "Acid uric, liên quan bệnh gút", high: "Nguy cơ gút, sỏi thận" },

  // Công thức máu
  RBC: { what: "Số lượng hồng cầu (mang oxy)", high: "Cô đặc máu hoặc thiếu oxy kéo dài", low: "Thiếu máu" },
  HGB: { what: "Huyết sắc tố, chất mang oxy trong hồng cầu", low: "Thiếu máu" },
  HCT: { what: "Tỷ lệ thể tích hồng cầu trong máu", high: "Cô đặc máu, mất nước", low: "Thiếu máu" },
  MCV: {
    what: "Kích thước trung bình của hồng cầu",
    high: "Hồng cầu to (thiếu B12, folate…)",
    low: "Hồng cầu nhỏ (thiếu sắt, thalassemia…)",
  },
  MCH: { what: "Lượng huyết sắc tố trong mỗi hồng cầu", low: "Hồng cầu nhạt màu, thường do thiếu sắt" },
  MCHC: { what: "Nồng độ huyết sắc tố trong hồng cầu", low: "Hồng cầu nhạt màu, thường do thiếu sắt" },
  WBC: {
    what: "Số lượng bạch cầu (chống nhiễm trùng)",
    high: "Đang có nhiễm trùng, viêm hoặc căng thẳng",
    low: "Sức đề kháng giảm",
  },
  NEUT_PCT: {
    what: "Tỷ lệ bạch cầu trung tính (chống vi khuẩn)",
    high: "Thường gặp khi nhiễm khuẩn",
    low: "Có thể do virus hoặc thuốc",
  },
  LYMPH_PCT: {
    what: "Tỷ lệ bạch cầu lympho (chống virus)",
    high: "Thường gặp khi nhiễm virus",
    low: "Có thể do căng thẳng, thuốc",
  },
  PLT: { what: "Tiểu cầu, giúp máu đông", high: "Có thể do viêm, thiếu sắt", low: "Dễ chảy máu, bầm tím" },

  // Điện giải
  CA: {
    what: "Canxi trong máu (xương, cơ, thần kinh)",
    high: "Liên quan tuyến cận giáp, thuốc",
    low: "Thiếu canxi hoặc vitamin D",
  },
  NA: { what: "Natri, giữ cân bằng nước", high: "Mất nước", low: "Thừa nước, do thuốc hoặc bệnh thận" },
  K: {
    what: "Kali, quan trọng cho nhịp tim và cơ",
    high: "Có thể ảnh hưởng nhịp tim",
    low: "Mệt, chuột rút; có thể do thuốc lợi tiểu",
  },
  CL: { what: "Clo, đi cùng natri giữ cân bằng nước" },

  // Đường huyết
  GLUCOSE: {
    what: "Lượng đường trong máu lúc xét nghiệm",
    high: "Đường huyết cao, cần theo dõi tiểu đường",
    low: "Hạ đường huyết",
  },
  HBA1C: { what: "Đường huyết trung bình 2–3 tháng gần đây", high: "Tiền tiểu đường hoặc tiểu đường" },

  // Miễn dịch
  HBSAG: { what: "Dấu hiệu đang nhiễm virus viêm gan B", high: "Dương tính, tức là đang mang virus viêm gan B" },
  ANTI_HCV: { what: "Kháng thể viêm gan C", high: "Dương tính, tức là đã từng hoặc đang nhiễm viêm gan C" },

  // Mỡ máu
  CHOL: { what: "Tổng lượng mỡ cholesterol trong máu", high: "Mỡ máu cao, tăng nguy cơ tim mạch" },
  LDL: { what: 'Mỡ "xấu", bám vào thành mạch', high: "Tăng nguy cơ xơ vữa mạch, tim mạch" },
  HDL: { what: 'Mỡ "tốt", giúp dọn mỡ thừa', low: "Thấp là kém bảo vệ tim mạch" },
  TG: { what: "Mỡ trung tính, tăng sau ăn nhiều tinh bột, đường, rượu bia", high: "Mỡ máu cao" },

  // Sắt
  FERRITIN: { what: "Lượng sắt dự trữ trong cơ thể", high: "Viêm hoặc thừa sắt", low: "Thiếu sắt" },
  IRON: { what: "Sắt đang lưu hành trong máu", low: "Thiếu sắt" },

  // Khác
  HP: { what: "Vi khuẩn H. pylori ở dạ dày", high: "Dương tính, tức là có vi khuẩn; có thể gây viêm loét dạ dày" },
  TSH: {
    what: "Hormone điều khiển tuyến giáp",
    high: "Tuyến giáp có thể hoạt động kém (suy giáp)",
    low: "Tuyến giáp có thể hoạt động quá mức (cường giáp)",
  },
  FT3: { what: "Hormone tuyến giáp", high: "Cường giáp", low: "Suy giáp" },
  FT4: { what: "Hormone tuyến giáp", high: "Cường giáp", low: "Suy giáp" },
  CRP: { what: "Dấu hiệu viêm trong cơ thể", high: "Đang có viêm hoặc nhiễm trùng" },
  VITB12: { what: "Vitamin B12 (thần kinh, tạo máu)", low: "Thiếu B12: mệt, tê tay chân, thiếu máu" },
  VITD: { what: "Vitamin D (xương, miễn dịch)", low: "Thiếu vitamin D" },
};

/** The sentence to show under a result: what it is, plus what its flag usually means. */
export function explainResult(code: string | null, flag: string | null, name?: string): string | null {
  const info = code ? TEST_INFO[code] : undefined;
  if (!info) return null;
  // "Cân nặng" explained as "Cân nặng" says nothing; skip it unless there's a flag meaning to add.
  const repeatsName = !!name && info.what.toLowerCase() === name.toLowerCase();
  const meaning = flag === "high" || flag === "abnormal" ? info.high : flag === "low" ? info.low : undefined;
  if (!meaning) return repeatsName ? null : `${info.what}.`;
  const label = flag === "low" ? "Thấp" : flag === "abnormal" ? "Bất thường" : "Cao";
  return `${info.what}. ${label}: ${meaning.charAt(0).toLowerCase()}${meaning.slice(1)}.`;
}
