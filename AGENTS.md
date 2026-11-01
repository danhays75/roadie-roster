# Project Guidance

## User Preferences

- Red, white and blue look: navy #14284B header, red #B22234 primary buttons and accents, blue #2B5DA8 for hired/done, warm white #F5F3EE page, white cards
- Oswald uppercase headings, Inter body text, thin red-and-white stripe under the header
- Touch targets at least 44px
- Fully responsive and installable as a PWA
- Store logo appears in the header, on roadie cards and as the app icon

## Accepted Requirements

- Photos and signatures upload to real storage and are role-gated (Admin/Store Manager for signatures)
- submitSignup requires Kiosk, Store Manager or Admin and caps text field lengths
- The roadie's drawn signature is kept in the contact set; the manager's approval signature is stored separately and drawn on-device
- Multi-stroke signatures survive resize and rotation
- Real age in store time blocks under-minimum-age positions; isMinor and birthdayMonthDay are exposed without date of birth
- Sign out in the header, waiting/error gates and a PIN-protected kiosk spot
- Kiosk auto-reset after 10 seconds and on 90 seconds idle; kiosk renders without app header/nav; no listPendingUsers for non-admins
- Store Manager sees approvals; only admins see pending users; suggested orientation is saved; reject asks for confirmation
- Date-only displays use UTC; schedule times use store time zone
- Access end dates build 11:59:59 PM America/Chicago; admins can change end dates and trainer stations after approval
- On-hand counts each roadie once under their main position only
- updateRoadieStatus cannot archive; archive requires a reason and rehire requires a non-blank reason
- Trainer with no stations sees no roadies; Integration sees only the Shareable export
- Last admin cannot be demoted, overwritten or end-dated; approveUser only for pending principals
- Full export runs only on Download tap and includes the whole contact set; totals rows show Total Par and Need
- Contact editor merges only edited fields; build-to uses steppers only
- Route guards block pages a role cannot use and hide Edit/Change Position
- Waiting screen polls getMyAccess; bootstrapAdmin only when no admin exists; ensureSeeded only for Admin
- RoadieCard validates the id before BigInt and has an error boundary
- Service worker caches only the app shell and hashed assets, skips non-OK responses, and versions the cache per build
- PWA has 192 and 512 icons (one non-transparent maskable), apple-touch-icon and iOS meta tags

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

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
- PhotoRef and SignatureRef are Storage.ExternalBlob (Uint8Array bytes), not Text; convert with refToDataUrl()/fileToRef() in src/frontend/src/lib/format.ts.
- All signatures live in ContactSet (availabilitySignature plus managerSignature/managerSignedAt/managerSignedBy); Roadie.signature was removed. Roadie carries non-sensitive isMinor and birthdayMonthDay.
- Age helpers live in src/backend/lib/age.mo (ageInYears, meetsMinimumAge, isMinor, birthdayMonthDay) and use America/Chicago store time; stored-field changes go through src/backend/migrations/00000002_000000.mo.
- On-hand counts each roadie once under their main position only; second position is cross-trained and does not count.
- useFullExport is a mutation: use isPending/mutateAsync/reset, not isLoading/refetch.
- Signature canvases are set up once on mount with no resize listener (kiosk, ManagerSignaturePad, ManagerTab re-sign).
- src/frontend/src/lib/copy.ts is owned solely by the frontend foundation task; page tasks must not edit it.
- getContactSet returns Array<ContactSet>; read element 0, empty array means none.
- The platform injects the favicon/app icon at deploy; app code must not add favicon files or /__meta/ assets.
- The kiosk signature canvas is not exposed as an accessible element, so browser-driven testing cannot draw a signature; verify signature capture manually.
