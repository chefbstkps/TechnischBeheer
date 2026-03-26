// Edge Function: login via direct DB (workaround als PostgREST /rpc/login_user 404 geeft)
import postgres from 'npm:postgres@3.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let username: string;
  let password: string;
  let ip: string | null = null;
  let user_agent: string | null = null;
  let force_takeover = false;

  try {
    const body = await req.json();
    username = typeof body?.username === 'string' ? body.username.trim() : '';
    password = typeof body?.password === 'string' ? body.password : '';
    if (body?.ip != null) ip = String(body.ip);
    if (body?.user_agent != null) user_agent = String(body.user_agent);
    force_takeover = body?.force_takeover === true;
  } catch {
    return new Response(JSON.stringify({ error: 'Ongeldige body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Gebruikersnaam en wachtwoord verplicht' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL not set');
    return new Response(JSON.stringify({ error: 'Server configuratie fout' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const sql = postgres(dbUrl, { prepare: false });
    const rows =
      await sql`SELECT * FROM public.login_user(${username}, ${password}, ${ip}, ${user_agent}, ${force_takeover})`;
    await sql.end();

    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || !row.id) {
      return new Response(JSON.stringify({ error: 'Ongeldige gebruikersnaam of wachtwoord' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(row), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('auth-login error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Login mislukt' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
