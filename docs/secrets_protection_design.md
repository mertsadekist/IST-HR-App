# Protecting stored passwords and secrets — design

Answer to: *if we store platform passwords in the system, how do we protect them from
breach, leakage and theft?*

Written against the system as it stands at commit `e84fd22`. Nothing here is implemented yet —
this is the design to approve before any of it is built.

---

## 0. The honest starting point

What exists today, in `server/services/cryptoService.js` + `asset_assignments`:

- AES-256-GCM encryption of `account_password` into `encrypted_password` / `password_iv` / `password_tag`.
- One process-wide key from `ENCRYPTION_KEY`, distinct from `JWT_SECRET`.
- `GET /assets/:id/reveal-password`, restricted to `admin` and `hr_manager`.
- A `stripSecrets()` helper so list endpoints never return the ciphertext.

That is a reasonable floor — the algorithm is right and secrets are not in list payloads. But it
fails five things that matter, and each is a realistic path to a leak:

| Weakness | What it means in practice |
|---|---|
| **One key for everything** | A single leaked `ENCRYPTION_KEY` decrypts every password ever stored. There is no blast-radius limit. |
| **No key rotation path** | Rotating the key today orphans every existing ciphertext. In practice this means the key is never rotated. |
| **Reveal is unlogged and unlimited** | An `hr_manager` account can read every password, one request at a time, and nothing records or rate-limits it. A stolen session is a full credential dump. |
| **No plaintext-exposure boundary** | The decrypted value crosses the network to the browser, lands in memory, and may sit in a screenshot, a proxy log, or the browser's process. |
| **A DB backup is a credential store** | `server/routes/backup.js` dumps `asset_assignments`. Anyone with a backup file plus the key has everything. |

The PRD's own answer to this (business rule 10, social governance rule 8) is *do not store
passwords at all — store only a vault reference*. That is the strongest position and it should stay
the default. The design below is for the cases where you decide the system must hold the secret
itself.

---

## 1. Principle: decide per secret whether you need it at all

Three tiers, and most secrets belong in the first two:

1. **Reference only (default, and what the PRD requires).** Store `vault_secret_reference`, e.g.
   `VAULT-SOCIAL-014`. The system records *that* a credential exists, who owns it, and where to find
   it — never the value. Zero breach exposure. Use for every social, ads, banking and
   infrastructure credential.
2. **Delegated access.** Prefer a mechanism where no shared password exists: SSO / Google Workspace
   groups, platform-native "add user by email" (Meta Business, TikTok Business Center, Google Ads all
   support this), or API tokens scoped per person. This is what the PRD's team-access model already
   assumes. A password that does not exist cannot be stolen.
3. **Stored secret (exception, requires justification).** A shared account with no per-user access
   and no vault option. This tier gets the full treatment in §2–§6.

Enforce the tiering in the data model: a `secret_tier` column, and a stored secret requires a
recorded `justification` and an `approved_by`. That turns "we store passwords" from a default into a
decision someone signed for.

---

## 2. Envelope encryption — kill the single-key blast radius

Replace one global key with a two-level scheme, which is how AWS KMS, Google Cloud KMS and
HashiCorp Vault all work internally:

```
  Master key (KEK)  ──derives──▶  per-record data key (DEK)  ──encrypts──▶  the secret
  runtime-only,                    random 32 bytes,                          AES-256-GCM
  never in the DB                  wrapped and stored beside the ciphertext
```

Concretely, per secret row:

| Column | Content |
|---|---|
| `dek_wrapped` | the record's data key, itself encrypted with the master key |
| `dek_wrap_iv`, `dek_wrap_tag` | GCM parameters for unwrapping |
| `ciphertext`, `iv`, `tag` | the secret, encrypted with the unwrapped DEK |
| `key_version` | which master key generation wrapped this DEK |
| `aad_context` | authenticated additional data — see below |

Why this is materially better:

- **Rotation becomes cheap.** Rotating the master key means re-wrapping N small DEKs, not
  re-encrypting and re-writing every secret. Rotation stops being theoretical.
- **`key_version` makes rotation online.** Old and new master keys coexist; records migrate lazily
  on next access. No downtime, no big-bang migration.
- **AAD binds the ciphertext to its row.** Pass `company_id:record_id:field` as GCM additional
  authenticated data. Copying a ciphertext from one row into another — a real privilege-escalation
  trick — then fails authentication instead of decrypting.

Everything here is `node:crypto` (`createCipheriv('aes-256-gcm')`, `hkdfSync`, `randomBytes`). No new
dependency.

---

## 3. Where the master key lives

Ranked, best first:

1. **A real KMS** — AWS KMS, GCP KMS, or Azure Key Vault. The master key never enters the
   application's memory: the app sends the DEK to be wrapped/unwrapped. Even a full server
   compromise with a memory dump yields no master key, and every unwrap is logged on the KMS side,
   outside the reach of an attacker who owns the app server. This is the right answer if the budget
   allows it.
2. **Coolify runtime secret, as today, but hardened** — the key exists only as an environment
   variable at runtime, never in the repo, never in `.env` on a developer machine, never in a
   Docker image layer. Add: a documented rotation procedure, `key_version` support so rotation is
   possible, and a startup assertion that `ENCRYPTION_KEY !== JWT_SECRET` and that the key is 32
   bytes of real entropy (reject a short or repeated-character key outright rather than silently
   accepting a weak one).
