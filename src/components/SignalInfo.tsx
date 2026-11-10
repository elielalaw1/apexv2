import { SignalKind, signals } from "@/core/contract";
import { comparisonInfo, signalInfo } from "@/core/signalInfo";
export default function SignalInfo({
  kinds,
  id,
}: {
  kinds: SignalKind[];
  id: string;
}) {
  return (
    <section
      className="signal-info-bubble"
      id={id}
      aria-label="Signal information"
    >
      <h3>
        {kinds.length > 1 ? "About this comparison" : "About this signal"}
      </h3>
      {kinds.length > 1 && (
        <div className="signal-info-comparison">
          <h4>Reading them together</h4>
          {comparisonInfo(kinds).map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}
      {kinds.map((k) => (
        <div className="signal-info-item" key={k}>
          <h4>
            <i style={{ background: signals[k].color }} />
            {signals[k].name}
            <small>{signals[k].unit}</small>
          </h4>
          <span className="signal-info-source">{signalInfo[k].source}</span>
          <p>{signalInfo[k].description}</p>
          <p>{signalInfo[k].use}</p>
          <p className="signal-info-limit">{signalInfo[k].limit}</p>
        </div>
      ))}
    </section>
  );
}
