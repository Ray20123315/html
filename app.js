const I18N={
  'zh-TW':{
    brand:'記憶體管理器',navObserve:'觀測',navIncident:'事故',navGame:'遊戲規則',navInstall:'安裝',navSafety:'安全',
    heroEyebrow:'Windows 11 · 本機優先 · 安全優先',heroA:'把記憶體控制',heroB:'做得安靜又清楚。',heroText:'不是「一鍵清 RAM」。先看 RAM、Commit、Process Commit、趨勢與事故證據，再決定需不需要動作；任何會改變程序 Memory Priority 的規則都預設關閉、可回復。',
    downloadSetup:'下載 beta.29 安裝器',releasePage:'Release 頁',proof1:'真正 Process Commit',proof2:'Windows 事故時間線',proof3:'可回復 Memory Rules',proof4:'真正 Installer V2',
    dashState:'目前狀態',dashHealthy:'正常，不需要亂清 RAM',availableRam:'可用 RAM',protectedGame:'Game Profile · 保護',incidentCardSmall:'上一輪狀態',incidentCardTitle:'證據一致，沒有亂猜根因',released:'已發布 · prerelease',checksums:'下載 SHA256SUMS.txt ↗',
    observeTitle:'先量對，再談「最佳化」。',observeText:'beta.29 把 Windows 真正的 Commit 壓力、Process Commit、Page File、Headroom 與趨勢放在一起。1 ms 是資料取樣要求，不等於 UI 每毫秒重畫。',
    f01:'使用 Windows PrivateUsage，而不是把 Working Set 或 .NET PrivateMemory 當成 Commit。',f02:'看近期增長量與多次樣本的持續成長，降低單次尖峰誤報。',f03:'回答「離 system commit limit 還有多遠」，並用近期趨勢估算 ETA。',f04:'用白話顯示 Windows 是否自動管理 Page File，以及 Commit Limit 是否有足夠餘裕。',f05:'Telemetry 與 UI refresh 分離；視窗、前景與遊戲狀態決定合理畫面更新頻率。',f06:'壓力真的高時才顯示救援面板，先看大用量 App、正常關閉、再考慮工作管理員。',
    incidentTitle:'當機之後，先還原時間線。',incidentText:'Previous Crash Analyzer 把上一輪 heartbeat、persistent Flight Recorder 與 Windows Event Log 串在一起。Event 41 / 6008 只表示異常關機序列，不單獨宣稱是電源、RAM 或某個程式造成。',inc1:'Resource Exhaustion Event 2004：低虛擬記憶體／Commit 壓力證據',inc2:'BugCheck / WHEA：分開標示，不跟記憶體壓力混成同一原因',inc3:'Incident-only Support Bundle：只匯出事故附近的小時間窗',inc4:'Reliability History：把近期相關事件整理成可讀列表',timelineTitle:'上一輪證據時間線',confidence:'判斷強度：高度相關',tl2:'Windows 偵測到 Resource Exhaustion',tl3:'Memory Manager 最後一次正常回報',tl4:'系統之後出現未正常關機證據',evidenceNote:'結論：記憶體壓力與異常重新啟動時間高度相關；仍不把相關性寫成未證明的單一根因。',
    gameTitle:'Game Memory Reserve V2：不是鎖 RAM。',gameText:'只有你建立 Per-App Rule 並打開總開關後，符合「背景時間 + Commit 門檻」的普通 App 才可能暫時降低 Windows Process Memory Priority。遊戲、前景、反作弊、語音、輸入與核心程序保持原設定。',policyOff:'總開關預設關閉',policyOffText:'第一次啟動不會自行修改任何程序 Memory Priority。',policyProtect:'硬保護清單',policyProtectText:'Foreground / Game Profile / anti-cheat / voice / input / Windows core 都不降。',policyRestore:'條件消失就還原',policyRestoreText:'變成前景、規則停用、程式不再符合或 App 結束時，要求回復原 Memory Priority。',backgroundRule:'背景 15 分鐘 · Commit ≥ 512 MB',reversible:'暫時、可還原',
    backup:'設定備份',change:'修改',rollback:'Rollback',updateTitle:'更新能驗證；OEM 控制不越界。',updateText:'Update Center 直接讀 GitHub Releases 的 prerelease、Release Notes、asset 大小與 SHA-256 digest。設定支援 Backup / Rollback；還原前會再建立 safety backup。',oemText:'讀 BIOS 廠牌／機型並安全偵測 MSI Center；需要風扇、功耗、效能情境時開啟 MSI 官方程式。沒有公開安全介面時，不直接寫 EC / MSR / 私有 register。',
    installTitle:'「安裝」是真的 install / repair / uninstall。',installText:'Windows CI 每次都在隔離目錄執行完整週期：安裝後核對 payload SHA-256、repair 後再次核對、最後 uninstall 並確認目錄沒有殘留。正式安裝同時建立 Start Menu 與 Installed Apps 資訊。',recommended:'建議',setupDesc:'真正安裝 / 修復 / 解除安裝',portableDesc:'免安裝，直接執行',checksumDesc:'完整 SHA-256 清單',download:'下載 ↓',
    safetyTitle:'把「不做什麼」也寫清楚。',s1t:'不亂殺程式',s1p:'Emergency Rescue 先建議正常關閉；系統與受保護程序不自動終止。',s2t:'不把 Event 41 當根因',s2p:'異常關機事件只當時間線證據，根因需要更多事件與趨勢佐證。',s3t:'不直接寫未公開 MSI EC',s3p:'OEM 硬體控制交由 MSI Center，避免跨機型 EC 風險。',s4t:'不假裝有可信簽章',s4p:'beta.29 目前沒有正式 Code Signing PFX，因此 Release 是 unsigned；不宣稱能繞過 SmartScreen / Smart App Control。',
    finalTitle:'先看懂，再決定要不要動。',finalText:'beta.29 已在 GitHub Actions 的 Windows runner 通過 app self-test、Memory Priority round-trip、設定 rollback、Installer V2 與 SHA-256 manifest 驗證。實體 MSI 機器仍需要最後的視覺、MSI Center 與 SmartScreen 驗收。'
  },
  'zh-CN':{
    brand:'内存管理器',navObserve:'观测',navIncident:'事故',navGame:'游戏规则',navInstall:'安装',navSafety:'安全',
    heroEyebrow:'Windows 11 · 本地优先 · 安全优先',heroA:'把内存控制',heroB:'做得安静又清楚。',heroText:'不是“一键清 RAM”。先看 RAM、Commit、Process Commit、趋势与事故证据，再决定是否需要动作；任何会改变进程 Memory Priority 的规则都默认关闭、可以恢复。',
    downloadSetup:'下载 beta.29 安装器',releasePage:'Release 页面',proof1:'真正 Process Commit',proof2:'Windows 事故时间线',proof3:'可恢复 Memory Rules',proof4:'真正 Installer V2',
    dashState:'当前状态',dashHealthy:'正常，不需要乱清 RAM',availableRam:'可用 RAM',protectedGame:'Game Profile · 保护',incidentCardSmall:'上一轮状态',incidentCardTitle:'证据一致，不乱猜根因',released:'已发布 · prerelease',checksums:'下载 SHA256SUMS.txt ↗',
    observeTitle:'先量对，再谈“优化”。',observeText:'beta.29 把 Windows 真正的 Commit 压力、Process Commit、Page File、Headroom 与趋势放在一起。1 ms 是数据采样请求，不等于 UI 每毫秒重绘。',
    f01:'使用 Windows PrivateUsage，而不是把 Working Set 或 .NET PrivateMemory 当成 Commit。',f02:'看近期增长量与多次样本的持续增长，降低单次尖峰误报。',f03:'回答“离 system commit limit 还有多远”，并用近期趋势估算 ETA。',f04:'用易懂文字显示 Windows 是否自动管理 Page File，以及 Commit Limit 是否有足够余量。',f05:'Telemetry 与 UI refresh 分离；窗口、前台与游戏状态决定合理画面更新频率。',f06:'压力真的高时才显示救援面板，先看大用量 App、正常关闭，再考虑任务管理器。',
    incidentTitle:'崩溃之后，先还原时间线。',incidentText:'Previous Crash Analyzer 把上一轮 heartbeat、persistent Flight Recorder 与 Windows Event Log 串在一起。Event 41 / 6008 只表示异常关机序列，不单独宣称是电源、RAM 或某个程序造成。',inc1:'Resource Exhaustion Event 2004：低虚拟内存／Commit 压力证据',inc2:'BugCheck / WHEA：分开标示，不跟内存压力混成同一原因',inc3:'Incident-only Support Bundle：只导出事故附近的小时间窗',inc4:'Reliability History：把近期相关事件整理成可读列表',timelineTitle:'上一轮证据时间线',confidence:'判断强度：高度相关',tl2:'Windows 检测到 Resource Exhaustion',tl3:'Memory Manager 最后一次正常回报',tl4:'系统之后出现未正常关机证据',evidenceNote:'结论：内存压力与异常重启时间高度相关；仍不把相关性写成未证明的单一根因。',
    gameTitle:'Game Memory Reserve V2：不是锁 RAM。',gameText:'只有你建立 Per-App Rule 并打开总开关后，符合“后台时间 + Commit 门槛”的普通 App 才可能暂时降低 Windows Process Memory Priority。游戏、前台、反作弊、语音、输入与核心进程保持原设置。',policyOff:'总开关默认关闭',policyOffText:'第一次启动不会自行修改任何进程 Memory Priority。',policyProtect:'硬保护清单',policyProtectText:'Foreground / Game Profile / anti-cheat / voice / input / Windows core 都不降低。',policyRestore:'条件消失就恢复',policyRestoreText:'变成前台、规则停用、程序不再符合或 App 结束时，要求恢复原 Memory Priority。',backgroundRule:'后台 15 分钟 · Commit ≥ 512 MB',reversible:'临时、可恢复',
    backup:'设置备份',change:'修改',rollback:'Rollback',updateTitle:'更新能验证；OEM 控制不越界。',updateText:'Update Center 直接读取 GitHub Releases 的 prerelease、Release Notes、asset 大小与 SHA-256 digest。设置支持 Backup / Rollback；恢复前会再建立 safety backup。',oemText:'读取 BIOS 厂牌／机型并安全检测 MSI Center；需要风扇、功耗、性能场景时打开 MSI 官方程序。没有公开安全接口时，不直接写 EC / MSR / 私有 register。',
    installTitle:'“安装”是真的 install / repair / uninstall。',installText:'Windows CI 每次都在隔离目录执行完整周期：安装后核对 payload SHA-256、repair 后再次核对、最后 uninstall 并确认目录无残留。正式安装同时建立 Start Menu 与 Installed Apps 信息。',recommended:'建议',setupDesc:'真正安装 / 修复 / 卸载',portableDesc:'免安装，直接运行',checksumDesc:'完整 SHA-256 清单',download:'下载 ↓',
    safetyTitle:'把“不做什么”也写清楚。',s1t:'不乱杀程序',s1p:'Emergency Rescue 先建议正常关闭；系统与受保护进程不自动终止。',s2t:'不把 Event 41 当根因',s2p:'异常关机事件只当时间线证据，根因需要更多事件与趋势佐证。',s3t:'不直接写未公开 MSI EC',s3p:'OEM 硬件控制交给 MSI Center，避免跨机型 EC 风险。',s4t:'不假装有可信签名',s4p:'beta.29 当前没有正式 Code Signing PFX，因此 Release 是 unsigned；不宣称能绕过 SmartScreen / Smart App Control。',
    finalTitle:'先看懂，再决定要不要动。',finalText:'beta.29 已在 GitHub Actions 的 Windows runner 通过 app self-test、Memory Priority round-trip、设置 rollback、Installer V2 与 SHA-256 manifest 验证。实体 MSI 机器仍需要最后的视觉、MSI Center 与 SmartScreen 验收。'
  },
  en:{
    brand:'Memory Manager',navObserve:'Observe',navIncident:'Incidents',navGame:'Game rules',navInstall:'Install',navSafety:'Safety',
    heroEyebrow:'Windows 11 · local-first · safety-first',heroA:'Memory control,',heroB:'quiet and understandable.',heroText:'Not a magic “clear RAM” button. Inspect RAM, commit pressure, per-process commit, trends and incident evidence first. Rules that can change Process Memory Priority are off by default and reversible.',
    downloadSetup:'Download beta.29 Setup',releasePage:'Release page',proof1:'True Process Commit',proof2:'Windows incident timeline',proof3:'Reversible Memory Rules',proof4:'Real Installer V2',
    dashState:'Current state',dashHealthy:'Healthy — no need to clear RAM',availableRam:'Available RAM',protectedGame:'Game Profile · protected',incidentCardSmall:'Previous session',incidentCardTitle:'Evidence first, no invented root cause',released:'Published · prerelease',checksums:'Download SHA256SUMS.txt ↗',
    observeTitle:'Measure the right thing before optimizing.',observeText:'beta.29 brings Windows commit pressure, true Process Commit, Page File status, headroom and trend data together. A 1 ms sampling request does not mean repainting the UI every millisecond.',
    f01:'Uses Windows PrivateUsage instead of mislabeling Working Set or .NET PrivateMemory as Commit.',f02:'Tracks recent deltas and sustained multi-sample growth to reduce one-spike leak false positives.',f03:'Shows distance to the system commit limit and estimates ETA from the recent trend.',f04:'Explains whether Windows manages the Page File and whether the current Commit Limit has reasonable headroom.',f05:'Telemetry is separated from UI refresh; window, foreground and game state drive a sensible repaint interval.',f06:'The rescue panel appears only under real pressure: inspect large apps, close normally, then use Task Manager if needed.',
    incidentTitle:'After a crash, reconstruct the timeline first.',incidentText:'Previous Crash Analyzer combines the previous heartbeat, persistent Flight Recorder and Windows Event Log. Event 41 / 6008 indicate an abnormal shutdown sequence; they are not treated as proof that power, RAM or one app caused it.',inc1:'Resource Exhaustion Event 2004: evidence of low virtual-memory / commit pressure',inc2:'BugCheck / WHEA are labeled separately instead of being merged into memory pressure',inc3:'Incident-only Support Bundle exports a small time window around the event',inc4:'Reliability History turns recent related events into a readable list',timelineTitle:'Previous-session evidence timeline',confidence:'Confidence: highly correlated',tl2:'Windows detected Resource Exhaustion',tl3:'Last healthy Memory Manager heartbeat',tl4:'Abnormal shutdown evidence followed',evidenceNote:'Conclusion: memory pressure and the abnormal restart are strongly time-correlated; correlation is not rewritten as an unproven single root cause.',
    gameTitle:'Game Memory Reserve V2 does not lock RAM.',gameText:'Only after you create a Per-App Rule and enable the master switch can an ordinary background app that meets idle-time and Commit thresholds temporarily receive a lower Windows Process Memory Priority. Games, foreground apps, anti-cheat, voice, input and core processes keep their settings.',policyOff:'Master switch is off by default',policyOffText:'First launch does not change any process Memory Priority on its own.',policyProtect:'Hard protection list',policyProtectText:'Foreground / Game Profile / anti-cheat / voice / input / Windows core are never lowered.',policyRestore:'Restore when conditions disappear',policyRestoreText:'Becoming foreground, disabling the rule, no longer matching or closing Memory Manager requests restoration of the original Memory Priority.',backgroundRule:'Background 15 min · Commit ≥ 512 MB',reversible:'temporary · reversible',
    backup:'Settings backup',change:'Change',rollback:'Rollback',updateTitle:'Updates are verifiable; OEM control stays inside safe boundaries.',updateText:'Update Center reads GitHub Releases prerelease status, Release Notes, asset sizes and SHA-256 digests. Settings support Backup / Rollback, with a safety backup made before restore.',oemText:'Reads BIOS vendor/model and safely detects MSI Center. Fan, power and performance scenarios are delegated to MSI software. Without a documented safe API, Memory Manager does not write EC / MSR / private registers.',
    installTitle:'Install really means install / repair / uninstall.',installText:'Windows CI runs the full cycle in an isolated directory: install and verify payload SHA-256, repair and verify it again, then uninstall and confirm no test directory remains. Normal install also registers Start Menu and Installed Apps entries.',recommended:'Recommended',setupDesc:'Real install / repair / uninstall',portableDesc:'Portable, run directly',checksumDesc:'Complete SHA-256 list',download:'Download ↓',
    safetyTitle:'Safety boundaries are part of the feature set.',s1t:'No random process killing',s1p:'Emergency Rescue recommends normal close first; system and protected processes are not auto-terminated.',s2t:'Event 41 is not a root cause',s2p:'Abnormal shutdown events are timeline evidence; root cause needs additional events and trends.',s3t:'No undocumented MSI EC writes',s3p:'OEM hardware control stays with MSI Center to avoid cross-model EC risk.',s4t:'No fake trusted signing claims',s4p:'beta.29 currently has no trusted Code Signing PFX, so the Release is unsigned and does not claim to bypass SmartScreen / Smart App Control.',
    finalTitle:'Understand the state before changing it.',finalText:'beta.29 passed app self-test, Memory Priority round-trip, settings rollback, Installer V2 and SHA-256 manifest verification on a GitHub Actions Windows runner. A physical MSI machine still needs final visual, MSI Center and SmartScreen acceptance testing.'
  }
};