3. **Split knowledge / break-glass** — the master key is reconstructed from two shares held by two
   people, needed only for a break-glass restore. Overkill for daily operation, appropriate for a
   disaster-recovery key escrow.

Non-negotiable regardless of tier: **the key must never be recoverable from a database backup.**
The current backup route dumps `asset_assignments`; with envelope encryption a backup contains only
wrapped DEKs and ciphertext, which are useless without the master key held elsewhere. That single
property is the main reason to build this.

---

## 4. Make reveal expensive, visible and bounded

Encryption protects the database. It does nothing against a legitimate account being misused — which
is the more likely breach. So the reveal path needs its own controls:

- **Admin only, never `hr_manager`.** Reading a platform password is not an HR function. Narrow the
  role today; it costs nothing.
- **Log every reveal, always.** Who, which record, when, from which IP, and *why* — a mandatory
  free-text reason. Write it to `audit_logs` before the plaintext is produced, so a failed or
  interrupted attempt is still recorded. An unloggable reveal must fail closed.
- **Rate-limit per user, not per IP.** Something like 5 reveals per hour. A credential dump needs
  hundreds of requests; a legitimate admin needs two or three. This one control turns a silent mass
  exfiltration into an obvious, throttled, fully-logged event.
- **Notify out of band.** Every reveal emails the admin group. An attacker using a stolen session
  cannot suppress a notification that has already left the system.
- **Step-up authentication.** Require the password or a TOTP code again for the reveal action
  specifically, even inside a valid session. This is what breaks the stolen-session attack.
- **Copy, don't display.** Return the plaintext to a clipboard action with a short TTL rather than
  rendering it on screen — no screenshot, no shoulder-surf, no value sitting in the DOM.
- **Alert on the pattern, not the event.** One reveal is normal. Ten in an hour, a first-ever reveal
  by an account, or any reveal outside working hours is the signal worth paging on.

---

## 5. Keep plaintext out of everything that persists

The most common real-world leak is not broken crypto — it is a secret written somewhere nobody
thought about:

- **Never log the request body** on any route that accepts a password. Add an explicit field
  redaction list to the logger.
- **Never put a secret in a URL or query string.** URLs land in access logs, proxy logs and browser
  history. Reveal must be a `POST`, not a `GET` — the current `GET /assets/:id/reveal-password` is
  wrong on this point alone.
- **`Cache-Control: no-store`** on any response carrying a plaintext secret.
- **Exclude secret columns from the backup route**, or ship them encrypted-only and document that
  restoring requires the KMS.
- **Zero the buffer after use** where practical, and never interpolate a secret into an error
  message or a stack trace.
- **Keep the existing `stripSecrets()` discipline** and extend it to every new table. A list
  endpoint should return `has_password: true`, never the ciphertext — the current code gets this
  right and it should stay a hard rule.

---

## 6. The parts that are not cryptography

- **Rotate on people leaving.** Offboarding must force rotation of every shared credential the
  person could read. A password known to a former employee is compromised regardless of how well the
  database is encrypted. This ties directly into the PRD's offboarding revoke checklist.
- **Rotate on suspicion, and rehearse it.** A rotation procedure that has never been executed does
  not work. Test it on a schedule.
- **2FA on the upstream platform.** A stolen password for an account with mandatory 2FA is much less
  useful. The PRD already requires this (social governance rule 5) — the system should track and
  report the exceptions, which is Phase 4 of the assets plan.
- **Least privilege on the database user.** The application's MySQL account should not be able to
  read the tables it does not need, and secret tables deserve their own restricted grants.

---

## 7. Recommended implementation order

| Step | Change | Cost | Why first |
|---|---|---|---|
| 1 | `vault_secret_reference` on all new digital/social records; make reference-only the default | Small | Removes the exposure instead of managing it — the PRD's own answer |
| 2 | Reveal hardening: admin-only, `POST`, mandatory reason, audit row written first, per-user rate limit, no-store | Small | Biggest risk reduction per hour of work; the likely breach is account misuse, not broken AES |
| 3 | Startup assertions on key strength and key/JWT separation | Tiny | Catches a misconfigured deployment before it stores anything |
| 4 | Envelope encryption with `key_version` + AAD, migrating existing rows lazily | Medium | Makes rotation possible and neutralises database backups |
| 5 | Out-of-band notification + step-up auth on reveal | Medium | Defeats the stolen-session attack |
| 6 | KMS-held master key | Larger | The strongest form of step 4; do it when the platform choice is made |

Steps 1–3 are worth doing regardless of every other decision, and none of them requires touching the
existing ciphertext.

---

## 8. What I would not do

- **Do not hash instead of encrypt.** Hashing is right for *verifying* a password (which is what
  `users.password_hash` does) and useless for *retrieving* one. These credentials must be readable,
  so they must be encrypted, not hashed. Anyone proposing bcrypt here has confused the two problems.
- **Do not roll a custom cipher or mode.** AES-256-GCM via `node:crypto` is correct. ECB, CBC
  without a MAC, or anything hand-written is a downgrade.
- **Do not reuse an IV, ever.** GCM with a repeated IV under the same key leaks the plaintext
  relationship and can forge tags. `randomBytes(12)` per encryption, no exceptions — worth an
  explicit test.
- **Do not store the master key in the database, the repo, the image, or a committed `.env`.** This
  is the single mistake that makes every other control worthless.
