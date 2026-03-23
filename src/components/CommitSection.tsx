import { useState, useCallback } from "react";
import { apiFetch } from "../lib/api";

interface Props {
  hasChanges: boolean;
  onCommitted: () => void;
  ahead: number;
  onPushed: () => void;
}

export function CommitSection({ hasChanges, onCommitted, ahead, onPushed }: Props) {
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generateMessage = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await apiFetch<{ message: string }>("/api/commit/message");
      if (data.message) {
        setMessage(data.message);
      }
    } catch {
      setError("Failed to generate message");
    } finally {
      setGenerating(false);
    }
  }, []);

  const handleCommit = useCallback(async () => {
    if (!message.trim()) return;
    setCommitting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiFetch<{ hash: string; ok: boolean }>(
        "/api/commit",
        undefined,
        { method: "POST", body: JSON.stringify({ message: message.trim() }) }
      );
      if (data.ok) {
        setSuccess(`Committed: ${data.hash}`);
        setMessage("");
        onCommitted();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  }, [message, onCommitted]);

  const handlePush = useCallback(async () => {
    setPushing(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch<{ ok: boolean }>("/api/push", undefined, { method: "POST" });
      setSuccess("Pushed!");
      onPushed();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }, [onPushed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCommit]
  );

  if (!hasChanges && !success && ahead === 0) return null;

  return (
    <div className="border border-border-default rounded-md px-3 py-2.5">
      {/* Commit UI — only when there are uncommitted changes */}
      {hasChanges && (
        <>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Commit message..."
            rows={message.includes("\n") ? Math.min(message.split("\n").length + 1, 8) : 2}
            style={{ padding: '10px 12px' }}
            className="w-full bg-surface-2 border border-border-default rounded-sm text-xs text-text-primary placeholder:text-text-tertiary font-mono resize-vertical focus:outline-none focus:border-border-accent"
          />

          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={handleCommit}
              disabled={!message.trim() || committing}
              className="flex-1 h-8 bg-border-accent hover:bg-border-accent/80 disabled:opacity-40 disabled:cursor-not-allowed text-surface-0 text-xs font-medium px-2 rounded-sm transition-colors"
            >
              {committing ? "Committing..." : "Commit"}
            </button>
            <button
              onClick={generateMessage}
              disabled={generating}
              title="Generate commit message with AI"
              className="shrink-0 w-8 h-8 flex items-center justify-center bg-surface-3 hover:bg-surface-2 border border-border-default hover:border-border-accent/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm transition-colors"
            >
              <span className="text-sm">{generating ? "\u23F3" : "\u2728"}</span>
            </button>
          </div>
        </>
      )}

      {/* Push button */}
      {ahead > 0 && (
        <button
          onClick={handlePush}
          disabled={pushing}
          className="w-full mt-1.5 bg-surface-3 hover:bg-surface-2 border border-border-default hover:border-border-accent/50 disabled:opacity-40 disabled:cursor-not-allowed text-text-primary text-xs font-medium py-1.5 px-2 rounded-sm transition-colors flex items-center justify-center gap-1.5"
        >
          {pushing ? "Pushing..." : `Push (${ahead} commit${ahead === 1 ? "" : "s"} ahead)`}
        </button>
      )}

      {/* Feedback */}
      {error && (
        <div className="mt-1.5 text-[10px] text-status-deleted">{error}</div>
      )}
      {success && (
        <div className="mt-1.5 text-[10px] text-status-added">{success}</div>
      )}
    </div>
  );
}
