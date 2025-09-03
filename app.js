/* ================= Deterministic demo data ================= */
const RNG = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(123456);
const rand = (min,max) => Math.round((min+(max-min)*RNG())*10)/10;
const randi = (min,max) => Math.floor(min + (max-min+1)*RNG());

const QUARTERS = ["2024-10","2025-01","2025-04","2025-07"];
const FIRSTS = ["Millie","Jack","Ben","Louisa","Ollie","Oscar","Eli","Kye","Olivia","George","Harry","Tom","Evie","Charlie","Aidan","Lewi","Nate","Willow","Sam","Tyler","Thomas","Finley","Imogen","Poppy","Noah","Maya","Isaac","Ruby","Theo","Lily","Henry","Sofia","Leo"];
const LASTS  = ["Hixon","Harrison","Dobson","Hamilton","Porteous","Knowles","Gales","Bouttell","Metcalfe","Reed","Sheen","Hartshorne","Goodman","Curry","Robson","O’Rourke","Suggitt","Doherty","Scott","Perkins","Hudson","Hall","Marsden","Balderson","Parker","Hill","Stone","Bennett","Morris","Wright","Kelly","Brooks","Shaw","Foster","Cooper","James"];

function makeGolfer(i){
  const f = FIRSTS[i % FIRSTS.length], l = LASTS[i % LASTS.length];
  const dobYear = randi(2008, 2014);
  const dob = `${dobYear}-${String(randi(1,12)).padStart(2,'0')}-${String(randi(1,28)).padStart(2,'0')}`;
  const age = 2025 - dobYear;
  const baseSG = rand(0.0, 2.0);
  const putt = Math.max(-0.5, Math.min(1.2, rand(0.0, 0.8)));
  const hi = Math.max(0, Math.round((8 - baseSG*2 + rand(-0.5,1.0))*10)/10);

  const sg = QUARTERS.map((q,idx)=>({
    d:q,
    total: Math.round((baseSG + (idx-2)*0.1 + rand(-0.2,0.2))*10)/10,
    tee:   Math.round(rand(-0.3,0.9)*10)/10,
    approach: Math.round(rand(-0.2,0.8)*10)/10,
    short: Math.round(rand(-0.2,0.6)*10)/10,
    putting: Math.round((putt + (idx-1)*0.05 + rand(-0.15,0.15))*10)/10
  }));

  const phys = QUARTERS.map((q,idx)=>{
    const chs = randi(92,108) + idx;
    const ball = chs + randi(40,46);
    return { d:q, chs, ball, cmj:randi(28,40), bj:randi(200,260), height:randi(150,190), weight:randi(45,85) };
  });

  const ratings = QUARTERS.map(q=>({
    d:q, holing:randi(5,9), short:randi(5,9), wedge:randi(5,9), flight:randi(5,9), plan:randi(5,9)
  }));

  const attendance = QUARTERS.map(q=>({
    d:q, group:randi(0,3), one1:randi(0,3)
  }));

  return { id:i+1, name:`${f} ${l}`, dob, age, hi, sg, phys, ratings, attendance };
}

const state = {
  golfers: Array.from({length:40}, (_,i)=>makeGolfer(i)),
  role: null,
  loggedGolferId: 1,
  currentGolfer: null,
  compare: {
    dateWindow: "This Cycle",
    columns: ["DOB","Age","SG Total","SG Putting","Ball Speed","CHS","Att (G/I)"],
    sortKey: "sg_total",
    sortDir: -1
  }
};

/* ================= Helpers ================= */
const last = arr => arr[arr.length-1];
const avg = nums => Math.round((nums.reduce((a,b)=>a+b,0)/nums.length)*10)/10;
const fmt = n => (n==null || Number.isNaN(n)) ? "—" : n;
function qWindowDates(win){
  if(win==="This Cycle") return QUARTERS.slice(-1);
  if(win==="90 days")    return QUARTERS.slice(-1);
  if(win==="6 months")   return QUARTERS.slice(-2);
  return QUARTERS;
}
function delta(curr, prev){
  if(curr==null || prev==null || Number.isNaN(curr) || Number.isNaN(prev)) return null;
  return Math.round((curr - prev) * 10) / 10;
}
function dBadge(d){
  if(d===null) return "";
  if(d>0) return ` <span class="badge-up">+${d}</span>`;
  if(d<0) return ` <span class="badge-down">−${Math.abs(d)}</span>`;
  return ` <span class="badge-flat">±0</span>`;
}
function toCSV(rows){ return rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"); }
function download(filename, text){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'text/csv'}));
  a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
