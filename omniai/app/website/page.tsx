export default function WebsitePage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="pilot-voice text-2xl">Website</h2>

      <div
        role="status"
        className="border border-signal/50 rounded p-4 space-y-2"
      >
        <p className="text-sm text-signal">
          Website operations are temporarily disabled.
        </p>
        <p className="text-sm text-ash">
          Loading files, submitting edits, and publishing changes from this
          page are unavailable pending authorization and approval security
          repairs.
        </p>
        <p className="text-sm text-ash">
          Chat may still return a website edit draft, but that draft cannot
          currently be submitted or executed through the website workflow.
        </p>
      </div>
    </div>
  );
}