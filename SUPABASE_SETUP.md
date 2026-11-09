# Supabase setup

Folio keeps its current synchronous local cache and syncs every `folio-*` browser storage record to Supabase. A database trigger creates a profile row in `public.users` when a Supabase Auth account is registered, including when email confirmation is required. Feature records are mirrored into their corresponding account-scoped tables, and `user_app_data` retains the full records and app preferences. Visitors must register or sign in on `auth.html` before the app opens; existing local browser data is uploaded after authentication.

## Configure the project

1. Create a Supabase project.
2. In **Authentication → Sign In / Providers**, enable **Email** sign-in and set the minimum password length to 8 or less. Configure email confirmation to match how you want registration to work.
3. Open **SQL Editor** and run [`supabase-schema.sql`](./supabase-schema.sql) to create any missing tables, install the profile trigger, backfill existing Auth accounts, and apply row-level security. You can safely rerun the updated script after schema changes.
4. Copy the Project URL and the publishable key (or legacy anon key) into [`supabase-config.js`](./supabase-config.js), replacing the placeholders. Never use the `service_role` key in this frontend.
5. Serve the app over HTTP(S), such as with VS Code Live Server. Supabase sync starts when the pages load; local changes are saved immediately and sent to the cloud in the background.

On first sync after registration, existing local values seed cloud keys that are not present yet. Existing cloud values take precedence for matching keys. Signing into the same account on another device retrieves that account's cloud data. Data created in an older anonymous session is not attached to a registered account, but the local copy in that browser is uploaded when you register or sign in there.
