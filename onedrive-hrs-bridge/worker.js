const SESSION_COOKIE = 'hf_admin_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 100000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const DEFAULT_USER_QUOTA_BYTES = 1024 * 1024 * 1024;
const CLOUDFLARE_PLAN_UPLOAD_MB = 100;
const MULTIPART_CHUNK_BYTES = 10 * 1024 * 1024;
const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;
const MULTIPART_MAX_PARTS = 30000;
const MULTIPART_FALLBACK_MIB = [10,5];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (['/','/overview','/activity','/upload','/files','/users'].includes(url.pathname)) return htmlResponse(APP_HTML);
      if (url.pathname === '/app.js') return jsResponse(APP_JS);
      if (url.pathname === '/api/ping') return json({ ok:true, now:Date.now() });
      if (url.pathname === '/api/status') {
        return json({
          ok:true,
          configured:Boolean(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET && env.STATE && env.DB),
          platformUploadLimitMb:CLOUDFLARE_PLAN_UPLOAD_MB,
          platformPlan:'Free',
          multipartChunkBytes:MULTIPART_CHUNK_BYTES,
          multipartThresholdBytes:MULTIPART_THRESHOLD_BYTES,
          multipartFallbackMiB:MULTIPART_FALLBACK_MIB
        });
      }

      if (url.pathname === '/api/auth/status' && request.method === 'GET') return await authStatus(request, env);
      if (url.pathname === '/api/auth/setup' && request.method === 'POST') return await authSetup(request, env);
      if (url.pathname === '/api/auth/login' && request.method === 'POST') return await authLogin(request, env);
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') return await authLogout(request, env);

      if (url.pathname.startsWith('/api/')) {
        const auth = await requireAuth(request, env);

        if (url.pathname === '/api/overview' && request.method === 'GET') return await overviewData(env, auth);
        if (url.pathname === '/api/files' && request.method === 'GET') return await listFiles(url, env, auth);
        if (url.pathname === '/api/folders' && request.method === 'GET') return await listFolders(env, auth);
        if (url.pathname === '/api/folders' && request.method === 'POST') {
          requireSameOrigin(request);
          return await createFolder(request, env, auth);
        }
        if (url.pathname === '/api/audit' && request.method === 'GET') return await listAudit(env, auth);
        if (url.pathname === '/api/users' && request.method === 'GET') {
          requireAdmin(auth);
          return await listUsers(env);
        }

        if (url.pathname === '/api/upload' && request.method === 'POST') {
          requireSameOrigin(request);
          return await uploadFile(request, url, env, auth);
        }
        if (url.pathname === '/api/multipart/init' && request.method === 'POST') {
          requireSameOrigin(request);
          return await multipartInit(request, env, auth);
        }
        if (url.pathname === '/api/multipart/part' && request.method === 'PUT') {
          requireSameOrigin(request);
          return await multipartPart(request, url, env, auth);
        }
        if (url.pathname === '/api/multipart/direct/ack' && request.method === 'POST') {
          requireSameOrigin(request);
          return await multipartDirectAck(request, env, auth);
        }
        if (url.pathname === '/api/multipart/reconcile' && request.method === 'POST') {
          requireSameOrigin(request);
          return await multipartReconcile(request, env, auth);
        }
        if (url.pathname === '/api/multipart/complete' && request.method === 'POST') {
          requireSameOrigin(request);
          return await multipartComplete(request, env, auth);
        }
        if (url.pathname === '/api/multipart/pending' && request.method === 'GET') {
          return await multipartPending(env, auth);
        }
        if (url.pathname === '/api/multipart/abort' && request.method === 'POST') {
          requireSameOrigin(request);
          return await multipartAbort(request, env, auth);
        }
        if (url.pathname === '/api/download' && request.method === 'GET') return await downloadFile(request, url, env, auth);
        if (url.pathname === '/api/rename' && request.method === 'POST') {
          requireSameOrigin(request);
          return await renameFile(request, env, auth);
        }
        if (url.pathname === '/api/move' && request.method === 'POST') {
          requireSameOrigin(request);
          return await moveFile(request, env, auth);
        }
        if (url.pathname === '/api/delete' && request.method === 'POST') {
          requireSameOrigin(request);
          return await deleteFile(request, env, auth);
        }
        if (url.pathname === '/api/sync' && request.method === 'POST') {
          requireSameOrigin(request);
          requireAdmin(auth);
          return await syncFromHf(env, auth);
        }
        if (url.pathname === '/api/users' && request.method === 'POST') {
          requireSameOrigin(request);
          requireAdmin(auth);
          return await createUser(request, env, auth);
        }
        if (url.pathname === '/api/users/update' && request.method === 'POST') {
          requireSameOrigin(request);
          requireAdmin(auth);
          return await updateUser(request, env, auth);
        }
        if (url.pathname === '/api/users/delete' && request.method === 'POST') {
          requireSameOrigin(request);
          requireAdmin(auth);
          return await deleteUser(request, env, auth);
        }
      }

      return new Response('Not found', { status:404 });
    } catch (err) {
      const status = Number(err?.status) || 500;
      return json({ ok:false, error:err?.message || String(err) }, status);
    }
  }
};

