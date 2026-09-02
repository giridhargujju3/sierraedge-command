# `public/sounds/` — optional real siren recording

The dashboard plays a **synthesized air-raid siren** (Web Audio) when a sensor
goes CRITICAL. If you prefer a real recording, drop one in this folder named:

```
crit-siren.mp3   (or crit-siren.wav / crit-siren.ogg)
```

It is detected automatically and played **instead of** the synthesized siren —
no code changes required.

## Where to get a siren (zapsplat)

1. Create a free account at <https://www.zapsplat.com> (downloads require login).
2. Browse <https://www.zapsplat.com/sound-effect-category/sirens-and-alarms/>
   and pick an "air raid siren" / "civil defence siren" / "nuclear alarm".
3. Download it, rename it to `crit-siren.mp3`, and place it here.
4. Hard-refresh the dashboard (`Ctrl+Shift+R`) — done.

> Check the licence terms on zapsplat for your usage (free tier requires
> attribution in most cases).
