---
name: Yuniko branding & gradient
description: Brand colors, gradient constants, and architecture decisions for the Yuniko social app
---

## Brand Colors (Canonical — never use old purple)

- **Gradient**: `linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)`
- **Pink accent**: `#FF3D9A`
- **Pink glow/shadow**: `rgba(255,0,110,0.4)`
- **Pink border**: `rgba(255,0,110,0.3)`
- **Old purple values to NEVER use**: `#7C3AED`, `#4F46E5`, `#8B5CF6`, `#6366F1`, `#A78BFA`, `#818CF8`, `purple-400` Tailwind class

**Why:** The app brand identity is pink→purple, not indigo/violet. All toggles, buttons, badges, gradients, and icon accents must use the pink-purple values above.

## User Interface

- `User` interface in `mockData.ts` has `website?: string` — must be optional.
- `currentUser` in mockData.ts does not define `website` (it's optional).

## Page Layout Pattern

All pages use: `w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20`

## Routing

- App is in `artifacts/yuniko` with wouter routing.
- `/live` → Live broadcast page (live.tsx) — Go Live button in Stories row on home.
- `/login` → Login screen with social auth buttons.
- All routes registered in `artifacts/yuniko/src/App.tsx`.

## Desktop Responsive

- `.yuniko-root` CSS class in `index.css` centers the 430px app card on screens ≥640px.
- Desktop shows radial gradient background behind the centered card.

**How to apply:** Any new page must follow the `w-full max-w-[430px] mx-auto` pattern. Never use old purple colors; always use the gradient constant above.
