const TK='auth:tokens';
const D1_SESSION_COOKIE='hf_admin_session', D1_SESSION_TTL_SECONDS=7*24*60*60, D1_PASSWORD_ITERATIONS=100000;
const SESSION_COOKIE='hrs_session', SESSION_TTL=7*24*60*60;
const CHUNK=10*1024*1024, MAX_CHUNK=60*1024*1024, ALIGN=320*1024;

export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (err) { return json({ok:false,error:err?.message||String(err)}, Number(err?.status)||500); }
  }
};

async function route(request, env) {
  const url=new URL(request.url), p=url.pathname;
  if ((p==='/'||p==='/overview'||p==='/upload'||p==='/files') && request.method==='GET') return html(APP);
  if (p==='/health' && request.method==='GET') return json({
    ok:true, service:'onedrive-hrs-bridge', rootFolder:env.ROOT_FOLDER||'HRS',
    accessKeyConfigured:!!env.ACCESS_KEY,
    microsoftConfigured:!!(env.MS_CLIENT_ID&&env.MS_CLIENT_SECRET),
    stateConfigured:!!env.STATE, chunkSize:CHUNK
  });
  if (p==='/auth/callback' && request.method==='GET') return oauthCallback(request,env);
  if (p==='/login' && request.method==='POST') return login(request,env);
  if (p==='/logout' && request.method==='POST') return logout(request,env);
  if (p.startsWith('/d/') && request.method==='GET') return download(request,env,p.slice(3));
  if (p==='/api/auth/status' && request.method==='GET') return d1AuthStatus(request,env);
  if (p==='/api/auth/login' && request.method==='POST') return d1AuthLogin(request,env);
  if (p==='/api/auth/logout' && request.method==='POST') return d1AuthLogout(request,env);

  await requireD1User(request,env);

  if (p==='/api/status' && request.method==='GET') return status(env);
  if (p==='/api/auth/url' && request.method==='POST') { requireSameOrigin(request); return oauthUrl(request,env); }
  if (p==='/api/overview' && request.method==='GET') return overview(env);
  if (p==='/api/files' && request.method==='GET') return listFiles(url,env);
  if (p==='/api/folders' && request.method==='POST') { requireSameOrigin(request); return createFolder(request,env); }
  if (p==='/api/upload/start' && request.method==='POST') { requireSameOrigin(request); return startUpload(request,env); }

  let m=p.match(/^\/api\/upload\/([^/]+)$/);
  if (m && request.method==='PUT') { requireSameOrigin(request); return uploadChunk(request,env,m[1]); }

  m=p.match(/^\/api\/upload\/([^/]+)\/status$/);
  if (m && request.method==='GET') return uploadStatus(env,m[1]);

  m=p.match(/^\/api\/items\/([^/]+)$/);
  if (m && request.method==='DELETE') { requireSameOrigin(request); return deleteItem(env,decodeURIComponent(m[1])); }

  m=p.match(/^\/api\/share\/([^/]+)$/);
  if (m && request.method==='POST') { requireSameOrigin(request); return shareItem(env,decodeURIComponent(m[1])); }

  m=p.match(/^\/api\/download-ticket\/([^/]+)$/);
  if (m && request.method==='POST') { requireSameOrigin(request); return createDownloadTicket(env,decodeURIComponent(m[1])); }

  return json({ok:false,error:'Not found'},404);
}

async function requireAuth(request,env) {
  if (!env.ACCESS_KEY) throw httpError(503,'ACCESS_KEY 尚未設定');
  const bearer=request.headers.get('authorization')||'';
  if (bearer==='Bearer '+env.ACCESS_KEY) return true;

  const raw=getCookie(request,SESSION_COOKIE);
  if (!raw) throw httpError(401,'請先登入');
  const dot=raw.lastIndexOf('.');
  if (dot<1) throw httpError(401,'登入已過期');

  const payload=raw.slice(0,dot), signature=raw.slice(dot+1);
  if (!await verifySession(payload,signature,env.ACCESS_KEY)) throw httpError(401,'登入已過期');

  let data;
  try { data=JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))); }
  catch { throw httpError(401,'登入已過期'); }

  if (!data?.exp || Date.now()>Number(data.exp)) throw httpError(401,'登入已過期');
  return true;
}

async function login(request,env) {
  if (!env.ACCESS_KEY) return Response.redirect(new URL('/?login=not-configured',request.url),303);

  let supplied='';
  const type=request.headers.get('content-type')||'';
  if (type.includes('application/json')) {
    const b=await request.json().catch(()=>({}));
    supplied=String(b.access_key||b.accessKey||'');
  } else {
    const form=await request.formData();
    supplied=String(form.get('access_key')||'');
  }

  if (supplied!==env.ACCESS_KEY) return Response.redirect(new URL('/?login=failed',request.url),303);

  const payload=base64UrlEncode(new TextEncoder().encode(JSON.stringify({exp:Date.now()+SESSION_TTL*1000})));
  const signature=await signSession(payload,env.ACCESS_KEY);
  const cookie=payload+'.'+signature;

  const headers=new Headers({location:'/overview'});
  headers.append('set-cookie',SESSION_COOKIE+'='+cookie+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+SESSION_TTL);
  return new Response(null,{status:303,headers});
}

