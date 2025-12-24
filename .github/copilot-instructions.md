# Aithen AI Coding Agent Instructions

## Project Overview
Next.js 16 application using React 19, Bun runtime, shadcn/ui components, and Biome for linting/formatting. Built with TypeScript and Tailwind CSS v4 with the React Compiler enabled.

## Tech Stack & Architecture
- **Runtime**: Bun (all scripts use `bun --bun` prefix)
- **Framework**: Next.js 16.1+ with App Router (`src/app/`)
- **React**: v19.2+ with React Compiler enabled in [next.config.ts](next.config.ts)
- **Styling**: Tailwind CSS v4 with OKLCH color system, CSS variables via `@theme inline`
- **Components**: shadcn/ui (New York style) in [src/components/ui/](src/components/ui/)
- **Icons**: Lucide React (`lucide-react`)
- **Linting**: Biome 2.2 (NOT ESLint/Prettier)

## Critical Developer Workflows

### Development Commands
```bash
bun dev           # Start dev server (uses --bun flag)
bun build         # Production build
bun lint          # Run Biome checks
bun format        # Format with Biome (write mode)
```

### Adding UI Components
Use shadcn/ui CLI. Configuration in [components.json](components.json):
- Style: `new-york`
- Base color: `neutral`
- CSS variables enabled
- Aliases: `@/components`, `@/lib/utils`, `@/components/ui`

## Code Conventions

### Import Aliases (tsconfig)
```typescript
import { Button } from "@/components/ui/button"  // ✅ Always use @/* aliases
import { cn } from "@/lib/utils"                  // ✅ Path alias defined
```

### Component Patterns
1. **UI Components**: Use class-variance-authority (CVA) for variants
   - See [src/components/ui/button.tsx](src/components/ui/button.tsx) for reference pattern
   - Include `data-slot`, `data-variant`, `data-size` attributes
   - Support `asChild` prop via `@radix-ui/react-slot`

2. **Styling Utilities**: 
   - Use `cn()` from [src/lib/utils.ts](src/lib/utils.ts) to merge Tailwind classes
   - OKLCH color system in [src/app/globals.css](src/app/globals.css)
   - Custom dark mode variant: `@custom-variant dark (&:is(.dark *))`

3. **Font Loading**: Geist Sans and Geist Mono via `next/font/google` in [src/app/layout.tsx](src/app/layout.tsx)

### Biome Configuration
- **Formatter**: 2-space indentation, enabled by default
- **Linter**: Next.js and React domains enabled with recommended rules
- **Organize imports**: Auto-enabled on save
- Files watched: Excludes `node_modules`, `.next`, `dist`, `build`

### TypeScript Setup
- Target: ES2017 with `react-jsx` transform
- Module resolution: `bundler` mode
- Strict mode enabled
- Import organization: Biome handles this (not TypeScript)

## Project-Specific Patterns

### Tailwind v4 Usage
This project uses Tailwind CSS v4 with `@import "tailwindcss"` in [globals.css](src/app/globals.css). Key differences:
- CSS variables defined in `@theme inline` block
- Colors use OKLCH format: `oklch(0.145 0 0)`
- Radius variants: `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl` (calculated from `--radius`)
- Dark mode via `.dark` class with custom variant syntax

### Button Component Styling
Extensive variant system in [button.tsx](src/components/ui/button.tsx):
- Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- Sizes: `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg`
- Focus states use ring utilities with 3px ring width
- Icon sizing via CSS selectors: `[&_svg]:size-4`

### Layout Structure
- App Router structure in `src/app/`
- Root layout defines font variables and metadata
- Global styles in [globals.css](src/app/globals.css) with comprehensive theme system
- Dark mode class-based (`.dark`) on `<html>` element

## Integration Points

### Package Manager
- **Bun only**: All scripts use Bun runtime
- `ignoreScripts` and `trustedDependencies` for `sharp` and `unrs-resolver`

### Lucide Icons
Import from `lucide-react`:
```tsx
import { Sparkles, Rocket, Github } from "lucide-react"
// Use with size classes: <Sparkles className="h-12 w-12" />
```

### React Compiler
Enabled in Next.js config - avoid manual memoization (useMemo/useCallback) unless necessary. The compiler optimizes automatically.
