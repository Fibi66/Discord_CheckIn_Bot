// ---- helpers: response & utils ----
const j = (o, init={}) => new Response(JSON.stringify(o), {headers:{'content-type':'application/json'}, ...init});
const td = (d=new Date()) => new Date(new Date(d.toISOString().slice(0,10))); // UTC yyyy-mm-dd -> Date
const ymd = d => d.toISOString().slice(0,10);
function isoWeekStr(d){
  const date = td(d);
  const dayNum = (date.getUTCDay()+6)%7;
  date.setUTCDate(date.getUTCDate()-dayNum+3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(),0,4));
  const week = 1 + Math.round(((+date - +firstThu)/86400000 - 3 + ((firstThu.getUTCDay()+6)%7))/7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
const hexToU8 = hex => new Uint8Array(hex.match(/.{1,2}/g).map(b=>parseInt(b,16)));

async function verifyDiscord(publicKeyHex, sigHex, timestamp, bodyText){
  if(!publicKeyHex || !sigHex || !timestamp) return false;
  const key = await crypto.subtle.importKey(
    'raw', hexToU8(publicKeyHex), {name:'Ed25519'}, false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    {name:'Ed25519'}, key,
    hexToU8(sigHex),
    new TextEncoder().encode(timestamp + bodyText)
  );
  return ok;
}

async function handleCheckin(db, guild_id, user_id){
  const today = td(); const tStr = ymd(today); const wStr = isoWeekStr(today);
  let row = await db.prepare(
    "SELECT streak,last_checkin,leave_week,leave_left FROM streaks WHERE guild_id=? AND user_id=?"
  ).bind(guild_id,user_id).first();

  if(!row){
    await db.prepare("INSERT INTO streaks (guild_id,user_id,streak,last_checkin,leave_week,leave_left) VALUES (?,?,?,?,?,?)")
      .bind(guild_id,user_id,1,tStr,wStr,1).run();
    return j({type:4, data:{flags:64, content:`✅ 已签到！当前连续：1 天`}});
  }

  const last = row.last_checkin ? new Date(row.last_checkin+"T00:00:00Z") : null;
  const diff = last ? Math.floor((+td()-+last)/86400000) : 9e9;
  let streak = row.streak ?? 0;
  let leave_week = row.leave_week ?? null;
  let leave_left = row.leave_left ?? 0;

  if(row.last_checkin === tStr) return j({type:4, data:{flags:64, content:`今天已经签过到啦～ 连续：${streak} 天`}});

  if(diff===1){
    streak += 1;
  }else{
    // 断签了，重置连续天数
    streak = 1;
    // 新的一周，重置请假券（每周一张）
    if(leave_week!==wStr){
      leave_left = 1;
    }
  }

  await db.prepare("UPDATE streaks SET streak=?,last_checkin=?,leave_week=?,leave_left=? WHERE guild_id=? AND user_id=?")
    .bind(streak,tStr,wStr,leave_left,guild_id,user_id).run();

  return j({type:4, data:{flags:64, content:`✅ 已签到！当前连续：${streak} 天`}});
}

async function handleBoard(db, guild_id){
  const rs = await db.prepare("SELECT user_id,streak FROM streaks WHERE guild_id=? ORDER BY streak DESC, user_id ASC LIMIT 10")
    .bind(guild_id).all();
  if(!rs.results?.length) return j({type:4, data:{flags:64, content:"还没人签到，试试 /checkin ！"}});
  const lines = rs.results.map((r,i)=>`${i+1}. <@${r.user_id}> — ${r.streak} 天`).join("\n");
  return j({type:4, data:{content:`📊 本服连续签到 Top 10\n${lines}`}});
}

async function handleLeave(db, guild_id, user_id){
  const today = td();
  const tStr = ymd(today);
  const wStr = isoWeekStr(today);
  
  // 获取用户数据
  const row = await db.prepare("SELECT streak,last_checkin,leave_week,leave_left FROM streaks WHERE guild_id=? AND user_id=?")
    .bind(guild_id,user_id).first();

  // 如果用户从未签到过
  if(!row || !row.last_checkin || row.last_checkin === "1970-01-01"){
    return j({type:4, data:{flags:64, content:"❌ 你还没有签到记录，请先使用 /checkin 签到！"}});
  }

  // 检查本周是否已使用过请假券
  // 如果是新的一周，自动刷新请假券
  if(row.leave_week !== wStr){
    // 新的一周，重置为1张请假券
    await db.prepare("UPDATE streaks SET leave_week=?,leave_left=1 WHERE guild_id=? AND user_id=?")
      .bind(wStr, guild_id, user_id).run();
    // 更新row数据用于后续逻辑
    row.leave_week = wStr;
    row.leave_left = 1;
  }
  
  // 检查本周请假券是否已用
  if(row.leave_left === 0){
    return j({type:4, data:{flags:64, content:"❌ 你本周的请假券已使用过了～"}});
  }

  // 计算缺勤天数
  const last = new Date(row.last_checkin + "T00:00:00Z");
  const diff = Math.floor((+today - +last) / 86400000);
  
  // 今天已经签到了，没有缺勤
  if(row.last_checkin === tStr || diff === 0){
    return j({type:4, data:{flags:64, content:"✨ 本周没有缺勤，无需补签！"}});
  }
  
  // 连续签到中（昨天签的），没有缺勤
  if(diff === 1){
    return j({type:4, data:{flags:64, content:"✨ 你的签到连续中，无需补签！"}});
  }
  
  // 缺勤2天或以上，补签昨天
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = ymd(yesterday);
  
  // 计算补签后的连续天数
  let newStreak = 1; // 默认重新开始
  if(diff === 2){
    // 只缺了昨天一天，补签后恢复连续
    newStreak = (row.streak || 0) + 1;
  }
  // diff > 2 的情况，断签太久，即使补签昨天也只能算1天
  
  // 更新数据：补签昨天，使用请假券
  await db.prepare("UPDATE streaks SET streak=?,last_checkin=?,leave_week=?,leave_left=? WHERE guild_id=? AND user_id=?")
    .bind(newStreak, yesterdayStr, wStr, 0, guild_id, user_id).run();
  
  if(diff === 2){
    return j({type:4, data:{flags:64, content:`✅ 已使用请假券补签昨天！连续签到：${newStreak} 天`}});
  } else {
    return j({type:4, data:{flags:64, content:`✅ 已使用请假券补签昨天！由于断签超过1天，连续天数重置为：1 天`}});
  }
}

// ---- Worker entry ----
export default {
  async fetch(request, env) {
    if(request.method==='POST'){
      const sig = request.headers.get('x-signature-ed25519');
      const ts  = request.headers.get('x-signature-timestamp');
      const bodyText = await request.text();

      const ok = await verifyDiscord(env.DISCORD_PUBLIC_KEY, sig, ts, bodyText);
      if(!ok) return new Response('invalid signature', {status:401});

      const i = JSON.parse(bodyText);
      if(i.type === 1) return j({type:1}); // PING -> PONG

      if(i.type === 2){ // ApplicationCommand
        const name = i?.data?.name;
        const guild_id = i?.guild_id || 'dm';
        const user_id  = String(i?.member?.user?.id || i?.user?.id || 'unknown');
        if(guild_id==='dm') return j({type:4, data:{flags:64, content:"请在服务器内使用命令。"}});
        if(name==='checkin') return handleCheckin(env.db, guild_id, user_id);
        if(name==='board')   return handleBoard(env.db, guild_id);
        if(name==='leaveday')return handleLeave(env.db, guild_id, user_id);
        return j({type:4, data:{flags:64, content:"未知命令。"}});
      }
      return new Response('ok');
    }
    return new Response('Hello from Discord Check-in Worker');
  }
}