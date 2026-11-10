# Offline place-reference data

Journey Log uses the generated JSON files in this folder only for place
autocomplete. They are reference data, not live timetables, ticketing data, or
an official airport / rail-station directory.

- Airport records are derived from [OurAirports data](https://ourairports.com/data/),
  which is published to the public domain.
- Railway-station records are derived from the [GeoNames geographical database](https://www.geonames.org/export/),
  licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- A small number of Traditional-Chinese airport aliases are supplemented from
  Wikidata (CC0); the exact overlay identifiers and the generation time are in
  `global-place-metadata.json`.

The station source does not provide a single worldwide station-code system.
Journey Log keeps a stable source identifier internally so a selected station
can be saved, but never presents that identifier as a station code in the UI.

To refresh these files, run `pnpm build:place-data` with the four documented
local source-file arguments in `scripts/build-global-place-index.mjs`. The app
never downloads or forwards a traveller's typed query to those sources.