async function authStatus(request, env) {
  if (!env.DB) return json({ok:false,error:'D1_NOT_CONFIGURED'},500);
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role = 'admin'").first();
  const hasAdmin = Number(count?.n || 0) > 0;
  const auth = hasAdmin ? await getAuth(request, env) : null;
  return json({
    ok:true,
    hasAdmin,
    authenticated:Boolean(auth),
    user:auth ? publicUser(auth) : null
  });
}

async function authSetup(request, env) {
  requireSameOrigin(request);
  if (!env.DB) throw httpError(500,'D1_NOT_CONFIGURED');
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role = 'admin'").first();
  if (Number(count?.n || 0) > 0) throw httpError(409,'管理員已建立，請直接登入');

  const body = await safeJson(request);
  const username = validateUsername(body.username);
  const password = validatePassword(body.password);
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password,salt,PASSWORD_ITERATIONS);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    'INSERT INTO admin_users (id,username,password_salt,password_hash,password_iterations,created_at,updated_at,role,quota_bytes,enabled) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(id,username,salt,passwordHash,PASSWORD_ITERATIONS,now,now,'admin',0,1).run();

  const session = await createSession(env,id);
  await audit(env,id,'admin_setup',id,JSON.stringify({username}));
  return jsonWithCookie({ok:true,user:{id,username,role:'admin',quotaBytes:0,enabled:true}},session.cookie);
}

async function authLogin(request, env) {
  requireSameOrigin(request);
  if (!env.DB) throw httpError(500,'D1_NOT_CONFIGURED');
  const body = await safeJson(request);
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const attemptKey = await loginAttemptKey(request);
  await enforceLoginRateLimit(env,attemptKey);

  const user = await env.DB.prepare(
    'SELECT id,username,password_salt,password_hash,password_iterations,role,quota_bytes,enabled FROM admin_users WHERE username = ? COLLATE NOCASE'
  ).bind(username).first();

  let valid = false;
  if (user && Number(user.enabled) === 1 && password) {
    const candidate = await hashPassword(password,user.password_salt,Number(user.password_iterations || PASSWORD_ITERATIONS));
    valid = timingSafeEqual(candidate,user.password_hash);
  }

  if (!valid) {
    await recordLoginFailure(env,attemptKey);
    throw httpError(401,'帳號或密碼錯誤，或帳號已停用');
  }

  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE key_hash = ?').bind(attemptKey).run();
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run();
  const session = await createSession(env,user.id);
  await audit(env,user.id,'login',user.id,null);
  return jsonWithCookie({ok:true,user:publicUser(user)},session.cookie);
}

async function authLogout(request, env) {
  requireSameOrigin(request);
  const token = getCookie(request,SESSION_COOKIE);
  if (token && env.DB) {
    const hash = await sha256Hex(new TextEncoder().encode(token));
    const auth = await getAuth(request,env);
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(hash).run();
    if (auth) await audit(env,auth.id,'logout',auth.id,null);
  }
  return jsonWithCookie({ok:true},clearSessionCookie());
}

async function requireAuth(request, env) {
  const auth = await getAuth(request,env);
  if (!auth) throw httpError(401,'請先登入');
  return auth;
}

function requireAdmin(auth) {
  if (!auth || auth.role !== 'admin') throw httpError(403,'需要管理員權限');
}

