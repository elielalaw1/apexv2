"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@phosphor-icons/react";

type Step = {
  target: string;
  title: string;
  description: string;
  visual: "sessions" | "signals" | "zoom" | "combine" | "context";
};
const sessionSteps: Step[] = [
  {
    target: ".simple-filters",
    title: "Find the recording you need.",
    description:
      "Search by session name or participant, or choose a participant from the filter. Your newest recordings appear first.",
    visual: "sessions",
  },
  {
    target: ".simple-session-list",
    title: "One recording, a clearer picture.",
    description:
      "Open any session row to see its signals, self-reports and events. Demo recordings are clearly marked.",
    visual: "signals",
  },
];
const reviewSteps: Step[] = [
  {
    target: ".simple-signal-panel, [data-tour=canvas]",
    title: "Start with the signals.",
    description:
      "Switch between the signals recorded in this session. Each graph shows its unit, and shaded areas mark missing data.",
    visual: "signals",
  },
  {
    target: ".simple-chart-controls, .canvas-shared-controls",
    title: "Take a closer look.",
    description:
      "Hover or tap to read a value. Use Zoom in, or drag across a period. Full session takes you back to the whole recording.",
    visual: "zoom",
  },
  {
    target: "[data-tour=customize]",
    title: "Your view, your way.",
    description:
      "Open Customize to choose and arrange information cards. Drag one graph onto another to compare two signals on the same timeline. Different units keep separate axes.",
    visual: "combine",
  },
  {
    target: ".simple-context-grid, .review-card-grid, .simple-recording-info",
    title: "Put the recording in context.",
    description:
      "Self-reports show the participant’s ratings. The timeline shows events and notes. Your layout is saved for this session on this browser.",
    visual: "context",
  },
];

export default function DashboardTour({
  review,
  onClose,
}: {
  review: boolean;
  onClose: () => void;
}) {
  const steps = review ? reviewSteps : sessionSteps;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const scroll = { left: window.scrollX, top: window.scrollY };
    const el = dialog.current;
    el?.showModal();
    next.current?.focus();
    return () => {
      el?.close();
      const returnTo = previous?.isConnected
        ? previous
        : document.querySelector<HTMLElement>(".simple-tour-button");
      returnTo?.focus({ preventScroll: true });
      window.scrollTo(scroll);
    };
  }, []);
  useEffect(() => {
    const target =
      document.querySelector<HTMLElement>(steps[index].target) ??
      document.querySelector<HTMLElement>("main");
    if (target)
      window.scrollTo({
        top: Math.max(
          0,
          window.scrollY + target.getBoundingClientRect().top - 28,
        ),
        behavior: "instant",
      });
    function position() {
      const r = target?.getBoundingClientRect();
      if (!r) return;
      const x = Math.max(10, r.left - 7),
        y = Math.max(10, Math.min(innerHeight - 100, r.top - 7));
      setRect({
        x,
        y,
        width: Math.max(0, Math.min(innerWidth - x - 10, r.width + 14)),
        height: Math.max(50, Math.min(innerHeight - y - 10, r.height + 14)),
      });
    }
    position();
    const observer = new ResizeObserver(position);
    if (target) observer.observe(target);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [index, review]);
  const step = steps[index];
  return (
    <dialog
      className="apex-tour"
      ref={dialog}
      aria-labelledby="apex-tour-title"
      aria-describedby="apex-tour-description"
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
    >
      {rect && (
        <div
          className="tour-spotlight"
          aria-hidden="true"
          style={{
            transform: `translate(${rect.x}px, ${rect.y}px)`,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
      <section className="tour-card">
        <div className="tour-topline">
          <span>APEX / QUICK TOUR</span>
          <button aria-label="Close tour" onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <div key={index} className="tour-step">
          <TourVisual kind={step.visual} />
          <span className="tour-step-label">
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(steps.length).padStart(2, "0")}
          </span>
          <h2 id="apex-tour-title">{step.title}</h2>
          <p id="apex-tour-description">{step.description}</p>
        </div>
        <div className="tour-navigation">
          <div
            className="tour-progress"
            aria-label={`Step ${index + 1} of ${steps.length}`}
          >
            {steps.map((_, n) => (
              <span
                key={n}
                className={
                  n === index ? "current" : n < index ? "complete" : ""
                }
              />
            ))}
          </div>
          {index > 0 && (
            <button onClick={() => setIndex(index - 1)}>
              <ArrowLeftIcon />
              Back
            </button>
          )}
          <button
            className="primary"
            ref={next}
            onClick={() =>
              index === steps.length - 1 ? onClose() : setIndex(index + 1)
            }
          >
            {index === steps.length - 1 ? "Got it" : "Next"}
            <ArrowRightIcon />
          </button>
        </div>
        <button className="tour-skip" onClick={onClose}>
          Skip tour
        </button>
      </section>
    </dialog>
  );
}
function TourVisual({ kind }: { kind: Step["visual"] }) {
  return (
    <div className={`tour-visual tour-visual-${kind}`} aria-hidden="true">
      {kind === "sessions" || kind === "context" ? (
        <div className="tour-mini-list">
          {["P-014", "P-028", "P-041"].map((p, i) => (
            <div key={p} style={{ animationDelay: `${i * 100}ms` }}>
              <span>
                {kind === "context" ? ["02:00", "06:00", "08:00"][i] : p}
              </span>
              <i />
              <b />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="tour-mini-chart tour-chart-a">
            <span>{kind === "combine" ? "Heart rate" : "Session signals"}</span>
            <svg viewBox="0 0 160 60">
              <path
                pathLength="1"
                d="M0 42L10 38L20 46L30 22L40 30L50 8L60 18L70 12L80 32L90 28L100 46L110 30L120 35L130 16L140 21L150 12L160 18"
              />
            </svg>
          </div>
          {kind === "combine" && (
            <div className="tour-mini-chart tour-chart-b">
              <span>Movement</span>
              <svg viewBox="0 0 160 60">
                <path
                  pathLength="1"
                  d="M0 48L15 38L30 48L45 24L60 42L75 18L90 36L105 48L120 21L135 30L150 12L160 30"
                />
              </svg>
            </div>
          )}
          {kind === "zoom" && <div className="tour-mini-selection" />}
        </>
      )}
    </div>
  );
}
