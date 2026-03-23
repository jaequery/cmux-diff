import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  badge?: ReactNode;
  rightContent?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  /** Fill remaining space instead of fixed height */
  flex?: boolean;
}

function loadState(id: string) {
  try {
    const raw = localStorage.getItem(`cmux-accordion-${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(id: string, open: boolean, height: number) {
  localStorage.setItem(`cmux-accordion-${id}`, JSON.stringify({ open, height }));
}

export function AccordionSection({
  id,
  title,
  badge,
  rightContent,
  children,
  defaultOpen = true,
  defaultHeight = 200,
  minHeight = 60,
  flex = false,
}: Props) {
  const saved = loadState(id);
  const [open, setOpen] = useState(saved?.open ?? defaultOpen);
  const [height, setHeight] = useState(saved?.height ?? defaultHeight);
  const [resizing, setResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const toggle = useCallback(() => {
    setOpen((prev: boolean) => {
      const next = !prev;
      saveState(id, next, height);
      return next;
    });
  }, [id, height]);

  useEffect(() => {
    if (!resizing) {
      saveState(id, open, height);
    }
  }, [resizing, id, open, height]);

  useEffect(() => {
    if (!resizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startYRef.current;
      setHeight(Math.max(minHeight, startHeightRef.current + delta));
    };

    const onMouseUp = () => setResizing(false);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizing, minHeight]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startYRef.current = e.clientY;
      startHeightRef.current = height;
      setResizing(true);
    },
    [height],
  );

  return (
    <div
      className={`relative flex flex-col ${flex && open ? "flex-1 shrink min-h-0" : "shrink-0"} ${resizing ? "select-none" : ""}`}
      style={!flex && open ? { height } : undefined}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-border-default">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer transition-colors duration-75 hover:bg-surface-2"
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-3 h-3 text-text-tertiary transition-transform duration-150 ${open ? "rotate-90" : ""}`}
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M6 4l4 4-4 4V4z" />
            </svg>
            <span className="text-[13px] font-medium text-text-primary uppercase tracking-wider">
              {title}
            </span>
            {badge}
          </div>
          {open && rightContent && (
            <div onClick={(e) => e.stopPropagation()}>{rightContent}</div>
          )}
        </button>
      </div>

      {/* Content */}
      {open && (
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
      )}

      {/* Resize handle - bottom edge */}
      <div
        onMouseDown={startResize}
        className="absolute bottom-0 left-0 right-0 h-[6px] translate-y-1/2 cursor-row-resize z-20 group"
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-border-default group-hover:h-[2px] group-hover:bg-border-accent transition-all duration-150" />
      </div>
    </div>
  );
}
