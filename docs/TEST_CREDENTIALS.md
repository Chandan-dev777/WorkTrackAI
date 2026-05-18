# WorkTrack AI — Test Credentials

All seeded users share the same password: **`WorkTrack2026!`**

Seed data is created by running `POST /admin/seed-dummy-data` or:
```bash
source chatbot/.venv/bin/activate
python -c "from backend.database import SessionLocal, create_tables; create_tables(); from backend.seed_data import seed; db=SessionLocal(); seed(db)"
```

---

## Admin

| Role | Name | Employee ID | Email | Password |
|------|------|-------------|-------|----------|
| Admin | System Admin | ADMIN-001 | admin@worktrack.ai | WorkTrack2026! |

---

## Managers

| Role | Name | Employee ID | Email | Team | Password |
|------|------|-------------|-------|------|----------|
| Manager | Sarah Connor | MGR-ENG-001 |     | Engineering | WorkTrack2026! |
| Manager | Grace Hopper | MGR-DAT-001 | grace.hopper@worktrack.ai | Data | WorkTrack2026! |
| Manager | Linus Torvalds | MGR-SUP-001 | linus.torvalds@worktrack.ai | Support | WorkTrack2026! |

---

## Employees — Engineering Team

| Role | Name | Employee ID | Email | Password |
|------|------|-------------|-------|----------|
| Employee | John Reese | EMP-ENG-001 | john.reese@worktrack.ai | WorkTrack2026! |
| Employee | Kate Brewster | EMP-ENG-002 | kate.brewster@worktrack.ai | WorkTrack2026! |
| Employee | Miles Dyson | EMP-ENG-003 | miles.dyson@worktrack.ai | WorkTrack2026! |
| Employee | Tarissa Dyson | EMP-ENG-004 | tarissa.dyson@worktrack.ai | WorkTrack2026! |

## Employees — Data Team

| Role | Name | Employee ID | Email | Password |
|------|------|-------------|-------|----------|
| Employee | Alan Turing | EMP-DAT-001 | alan.turing@worktrack.ai | WorkTrack2026! |
| Employee | Ada Lovelace | EMP-DAT-002 | ada.lovelace@worktrack.ai | WorkTrack2026! |
| Employee | Claude Shannon | EMP-DAT-003 | claude.shannon@worktrack.ai | WorkTrack2026! |
| Employee | Norbert Wiener | EMP-DAT-004 | norbert.wiener@worktrack.ai | WorkTrack2026! |

## Employees — Support Team

| Role | Name | Employee ID | Email | Password |
|------|------|-------------|-------|----------|
| Employee | Guido van Rossum | EMP-SUP-001 | guido.vanrossum@worktrack.ai | WorkTrack2026! |
| Employee | Bjarne Stroustrup | EMP-SUP-002 | bjarne.stroustrup@worktrack.ai | WorkTrack2026! |
| Employee | Dennis Ritchie | EMP-SUP-003 | dennis.ritchie@worktrack.ai | WorkTrack2026! |
| Employee | Ken Thompson | EMP-SUP-004 | ken.thompson@worktrack.ai | WorkTrack2026! |

---

## Quick picks by use case

| Want to test... | Use this account |
|-----------------|-----------------|
| Full admin access (user editing, seed, reindex) | admin@worktrack.ai |
| Manager view scoped to Engineering team | sarah.connor@worktrack.ai |
| Manager view scoped to Data team | grace.hopper@worktrack.ai |
| Employee submit + personal dashboard | john.reese@worktrack.ai |
| Chat assistant with 30 days of work history | alan.turing@worktrack.ai |