async function logout(request,env) {
  const headers=new Headers({location:'/'});
  headers.append('set-cookie',SESSION_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
  return new Response(null,{status:303,headers});
}

function getCookie(request,name) {
  const raw=request.headers.get('cookie')||'';
  for (const part of raw.split(';')) {
    const i=part.indexOf('=');
    if (i<0) continue;
    if (part.slice(0,i).trim()===name) return part.slice(i+1).trim();
  }
  return '';
}

function base64UrlEncode(bytes) {
  let raw='';
  for (const b of bytes) raw+=String.fromCharCode(b);
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64UrlDecode(s) {
  s=String(s).replace(/-/g,'+').replace(/_/g,'/');
  while (s.length%4) s+='=';
  const raw=atob(s), out=new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}
async function sessionKey(secret,usage) {
  return crypto.subtle.importKey('raw',new TextEncoder().encode(String(secret)),{name:'HMAC',hash:'SHA-256'},false,[usage]);
}
async function signSession(payload,secret) {
  const key=await sessionKey(secret,'sign');
  const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
  return base64UrlEncode(sig);
}
async function verifySession(payload,signature,secret) {
  try {
    const key=await sessionKey(secret,'verify');
    return await crypto.subtle.verify('HMAC',key,base64UrlDecode(signature),new TextEncoder().encode(payload));
  } catch { return false; }
}


async function d1AuthStatus(request,env){
  if(!env.DB) return json({ok:false,error:'D1_NOT_CONFIGURED'},500);
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role='admin'").first();
  const hasAdmin=Number(count?.n||0)>0;
  const user=hasAdmin?await d1GetUser(request,env):null;
  return json({ok:true,hasAdmin,authenticated:!!user,user:user?d1PublicUser(user):null});
}
async function d1AuthLogin(request,env){
  requireSameOrigin(request);
  if(!env.DB) throw httpError(500,'D1_NOT_CONFIGURED');
  const body=await request.json().catch(()=>({}));
  const username=String(body.username||'').trim();
  const password=String(body.password||'');
  if(!username||!password) throw httpError(400,'請輸入帳號與密碼');
  const user=await env.DB.prepare(
    'SELECT id,username,password_salt,password_hash,password_iterations,role,quota_bytes,enabled FROM admin_users WHERE username = ? COLLATE NOCASE'
  ).bind(username).first();
  let valid=false;
  if(user&&Number(user.enabled)===1){
    const candidate=await d1HashPassword(password,user.password_salt,Number(user.password_iterations||D1_PASSWORD_ITERATIONS));
    valid=d1TimingSafeEqual(candidate,user.password_hash);
  }
  if(!valid) throw httpError(401,'帳號或密碼錯誤，或帳號已停用');
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
  const token=d1RandomHex(32), tokenHash=await d1Sha256Hex(new TextEncoder().encode(token));
  const now=new Date(), exp=new Date(now.getTime()+D1_SESSION_TTL_SECONDS*1000);
  await env.DB.prepare('INSERT INTO admin_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)')
    .bind(tokenHash,user.id,now.toISOString(),exp.toISOString()).run();
  await env.DB.prepare('INSERT INTO admin_audit (user_id,action,target_id,details,created_at) VALUES (?,?,?,?,?)')
    .bind(user.id,'login',user.id,null,new Date().toISOString()).run();
  return d1JsonWithCookie(
    {ok:true,user:d1PublicUser(user)},
    D1_SESSION_COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+D1_SESSION_TTL_SECONDS
  );
}
async function d1AuthLogout(request,env){
  requireSameOrigin(request);
  const token=d1GetCookie(request,D1_SESSION_COOKIE);
  if(token&&env.DB){
    const hash=await d1Sha256Hex(new TextEncoder().encode(token));
    const user=await d1GetUser(request,env);
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(hash).run();
    if(user) await env.DB.prepare('INSERT INTO admin_audit (user_id,action,target_id,details,created_at) VALUES (?,?,?,?,?)')
      .bind(user.id,'logout',user.id,null,new Date().toISOString()).run();
  }
  return d1JsonWithCookie({ok:true},D1_SESSION_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
}
async function requireD1User(request,env){
  const user=await d1GetUser(request,env);
  if(!user) throw httpError(401,'請先登入');
  return user;
}
async function d1GetUser(request,env){
  if(!env.DB) return null;
  const token=d1GetCookie(request,D1_SESSION_COOKIE);
  if(!token) return null;
  const hash=await d1Sha256Hex(new TextEncoder().encode(token));
  const row=await env.DB.prepare(
    'SELECT u.id,u.username,u.role,u.quota_bytes,u.enabled,s.expires_at FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=?'
  ).bind(hash).first();
  if(!row) return null;
  if(row.expires_at<=new Date().toISOString()||Number(row.enabled)!==1){
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(hash).run();
    return null;
  }
  return {id:row.id,username:row.username,role:row.role||'user',quota_bytes:Number(row.quota_bytes||0),enabled:Number(row.enabled)===1};
}
function d1PublicUser(u){return{id:u.id,username:u.username,role:u.role||'user',quotaBytes:Number(u.quota_bytes||0),enabled:Number(u.enabled)!==0}}
function d1GetCookie(request,name){
  const raw=request.headers.get('cookie')||'';
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    if(part.slice(0,i).trim()===name)return part.slice(i+1).trim();
  }
  return '';
}
async function d1HashPassword(password,saltHex,iterations){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:d1HexToBytes(saltHex),iterations},key,256);
  return d1BytesToHex(new Uint8Array(bits));
}
function d1TimingSafeEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
function d1RandomHex(bytes){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return d1BytesToHex(a)}
function d1HexToBytes(hex){const a=new Uint8Array(hex.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(hex.slice(i*2,i*2+2),16);return a}
function d1BytesToHex(a){return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
async function d1Sha256Hex(data){return d1BytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)))}
function d1JsonWithCookie(data,cookie,status=200){
  const h=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  h.append('set-cookie',cookie);return new Response(JSON.stringify(data),{status,headers:h});
}
function requireSameOrigin(request) {
  const origin=request.headers.get('origin');
  if (origin && origin!==new URL(request.url).origin) throw httpError(403,'Origin 不允許');
}
function requireMicrosoftConfig(env) {
  if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET) throw httpError(503,'MS_CLIENT_ID / MS_CLIENT_SECRET 尚未設定');
}
function rootFolder(env){ return String(env.ROOT_FOLDER||'HRS'); }

