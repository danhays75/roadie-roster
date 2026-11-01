# Design Brief

## Direction

All-American Roster Board — a crisp, confident red/white/blue hiring roster that reads like a stadium lineup card.

## Tone

Editorial/utilitarian: bold condensed uppercase headings over a calm warm-white ledger — patriotic without kitsch, dense with information.

## Differentiation

A navy masthead with a razor-thin red-and-white stripe makes every screen feel like an official roster sheet, not a generic dashboard.

## Color Palette

| Token      | OKLCH             | Role                              |
| ---------- | ----------------- | --------------------------------- |
| background | 0.9610 0.0058 92.0 | Warm white page #F5F3EE           |
| foreground | 0.2802 0.0712 258.5 | Navy ink #14284B                  |
| card       | 1.0 0 0           | White cards                       |
| primary    | 0.4726 0.1832 25.3 | Red #B22234 buttons + accents     |
| accent     | 0.4650 0.1305 258.0 | Blue #2B5DA8 hired/done          |
| muted      | 0.9300 0.0060 92.0 | Warm neutral fills                |

## Typography

- Display: Oswald — uppercase headings, roster names, section labels
- Body: Inter — paragraphs, table data, form labels, buttons
- Scale: hero `text-4xl md:text-6xl font-bold tracking-tight`, h2 `text-2xl md:text-3xl font-bold`, label `text-xs font-semibold tracking-widest uppercase`, body `text-base`

## Elevation & Depth

Flat, paper-like surfaces: white cards float on warm white via a soft border and a low, tight shadow; navy header sits flush with no shadow, separated by the flag stripe.

## Structural Zones

| Zone    | Background       | Border                      | Notes                          |
| ------- | ---------------- | --------------------------- | ------------------------------ |
| Header  | navy secondary   | red/white stripe bottom     | Logo + title, white text       |
| Content | warm background  | —                           | White cards on warm white      |
| Footer  | muted/40         | border-t                    | Muted text, small print        |

## Spacing & Rhythm

Generous 24–32px section gaps, 16px card padding, 12px grid gaps; dense 8px micro-spacing inside list rows for a scannable roster.

## Component Patterns

- Buttons: 8px radius, red fill, white uppercase Oswald label, subtle darken on hover, min-height 44px
- Cards: 12px radius, white, 1px warm border, soft tight shadow, 16px padding
- Badges: pill, blue fill for hired/done, red for pending, muted for inactive

## Motion

- Entrance: gentle fade-and-rise 200ms ease-out on list/card mount
- Hover: 150ms background/translate nudge on interactive rows and buttons
- Decorative: none beyond the static flag stripe

## Constraints

- Touch targets at least 44px everywhere
- Responsive across phones, iPads and Samsung Galaxy Tab A9+
- No raw hex in components — semantic tokens only

## Signature Detail

The thin red-and-white repeating stripe under the navy masthead — a single flag motif that brands every screen.
