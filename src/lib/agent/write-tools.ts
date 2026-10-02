import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { CASE_STATUS, DOC_TYPE } from "@/lib/labels";
import * as inbox from "@/lib/services/inbox";
import * as records from "@/lib/services/records";
import { check, type Supabase } from "@/lib/services/records";
import type { ApprovalField, ApprovalPreview } from "@/lib/agent/approval";

// Phase 8b: tools that change the records. None of them runs until the user approves a card in the chat:
// `preview` builds that card from the input and the rows as they are now (and throws if the change can't
// be made, which turns into an automatic denial the model can explain), `run` makes the change through
// the same services the forms use. Every executed change is logged in agent_actions with the row as it was.

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const text = (max: number) => z.string().trim().min(1).max(max);
// For updates: leave a field out to keep it, send null to clear it.
const patchText = (max: number) => z.string().trim().max(max).nullable().optional();
const patchDate = isoDate.nullable().optional();
const caseStatus = z.enum(["dang_dieu_tri", "theo_doi", "da_khoi"]);

type Row = Record<string, unknown>;

type WriteSpec<S extends z.ZodType> = {
  description: string;
  inputSchema: S;
  destructive?: boolean;
  preview: (input: z.infer<S>) => Promise<ApprovalPreview>;
  run: (input: z.infer<S>) => Promise<{ before?: Row | null; result: Row }>;
};

const spec = <S extends z.ZodType>(s: WriteSpec<S>) => s;

// ---------- Display helpers ----------

type FieldDef = { label: string; format?: (v: unknown) => string | null | Promise<string | null> };

/** Card rows for the fields present in the input; with `before`, only fields that actually change. */
async function fieldRows(defs: Record<string, FieldDef>, input: Row, before?: Row): Promise<ApprovalField[]> {
  const rows: ApprovalField[] = [];
  for (const [key, def] of Object.entries(defs)) {
    if (input[key] === undefined) continue;
    const show = async (v: unknown) =>
      v === null || v === undefined || v === "" ? null : def.format ? await def.format(v) : String(v);
    const after = await show(input[key]);
    if (before) {
      const was = await show(before[key]);
      if (was !== after) rows.push({ label: def.label, before: was, after });
    } else if (after !== null) {
      rows.push({ label: def.label, after });
    }
  }
  return rows;
}

const date = (v: unknown) => formatDate(String(v));

function only<T extends Row>(input: T, omit: string[]): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([k, v]) => v !== undefined && !omit.includes(k)),
  ) as Partial<T>;
}

const plural = (n: number, what: string) => `${n} ${what}`;

