# Phase 10 — Operational SLA policies and alert review

Completed 30 October 2026. No statutory deadlines or legal references have been invented or verified. No live email/SMS adapter is enabled.

## Behavior and persistence

Versioned configuration matches enabled policies by effective dates in their IANA timezone and all non-empty category/type/source/priority selectors. Highest precedence wins, then stable policy ID. Calendar days or Monday–Friday business days support configured holiday dates. The start is the recorded intake date in the policy timezone or an explicitly recorded source received date. Defaults preserve the prior 7/15/30/45 calendar-day priority targets in UTC.

New cases snapshot their policy/configuration. Existing cases retain their original deadline until a currently authorized Bureau Head or Competent Authority explicitly recalculates it with a review reason. Recalculation is blocked while paused; retained intervals are reapplied using each interval's captured calendar. Only the applied policy's explicit pause reason codes permit pausing. Intervals count eligible days in [pause, resume); an open interval advances on monitor runs. Manual deadline overrides preserve the pause history and credit elapsed pause days so they are not added twice. Case history and the audit chain retain policy actions and reasons. These clocks do not determine the legal lifecycle of court/RTI/etc. cases.

Migration `011_sla_policies.sql` adds immutable policy versions, case clock/configuration references, unique alert keys and delivery records/indexes in the private schema. No operational backfill or live database migration was performed. Historic IDs cannot be deleted from configuration; rollback appends a new version. JSON remains development/test only; PostgreSQL remains the operational authority.

## Alerts and authorization

T-7/T-3/T-1, due today, overdue, configured inactivity, and optional human-confirmed duplicate-submission storm conditions generate recipient-specific alerts. Inactivity uses human case history; monitor actions do not reset it. Confirmed duplicate storms count distinct linked submissions over a configured window and assert no misconduct. Every affected case must be currently readable by the recipient. Confidentiality/assignment/region changes are reapplied to lists, notifications, acknowledgements and delivery attempts.

Stable alert keys, a configurable recipient/case/kind cooldown and acknowledgement prevent repeated notifications. Acknowledgement does not pause or dispose a case. Pending/failed email/SMS adapter attempts persist their status, attempt history and bounded exponential retry time (at most three attempts). `NOTIFICATION_DELIVERY_MODE=disabled` is the default. `development` yields **simulated** outside production; production and unsupported/live modes stay disabled. No addresses, message bodies or provider credentials enter these fixture records. Legacy cases retain their existing priority-based monitor behavior and may receive inactivity review alerts; policy cases use the new monitor once only.

## Frontend

Protected administrator policy editor: `/admin/sla-policies`, linked from intake configuration. Case overview shows applied policy, operational deadline, history and authorized pause/resume/recalculation controls. `/sla-alerts` is linked from notifications for case roles and shows permission-checked alerts, acknowledgement and delivery status. Existing visual primitives are used. Deadline badges/counts use policy timezone civil dates. Added English fallback strings across all 23 locale packs; non-English approval status remains draft.

## Executed verification

- Pure calendar checks: invalid/leap dates, weekend/holiday counting, DST-independent civil arithmetic, timezone date boundary, effective dates/precedence, manual deadline preservation and retained/credited pause intervals passed.
- `test:sla`: **23 JSON** scenarios passed.
- `test:sla:postgres`: **23 native PostgreSQL** scenarios passed, including migration 011, immutable configuration projection, clocks/alerts/deliveries and actual database restart.
- Coverage includes administration/case separation, invalid/stale settings, legacy adoption, permitted reasons/supervisor-only actions, stale case clock rejection, T-7/-3/-1/due/overdue, repeated scheduler deduplication, acknowledgement, no-action review, confirmed duplicate storms, sealed access revocation, bounded retries and development/production status honesty.
- Existing **23 unit / 15 acceptance / 33 RBAC** checks passed using disposable data. Backend/frontend builds, localization (23 locales/10 namespaces) and interface checks passed. Lint retains the existing warnings; no Phase 10 component warnings were introduced.
- Browser: disposable admin saved version 2; disposable Bureau Head explicitly adopted it for a legacy case and paused using the configured allowed reason. The previous 2099 deadline appears alongside the new deadline in history. Evidence: `evidence/phase10-sla-policies.png`, `evidence/phase10-case-paused.png`.
- Sandbox loopback/temporary rename restrictions required approved isolated test execution. Rebuilding assets during preview required a browser reload; tests used explicit fixture credentials. The temporary UI process was stopped after matching its port and fixture command line. Live `backend/data/db.json` was neither edited nor reset by this work; short integration runs verified its digest unchanged.

## Limits and recovery

Policies are operational configuration requiring authorized review, not verified AICTE legal rules. No live notification provider exists. Holiday calendars and pause permissions must be supplied and reviewed by the deployment owner. Alert/attempt history persists in the same authoritative transaction. Back up PostgreSQL and independent audit anchors before any production migration; apply only the additive migration sequence. Restore prior policy settings by appending a rollback version; never rewrite prior versions or silently recalculate existing clocks.
