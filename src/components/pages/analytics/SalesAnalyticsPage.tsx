import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
interface SalesData {
  total: {
    working_hours: number
    visits: number
    primary_face_to_face: number
    face_to_face: number
    meetings: number
    appointments: number
    contracts: number
    acquired_projects: number
  }
  by_user: Record<string, any>
  by_date: Record<string, any>
  by_area: Record<string, number>
}

export function SalesAnalyticsPage() {
  const [data, setData] = useState<SalesData | null>(null)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week')
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    checkPermission()
  }, [])

  useEffect(() => {
    if (userRole && ['creator', 'admin'].includes(userRole)) {
      fetchAnalytics()
    }
  }, [period, userRole])

  async function checkPermission() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    setUserRole(profile?.role || '')
  }

  async function fetchAnalytics() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-sales-analytics?period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )
      const result = await res.json()
      if (result.success) {
        setData(result.aggregated)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  // 権限チェック
  if (!['creator', 'admin'].includes(userRole)) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#08090d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#eef0f7'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ 
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '24px',
            letterSpacing: '0.12em',
            color: '#eef0f7',
            marginBottom: '8px'
          }}>
            ACCESS DENIED
          </h2>
          <p style={{ fontSize: '12px', color: '#818899' }}>
            この機能はAdmin以上の権限が必要です
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#08090d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ 
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          color: '#818899',
          letterSpacing: '0.15em'
        }}>
          LOADING...
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div style={{ minHeight: '100vh', background: '#08090d', color: '#eef0f7' }}>
      {/* Topbar */}
      <div style={{
        height: '52px',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        background: 'rgba(8,9,13,0.92)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '19px',
          letterSpacing: '0.12em',
          color: '#eef0f7'
        }}>
          SALES ANALYTICS
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            style={{
              background: '#161a22',
              border: '1px solid rgba(255,255,255,0.055)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#eef0f7',
              fontSize: '11px',
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="week">過去7日間</option>
            <option value="month">過去30日間</option>
            <option value="year">過去1年間</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 28px' }}>
        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <StatCard 
            title="総稼働時間" 
            value={`${data.total.working_hours.toFixed(1)}h`}
            icon="⏱"
            color="accent"
          />
          <StatCard 
            title="訪問数" 
            value={data.total.visits}
            icon="🚶"
            color="blue"
          />
          <StatCard 
            title="商談数" 
            value={data.total.meetings}
            icon="💼"
            color="purple"
          />
          <StatCard 
            title="成約数" 
            value={data.total.contracts}
            icon="✓"
            color="green"
          />
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
          {/* 対面活動 */}
          <div style={{
            background: '#0f1117',
            border: '1px solid rgba(255,255,255,0.055)',
            borderRadius: '11px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.055)',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '12.5px',
              letterSpacing: '0.14em',
              color: '#818899'
            }}>
              対面活動
            </div>
            <div style={{ padding: '16px 18px' }}>
              <MetricRow label="主権対面" value={data.total.primary_face_to_face} />
              <MetricRow label="対面" value={data.total.face_to_face} />
            </div>
          </div>

          {/* 営業成果 */}
          <div style={{
            background: '#0f1117',
            border: '1px solid rgba(255,255,255,0.055)',
            borderRadius: '11px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.055)',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '12.5px',
              letterSpacing: '0.14em',
              color: '#818899'
            }}>
              営業成果
            </div>
            <div style={{ padding: '16px 18px' }}>
              <MetricRow label="アポイント獲得" value={data.total.appointments} />
              <MetricRow label="獲得案件" value={data.total.acquired_projects} />
            </div>
          </div>
        </div>

        {/* Member Performance Table */}
        <div style={{
          background: '#0f1117',
          border: '1px solid rgba(255,255,255,0.055)',
          borderRadius: '11px',
          overflow: 'hidden',
          marginBottom: '14px'
        }}>
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.055)',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '12.5px',
            letterSpacing: '0.14em',
            color: '#818899'
          }}>
            メンバー別パフォーマンス
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
                <th style={thStyle}>名前</th>
                <th style={thStyle}>稼働時間</th>
                <th style={thStyle}>訪問</th>
                <th style={thStyle}>商談</th>
                <th style={thStyle}>アポ</th>
                <th style={thStyle}>成約</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.by_user).map(([name, stats]: [string, any]) => (
                <tr key={name} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(232,255,71,0.1)',
                        border: '1px solid rgba(232,255,71,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '10.5px',
                        color: '#e8ff47'
                      }}>
                        {name.slice(0, 2)}
                      </div>
                      <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#eef0f7' }}>
                        {name}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>{stats.working_hours.toFixed(1)}h</td>
                  <td style={tdStyle}>{stats.visits}</td>
                  <td style={tdStyle}>{stats.meetings}</td>
                  <td style={tdStyle}>{stats.appointments}</td>
                  <td style={{...tdStyle, color: '#4ade80', fontWeight: 700}}>{stats.contracts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Area Performance */}
        {Object.keys(data.by_area).length > 0 && (
          <div style={{
            background: '#0f1117',
            border: '1px solid rgba(255,255,255,0.055)',
            borderRadius: '11px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.055)',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '12.5px',
              letterSpacing: '0.14em',
              color: '#818899'
            }}>
              エリア別成約数
            </div>
            <div style={{
              padding: '16px 18px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '10px'
            }}>
              {Object.entries(data.by_area).map(([area, count]) => (
                <div key={area} style={{
                  background: '#161a22',
                  border: '1px solid rgba(255,255,255,0.055)',
                  borderRadius: '8px',
                  padding: '10px 12px'
                }}>
                  <div style={{
                    fontSize: '9.5px',
                    color: '#818899',
                    marginBottom: '4px'
                  }}>
                    {area}
                  </div>
                  <div style={{
                    fontSize: '24px',
                    fontFamily: "'Bebas Neue', sans-serif",
                    letterSpacing: '0.04em',
                    color: '#47c2ff'
                  }}>
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({ title, value, icon, color }: {
  title: string
  value: string | number
  icon: string
  color: 'accent' | 'blue' | 'purple' | 'green'
}) {
  const colors = {
    accent: { bg: 'rgba(232,255,71,0.04)', border: 'rgba(255,255,255,0.055)', text: '#e8ff47', glow: '#e8ff47' },
    blue: { bg: 'rgba(71,194,255,0.04)', border: 'rgba(255,255,255,0.055)', text: '#47c2ff', glow: '#47c2ff' },
    purple: { bg: 'rgba(167,139,250,0.04)', border: 'rgba(255,255,255,0.055)', text: '#a78bfa', glow: '#a78bfa' },
    green: { bg: 'rgba(74,222,128,0.04)', border: 'rgba(255,255,255,0.055)', text: '#4ade80', glow: '#4ade80' },
  }

  const theme = colors[color]

  return (
    <div style={{
      background: theme.bg,
      border: `1px solid ${theme.border}`,
      borderRadius: '11px',
      padding: '16px 18px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.2s'
    }}>
      <div style={{
        position: 'absolute',
        top: '-10px',
        right: '-10px',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: theme.glow,
        filter: 'blur(28px)',
        opacity: 0.13
      }} />
      <div style={{
        fontSize: '8.5px',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: '#818899',
        marginBottom: '7px'
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '42px',
        letterSpacing: '0.04em',
        lineHeight: 1,
        color: theme.text
      }}>
        {value}
      </div>
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '18px',
        fontSize: '32px',
        opacity: 0.15
      }}>
        {icon}
      </div>
    </div>
  )
}

// Metric Row Component
function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.025)'
    }}>
      <span style={{ fontSize: '11.5px', color: '#818899' }}>{label}</span>
      <span style={{
        fontSize: '20px',
        fontFamily: "'Bebas Neue', sans-serif",
        letterSpacing: '0.04em',
        color: '#eef0f7'
      }}>
        {value}
      </span>
    </div>
  )
}

// Table Styles
const thStyle: React.CSSProperties = {
  padding: '9px 18px',
  textAlign: 'left',
  fontSize: '8.5px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#3d4557',
  fontWeight: 400
}

const tdStyle: React.CSSProperties = {
  padding: '11px 18px',
  fontSize: '11.5px',
  color: '#818899'
}
