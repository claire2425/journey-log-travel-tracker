# Journey Log

Journey Log is a local-first travel journal for flights, rail/high-speed rail,
cruises, and other journeys. It also includes a shared travel-expense ledger.

## Run it locally

Use pnpm (the project is pinned to pnpm 11.25.0):

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by the development server, normally
`http://localhost:3000`.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Data and privacy

- Journeys, custom places, and the expense ledger are stored in this browser's
  IndexedDB database. They are not synced between browsers or devices.
- The interactive map is opt-in. Loading it fetches map tiles from
  OpenStreetMap; the app does not send journey records to OpenStreetMap.
- Exchange-rate lookup is also opt-in. When requested, only the source/target
  currency pair and date are sent to the app's rate endpoint; confirmed rates
  are saved with each expense as an immutable snapshot.
- Clearing browser site data removes local records. Export/backup is not yet
  implemented, so keep important source records elsewhere until that feature is
  added.

## Development notes

The bundled reference-place list is deliberately small. If a place is missing,
add it in the journey form with its IANA time zone, coordinates, and continent.
The saved-custom-places section later lets you correct an older place's
continent; linked journey endpoints update together so filtering remains
consistent.