async function getAuth(request, env) {
  if (!env.DB) return null;
  const token = getCookie(request,SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(new TextEncoder().encode(token));
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    'SELECT u.id,u.username,u.role,u.quota_bytes,u.enabled,s.expires_at FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.token_hash = ?'
  ).bind(tokenHash).first();
  if (!row) return null;
  if (row.expires_at <= now || Number(row.enabled) !== 1) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return {
    id:row.id,
    username:row.username,
    role:row.role || 'user',
    quota_bytes:Number(row.quota_bytes || 0),
    enabled:Number(row.enabled) === 1
  };
}

function publicUser(user) {
  return {
    id:user.id,
    username:user.username,
    role:user.role || 'user',
    quotaBytes:Number(user.quota_bytes ?? user.quotaBytes ?? 0),
    enabled:Number(user.enabled ?? 1) === 1
  };
}

async function createSession(env, userId) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(new TextEncoder().encode(token));
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_TTL_SECONDS * 1000);
  await env.DB.prepare(
    'INSERT INTO admin_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)'
  ).bind(tokenHash,userId,created.toISOString(),expires.toISOString()).run();
  return {cookie:SESSION_COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+SESSION_TTL_SECONDS};
}

function clearSessionCookie() {
  return SESSION_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0,idx).trim() === name) return part.slice(idx+1).trim();
  }
  return '';
}

function requireSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw httpError(403,'Origin 不允許');
}

function validateUsername(value) {
  const username = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) throw httpError(400,'帳號需為 3–40 個英數字，可使用 . _ -');
  return username;
}

function validatePassword(value) {
  const password = String(value || '');
  if (password.length < 10) throw httpError(400,'密碼至少 10 個字元');
  if (password.length > 128) throw httpError(400,'密碼過長');
  return password;
}

function validateQuotaBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.floor(n))) throw httpError(400,'配額格式錯誤');
  return Math.floor(n);
}

async function hashPassword(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {name:'PBKDF2',hash:'SHA-256',salt:hexToBytes(saltHex),iterations},
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function timingSafeEqual(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length/2);
  for (let i=0;i<out.length;i++) out[i]=parseInt(hex.slice(i*2,i*2+2),16);
  return out;
}

async function loginAttemptKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return await sha256Hex(new TextEncoder().encode('login:'+ip));
}

async function enforceLoginRateLimit(env,key) {
  const row = await env.DB.prepare('SELECT window_start,failures FROM admin_login_attempts WHERE key_hash = ?').bind(key).first();
  if (!row) return;
  const age = Date.now()-Date.parse(row.window_start);
  if (age < LOGIN_WINDOW_MS && Number(row.failures || 0) >= LOGIN_MAX_FAILURES) throw httpError(429,'登入失敗次數過多，請稍後再試');
  if (age >= LOGIN_WINDOW_MS) await env.DB.prepare('DELETE FROM admin_login_attempts WHERE key_hash = ?').bind(key).run();
}

async function recordLoginFailure(env,key) {
  const row = await env.DB.prepare('SELECT window_start,failures FROM admin_login_attempts WHERE key_hash = ?').bind(key).first();
  const now = new Date().toISOString();
  if (!row || Date.now()-Date.parse(row.window_start) >= LOGIN_WINDOW_MS) {
    await env.DB.prepare('INSERT OR REPLACE INTO admin_login_attempts (key_hash,window_start,failures) VALUES (?,?,1)').bind(key,now).run();
  } else {
    await env.DB.prepare('UPDATE admin_login_attempts SET failures = failures + 1 WHERE key_hash = ?').bind(key).run();
  }
}

async function audit(env,userId,action,targetId,details) {
  try {
    await env.DB.prepare(
      'INSERT INTO admin_audit (user_id,action,target_id,details,created_at) VALUES (?,?,?,?,?)'
    ).bind(userId || null,action,targetId || null,details || null,new Date().toISOString()).run();
  } catch (_) {}
}

async function listAudit(env, auth) {
  let rows;
  if (auth.role === 'admin') {
    rows = await env.DB.prepare(
      'SELECT a.id,a.action,a.target_id,a.details,a.created_at,u.username FROM admin_audit a LEFT JOIN admin_users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 30'
    ).all();
  } else {
    rows = await env.DB.prepare(
      'SELECT a.id,a.action,a.target_id,a.details,a.created_at,u.username FROM admin_audit a LEFT JOIN admin_users u ON u.id = a.user_id WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 30'
    ).bind(auth.id).all();
  }
  return json({ok:true,items:rows.results || []});
}

