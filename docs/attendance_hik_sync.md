# Attendance sync from Hik Central

Replaces the Google Drive CSV sync. Door punches are read **directly and live**
from the Hik Central database (PostgreSQL) and turned into one attendance row per
employee per day.

Status: **built and tested against a local PostgreSQL + MySQL.** It has not yet been
pointed at the real Hik database — the table/column names are unknown until you run
the discovery step in §3. Everything is driven by `HIK_*` environment variables, so
no code change is needed to adapt it.

---

## 1. The rule

There is one reader, on the office entrance. So a person's day is every time they
were let in:

| Punch | Meaning |
|---|---|
| **First** punch of the day | **check-in** |
| **Last** punch of the day | **check-out** |

Two refinements keep it honest:

- A second tap within `HIK_MIN_STAY_MINUTES` (default **30**) of the first is a
  double-tap on the reader, not a departure — the day still has no check-out.
- **Today is shown as it stands.** The last punch so far is stored (HR can see who
  is in), but no early-departure is judged and a single punch is not "missing" a
  check-out until the day is over.

Lunch is not interpreted: stepping out and tapping back in just moves the last
punch later.

### What gets written to `attendance`

| Column | From |
|---|---|
| `check_in` / `check_out` | first / last punch (wall-clock, office time zone) |
| `work_hours` | last − first (gross), null with no check-out |
| `status` | `Late` if the first punch is past the schedule start + grace, else `Present` |
| `late_minutes` / `early_leave_minutes` | against the employee's work schedule (company default if none assigned); early-leave only on finished days |
| `scheduled_in` / `scheduled_out` | the shift the day was judged against |
| `punch_count` | how many punches the day was built from |
| `source` | `Hik Central` |

`Half Day` is never written by the sync (a decision carried over from the Drive
sync). A hand-corrected day (`source = 'Manual'`) is never overwritten unless an
admin explicitly asks.

### Absence — only when a day is over

A **live** pass never writes an absence: at 09:05 half the office has not arrived.
The **daily close** (05:00 by default, or the *Close finished days* button) does,
for each tracked employee with **no punches** on a finished day:

| Situation | Written |
|---|---|
| working day, no leave | `Absent` |
| approved leave covering the whole day | `On Leave` (so payroll never takes the day twice) |
| holiday, rest day | nothing |
| no work schedule resolves | nothing — reported ("no schedule") |
| **Hik produced no punches at all that day** | nothing — reported as a *day not observed* |

The last row matters most: if the feed was down, *nobody* is marked absent.

---

## 2. How it runs

| Pass | When | Does |
|---|---|---|
| **Live** | every `HIK_SYNC_INTERVAL_MINUTES` (5) | recomputes today + `HIK_SYNC_LOOKBACK_DAYS` (2) back from the punches. Idempotent: a day is *recalculated*, never appended to, so re-running or running late changes nothing. |
| **Daily close** | `HIK_FINALIZE_HOUR`:`HIK_FINALIZE_MINUTE` (05:00) | the live work, plus absences/leave for finished days, the shadow schedule checks, and the email report. Claimed in the database, so a redeploy at 05:30 neither repeats nor skips it. |
| **Manual** | *Sync now* / *Close finished days* on Attendance → Hik Central Sync | same code, started by HR |
| **Backfill** | admin only, same page | recalculates an explicit range (≤ 93 days). With *also record absences* it closes those days too. |

Automatic passes never touch days before `HIK_SYNC_START_DATE` (default: the day
the sync first ran, then pinned). Use Backfill to load history on purpose.

If the live pass fails 3 times in a row, admins and HR managers get an in-app
notification once, and another when it recovers. A run is only recorded when it
changed something, closed a day, or failed — otherwise the table would be 99%
"nothing happened".

---

## 3. Setting it up — step by step

### 3.1 Create a read-only role on the Hik database

On the Hik PostgreSQL server (as a superuser):

```sql
CREATE ROLE hr_sync LOGIN PASSWORD '<long random>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE <hik_db> TO hr_sync;
GRANT USAGE ON SCHEMA public TO hr_sync;
GRANT SELECT ON <events_table_or_view> TO hr_sync;   -- only what the sync reads
ALTER ROLE hr_sync SET default_transaction_read_only = on;
```

The sync also opens every query `READ ONLY` with a statement timeout, so this is
the second lock, not the only one. Allow the HR server's IP in `pg_hba.conf` and
prefer TLS (§5).

### 3.2 Find the table and columns

Fill in only the connection variables first (`HIK_DB_HOST`, `HIK_DB_PORT`,
`HIK_DB_USER`, `HIK_DB_PASSWORD`, `HIK_DB_NAME`, `HIK_DB_SSL`), then either:

```bash
cd server
node check_hik_sync.mjs --discover
```

or, in the app, **Attendance → Hik Central Sync → Show tables** (admin). It lists
every table/view and column the role can see. Pick the one holding door events.

> The `hik.sql` you exported contains only the server header — HeidiSQL's
> "Data exporting was unselected" and no `CREATE TABLE`. If you would rather send
> the structure, re-export with *Structure: CREATE* ticked. Do not commit it (it
> is git-ignored).

### 3.3 Map it

