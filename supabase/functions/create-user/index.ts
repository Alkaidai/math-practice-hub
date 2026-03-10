import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Check if bootstrap mode (no admin with auth exists yet)
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .not('auth_user_id', 'is', null)

    const isBootstrap = (count ?? 0) === 0

    if (!isBootstrap) {
      // Verify caller is admin
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) throw new Error('Authorization required')

      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user: caller } } = await userClient.auth.getUser()
      if (!caller) throw new Error('Not authenticated')

      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('auth_user_id', caller.id)
        .maybeSingle()

      if (!callerProfile || (callerProfile as any).role !== 'admin') {
        throw new Error('Admin access required')
      }
    }

    const { email, password, name, role, gradeLevel } = await req.json()
    if (!email || !password) throw new Error('Email and password are required')

    // Create auth user (auto-confirmed so admin-created users can log in immediately)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (authError) throw authError

    const username = name || email.split('@')[0]

    // Check if profile with same username already exists (migration case)
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) {
      // Update existing profile to link with auth
      await supabaseAdmin.from('profiles').update({
        auth_user_id: authData.user.id,
        email,
        name: name || '',
        password: '',
      }).eq('id', (existing as any).id)
    } else {
      // Create new profile
      await supabaseAdmin.from('profiles').insert({
        id: authData.user.id,
        auth_user_id: authData.user.id,
        username,
        email,
        name: name || '',
        password: '',
        role: role || 'student',
        status: 'active',
        grade_level: gradeLevel || null,
        login_count: 0,
      })
    }

    return new Response(
      JSON.stringify({ success: true, userId: authData.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
