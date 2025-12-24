# Aithen AI Coding Agent Instructions

## Project Overview
Next.js 16 authentication/user management application with WebAuthn passkey support, SQLite database, and first-run setup wizard. Built with Bun runtime, React 19, shadcn/ui components, and Biome for linting/formatting.

## Tech Stack & Architecture
- **Runtime**: Bun (all scripts use `bun --bun` prefix)
- **Framework**: Next.js 16.1+ with App Router (`src/app/`)
- **React**: v19.2+ with React Compiler enabled in [next.config.ts](next.config.ts)
- **Database**: SQLite via Drizzle ORM ([drizzle-orm/bun-sqlite](src/db/index.ts)), auto-migrations on startup
- **Authentication**: JWT tokens (jose), bcrypt password hashing, WebAuthn/Passkey support via @simplewebauthn
- **Styling**: Tailwind CSS v4 with OKLCH color system, CSS variables via `@theme inline`
- **Components**: shadcn/ui (New York style) in [src/components/ui/](src/components/ui/)
- **Icons**: Lucide React (`lucide-react`)
- **Linting**: Biome 2.2 (NOT ESLint/Prettier)
- **Validation**: Zod schemas in [src/lib/validations.ts](src/lib/validations.ts)

## Critical Developer Workflows

### Development Commands
```bash
bun dev           # Start dev server (uses --bun flag)
bun build         # Production build
bun lint          # Run Biome checks
bun format        # Format with Biome (write mode)
bun db:migrate    # Run database migrations manually
bun db:seed       # Seed database with initial data
bun db:setup      # Run migrations + seed (full setup)
```

### Database Management
- **Auto-migrations**: [db/index.ts](src/db/index.ts) automatically runs migrations on startup (silent mode)
- **Schema**: Drizzle schema in [db/schema.ts](src/db/schema.ts) with 4 tables: users, sessions, passkeys, passkeyVerifications
- **Location**: SQLite file at `./data/registry.db` with WAL mode enabled
- **Manual migrations**: Use `bun db:migrate` to create tables if needed
- **Type safety**: Export types from schema: `User`, `NewUser`, `Session`, `Passkey`, etc.

### Adding UI Components
Use shadcn/ui CLI. Configuration in [components.json](components.json):
- Style: `new-york`
- Base color: `neutral`
- CSS variables enabled
- Aliases: `@/components`, `@/lib/utils`, `@/components/ui`

## Authentication Architecture

### Three-Layer Auth System
1. **Setup Guard** ([proxy.ts](src/proxy.ts#L29-L40)): Checks `needsSetup()` FIRST - redirects all routes to `/setup` if no admin exists
2. **Public Paths**: Allows `/login`, `/api/auth/*`, `/api/auth/passkey/*` when setup complete
3. **JWT Auth**: Verifies `auth-token` cookie for protected routes, enforces admin-only paths

### Auth Implementation Pattern
- **Edge-compatible**: [auth-edge.ts](src/lib/auth-edge.ts) uses `jose` for JWT (works in middleware)
- **Server-side**: [auth.ts](src/lib/auth.ts) adds bcrypt, database operations
- **Session flow**: 
  1. Login creates session in DB → returns JWT token → sets httpOnly cookie
  2. Middleware reads cookie → verifies JWT → checks session exists in DB
  3. Logout deletes session from DB + clears cookie

### WebAuthn/Passkey Integration
- **Registration**: [passkey.ts](src/lib/passkey.ts) - `generateRegistrationOpts()` → user registers → `verifyRegistration()` stores in DB
- **Login**: `generateAuthenticationOpts()` → user authenticates → `verifyAuthentication()` validates
- **Configuration**: Requires `NEXT_PUBLIC_RP_ID`, `NEXT_PUBLIC_ORIGIN` in `.env.local` (see [.env.example](.env.example))
- **Transports**: Stored as JSON string in `passkeys.transports` field

### Middleware Alternative Pattern
This project uses [src/proxy.ts](src/proxy.ts) instead of `middleware.ts`:
- **Why**: Custom name avoids Next.js automatic middleware detection (explicit export needed)
- **Usage**: Must be manually exported as `middleware` in a `middleware.ts` file at project root if needed
- **Current setup**: Acts as reusable auth logic, not auto-invoked by Next.js

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

## API Route Patterns

### Standard Response Flow
```typescript
// Example from src/app/api/auth/login/route.ts
export async function POST(request: Request) {
  // 1. Parse and validate with Zod
  const result = loginSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }
  
  // 2. Business logic (DB queries, auth checks)
  const user = await db.query.users.findFirst(...);
  
  // 3. Return success/error with appropriate status
  return NextResponse.json({ user }, { status: 200 });
}
```

### Form Handling (Client Components)
- Use `react-hook-form` with `zodResolver` for validation
- See [create-user-dialog.tsx](src/components/dashboard/create-user-dialog.tsx) for pattern:
  - `useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) })`
  - `FormField` + `FormControl` from shadcn/ui
  - State management: `useState` for dialog open/close, error messages

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
