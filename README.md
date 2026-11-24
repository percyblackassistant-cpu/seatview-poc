# Seat preview (POC)

A booking-style seat picker: choose a seat on a 2D plan, then see the room from that seat in
first person, look around, and stand up to check what the row in front is blocking.

Built for a 100-seat room as a proof of concept. Everything is data driven: the room, the seat
layout and the eye heights live in one file.

## What works

- 100 seats, 10 rows (A–J), two aisles, raised stage, flat floor.
- Click a seat on the plan and the 3D camera moves to that seat's eye point, aimed at the screen.
- Drag inside the 3D view to look around. `Look at stage` recentres.
- `Stand up` raises the eye from 1.18 m to 1.68 m and back, animated.
- Seat states: free, taken (8 seats), selected. Taken seats refuse the click.
- Responsive: side-by-side on desktop, stacked on a phone with a scroll into the view.

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

## Change the room

`src/data/room.js` holds the whole room: width, depth, height, stage box, row pitch, seat pitch,
aisle width, block sizes, eye heights, and which seats are already sold. Change the numbers and the
2D plan and the 3D room both follow. Nothing else needs editing for a rectangular room.

## Real venue captures

Each seat has a `panorama` field, empty by default. Set it to an equirectangular (2:1) image URL and
that seat's view becomes the photo instead of the rendered room:

```js
panorama: '/panoramas/e5-seated.jpg',
```

Be clear about the trade-off before doing this at scale. A 360 still is captured from one point, so
standing up inside it slides the camera vertically without real parallax; a truthful standing view
needs a second capture per seat. For 100 seats that is 200 captures. The rendered geometry path has
no such limit, which is why the POC ships with geometry and treats photos as an upgrade per seat.

## Limits of the POC

- No checkout, accounts, holds or payments. Selecting a seat does not reserve it.
- The room is schematic: seat blocks and stage volumes, not a surveyed model. Sightlines are
  geometrically consistent but the room is not a real venue.
- Flat floor. A raked floor would be a data change plus steps in the shell geometry.
- No walk mode. Camera stays at the selected seat.

## Stack

Vite 6, React 19, three.js r187. No other runtime dependencies.

- three.js docs: https://threejs.org/docs/
- GitHub Pages static deploy: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
