# monitor-system

A personal Viam application for home tech. Started life as a multi-camera
viewer for keeping an eye on my dog, now growing into a small home
dashboard (cameras, pet feeder, and — coming — a SwitchBot thermostat and
curtain opener).

Based on [`viam-labs/viam-camera-viewer`](https://github.com/viam-labs/viam-camera-viewer) by Naomi.

> This started as a general-purpose module but has drifted into personal
> territory. It'll likely move to a `josephborodach` namespace once the
> non-camera features land; `module_id` in `meta.json` already reflects
> the pivot (`joseph:monitor-system`).

## Run locally

```bash
npm install
npm start
```

Opens on [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

Outputs to `build/`.
