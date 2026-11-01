# Project Guidance

## User Preferences

- Red, white and blue look: navy #14284B header, red #B22234 primary buttons and accents, blue #2B5DA8 for hired/done, warm white #F5F3EE page, white cards
- Oswald uppercase headings, Inter body text, thin red-and-white stripe under the header
- Touch targets at least 44px
- Fully responsive and installable as a PWA
- Store logo appears in the header, on roadie cards and as the app icon

## Accepted Requirements

[Filled after each deployed build — what the user asked for and the build delivered]

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `mops check --fix`
- **build**: `mops build`

## Learnings

- getMyAccess must return only persisted app grants; a synthesized grant makes the frontend render the authenticated shell while every domain read traps IC0503 'caller is not registered'.
- The platform first-admin bridge belongs in bootstrapAdmin (which persists a real grant), not in the getMyAccess read.
- The approval gate must call bootstrapAdmin for every signed-in caller; it is idempotent and only persists while no app Admin exists.
- Motoko has no triple-quoted strings; every double quote inside a getApiDoc Markdown literal must be escaped as \".
- Backend enforces role rules in lib/auth.mo (requireReadable/requireManager/requireAdmin); Kiosk reads trap there, so one guard covers every read path.
- On-hand is never stored: it is derived from roadie status and position, so approve/archive/rehire/changePosition are the only paths that move it.
- A trainer with an empty approved-station list is unrestricted; restricting to zero stations hid the record and made contact-set redaction unobservable.
- Contact-set redaction must return an empty array rather than undefined for non-manager roles so the redaction is observable and consistent.
- A Kiosk-role login must be redirected to /kiosk in the root shell (KioskRedirect inside ApprovalGate children); every dashboard/roster/store read traps for it.
- ApprovalGate must wait for useActor's actor before calling bootstrapAdmin, or the call is lost while the backend initializes.
- A key missing from the copy dictionaries (src/frontend/src/lib/copy.ts and src/frontend/src/components/kiosk/copy.ts) falls through to the raw key string, so every key a page renders must exist in every locale.
- The kiosk availability and review steps render kiosk.weekday.* day labels; the kiosk dictionary keys must carry that prefix.
- The Admin page tab bar renders admin.section.* labels from lib/copy.ts, while admin panels use the separate typed useAdminCopy; both must be checked.
- Fresh install replays migrations/00000000_000000.mo (OldActor={}) so 18 positions/218 build-to and 12 schedule events seed correctly; applied migrations are frozen read-only, so any later change needs a new migration file.
- getContactSet returns Array<ContactSet>; read element 0 and treat an empty array as no contact details, tolerating a bare value for older mocks.
- A Kiosk-role grant must redirect to /kiosk in the root shell without rendering Layout, or every dashboard/roster read traps.
- Fresh-install seed lives in migration 00000001 (positions.size()==0); runtime re-seed in lib/seed.mo mirrors it and must never overwrite an existing store.
- getRosterSummary returns per-position { positionId, positionName, onHand, buildTo, openSpots }; on-hand is derived from roadie status and position, never stored.
- The full suite is `pnpm test` at the app root: it runs the Vitest frontend suite (src/frontend/src/__tests__) then the PocketIC backend lane (test/pocketic/run-backend-lane.mjs), which installs src/backend/dist/backend.wasm and skips cleanly when no sidecar is present.
- The PocketIC backend lane is the only place a real canister method is exercised; frontend tests mock the actor, so a stubbed backend passes them identically.
- The local preflight tester signs in as the owner identity only; it cannot perform a Kiosk-role sign-in, so the Kiosk redirect outcome stays unverified in a browser run even though the frontend and backend tests cover it.
- The local preflight tester does not create a roadie record, so roster cards, on-hand counts, open spots and the Shareable/Full export comparison are only covered by the mocked frontend tests and the PocketIC lane, not by a browser run.
