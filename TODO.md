# TODO (MVP → Beta)

## Immediate
- [ ] Call `renderEggButton()` at end of `navTo(view)` for FAB persistence
- [ ] Compare: ensure presets set columns + show preset note
- [ ] Responsive tables: sticky headers + horizontal scroll

## PWA
- [ ] Add `manifest.json` + icons (192/512)
- [ ] Add `sw.js`, register in app
- [ ] Lighthouse PWA pass

## Backend (Supabase)
- [ ] Create project, enable Email/Password
- [ ] SQL: create tables (users, golfers, sg_quarter, phys_quarter, coach_ratings, attendance, cycles)
- [ ] Seed with demo data
- [ ] RLS policies for roles
- [ ] Replace mock fetches with selects (Golfer Dashboard → Compare → Trends)

## Update Cycles
- [ ] Wizard: Golfer (HI + SG), Coach (ratings + attendance), Physical (metrics)
- [ ] Admin cycles CRUD
- [ ] Reminders: scheduled emails/push (Edge Functions)

## UX Polish
- [ ] Save last view/preset per user
- [ ] Empty states & loading skeletons
- [ ] Accessibility pass (tab order, contrast, ARIA)

## Integrations
- [ ] Psych site: link + last-sync timestamp
- [ ] Upgame: API or deep link fallback

## Nice-to-have
- [ ] Custom column presets per coach
- [ ] Audit trail on edits
- [ ] Unlock Easter egg on update completion
