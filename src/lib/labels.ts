export const CASE_STATUS: Record<string, string> = {
  dang_dieu_tri: "Đang điều trị",
  theo_doi: "Theo dõi",
  da_khoi: "Đã khỏi",
};

// Tone keys for <Badge>: đang điều trị (needs attention) / theo dõi (informational) / đã khỏi (resolved).
export const CASE_STATUS_TONE: Record<string, "low" | "pen" | "pine"> = {
  dang_dieu_tri: "low",
  theo_doi: "pen",
  da_khoi: "pine",
};

export const DOC_TYPE: Record<string, string> = {
  lab_result: "Kết quả xét nghiệm",
  imaging_report: "Chẩn đoán hình ảnh",
  prescription: "Đơn thuốc",
  discharge_summary: "Giấy ra viện / tóm tắt",
  visit_note: "Phiếu khám",
  vaccination_record: "Phiếu / sổ tiêm chủng",
  invoice: "Hóa đơn",
  other: "Khác",
};

export const SEX: Record<string, string> = {
  nam: "Nam",
  nu: "Nữ",
  khac: "Khác",
};
