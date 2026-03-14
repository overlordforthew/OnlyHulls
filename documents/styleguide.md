# OnlyHulls — Styleguide

## Visual Identity
Clean, modern, professional matchmaking platform. Think trusted marketplace meets maritime world. Sans-serif, high contrast, functional. The UI should feel like a product that knows what it's doing — not a startup toy, not a corporate portal.

## Color Themes
OnlyHulls supports runtime theme switching via CSS custom properties. Default is Ocean.

### Ocean Theme (Default)
| Role | Variable | Hex |
|------|----------|-----|
| Page background | `--background` | `#ffffff` |
| Primary text | `--foreground` | `#0f172a` |
| Primary action | `--primary` | `#0369a1` |
| Primary hover | `--primary-light` | `#0ea5e9` |
| Primary pressed | `--primary-dark` | `#075985` |
| Accent / highlight | `--accent` | `#f59e0b` |
| Muted background | `--muted` | `#f1f5f9` |
| Border | `--border` | `#e2e8f0` |

### Sunset Theme
| Role | Variable | Hex |
|------|----------|-----|
| Page background | `--background` | `#fffbf5` |
| Primary text | `--foreground` | `#1c1917` |
| Primary action | `--primary` | `#ea580c` |
| Primary hover | `--primary-light` | `#fb923c` |
| Primary pressed | `--primary-dark` | `#c2410c` |
| Accent | `--accent` | `#eab308` |
| Muted background | `--muted` | `#fef3c7` |
| Border | `--border` | `#fed7aa` |

### Dark Mode (auto via prefers-color-scheme)
| Role | Hex |
|------|-----|
| Background | `#0f172a` |
| Foreground | `#f1f5f9` |
| Primary | `#38bdf8` |
| Primary Dark | `#0284c7` |
| Muted | `#1e293b` |
| Border | `#334155` |

**Always use semantic CSS variables** (`text-foreground`, `bg-primary`, etc.) — never hardcode hex colors.

## Typography

### Fonts
- **All text:** Geist Sans (variable font) — modern, clean, legible
- **Monospace:** Geist Mono — for code, tokens, technical values

### Hierarchy
- Page heading (h2): `text-2xl font-bold`
- Section heading: `text-xl font-bold`
- Body: `text-sm` or `text-base`, weight 400
- Secondary body: `text-foreground/60` (60% opacity)
- Labels: `text-xs font-semibold uppercase tracking-wide`
- Price: `text-4xl font-bold text-primary`
- Match score: `text-sm font-bold text-white`

### Rules
- No serifs. Ever. This is a product UI, not a content site.
- Secondary text uses opacity (`/60`) not a different color
- Labels are uppercase with `tracking-wide`

## Spacing
- Uses Tailwind spacing scale throughout
- Standard card padding: `p-4` (1rem) or `p-6` (1.5rem)
- Gap between elements: `gap-2` to `gap-6`
- Section vertical rhythm: standard Tailwind `py-*` classes

## Components

### Boat Card
```
Container: rounded-xl border border-border bg-background shadow-sm
Hover: hover:shadow-md (shadow elevation on hover, no transform)
Image: aspect-[4/3] bg-muted overflow-hidden
Content: p-4
Title: font-semibold group-hover:text-primary
Price: text-lg font-bold text-primary
Tags: rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/60
Match badge: rounded-full bg-primary px-3 py-1 text-sm font-bold text-white
Sample badge: rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white
```

### Buttons
- Primary: `bg-primary text-white hover:bg-primary-dark rounded-lg`
- Secondary: `border border-border hover:bg-muted rounded-lg`
- Pill variant: `rounded-full` (used for badges, tag filters)
- Full-width CTA: add `w-full` — common in cards and forms
- Disabled: `opacity-50 cursor-not-allowed`

### Pricing Cards
- Standard: `rounded-xl border-2 border-border p-6`
- Featured/Popular: `rounded-xl border-2 border-primary shadow-lg p-6`
- "Most Popular" badge: `rounded-full bg-primary px-3 py-1 text-xs font-medium text-white`

### Search / Form Inputs
```
Input: w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm
Focus: focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20
Submit button: w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark
```

### Theme Switcher
- Fixed: `fixed bottom-6 right-6 z-50`
- Style: `rounded-full bg-foreground/90 px-4 py-3 text-sm font-medium text-background`
- Micro-interaction: `hover:scale-105 active:scale-95`

## Shadow System
- `shadow-sm` — default card state
- `shadow-md` — hover/elevated state
- `shadow-lg` — featured cards (popular pricing, highlighted matches)

## Border Radius
- Cards and containers: `rounded-xl` (0.75rem)
- Inputs and buttons: `rounded-lg` (0.5rem)
- Badges, tags, pills: `rounded-full`

## Icons
- Use Lucide React throughout — no other icon library
- Standard size: 16px (text-inline) or 20px (standalone)

## What to Avoid
- Serif fonts — this is a product UI
- Hardcoded hex colors — always use CSS variables / Tailwind semantic tokens
- More than 2 levels of shadow — keep elevation hierarchy simple
- Multiple accent colors in one view — primary + accent is the max
- Heavy drop shadows or glows — flat/minimal shadow design language