function cleanName(value) {
  const s=String(value||'').trim();
  if (!s || s==='.' || s==='..' || /[\0-\x1f"*:<>?\\/|]/.test(s) || /[ .]$/.test(s)) {
    throw httpError(400,'名稱包含 OneDrive 不允許的字元');
  }
  if (s.length>240) throw httpError(400,'名稱過長');
  return s;
}
function cleanRelativePath(value) {
  const s=String(value||'').replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
  if (!s) return '';
  const parts=s.split('/');
  if (parts.some(x=>!x||x==='.'||x==='..'||/[\0\r\n]/.test(x))) throw httpError(400,'路徑不合法');
  return parts.map(cleanName).join('/');
}
function encodedPath(env,relative='') {
  return [rootFolder(env),...cleanRelativePath(relative).split('/').filter(Boolean)]
    .map(encodeURIComponent).join('/');
}

async function status(env) {
  const t=env.STATE?await env.STATE.get(TK,'json'):null;
  return json({
    ok:true, rootFolder:rootFolder(env),
    accessKeyConfigured:!!env.ACCESS_KEY,
    microsoftConfigured:!!(env.MS_CLIENT_ID&&env.MS_CLIENT_SECRET),
    connected:!!(t?.access_token||t?.refresh_token),
    chunkSize:CHUNK
  });
}

async function oauthUrl(request,env) {
  requireMicrosoftConfig(env);
  if (!env.STATE) throw httpError(503,'STATE KV 尚未設定');
  const origin=new URL(request.url).origin, state=crypto.randomUUID();
  await env.STATE.put('oauth:'+state,'1',{expirationTtl:600});
  const u=new URL('https://login.microsoftonline.com/'+encodeURIComponent(env.MS_TENANT||'common')+'/oauth2/v2.0/authorize');
  const fields={
    client_id:env.MS_CLIENT_ID,response_type:'code',
    redirect_uri:origin+'/auth/callback',response_mode:'query',
    scope:'offline_access Files.ReadWrite User.Read',state
  };
  for (const [k,v] of Object.entries(fields)) u.searchParams.set(k,v);
  return json({ok:true,url:u.toString(),redirectUri:origin+'/auth/callback'});
}

async function oauthCallback(request,env) {
  requireMicrosoftConfig(env);
  if (!env.STATE) return text('STATE KV not configured',503);
  const u=new URL(request.url), code=u.searchParams.get('code'), state=u.searchParams.get('state');
  if (!code || !state || !await env.STATE.get('oauth:'+state)) return text('Invalid OAuth callback',400);
  await env.STATE.delete('oauth:'+state);
  const q=new URLSearchParams({
    client_id:env.MS_CLIENT_ID,client_secret:env.MS_CLIENT_SECRET,
    grant_type:'authorization_code',code,redirect_uri:u.origin+'/auth/callback',
    scope:'offline_access Files.ReadWrite User.Read'
  });
  const response=await fetch('https://login.microsoftonline.com/'+encodeURIComponent(env.MS_TENANT||'common')+'/oauth2/v2.0/token',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:q
  });
  const token=await responseData(response);
  if (!response.ok) return text(token?.error_description||token?.error||'token error',502);
  token.expires_at=Date.now()+(Number(token.expires_in||3600)-60)*1000;
  await env.STATE.put(TK,JSON.stringify(token));
  await ensureRoot(env,token.access_token);
  return Response.redirect(u.origin+'/?connected=1',302);
}

async function accessToken(env) {
  if (!env.STATE) throw httpError(503,'STATE KV 尚未設定');
  let t=await env.STATE.get(TK,'json');
  if (!t) throw httpError(409,'OneDrive 尚未連接');
  if (t.access_token && Date.now()<Number(t.expires_at||0)) return t.access_token;

  requireMicrosoftConfig(env);
  if (!t.refresh_token) throw httpError(409,'缺少 refresh token，請重新連接 OneDrive');
  const q=new URLSearchParams({
    client_id:env.MS_CLIENT_ID,client_secret:env.MS_CLIENT_SECRET,
    grant_type:'refresh_token',refresh_token:t.refresh_token,
    scope:'offline_access Files.ReadWrite User.Read'
  });
  const response=await fetch('https://login.microsoftonline.com/'+encodeURIComponent(env.MS_TENANT||'common')+'/oauth2/v2.0/token',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:q
  });
  const next=await responseData(response);
  if (!response.ok) throw httpError(502,next?.error_description||next?.error||'refresh token 失敗');
  t={...t,...next,expires_at:Date.now()+(Number(next.expires_in||3600)-60)*1000};
  await env.STATE.put(TK,JSON.stringify(t));
  return t.access_token;
}

async function graph(env,path,init={}) {
  const headers=new Headers(init.headers||{});
  headers.set('authorization','Bearer '+await accessToken(env));
  if (init.body && !headers.has('content-type')) headers.set('content-type','application/json');
  return fetch(path.startsWith('http')?path:'https://graph.microsoft.com/v1.0'+path,{...init,headers});
}

async function ensureRoot(env,knownToken) {
  const name=rootFolder(env), headers={authorization:'Bearer '+(knownToken||await accessToken(env))};
  let response=await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/'+encodeURIComponent(name)+'?$select=id,name,folder',{headers});
  if (response.ok) return response.json();
  if (response.status!==404) throw httpError(response.status,'無法檢查 HRS 根資料夾');

  response=await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children',{
    method:'POST',headers:{...headers,'content-type':'application/json'},
    body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})
  });
  const data=await responseData(response);
  if (!response.ok && response.status!==409) throw httpError(response.status,data?.error?.message||'無法建立 HRS 根資料夾');
  if (response.ok) return data;

  response=await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/'+encodeURIComponent(name)+'?$select=id,name,folder',{headers});
  if (!response.ok) throw httpError(response.status,'HRS 建立後仍無法讀取');
  return response.json();
}

async function getRootItem(env) {
  await ensureRoot(env);
  const response=await graph(env,'/me/drive/root:/'+encodeURIComponent(rootFolder(env))+'?$select=id,name,parentReference,folder');
  const data=await responseData(response);
  if (!response.ok) throw httpError(response.status,data?.error?.message||'無法讀取 HRS');
  return data;
}

async function assertTargetInsideRoot(env,itemId,{allowRoot=false}={}) {
  const [root,response]=await Promise.all([
    getRootItem(env),
    graph(env,'/me/drive/items/'+encodeURIComponent(itemId)+'?$select=id,name,size,parentReference,file,folder,lastModifiedDateTime')
  ]);
  const item=await responseData(response);
  if (!response.ok) throw httpError(response.status,item?.error?.message||'項目不存在');

  if (item.id===root.id) {
    if (allowRoot) return item;
    throw httpError(403,'HRS 根資料夾本身不可刪除');
  }

  const parentPath=String(item.parentReference?.path||'');
  const prefix='/drive/root:/'+rootFolder(env);
  if (!(parentPath===prefix || parentPath.startsWith(prefix+'/'))) {
    throw httpError(403,'此項目不在 HRS 範圍內');
  }
  return item;
}

