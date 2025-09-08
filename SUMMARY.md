## Golf Academy App – Clean Summary

### Core Roles
- Golfer
  - Dashboard: HI, SG data, Physical data, Coach Ratings, Attendance.
  - Detail pages: HI, SG, Physical, Coach Ratings, Attendance, Profile (with Psych placeholder).
  - Reminders: Update every 3 months (HI + SG). Physical every 6 months.

- Coach
  - Compare golfers table (sortable, selectable columns, deltas).
  - Correlations (pick any two metrics, scatter plot, Pearson r).
  - Trends (multi-line or small multiples for metrics over time).
  - Profile view for each golfer (all data + quick back link).

- Admin
  - Dashboard: summary stats (users, golfers, coaches, next update cycle).
  - Users: searchable table, view profiles.
  - Cycles: quarterly cycles with % complete.
  - Compliance: update % and who’s missing.
  - Same analytics tools as coaches.

### Data Tracked
- HI (Handicap Index) – manual entry or future sync with England Golf.
- SG Data – Total, Tee, Approach, Short, Putting.
- Physical Data – CHS, Ball speed, CMJ, BJ, Height, Weight.
- Coach Ratings – Holing out, Short game, Wedge play, Ball flight, Planning/tactics.
- Attendance – Group vs 1:1 sessions per cycle.
- Psych Data – Placeholder for API from second project.

### Compare Presets
- All Core – everything.
- Tournament Prep – HI + SG focus + Attendance.
- Physical Block – Ball speed, CHS, CMJ, BJ, Height, Weight.
- Putting Focus – Age + SG Putting.
- Approach/Wedge Focus – Age + SG Approach + SG Short.
- Attendance & Readiness – Attendance + SG Total.

### Features Implemented
- Golfer detail pages with sparklines + tables.
- Coach/Admin Compare with presets, CSV export, sortable columns, progression deltas.
- Correlations with scatter plot, per-quarter option, initials labels.
- Trends with multi-line charts or small multiples.
- Admin dashboard + compliance views.
- Demo data generator (stable seeded random).
- Easter egg: hidden “Chip & Putt Challenge” game triggered via shortcut.

### Fun / Extra Ideas
- Hidden Easter egg game (done).
- Streak badges for golfers updating on time.
- Leaderboards (attendance, improvement).
- Motivational quotes / GIFs.

### Roadmap
1. Frontend polish (mobile responsive, color/font consistency, logos).
2. Supabase backend for real logins, data persistence, role-based access.
3. Vercel deployment (frontend hosting).
4. Mobile app wrapper (Capacitor/Expo) → installable on iOS/Android.
5. APIs:
   - England Golf → HI.
   - Upgame → SG.
   - Trainerize → Physical.
   - Psych site → Psych.