async function overviewData(env,auth){
  requireConfig(env);
  const physical=await odAllItems(env),files=physical.filter(x=>x.file),totalBytes=files.reduce((n,x)=>n+Number(x.size||0),0);
  if(auth.role==='admin'){
    const users=await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role='user'").first();
    const meta=await env.DB.prepare('SELECT id,owner_user_id FROM od_files').all(),map=Object.fromEntries((meta.results||[]).map(x=>[x.id,x]));
    const legacyCount=files.filter(x=>!map[x.id]||!map[x.id].owner_user_id).length;
    return json({ok:true,role:'admin',stats:{userCount:Number(users?.n||0),fileCount:files.length,totalBytes,legacyCount}});
  }
  const usage=await odOwnedUsage(env,auth.id),quota=Number(auth.quota_bytes||0);
  return json({ok:true,role:'user',stats:{fileCount:usage.fileCount,totalBytes:usage.usedBytes,quotaBytes:quota,remainingBytes:quota>0?Math.max(0,quota-usage.usedBytes):null}});
}
async function listUsers(env){
  const rows=await env.DB.prepare(
    "SELECT u.id,u.username,u.role,u.quota_bytes,u.enabled,u.created_at,COALESCE(SUM(CASE WHEN f.mime_type!='inode/directory' THEN 1 ELSE 0 END),0) AS file_count,COALESCE(SUM(CASE WHEN f.mime_type!='inode/directory' THEN f.size_bytes ELSE 0 END),0) AS used_bytes FROM admin_users u LEFT JOIN od_files f ON f.owner_user_id=u.id GROUP BY u.id,u.username,u.role,u.quota_bytes,u.enabled,u.created_at ORDER BY CASE WHEN u.role='admin' THEN 0 ELSE 1 END,u.username COLLATE NOCASE"
  ).all();
  return json({ok:true,users:(rows.results||[]).map(r=>({id:r.id,username:r.username,role:r.role||'user',quotaBytes:Number(r.quota_bytes||0),enabled:Number(r.enabled)===1,fileCount:Number(r.file_count||0),usedBytes:Number(r.used_bytes||0),createdAt:r.created_at}))});
}
async function createUser(request, env, auth) {
  const body = await safeJson(request);
  const username = validateUsername(body.username);
  const password = validatePassword(body.password);
  const quotaBytes = body.quotaBytes == null ? DEFAULT_USER_QUOTA_BYTES : validateQuotaBytes(body.quotaBytes);
  const id = crypto.randomUUID();
  const salt = randomHex(16);
  const passwordHash = await hashPassword(password,salt,PASSWORD_ITERATIONS);
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      'INSERT INTO admin_users (id,username,password_salt,password_hash,password_iterations,created_at,updated_at,role,quota_bytes,enabled) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).bind(id,username,salt,passwordHash,PASSWORD_ITERATIONS,now,now,'user',quotaBytes,1).run();
  } catch (e) {
    if (String(e?.message || e).toLowerCase().includes('unique')) throw httpError(409,'帳號已存在');
    throw e;
  }
  await audit(env,auth.id,'user_create',id,JSON.stringify({username,quotaBytes}));
  return json({ok:true,user:{id,username,role:'user',quotaBytes,enabled:true}});
}

