"use client";
import { Template } from "@/core/contract";
import { displayText } from "@/core/presentation";
export default function QuestionnaireEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  let draft: Template;
  try {
    draft = JSON.parse(value);
    if (
      !draft ||
      typeof draft.title !== "string" ||
      !Array.isArray(draft.eventLabels) ||
      !draft.eventLabels.every((x) => typeof x === "string") ||
      !Array.isArray(draft.questions) ||
      !draft.questions.every(
        (q) =>
          q &&
          typeof q.label === "string" &&
          typeof q.min === "number" &&
          typeof q.max === "number",
      )
    )
      throw Error();
  } catch {
    return (
      <div>
        <p role="alert">The definition is not valid. Correct the JSON below.</p>
        <label>
          Questionnaire definition JSON
          <textarea value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
      </div>
    );
  }
  const update = (patch: Partial<Template>) =>
    onChange(JSON.stringify({ ...draft, ...patch }, null, 2));
  const question = (i: number, patch: Partial<Template["questions"][number]>) =>
    update({
      questions: draft.questions.map((q, n) =>
        n === i ? { ...q, ...patch } : q,
      ),
    });
  return (
    <div className="questionnaire-editor">
      <label>
        Session type name
        <input
          value={displayText(draft.title)}
          onChange={(e) => update({ title: e.target.value })}
        />
      </label>
      <div className="form-version">
        <span>New version {draft.version}</span>
        <p>
          Saved versions cannot be overwritten. Recorded answers keep their
          original definition.
        </p>
      </div>
      <label>
        Event labels (one per line)
        <textarea
          value={draft.eventLabels.map(displayText).join("\n")}
          onChange={(e) => update({ eventLabels: e.target.value.split("\n") })}
        />
      </label>
      <h3>Questions</h3>
      {draft.questions.map((q, i) => (
        <section className="question-row" key={q.id}>
          <label>
            Question text
            <input
              value={displayText(q.label)}
              onChange={(e) => question(i, { label: e.target.value })}
            />
          </label>
          <div className="question-controls">
            <label>
              Response type
              <input
                readOnly
                value="Numeric scale"
                aria-label="Response type"
              />
            </label>
            <label>
              Ask
              <select
                value={q.phase}
                onChange={(e) =>
                  question(i, { phase: e.target.value as "pre" | "post" })
                }
              >
                <option value="pre">Before recording</option>
                <option value="post">After recording</option>
              </select>
            </label>
            <label>
              Minimum
              <input
                type="number"
                value={q.min}
                onChange={(e) => question(i, { min: Number(e.target.value) })}
              />
            </label>
            <label>
              Maximum
              <input
                type="number"
                value={q.max}
                onChange={(e) => question(i, { max: Number(e.target.value) })}
              />
            </label>
          </div>
          <button
            onClick={() =>
              update({ questions: draft.questions.filter((_, n) => n !== i) })
            }
          >
            Remove question
          </button>
        </section>
      ))}
      <button
        onClick={() =>
          update({
            questions: [
              ...draft.questions,
              {
                id: crypto.randomUUID(),
                label: "New question",
                phase: "post",
                min: 1,
                max: 10,
              },
            ],
          })
        }
      >
        Add question
      </button>
      <details>
        <summary>Advanced JSON</summary>
        <label>
          Questionnaire definition
          <textarea
            aria-label="Questionnaire definition JSON"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        </label>
      </details>
    </div>
  );
}
