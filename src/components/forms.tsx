import { saveCase, savePerson, saveVisit } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CASE_STATUS, SEX } from "@/lib/labels";
import { today } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function PersonForm({ person }: { person?: Tables<"people"> }) {
  return (
    <form action={savePerson} className="card space-y-4">
      {person && <input type="hidden" name="id" value={person.id} />}
      <Field label="Họ tên *">
        <input name="full_name" required className="input" defaultValue={person?.full_name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ngày sinh">
          <input type="date" name="birth_date" className="input" defaultValue={person?.birth_date ?? ""} />
        </Field>
        <Field label="Giới tính">
          <select name="sex" className="input" defaultValue={person?.sex ?? ""}>
            <option value="">—</option>
            {Object.entries(SEX).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nhóm máu">
          <input name="blood_type" className="input" placeholder="VD: O+" defaultValue={person?.blood_type ?? ""} />
        </Field>
      </div>
      <Field label="Dị ứng">
        <input
          name="allergies"
          className="input"
          placeholder="Thuốc, thức ăn…"
          defaultValue={person?.allergies ?? ""}
        />
      </Field>
      <Field label="Bệnh mãn tính / tiền sử">
        <textarea
          name="chronic_conditions"
          rows={2}
          className="input"
          defaultValue={person?.chronic_conditions ?? ""}
        />
      </Field>
      <Field label="Ghi chú">
        <textarea name="notes" rows={2} className="input" defaultValue={person?.notes ?? ""} />
      </Field>
      <SubmitButton>Lưu</SubmitButton>
    </form>
  );
}

export function CaseForm({ personId, item }: { personId: string; item?: Tables<"cases"> }) {
  return (
    <form action={saveCase} className="card space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="person_id" value={personId} />
      <Field label="Tên bệnh án *">
        <input
          name="title"
          required
          className="input"
          placeholder="VD: Viêm dạ dày, Khám thai, Gãy tay trái…"
          defaultValue={item?.title}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Trạng thái">
          <select name="status" className="input" defaultValue={item?.status ?? "dang_dieu_tri"}>
            {Object.entries(CASE_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bắt đầu">
          <input type="date" name="started_on" className="input" defaultValue={item?.started_on ?? today()} />
        </Field>
        <Field label="Kết thúc">
          <input type="date" name="ended_on" className="input" defaultValue={item?.ended_on ?? ""} />
        </Field>
      </div>
      <Field label="Ghi chú">
        <textarea name="notes" rows={3} className="input" defaultValue={item?.notes ?? ""} />
      </Field>
      <SubmitButton>Lưu</SubmitButton>
    </form>
  );
}

export function VisitForm({
  personId,
  cases,
  visit,
  defaultCaseId,
}: {
  personId: string;
  cases: Pick<Tables<"cases">, "id" | "title">[];
  visit?: Tables<"visits">;
  defaultCaseId?: string;
}) {
  return (
    <form action={saveVisit} className="card space-y-4">
      {visit && <input type="hidden" name="id" value={visit.id} />}
      <input type="hidden" name="person_id" value={personId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ngày khám (để trống nếu chưa rõ, AI có thể tự điền sau khi đọc tài liệu)">
          <input type="date" name="visit_date" className="input" defaultValue={visit?.visit_date ?? ""} />
        </Field>
        <Field label="Thuộc bệnh án">
          <select name="case_id" className="input" defaultValue={visit?.case_id ?? defaultCaseId ?? ""}>
            <option value="">— Không (khám lẻ / khám định kỳ)</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Nơi khám">
        <input
          name="facility"
          className="input"
          placeholder="VD: BV Bạch Mai, Medlatec…"
          defaultValue={visit?.facility ?? ""}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Khoa">
          <input name="department" className="input" defaultValue={visit?.department ?? ""} />
        </Field>
        <Field label="Bác sĩ">
          <input name="doctor" className="input" defaultValue={visit?.doctor ?? ""} />
        </Field>
      </div>
      <Field label="Lý do khám / triệu chứng">
        <textarea name="reason" rows={2} className="input" defaultValue={visit?.reason ?? ""} />
      </Field>
      <Field label="Ghi chú (bác sĩ dặn, kết luận…)">
        <textarea name="notes" rows={4} className="input" defaultValue={visit?.notes ?? ""} />
      </Field>
      <SubmitButton>Lưu</SubmitButton>
    </form>
  );
}
