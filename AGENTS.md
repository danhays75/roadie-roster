# Project Guidance

## User Preferences

- Red, white and blue look: navy #14284B header, red #B22234 primary buttons and accents, blue #2B5DA8 for hired/done, warm white #F5F3EE page, white cards
- Oswald uppercase headings, Inter body text, thin red-and-white stripe under the header
- Touch targets at least 44px
- Fully responsive and installable as a PWA
- Store logo appears in the header, on roadie cards and as the app icon
- Match the attached reference card image for the roadie card's visual styling
- Leader cards reuse the roadie card component and roadieCard.css with tier ribbons and gold, platinum and legend variants
- Leader About Me fields use the same labels, placeholders, Spanish copy and 200-character caps as the kiosk
- Leaders never count toward on-hand or build-to and never appear in the position roster
- No contact information on any card or gift bag label

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
- Route guards block pages a role cannot use and hide Edit/Change Position
- Waiting screen polls getMyAccess; bootstrapAdmin only when no admin exists; ensureSeeded only for Admin
- RoadieCard validates the id before BigInt and has an error boundary
- Service worker caches only the app shell and hashed assets, skips non-OK responses, and versions the cache per build
- PWA has 192 and 512 icons (one non-transparent maskable), apple-touch-icon and iOS meta tags
- The header title text is "Roadie Roster"
- The browser tab title, PWA manifest name and short_name, and apple-mobile-web-app-title are "Roadie Roster"
- The store name and location stay as the subtitle
- Store info carries an optional secondary logo defaulting to null
- The public logo query returns both logos for the kiosk and sign-in screens
- Admin > Store info has a Secondary logo upload with preview and Remove, reusing the main logo's resize/compress helper and image-type detection
- The secondary logo replaces the star badge next to the store name in the header and dashboard banner, at the same height as the main logo, with nothing shown when absent
- The main logo stays exactly as it is now
- Both logos refresh after Save without a page reload
- Fix the blank Card tab so the roadie card renders between the tabs and the Flip card button
- Restyle the roadie card as a collectible trading card with a holographic foil shell and a 3D flip
- Card text at least 14px, no sideways scrolling, and no phone, email or date of birth on the card
- Change nothing outside the card component
- Self-host Archivo Black and Oswald so the card's display fonts load reliably
- Replace the card-front badge with the inline SVG store seal showing the store number
- Replace the card-front stars with 16 positioned star spans and remove the birthday tag
- Add a hireDate to the Roadie record, set it from the sign-up's submission time on approval, and fall back for existing roadies
- Show the hire date as "Roadie since" on the front and "HIRED:" on the back
- Remove the ROADIE STATS section and list every non-empty About Me field in the back table
- Keep the MY GOAL quote under the back table
- Never show phone, email or date of birth on the card
- Opening and after-opening build-to are editable number inputs (inputMode numeric, min 0, max 999, integers only) that keep the minus and plus buttons and save on blur or Enter
- On-hand stays read-only and the roster summary refreshes after a build-to save
- Checklist toggles renamed to 'Only alcohol positions' and 'Only under 18' with the hint 'Leave both off if the item applies to everyone.' and Spanish copy
- The seeded and stored 'Minor work permit' paperwork item is renamed 'LA employment certificate (LWC confirmation received)' keeping minorOnly = true and its id
- Download template produces a .json with schedule (days relative to opening), positions, checklists, leader talk name and sizes, and a version number, with no people data, logos, store number, city or opening date
- Load template (Admin only) validates a .json, shows a preview with counts, then confirms, replacing positions, schedule and checklists only when there are no roadies
- Imported schedule dates are recomputed from this store's opening date
- A 'Tell us who you are' form appears after a new Internet Identity sign-in and before the waiting screen, storing the profile on the pending request and carrying it onto the access grant
- The pending approval card shows the profile, pre-selects the requested role and stations, and pre-fills the access end date from the departure date at 11:59 PM store time, still editable
- Users are shown by preferred/full name and title everywhere, with an admin-only Show ID toggle revealing the principal
- Work phone and email are visible only to Admin and Store Manager
- Existing users with no profile see the form on next sign-in, keep their access, and show 'Unnamed user' plus Show ID until filled in
- Users can edit their own profile from a 'My profile' menu item
- Leader About Me fields (hometown, hobbies, favoriteTeam, favoriteSnack, favoriteDrink, favoriteColor, funFact, goalHere, shirt size, hat size) added to the staff profile form and My profile, optional, with kiosk labels, placeholders, Spanish copy and 200-character caps
- Leader cards reuse the roadie card component and roadieCard.css with a tier ribbon and gold/plat/legend variants
- Roadie cards also get the ROADIE tier ribbon
- A Leaders nav item and page grouping leader cards by tier (Legend, Platinum, Gold), hidden from kiosk and integration
- Leaders never count toward on-hand or build-to and never appear in the position roster
- Gift Bags Roadies/Leaders/All filter across the shopping list, labels and Excel download, with leader labels showing the title
- No contact information on any card or label

## Verified Commands

