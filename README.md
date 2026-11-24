# Seat preview (POC)

A booking-style seat picker: choose a seat on a 2D plan, then see the room from that seat in first
person, look around, and stand up to check what the row in front is blocking.

Two rooms ship in the same build, and everything is data driven: the room, the seat layout, the rake
and the eye heights live in one file (`src/data/venues.js`).

## The rooms

**Uránia Nemzeti Filmszínház, Díszterem** (Rákóczi út 21, Budapest VIII) — the realistic one.
425 seats in 15 stalls rows (A–O) plus a balcony of 7 rows (P–V), a raked stalls floor, an
8.2 × 4.8 m screen and a 100 m² stage.

**Studio Hall** — the original 100-seat demo room, kept as a clean flat-floor reference.

### What is published, and what is modelled

This matters, because a seat view is only as honest as its inputs.

Published by the venue (urania-nf.hu/rendezvenyhelyszin, checked 24 Nov 2026):

- 425 seats for screenings, 460 for other events
- Main screen 820 × 480 cm, filling the whole stage opening
- Stage floor area 100 m²
- Two chamber rooms of 46 seats each on level −1

Modelled, not surveyed: hall width, depth and height, the rake, the seat pitch and the position of
the screen within the stage. The seat grid is reconstructed to the published 425 capacity — it is
not the venue's own seat numbering, and it should not be read as such. The app states this in the
fine print under the 3D view.

## What works

- Tiered seating plan: stalls and balcony as separate plans, with the stage and screen drawn to scale.
- Click a seat and the 3D camera moves to that seat's eye point, aimed at the screen.
- Raked floor built as real steps, so the seat in front sits where it should in the sightline.
- Balcony is a real raised tier with a parapet, so the view from row P is genuinely elevated.
- Drag inside the 3D view to look around. `Look at screen` recentres.
- `Stand up` raises the eye from 1.16 m to 1.66 m and back, animated.
- Seat states: free, taken, selected. Taken seats refuse the click.
- The URL carries the state (`#venue=urania&seat=H12`), so a view can be shared as a link.
- Responsive: side-by-side on desktop, stacked on a phone, with the plan scrollable so seats stay
  tappable.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173/seatview-poc/
npm run build    # static output in dist/
```

The Vite `base` is `/seatview-poc/` because that is the GitHub Pages path. Override it for another
host:

```bash
SITE_BASE=/ npm run build
```

## Add a venue

Everything is one object in `src/data/venues.js`:

```js
defineVenue({
  id: 'my-venue',
  name: 'Venue name',
  room: 'Room name',
  hall: { width, depth, height, stageWidth, stageDepth, stageHeight, frontZ },
  screen: { width, height, bottom, z },
  tiers: [
    { id: 'stalls', rows: 15, blocks: [6, 7, 6], seatPitch: 0.55, rowPitch: 0.95,
      aisleWidth: 0.95, firstZ: -3.6, rake: 0.13, elevation: 0 },
  ],
  sold: new Set(['A5', 'B12']),
})
```

Seats are generated from `blocks` (seat counts either side of each aisle), `seatPitch` and
`rowPitch`, so a tier costs six numbers. Row letters continue across tiers (stalls A–O, balcony
P–V), which keeps seat ids unique without a tier prefix. `capacityBuilt` is computed and asserted
against the published capacity when you add a room.

## Real venue captures

Each seat has a `panorama` field, empty by default. Set it to an equirectangular (2:1) image path and
that seat's view becomes the photo instead of the rendered room:

```js
panorama: 'panoramas/e5-seated.jpg',
```

The path resolves against the app URL, so keep it relative (a leading `/` points at the host root
and will 404 under the `/seatview-poc/` Pages prefix).

Be clear about the trade-off before doing this at scale. A 360 still is captured from one point, so
standing up inside it slides the camera vertically without real parallax; a truthful standing view
needs a second capture per seat. For 425 seats that is 850 captures. The rendered geometry path has
no such limit, which is why the POC ships with geometry and treats photos as a per-seat upgrade.

## Limits of the POC

- No checkout, accounts, holds or payments. Selecting a seat does not reserve it.
- Geometry is schematic: seat blocks, walls and a proscenium, not a surveyed model. Sightlines are
  geometrically consistent, but the room is a reconstruction from published numbers.
- Two tiers only. A horseshoe house (the Opera, for example) would need curved tiers and boxes.
- No walk mode. The camera stays at the selected seat.
- No text or signage on the walls, no acoustic treatment, no lighting design.

## Stack

Vite 6, React 19, three.js r187. No other runtime dependencies.

- three.js docs: https://threejs.org/docs/
- GitHub Pages deploy: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Venue data: https://urania-nf.hu/rendezvenyhelyszin
