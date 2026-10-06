# Session-first redesign — 6 October 2026

The supplied design brief is preserved in DESIGN_BRIEF.txt. The later explicit instruction to use English overrides its Swedish-label examples. Web and mobile system copy, accessible labels, date formatting, validation errors and app permission descriptions now use English.

## Implemented flow

Overview → open a session row → one large heart-rate chart. If HR is unavailable, the first recorded signal is selected and the fallback is explained. The three primary destinations are Overview, Sessions and Analysis. Participants and Settings are secondary destinations. Participants are also accessible through filters and clickable IDs.

Add signal lists only signals present in the selected session, using a workspace-protected signal inventory endpoint. Overlay uses separate axes for different units; a separate chart is also offered. Compare sessions supports search, participant/date/name context and up to four sessions. Comparison starts at session start. Advanced time alignment remains available.

Drag modes explicitly separate interval selection, zoom and pan. Selection requests statistics from raw samples for the selected window without changing zoom. A shared cursor shows the nearest displayed sample, with a clear label; it reports missing/uncertain data rather than interpolating a value. Chart arrows move the cursor; Shift+arrows pan; Enter selects a 30-second interval; Escape clears it. Event markers open details on click or keyboard activation. Gaps and uncertain quality remain visible.

Customize opens a separate panel with focus management and keyboard dismissal. Closing it retains the selected sessions, zoom and interval. View options groups saved-view operations and JSON export. Session details open inline without replacing the analysis; CSV export and technical metadata remain available there. Saved views retain their schema and panel configurations and are opened explicitly, while a fresh analysis starts simple.

Questionnaires use controls for question text, numeric scale limits, timing and events. JSON is an advanced option. Existing versions are immutable; edits create a new version. Built-in Swedish legacy labels are translated only at presentation time. Stored events, historical forms, samples and existing saved configurations are not rewritten. User-authored titles are retained in their original language.

## Verification

- 8 integrity, statistics and durable-outbox tests pass.
- 2 Playwright tests against the production build cover session opening, available signals, four-session comparison, linked cursor, interval selection/statistics, saved-view reload, raw CSV/JSON downloads, participant filters, advanced controls, questionnaire version preservation, keyboard operation and narrow-screen layout.
- Next build and TypeScript pass. Mobile TypeScript and iOS/Hermes export pass.
- The English native app passes the simulator restart/sync/logout XCTest. API verification confirms three synthetic mobile sessions, each containing exactly 60 HR and 60 RR samples, in the isolated mobile test database.
- Desktop and mobile screenshots were inspected. The main demo retains four sessions, three participants and 72 minutes.

## Limits

Questionnaires currently support numeric scales; categorical answer options require extending the existing shared recording contract and mobile answer flow. Cursor readouts use the nearest decimated display sample, explicitly labeled; selected-interval statistics use raw data. This is not a full assistive-technology certification. Physical H10, background collection and Android verification remain separate from simulator/UI checks. No live-monitoring placeholder was added.

Screenshots: dashboard-desktop.png, dashboard-mobile-web.png, analysis-default.png, analysis-desktop.png, analysis-mobile-web.png and mobile-ios-simulator.png.