async function updateUser(request, env, auth) {
  const body=await safeJson(request),id=String(body.id||'');
  if(!id)throw httpError(400,'Missing user id');
  const target=await env.DB.prepare('SELECT id,username,role,quota_bytes,enabled FROM admin_users WHERE id=?').bind(id).first();
  if(!target)throw httpError(404,'找不到使用者');
  if((target.role||'user')==='admin')throw httpError(400,'此頁不修改管理員帳號');
  let quotaBytes=Number(target.quota_bytes||0),enabled=Number(target.enabled)===1?1:0,username=String(target.username||'');
  if(body.quotaBytes!=null)quotaBytes=validateQuotaBytes(body.quotaBytes);
  if(body.enabled!=null)enabled=body.enabled?1:0;
  if(body.username!=null)username=validateUsername(body.username);
  try{await env.DB.prepare('UPDATE admin_users SET username=?,quota_bytes=?,enabled=?,updated_at=? WHERE id=?').bind(username,quotaBytes,enabled,new Date().toISOString(),id).run()}
  catch(e){if(String(e?.message||e).toLowerCase().includes('unique'))throw httpError(409,'帳號已存在');throw e}
  if(body.password){
    const password=validatePassword(body.password),salt=randomHex(16),hash=await hashPassword(password,salt,PASSWORD_ITERATIONS);
    await env.DB.prepare('UPDATE admin_users SET password_salt=?,password_hash=?,password_iterations=?,updated_at=? WHERE id=?').bind(salt,hash,PASSWORD_ITERATIONS,new Date().toISOString(),id).run();
    await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=?').bind(id).run();
  }else if(!enabled)await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=?').bind(id).run();
  await audit(env,auth.id,'user_update',id,JSON.stringify({username,quotaBytes,enabled:Boolean(enabled),passwordReset:Boolean(body.password)}));
  return json({ok:true,id,username,quotaBytes,enabled:Boolean(enabled)});
}
async function deleteUser(request,env,auth){
  const body=await safeJson(request),id=String(body.id||'');
  if(!id)throw httpError(400,'Missing user id');
  const target=await env.DB.prepare('SELECT id,username,role FROM admin_users WHERE id=?').bind(id).first();
  if(!target)throw httpError(404,'找不到使用者');
  if((target.role||'user')==='admin')throw httpError(400,'不能刪除管理員帳號');
  await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=?').bind(id).run();
  await env.DB.prepare('UPDATE od_files SET owner_user_id=NULL WHERE owner_user_id=?').bind(id).run();
  await env.DB.prepare('DELETE FROM admin_users WHERE id=?').bind(id).run();
  await audit(env,auth.id,'user_delete',id,JSON.stringify({username:target.username,filesPreserved:true}));
  return json({ok:true,id,username:target.username,filesPreserved:true});
}
async function safeJson(request) {
  try { return await request.json(); }
  catch (_) { throw httpError(400,'JSON 格式錯誤'); }
}

function httpError(status,message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function requireConfig(env) {
  if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.STATE || !env.DB) throw httpError(500,'OneDrive 設定不完整');
}
const OD_TOKEN_KEY='auth:tokens';
function odRoot(env){return String(env.ROOT_FOLDER||'HRS')}
function odCleanSegment(value){
  const x=String(value==null?'':value);
  if(!x||x==='.'||x==='..')throw httpError(400,'名稱不合法');
  if(/[\u0000-\u001f\\/:*?"<>|]/.test(x)||/[ .]$/.test(x))throw httpError(400,'名稱包含 OneDrive 不允許的字元');
  if(x.length>255)throw httpError(400,'名稱過長');
  return x;
}
function odCleanPath(value){
  const raw=String(value||'').replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
  if(!raw)return '';
  return raw.split('/').map(odCleanSegment).join('/');
}
function odEncodedPath(env,relative=''){
  const rel=odCleanPath(relative);
  return [odRoot(env),...rel.split('/').filter(Boolean)].map(encodeURIComponent).join('/');
}
async function odAccessToken(env){
  requireConfig(env);
  let t=await env.STATE.get(OD_TOKEN_KEY,'json');
  if(!t)throw httpError(409,'OneDrive 尚未連接');
  if(t.access_token&&Date.now()<Number(t.expires_at||0))return t.access_token;
  if(!t.refresh_token)throw httpError(409,'OneDrive refresh token 不存在');
  const q=new URLSearchParams({
    client_id:env.MS_CLIENT_ID,client_secret:env.MS_CLIENT_SECRET,
    grant_type:'refresh_token',refresh_token:t.refresh_token,
    scope:'offline_access Files.ReadWrite User.Read'
  });
  const r=await fetch('https://login.microsoftonline.com/'+encodeURIComponent(env.MS_TENANT||'common')+'/oauth2/v2.0/token',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:q
  });
  const n=await r.json();
  if(!r.ok)throw httpError(502,n?.error_description||n?.error||'OneDrive token refresh failed');
  t={...t,...n,expires_at:Date.now()+(Number(n.expires_in||3600)-60)*1000};
  await env.STATE.put(OD_TOKEN_KEY,JSON.stringify(t)); --- TRUNCATED --- 156,013 chars