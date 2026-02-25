// ============================================================
// Google Apps Script - 営業データ記録
// Webhook受信 → Googleスプレッドシートに記録
// ============================================================

const SHEET_ID = 'あなたのスプレッドシートID'; // スプレッドシートのIDを入力
const SECRET = 'origin-webhook-secret-2025'; // Supabaseと同じ値

/**
 * Supabase Edge Function から呼ばれるWebhook
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // 認証チェック
    if (data.secret !== SECRET) {
      return ContentService
        .createTextOutput('Unauthorized')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // 処理の種類によって分岐
    if (data.type === 'sales_report') {
      logSalesReport(data);
    } else if (data.type === 'activity_log') {
      logActivity(data);
    } else if (data.type === 'invitation') {
      sendInvitationEmail(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 営業データをスプレッドシートに記録
 */
function logSalesReport(data) {
  const sheet = getOrCreateSheet('営業データ');
  
  // ヘッダーが無い場合は追加
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      '日時',
      '報告日',
      '名前',
      '稼働時間',
      '訪問数',
      '主権対面',
      '対面',
      '商談',
      'アポイント',
      '成約',
      '獲得案件',
      'エリア',
      '組織ID',
      'ユーザーID'
    ]);
    
    // ヘッダー行に色を付ける
    const headerRange = sheet.getRange(1, 1, 1, 14);
    headerRange.setBackground('#e8ff47');
    headerRange.setFontWeight('bold');
  }
  
  const report = data.data;
  
  sheet.appendRow([
    new Date(),
    report.report_date,
    data.user,
    report.working_hours,
    report.visits,
    report.primary_face_to_face,
    report.face_to_face,
    report.meetings,
    report.appointments,
    report.contracts,
    report.acquired_projects,
    report.area,
    report.organization_id,
    report.user_id
  ]);
  
  // 最新行に軽い色付け
  const lastRow = sheet.getLastRow();
  const dataRange = sheet.getRange(lastRow, 1, 1, 14);
  
  // 成約数が1以上なら緑色でハイライト
  if (report.contracts > 0) {
    dataRange.setBackground('#d4edda');
  }
}

/**
 * アクティビティログ記録
 */
function logActivity(data) {
  const sheet = getOrCreateSheet('アクティビティログ');
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['日時', '操作', '実行者', '対象', 'メタデータ']);
    const headerRange = sheet.getRange(1, 1, 1, 5);
    headerRange.setBackground('#47c2ff');
    headerRange.setFontWeight('bold');
  }
  
  sheet.appendRow([
    new Date(),
    data.action,
    data.actorName || '-',
    data.targetEmail || data.targetName || '-',
    JSON.stringify(data.metadata || {})
  ]);
}

/**
 * 招待メール送信
 */
function sendInvitationEmail(data) {
  const subject = `[ORIGIN] ${data.inviterName}さんからチームへの招待が届きました`;
  const htmlBody = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
      <h2 style="color:#333;">チームへのご招待</h2>
      <p><strong>${data.inviterName}</strong>さんが、ORIGINポータルへ招待しています。</p>
      <p>参加ロール：<strong>${data.role}</strong></p>
      <div style="margin:24px 0;">
        <a href="${data.inviteUrl}"
           style="background:#e8ff47;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
          招待を承認して登録する →
        </a>
      </div>
      <p style="color:#999;font-size:12px;">このURLの有効期限は${data.expiresIn || '72時間'}です。</p>
    </div>
  `;

  GmailApp.sendEmail(data.to, subject, '', {
    htmlBody: htmlBody,
    name: 'ORIGIN Portal'
  });
  
  // 招待履歴もスプレッドシートに記録
  const sheet = getOrCreateSheet('招待履歴');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['送信日時', '招待先', 'ロール', '招待者', '有効期限']);
    sheet.getRange(1, 1, 1, 5).setBackground('#a78bfa').setFontWeight('bold');
  }
  sheet.appendRow([
    new Date(),
    data.to,
    data.role,
    data.inviterName,
    data.expiresIn || '72時間'
  ]);
}

/**
 * シート取得または作成
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  return sheet;
}

/**
 * スプレッドシート → Supabase 逆同期（オプション）
 * 
 * スプレッドシートに直接入力したデータをSupabaseに送る場合
 * トリガー設定: 編集時に実行
 */
function syncToSupabase(e) {
  // この機能は必要に応じて実装
  // 例：スプレッドシートで手動修正したデータをDBに反映
}

/**
 * 日次集計レポート生成（オプション）
 * 
 * トリガー設定: 毎日午前9時に実行
 */
function generateDailyReport() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('営業データ');
  if (!sheet) return;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = Utilities.formatDate(yesterday, 'Asia/Tokyo', 'yyyy-MM-dd');
  
  // 昨日のデータを集計
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const reportDateCol = headers.indexOf('報告日');
  const nameCol = headers.indexOf('名前');
  const contractsCol = headers.indexOf('成約');
  
  const dailyStats = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[reportDateCol] === yesterdayStr) {
      const name = row[nameCol];
      if (!dailyStats[name]) {
        dailyStats[name] = { contracts: 0 };
      }
      dailyStats[name].contracts += row[contractsCol] || 0;
    }
  }
  
  // レポートシートに書き込み
  const reportSheet = getOrCreateSheet('日次サマリー');
  if (reportSheet.getLastRow() === 0) {
    reportSheet.appendRow(['日付', '名前', '成約数']);
  }
  
  for (const [name, stats] of Object.entries(dailyStats)) {
    reportSheet.appendRow([yesterdayStr, name, stats.contracts]);
  }
}