function spark(values, w=180, h=48, cls="spark"){
  if(!values || !values.length) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const pad = 6, iw = w - pad*2, ih = h - pad*2;
  const sx = i => pad + (i/(values.length-1))*iw;
  const sy = v => pad + ih - ((v-min)/(max-min||1))*ih;
  const d = values.map((v,i)=>(i?`L ${sx(i)} ${sy(v)}`:`M ${sx(i)} ${sy(v)}`)).join(" ");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path class="${cls}" d="${d}"/></svg>`;
}

/* ================= Correlation helpers ================= */
const METRIC_OPTIONS = [
  { key:"age",label:"Age",getter:(g)=>g.age },
  { key:"dob_year",label:"DOB (year)",getter:(g)=>Number(g.dob.split("-")[0]) },
  { key:"hi",label:"Handicap Index",getter:(g)=>g.hi },
  { key:"sg_total",label:"SG Total",getter:(g,win)=>pickWindow(g.sg,win)?.total??null },
  { key:"sg_putt",label:"SG Putting",getter:(g,win)=>pickWindow(g.sg,win)?.putting??null },
  { key:"sg_tee",label:"SG Tee",getter:(g,win)=>pickWindow(g.sg,win)?.tee??null },
  { key:"sg_app",label:"SG Approach",getter:(g,win)=>pickWindow(g.sg,win)?.approach??null },
  { key:"sg_short",label:"SG Short",getter:(g,win)=>pickWindow(g.sg,win)?.short??null },
  { key:"ball",label:"Ball Speed",getter:(g,win)=>pickWindow(g.phys,win)?.ball??null },
  { key:"chs",label:"CHS",getter:(g,win)=>pickWindow(g.phys,win)?.chs??null },
  { key:"cmj",label:"CMJ",getter:(g,win)=>pickWindow(g.phys,win)?.cmj??null },
  { key:"bj",label:"BJ",getter:(g,win)=>pickWindow(g.phys,win)?.bj??null },
  { key:"height",label:"Height",getter:(g,win)=>pickWindow(g.phys,win)?.height??null },
  { key:"weight",label:"Weight",getter:(g,win)=>pickWindow(g.phys,win)?.weight??null },
  { key:"att_g",label:"Attendance – Group",getter:(g,win)=>sumAtt(g,win).group },
  { key:"att_1to1",label:"Attendance – 1:1",getter:(g,win)=>sumAtt(g,win).one1 }
];
function pickWindow(arr, win){
  const w=qWindowDates(win); const inW=arr.filter(r=>w.includes(r.d));
  return inW[inW.length-1]||last(arr);
}
function sumAtt(g, win){
  const w=qWindowDates(win); const atW=g.attendance.filter(a=>w.includes(a.d));
  return { group:atW.reduce((x,a)=>x+a.group,0), one1:atW.reduce((x,a)=>x+a.one1,0) };
}
function pearson(xs,ys){
  const n=Math.min(xs.length,ys.length); if(n<2) return NaN;
  let sx=0,sy=0,sxx=0,syy=0,sxy=0,k=0;
  for(let i=0;i<n;i++){ const x=xs[i],y=ys[i];
    if(x==null||y==null||Number.isNaN(x)||Number.isNaN(y)) continue;
    k++; sx+=x; sy+=y; sxx+=x*x; syy+=y*y; sxy+=x*y;
  }
  if(k<2) return NaN;
  const cov=sxy/k-(sx/k)*(sy/k);
  const vx=sxx/k-(sx/k)*(sx/k);
  const vy=syy/k-(sy/k)*(sy/k);
  const denom=Math.sqrt(vx*vy);
  return denom?cov/denom:NaN;
}
function scatterSVG(points,w=720,h=420,p=34){
  if(!points.length) return "<div class='muted'>No points.</div>";
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const gx=v=>p+(xmax===xmin?0.5:(v-xmin)/(xmax-xmin))*(w-2*p);
  const gy=v=>h-p-(ymax===ymin?0.5:(v-ymin)/(ymax-ymin))*(h-2*p);
  const dots=points.map(pt=>`<circle cx="${gx(pt.x)}" cy="${gy(pt.y)}" r="3" fill="#000" opacity="0.7"><title>${pt.label}: (${pt.x}, ${pt.y})</title></circle>`).join("");
  const axes=`<line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#ccc"/><line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" stroke="#ccc"/>`;
  return `<svg width="${w}" height="${h}">${axes}${dots}</svg>`;
}

