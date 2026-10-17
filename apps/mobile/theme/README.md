# Vaultix Mobile Theme Tokens

Single source of truth for colour, spacing, radius and typography in `apps/mobile`.

This module exists because every screen used to hardcode its own palette: `app/index.tsx` painted its
background `#12121f`, `app/(tabs)/_layout.tsx` used `#1a1a2e`, and `app/(tabs)/settings.tsx` used
`#0f172a` — so the same surface looked like a different colour depending on which screen you were on,
and there was no way to reconcile it in one place. The slate ramp in `theme/index.ts` is that one place.

## Usage

```ts
import { colors, radii, spacing } from '../theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.base,
  },
});
```

**Rule: no raw hex literals in `app/` or `components/`.** If you need a colour that does not exist
yet, add a token (below) rather than inlining `#rrggbb`.

## Tokens

| Group | Tokens |
|---|---|
| Surfaces | `background`, `surface`, `surfaceRaised`, `surfaceSunken`, `overlay`, `scrim` |
| Borders | `border`, `borderStrong` |
| Text | `text`, `textSecondary`, `textTertiary`, `textInverse`, `onAccent` |
| Brand / status | `accent`, `accentSoft`, `info`, `infoStrong`, `infoAlt`, `success`, `successBright`, `warning`, `warningSoft`, `danger`, `dangerStrong`, `dangerSoft` |
| Shadows | `shadow` |

Also exported: `spacing` (`xs`…`xl`), `radii` (`sm`, `md`, `lg`, `xl`, `pill`), `typography`
(`title`, `heading`, `sectionTitle`, `body`, `bodyStrong`, `caption`, `micro`) and `shadows`
(`card`, `modal`).

Token names describe **role**, not appearance. `surface` (not `darkBlue`) means "the colour cards are
allowed to be", so re-theming the app later is a one-file edit.

## Adding a new token

1. Add it to the relevant group in [`index.ts`](./index.ts), keeping the group alphabetical and the
   value in the same hex case used by the rest of the palette:

   ```ts
   // --- Brand / status -----------------------------------------------------
   success: '#10B981',
   /** Teal used for the "funded" state chip. */
   funded: '#2DD4BF',
   ```

2. Document it inline with a one-line `/** … */` comment saying *when* to reach for it, and add the
   token to the table above.

3. Use it as `colors.<token>` — never `Colors.<token>` from an untyped object, and never inline a hex.

4. If the token is a new *kind* of thing (e.g. a typography role or a spacing step), add it to that
   export and to its table in this file rather than inventing a new scale.

## Migrating a screen

Grep for hex literals and map them by role, not by value:

```bash
grep -nE "#[0-9A-Fa-f]{3,8}" app components
```

- a screen's canvas → `colors.background`
- card / modal / input fill → `colors.surface`
- primary copy → `colors.text`, supporting copy → `colors.textSecondary`
- a destructive button or failed state → `colors.danger` (fill) / `colors.dangerStrong`
