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

    // 権限確認（Admin以上のみ）
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['creator', 'admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const period = url.searchParams.get('period') || 'week' // week, month, year
    const userId = url.searchParams.get('user_id') // 特定ユーザーに絞る場合

    // 日付範囲計算
    const now = new Date()
    let startDate: Date
    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        break
      default: // week
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // クエリ構築
    let query = supabase
      .from('sales_reports')
      .select(`
        id,
        name,
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
        user_id
      `)
      .gte('report_date', startDate.toISOString().split('T')[0])

    // Creator以外は自組織のみ
    if (profile.role !== 'creator') {
      query = query.eq('organization_id', profile.organization_id)
    }

    // 特定ユーザー指定
    if (userId) {
      query = query.eq('user_id', userId)
    }

    query = query.order('report_date', { ascending: false })

    const { data: reports, error } = await query
    if (error) throw error

    // 集計データ生成
    const aggregated = {
      total: {
        working_hours: 0,
        visits: 0,
        primary_face_to_face: 0,
        face_to_face: 0,
        meetings: 0,
        appointments: 0,
        contracts: 0,
        acquired_projects: 0,
      },
      by_user: {} as Record<string, any>,
      by_date: {} as Record<string, any>,
      by_area: {} as Record<string, number>,
    }

    reports?.forEach(r => {
      // 総計
      aggregated.total.working_hours += Number(r.working_hours || 0)
      aggregated.total.visits += r.visits || 0
      aggregated.total.primary_face_to_face += r.primary_face_to_face || 0
      aggregated.total.face_to_face += r.face_to_face || 0
      aggregated.total.meetings += r.meetings || 0
      aggregated.total.appointments += r.appointments || 0
      aggregated.total.contracts += r.contracts || 0
      aggregated.total.acquired_projects += r.acquired_projects || 0

      // ユーザー別
      const userName = r.name || 'Unknown'
      if (!aggregated.by_user[userName]) {
        aggregated.by_user[userName] = {
          working_hours: 0,
          visits: 0,
          primary_face_to_face: 0,
          face_to_face: 0,
          meetings: 0,
          appointments: 0,
          contracts: 0,
          acquired_projects: 0,
        }
      }
      aggregated.by_user[userName].working_hours += Number(r.working_hours || 0)
      aggregated.by_user[userName].visits += r.visits || 0
      aggregated.by_user[userName].primary_face_to_face += r.primary_face_to_face || 0
      aggregated.by_user[userName].face_to_face += r.face_to_face || 0
      aggregated.by_user[userName].meetings += r.meetings || 0
      aggregated.by_user[userName].appointments += r.appointments || 0
      aggregated.by_user[userName].contracts += r.contracts || 0
      aggregated.by_user[userName].acquired_projects += r.acquired_projects || 0

      // 日付別
      const date = r.report_date
      if (!aggregated.by_date[date]) {
        aggregated.by_date[date] = {
          visits: 0,
          contracts: 0,
          appointments: 0,
        }
      }
      aggregated.by_date[date].visits += r.visits || 0
      aggregated.by_date[date].contracts += r.contracts || 0
      aggregated.by_date[date].appointments += r.appointments || 0

      // エリア別
      if (r.area) {
        aggregated.by_area[r.area] = (aggregated.by_area[r.area] || 0) + (r.contracts || 0)
      }
    })

    return new Response(JSON.stringify({
      success: true,
      period,
      start_date: startDate.toISOString().split('T')[0],
      reports,
      aggregated,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
