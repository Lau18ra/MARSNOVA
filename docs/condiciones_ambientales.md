# Environmental conditions — Gale Crater (Mount Sharp boxwork zone)

Work zone (HiRISE DTM): latitude −4.9488° to −4.7206°, longitude 137.2390° E to 137.3539° E (center −4.8347°, 137.2964° E), mean elevation −3910 m (MOLA).

| Variable | Range in work zone | Unit | Source | Why it matters to the astronaut | Use in MARSNOVA |
|---|---|---|---|---|---|
| Surface temperature | −94 to +20 (peak ~13:00 local) | °C | Mars Climate Database v6.2 (web) | Ground contact, suit and equipment limits | Traverse time window |
| Air temperature (2 m) | −88 to −15 (peak ~14:00–15:00 local) | °C | Mars Climate Database v6.2 (web) | Thermal load on the suit | Conditions panel |
| Surface pressure | 676 to 939 | Pa | MCD v6.2 (web); cross-checked with MCD .nc + MOLA elevation correction (680–960) | Suit pressurization; atmospheric shielding against radiation | Conditions panel, dose model |
| Wind speed | 0.2 to 16.8 | m/s | Mars Climate Database v6.2 (web) | Dust lifting, stability | Conditions panel (indicative only) |
| Dust optical depth (τ) | 0.26 to 1.36 (typical); 4.9 to 5.9 (dust storm) | dimensionless | MCD v6.2 (web) and scenarios (MY24–26, cold, warm, storm) | Visibility, sunlight, solar power | Conditions panel, storm alert |
| Solar irradiance at surface | 0 to 619 (dust storm: max ~150–180) | W/m² | Mars Climate Database v6.2 (web) | Usable daylight and power | Traverse time window |
| Water-ice clouds | up to 2.7×10⁻³; Ls 60°–135°, around dawn | kg/m² | Mars Climate Database v6.2 (web) | Morning visibility | Advisory |
| Surface CO₂ frost | 0 year-round | kg/m² | Mars Climate Database v6.2 (web) | No CO₂ frost hazard in the zone | Context |
| Background radiation (GCR) | 164 (2024, solar max) to 220 (2012–14) | µGy/day | Curiosity RAD, detector E (tissue-equivalent) | Cumulative mission dose | Traverse dose estimate |
| Atmospheric shielding | −0.13 per Pa (±5% over a sol) | µGy/day per Pa | Guo et al., from RAD data | Higher pressure, lower dose | Dose correction |
| Moderate solar event | peak 304 (+85%), excess dose 45 µGy | µGy/day | Curiosity RAD, Sept 5, 2024 | Low risk | Alert: caution |
| Extreme solar event | peak 8,378 (55× background), excess dose ~1,730 µGy | µGy/day | Curiosity RAD, May 20, 2024 | Acute risk | Alert: seek shelter |
| Space weather | CME arrival at Mars: time to impact | h (arrival time in UTC) | NASA DONKI (WSA-Enlil simulations) | Advance warning of solar events | Live alert |

## Methodological note

No environmental variable is applied per pixel. The whole work zone falls within a single Mars Climate Database grid cell, and RAD measures at a single point. The per-pixel cost matrix uses terrain only (slope and roughness from the HiRISE DTM). Environmental conditions enter as time constraints: when to go out (daylight and temperature), how long to stay (radiation dose), and whether to go out at all (dust storm and solar event alerts).