async function listFiles(url,env) {
  await ensureRoot(env);
  const relative=cleanRelativePath(url.searchParams.get('path')||'');
  let next='https://graph.microsoft.com/v1.0/me/drive/root:/'+encodedPath(env,relative)+':/children?$select=id,name,size,file,folder,lastModifiedDateTime,parentReference&$top=200';
  const items=[];
  while (next && items.length<1000) {
    const response=await graph(env,next), data=await responseData(response);
    if (!response.ok) throw httpError(response.status,data?.error?.message||'無法讀取資料夾');
    for (const x of data.value||[]) {
      items.push({
        id:x.id,name:x.name,size:Number(x.size||0),
        file:!!x.file,folder:!!x.folder,childCount:x.folder?.childCount??null,
        lastModifiedDateTime:x.lastModifiedDateTime
      });
    }
    next=data['@odata.nextLink']||'';
  }
  return json({ok:true,root:rootFolder(env),path:relative,items});
}

async function overview(env) {
  const fake=new URL('https://local/api/files');
  const response=await listFiles(fake,env), data=await response.json(), items=data.items||[];
  return json({
    ok:true,root:rootFolder(env),items:items.length,
    files:items.filter(x=>x.file).length,
    folders:items.filter(x=>x.folder).length,
    bytes:items.reduce((sum,x)=>sum+Number(x.size||0),0)
  });
}

async function createFolder(request,env) {
  const body=await request.json();
  const relative=cleanRelativePath(body.path||''), name=cleanName(body.name);
  await ensureRoot(env);
  const endpoint=relative
    ? '/me/drive/root:/'+encodedPath(env,relative)+':/children'
    : '/me/drive/root:/'+encodeURIComponent(rootFolder(env))+':/children';

  const response=await graph(env,endpoint,{
    method:'POST',
    body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'fail'})
  });
  const data=await responseData(response);
  return json(response.ok?{ok:true,item:data}:{ok:false,error:data?.error?.message||'建立資料夾失敗'},response.status);
}

async function startUpload(request,env) {
  if (!env.STATE) throw httpError(503,'STATE KV 尚未設定');
  const body=await request.json();
  const relative=cleanRelativePath(body.path||''), name=cleanName(body.name), size=Number(body.size);
  if (!Number.isSafeInteger(size)||size<=0) throw httpError(400,'檔案大小不合法');

  await ensureRoot(env);
  const full=encodedPath(env,relative?relative+'/'+name:name);
  const response=await graph(env,'/me/drive/root:/'+full+':/createUploadSession',{
    method:'POST',
    body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'rename',name}})
  });
  const data=await responseData(response);
  if (!response.ok || !data.uploadUrl) throw httpError(response.status,data?.error?.message||'建立上傳工作失敗');

  const uploadId=crypto.randomUUID();
  const expires=Date.parse(data.expirationDateTime||'')||Date.now()+3600000;
  const ttl=Math.max(60,Math.min(86400,Math.floor((expires-Date.now())/1000)));
  await env.STATE.put('up:'+uploadId,JSON.stringify({url:data.uploadUrl,name,size,path:relative,next:0}),{expirationTtl:ttl});
  return json({ok:true,uploadId,chunkSize:CHUNK,expirationDateTime:data.expirationDateTime});
}

function parseRange(value) {
  const m=String(value||'').match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  return m?{start:Number(m[1]),end:Number(m[2]),total:Number(m[3])}:null;
}

async function uploadChunk(request,env,uploadId) {
  if (!env.STATE) throw httpError(503,'STATE KV 尚未設定');
  const session=await env.STATE.get('up:'+uploadId,'json');
  if (!session) throw httpError(404,'上傳工作已過期');

  const r=parseRange(request.headers.get('content-range'));
  if (!r || !request.body) throw httpError(400,'Content-Range 不合法');

  const length=r.end-r.start+1;
  if (r.total!==session.size || r.start<0 || r.end<r.start || r.end>=r.total || length<=0 || length>=MAX_CHUNK) {
    throw httpError(400,'分段範圍不合法');
  }
  if (r.start!==Number(session.next||0)) throw httpError(409,'分段順序錯誤，預期從 '+Number(session.next||0)+' 開始');
  if (r.end<r.total-1 && length%ALIGN!==0) throw httpError(400,'非最後一段必須是 320 KiB 的整數倍');

  const fixed=new FixedLengthStream(length);
  const pump=request.body.pipeTo(fixed.writable);
  const response=await fetch(session.url,{
    method:'PUT',
    headers:{'content-range':request.headers.get('content-range'),'content-type':'application/octet-stream'},
    body:fixed.readable
  });
  await pump;
  const data=await responseData(response);

  if (response.status===200||response.status===201) {
    await env.STATE.delete('up:'+uploadId);
    return json({ok:true,status:response.status,complete:true,item:data},response.status);
  }
  if (response.ok) {
    session.next=r.end+1;
    await env.STATE.put('up:'+uploadId,JSON.stringify(session),{expirationTtl:3600});
  }
  return json({ok:response.ok,status:response.status,complete:false,upstream:data},response.status);
}

async function uploadStatus(env,uploadId) {
  if (!env.STATE) throw httpError(503,'STATE KV 尚未設定');
  const session=await env.STATE.get('up:'+uploadId,'json');
  if (!session) throw httpError(404,'上傳工作已過期');
  const response=await fetch(session.url), data=await responseData(response);
  return json({ok:response.ok,status:response.status,next:Number(session.next||0),session:data},response.status);
}

async function deleteItem(env,itemId) {
  const item=await assertTargetInsideRoot(env,itemId);
  const response=await graph(env,'/me/drive/items/'+encodeURIComponent(item.id),{method:'DELETE'});
  if (response.status!==204) {
    const data=await responseData(response);
    throw httpError(response.status,data?.error?.message||'刪除失敗');
  }
  return json({ok:true,deleted:item.name});
}

async function shareItem(env,itemId) {
  const item=await assertTargetInsideRoot(env,itemId,{allowRoot:true});
  const response=await graph(env,'/me/drive/items/'+encodeURIComponent(item.id)+'/createLink',{
    method:'POST',
    body:JSON.stringify({type:'view',scope:'anonymous'})
  });
  const data=await responseData(response);
  return json(response.ok
    ? {ok:true,item:{id:item.id,name:item.name},link:data.link||null,permissionId:data.id||null}
    : {ok:false,error:data?.error?.message||'建立共用連結失敗',code:data?.error?.code||null},
    response.status);
}

