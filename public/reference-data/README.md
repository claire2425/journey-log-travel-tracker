# Offline place-reference data

Journey Log uses the generated place JSON files in this folder only for place
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

## World basemap for PNG reports

`world-countries-50m.json` is the Natural Earth 1:50m Admin 0 countries layer
([Natural Earth](https://www.naturalearthdata.com/), public domain), as packaged
in TopoJSON by [`world-atlas`](https://github.com/topojson/world-atlas) v2.0.2
(ISC licence, © 2013-2019 Michael Bostock). It is fetched from this app's own
origin only when a person downloads a PNG recap, and is drawn as a backdrop in
the browser. It is not an authoritative statement of borders and is not used
for distances or navigation.
