# ProPath Golf Academy (MVP)

Roles: **Golfer**, **Coach**, **Admin**  
Features live now:  
- Golfer: Dashboard (HI, SG, Physical, Psych placeholder, Attendance) + detail views  
- Coach: Compare (sortable, presets, deltas, CSV), Correlations (scatter + Pearson r), Trends (multi-line/small multiples)  
- Admin: Users, Cycles, Compliance  
- Easter egg: “Chip & Putt” mini putt (Shift+G unlock; ⛳ FAB)

## Tech Stack
- Static HTML/CSS/JS (deploy: Vercel)  
- Planned backend: Supabase (Auth, Postgres, RLS)  
- Optional: PWA (manifest + service worker) for installable mobile app

## Local Dev
- Open `index.html` in a browser (or use Live Server in VS Code).
- Build: none (vanilla JS).

## Deploy
- GitHub → Vercel (auto deploy on push to `main`).

## PWA Checklist (planned)
- `manifest.json` (name, icons 192/512, colors, display=standalone)
- `sw.js` (cache app shell)
- `<link rel="manifest">` + iOS meta + touch icons
- `navigator.serviceWorker.register('/sw.js')` in JS

## Supabase (planned)
Tables (sketch):  
- `users` (auth, role)  
- `golfers` (profile, dob, hi)  
- `sg_quarter` (d, total, tee, app, short, putting)  
- `phys_quarter` (d, chs, ball, cmj, bj, height, weight)  
- `coach_ratings` (d, holing, short, wedge, flight, plan)  
- `attendance` (d, group, one1)  
- `cycles` (start, end, type, status)

RLS: golfers read their own; coaches read squad; admin all.

## Roadmap (short)
1. PWA shell (manifest + SW)  
2. Supabase Auth + read-only data  
3. Update Wizard per role + reminders (Edge Functions)  
4. Mobile polish (responsive tables, sticky headers)  
5. Psych + Upgame integrations (API or verified links)

## Fun
Hidden mini-game: **Chip & Putt** (canvas physics). Unlock when quarterly update complete (currently Shift+G).