async function createDownloadTicket(env,itemId) {
  if (!env.STATE) throw httpError(503,'STATE KV 尚未設定');
  await assertTargetInsideRoot(env,itemId);
  const ticket=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  await env.STATE.put('dl:'+ticket,JSON.stringify({id:itemId}),{expirationTtl:900});
  return json({ok:true,url:'/d/'+ticket,expiresIn:900});
}

async function download(request,env,ticket) {
  if (!env.STATE) return text('STATE KV not configured',503);
  const record=await env.STATE.get('dl:'+ticket,'json');
  if (!record) return text('下載連結已過期',404);

  let item;
  try { item=await assertTargetInsideRoot(env,record.id); }
  catch (e) { return text(e.message||'Forbidden',Number(e.status)||403); }

  const response=await graph(env,'/me/drive/items/'+encodeURIComponent(item.id)+'?$select=id,name,size,@microsoft.graph.downloadUrl');
  const data=await responseData(response);
  if (!response.ok) return text(data?.error?.message||'Graph error',response.status);

  const headers=new Headers();
  const range=request.headers.get('range'), ifRange=request.headers.get('if-range');
  if (range) headers.set('range',range);
  if (ifRange) headers.set('if-range',ifRange);

  const upstream=await fetch(data['@microsoft.graph.downloadUrl'],{headers,redirect:'follow'});
  const out=new Headers(upstream.headers);
  out.set('cache-control','private, no-store');
  out.set('content-disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(data.name||'download.bin'));
  return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:out});
}

async function responseData(response) {
  const t=await response.text();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return {raw:t}; }
}
function httpError(status,message){const e=new Error(message);e.status=status;return e}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function text(data,status=200){return new Response(String(data),{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})}
function html(data){return new Response(data,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})}

