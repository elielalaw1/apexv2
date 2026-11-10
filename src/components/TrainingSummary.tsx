"use client";
import { useEffect, useState } from "react";
import { Session } from "@/core/contract";
import type { trainingMetrics } from "@/core/training";
import { api, timeLabel } from "./Chart";
export default function TrainingSummary({ session }: { session: Session }) {
  const [metrics, setMetrics] = useState<ReturnType<
    typeof trainingMetrics
  > | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<ReturnType<typeof trainingMetrics>>(
      `mvp/sessions/${session.id}/metrics`,
    )
      .then((d) => {
        if (active) setMetrics(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [session.id]);
  return (
    <details className="training-details">
      <summary>Training insights</summary>
      {error ? (
        <p role="alert">{error}</p>
      ) : !metrics ? (
        <p>Loading insights…</p>
      ) : (
        <>
          <div className="training-summary">
            <article>
              <h2>Heart rate zones</h2>
              {metrics.maxHeartRate ? (
                <>
                  <p>
                    Max HR {metrics.maxHeartRate} bpm · percentage of your
                    entered maximum
                  </p>
                  {metrics.zones.map((z) => (
                    <div className="training-zone-row" key={z.zone}>
                      <span>
                        {z.zone === 0 ? "Below 50%" : `Zone ${z.zone}`}
                      </span>
                      <meter
                        min={0}
                        max={session.durationMs}
                        value={z.durationMs}
                        aria-label={`${z.zone === 0 ? "Below 50%" : `Zone ${z.zone}`} duration`}
                      />
                      <strong>{timeLabel(z.durationMs)}</strong>
                    </div>
                  ))}
                  <p>
                    {timeLabel(metrics.zoneCoverageMs)} valid coverage ·{" "}
                    {timeLabel(
                      Math.max(0, session.durationMs - metrics.zoneCoverageMs),
                    )}{" "}
                    unclassified or missing.
                  </p>
                </>
              ) : (
                <p>
                  Enter your known maximum heart rate before recording to enable
                  zones. No maximum is guessed.
                </p>
              )}
            </article>
            <article>
              <h2>Heart rate recovery</h2>
              {metrics.recoveries.length ? (
                metrics.recoveries.map((r) => (
                  <div className="recovery-row" key={r.id}>
                    <span>Rest {timeLabel(r.t)}</span>
                    <span>
                      60 s{" "}
                      <strong>
                        {r.after60 === null
                          ? "Unavailable"
                          : `${r.after60.toFixed(0)} bpm drop`}
                      </strong>
                    </span>
                    <span>
                      120 s{" "}
                      <strong>
                        {r.after120 === null
                          ? "Unavailable"
                          : `${r.after120.toFixed(0)} bpm drop`}
                      </strong>
                    </span>
                  </div>
                ))
              ) : (
                <p>
                  Mark Rest after an interval and keep recording for 60–120
                  seconds. Recovery requires valid heart-rate data during rest.
                </p>
              )}
            </article>
          </div>
          <p className="training-method-note">
            HRV uses 30 consecutive RR intervals with quality checks. Compare
            resting values under consistent conditions; it is not a stress or
            readiness score.
          </p>
        </>
      )}
      {session.events.some((e) =>
        ["work", "rest", "recovery", "arbete", "återhämtning"].includes(
          e.label.toLowerCase(),
        ),
      ) && (
        <div className="training-events" aria-label="Workout markers">
          {session.events
            .filter((e) =>
              ["work", "rest", "recovery", "arbete", "återhämtning"].includes(
                e.label.toLowerCase(),
              ),
            )
            .map((e) => (
              <span key={e.id}>
                {["arbete", "work"].includes(e.label.toLowerCase())
                  ? "Work"
                  : "Rest"}{" "}
                · {timeLabel(e.t)}
              </span>
            ))}
        </div>
      )}
    </details>
  );
}
