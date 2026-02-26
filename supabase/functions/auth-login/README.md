# auth-login Edge Function

Wordt gebruikt wanneer PostgREST `/rpc/login_user` een 404 geeft. De app probeert eerst de RPC; bij 404 wordt automatisch deze Edge Function aangeroepen.

## Deployen (Supabase Dashboard of CLI)

**Via Supabase Dashboard:**
1. Ga naar je project → Edge Functions.
2. Nieuwe functie: naam `auth-login`.
3. Plak de code uit `index.ts` en deploy.

**Via CLI (lokaal):**
```bash
supabase functions deploy auth-login
```

De functie gebruikt de standaard secret `SUPABASE_DB_URL` (wordt door Supabase ingesteld).