const APP=`<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>HRS Drive</title>
<style>
:root{--bg:#070a12;--panel:rgba(13,19,34,.78);--text:#f7f9ff;--muted:#8792aa;--line:rgba(255,255,255,.09);--line2:rgba(255,255,255,.16);--purple:#8b5cf6;--cyan:#22d3ee;--green:#34d399;--amber:#f59e0b;--red:#fb7185;--sidebar:248px;--radius:20px;--shadow:0 24px 70px rgba(0,0,0,.34);--ease:cubic-bezier(.16,1,.3,1)}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 8%,rgba(139,92,246,.18),transparent 28%),radial-gradient(circle at 86% 14%,rgba(34,211,238,.13),transparent 26%),linear-gradient(180deg,#080b14,#070a12 56%,#090d18);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;-webkit-font-smoothing:antialiased}
body:before,body:after{content:"";position:fixed;z-index:-1;border-radius:999px;filter:blur(95px);opacity:.17;pointer-events:none}body:before{width:38vw;height:38vw;left:-16vw;top:26vh;background:#7c3aed}body:after{width:32vw;height:32vw;right:-12vw;top:55vh;background:#0891b2}
button,input{font:inherit}button{touch-action:manipulation}a{color:inherit;text-decoration:none}[hidden]{display:none!important}
.shell{display:grid;grid-template-columns:var(--sidebar) 1fr;min-height:100vh}.side{position:sticky;top:0;height:100vh;padding:22px 16px;border-right:1px solid var(--line);background:rgba(6,9,17,.72);backdrop-filter:blur(24px)}.brand{display:flex;gap:12px;align-items:center;padding:4px 8px 24px}.logo{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#7c3aed,#2563eb);box-shadow:0 10px 28px rgba(79,70,229,.36);font-weight:900}.brand b{display:block;font-size:17px}.brand span{font-size:12px;color:var(--muted)}.nav{display:grid;gap:8px}.nav a{padding:12px 13px;border:1px solid transparent;border-radius:13px;color:var(--muted);font-weight:730;transition:.2s var(--ease)}.nav a:hover{color:#fff;background:rgba(255,255,255,.045);transform:translateX(2px)}.nav a.on{color:#fff;background:linear-gradient(135deg,rgba(139,92,246,.18),rgba(37,99,235,.12));border-color:rgba(139,92,246,.26)}.sidefoot{position:absolute;left:16px;right:16px;bottom:18px}.pill{padding:10px 12px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.035);font-size:12px;color:var(--muted)}
.main{padding:30px 34px 56px;min-width:0}.top{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;margin-bottom:22px}.eyebrow{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--cyan);font-weight:850}.title{font-size:32px;margin:7px 0}.subtitle{margin:0;color:var(--muted);max-width:720px;line-height:1.6}.toolbar,.actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}.btn{border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-weight:780;cursor:pointer;color:var(--text);background:rgba(255,255,255,.055);transition:.18s var(--ease)}.btn:hover:not(:disabled){transform:translateY(-2px);border-color:var(--line2);box-shadow:0 10px 26px rgba(0,0,0,.22)}.btn:disabled{opacity:.45;cursor:not-allowed}.primary{border-color:transparent;background:linear-gradient(135deg,#7c3aed,#4f46e5 58%,#2563eb)}.danger{color:#fecdd3;background:rgba(244,63,94,.10);border-color:rgba(251,113,133,.18)}.success{color:#b7f7df;background:rgba(16,185,129,.11);border-color:rgba(52,211,153,.2)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.metric,.card{background:linear-gradient(180deg,rgba(18,25,43,.84),rgba(11,16,29,.79));border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);backdrop-filter:blur(20px)}.metric{padding:18px}.metric small{display:block;color:var(--muted);font-weight:720;margin-bottom:10px}.metric strong{font-size:26px}.metric .hint{margin-top:7px;font-size:12px;color:var(--muted)}.card{padding:20px;margin-top:16px}.card h2{margin:0 0 5px;font-size:18px}.card p{color:var(--muted);line-height:1.55}
.drop{border:1px dashed rgba(167,139,250,.42);border-radius:18px;padding:34px 20px;text-align:center;background:linear-gradient(180deg,rgba(139,92,246,.075),rgba(34,211,238,.025));transition:.2s var(--ease);cursor:pointer}.drop.over{border-color:var(--cyan);background:rgba(34,211,238,.07);transform:scale(1.006)}.drop .big{font-size:34px;font-weight:900;letter-spacing:.08em;margin-bottom:8px}.drop b{font-size:17px}.drop span{display:block;color:var(--muted);margin-top:7px}.field{display:grid;gap:7px;margin-top:14px}.field label{font-size:12px;color:var(--muted);font-weight:750}.input{width:100%;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.045);padding:11px 12px;color:#fff;outline:none}.input:focus{border-color:rgba(96,165,250,.58);box-shadow:0 0 0 3px rgba(59,130,246,.12)}.progress{height:10px;border-radius:999px;background:rgba(255,255,255,.065);overflow:hidden;margin-top:15px}.bar{height:100%;width:0;background:linear-gradient(90deg,var(--purple),var(--cyan));transition:width .18s}.progressrow{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:12px;margin-top:8px}
.filetop{display:flex;gap:12px;justify-content:space-between;align-items:center}.crumbs{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:14px 0;color:var(--muted);font-size:13px}.crumbs button{all:unset;cursor:pointer;color:#dbe4f5}.tablewrap{overflow:auto;border:1px solid var(--line);border-radius:15px}.table{width:100%;border-collapse:collapse;min-width:760px}.table th,.table td{padding:12px 13px;border-bottom:1px solid var(--line);text-align:left}.table th{font-size:12px;color:var(--muted);background:rgba(255,255,255,.025)}.table tr:last-child td{border-bottom:0}.table tbody tr:hover{background:rgba(255,255,255,.025)}.namebtn{all:unset;cursor:pointer;font-weight:750;color:#dbe4f5}.actions .mini{padding:7px 9px;border-radius:9px;font-size:12px}.badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:8px 10px;border:1px solid var(--line);background:rgba(255,255,255,.035);font-size:12px;color:var(--muted)}.dot{width:7px;height:7px;border-radius:50%;background:var(--amber)}.ok .dot{background:var(--green)}.err .dot{background:var(--red)}
.toastbox{position:fixed;right:18px;bottom:18px;display:grid;gap:9px;z-index:50}.toast{min-width:240px;max-width:420px;padding:12px 14px;border:1px solid var(--line);border-radius:13px;background:rgba(11,16,29,.96);box-shadow:var(--shadow)}.modalback{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.58);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px}.modal{width:min(520px,100%);border:1px solid var(--line2);border-radius:20px;background:#0d1322;padding:20px;box-shadow:0 30px 90px rgba(0,0,0,.55)}.modal h3{margin:0 0 8px}.modal p{color:var(--muted);line-height:1.6}.modal .row{display:flex;gap:9px;justify-content:flex-end;margin-top:16px}.gate{position:fixed;inset:0;z-index:100;background:radial-gradient(circle at 30% 20%,rgba(139,92,246,.2),transparent 32%),rgba(5,8,15,.97);display:grid;place-items:center;padding:22px}.gatebox{width:min(460px,100%);border:1px solid var(--line2);border-radius:24px;background:rgba(13,19,34,.92);backdrop-filter:blur(24px);padding:26px;box-shadow:0 30px 100px rgba(0,0,0,.5)}.gatebox h1{margin:0 0 8px}.gatebox p{color:var(--muted);line-height:1.6}
@media(max-width:980px){.grid{grid-template-columns:repeat(2,1fr)}.shell{grid-template-columns:1fr}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px;padding:13px 14px}.brand{padding:0}.brand div:last-child{display:none}.nav{display:flex;overflow:auto}.nav a{white-space:nowrap}.sidefoot{display:none}.main{padding:22px 16px 44px}}@media(max-width:620px){.grid{grid-template-columns:1fr}.top{display:block}.toolbar{justify-content:flex-start;margin-top:14px}.title{font-size:27px}.card{padding:16px}.drop{padding:27px 13px}}
</style>
</head>
<body>
<div id="gate" class="gate">
  <div class="gatebox">
    <div class="logo" style="margin-bottom:16px">H</div>
    <div class="eyebrow">Private OneDrive Gateway</div>
    <h1 id="authTitle">登入</h1>
    <p id="authSubtitle">使用 HF Vault 相同的帳號與密碼。</p>
    <form id="authForm">
      <div class="field"><label>帳號</label><input id="authUser" class="input" autocomplete="username" required placeholder="輸入帳號"></div>
      <div class="field"><label>密碼</label><input id="authPass" class="input" type="password" autocomplete="current-password" required placeholder="輸入密碼"></div>
      <button id="authSubmit" class="btn primary" style="width:100%;margin-top:14px">登入</button>
    </form>
    <p id="authHint" style="font-size:12px;margin-bottom:0">沿用 hf-cf-upload-poc-20260929 的 D1 登入與 Session。</p>
  </div>
</div>
<div class="shell">
<aside class="side">
  <div class="brand"><div class="logo">H</div><div><b>HRS Drive</b><span>Cloudflare × OneDrive</span></div></div>
  <nav class="nav">
    <a href="/overview" data-page="overview">總覽</a>
    <a href="/upload" data-page="upload">上傳</a>
    <a href="/files" data-page="files">檔案</a>
  </nav>
  <div class="sidefoot"><div class="pill"><span id="sideStatus">等待連線</span><br>Root: /HRS</div></div>
</aside>

<main class="main">
<div class="top">
  <div><div class="eyebrow">HRS secure workspace</div><h1 id="pageTitle" class="title">總覽</h1><p id="pageSub" class="subtitle">只管理 /HRS，其他 OneDrive 內容保持隔離。</p></div>
  <div class="toolbar"><span id="connBadge" class="badge"><i class="dot"></i><span>檢查中</span></span><button id="connectBtn" class="btn" hidden>連接 OneDrive</button><button id="lockBtn" class="btn">鎖定</button></div>
</div>

<section id="overviewView">
  <div class="grid">
    <div class="metric"><small>根目錄項目</small><strong id="mItems">—</strong><div class="hint">/HRS 第一層</div></div>
    <div class="metric"><small>檔案</small><strong id="mFiles">—</strong><div class="hint">可下載／共用</div></div>
    <div class="metric"><small>資料夾</small><strong id="mFolders">—</strong><div class="hint">可新增與刪除</div></div>
    <div class="metric"><small>第一層容量</small><strong id="mBytes">—</strong><div class="hint">即時計算</div></div>
  </div>
  <div class="card">
    <h2>安全邊界</h2>
    <p>所有列檔、刪除、下載與共用操作都會由 Worker 再次確認目標位於 <b>/HRS</b>。手動竄改 URL 或 item ID 也不能操作其他 OneDrive 資料。</p>
    <div class="actions" style="justify-content:flex-start"><button class="btn primary" data-go="upload">開始上傳</button><button class="btn" data-go="files">瀏覽 HRS</button></div>
  </div>
</section>

<section id="uploadView" hidden>
  <div class="card">
    <h2>分段上傳</h2>
    <p>10 MiB 一段，Worker 串流轉送至 Microsoft Graph，不將整個大檔載入記憶體。</p>
    <div class="field"><label>上傳到 HRS 內的路徑（留空 = /HRS）</label><input id="uploadPath" class="input" placeholder="例如 projects/2026"></div>
    <div id="drop" class="drop" style="margin-top:14px"><div class="big">UPLOAD</div><b>拖放檔案到這裡</b><span>或點一下選擇檔案</span><input id="fileInput" type="file" hidden></div>
    <div class="actions" style="justify-content:flex-start;margin-top:14px"><button id="uploadBtn" class="btn primary" disabled>開始上傳</button></div>
    <div class="progress"><div id="upBar" class="bar"></div></div><div class="progressrow"><span id="upText">尚未選擇檔案</span><span id="upPct">0%</span></div>
  </div>
</section>

<section id="filesView" hidden>
  <div class="card">
    <div class="filetop"><div><h2>檔案管理</h2><p style="margin:5px 0 0">新增、下載、刪除，以及建立匿名唯讀共用連結。</p></div><div class="toolbar"><button id="newFolderBtn" class="btn">新增資料夾</button><button id="refreshBtn" class="btn">重新整理</button></div></div>
    <div id="crumbs" class="crumbs"></div>
    <div class="field"><input id="searchInput" class="input" placeholder="搜尋目前資料夾"></div>
    <div class="tablewrap" style="margin-top:14px"><table class="table"><thead><tr><th>名稱</th><th>類型</th><th>大小</th><th>修改時間</th><th style="text-align:right">動作</th></tr></thead><tbody id="fileRows"><tr><td colspan="5" style="color:var(--muted)">尚未載入</td></tr></tbody></table></div>
  </div>
</section>
</main>
</div>

<div id="toastbox" class="toastbox"></div><div id="modalHost"></div>
<script>
(()=>{"use strict";
const st={user:null,path:"",items:[],file:null};
const q=id=>document.getElementById(id),qa=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function bytes(n){n=Number(n||0);if(n<1024)return n+" B";if(n<1048576)return(n/1024).toFixed(1)+" KiB";if(n<1073741824)return(n/1048576).toFixed(2)+" MiB";if(n<1099511627776)return(n/1073741824).toFixed(2)+" GiB";return(n/1099511627776).toFixed(2)+" TiB"}
function toast(m){const x=document.createElement("div");x.className="toast";x.textContent=m;q("toastbox").appendChild(x);setTimeout(()=>x.remove(),3800)}
async function raw(url,opt={}){const r=await fetch(url,{...opt,cache:"no-store",credentials:"same-origin"}),t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{throw Error(t||("HTTP "+r.status))}if(!r.ok)throw Error((d&&d.error)||("HTTP "+r.status));return d}
const api=raw;
function page(){const p=location.pathname.replace(/^\/+|\/+$/g,"")||"overview";return["overview","upload","files"].includes(p)?p:"overview"}
function show(pg,push=true){q("overviewView").hidden=pg!=="overview";q("uploadView").hidden=pg!=="upload";q("filesView").hidden=pg!=="files";qa(".nav a").forEach(a=>a.classList.toggle("on",a.dataset.page===pg));q("pageTitle").textContent=pg==="overview"?"總覽":pg==="upload"?"上傳":"檔案";q("pageSub").textContent=pg==="overview"?"只管理 /HRS，其他 OneDrive 內容保持隔離。":pg==="upload"?"大型檔案採 Microsoft Graph Upload Session 分段上傳。":"在 /HRS 範圍內自由建立、刪除、下載與共用。";if(push&&location.pathname!=="/"+pg)history.pushState({},"","/"+pg);if(pg==="overview")loadOverview();if(pg==="files")loadFiles()}
function badge(ok,label){const b=q("connBadge");b.classList.toggle("ok",!!ok);b.classList.toggle("err",ok===false);b.querySelector("span").textContent=label;q("sideStatus").textContent=label}
async function enterApp(){q("gate").hidden=true;const d=await api("/api/status");badge(d.connected,d.connected?"OneDrive 已連接":"OneDrive 尚未連接");q("connectBtn").hidden=d.connected||!d.microsoftConfigured;show(page(),false)}
async function authGate(){q("gate").hidden=false;try{const a=await raw("/api/auth/status");if(a.authenticated){st.user=a.user;await enterApp()}else{q("authTitle").textContent="登入";q("authSubtitle").textContent="使用 HF Vault 相同的帳號與密碼。"}}catch(e){q("authHint").textContent="無法連線："+e.message}}
async function submitAuth(e){e.preventDefault();const username=q("authUser").value.trim(),password=q("authPass").value,btn=q("authSubmit");if(!username||!password){toast("請輸入帳號與密碼");return}btn.disabled=true;btn.textContent="登入中…";try{const d=await raw("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username,password})});st.user=d.user;q("authPass").value="";toast("登入成功");await enterApp()}catch(err){toast(err.message)}finally{btn.disabled=false;btn.textContent="登入"}}
async function logout(){try{await raw("/api/auth/logout",{method:"POST"})}catch{}st.user=null;q("gate").hidden=false;await authGate()}
async function connect(){const d=await api("/api/auth/url",{method:"POST"});location.href=d.url}
async function loadOverview(){try{const d=await api("/api/overview");q("mItems").textContent=d.items;q("mFiles").textContent=d.files;q("mFolders").textContent=d.folders;q("mBytes").textContent=bytes(d.bytes)}catch(e){toast(e.message)}}
function crumbs(){const parts=st.path?st.path.split("/"):[],out=['<button data-path="">HRS</button>'];let acc="";for(const p of parts){acc=acc?acc+"/"+p:p;out.push("<span>›</span><button data-path=\""+esc(acc)+"\">"+esc(p)+"</button>")}q("crumbs").innerHTML=out.join(" ");qa("#crumbs button").forEach(b=>b.onclick=()=>{st.path=b.dataset.path;loadFiles()})}
async function loadFiles(){try{const d=await api("/api/files?path="+encodeURIComponent(st.path));st.items=d.items||[];crumbs();renderFiles()}catch(e){toast(e.message)}}
function renderFiles(){const term=q("searchInput").value.trim().toLowerCase(),a=st.items.filter(x=>!term||x.name.toLowerCase().includes(term));q("fileRows").innerHTML=a.length?"":'<tr><td colspan="5" style="color:var(--muted)">這個資料夾是空的</td></tr>';for(const f of a){const tr=document.createElement("tr");tr.innerHTML="<td></td><td>"+(f.folder?"資料夾":"檔案")+"</td><td>"+bytes(f.size)+"</td><td>"+esc(f.lastModifiedDateTime?new Intl.DateTimeFormat("zh-TW",{dateStyle:"medium",timeStyle:"short"}).format(new Date(f.lastModifiedDateTime)):"-")+'</td><td><div class="actions"></div></td>';const nb=document.createElement("button");nb.className="namebtn";nb.textContent=(f.folder?"DIR  ":"FILE  ")+f.name;if(f.folder)nb.onclick=()=>{st.path=st.path?st.path+"/"+f.name:f.name;loadFiles()};tr.children[0].appendChild(nb);const ac=tr.querySelector(".actions");if(f.file){const dl=document.createElement("button");dl.className="btn mini";dl.textContent="下載";dl.onclick=()=>downloadFile(f);ac.appendChild(dl)}const sh=document.createElement("button");sh.className="btn mini success";sh.textContent="共用";sh.onclick=()=>shareFile(f);ac.appendChild(sh);const de=document.createElement("button");de.className="btn mini danger";de.textContent="刪除";de.onclick=()=>removeFile(f);ac.appendChild(de);q("fileRows").appendChild(tr)}}
function modal(title,body,buttons){q("modalHost").innerHTML='<div class="modalback"><div class="modal"><h3>'+esc(title)+"</h3><div>"+body+'</div><div class="row" id="modalBtns"></div></div></div>';for(const b of buttons){const x=document.createElement("button");x.className="btn "+(b.cls||"");x.textContent=b.text;x.onclick=b.fn;q("modalBtns").appendChild(x)}}
function closeModal(){q("modalHost").innerHTML=""}
function newFolder(){modal("新增資料夾",'<div class="field"><label>名稱</label><input id="folderName" class="input" autofocus></div>',[{text:"取消",fn:closeModal},{text:"建立",cls:"primary",fn:async()=>{try{await api("/api/folders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({path:st.path,name:q("folderName").value})});closeModal();toast("資料夾已建立");loadFiles()}catch(e){toast(e.message)}}}])}
function removeFile(f){modal("刪除 "+f.name,"<p>這會將項目移到 OneDrive 資源回收筒。若是資料夾，其底下內容也會一起刪除。</p>",[{text:"取消",fn:closeModal},{text:"刪除",cls:"danger",fn:async()=>{try{await api("/api/items/"+encodeURIComponent(f.id),{method:"DELETE"});closeModal();toast("已刪除 "+f.name);loadFiles();loadOverview()}catch(e){toast(e.message)}}}])}
async function shareFile(f){try{const d=await api("/api/share/"+encodeURIComponent(f.id),{method:"POST"}),url=d.link&&d.link.webUrl;if(!url)throw Error("Microsoft 未回傳共用網址");modal("共用連結",'<p>匿名唯讀連結，只指向這個 HRS 項目。</p><div class="field"><input id="shareUrl" class="input" readonly value="'+esc(url)+'"></div>',[{text:"關閉",fn:closeModal},{text:"複製",cls:"primary",fn:async()=>{await navigator.clipboard.writeText(url);toast("已複製");closeModal()}}])}catch(e){toast("共用失敗："+e.message)}}
async function downloadFile(f){try{const d=await api("/api/download-ticket/"+encodeURIComponent(f.id),{method:"POST"});location.href=d.url}catch(e){toast(e.message)}}
function choose(f){st.file=f;q("uploadBtn").disabled=!f;q("upText").textContent=f?f.name+" · "+bytes(f.size):"尚未選擇檔案";q("upBar").style.width="0%";q("upPct").textContent="0%"}
async function upload(){const f=st.file;if(!f)return;const btn=q("uploadBtn");btn.disabled=true;try{const d=await api("/api/upload/start",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({path:q("uploadPath").value,name:f.name,size:f.size})}),chunk=d.chunkSize||10485760;let pos=0;while(pos<f.size){const end=Math.min(pos+chunk,f.size),blob=f.slice(pos,end);let last=null;for(let n=0;n<3;n++){try{await api("/api/upload/"+encodeURIComponent(d.uploadId),{method:"PUT",headers:{"content-range":"bytes "+pos+"-"+(end-1)+"/"+f.size,"content-type":"application/octet-stream"},body:blob});last=null;break}catch(e){last=e;await new Promise(r=>setTimeout(r,1000*Math.pow(2,n)))}}if(last)throw last;pos=end;const pct=pos/f.size*100;q("upBar").style.width=pct.toFixed(2)+"%";q("upPct").textContent=pct.toFixed(1)+"%";q("upText").textContent="上傳中 · "+bytes(pos)+" / "+bytes(f.size)}toast("上傳完成："+f.name);q("upText").textContent="上傳完成 · "+f.name;loadOverview()}catch(e){toast("上傳失敗："+e.message);q("upText").textContent="上傳中斷"}finally{btn.disabled=false}}
q("authForm").onsubmit=submitAuth;q("lockBtn").onclick=logout;q("connectBtn").onclick=()=>connect().catch(e=>toast(e.message));qa(".nav a").forEach(a=>a.onclick=e=>{e.preventDefault();show(a.dataset.page)});qa("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));window.onpopstate=()=>show(page(),false);q("newFolderBtn").onclick=newFolder;q("refreshBtn").onclick=loadFiles;q("searchInput").oninput=renderFiles;q("uploadBtn").onclick=upload;const drop=q("drop"),fi=q("fileInput");drop.onclick=()=>fi.click();fi.onchange=()=>choose(fi.files&&fi.files[0]||null);["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over")}));["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over")}));drop.addEventListener("drop",e=>choose(e.dataTransfer.files&&e.dataTransfer.files[0]||null));authGate();
})();
</script>
</body></html>`;
