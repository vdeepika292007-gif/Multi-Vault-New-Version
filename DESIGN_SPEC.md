# Multi Vault — Design Specification

**Visual direction:** Obsidian Vault — premium dark knowledge workspace  
**Applies to:** React, Angular, and Vue.js as separate alternatives

## Design goal
Create a calm, polished workspace for writing and organizing notes. Use deep charcoal backgrounds, restrained violet accents, readable typography, subtle borders, and generous spacing. Avoid generic admin templates, excessive neon/glow, gradients on every panel, tiny text, fake metrics, and non-working controls.

## Design tokens
| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#0D0B12` | Main background |
| `--color-sidebar` | `#121019` | Sidebar |
| `--color-surface` | `#191622` | Cards/editor |
| `--color-surface-raised` | `#211D2C` | Menus |
| `--color-border` | `#342D43` | Borders |
| `--color-primary` | `#8B5CF6` | Primary actions |
| `--color-primary-hover` | `#A78BFA` | Hover |
| `--color-primary-soft` | `#2A2040` | Selected background |
| `--color-text` | `#F5F3FA` | Main text |
| `--color-text-secondary` | `#B7B0C6` | Supporting text |
| `--color-text-muted` | `#898196` | Metadata |
| `--color-success` | `#4ADE80` | Success |
| `--color-warning` | `#FBBF24` | Warning |
| `--color-danger` | `#F87171` | Error/destructive |

Use violet selectively; keep most surfaces neutral and dark.

## Typography and spacing
- Inter with system sans-serif fallback.
- Page titles 24–30 px; section titles 16–20 px; body 14–16 px; metadata usually 12–13 px.
- Body line-height 1.45–1.65.
- 4 px spacing base; common spacing 8, 12, 16, 24, 32, 40 px.
- Panel radius 12 px; small controls 8 px; tags pill-shaped.
- Prefer subtle borders over heavy shadows. Respect reduced-motion preferences.

## App shell and navigation
Desktop sidebar about 240 px, main padding 24–32 px, header with page title and global search entry point. Navigation order:
1. Dashboard
2. All Notes
3. Daily Journal
4. Knowledge Graph
5. Tags
6. Settings

Use a restrained Multi Vault wordmark and simple consistent line icons. Active navigation uses a soft violet background and clear indicator.

## Responsive design
Tablet: reduce/collapse sidebar while preserving accessible labels. Mobile: drawer or compact navigation, stacked content, no horizontal overflow. Aim for touch targets around 44 × 44 px. Check widths near 1440, 1024, 768, and 375 px.

## Page layouts
- **Dashboard:** real counts, New Note, recent notes with tags/dates, journal shortcut, first-use empty state. Never fake metrics.
- **All Notes:** search, tag filters, sorting, responsive note previews, empty/no-results states.
- **Note editor:** editable title and writing area, tag selector, save status, timestamp, separate delete action, protection against losing unsaved edits.
- **Daily Journal:** date navigation, distraction-free editor, save status, history, empty state; one entry per user/date.
- **Knowledge Graph:** notes as nodes and real relationships as edges, legend, zoom/reset/focus where practical, selected-node preview, empty state. Use explicit links/shared tags; do not imply AI inference. Provide an accessible list alternative.
- **Tags:** tag list/grid, counts where available, tag-to-filter navigation, empty state.
- **Settings:** working settings only, save feedback, confirmation for sign-out/destructive actions.
- **Authentication:** focused sign-in/register form, visible labels, validation/loading/error states.

## Reusable components
App shell/sidebar, page header, buttons, inputs, editor, tag chips/selectors, note preview, metric summary, empty/loading states, error/success feedback, confirmation dialog, toast/status, accessible menu, graph legend/controls.

## Accessibility and consistency
Use semantic headings, labeled controls, visible keyboard focus, keyboard-operable actions, accessible names for icon-only buttons, and do not rely on color alone. React, Angular, and Vue are separate alternatives, not one combined frontend. Keep layout, colors, labels, behavior, and responsiveness equivalent; share the same backend API.
