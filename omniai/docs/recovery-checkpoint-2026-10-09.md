# OmniAI recovery checkpoint

Recorded: October 9, 2026 (EDT). Database restore tested October 8; app relay and persistence tested October 9.

## Scope and safety

The database recovery exercise used an isolated local Docker container and a cloned service-initialized baseline. It did not restore into hosted Supabase or modify live application data. Preserve the original backup files and saved baseline. Do not repeat the import into the already-restored working database. Do not commit SQL data dumps, secrets, environment files, or temporary .bak files.

## Environment

- Repository: darkmisfit13/pilot-app.
- Application and Vercel root directory: pilot-app2.
- User confirmed latest work merged into main and deployed. Deployed commit was not independently compared during this session.
- Hosted Supabase project: OmniAI Pilot; previously inspected as ACTIVE_HEALTHY.
- Restore image: public.ecr.aws/supabase/postgres:17.6.1.171.
- Working clone volume: omniai-restore-baseline-20261008-213249.
- Test container: omniai-restore-baseline-db.
- Backup folder: supabase-caceyepfqgbgjbvvmvzd-20261008-190803.
- Container isolation verified: running, network none, no published ports.

## Tested restore procedure

These notes describe the completed exercise, not a bootstrap script. A future test requires a fresh writable clone of the preserved compatible service-initialized baseline.

1. Verify PG_VERSION is 17.
2. Start PostgreSQL as the container's postgres user, using the image configuration directory /etc/postgresql, with data_directory=/var/lib/postgresql/data, unix_socket_directories=/tmp, and listen_addresses empty. Mount only the working clone read-write.
3. Check readiness and verify auth.audit_log_entries includes ip_address. Confirm supabase_realtime_admin already exists.
4. As database role supabase_admin, run GRANT SET ON PARAMETER log_min_messages TO postgres WITH GRANT OPTION. This prerequisite changes only the test clone and is outside the restore transaction.
5. As container root, create /restore-input; copy roles.sql, schema.sql, history_schema.sql, data.sql, and history_data.sql into it. Set ownership to postgres and verify each file is readable by that user.
6. Run the import as postgres using the command below. Stop on any nonzero exit code and investigate the first error.

```powershell
docker exec --user postgres omniai-restore-baseline-db psql `
    -X -h /tmp -U postgres -d postgres `
    --single-transaction `
    --set=ON_ERROR_STOP=1 `
    --file=/restore-input/roles.sql `
    --file=/restore-input/schema.sql `
    --file=/restore-input/history_schema.sql `
    --command="SET session_replication_role = replica" `
    --file=/restore-input/data.sql `
    --file=/restore-input/history_data.sql
```

Import completed with exit code 0. Warnings reported that no privileges were granted for multiple vector-extension functions; effective permissions still need separate validation.

## Verified restored contents

| Table | Rows |
|---|---:|
| public.allowed_actions | 4 |
| public.approval_queue | 4 |
| public.audit_log | 4 |
| public.brand_memory | 0 |
| public.conversations | 1 |
| public.messages | 340 |
| public.persona | 1 |
| public.providers | 4 |
| public.spend_tracking | 1 |
| supabase_migrations.schema_migrations | 4 |
| auth.users | 1 |
| auth.identities | 1 |
| storage.buckets | 0 |
| storage.objects | 0 |

Extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1, vector 0.8.2.

All nine public application tables had RLS enabled and RLS force disabled. Nine authenticated policies were present. Eight restricted access to the designated owner; conversations additionally required owner_id to match auth.uid().

A transaction-local authenticated-role test simulated the owner and a different identity. The owner saw 340 messages and one conversation; the other identity saw zero of each. The test ended with ROLLBACK and exit code 0. This verified SELECT access for those two tables, not write-policy security.

## Hosted migration history inspected

- 20261008000955: local_ai_private_relay
- 20261008041924: restrict_pilot_tables_to_verified_owner
- 20261008043308: add_owner_conversation_threads
- 20261008093134: add_message_answer_metadata

Corresponding migration filenames were shown in the feature-branch diff. SQL contents were not independently compared with hosted migrations.

## Laptop model and hosted relay smoke test

- Ollama /api/tags listed llama3.2:latest.
- Direct /api/generate returned the requested test response with done=true.
- Local OmniAI at localhost:3000 displayed Local — ollama (llama3.2). Its message and answer persisted after refresh.
- An earlier hosted request fell back to Groq with No ready laptop agent was found. The underlying cause was not established.
- A subsequent hosted-tab request displayed Local — ollama (llama3.2) without the cloud-fallback notice.
- User confirmed the hosted message, answer, and Local/Ollama label persisted after refresh.
- Keep the local development server running and the local app open with Laptop Link Ready while using the tested laptop route. No public Ollama exposure was required for these tests.

## Remaining validation

- Long-running relay reliability and disconnect/reconnect behavior.
- Vector-function effective permissions and relevant application operations.
- Write-policy tests and runtime access checks on the other tables.
- Exact backup/source content comparison; current counts alone do not prove equality.
- Full recovery-environment Auth login, API configuration, functions, external credentials, and any separate Storage files. Live-app smoke tests do not prove those services were recovered into the isolated database environment.
- Independent deployed-commit comparison and review of deployment environment configuration.

## Local synchronization after this documentation commit

This remote documentation commit does not update the laptop checkout automatically. Fetch and inspect Git status before updating the local main branch; do not blindly pull main into a feature branch or use destructive reset/clean commands.

## Application-root and maintenance update — October 9, 2026

During subsequent local cleanup, the project owner checked Vercel and
reported that the current Root Directory is `omniai`, not `pilot-app2`.
The earlier Environment section records the root reported during the
recovery session and should be read as historical information.

The active local application is `omniai/` relative to the repository root.
The tracked `pilot-app2/` directory remains a legacy source copy pending
reviewed removal.

Frontend maintenance repair commit:
`f42c9de Disable website approval controls during security maintenance`.

The local production build passed compilation, linting, and type checking.
The project owner reported passing browser checks for the Website and
Approvals maintenance screens, chat history/input, and disabled pending
draft submission controls, with no errors.

The local website Edge Function source remains disabled pending
authorization and approval security repairs. This update does not verify
the currently deployed Supabase function version or deployed Git commit.

These frontend checks do not expand the scope of the earlier database
recovery or policy tests. Existing recovery limitations remain applicable.

## Legacy application removal — October 9, 2026

The tracked `pilot-app2/` directory was removed during subsequent repository
cleanup. Before removal, repository checks reported no untracked or ignored
files inside it, and references outside it were limited to documentation.

The active application remains `omniai/`. The project owner previously
reported that Vercel's Root Directory is `omniai`.

The legacy source remains in Git history. Do not restore its website
execution implementation to bypass the active maintenance restriction.

This folder cleanup does not deploy Edge Functions, apply database
migrations, or verify hosted backend state.