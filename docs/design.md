# Design

The app is read mostly on a phone by two people without medical training. The design goal: **show what needs attention first, explain the rest in plain words, and hide what's rarely used.**

## Style

Reference: [curated.design](https://curated.design/): a near-monochrome interface where content carries the color, a light serif for titles over a clean sans, pill-shaped buttons and filters, borderless rounded cards, generous white space, and a light/dark switch.

Palette: Color Hunt "soft blues" `#F7FBFC` `#D6E6F2` `#B9D7EA` `#769FCD`, plus deeper blues derived from it so buttons and text stay readable (WCAG AA on white).

### Color tokens

Defined once in `src/app/globals.css` as CSS variables (Tailwind `@theme`), with dark-mode values under `prefers-color-scheme: dark`. Components only use the token names, never raw hex. (The names date from the first design; their role is what matters.)

| Token | Role | Light | Dark |
|---|---|---|---|
| `paper` | Page background | `#ffffff` | `#0e141b` |
| `surface` | Cards, inputs, panels | `#f4f8fb` (from `#F7FBFC`) | `#151d27` |
| `paper-dim` | Hover, pressed, quiet fills | `#e9f1f8` | `#1c2632` |
| `line` / `line-strong` | Hairlines / emphasis | `#dbe7f1` (from `#D6E6F2`) / `#b9d7ea` | `#253242` / `#34465b` |
| `ink` / `ink-soft` / `ink-faint` | Text / secondary / hints | `#14202e` / `#4e6074` / `#8696a8` | `#e7eef6` / `#a2b1c2` / `#6c7e92` |
| `pine` (primary) | Main buttons, active pill, brand | `#2f5d8f` | `#9cc1e8` |
| `on-pine` | Text on primary | `#ffffff` | `#0e141b` |
| `pine-tint` | Selected / soft primary | `#d6e6f2` | `#1d2f44` |
| `pen` | Links | `#3d6ea8` (from `#769FCD`) | `#a9c8ea` |
| `stamp` (danger) | Overdue, high values, delete | `#b42318` | `#f28b82` |
| `flag-low` (warning) | Coming up, low values | `#9a5b05` | `#e7ac5c` |
| `flag-normal` (ok) | Normal, done | `#2c7a57` | `#74c79f` |

Color carries meaning only: **red = overdue / out of range / destructive**, **amber = coming up / low**, **green = normal / done**, **blue = actions and links**. Everything else stays neutral.

### Type

- **Titles** (page and section headings): Newsreader, a light editorial serif with Vietnamese support (the reference's Hedvig Letters Serif has no Vietnamese).
- **Everything else**: Be Vietnam Pro with slightly tightened letter-spacing.
- **Numbers**: tabular figures in the regular font, not a typewriter font.

### Shapes

- Buttons, filters and tabs are pills. The primary action is a filled blue pill, and there's one per view.
- Cards are borderless `surface` blocks with large corners. Lists use hairline rows inside a card instead of a card per item.
- Overlays (chat, search, sheets) come up from the bottom on phones.

## UX review (02/10/2026)

A page-by-page review at phone size, as someone without medical knowledge.

| Page | What's wrong |
|---|---|
| Home (~3,000 px) | A full month calendar fills the first screen, and most of its days are empty. Upcoming items appear three times (calendar, "Sắp tới", "Việc cần làm"). The overdue flu dose is only a small badge mid-page. Appointments are mixed with general advice ("Bác sĩ dặn giảm cân…"), and every row has edit and delete icons. All 11 visits are listed, with hospital names in mixed capitals. The notification switch sits in the calendar. |
| Person (~5,800 px) | The order is upside down: calendar, then a long AI summary, then ~20 chart cards; bệnh án, the overdue vaccine and to-dos come last. Many charts have a single measurement. Test names (MCV, MCH, GGT) come without explanation. "Xóa hồ sơ" is exposed, and the "Lần khám" button is ambiguous. |
| Visit (~9,000 px for 7 documents) | Seven separate document cards, each with one small photo. Photos open one at a time in a new browser tab (in the installed app this leaves the app). A flat table of ~40 results with nothing out-of-range first, and multi-line reference ranges. Empty add-medication and add-to-do forms are always open; "Xóa lần khám" is exposed. |
| Bệnh án | Only a list of visits: no explanation, no key values over time, no related to-dos. |
| Vaccination book | Clean, but an 8-field add form is always open and every dose has a delete ×. |
| Everywhere | Every card has the same weight, so nothing stands out. Dates and numbers use a typewriter font. Logout is one tap away in the header. Desktop is a narrow column. |

## Revamp plan

1. **Foundation:** palette, type, light/dark mode, pill buttons, status chips; a bottom sheet, a "⋯" menu and a Cài đặt page (logout, notifications, install, theme). **Plus a photo viewer**: every page of every document in a visit, swipe and pinch-zoom, without leaving the app.
2. **Home: "what needs me now".** A "Cần chú ý" card first (overdue in red, then the next 7 days), one card per person with status chips, the calendar shrunk to a week strip with "Xem lịch", to-dos split into "Lịch hẹn" (dated) and "Lời dặn của bác sĩ", and 3 recent visits with "Xem tất cả".
3. **Person page with tabs** (Tổng quan · Chỉ số · Lần khám · Tiêm chủng). Results in plain language: a one-line Vietnamese explanation per test, grouped by body part, out-of-range first, and charts only for tests measured at least twice. AI summary collapsed with "Đọc thêm".
4. **Visit page:** a photo strip opening the viewer, one combined summary, results with out-of-range first, and "+ Thêm" buttons opening sheets instead of open forms.
5. **The rest:** bệnh án page (what it is, status, key values over time, to-dos, timeline), vaccination book, the upload review screens, and a two-column desktop layout.
6. **Everywhere:** relative dates ("còn 5 ngày", "quá hạn 7 tháng"), tidy hospital names, and edit or delete behind "⋯".

### Progress

| Stage | Status |
|---|---|
| 1. Foundation | ✅ tokens, type, light/dark, `Sheet`, `MoreMenu`, `DueChip`, Cài đặt page, `PhotoGallery` |
| 2. Home | ✅ `AttentionList`, person cards, `WeekStrip`, split to-dos, `VisitList` as one list |
| 3. Person page | ✅ `Tabs`, `ResultRow` + `test-info.ts`, `ReadMore` for the AI summary |
| 4. Visit page | ✅ photo strip and viewer, results out-of-range first with explanations (normal ones folded), add-medication in a sheet, deletes behind "⋯", documents moved to the bottom (~9,000 → ~4,250 px) |
| 5. The rest | ⏳ bệnh án page, vaccination form, review screens, desktop two columns |
| 6. Everywhere | partly: relative dates and tidy names used on home, person and visit lists |

Shared building blocks for the remaining stages are in `src/components/` (`Sheet`, `MoreMenu`, `DueChip`, `ResultRow`, `AttentionList`, `Tabs`, `ReadMore`, `PhotoGallery`) and `src/lib/format.ts` (`relativeDue`, `relativeAgo`, `tidyName`). Change log in [roadmap.md](roadmap.md).