export function createWriteTools(supabase: Supabase, { threadId }: { threadId: string }) {
  async function one<R extends { data: unknown; error: { message: string } | null }>(
    query: PromiseLike<R>,
    notFound: string,
  ): Promise<NonNullable<R["data"]>> {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data) throw new Error(notFound);
    return data as NonNullable<R["data"]>;
  }

  const person = (id: string) =>
    one(supabase.from("people").select("id, full_name").eq("id", id).maybeSingle(), "Không tìm thấy người này.");
  const caseRow = (id: string) =>
    one(
      supabase.from("cases").select("*, people(full_name)").eq("id", id).maybeSingle(),
      "Không tìm thấy bệnh án này.",
    );
  const visitRow = (id: string) =>
    one(
      supabase.from("visits").select("*, people(full_name)").eq("id", id).maybeSingle(),
      "Không tìm thấy lần khám này.",
    );

  const visitLabel = (v: { visit_date: string | null; facility: string | null }) =>
    ["Lần khám", v.visit_date ? formatDate(v.visit_date) : "(chưa rõ ngày)", v.facility].filter(Boolean).join(" · ");
  const caseTitle = async (id: unknown) => (await caseRow(String(id))).title;

  /** A visit or bệnh án given with a person must belong to that person. */
  async function ensureSamePerson(
    personId: string,
    { caseId, visitId }: { caseId?: string | null; visitId?: string | null },
  ) {
    if (caseId && (await caseRow(caseId)).person_id !== personId) throw new Error("Bệnh án này thuộc về người khác.");
    if (visitId && (await visitRow(visitId)).person_id !== personId)
      throw new Error("Lần khám này thuộc về người khác.");
  }

  const CASE_FIELDS: Record<string, FieldDef> = {
    title: { label: "Tên bệnh án" },
    status: { label: "Trạng thái", format: (v) => CASE_STATUS[String(v)] ?? String(v) },
    started_on: { label: "Bắt đầu", format: date },
    ended_on: { label: "Kết thúc", format: date },
    notes: { label: "Ghi chú" },
  };
  const VISIT_FIELDS: Record<string, FieldDef> = {
    visit_date: { label: "Ngày khám", format: date },
    facility: { label: "Nơi khám" },
    department: { label: "Khoa" },
    doctor: { label: "Bác sĩ" },
    reason: { label: "Lý do khám" },
    case_id: { label: "Bệnh án", format: caseTitle },
    notes: { label: "Ghi chú" },
  };
  const MEDICATION_FIELDS: Record<string, FieldDef> = {
    name: { label: "Thuốc" },
    dose: { label: "Liều" },
    schedule: { label: "Cách dùng" },
    duration_days: { label: "Số ngày", format: (v) => `${v} ngày` },
    notes: { label: "Ghi chú" },
  };
  const TODO_FIELDS: Record<string, FieldDef> = {
    content: { label: "Việc cần làm" },
    due_on: { label: "Hạn", format: date },
    notes: { label: "Ghi chú" },
    done: { label: "Trạng thái", format: (v) => (v ? "Đã xong" : "Chưa xong") },
  };
  const VACCINATION_FIELDS: Record<string, FieldDef> = {
    vaccine_name: { label: "Vắc xin" },
    disease: { label: "Phòng bệnh" },
    dose_label: { label: "Mũi" },
    given_on: { label: "Ngày tiêm", format: date },
    next_due_on: { label: "Hẹn mũi sau", format: date },
    facility: { label: "Nơi tiêm" },
    notes: { label: "Ghi chú" },
  };

  const count = async (
    table: "documents" | "document_files" | "observations" | "medications" | "action_items" | "vaccinations",
    column: string,
    value: string,
  ) => {
    const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq(column, value);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  const specs = {
    // ---------- Bệnh án ----------
    create_case: spec({
      description: "Create a bệnh án (an illness/condition that groups visits) for a person.",
      inputSchema: z.object({
        person_id: uuid,
        title: text(200).describe("e.g. 'Mỡ máu cao', 'Viêm xoang'"),
        status: caseStatus.default("dang_dieu_tri"),
        started_on: isoDate.optional(),
        notes: text(2000).optional(),
      }),
      preview: async (input) => ({
        title: "Thêm bệnh án",
        destructive: false,
        person: (await person(input.person_id)).full_name,
        fields: await fieldRows(CASE_FIELDS, input),
      }),
      run: async (input) => {
        const { id } = await records.createCase(supabase, input);
        return { result: { id, url: `/cases/${id}` } };
      },
    }),

    update_case: spec({
      description:
        "Change a bệnh án: rename it, change its status (e.g. mark it đã khỏi with ended_on), dates or notes. " +
        "Only include fields that change; null clears a field.",
      inputSchema: z.object({
        case_id: uuid,
        title: text(200).optional(),
        status: caseStatus.optional(),
        started_on: patchDate,
        ended_on: patchDate,
        notes: patchText(2000),
      }),
      preview: async (input) => {
        const c = await caseRow(input.case_id);
        return {
          title: "Sửa bệnh án",
          destructive: false,
          person: c.people.full_name,
          target: c.title,
          fields: await fieldRows(CASE_FIELDS, input, c),
        };
      },
      run: async (input) => {
        const before = await caseRow(input.case_id);
        await records.updateCase(supabase, input.case_id, only(input, ["case_id"]));
        return { before, result: { id: input.case_id, url: `/cases/${input.case_id}` } };
      },
    }),

    delete_case: spec({
      description: "Delete a bệnh án. Its visits are kept; they just no longer belong to it.",
      destructive: true,
      inputSchema: z.object({ case_id: uuid }),
      preview: async ({ case_id }) => {
        const c = await caseRow(case_id);
        const { count: visits } = await supabase
          .from("visits")
          .select("id", { count: "exact", head: true })
          .eq("case_id", case_id);
        return {
          title: "Xoá bệnh án",
          destructive: true,
          person: c.people.full_name,
          target: c.title,
          fields: [],
          keeps: visits ? [`${plural(visits, "lần khám")} vẫn được giữ, chỉ không còn thuộc bệnh án này`] : [],
        };
      },
      run: async ({ case_id }) => {
        const before = await caseRow(case_id);
        await records.deleteCase(supabase, case_id);
        return { before, result: { deleted: true, url: `/people/${before.person_id}` } };
      },
    }),

    // ---------- Lần khám ----------
    create_visit: spec({
      description:
        "Record a visit (lần khám) for a person. Fill in only what the user said; leave unknown fields out. " +
        "Attach it to an existing bệnh án with case_id when it clearly belongs to one.",
      inputSchema: z.object({
        person_id: uuid,
        case_id: uuid.optional(),
        visit_date: isoDate.optional(),
        facility: text(200).optional().describe("Hospital or clinic"),
        department: text(200).optional(),
        doctor: text(200).optional(),
        reason: text(1000).optional(),
        notes: text(4000).optional(),
      }),
      preview: async (input) => {
        await ensureSamePerson(input.person_id, { caseId: input.case_id });
        return {
          title: "Thêm lần khám",
          destructive: false,
          person: (await person(input.person_id)).full_name,
          fields: await fieldRows(VISIT_FIELDS, input),
        };
      },
      run: async (input) => {
        const { id } = await records.createVisit(supabase, input);
        return { result: { id, url: `/visits/${id}` } };
      },
    }),

    update_visit: spec({
      description:
        "Change a visit's details (date, facility, department, doctor, reason, notes, or which bệnh án it belongs to). " +
        "Only include fields that change; null clears a field.",
      inputSchema: z.object({
        visit_id: uuid,
        case_id: uuid.nullable().optional(),
        visit_date: patchDate,
        facility: patchText(200),
        department: patchText(200),
        doctor: patchText(200),
        reason: patchText(1000),
        notes: patchText(4000),
      }),
      preview: async (input) => {
        const v = await visitRow(input.visit_id);
        await ensureSamePerson(v.person_id, { caseId: input.case_id });
        return {
          title: "Sửa lần khám",
          destructive: false,
          person: v.people.full_name,
          target: visitLabel(v),
          fields: await fieldRows(VISIT_FIELDS, input, v),
        };
      },
      run: async (input) => {
        const before = await visitRow(input.visit_id);
        await records.updateVisit(supabase, input.visit_id, only(input, ["visit_id"]));
        return { before, result: { id: input.visit_id, url: `/visits/${input.visit_id}` } };
      },
    }),

    delete_visit: spec({
      description:
        "Delete a visit with everything recorded under it (documents and their files, lab results, medications).",
      destructive: true,
      inputSchema: z.object({ visit_id: uuid }),
      preview: async ({ visit_id }) => {
        const v = await visitRow(visit_id);
        const docs = check(
          await supabase.from("documents").select("id, document_files(count)").eq("visit_id", visit_id),
        );
        const pages = docs.reduce((n, d) => n + (d.document_files[0]?.count ?? 0), 0);
        const [observations, medications] = await Promise.all([
          count("observations", "visit_id", visit_id),
          count("medications", "visit_id", visit_id),
        ]);
        const fromDocs = docs.map((d) => d.id);
        const [todos, vaccinations] = fromDocs.length
          ? await Promise.all([
              supabase.from("action_items").select("id", { count: "exact", head: true }).in("document_id", fromDocs),
              supabase.from("vaccinations").select("id", { count: "exact", head: true }).in("document_id", fromDocs),
            ]).then((r) => r.map((x) => x.count ?? 0))
          : [0, 0];
        const removes = [
          docs.length && `${plural(docs.length, "tài liệu")} (${plural(pages, "trang ảnh/PDF")})`,
          observations && plural(observations, "chỉ số xét nghiệm"),
          medications && plural(medications, "thuốc"),
          todos && `${plural(todos, "việc cần làm")} lấy từ tài liệu`,
          vaccinations && `${plural(vaccinations, "mũi tiêm")} lấy từ tài liệu`,
        ].filter((x): x is string => !!x);
        return {
          title: "Xoá lần khám",
          destructive: true,
          person: v.people.full_name,
          target: visitLabel(v),
          fields: [],
          removes,
        };
      },
      run: async ({ visit_id }) => {
        const before = await visitRow(visit_id);
        await records.deleteVisit(supabase, visit_id);
        return { before, result: { deleted: true, url: `/people/${before.person_id}` } };
      },
    }),

    // ---------- Tài liệu ----------
    delete_document: spec({
      description:
        "Delete a document (its files, and the medications, to-dos and vaccinations read from it). " +
        "Lab results read from it are kept on the visit.",
      destructive: true,
      inputSchema: z.object({ document_id: uuid }),
      preview: async ({ document_id }) => {
        const d = await one(
          supabase
            .from("documents")
            .select("title, doc_type, visits(visit_date, facility, people(full_name))")
            .eq("id", document_id)
            .maybeSingle(),
          "Không tìm thấy tài liệu này.",
        );
        const [pages, medications, todos, vaccinations, observations] = await Promise.all([
          count("document_files", "document_id", document_id),
          count("medications", "document_id", document_id),
          count("action_items", "document_id", document_id),
          count("vaccinations", "document_id", document_id),
          count("observations", "document_id", document_id),
        ]);
        return {
          title: "Xoá tài liệu",
          destructive: true,
          person: d.visits.people.full_name,
          target: `${d.title ?? "Tài liệu"} · ${visitLabel(d.visits)}`,
          fields: [],
          removes: [
            plural(pages, "trang ảnh/PDF"),
            medications && plural(medications, "thuốc"),
            todos && plural(todos, "việc cần làm"),
            vaccinations && plural(vaccinations, "mũi tiêm"),
          ].filter((x): x is string => !!x),
          keeps: observations ? [`${plural(observations, "chỉ số xét nghiệm")} vẫn được giữ trong lần khám`] : [],
        };
      },
      run: async ({ document_id }) => {
        const before = check(await supabase.from("documents").select("*").eq("id", document_id).single());
        await records.deleteDocument(supabase, document_id);
        return { before, result: { deleted: true, url: `/visits/${before.visit_id}` } };
      },
    }),

    // ---------- Thuốc ----------
    add_medication: spec({
      description: "Add a medication prescribed at a visit.",
      inputSchema: z.object({
        visit_id: uuid,
        name: text(200),
        dose: text(200).optional().describe("e.g. '10mg'"),
        schedule: text(500).optional().describe("e.g. '1 viên/ngày sau ăn tối'"),
        duration_days: z.number().int().min(1).max(3650).optional(),
        notes: text(1000).optional(),
      }),
      preview: async (input) => {
        const v = await visitRow(input.visit_id);
        return {
          title: "Thêm thuốc",
          destructive: false,
          person: v.people.full_name,
          target: visitLabel(v),
          fields: await fieldRows(MEDICATION_FIELDS, input),
        };
      },
      run: async (input) => {
        const { id } = await records.addMedication(supabase, input);
        return { result: { id, url: `/visits/${input.visit_id}` } };
      },
    }),

    delete_medication: spec({
      description: "Delete one medication from a visit.",
      destructive: true,
      inputSchema: z.object({ medication_id: uuid }),
      preview: async ({ medication_id }) => {
        const m = await one(
          supabase
            .from("medications")
            .select("*, visits(visit_date, facility, people(full_name))")
            .eq("id", medication_id)
            .maybeSingle(),
          "Không tìm thấy thuốc này.",
        );
        return {
          title: "Xoá thuốc",
          destructive: true,
          person: m.visits.people.full_name,
          target: visitLabel(m.visits),
          fields: await fieldRows(MEDICATION_FIELDS, m),
        };
      },
      run: async ({ medication_id }) => {
        const before = check(await supabase.from("medications").select("*").eq("id", medication_id).single());
        await records.deleteMedication(supabase, medication_id);
        return { before, result: { deleted: true, url: `/visits/${before.visit_id}` } };
      },
    }),

    // ---------- Việc cần làm ----------
    add_todo: spec({
      description:
        "Add a to-do (việc cần làm) for a person, e.g. doctor's advice or a follow-up appointment (tái khám) with due_on. " +
        "Write content as a short clear instruction in Vietnamese.",
      inputSchema: z.object({
        person_id: uuid,
        content: text(500),
        due_on: isoDate.optional(),
        visit_id: uuid.optional().describe("The visit the advice came from, if any"),
        notes: text(1000).optional(),
      }),
      preview: async (input) => {
        await ensureSamePerson(input.person_id, { visitId: input.visit_id });
        const fields = await fieldRows(TODO_FIELDS, input);
        if (input.visit_id) fields.push({ label: "Từ", after: visitLabel(await visitRow(input.visit_id)) });
        return {
          title: "Thêm việc cần làm",
          destructive: false,
          person: (await person(input.person_id)).full_name,
          fields,
        };
      },
      run: async (input) => {
        // Not polished by AI: what the user approved is exactly what gets saved.
        const { id } = await records.addTodo(supabase, input, { polish: false });
        return { result: { id, url: input.visit_id ? `/visits/${input.visit_id}` : `/people/${input.person_id}` } };
      },
    }),

    update_todo: spec({
      description:
        "Change a to-do: mark it done (done: true) or not done, reword it, change its due date or notes. " +
        "Only include fields that change; null clears a field.",
      inputSchema: z.object({
        todo_id: uuid,
        done: z.boolean().optional(),
        content: text(500).optional(),
        due_on: patchDate,
        notes: patchText(1000),
      }),
      preview: async (input) => {
        const t = await one(
          supabase.from("action_items").select("*, people(full_name)").eq("id", input.todo_id).maybeSingle(),
          "Không tìm thấy việc cần làm này.",
        );
        return {
          title:
            input.done === true && Object.keys(only(input, ["todo_id", "done"])).length === 0
              ? "Đánh dấu đã xong"
              : "Sửa việc cần làm",
          destructive: false,
          person: t.people.full_name,
          target: t.content,
          fields: await fieldRows(TODO_FIELDS, input, t),
        };
      },
      run: async (input) => {
        const before = check(await supabase.from("action_items").select("*").eq("id", input.todo_id).single());
        await records.updateTodo(supabase, input.todo_id, only(input, ["todo_id"]));
        return {
          before,
          result: {
            id: input.todo_id,
            url: before.visit_id ? `/visits/${before.visit_id}` : `/people/${before.person_id}`,
          },
        };
      },
    }),

    delete_todo: spec({
      description: "Delete a to-do. To just tick it off, use update_todo with done: true instead.",
      destructive: true,
      inputSchema: z.object({ todo_id: uuid }),
      preview: async ({ todo_id }) => {
        const t = await one(
          supabase.from("action_items").select("*, people(full_name)").eq("id", todo_id).maybeSingle(),
          "Không tìm thấy việc cần làm này.",
        );
        return {
          title: "Xoá việc cần làm",
          destructive: true,
          person: t.people.full_name,
          fields: await fieldRows(TODO_FIELDS, { content: t.content, due_on: t.due_on, notes: t.notes }),
        };
      },
      run: async ({ todo_id }) => {
        const before = check(await supabase.from("action_items").select("*").eq("id", todo_id).single());
        await records.deleteTodo(supabase, todo_id);
        return { before, result: { deleted: true, url: `/people/${before.person_id}` } };
      },
    }),

    // ---------- Tiêm chủng ----------
    add_vaccination: spec({
      description: "Record a vaccine dose a person received (or the date the next dose is due).",
      inputSchema: z.object({
        person_id: uuid,
        vaccine_name: text(200),
        disease: text(200).optional().describe("What it protects against, e.g. 'Cúm', 'Viêm gan B'"),
        dose_label: text(50).optional().describe("e.g. 'Mũi 1'"),
        given_on: isoDate.optional(),
        next_due_on: isoDate.optional(),
        facility: text(200).optional(),
        notes: text(1000).optional(),
      }),
      preview: async (input) => ({
        title: "Thêm mũi tiêm",
        destructive: false,
        person: (await person(input.person_id)).full_name,
        fields: await fieldRows(VACCINATION_FIELDS, input),
      }),
      run: async (input) => {
        const { id } = await records.addVaccination(supabase, input);
        return { result: { id, url: `/people/${input.person_id}/vaccinations` } };
      },
    }),

    update_vaccination: spec({
      description:
        "Change a recorded vaccine dose, e.g. move the next dose's due date (next_due_on) when the user postponed it, " +
        "or set next_due_on to null to stop reminding about a dose they decided to skip. Also fixes date, dose label, " +
        "facility or notes. Only include fields that change; null clears a field. To record a dose actually given, " +
        "use add_vaccination instead.",
      inputSchema: z.object({
        vaccination_id: uuid,
        vaccine_name: text(200).optional(),
        disease: patchText(200),
        dose_label: patchText(50),
        given_on: patchDate,
        next_due_on: patchDate,
        facility: patchText(200),
        notes: patchText(1000),
      }),
      preview: async (input) => {
        const v = await one(
          supabase.from("vaccinations").select("*, people(full_name)").eq("id", input.vaccination_id).maybeSingle(),
          "Không tìm thấy mũi tiêm này.",
        );
        return {
          title:
            input.next_due_on === null && Object.keys(only(input, ["vaccination_id", "next_due_on"])).length === 0
              ? "Bỏ nhắc mũi tiêm"
              : "Sửa mũi tiêm",
          destructive: false,
          person: v.people.full_name,
          target: [v.disease ?? v.vaccine_name, v.dose_label, v.given_on && formatDate(v.given_on)]
            .filter(Boolean)
            .join(" · "),
          fields: await fieldRows(VACCINATION_FIELDS, input, v),
        };
      },
      run: async (input) => {
        const before = check(await supabase.from("vaccinations").select("*").eq("id", input.vaccination_id).single());
        await records.updateVaccination(supabase, input.vaccination_id, only(input, ["vaccination_id"]));
        return { before, result: { id: input.vaccination_id, url: `/people/${before.person_id}/vaccinations` } };
      },
    }),

    delete_vaccination: spec({
      description: "Delete one recorded vaccine dose.",
      destructive: true,
      inputSchema: z.object({ vaccination_id: uuid }),
      preview: async ({ vaccination_id }) => {
        const v = await one(
          supabase.from("vaccinations").select("*, people(full_name)").eq("id", vaccination_id).maybeSingle(),
          "Không tìm thấy mũi tiêm này.",
        );
        return {
          title: "Xoá mũi tiêm",
          destructive: true,
          person: v.people.full_name,
          fields: await fieldRows(VACCINATION_FIELDS, v),
        };
      },
      run: async ({ vaccination_id }) => {
        const before = check(await supabase.from("vaccinations").select("*").eq("id", vaccination_id).single());
        await records.deleteVaccination(supabase, vaccination_id);
        return { before, result: { deleted: true, url: `/people/${before.person_id}/vaccinations` } };
      },
    }),
    // ---------- Tài liệu gửi trong chat (8c) ----------
    save_document: spec({
      description:
        "Save a document the user attached in the chat (after read_document) into the records, exactly as it was read: " +
        "its results, medications, vaccinations and advice. Attach it to an existing visit with visit_id (e.g. " +
        "suggested.existing_visit_id), or leave visit_id out to create a new visit from the document's date and facility; " +
        "for a new visit, optionally put it in a bệnh án with case_id or start one with new_case_title.",
      inputSchema: z.object({
        inbox_id: uuid,
        person_id: uuid,
        visit_id: uuid.optional(),
        case_id: uuid.optional(),
        new_case_title: text(200).optional(),
      }),
      preview: async (input) => {
        const item = await inbox.loadInboxItem(supabase, input.inbox_id);
        if (!item) throw new Error("Tài liệu này không còn chờ lưu (đã lưu hoặc đã bỏ).");
        const x = item.extraction;
        if (!x) throw new Error("Tài liệu chưa được đọc xong; hãy gọi read_document trước.");
        if (input.visit_id && (input.case_id || input.new_case_title))
          throw new Error("Khi gắn vào lần khám đã có thì bệnh án theo lần khám đó; đừng gửi case_id/new_case_title.");
        if (input.case_id && input.new_case_title) throw new Error("Chọn bệnh án có sẵn hoặc tạo mới, không cả hai.");
        await ensureSamePerson(input.person_id, { caseId: input.case_id, visitId: input.visit_id });
        const who = await person(input.person_id);

        const FLAG: Record<string, string> = { high: "cao", low: "thấp", abnormal: "bất thường" };
        const flagged = x.observations.filter((o) => o.flag && o.flag !== "normal");
        const newVisit = [x.document_date ? formatDate(x.document_date) : "chưa rõ ngày", x.facility].filter(Boolean);
        const fields: ApprovalField[] = [
          { label: "Loại", after: DOC_TYPE[x.document_type] ?? x.document_type },
          {
            label: "Lần khám",
            after: input.visit_id
              ? `${visitLabel(await visitRow(input.visit_id))} (đã có)`
              : `Mới · ${newVisit.join(" · ")}`,
          },
        ];
        if (input.case_id) fields.push({ label: "Bệnh án", after: await caseTitle(input.case_id) });
        if (input.new_case_title) fields.push({ label: "Bệnh án", after: `Mới: ${input.new_case_title}` });
        if (x.diagnoses.length) fields.push({ label: "Chẩn đoán", after: x.diagnoses.join("; ") });
        if (x.observations.length) {
          const shown = flagged
            .slice(0, 6)
            .map((o) => `${o.raw_name} ${o.value}${o.unit ? ` ${o.unit}` : ""} (${FLAG[o.flag!]})`);
          if (flagged.length > 6) shown.push(`+${flagged.length - 6}`);
          fields.push({
            label: "Chỉ số",
            after:
              `${x.observations.length} chỉ số` +
              (flagged.length ? `, ngoài ngưỡng: ${shown.join(", ")}` : ", đều trong ngưỡng"),
          });
        }
        if (x.medications.length) fields.push({ label: "Thuốc", after: x.medications.map((m) => m.name).join(", ") });
        if (x.vaccinations.length)
          fields.push({
            label: "Mũi tiêm",
            after: x.vaccinations
              .map((v) =>
                [v.vaccine_name, v.dose_label, v.given_on && formatDate(v.given_on)].filter(Boolean).join(" "),
              )
              .join(", "),
          });
        if (x.doctor_advice.length) fields.push({ label: "Lời dặn", after: x.doctor_advice.join("; ") });
        if (x.follow_up_date) fields.push({ label: "Tái khám", after: formatDate(x.follow_up_date) });

        const notes = [...x.uncertain];
        if (x.matched_person_id && x.matched_person_id !== input.person_id)
          notes.unshift(
            `AI đoán tài liệu này của người khác${x.patient_name ? ` (tên trên giấy: ${x.patient_name})` : ""}. Kiểm tra lại người bệnh.`,
          );
        else if (x.person_match_confidence === "low")
          notes.unshift("AI không chắc tài liệu này của ai. Kiểm tra lại người bệnh.");
        return {
          title: "Lưu tài liệu vào hồ sơ",
          destructive: false,
          person: who.full_name,
          target: item.files.join(", "),
          fields,
          notes,
          link: { href: `/inbox/${input.inbox_id}/review`, label: "Xem ảnh và sửa chi tiết" },
        };
      },
      run: async (input) => {
        const item = await inbox.loadInboxItem(supabase, input.inbox_id);
        const x = item?.extraction;
        if (!x) throw new Error("Tài liệu này không còn chờ lưu.");
        const { visitId, documentId } = await inbox.saveInboxItem(supabase, input.inbox_id, {
          personId: input.person_id,
          case: input.case_id
            ? { type: "existing", id: input.case_id }
            : input.new_case_title
              ? { type: "new", title: input.new_case_title }
              : { type: "none" },
          visit: input.visit_id
            ? { type: "existing", id: input.visit_id }
            : {
                type: "new",
                visit_date: x.document_date,
                facility: x.facility,
                department: x.department,
                doctor: x.doctor,
              },
          reviewed: inbox.reviewedFrom(x),
        });
        return { result: { visit_id: visitId, document_id: documentId, url: `/visits/${visitId}` } };
      },
    }),

    discard_document: spec({
      description:
        "Throw away a document the user attached in the chat without saving it (removes the uploaded files).",
      destructive: true,
      inputSchema: z.object({ inbox_id: uuid }),
      preview: async ({ inbox_id }) => {
        const item = await inbox.loadInboxItem(supabase, inbox_id);
        if (!item) throw new Error("Tài liệu này không còn chờ lưu (đã lưu hoặc đã bỏ).");
        return {
          title: "Bỏ tài liệu vừa gửi",
          destructive: true,
          target: item.files.join(", "),
          fields: [],
          removes: [`${plural(item.files.length, "file")} đã tải lên, chưa lưu vào hồ sơ`],
        };
      },
      run: async ({ inbox_id }) => {
        const before = await inbox.loadInboxItem(supabase, inbox_id);
        await inbox.discardInboxItem(supabase, inbox_id);
        return { before, result: { deleted: true } };
      },
    }),
  };

  // The approval card is built before the user sees anything; a change that can't be made, or that changes
  // nothing, is denied automatically with the reason so the model can tell the user.
  async function approval(name: string, input: unknown) {
    const s = (specs as Record<string, WriteSpec<z.ZodType>>)[name];
    if (!s) return undefined;
    try {
      const preview = await s.preview(input);
      const changesSomething = preview.destructive || preview.fields.length > 0;
      if (!changesSomething) return { type: "denied" as const, reason: "Không có gì thay đổi so với hiện tại." };
      return { type: "user-approval" as const, reason: JSON.stringify(preview) };
    } catch (e) {
      return { type: "denied" as const, reason: e instanceof Error ? e.message : String(e) };
    }
  }

  async function audit(name: string, input: unknown, before: Row | null | undefined, result: Row) {
    const { error } = await supabase.from("agent_actions").insert({
      thread_id: threadId,
      tool: name,
      input: input as Json,
      before: (before ?? null) as Json,
      result: result as Json,
    });
    // The change itself is done by now; a failed log entry shouldn't make it look like it wasn't.
    if (error) console.error("agent_actions insert failed", name, error.message);
  }

  const build = <S extends z.ZodType>(name: string, s: WriteSpec<S>) =>
    tool({
      description: s.description + (s.destructive ? " Destructive: the user sees a red confirmation card." : ""),
      inputSchema: s.inputSchema,
      execute: async (input: z.infer<S>) => {
        await s.preview(input); // re-check right before writing; rows may have changed since the card was shown
        const { before, result } = await s.run(input);
        await audit(name, input, before, result);
        return { ok: true, ...result };
      },
    });

  const tools = Object.fromEntries(
    Object.entries(specs).map(([name, s]) => [name, build(name, s as WriteSpec<z.ZodType>)]),
  ) as ToolSet;

  return { tools, approval, names: new Set(Object.keys(specs)) };
}
