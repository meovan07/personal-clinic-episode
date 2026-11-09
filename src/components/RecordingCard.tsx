import { AudioPlayer } from "@/components/AudioPlayer";
import { HealthSummary } from "@/components/HealthSummary";
import { Transcript } from "@/components/Transcript";
import type { Segment } from "@/lib/transcript";

// A consultation recording on a visit: player, the AI summary (Markdown) and the folded transcript.
// `menu` sits in the header (delete); `children` is the status / review action below.
export function RecordingCard({
  title,
  recordedOn,
  url,
  summary,
  segments,
  menu,
  children,
}: {
  title: string;
  recordedOn?: string | null;
  url: string | null;
  summary?: string | null;
  segments: Segment[];
  menu?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{title}</div>
          {recordedOn && <div className="muted">{recordedOn}</div>}
        </div>
        {menu}
      </div>
      {url && <AudioPlayer url={url} />}
      {summary && (
        <div className="card">
          <HealthSummary content={summary} />
        </div>
      )}
      <Transcript segments={segments} />
      {children && <div>{children}</div>}
    </div>
  );
}
