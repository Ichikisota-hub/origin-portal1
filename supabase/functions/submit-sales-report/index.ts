import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // JWT検証
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // リクエストボディ
    const {
      working_hours,
      visits,
      primary_face_to_face,
      face_to_face,
      meetings,
      appointments,
      contracts,
      acquired_projects,
      area,
      report_date,
    } = await req.json()

    // ユーザープロフィール取得
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, full_name')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // データ挿入
    const { data: report, error: insertError } = await supabase
      .from('sales_reports')
      .insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        name: profile.full_name,
        working_hours: working_hours || 0,
        visits: visits || 0,
        primary_face_to_face: primary_face_to_face || 0,
        face_to_face: face_to_face || 0,
        meetings: meetings || 0,
        appointments: appointments || 0,
        contracts: contracts || 0,
        acquired_projects: acquired_projects || 0,
        area: area || null,
        report_date: report_date || new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (insertError) throw insertError

    // アクティビティログ記録
    await supabase.from('activity_logs').insert({
      organization_id: profile.organization_id,
      actor_id: user.id,
      action: 'sales_report.submitted',
      target_id: report.id,
      metadata: { visits, contracts, area },
    })

    // GAS Webhookに送信（オプション）
    const GAS_URL = Deno.env.get('GAS_WEBHOOK_URL')
    if (GAS_URL) {
      await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: Deno.env.get('GAS_SECRET'),
          type: 'sales_report',
          user: profile.full_name,
          data: report,
        }),
      }).catch(() => {}) // エラーは無視
    }

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
