export const CASE_STATUS: Record<string, string> = {
  dang_dieu_tri: "Đang điều trị",
  theo_doi: "Theo dõi",
  da_khoi: "Đã khỏi",
};

export const CASE_STATUS_STYLE: Record<string, string> = {
  dang_dieu_tri: "bg-amber-100 text-amber-800",
  theo_doi: "bg-sky-100 text-sky-800",
  da_khoi: "bg-emerald-100 text-emerald-800",
};

export const DOC_TYPE: Record<string, string> = {
  lab_result: "Kết quả xét nghiệm",
  imaging_report: "Chẩn đoán hình ảnh",
  prescription: "Đơn thuốc",
  discharge_summary: "Giấy ra viện / tóm tắt",
  visit_note: "Phiếu khám",
  invoice: "Hóa đơn",
  other: "Khác",
};

export const SEX: Record<string, string> = {
  nam: "Nam",
  nu: "Nữ",
  khac: "Khác",
};