```
HIK_EVENTS_TABLE=public.<table>          # a VIEW is fine — see below
HIK_COL_PERSON_ID=<column>               # the person's number on the device
HIK_COL_PERSON_NAME=<column>             # optional, names unknown people
HIK_COL_EVENT_TIME=<column>
HIK_EVENT_TIME_TYPE=timestamptz          # | timestamp_local | timestamp_utc | epoch_s | epoch_ms | text_local | text_utc
HIK_EVENT_TZ=Asia/Dubai                  # how "today" and the day boundary are read
```

`HIK_EVENT_TIME_TYPE` says how the time column is stored:

- `timestamptz` — has a time zone; unambiguous (best).
- `timestamp_local` — no zone, already in office time.
- `timestamp_utc` — no zone, holds UTC.
- `epoch_s` / `epoch_ms` — an integer.
- `text_local` / `text_utc` — a text column such as `2026-11-04T13:38:48`, in office
  time or in UTC. Rows whose text is not a date-time are skipped, not fatal.

If the table also holds events that are *not* door entries (alarms, failed
authentications, other doors), filter with `HIK_COL_EVENT_TYPE` +
`HIK_EVENT_TYPE_VALUES` and/or `HIK_COL_DEVICE` + `HIK_DEVICE_VALUES`
(comma-separated, matched as text).

If the person id lives in a different table from the events, **create a view on
the Hik side that joins them** and point `HIK_EVENTS_TABLE` at the view. That keeps
the HR code free of Hik's internal layout.

### 3.4 Match people to employees

The person's number on the device must equal the employee's **Attendance ID**
(Employees → edit). 22 of 24 already do. People punching who are *not* employees
are listed on the page and in the morning email; each can be ignored (contractors,
visitor cards) so it stops being reported.

### 3.5 Verify, read-only

```bash
node check_hik_sync.mjs               # config + connection + counts
node check_hik_sync.mjs --preview 3   # first/last punch per person, last 3 days,
                                      # and which ids match an employee
```

Neither writes anything, to either database. Then **Test connection** in the app.

### 3.6 Switch it on

Set the variables as **runtime** variables in Coolify (never build variables —
build args are written into image layers and the build log), redeploy, and run the
migration once:

```bash
cd server && npm run migrate        # applies apply_attendance_hik_sync.mjs
```

(The server also self-heals the same columns/tables at boot.) The live pass starts
immediately; the first daily close is at the next 05:00.

---

## 4. What the migration changes

`server/apply_attendance_hik_sync.mjs` (idempotent):

- `attendance.source` gains `'Hik Central'`. **`'Drive Sync'` stays** — those days
  are history.
- `attendance.punch_count` (new).
- `hik_sync_runs` (new) — one row per pass worth remembering.

Left untouched: `attendance_sync_files` and `attendance_sync_runs`, the Drive
ledger. Nothing writes to them any more; drop them when the history is not wanted:

```sql
DROP TABLE attendance_sync_files, attendance_sync_runs;
```

`attendance_ignored_devices` is still used (ids that are deliberately not
employees). The manual time-card upload (`POST /api/attendance/import`) is kept as
a fallback for a broken feed.

Removed: the Google Drive client, the CSV parser, `GOOGLE_DRIVE_SA_*` /
`ATTENDANCE_DRIVE_FOLDER_ID` / `ATTENDANCE_SYNC_START_DATE` variables, and the
`google-auth-library` dependency. You can delete those variables from Coolify.

---

## 5. Security notes

- **TLS.** `HIK_DB_SSL` defaults to `require` in production (encrypted, certificate
  not verified). `verify` also checks the certificate (set `HIK_DB_SSL_CA` to the
  base64 of the CA if it is private). `disable` sends the password and the punches
  in clear text — only on a private network or over an SSH tunnel. The server logs
  a warning at boot if it is disabled in production. The Hik server was exposed on
  a public IP; restrict port 5432 to the HR server's address in the firewall /
  `pg_hba.conf`.
- **Least privilege.** Use the `SELECT`-only role from §3.1. The sync additionally
  runs every statement in `BEGIN READ ONLY` with `statement_timeout`.
- **No injection path.** Table and column names come from the environment and are
  validated against a strict identifier pattern and double-quoted; every value
  (time window, filters) is a bound parameter. Nothing from a punch row ever
  reaches SQL.
- **Secrets** are runtime-only. `hik*.sql` dumps are git-ignored; do not commit
  them (they carry the server address).
- **Roles.** Viewing status / test / Sync now / Close finished days / ignore:
  `admin`, `hr_manager`. Show tables, Backfill, un-ignore: `admin` only.

---

## 6. Tests

```bash
cd server
# pure logic — no database
npx vitest run tests/hikRules.test.js tests/hikClient.test.js tests/hikReport.test.js

# the sync against a real HR schema (local MySQL only; refuses a remote host)
DB_HOST=127.0.0.1 DB_PORT=33306 DB_USER=root DB_PASSWORD=testpw DB_NAME=ist_hr \
  npx vitest run tests/hikSync.test.js

# the reader against a real PostgreSQL, all five time encodings
HIK_TEST_PG=127.0.0.1:35432:postgres:testpw:hik npx vitest run tests/hikClient.pg.test.js
```

`hikSync.test.js` runs a daily close, which touches every tracked employee in the
database it is pointed at — that is why it refuses a non-local `DB_HOST` unless
`ALLOW_REMOTE_DB_TESTS=1`.
