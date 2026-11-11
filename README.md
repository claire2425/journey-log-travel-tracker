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
- Airport and rail-station autocomplete searches the app's bundled reference
  data through its own route. Typed place names and codes are not sent to an
  external geocoder or timetable provider. Airport data is from
  [OurAirports](https://ourairports.com/data/) (Public Domain); station data is
  from [GeoNames](https://www.geonames.org/export/) (CC BY 4.0). The local
  index is a travel-recording aid, not a live timetable or an official
  operational directory.
- The journey dashboard can create a PNG recap for the currently visible
  journeys, including a locally drawn world-footprint sketch with route and
  country/region colours; a fully converted expense ledger can create a PNG
  spending recap. These images are generated locally only after the person
  chooses to download them; they are sharing snapshots, not a restorable data
  backup.
- Clearing browser site data removes local records. Keep important source
  records elsewhere until a full backup/import feature is added.

## Development notes

The bundled global reference index currently contains airports with common
aviation codes and more than 70,000 rail stations. Rail stations do not have a
single worldwide code system, so source-only station IDs are never shown as
traveller-facing codes. If a place is missing or needs correcting, add it in
the journey form with its IANA time zone, coordinates, and continent. The
saved-custom-places section later lets you correct an older place's continent;
linked journey endpoints update together so filtering remains consistent.
