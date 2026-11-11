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

To preview the installable production build locally, run `pnpm build` followed
by `pnpm start`. Browsers treat `localhost` as secure for development; phones
need an HTTPS deployment before installation is offered.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Data and privacy

- Journeys, custom places, and the expense ledger are stored in this browser's
  IndexedDB database, so the app remains useful offline.
- Optional private sync is available after Supabase is configured. A person
  signs in with an emailed verification code; Supabase Row Level Security makes every
  cloud record available only to that signed-in account. The app uses HTTPS in
  transit and does **not** claim end-to-end encryption.
- The first cloud sync is an explicit action. It compares this device and the
  cloud before uploading; ordinary records use their newest `updated_at`
  value, and a concurrent edit is left for the person to choose rather than
  silently overwriting either copy. Sample journeys are never uploaded.
- Signing out pauses cloud replication but intentionally leaves the device's
  offline copy (and any later local changes) in place. Those changes do not
  upload until the same account explicitly re-enables sync. Use a separate
  browser profile on a shared computer.
- A cloud deletion immediately redacts the journey or expense payload. A small
  tombstone containing its identifier, revision, and timestamps remains so
  that other signed-in devices can learn that the record was deleted.
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

## Set up private cloud sync

1. Create a Supabase project, then run
   [`supabase/migrations/202611110001_private_sync.sql`](supabase/migrations/202611110001_private_sync.sql)
   in its SQL editor (or apply it with the Supabase CLI). It creates the
   journey tables, revision-checked sync functions, and owner-only RLS rules.
2. In Supabase Authentication, enable Email sign-in and change the **Magic
   Link** email template to send a code, not a link. For example, its body can
   be `<p>Your Journey Log sign-in code: {{ .Token }}</p>` (do not include
   `{{ .ConfirmationURL }}`). The app asks for this code in the same browser or
   installed PWA, which also works on iPhone/iPad where Safari and a Home Screen
   app have separate sign-in storage.
3. Copy `.env.example` to `.env.local` and fill in the Project URL plus the
   browser-safe **publishable** key from Supabase. Never use a service-role
   key in the app or in Vercel.
4. Restart the local server, open either app page, and use **Private sync** to
   request and enter a sign-in code. First sync is deliberately opt-in.

## Deploy an installable private app

1. Import this repository into Vercel and deploy it. Vercel provides an HTTPS
   `*.vercel.app` URL automatically; a custom domain can be attached later.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel Production environment,
   then redeploy. Keep the final URL as the Supabase Site URL for the branded
   email template and any future redirect-based sign-in flows.
3. Visit the HTTPS URL on a phone. Android browsers show **Install Journey
   Log** when eligible. On iPhone or iPad, open it in Safari, use Share, then
   choose **Add to Home Screen**.

The URL itself remains reachable so that the PWA and sign-in page can load;
the private part is the account-protected data. Do not rely on a hidden URL as
the privacy boundary.

## Development notes

The bundled global reference index currently contains airports with common
aviation codes and more than 70,000 rail stations. Rail stations do not have a
single worldwide code system, so source-only station IDs are never shown as
traveller-facing codes. If a place is missing or needs correcting, add it in
the journey form with its IANA time zone, coordinates, and continent. The
saved-custom-places section later lets you correct an older place's continent;
linked journey endpoints update together so filtering remains consistent.
