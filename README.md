# Sổ bệnh án

A private website for the medical records of two people (a couple in Vietnam): bệnh án (illnesses), lần khám (visits), documents (photos and PDFs), lab results, medications, to-dos and vaccinations. The interface is in Vietnamese and built for phones first.

Live at https://personal-clinic-episode.vercel.app (members only).

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · OpenAI (document reading, summaries, chat assistant) · Vercel AI SDK v7 · Tailwind CSS 4 · Vercel

## What it does

- **Keeps the records:** people → bệnh án → lần khám → documents, results, medications; plus to-dos and a vaccination book per person.
- **Reads documents with AI:** upload a lab sheet, prescription or vaccination card; the AI pulls out every value as printed, units and ranges are normalized in code, and nothing is saved until you confirm.
- **"+" button:** upload first and let the AI work out whose document it is, which bệnh án it continues and which visit it belongs to; or open the assistant.
- **Insights:** charts per test over time, an AI health summary per person, a printable summary for doctors, a calendar of visits, doses and to-dos.
- **Search** over everything, ignoring diacritics, with everyday terms ("mỡ máu", "men gan") and typo tolerance.
- **Chat assistant:** ask about the records, have it add or change things (every change waits for your approval on a card), or send it a photo of a result to read and file. It remembers context across conversations.

## Documentation

| Doc | What's in it |
|---|---|
| [docs/roadmap.md](docs/roadmap.md) | Phases, what's done, what's next, change log |
| [docs/architecture.md](docs/architecture.md) | Code map, data model, security, search, calendar, design system |
| [docs/ai.md](docs/ai.md) | Document extraction pipeline, other AI features, models, benchmarks |
| [docs/assistant.md](docs/assistant.md) | The chat assistant: tools, approval cards, memory, attachments, safety |
| [docs/development.md](docs/development.md) | Local setup, environment variables, migrations, tests, deploying |

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + publishable key and OPENAI_API_KEY
npm run dev                  # http://localhost:3000
```

Details, including running against a local Supabase instead of the hosted one, are in [docs/development.md](docs/development.md).
