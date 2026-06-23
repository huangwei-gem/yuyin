fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({app_id: 'cli_aab083cfebf8dce7', app_secret: 'vkEtRGulqjNoyFnXuQSnjbzoKxqpcKl8'})
}).then(r => r.json()).then(d => {
  var token = d.tenant_access_token;
  // 上传音频到多维表格的附件字段
  // 需要先有 record_id，使用之前创建的那条 test-003
  var audioBytes = new TextEncoder().encode('fake audio data for testing');
  var form = new FormData();
  form.append('file', new Blob([audioBytes], {type: 'audio/webm'}), 'test-audio.webm');
  
  return fetch('https://open.feishu.cn/open-apis/bitable/v1/apps/E9dCbLvXtawJtNsrhticbE1pnOd/tables/tblRdpIVEQIh97Gs/records/recvnm9kMmnoph/fields/录音/attachments', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + token},
    body: form,
  }).then(r => r.json()).then(d2 => console.log(JSON.stringify(d2, null, 2)));
}).catch(e => console.error(e.message));