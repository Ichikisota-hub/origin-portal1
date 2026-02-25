// ============================================================
// モバイルアプリ用 営業データ送信クライアント
// React Native / Flutter / Swift / Kotlin などから使用
// ============================================================

interface SalesReportData {
  working_hours: number
  visits: number
  primary_face_to_face: number
  face_to_face: number
  meetings: number
  appointments: number
  contracts: number
  acquired_projects: number
  area: string
  report_date?: string // YYYY-MM-DD形式、省略時は今日
}

class SalesReportAPI {
  private supabaseUrl: string
  private anonKey: string
  private accessToken: string | null = null

  constructor(supabaseUrl: string, anonKey: string) {
    this.supabaseUrl = supabaseUrl
    this.anonKey = anonKey
  }

  // ログイン（トークン取得）
  async login(email: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.anonKey,
        },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.access_token) {
        this.accessToken = data.access_token
        return true
      }
      return false
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  // 営業データ送信
  async submitReport(data: SalesReportData): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const res = await fetch(
        `${this.supabaseUrl}/functions/v1/submit-sales-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(data),
        }
      )

      const result = await res.json()
      if (result.success) {
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // 自分のレポート履歴取得
  async getMyReports(limit = 30): Promise<any[]> {
    if (!this.accessToken) return []

    try {
      const res = await fetch(
        `${this.supabaseUrl}/rest/v1/sales_reports?select=*&order=report_date.desc&limit=${limit}`,
        {
          headers: {
            'apikey': this.anonKey,
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      )
      return await res.json()
    } catch (error) {
      console.error('Failed to fetch reports:', error)
      return []
    }
  }
}

// ============================================================
// 使用例（React Native）
// ============================================================

/*
import { useState } from 'react'
import { View, Text, TextInput, Button, Alert } from 'react-native'

const api = new SalesReportAPI(
  'https://your-project.supabase.co',
  'your-anon-key'
)

export default function SalesReportScreen() {
  const [data, setData] = useState({
    working_hours: '',
    visits: '',
    primary_face_to_face: '',
    face_to_face: '',
    meetings: '',
    appointments: '',
    contracts: '',
    acquired_projects: '',
    area: '',
  })

  const handleSubmit = async () => {
    const result = await api.submitReport({
      working_hours: parseFloat(data.working_hours) || 0,
      visits: parseInt(data.visits) || 0,
      primary_face_to_face: parseInt(data.primary_face_to_face) || 0,
      face_to_face: parseInt(data.face_to_face) || 0,
      meetings: parseInt(data.meetings) || 0,
      appointments: parseInt(data.appointments) || 0,
      contracts: parseInt(data.contracts) || 0,
      acquired_projects: parseInt(data.acquired_projects) || 0,
      area: data.area,
    })

    if (result.success) {
      Alert.alert('送信完了', '営業データを送信しました')
      // フォームをリセット
      setData({
        working_hours: '',
        visits: '',
        primary_face_to_face: '',
        face_to_face: '',
        meetings: '',
        appointments: '',
        contracts: '',
        acquired_projects: '',
        area: '',
      })
    } else {
      Alert.alert('エラー', result.error || '送信に失敗しました')
    }
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        営業日報入力
      </Text>
      
      <TextInput
        placeholder="稼働時間（例: 8.5）"
        value={data.working_hours}
        onChangeText={(v) => setData({ ...data, working_hours: v })}
        keyboardType="decimal-pad"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="訪問数"
        value={data.visits}
        onChangeText={(v) => setData({ ...data, visits: v })}
        keyboardType="number-pad"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="主権対面"
        value={data.primary_face_to_face}
        onChangeText={(v) => setData({ ...data, primary_face_to_face: v })}
        keyboardType="number-pad"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="対面"
        value={data.face_to_face}
        onChangeText={(v) => setData({ ...data, face_to_face: v })}
        keyboardType="number-pad"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="商談数"
        value={data.meetings}
        onChangeText={(v) => setData({ ...data, meetings: v })}
        keyboardType="number-pad"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="アポイント獲得数"
        value={data.appointments}
        onChangeText={(v) => setData({ ...data, appointments: v })}
        keyboardType="number-pad"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="成約数"
        value={data.contracts}
        onChangeText={(v) => setData({ ...data, contracts: v })}
        keyboardType="number-pad"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="獲得案件数"
        value={data.acquired_projects}
        onChangeText={(v) => setData({ ...data, acquired_projects: v })}
        keyboardType="number-pad"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="エリア（例: 東京都渋谷区）"
        value={data.area}
        onChangeText={(v) => setData({ ...data, area: v })}
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />
      
      <Button title="送信" onPress={handleSubmit} />
    </View>
  )
}
*/

export default SalesReportAPI