let lang=localStorage.getItem('mm-lang')||'zh-TW';
function setLang(next){
  lang=I18N[next]?next:'zh-TW';
  localStorage.setItem('mm-lang',lang);
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const value=I18N[lang][el.dataset.i18n];
    if(value)el.textContent=value;
  });
  document.querySelectorAll('[data-lang]').forEach(button=>button.classList.toggle('active',button.dataset.lang===lang));
}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>setLang(button.dataset.lang)));
setLang(lang);

const root=document.documentElement;
const storedTheme=localStorage.getItem('mm-theme');
if(storedTheme==='light'||storedTheme==='dark')root.dataset.theme=storedTheme;
const themeButton=document.querySelector('#themeToggle');
if(themeButton)themeButton.addEventListener('click',()=>{
  root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
  localStorage.setItem('mm-theme',root.dataset.theme);
});

if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('on');observer.unobserve(entry.target);}
  }),{threshold:.12,rootMargin:'0px 0px -40px'});
  document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));
}else{
  document.querySelectorAll('.reveal').forEach(element=>element.classList.add('on'));
}

const states=[
  {ram:'8.6 GB',commit:'64%',headroom:'12.4 GB',label:'Stable'},
  {ram:'7.9 GB',commit:'69%',headroom:'10.8 GB',label:'Game profile'},
  {ram:'9.4 GB',commit:'61%',headroom:'13.5 GB',label:'Headroom OK'},
  {ram:'8.8 GB',commit:'63%',headroom:'12.9 GB',label:'Adaptive refresh'}
];
let stateIndex=0;
const ramValue=document.querySelector('#ramValue');
const commitValue=document.querySelector('#commitValue');
const headroomValue=document.querySelector('#headroomValue');
const chartLabel=document.querySelector('#chartLabel');
if(ramValue&&commitValue&&headroomValue&&chartLabel&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  window.setInterval(()=>{
    stateIndex=(stateIndex+1)%states.length;
    const state=states[stateIndex];
    ramValue.textContent=state.ram;
    commitValue.textContent=state.commit;
    headroomValue.textContent=state.headroom;
    chartLabel.textContent=state.label;
  },2600);
}