/* ================= Navigation + Guards ================= */
function impersonate(role){
  state.role = role;
  document.getElementById("whoami").textContent="Role: "+role;
  const nav=document.getElementById("roleNav"); nav.innerHTML="";
  let pages=[];
  if(role==="golfer") pages=["Dashboard","SG Detail","Physical Detail","Coach Ratings Detail","Attendance Detail","My Profile"];
  if(role==="coach")  pages=["Compare","Correlations"];
  if(role==="admin")  pages=["Admin Dashboard","Correlations"];
  pages.forEach(p=>{
    const b=document.createElement("button");
    b.textContent=p;
    b.onclick=()=>navTo(p.toLowerCase().replace(/ /g,"-"));
    nav.appendChild(b);
  });
  if(pages.length) navTo(pages[0].toLowerCase().replace(/ /g,"-"));
}

function navTo(view){
  const main=document.getElementById("mainContent");

  // restrict coach/admin-only pages
  const coachOnly=new Set(["compare","profile","correlations","admin-dashboard"]);
  if(coachOnly.has(view) && !(state.role==="coach" || state.role==="admin")){
    main.innerHTML="<h1>Not authorized</h1><p>This view is only available to coaches or admins.</p>";
    return;
  }

  /* ======= Golfer: Dashboard ======= */
  if (view==="dashboard"){
    const g = getLoggedGolfer();
    const sgTotals = g.sg.map(s=>s.total);
    const physBall = g.phys.map(p=>p.ball), physCHS = g.phys.map(p=>p.chs);
    const ratingAvg = g.ratings.map(r=>avg([r.holing,r.short,r.wedge,r.flight,r.plan]));
    const attSum = g.attendance.reduce((a,c)=>({group:a.group+c.group,one1:a.one1+c.one1}),{group:0,one1:0});
    const nextUpdate = "2025-10-01";

    main.innerHTML = `
      <h1>Golfer Dashboard</h1>
      <div class="card"><strong>Welcome, ${g.name.split(" ")[0]}.</strong> Next required update: <b>${nextUpdate}</b>.</div>
      <div class="grid grid-3">
        <div class="card" onclick="navTo('hi-detail')" style="cursor:pointer" title="Handicap detail">
          <div class="kpi">${fmt(g.hi)} <span class="muted">HI</span></div>
          <div class="muted">Handicap Index – click for detail</div>
        </div>

        <div class="card" onclick="navTo('sg-detail')" style="cursor:pointer" title="SG details">
          <div class="sparkwrap">
            ${spark(sgTotals,200,48,"spark")}
            <div><div class="kpi">${fmt(last(sgTotals))}</div><div class="muted">SG Total (last 4) – click</div></div>
          </div>
        </div>

        <div class="card" onclick="navTo('physical-detail')" style="cursor:pointer" title="Physical details">
          <div class="sparkwrap">
            ${spark(physBall,200,48,"spark")}
            ${spark(physCHS,200,48,"spark2")}
            <div><div class="kpi">${fmt(last(physBall))} <span class="muted">mph</span></div><div class="muted">Ball Speed / CHS – click</div></div>
          </div>
        </div>

        <div class="card" onclick="navTo('coach-ratings-detail')" style="cursor:pointer" title="Coach ratings details">
          <div class="sparkwrap">
            ${spark(ratingAvg,200,48,"spark")}
            <div><div class="kpi">${fmt(last(ratingAvg))}</div><div class="muted">Coach Rating (avg) – click</div></div>
          </div>
        </div>

        <div class="card" onclick="navTo('attendance-detail')" style="cursor:pointer" title="Attendance details">
          <div class="kpi">${attSum.group}/${attSum.one1}</div>
          <div class="muted">Attendance (Group / 1:1) – click</div>
        </div>

        <div class="card">
          <h3>Quick Links</h3>
          <div class="grid grid-2">
            <button class="btn" onclick="navTo('my-profile')">My Profile</button>
            <button class="btn" onclick="navTo('sg-detail')">SG Detail</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  /* ======= Golfer: Details ======= */
  if (view==="hi-detail"){
    const g = getLoggedGolfer();
    main.innerHTML = `
      <h1>Handicap – Detail</h1>
      <div class="card">Current HI: <b>${fmt(g.hi)}</b></div>
      <p class="muted">Future: show England Golf sync history here.</p>
      <button class="btn" onclick="navTo('dashboard')">Back</button>
    `;
    return;
  }

  if (view==="sg-detail"){
    const g = getLoggedGolfer();
    const rows = g.sg.map((s,i)=>`
      <tr><td>${s.d}</td><td>${fmt(s.total)}</td><td>${fmt(s.tee)}</td><td>${fmt(s.approach)}</td><td>${fmt(s.short)}</td><td>${fmt(s.putting)}</td><td>${dBadge(delta(s.total,g.sg[i-1]?.total??null))}</td></tr>
    `).join("");
    main.innerHTML = `
      <h1>Strokes Gained – Detail</h1>
      <div class="card">${spark(g.sg.map(s=>s.total),380,60,"spark")}<div class="muted">SG Total trend</div></div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Date</th><th>Total</th><th>Tee</th><th>Approach</th><th>Short</th><th>Putting</th><th>Δ Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button class="btn" onclick="navTo('dashboard')">Back</button>
    `;
    return;
  }

  if (view==="physical-detail"){
    const g = getLoggedGolfer();
    const rows = g.phys.map((p,i)=>`
      <tr><td>${p.d}</td><td>${p.chs}</td><td>${p.ball}</td><td>${p.cmj}</td><td>${p.bj}</td><td>${p.height}</td><td>${p.weight}</td><td>${dBadge(delta(p.ball,g.phys[i-1]?.ball??null))}</td></tr>
    `).join("");
    main.innerHTML = `
      <h1>Physical – Detail</h1>
      <div class="card">
        <div class="sparkwrap">
          ${spark(g.phys.map(p=>p.ball),260,60,"spark")}
          ${spark(g.phys.map(p=>p.chs),260,60,"spark2")}
          <div><div class="muted">Ball Speed (yellow) with CHS overlay (black)</div></div>
        </div>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Date</th><th>CHS</th><th>Ball</th><th>CMJ</th><th>BJ</th><th>Height</th><th>Weight</th><th>Δ Ball</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button class="btn" onclick="navTo('dashboard')">Back</button>
    `;
    return;
  }

  if (view==="coach-ratings-detail"){
    const g = getLoggedGolfer();
    const rows = g.ratings.map((r,i)=>{
      const prev = g.ratings[i-1];
      const d = prev ? delta(avg([r.holing,r.short,r.wedge,r.flight,r.plan]), avg([prev.holing,prev.short,prev.wedge,prev.flight,prev.plan])) : null;
      return `<tr><td>${r.d}</td><td>${r.holing}</td><td>${r.short}</td><td>${r.wedge}</td><td>${r.flight}</td><td>${r.plan}</td><td>${dBadge(d)}</td></tr>`;
    }).join("");
    main.innerHTML = `
      <h1>Coach Ratings – Detail</h1>
      <div class="card">${spark(g.ratings.map(r=>avg([r.holing,r.short,r.wedge,r.flight,r.plan])),380,60,"spark")}<div class="muted">Average rating trend</div></div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Date</th><th>Holing</th><th>Short</th><th>Wedge</th><th>Flight</th><th>Plan</th><th>Δ Avg</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button class="btn" onclick="navTo('dashboard')">Back</button>
    `;
    return;
  }

  if (view==="attendance-detail"){
    const g = getLoggedGolfer();
    const rows = g.attendance.map(a=>`<tr><td>${a.d}</td><td>${a.group}</td><td>${a.one1}</td></tr>`).join("");
    main.innerHTML = `
      <h1>Attendance – Detail</h1>
      <div class="card">
        <table class="table">
          <thead><tr><th>Date</th><th>Group</th><th>1:1</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button class="btn" onclick="navTo('dashboard')">Back</button>
    `;
    return;
  }

  if (view==="my-profile"){
    const g = getLoggedGolfer();
    const sgRows = g.sg.map(s=>`<tr><td>${s.d}</td><td>${s.total}</td><td>${s.tee}</td><td>${s.approach}</td><td>${s.short}</td><td>${s.putting}</td></tr>`).join("");
    const physRows = g.phys.map(p=>`<tr><td>${p.d}</td><td>${p.chs}</td><td>${p.ball}</td><td>${p.cmj}</td><td>${p.bj}</td><td>${p.height}</td><td>${p.weight}</td></tr>`).join("");
    const attRows = g.attendance.map(a=>`<tr><td>${a.d}</td><td>${a.group}</td><td>${a.one1}</td></tr>`).join("");
    main.innerHTML = `
      <h1>My Profile</h1>
      <div class="card"><strong>Handicap:</strong> ${fmt(g.hi)} &nbsp;|&nbsp; <strong>DOB:</strong> ${g.dob} &nbsp;|&nbsp; <strong>Age:</strong> ${g.age}</div>
      <div class="card"><h2>Strokes Gained</h2><table class="table"><thead><tr><th>Date</th><th>Total</th><th>Tee</th><th>Approach</th><th>Short</th><th>Putting</th></tr></thead><tbody>${sgRows}</tbody></table></div>
      <div class="card"><h2>Physical</h2><table class="table"><thead><tr><th>Date</th><th>CHS</th><th>Ball</th><th>CMJ</th><th>BJ</th><th>Height</th><th>Weight</th></tr></thead><tbody>${physRows}</tbody></table></div>
      <div class="card"><h2>Psych</h2><p class="muted">Placeholder – will link to your psych site/API.</p></div>
      <div class="card"><h2>Attendance</h2><table class="table"><thead><tr><th>Date</th><th>Group</th><th>1:1</th></tr></thead><tbody>${attRows}</tbody></table></div>
      <button class="btn" onclick="navTo('dashboard')">Back</button>
    `;
    return;
  }

  /* ======= Coach/Admin: Correlations ======= */
  if (view === "correlations"){ renderCorrelations(main); return; }

  /* ======= Admin Dashboard ======= */
  if (view === "admin-dashboard"){
    const gcount=state.golfers.length, coaches=4, users=gcount+coaches+1;
    const nextCycle="2025-10-01", compliance=0.78;
    main.innerHTML=`
      <h1>Admin Dashboard</h1>
      <div class="grid grid-3">
        <div class="card"><div class="kpi">${users}</div><div class="muted">Total Users</div></div>
        <div class="card"><div class="kpi">${gcount}</div><div class="muted">Golfers</div></div>
        <div class="card"><div class="kpi">${coaches}</div><div class="muted">Coaches</div></div>
        <div class="card"><div class="kpi">${(compliance*100|0)}%</div><div class="muted">Last Cycle Compliance</div></div>
        <div class="card"><div class="kpi">${nextCycle}</div><div class="muted">Next Update Cycle</div></div>
        <div class="card"><h3>Tools</h3><div class="grid grid-2">
          <button class="btn" onclick="navTo('correlations')">Correlations</button>
          <button class="btn" onclick="navTo('compare')">Compare</button>
        </div></div>
      </div>
      <p class="muted">Note: Real admin controls come with Supabase.</p>
    `; return;
  }

  /* ======= Coach: Compare / Profile ======= */
  if (view==="compare"){ renderCompare(main); return; }

  if (view==="profile"){
    const g = state.currentGolfer;
    if(!g){ main.innerHTML = "<p>No golfer selected.</p>"; return; }
    const sgRows = g.sg.map(s=>`<tr><td>${s.d}</td><td>${s.total}</td><td>${s.tee}</td><td>${s.approach}</td><td>${s.short}</td><td>${s.putting}</td></tr>`).join("");
    const physRows = g.phys.map(p=>`<tr><td>${p.d}</td><td>${p.chs}</td><td>${p.ball}</td><td>${p.cmj}</td><td>${p.bj}</td><td>${p.height}</td><td>${p.weight}</td></tr>`).join("");
    const attRows = g.attendance.map(a=>`<tr><td>${a.d}</td><td>${a.group}</td><td>${a.one1}</td></tr>`).join("");
    main.innerHTML = `
      <h1>${g.name} – Profile</h1>
      <div class="card"><strong>Handicap:</strong> ${fmt(g.hi)} &nbsp;|&nbsp; <strong>DOB:</strong> ${g.dob} &nbsp;|&nbsp; <strong>Age:</strong> ${g.age}</div>
      <div class="card"><h2>Strokes Gained</h2><table class="table"><thead><tr><th>Date</th><th>Total</th><th>Tee</th><th>Approach</th><th>Short</th><th>Putting</th></tr></thead><tbody>${sgRows}</tbody></table></div>
      <div class="card"><h2>Physical</h2><table class="table"><thead><tr><th>Date</th><th>CHS</th><th>Ball</th><th>CMJ</th><th>BJ</th><th>Height</th><th>Weight</th></tr></thead><tbody>${physRows}</tbody></table></div>
      <div class="card"><h2>Psych</h2><p class="muted">Placeholder – will link to your psych site/API.</p></div>
      <div class="card"><h2>Attendance</h2><table class="table"><thead><tr><th>Date</th><th>Group</th><th>1:1</th></tr></thead><tbody>${attRows}</tbody></table></div>
      <button class="btn" onclick="navTo('compare')">Back to Compare</button>
    `;
    return;
  }

  // fallback
  main.innerHTML = `<h1>${view}</h1><p>Placeholder view.</p>`;
}

function getLoggedGolfer(){ return state.golfers.find(x=>x.id===state.loggedGolferId) || state.golfers[0]; }
function openProfile(id){ state.currentGolfer = state.golfers.find(x=>x.id===id); navTo("profile"); }

/* ===== Coach → Compare (sortable any header, deltas, DOB/Age/Attendance) ===== */
function renderCompare(main){
  const colsAll = ["DOB","Age","HI","SG Total","SG Putting","SG Tee","SG Approach","SG Short","Ball Speed","CHS","CMJ","BJ","Height","Weight","Att (G/I)"];
  const selected = new Set(state.compare.columns);
  const windowDates = qWindowDates(state.compare.dateWindow);

  const rows = state.golfers.map(g=>{
    const sgW = g.sg.filter(s=>windowDates.includes(s.d));
    const phW = g.phys.filter(p=>windowDates.includes(p.d));
    const atW = g.attendance.filter(a=>windowDates.includes(a.d));
    const sgC = sgW[sgW.length-1] || last(g.sg), sgP = sgW[sgW.length-2] || g.sg[g.sg.length-2] || null;
    const phC = phW[phW.length-1] || last(g.phys), phP = phW[phW.length-2] || g.phys[g.phys.length-2] || null;
    const attG = atW.reduce((x,a)=>x+a.group,0), attI = atW.reduce((x,a)=>x+a.one1,0);

    return {
      id:g.id, name:g.name, dob:g.dob, age:g.age, hi:g.hi,
      sg_total: sgC?.total ?? null, d_sg_total: delta(sgC?.total, sgP?.total ?? null),
      sg_putt:  sgC?.putting ?? null, d_sg_putt: delta(sgC?.putting, sgP?.putting ?? null),
      sg_tee:   sgC?.tee ?? null,     d_sg_tee:  delta(sgC?.tee, sgP?.tee ?? null),
      sg_app:   sgC?.approach ?? null,d_sg_app:  delta(sgC?.approach, sgP?.approach ?? null),
      sg_short: sgC?.short ?? null,   d_sg_short:delta(sgC?.short, sgP?.short ?? null),
      ball:     phC?.ball ?? null,    d_ball:    delta(phC?.ball, phP?.ball ?? null),
      chs:      phC?.chs ?? null,     d_chs:     delta(phC?.chs, phP?.chs ?? null),
      cmj:      phC?.cmj ?? null,     d_cmj:     delta(phC?.cmj, phP?.cmj ?? null),
      bj:       phC?.bj ?? null,      d_bj:      delta(phC?.bj,  phP?.bj  ?? null),
      height:   phC?.height ?? null,  d_height:  delta(phC?.height, phP?.height ?? null),
      weight:   phC?.weight ?? null,  d_weight:  delta(phC?.weight, phP?.weight ?? null),
      att_g: attG, att_i: attI
    };
  });

  let sortKey = state.compare.sortKey, sortDir = state.compare.sortDir;
  function sortRows(){
    rows.sort((a,b)=>{
      const va=a[sortKey], vb=b[sortKey];
      if(va==null && vb==null) return 0;
      if(va==null) return 1;
      if(vb==null) return -1;
      if(typeof va==="number" && typeof vb==="number") return sortDir*(va - vb);
      return sortDir*String(va).localeCompare(String(vb));
    });
  }
  sortRows();

  const head = (label,key)=> selected.has(label) ? `<th role="button" onclick="__cmpSort('${key}')">${label}</th>` : "";
  const cell = (label,val)=> selected.has(label) ? `<td>${fmt(val)}</td>` : "";
  const cellD = (label,val,dk,row)=> selected.has(label) ? `<td>${fmt(val)}${dBadge(row[dk])}</td>` : "";

  window.__cmpSort = function(key){
    if(sortKey===key) sortDir *= -1; else { sortKey = key; sortDir = -1; }
    state.compare.sortKey = sortKey; state.compare.sortDir = sortDir;
    sortRows(); render();
  };

  window.__cmpCSV = function(){
    const headRow = ["Rank","Name", ...colsAll.filter(c=>selected.has(c))];
    const body = rows.map((r,i)=>{
      const map = {
        "DOB":r.dob,"Age":r.age,"HI":r.hi,"SG Total":r.sg_total,"SG Putting":r.sg_putt,
        "SG Tee":r.sg_tee,"SG Approach":r.sg_app,"SG Short":r.sg_short,
        "Ball Speed":r.ball,"CHS":r.chs,"CMJ":r.cmj,"BJ":r.bj,"Height":r.height,"Weight":r.weight,
        "Att (G/I)":`${r.att_g}/${r.att_i}`
      };
      return [i+1, r.name, ...colsAll.filter(c=>selected.has(c)).map(c=>map[c])];
    });
    download("compare.csv", toCSV([headRow, ...body]));
  };

  function render(){
    main.innerHTML = `
      <h1>Compare Golfers</h1>
      <div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <label>Date Window:
          <select id="cmpWin">
            ${["This Cycle","90 days","6 months","All"].map(w=>`<option ${w===state.compare.dateWindow?"selected":""}>${w}</option>`).join("")}
          </select>
        </label>

        <details>
          <summary style="cursor:pointer">Columns</summary>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px">
            ${colsAll.map(c=>`<label><input type="checkbox" ${selected.has(c)?"checked":""} data-col="${c}"/> ${c}</label>`).join("")}
          </div>
        </details>

        <button class="btn" onclick="__cmpCSV()">Export CSV</button>
      </div>

      <div class="card" style="overflow:auto">
        <table class="table">
          <thead><tr>
            <th>#</th><th role="button" onclick="__cmpSort('name')">Name</th>
            ${head("DOB","dob")}${head("Age","age")}${head("HI","hi")}
            ${head("SG Total","sg_total")}${head("SG Putting","sg_putt")}
            ${head("SG Tee","sg_tee")}${head("SG Approach","sg_app")}${head("SG Short","sg_short")}
            ${head("Ball Speed","ball")}${head("CHS","chs")}${head("CMJ","cmj")}${head("BJ","bj")}
            ${head("Height","height")}${head("Weight","weight")}
            ${head("Att (G/I)","att_g")}
            <th>Profile</th>
          </tr></thead>
          <tbody>
            ${rows.map((r,i)=>`
              <tr>
                <td>${i+1}</td>
                <td>${r.name}</td>
                ${cell("DOB",r.dob)}${cell("Age",r.age)}${cell("HI",r.hi)}
                ${cellD("SG Total",r.sg_total,"d_sg_total",r)}
                ${cellD("SG Putting",r.sg_putt,"d_sg_putt",r)}
                ${cellD("SG Tee",r.sg_tee,"d_sg_tee",r)}
                ${cellD("SG Approach",r.sg_app,"d_sg_app",r)}
                ${cellD("SG Short",r.sg_short,"d_sg_short",r)}
                ${cellD("Ball Speed",r.ball,"d_ball",r)}
                ${cellD("CHS",r.chs,"d_chs",r)}
                ${cellD("CMJ",r.cmj,"d_cmj",r)}
                ${cellD("BJ",r.bj,"d_bj",r)}
                ${cellD("Height",r.height,"d_height",r)}
                ${cellD("Weight",r.weight,"d_weight",r)}
                ${selected.has("Att (G/I)")?`<td>${r.att_g}/${r.att_i}</td>`:""}
                <td><button class="btn" onclick="openProfile(${r.id})">View</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("cmpWin").onchange = e=>{
      state.compare.dateWindow = e.target.value;
      renderCompare(main);
    };
    main.querySelectorAll('input[type="checkbox"][data-col]').forEach(cb=>{
      cb.onchange = (e)=>{
        const col = e.target.getAttribute("data-col");
        if(e.target.checked) selected.add(col); else selected.delete(col);
        state.compare.columns = Array.from(selected);
        render();
      };
    });
  }

  render();
}

/* === Correlations page renderer === */
function renderCorrelations(main){
  const golfers=state.golfers;
  state.analyze=state.analyze||{x:"age",y:"sg_total",win:state.compare.dateWindow,perQuarter:false,selection:new Set(golfers.map(g=>g.id))};
  const {x,y,win,perQuarter,selection}=state.analyze;

  function getVal(g,key,w){const opt=METRIC_OPTIONS.find(m=>m.key===key);return opt?opt.getter(g,w):null;}

  let points=[];
  if(!perQuarter){
    golfers.forEach(g=>{
      if(!selection.has(g.id)) return;
      const xv=getVal(g,x,win), yv=getVal(g,y,win);
      if(xv!=null&&yv!=null) points.push({x:xv,y:yv,label:g.name});
    });
  } else {
    const wdates=qWindowDates(win);
    golfers.forEach(g=>{
      if(!selection.has(g.id)) return;
      wdates.forEach(d=>{
        const from={sg:g.sg.find(r=>r.d===d),phys:g.phys.find(r=>r.d===d),att:g.attendance.find(r=>r.d===d)};
        const table={age:g.age,dob_year:Number(g.dob.split("-")[0]),hi:g.hi,
          sg_total:from.sg?.total,sg_putt:from.sg?.putting,sg_tee:from.sg?.tee,sg_app:from.sg?.approach,sg_short:from.sg?.short,
          ball:from.phys?.ball,chs:from.phys?.chs,cmj:from.phys?.cmj,bj:from.phys?.bj,height:from.phys?.height,weight:from.phys?.weight,
          att_g:from.att?.group??0,att_1to1:from.att?.one1??0};
        const xv=table[x],yv=table[y];
        if(xv!=null&&yv!=null) points.push({x:xv,y:yv,label:`${g.name} • ${d}`});
      });
    });
  }
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const r=pearson(xs,ys); const rTxt=Number.isNaN(r)?"n/a":r.toFixed(2);

  const optsX=METRIC_OPTIONS.map(o=>`<option value="${o.key}" ${o.key===x?"selected":""}>${o.label}</option>`).join("");
  const optsY=METRIC_OPTIONS.map(o=>`<option value="${o.key}" ${o.key===y?"selected":""}>${o.label}</option>`).join("");
  const list=golfers.map(g=>`<label style="min-width:180px"><input type="checkbox" data-gid="${g.id}" ${selection.has(g.id)?"checked":""}/> ${g.name}</label>`).join("");

  main.innerHTML=`
    <h1>Correlations</h1>
    <div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
      <label>X:<select id="xSel">${optsX}</select></label>
      <label>Y:<select id="ySel">${optsY}</select></label>
      <label>Date Window:<select id="winSel">${["This Cycle","90 days","6 months","All"].map(w=>`<option ${w===win?"selected":""}>${w}</option>`).join("")}</select></label>
      <label><input type="checkbox" id="perQ" ${perQuarter?"checked":""}/> Per quarter points</label>
      <button class="btn" id="selAll">All</button>
      <button class="btn" id="selNone">None</button>
      <div class="muted">Pearson r: <b>${rTxt}</b></div>
    </div>

    <div class="card">
      ${scatterSVG(points, 720, 420, 34)}
      <div class="muted" style="margin-top:6px">
        Hint: try X=<i>DOB (year)</i> vs Y=<i>SG Total</i>, or X=<i>Age</i> vs Y=<i>Ball Speed</i>.
      </div>
    </div>

    <div class="card">
      <details open>
        <summary style="cursor:pointer"><b>Select golfers</b></summary>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">${list}</div>
      </details>
    </div>
  `;

  // Wire controls
  document.getElementById("xSel").onchange = e => { state.analyze.x = e.target.value; renderCorrelations(main); };
  document.getElementById("ySel").onchange = e => { state.analyze.y = e.target.value; renderCorrelations(main); };
  document.getElementById("winSel").onchange = e => { state.analyze.win = e.target.value; renderCorrelations(main); };
  document.getElementById("perQ").onchange  = e => { state.analyze.perQuarter = e.target.checked; renderCorrelations(main); };
  document.getElementById("selAll").onclick = () => { state.analyze.selection = new Set(golfers.map(g=>g.id)); renderCorrelations(main); };
  document.getElementById("selNone").onclick= () => { state.analyze.selection = new Set(); renderCorrelations(main); };
  main.querySelectorAll('input[type="checkbox"][data-gid]').forEach(cb=>{
    cb.onchange = e => {
      const id = Number(e.target.getAttribute("data-gid"));
      if (e.target.checked) selection.add(id); else selection.delete(id);
      renderCorrelations(main);
    };
  });
}

/* ===== Utilities used by coach views ===== */
function getLoggedGolfer(){ return state.golfers.find(x=>x.id===state.loggedGolferId) || state.golfers[0]; }
function openProfile(id){ state.currentGolfer = state.golfers.find(x=>x.id===id); navTo("profile"); }