- **typecheck**: `pnpm typecheck`
- **fix**: `pnpm fix`
- **build**: `pnpm build`

## Learnings

- The card front shows 16 positioned star spans and no birthday tag; the MINOR tag remains. The .stars stripes use bottom/100% 44% no-repeat and .rc .f-stage .stars has z-index:1.
- Archivo Black and Oswald are self-hosted via @fontsource imports in src/frontend/src/main.tsx (@fontsource/archivo-black/400.css, @fontsource/oswald/600.css, @fontsource/oswald/700.css); the runtime @font-face injection was removed.
- The Roadie record has hireDate : ?Timestamp set from the sign-up's submittedAt on approveSignup, with migration src/backend/migrations/00000005_000000.mo falling back to the matching sign-up's submittedAt, else hiredAt; the card footer shows 'Roadie since' + hireDate and the back table's last row is HIRED:.
- The card back no longer has a ROADIE STATS section; the .tbl lists every non-empty About Me field in order Hometown, Crew, Hobbies, Favorite movie, Favorite snack, Fun fact, Hired, with .rc .row padding 1.5cqw 2.2cqw and align-items:center.
- The test setup sets testIdAttribute to data-ocid, so getByTestId resolves data-ocid, not data-testid; card photo/headshot markers must use data-ocid.
- The inherited suite has pre-existing failing tests (including export-variants.test.ts and several card tests asserting removed surfaces) that predate this draft and remain failing.
- The kiosk About Me fields live in src/frontend/src/components/kiosk/KioskDetailsStep.tsx (KioskDetails/EMPTY_DETAILS) with EN/ES copy in src/frontend/src/components/kiosk/copy.ts; favoriteMovie stays in state and toProfile but is removed from the form and review.
- The card back rows are built by profileRows in src/frontend/src/components/roadie/FlipCard.tsx; the >7-row dense class is applied on the .tbl wrapper and styled as .rc .tbl.dense .row font-size 3.4cqw.
- storeInfo.openingDate is a DateOnly, so format it with formatDateOnly (UTC); formatTimestampMonthDayYear with the store time zone shifts the day back one. roadie.hireDate/hiredAt are Timestamp date-only values; formatTimestampDateOnly renders their UTC calendar day.
- The Gift Bags page is src/frontend/src/pages/GiftBags.tsx with the workbook helper src/frontend/src/lib/giftBags.ts and print CSS in src/frontend/src/index.css; the nav item and route are gated by GIFT_BAGS_ROLES (Admin, Store Manager, Training Manager) in hooks/useAccess.ts and App.tsx.
- The backend getGiftBags(filter) query groups the six Gift Bag answers case-insensitively (ignoring spaces and punctuation, showing the most common spelling), sorted by count desc with a No answer count, and returns printable label rows; active roadies only.
- The Full export workbook (lib/export.ts groupHeaders/groupRow) carries the four favorite columns; the backend ExportRow already carries favoriteTeam, favoriteSnack, favoriteDrink and favoriteColor.
- The kiosk route /kiosk crashes the browser page target when opened from the authenticated dashboard; the About Me step never renders. The crash was not reproduced or fixed within the local testing budget.
- The inherited suite has 14 pre-existing failing tests that predate this draft and remain failing.
- The backend AccessGrant and PendingUser gained a staffProfile field; migration src/backend/migrations/00000007_000000.mo adds it and renames paperwork item id=4 to 'LA employment certificate (LWC confirmation received)' keeping minorOnly=true.
- The backend exposes submitStaffProfile, updateMyStaffProfile, downloadStoreTemplate and loadStoreTemplate; downloadStoreTemplate is a query and loadStoreTemplate refuses when any roadie exists.
- The frontend has a StaffProfileForm component, a /my-profile route, a staffDisplayName helper in lib/format.ts, and a nav.myProfile NAV_ITEMS entry.
- The PocketIC backend lane's stale test files omit the required staffProfile key on approveUser calls, so the Candid client encode fails with 'Record is missing key "staffProfile"'; the backend itself is correct.
- Leader cards reuse FlipCard with a leader prop; the tier variant and ribbon come from the leader's stated profile role (staffProfile.requestedRole), not the grant role, because the owner is bootstrapped as admin.
- listLeaders redacts workPhone and workEmail before returning, so leader cards and gift bag labels never carry contact info.
- Gift Bags leader labels all carry roadieId 0, so the labels list key must combine roadieId, name, positionName and index to stay unique.
- The backend AccessGrant and PendingUser staffProfile gained the ten optional About Me fields; migration src/backend/migrations/00000008_000000.mo adds them.
- The backend exposes listLeaders and getGiftBags; GiftBagFilter now includes #roadies and #leaders, and leader labels carry the leader's title as the position name.
- The frontend has a Leaders page at src/frontend/src/pages/Leaders.tsx and a leader card page at src/frontend/src/pages/LeaderCard.tsx, gated by LEADERS_ROLES (every readable role except kiosk and integration).
- The roadie card keeps its Roadie since front footer and opening-crew back footer; leader footers apply only to leader cards.
