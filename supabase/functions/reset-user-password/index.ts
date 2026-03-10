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

    const { authUserId, newPassword } = await req.json()
    if (!authUserId || !newPassword) throw new Error('authUserId and newPassword are required')
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters')

    const { error } = await supabaseAdmin.auth.admin.updateUser(authUserId, {
      password: newPassword,
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
