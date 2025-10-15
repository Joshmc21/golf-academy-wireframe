/* global loadGolferFromDB, navTo */
document.getElementById('login-btn').addEventListener('click', async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'email' });
  if (error) console.error('Login error:', error);
});

// --- helpers used by Compare view ---
function calcAgeFromDOB(dobStr) {
  if (!dobStr) return null;
  const d = new Date(dobStr + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const years = (Date.now() - d.getTime()) / (365.2425 * 24 * 3600 * 1000);
  return Math.floor(years);
}

async function fetchGolfersForCompare() {
  const { data: golfers, error: golfersErr } = await supabase
    .from('golfers')
    .select('id, dob, hi, created_at')
    .order('id', { ascending: true });

  if (golfersErr || !golfers || golfers.length === 0) return [];

  const ids = golfers.map(g => g.id);

  // Try legacy first (since your project used it), then new; remember which worked
  window.__sgSchema = window.__sgSchema || null;

  async function fetchSG_new() {
    return await supabase
      .from('sg_quarter')
      .select('golfer_id, total, id')
      .in('golfer_id', ids)
      .order('id', { ascending: true });
  }
  async function fetchSG_legacy() {
    return await supabase
      .from('sg_quarter')
      .select('golfer_id, total:sg_total, id')
      .in('golfer_id', ids)
      .order('id', { ascending: true });
  }

  let sgRows = [];
  if (window.__sgSchema === 'new') {
    const { data, error } = await fetchSG_new();
    if (!error) { sgRows = data || []; }
    else { const r = await fetchSG_legacy(); sgRows = r.data || []; window.__sgSchema = 'legacy'; }
  } else if (window.__sgSchema === 'legacy') {
    const { data, error } = await fetchSG_legacy();
    if (!error) { sgRows = data || []; }
    else { const r = await fetchSG_new(); sgRows = r.data || []; window.__sgSchema = 'new'; }
  } else {
    // first run: try legacy, then new
    let r = await fetchSG_legacy();
    if (!r.error && r.data) { sgRows = r.data; window.__sgSchema = 'legacy'; }
    else { r = await fetchSG_new(); sgRows = r.data || []; window.__sgSchema = (!r.error ? 'new' : null); }
  }

  const sgMap = new Map();
  (sgRows || []).forEach(r => {
    const k = r.golfer_id;
    if (!sgMap.has(k)) sgMap.set(k, []);
    sgMap.get(k).push(+r.total || 0);
  });

  const avgLast4 = arr => {
    if (!arr || arr.length === 0) return 0;
    const last4 = arr.slice(-4);
    const sum = last4.reduce((a, b) => a + b, 0);
    return Math.round((sum / last4.length) * 10) / 10;
  };

  return golfers.map((g, i) => ({
    idx: i + 1,
    id: g.id,
    name: 'Demo Golfer',
    dob: g.dob || null,
    age: calcAgeFromDOB(g.dob),
    hi: +(g.hi ?? 0),
    sgTotal: avgLast4(sgMap.get(g.id)),
  }));
}



// Supabase: simple init
const supabaseUrl = "https://syecffopasrwkjonwvdk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWNmZm9wYXNyd2tqb253dmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDgzNTYsImV4cCI6MjA3MzUyNDM1Nn0.JYAD7NaPrZWxTa_V2-jwQI_Kh7p4GaSKFRv65G7Czqs";
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// --- Auth wiring ---
let session = null;

async function initAuth() {
  const { data } = await supabase.auth.getSession();
  session = data?.session ?? null;
  updateAuthUI();

  supabase.auth.onAuthStateChange((_event, sess) => {
    session = sess;
    updateAuthUI();
    if (session) {
      // optional: reload current golfer view after login
      if (typeof window.impersonate === 'function') {
        // use linked golfer if you have it; otherwise fallback to latest
        window.impersonate('golfer');
      }
    }
  });
}

function updateAuthUI() {
  document.getElementById('login-splash').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  const loggedIn = !!session;
  const btnShowLogin = document.getElementById('btnShowLogin');
  const btnLogout = document.getElementById('btnLogout');
  if (btnShowLogin) btnShowLogin.style.display = loggedIn ? 'none' : 'inline-block';
  if (btnLogout) btnLogout.style.display = loggedIn ? 'inline-block' : 'none';
}

// === LOGIN HANDLER ===
document.getElementById('login-btn').addEventListener('click', async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'email' });
  if (error) console.error('Login error:', error);
});

async function loginWithEmail(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function logout() {
  await supabase.auth.signOut();
}

function showLoginSheet(show) {
  const el = document.getElementById('loginSheet');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// Hook up buttons (after DOM ready)
window.addEventListener('DOMContentLoaded', () => {
  initAuth();

  const btnShowLogin = document.getElementById('btnShowLogin');
  const btnCancelLogin = document.getElementById('btnCancelLogin');
  const btnDoLogin = document.getElementById('btnDoLogin');
  const btnLogout = document.getElementById('btnLogout');

  btnShowLogin?.addEventListener('click', () => showLoginSheet(true));
  btnCancelLogin?.addEventListener('click', () => showLoginSheet(false));
  btnDoLogin?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const msg = document.getElementById('loginMsg');
    msg.textContent = '';
    try {
      await loginWithEmail(email, pass);
      showLoginSheet(false);
    } catch (e) {
      msg.textContent = e.message || 'Login failed';
    }
  });
  btnLogout?.addEventListener('click', logout);
});


// Quick test helper you can run in the browser console
window.testSupabase = async () => {
  const { data, error } = await supabase.from("golfers").select("id, hi").limit(1);
  if (error) console.error("Supabase error:", error.message);
  else console.log("Supabase OK:", data);
};

/* ================= App State ================= */
const state = {
  role: null,
  golfers: [],
  loggedGolferId: null,
  currentGolfer: null,
  eggUnlocked: false,
  compare: { columns: ["DOB","Age","HI","SG Total"], dateWindow: "All", sortKey: "sg_total", sortDir: -1 },
};

// --- Quarter labels used across views (string 'YYYY-Q#' or 'YYYY-MM' based) ---
// --- Quarter labels used across views ---
// Default (used only until real data loads), then we overwrite from SG dates
let QUARTERS = ["2024-10","2025-01","2025-04","2025-07"];
window.QUARTERS = QUARTERS;

// Helper to set quarters from loaded golfer data
window.setQuartersFrom = function setQuartersFrom(g) {
  const d = (g?.sg || []).map(r => r.d);
  if (d.length) {
    QUARTERS = d;
    window.QUARTERS = d;
  }
};



// remember which sg_quarter schema worked: 'new' or 'legacy'
window.__sgSchema = window.__sgSchema || null;


// ==== REPLACE ENTIRE loadGolferFromDB WITH THIS ====
window.loadGolferFromDB = async function loadGolferFromDB(userId) {
  try {
    // 0) Coerce to number for safety
    const golferId = Number(userId);
    if (!Number.isFinite(golferId)) {
      console.warn('loadGolferFromDB: userId must be numeric golfer.id. Got:', userId);
      return null;
    }

    // 1) Base golfer row (id, hi, dob, next_update)
    const { data: base, error: baseErr } = await supabase
      .from('golfers')
      .select('id, hi, dob, next_update')
      .eq('id', golferId)
      .single();

    if (baseErr || !base) {
      console.warn('loadGolferFromDB: golfer not found', baseErr);
      return null;
    }

    // 1a) Optional reminder based on next_update (if column/data exists)
    if (base.next_update) {
      const nextUpdate = new Date(base.next_update);
      const daysUntil = Math.ceil((nextUpdate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7 && daysUntil > 0) {
        alert(`⛳ Reminder: Your next update is due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`);
      } else if (daysUntil <= 0) {
        alert('⚠️ Your update is overdue! Please refresh your Handicap Index.');
      }
    }

    // 2) SG (per quarter)
    const { data: sgRows, error: sgErr } = await supabase
      .from('sg_quarter')
      .select('d, total, tee, approach, short, putting')
      .eq('golfer_id', golferId)
      .order('d', { ascending: true })
      .order('id', { ascending: true }); // tie-break

    if (sgErr) console.warn('sg_quarter error:', sgErr);
    const sg = (sgRows || []).map(r => ({
      d: r.d ?? '',
      total: +r.total || 0,
      tee: +r.tee || 0,
      approach: +r.approach || 0,
      short: +r.short || 0,
      putting: +r.putting || 0,
    }));

    // 3) Physical (per quarter)
    const { data: physRows, error: physErr } = await supabase
      .from('phys_quarter')
      .select('d, chs, ball, cmj, bj, height, weight')
      .eq('golfer_id', golferId)
      .order('d', { ascending: true })
      .order('id', { ascending: true });

    if (physErr) console.warn('phys_quarter error:', physErr);
    const phys = (physRows || []).map(r => ({
      d: r.d ?? '',
      chs: +r.chs || 0,
      ball: +r.ball || 0,
      cmj: +r.cmj || 0,
      bj: +r.bj || 0,
      height: +r.height || 0,
      weight: +r.weight || 0,
    }));

    // 4) Coach ratings
    const { data: rateRows, error: rateErr } = await supabase
      .from('coach_ratings')
      .select('d, holing, short, wedge, flight, plan')
      .eq('golfer_id', golferId)
      .order('d', { ascending: true })
      .order('id', { ascending: true });

    if (rateErr) console.warn('coach_ratings error:', rateErr);
    const ratings = (rateRows || []).map(r => ({
      d: r.d ?? '',
      holing: +r.holing || 0,
      short: +r.short || 0,
      wedge: +r.wedge || 0,
      flight: +r.flight || 0,
      plan: +r.plan || 0,
    }));

    // 5) Attendance
    const { data: attRows, error: attErr } = await supabase
      .from('attendance')
      .select('d, group_sess, one1')
      .eq('golfer_id', golferId)
      .order('d', { ascending: true })
      .order('id', { ascending: true });

    if (attErr) console.warn('attendance error:', attErr);
    const attendance = (attRows || []).map(r => ({
      d: r.d ?? '',
      group: +(r.group_sess ?? 0),
      one1: +r.one1 || 0,
    }));

    // 6) Derive age for UI (optional)
    const dobStr = base.dob ?? null;
    let agePrecise = null, age = null;
    if (dobStr) {
      const dobDate = new Date(dobStr + 'T00:00:00Z');
      agePrecise = (Date.now() - dobDate.getTime()) / (365.2425 * 24 * 3600 * 1000);
      agePrecise = Math.round(agePrecise * 10) / 10;
      age = Math.floor(agePrecise);
    }

    console.log('[loadGolferFromDB]', {
      golferId, sg: sg.length, phys: phys.length, ratings: ratings.length, attendance: attendance.length
    });

    return {
      id: golferId,
      name: 'Demo Golfer',
      hi: +(base.hi ?? 0),
      dob: base.dob ?? null,
      next_update: base.next_update ?? null,
      age, agePrecise,
      sg, phys, ratings, attendance,
    };
  } catch (e) {
    console.error('loadGolferFromDB fatal:', e);
    return null;
  }
};
// ==== END REPLACEMENT ====


// === AUTH STATE LISTENER ===
supabase.auth.onAuthStateChange(async (event, session) => {
  const splash = document.getElementById('login-splash');
  const mainContent = document.getElementById('mainContent');

  if (session && session.user) {
    // User is logged in
    splash.classList.add('fade-out');
    setTimeout(() => splash.classList.add('hidden'), 800);
    mainContent.style.display = 'block';
  } else {
    // User not logged in
    splash.classList.remove('hidden');
    mainContent.style.display = 'none';
  }
});


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
  // Identity / static
  { key:"agePrecise",label:"Age (years)",getter:(g)=>g.agePrecise, fmtTick:(v)=>v.toFixed(1) },
  { key:"dob_ts",label:"DOB (date)",getter:(g)=>new Date(g.dob+"T00:00:00Z").getTime(), fmtTick:(v)=>new Date(v).toISOString().slice(0,10) },
  { key:"hi",label:"Handicap Index",getter:(g)=>g.hi },

  // SG (latest in window)
  { key:"sg_total",label:"SG Total",getter:(g,win)=>pickWindow(g.sg,win)?.total??null },
  { key:"sg_putt",label:"SG Putting",getter:(g,win)=>pickWindow(g.sg,win)?.putting??null },
  { key:"sg_tee",label:"SG Tee",getter:(g,win)=>pickWindow(g.sg,win)?.tee??null },
  { key:"sg_app",label:"SG Approach",getter:(g,win)=>pickWindow(g.sg,win)?.approach??null },
  { key:"sg_short",label:"SG Short",getter:(g,win)=>pickWindow(g.sg,win)?.short??null },

  // Physical (latest in window)
  { key:"ball",label:"Ball Speed",getter:(g,win)=>pickWindow(g.phys,win)?.ball??null },
  { key:"chs",label:"CHS",getter:(g,win)=>pickWindow(g.phys,win)?.chs??null },
  { key:"cmj",label:"CMJ",getter:(g,win)=>pickWindow(g.phys,win)?.cmj??null },
  { key:"bj",label:"BJ",getter:(g,win)=>pickWindow(g.phys,win)?.bj??null },
  { key:"height",label:"Height",getter:(g,win)=>pickWindow(g.phys,win)?.height??null },
  { key:"weight",label:"Weight",getter:(g,win)=>pickWindow(g.phys,win)?.weight??null },

  // Attendance (sum in window)
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

// Utilities for chart colors and labels
const colorForIndex = i => `hsl(${(i*57)%360} 70% 35%)`;
const initials = name => name.split(" ").map(s=>s[0]).join("").toUpperCase();

// Scatter with axes, ticks, tooltips, optional labels, hover highlight
function scatterSVG(points, options={}){
  const { w=720, h=420, p=40, showLabels=false, xFmt, yFmt } = options;
  if(!points.length) return "<div class='muted'>No points.</div>";
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const gx=v=>p+(xmax===xmin?0.5:(v-xmin)/(xmax-xmin))*(w-2*p);
  const gy=v=>h-p-(ymax===ymin?0.5:(v-ymin)/(ymax-ymin))*(h-2*p);

  // ticks
  const ticks = (min,max,n=6)=> Array.from({length:n},(_,i)=> min + (i*(max-min))/(n-1) );
  const xt=ticks(xmin,xmax), yt=ticks(ymin,ymax);

  const axes = `
    <line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#ccc"/>
    <line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" stroke="#ccc"/>
    ${xt.map(v=>`<line x1="${gx(v)}" y1="${h-p}" x2="${gx(v)}" y2="${h-p+6}" stroke="#ccc"/>`).join("")}
    ${yt.map(v=>`<line x1="${p-6}" y1="${gy(v)}" x2="${p}" y2="${gy(v)}" stroke="#ccc"/>`).join("")}
    ${xt.map(v=>`<text x="${gx(v)}" y="${h-p+18}" text-anchor="middle" font-size="11">${xFmt?xFmt(v):Math.round(v*10)/10}</text>`).join("")}
    ${yt.map(v=>`<text x="${p-8}" y="${gy(v)+4}" text-anchor="end" font-size="11">${yFmt?yFmt(v):Math.round(v*10)/10}</text>`).join("")}
  `;

  const dots = points.map((pt, i)=>{
    const cx=gx(pt.x), cy=gy(pt.y), id=`pt${i}`;
    const label = showLabels ? `<text x="${cx+6}" y="${cy-6}" font-size="11">${initials(pt.name)}</text>` : "";
    // data-idx used for hover highlight wiring
    return `
      <g class="dot" data-idx="${i}">
        <circle id="${id}" cx="${cx}" cy="${cy}" r="3.5" fill="${pt.color||'#000'}" opacity="0.75">
          <title>${pt.name}: (${pt.x}, ${pt.y})</title>
        </circle>
        ${label}
      </g>
    `;
  }).join("");

  return `<svg class="scatter" width="${w}" height="${h}">${axes}${dots}</svg>`;
}

/* ===== Compare table presets ===== */
const COMPARE_PRESETS = [
  {
    name: "All Core",
    columns: ["DOB","Age","HI","SG Total","SG Putting","SG Tee","SG Approach","SG Short","Ball Speed","CHS","Att (G/I)"],
    sortKey: "sg_total", sortDir: -1
  },
  {
    name: "Tournament Prep",
    columns: ["HI","SG Total","SG Tee","SG Approach","SG Putting","Att (G/I)"],
    sortKey: "sg_total", sortDir: -1
  },
  {
    name: "Physical Block",
    columns: ["Age","Ball Speed","CHS","CMJ","BJ","Height","Weight"],
    sortKey: "ball", sortDir: -1
  },
  {
    name: "Putting Focus",
    columns: ["Age","SG Putting"],
    sortKey: "sg_putt", sortDir: -1
  },
  {
    name: "Approach/Wedge Focus",
    columns: ["Age","SG Approach","SG Short"],
    sortKey: "sg_app", sortDir: -1
  },
  {
    name: "Attendance & Readiness",
    columns: ["Age","Att (G/I)","SG Total"],
    sortKey: "att_g", sortDir: -1
  },
];

/* ================= Navigation + Guards ================= */





function navTo(view){

if (!session) {
  // not logged in: show login and stop navigation
  showLoginSheet(true);
  return;
}

  const main=document.getElementById("mainContent");

  // restrict coach/admin-only pages
  const coachOnly=new Set(["compare","profile","correlations","admin-dashboard","users","cycles","compliance","trends"]);
  if(coachOnly.has(view) && !(state.role==="coach" || state.role==="admin")){
    main.innerHTML="<h1>Not authorized</h1><p>This view is only available to coaches or admins.</p>";
    return;
  }

  /* ======= Golfer pages (unchanged) ======= */
  if (view==="dashboard"){ return renderGolferDashboard(main); }
  if (view==="hi-detail"){ return renderHiDetail(main); }
  if (view==="sg-detail"){ return renderSgDetail(main); }
  if (view==="physical-detail"){ return renderPhysicalDetail(main); }
  if (view==="coach-ratings-detail"){ return renderRatingsDetail(main); }
  if (view==="attendance-detail"){ return renderAttendanceDetail(main); }
  if (view==="my-profile"){ return renderMyProfile(main); }

  /* ======= Admin dashboard + detail sections ======= */
  if (view==="admin-dashboard"){ return renderAdminDashboard(main); }
  if (view==="users"){ return renderAdminUsers(main); }
  if (view==="cycles"){ return renderAdminCycles(main); }
  if (view==="compliance"){ return renderAdminCompliance(main); }

  /* ======= Coach/Admin analytics ======= */
  if (view==="compare"){ return renderCompare(main); }
  if (view==="profile"){ return renderCoachProfile(main); }
  if (view==="correlations"){ return renderCorrelations(main); }
  if (view==="trends"){ return renderTrends(main); }

  // fallback
  main.innerHTML = `<h1>${view}</h1><p>Placeholder view.</p>`;
    // Re-render Easter Egg button after navigation
  if (window.renderEggButton) window.renderEggButton();

}

// === Impersonation / role switcher ===
window.impersonate = async function (role) {
  // 1) record role + small UI hint
  state.role = role;
  const who = document.getElementById("whoami");
  if (who) who.textContent = "Role: " + role;

  // 2) Golfer flow: load from Supabase and show Dashboard
  if (role === "golfer") {
    // fetch the most-recent golfer row and use its numeric id
const { data: latest, error: gErr } = await supabase
  .from('golfers')
  .select('id')
  .order('id', { ascending: false })
  .limit(1);

const golferId = latest?.[0]?.id ?? null;
if (!golferId) {
  console.warn('No golfers found in DB');
  return;
}

const g = await window.loadGolferFromDB(golferId);

    state.currentGolfer = g;
    state.golfers = [g];
    state.loggedGolferId = g?.id ?? null;
    window.setQuartersFrom(g);
    navTo("dashboard"); // render Golfer Dashboard
    return; // done
  }

  // 3) Coach/Admin: build role nav and go to first page
  const nav = document.getElementById("roleNav");
  if (nav) {
    nav.innerHTML = "";
    let pages = [];
    if (role === "coach") pages = ["Compare","Correlations","Trends"];
    if (role === "admin")
      pages = ["Admin Dashboard","Users","Cycles","Compliance","Correlations","Trends"];

    pages.forEach(p => {
      const b = document.createElement("button");
      b.textContent = p;
      b.onclick = () => navTo(p.toLowerCase().replace(/ /g, "-"));
      nav.appendChild(b);
    });

    if (pages.length) navTo(pages[0].toLowerCase().replace(/ /g, "-"));
  }

  if (window.renderEggButton) window.renderEggButton();
};

/* ======== Golfer views (same as before, wrapped in functions) ======== */
function renderGolferDashboard(main){
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
  
  /* ==================== Easter Egg: Chip & Putt (Canvas) ==================== */
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById('eggModal');
  const canvas = document.getElementById('eggCanvas');
  const closeBtn = document.getElementById('eggClose');
  const fab = document.getElementById('eggFab');
  const msgEl = document.getElementById('eggMsg');
  const strokesEl = document.getElementById('eggStrokes');
  const resetBtn = document.getElementById('eggReset');

  if (!canvas) {
    console.warn("eggCanvas element not found — skipping Easter Egg init");
    return;
  }

  const ctx = canvas.getContext('2d');

  // ====== State ======
  let ball, hole, obstacles, dragging = false, aimStart = null, aimEnd = null;
  let vx = 0, vy = 0, animId = null, strokes = 0, finished = false;

  // ====== Unlock demo ======
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'G' || e.key === 'g')) {
      state.eggUnlocked = !state.eggUnlocked;
      renderEggButton();
      const t = state.eggUnlocked
        ? 'Easter Egg unlocked! (⛳ button enabled)'
        : 'Easter Egg hidden.';
      toast(t);
    }
  });

  // ====== Render FAB ======
  function renderEggButton() {
    if (!fab) return;
    const isGolfer = state.role === 'golfer';
    fab.style.display = (isGolfer && state.eggUnlocked) ? 'inline-flex' : 'none';
  }

  const _impersonate = window.impersonate;
  if (typeof _impersonate === 'function') {
    window.impersonate = function (role) { _impersonate(role); renderEggButton(); };
  } else {
    renderEggButton();
  }

  // ====== Game functions ======
  function reset(level = 1) {
    const w = canvas.width, h = canvas.height;
    ball = { x: 120, y: h - 120, r: 8 };
    hole = { x: w - 120, y: 120, r: 12 };
    obstacles = [
      { type: 'sand', x: w / 2 - 60, y: h / 2 - 20, w: 120, h: 40 },
      { type: 'water', x: w / 2 - 20, y: h / 2 + 60, w: 40, h: 120 }
    ];
    vx = vy = 0; strokes = 0; finished = false;
    msgEl.textContent = 'Drag from the ball to aim. Release to putt.';
    updateHUD();
    cancelAnimationFrame(animId);
    draw();
  }

  function updateHUD() {
    strokesEl.textContent = `Strokes: ${strokes}/3`;
  }

  function openModal() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    reset();
    attachCanvasHandlers();
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    detachCanvasHandlers();
    cancelAnimationFrame(animId);
  }

  // ====== Event bindings ======
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (resetBtn) resetBtn.addEventListener('click', () => reset());
  if (fab) fab.addEventListener('click', openModal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.getAttribute('aria-hidden') === 'false') closeModal();
  });

  // ====== Canvas control ======
  function attachCanvasHandlers() {
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onTouchDown, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
  }

  function detachCanvasHandlers() {
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    canvas.removeEventListener('touchstart', onTouchDown);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
  }

  // ====== Helpers ======
  function pt(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * canvas.width / rect.width,
      y: (e.clientY - rect.top) * canvas.height / rect.height
    };
  }

  function tpt(t) {
    const rect = canvas.getBoundingClientRect();
    const touch = t.touches[0] || t.changedTouches[0];
    return {
      x: (touch.clientX - rect.left) * canvas.width / rect.width,
      y: (touch.clientY - rect.top) * canvas.height / rect.height
    };
  }

  function onDown(e) {
    if (finished) return;
    const p = pt(e);
    if (dist(p, ball) <= ball.r + 4) {
      dragging = true; aimStart = { x: ball.x, y: ball.y }; aimEnd = p;
    }
  }

  function onMove(e) {
    if (!dragging) return;
    aimEnd = pt(e);
    draw();
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    puttFromAim();
  }

  function onTouchDown(e) { e.preventDefault(); onDown(e); }
  function onTouchMove(e) { e.preventDefault(); onMove(e); }
  function onTouchEnd(e) { e.preventDefault(); onUp(e); }

  function puttFromAim() {
    if (!aimStart || !aimEnd) return;
    const dx = aimStart.x - aimEnd.x;
    const dy = aimStart.y - aimEnd.y;
    const power = Math.min(200, Math.hypot(dx, dy));
    if (power < 4) { aimStart = aimEnd = null; draw(); return; }
    const k = 0.045;
    vx = k * dx;
    vy = k * dy;
    aimStart = aimEnd = null;
    strokes++;
    updateHUD();
    msgEl.textContent = 'Rolling…';
    animate();
  }

  function animate() {
    cancelAnimationFrame(animId);
    const step = () => {
      const friction = zoneFriction(ball);
      vx *= (1 - friction);
      vy *= (1 - friction);
      ball.x += vx;
      ball.y += vy;

      const pad = 10;
      if (ball.x < pad + ball.r) { ball.x = pad + ball.r; vx = -vx * 0.45; }
      if (ball.x > canvas.width - pad - ball.r) { ball.x = canvas.width - pad - ball.r; vx = -vx * 0.45; }
      if (ball.y < pad + ball.r) { ball.y = pad + ball.r; vy = -vy * 0.45; }
      if (ball.y > canvas.height - pad - ball.r) { ball.y = canvas.height - pad - ball.r; vy = -vy * 0.45; }

      if (Math.hypot(vx, vy) < 0.02) { vx = vy = 0; }

      if (inHole(ball, hole)) {
        finished = true; vx = vy = 0;
        msgEl.textContent = strokes === 1 ? 'ACE! 🥳' :
          strokes === 2 ? 'Birdie! 🔥' :
            strokes === 3 ? 'Par! 🙌' : 'Holed it! 👏';
      } else if (vx === 0 && vy === 0) {
        if (strokes >= 3) { finished = true; msgEl.textContent = 'Out of strokes! Try again.'; }
        else { msgEl.textContent = 'Line it up…'; }
      }

      draw();
      if (!finished && (vx !== 0 || vy !== 0)) animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
  }

  function zoneFriction(b) {
    let f = 0.02;
    for (const z of obstacles) {
      if (b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h) {
        if (z.type === 'sand') f = 0.07;
        if (z.type === 'water') f = 0.12;
      }
    }
    return f;
  }

  function inHole(b, h) {
    const d = Math.hypot(b.x - h.x, b.y - h.y);
    return d < (h.r - 3);
  }

  function dist(p, b) { return Math.hypot(p.x - b.x, p.y - b.y); }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#66BB6A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const z of obstacles) {
      if (z.type === 'sand') ctx.fillStyle = '#E6D7A3';
      else if (z.type === 'water') ctx.fillStyle = '#64B5F6';
      else ctx.fillStyle = '#A5D6A7';
      ctx.fillRect(z.x, z.y, z.w, z.h);
    }

    ctx.beginPath();
    ctx.fillStyle = '#222';
    ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hole.x, hole.y - hole.r); ctx.lineTo(hole.x, hole.y - 40); ctx.stroke();
    ctx.fillStyle = '#FFBF00';
    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y - 40);
    ctx.lineTo(hole.x + 24, hole.y - 32);
    ctx.lineTo(hole.x, hole.y - 24);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    ctx.stroke();

    if (aimStart && aimEnd) {
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(aimStart.x, aimStart.y);
      ctx.lineTo(aimEnd.x, aimEnd.y);
      ctx.stroke();

      const dx = aimStart.x - aimEnd.x, dy = aimStart.y - aimEnd.y;
      const ang = Math.atan2(dy, dx);
      const ax = aimStart.x - Math.cos(ang) * 20;
      const ay = aimStart.y - Math.sin(ang) * 20;
      ctx.beginPath();
      ctx.moveTo(aimStart.x, aimStart.y);
      ctx.lineTo(ax + Math.cos(ang + 0.4) * 10, ay + Math.sin(ang + 0.4) * 10);
      ctx.lineTo(ax + Math.cos(ang - 0.4) * 10, ay + Math.sin(ang - 0.4) * 10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fill();
    }
  }

  function toast(t) {
    console.log('[toast]', t);
  }

  // ====== Expose globally ======
  window.openChipAndPutt = openModal;
  window.renderEggButton = renderEggButton;
});

}

// Show Easter Egg button if game is loaded
if (window.renderEggButton) window.renderEggButton();
// On first load, render the FAB and support a URL shortcut (#golf)
document.addEventListener('DOMContentLoaded', () => {
  if (window.renderEggButton) window.renderEggButton();
  if (location.hash.replace('#','') === 'golf' && window.openChipAndPutt) {
    window.openChipAndPutt();
  }
});

// Mobile-friendly triggers: 5 logo taps OR long-press bottom-right hotspot
document.addEventListener('DOMContentLoaded', () => {
    // Ensure FAB renders on first load + support deep link
  if (window.renderEggButton) window.renderEggButton();
  if (location.hash.replace('#','') === 'golf' && window.openChipAndPutt) window.openChipAndPutt();

  // 5 taps on the logo within ~1.2s
  const logo = document.querySelector('.logo');
  if (logo) {
    let taps = 0, last = 0;
    logo.addEventListener('click', () => {
      const now = Date.now();
      if (now - last > 1200) taps = 0;
      last = now;
      if (++taps >= 5) {
        taps = 0;
        window.renderEggButton?.();
        try { toast('Chip & Putt ready!'); } catch {}
      }
    });
  }

  // Long-press (800ms) invisible hotspot bottom-right
const hot = document.createElement('div');
// place away from the FAB so it doesn't overlap, and reduce z-index
hot.style.cssText = 'position:fixed;right:84px;bottom:84px;width:56px;height:56px;z-index:2147483000;opacity:0;pointer-events:auto;';
document.body.appendChild(hot);
  let pressTimer = null;
  const arm = () => { pressTimer = setTimeout(() => { window.renderEggButton?.(); try { toast('Chip & Putt ready!'); } catch {} }, 800); };
  const disarm = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
  hot.addEventListener('touchstart', arm, { passive: true });
  hot.addEventListener('mousedown', arm);
  ['touchend','touchcancel','mouseup','mouseleave'].forEach(evt => hot.addEventListener(evt, disarm));
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}

// Wire Compare nav button
document.addEventListener('DOMContentLoaded', () => {
  const cmpBtn = document.getElementById('navCompare');
  if (cmpBtn) {
    cmpBtn.addEventListener('click', () => {
      navTo('compare');
    });
  }
});

function renderHiDetail(main){
  const g = getLoggedGolfer();
  main.innerHTML = `
    <h1>Handicap – Detail</h1>
    <div class="card">Current HI: <b>${fmt(g.hi)}</b></div>
    <p class="muted">Future: show England Golf sync history here.</p>
    <button class="btn" onclick="navTo('dashboard')">Back</button>
  `;
}
function renderSgDetail(main){
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
}
function renderPhysicalDetail(main){
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
}
function renderRatingsDetail(main){
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
}
function renderAttendanceDetail(main){
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
}
function renderMyProfile(main){
  const g = getLoggedGolfer();
  const sgRows = g.sg.map(s=>`<tr><td>${s.d}</td><td>${s.total}</td><td>${s.tee}</td><td>${s.approach}</td><td>${s.short}</td><td>${s.putting}</td></tr>`).join("");
  const physRows = g.phys.map(p=>`<tr><td>${p.d}</td><td>${p.chs}</td><td>${p.ball}</td><td>${p.cmj}</td><td>${p.bj}</td><td>${p.height}</td><td>${p.weight}</td></tr>`).join("");
  const attRows = g.attendance.map(a=>`<tr><td>${a.d}</td><td>${a.group}</td><td>${a.one1}</td></tr>`).join("");
  main.innerHTML = `
    <h1>My Profile</h1>
    <div class="card"><strong>Handicap:</strong> ${fmt(g.hi)} &nbsp;|&nbsp; <strong>DOB:</strong> ${g.dob} &nbsp;|&nbsp; <strong>Age:</strong> ${g.age} (${g.agePrecise}y)</div>
    <div class="card"><h2>Strokes Gained</h2><table class="table"><thead><tr><th>Date</th><th>Total</th><th>Tee</th><th>Approach</th><th>Short</th><th>Putting</th></tr></thead><tbody>${sgRows}</tbody></table></div>
    <div class="card"><h2>Physical</h2><table class="table"><thead><tr><th>Date</th><th>CHS</th><th>Ball</th><th>CMJ</th><th>BJ</th><th>Height</th><th>Weight</th></tr></thead><tbody>${physRows}</tbody></table></div>
    <div class="card"><h2>Psych</h2><p class="muted">Placeholder – will link to your psych site/API.</p></div>
    <div class="card"><h2>Attendance</h2><table class="table"><thead><tr><th>Date</th><th>Group</th><th>1:1</th></tr></thead><tbody>${attRows}</tbody></table></div>
    <button class="btn" onclick="navTo('dashboard')">Back</button>
  `;
}

/* ======== Admin views ======== */
function renderAdminDashboard(main){
  const gcount=state.golfers.length, coaches=4, users=gcount+coaches+1;
  const nextCycle="2025-10-01", compliance=0.78;
  main.innerHTML=`
    <h1>Admin Dashboard</h1>
    <div class="grid grid-3">
      <div class="card" style="cursor:pointer" onclick="navTo('users')"><div class="kpi">${users}</div><div class="muted">Total Users</div></div>
      <div class="card"><div class="kpi">${gcount}</div><div class="muted">Golfers</div></div>
      <div class="card"><div class="kpi">${coaches}</div><div class="muted">Coaches</div></div>
      <div class="card" style="cursor:pointer" onclick="navTo('compliance')"><div class="kpi">${(compliance*100|0)}%</div><div class="muted">Last Cycle Compliance</div></div>
      <div class="card" style="cursor:pointer" onclick="navTo('cycles')"><div class="kpi">${nextCycle}</div><div class="muted">Next Update Cycle</div></div>
      <div class="card">
        <h3>Tools</h3><div class="grid grid-2">
          <button class="btn" onclick="navTo('correlations')">Correlations</button>
          <button class="btn" onclick="navTo('compare')">Compare</button>
        </div>
      </div>
    </div>
    <p class="muted">Note: Real admin controls come with Supabase.</p>
  `;
}
function renderAdminUsers(main){
  // demo: flatten to a simple list; later this is a DB view
  const rows = state.golfers.map(g=>`
    <tr>
      <td>${g.name}</td><td>${g.dob}</td><td>${g.age} (${g.agePrecise})</td><td>Golfer</td>
      <td><button class="btn" onclick="state.currentGolfer=state.golfers.find(x=>x.id===${g.id}); navTo('profile')">View Profile</button></td>
    </tr>`).join("");
  main.innerHTML = `
    <h1>Admin › Users</h1>
    <div class="card">
      <input id="usrSearch" placeholder="Search by name…" style="width:260px;padding:6px;border:1px solid #d9d9d9;border-radius:6px"/>
    </div>
    <div class="card" style="overflow:auto">
      <table class="table">
        <thead><tr><th>Name</th><th>DOB</th><th>Age</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody id="usrBody">${rows}</tbody>
      </table>
    </div>
    <button class="btn" onclick="navTo('admin-dashboard')">Back</button>
  `;
  document.getElementById("usrSearch").oninput = e=>{
    const q = e.target.value.toLowerCase();
    const body = document.getElementById("usrBody");
    body.querySelectorAll("tr").forEach(tr=>{
      const name = tr.children[0].textContent.toLowerCase();
      tr.style.display = name.includes(q) ? "" : "none";
    });
  };
}
function renderAdminCycles(main){
  const cycles = [
    {name:"Q4 2024", start:"2024-10-01", end:"2024-12-31", complete:0.82},
    {name:"Q1 2025", start:"2025-01-01", end:"2025-03-31", complete:0.86},
    {name:"Q2 2025", start:"2025-04-01", end:"2025-06-30", complete:0.78},
    {name:"Q3 2025", start:"2025-07-01", end:"2025-09-30", complete:0.21}
  ];
  const rows = cycles.map(c=>`
    <tr><td>${c.name}</td><td>${c.start}</td><td>${c.end}</td><td>${Math.round(c.complete*100)}%</td></tr>
  `).join("");
  main.innerHTML = `
    <h1>Admin › Cycles</h1>
    <div class="card">
      <table class="table">
        <thead><tr><th>Cycle</th><th>Start</th><th>End</th><th>Completion</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted">Future: create/edit cycles, assign tasks, reminders.</p>
    <button class="btn" onclick="navTo('admin-dashboard')">Back</button>
  `;
}
function renderAdminCompliance(main){
  // demo: list golfers with a fake "missing" flag if last SG is null (never in demo)
  const rows = state.golfers.slice(0,10).map((g,i)=>`
    <tr><td>${g.name}</td><td>${g.dob}</td><td>${g.agePrecise}</td><td>${QUARTERS[QUARTERS.length-1]}</td><td>${i%3===0?"Missing":"Complete"}</td></tr>
  `).join("");
  main.innerHTML = `
    <h1>Admin › Compliance</h1>
    <div class="card" style="overflow:auto">
      <table class="table">
        <thead><tr><th>Name</th><th>DOB</th><th>Age</th><th>Cycle</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted">Future: filter by team/coach, send nudges.</p>
    <button class="btn" onclick="navTo('admin-dashboard')">Back</button>
  `;
}

/* ======= Coach/Admin: Compare ======= */
async function renderCompare(main) {
  main.innerHTML = "<h2>Compare Golfers</h2><div id='compareTable'></div>";

  // Uses the helper we made earlier
  const golfers = await fetchGolfersForCompare();

  if (!golfers.length) {
    document.getElementById("compareTable").textContent = "No golfers found.";
    return;
  }

  const table = document.createElement("table");
  table.border = "1";
  table.cellPadding = "6";
  table.style.borderCollapse = "collapse";

  const header = document.createElement("tr");
  ["#", "Name", "DOB", "Age", "HI", "SG Total (last 4)"].forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.cursor = "pointer";
    header.appendChild(th);
  });
  table.appendChild(header);

  golfers.forEach(g => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.idx}</td>
      <td>${g.name}</td>
      <td>${g.dob || "—"}</td>
      <td>${g.age ?? "—"}</td>
      <td>${g.hi?.toFixed ? g.hi.toFixed(1) : g.hi}</td>
      <td>${g.sgTotal?.toFixed ? g.sgTotal.toFixed(1) : g.sgTotal}</td>
    `;
    table.appendChild(tr);
  });

  document.getElementById("compareTable").appendChild(table);
}


/* ======= Coach/Admin: Correlations ======= */
function renderCorrelations(main){
  const golfers=state.golfers;
  state.analyze=state.analyze||{x:"agePrecise",y:"sg_total",win:state.compare.dateWindow,perQuarter:false,selection:new Set(golfers.map(g=>g.id)),showLabels:false};
  const {x,y,win,perQuarter,selection,showLabels}=state.analyze;

  const getVal=(g,key,w)=>{const opt=METRIC_OPTIONS.find(m=>m.key===key);return opt?opt.getter(g,w):null;};
  const fmtX = METRIC_OPTIONS.find(m=>m.key===x)?.fmtTick;
  const fmtY = METRIC_OPTIONS.find(m=>m.key===y)?.fmtTick;

  const points=[];
  const wdates=qWindowDates(win);

  if(!perQuarter){
    golfers.forEach((g,idx)=>{
      if(!selection.has(g.id)) return;
      const xv=getVal(g,x,win), yv=getVal(g,y,win);
      if(xv!=null&&yv!=null) points.push({x:xv,y:yv,name:g.name,color:colorForIndex(idx)});
    });
  } else {
    golfers.forEach((g,idx)=>{
      if(!selection.has(g.id)) return;
      wdates.forEach(d=>{
        const from={sg:g.sg.find(r=>r.d===d),phys:g.phys.find(r=>r.d===d),att:g.attendance.find(r=>r.d===d)};
        const map={agePrecise:g.agePrecise,dob_ts:new Date(g.dob+"T00:00:00Z").getTime(),hi:g.hi,
          sg_total:from.sg?.total,sg_putt:from.sg?.putting,sg_tee:from.sg?.tee,sg_app:from.sg?.approach,sg_short:from.sg?.short,
          ball:from.phys?.ball,chs:from.phys?.chs,cmj:from.phys?.cmj,bj:from.phys?.bj,height:from.phys?.height,weight:from.phys?.weight,
          att_g:from.att?.group??0,att_1to1:from.att?.one1??0};
        const xv=map[x], yv=map[y];
        if(xv!=null&&yv!=null) points.push({x:xv,y:yv,name:`${g.name} • ${d}`,color:colorForIndex(idx)});
      });
    });
  }

  const r=pearson(points.map(p=>p.x),points.map(p=>p.y));
  const rTxt=Number.isNaN(r)?"n/a":r.toFixed(2);

  // controls
  const opts = METRIC_OPTIONS.map(o=>`<option value="${o.key}">${o.label}</option>`).join("");
  const golferChecks = golfers.map(g=>`
    <label style="min-width:180px"><input type="checkbox" data-gid="${g.id}" ${selection.has(g.id)?"checked":""}/> ${g.name}</label>
  `).join("");

  main.innerHTML=`
    <h1>Correlations</h1>
    <div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
      <label>X:<select id="xSel">${opts}</select></label>
      <label>Y:<select id="ySel">${opts}</select></label>
      <label>Date Window:<select id="winSel">${["This Cycle","90 days","6 months","All"].map(w=>`<option ${w===win?"selected":""}>${w}</option>`).join("")}</select></label>
      <label><input type="checkbox" id="perQ" ${perQuarter?"checked":""}/> Per quarter points</label>
      <label><input type="checkbox" id="lbls" ${showLabels?"checked":""}/> Show initials</label>
      <button class="btn" id="selAll">All</button>
      <button class="btn" id="selNone">None</button>
      <div class="muted">Pearson r: <b>${rTxt}</b></div>
    </div>

    <div class="card">
      ${scatterSVG(points, { w:720, h:420, p:40, showLabels, xFmt:fmtX, yFmt:fmtY })}
      <div class="muted" style="margin-top:6px">
        Hint: try X=<i>Age (years)</i> vs Y=<i>Ball Speed</i>, or X=<i>DOB (date)</i> vs Y=<i>SG Total</i>.
      </div>
    </div>

    <div class="card">
      <details open>
        <summary style="cursor:pointer"><b>Select golfers</b></summary>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">${golferChecks}</div>
      </details>
    </div>
  `;

  // wire
  document.getElementById("xSel").value = x;
  document.getElementById("ySel").value = y;
  document.getElementById("xSel").onchange = e=>{ state.analyze.x = e.target.value; renderCorrelations(main); };
  document.getElementById("ySel").onchange = e=>{ state.analyze.y = e.target.value; renderCorrelations(main); };
  document.getElementById("winSel").onchange = e=>{ state.analyze.win = e.target.value; renderCorrelations(main); };
  document.getElementById("perQ").onchange  = e=>{ state.analyze.perQuarter = e.target.checked; renderCorrelations(main); };
  document.getElementById("lbls").onchange  = e=>{ state.analyze.showLabels = e.target.checked; renderCorrelations(main); };
  document.getElementById("selAll").onclick = ()=>{ state.analyze.selection = new Set(golfers.map(g=>g.id)); renderCorrelations(main); };
  document.getElementById("selNone").onclick= ()=>{ state.analyze.selection = new Set(); renderCorrelations(main); };
  main.querySelectorAll('input[type="checkbox"][data-gid]').forEach(cb=>{
    cb.onchange = e => {
      const id = Number(e.target.getAttribute("data-gid"));
      if (e.target.checked) selection.add(id); else selection.delete(id);
      renderCorrelations(main);
    };
  });
}

/* ======= Coach/Admin: Trends ======= */
function renderTrends(main){
  // Controls: metric, golfers (multi-select), date window, mode (multi-line / small multiples)
  const METRICS = [
    {key:"sg_total", label:"SG Total", series:g=>g.sg.map(r=>({d:r.d, v:r.total}))},
    {key:"sg_putt", label:"SG Putting", series:g=>g.sg.map(r=>({d:r.d, v:r.putting}))},
    {key:"sg_tee", label:"SG Tee", series:g=>g.sg.map(r=>({d:r.d, v:r.tee}))},
    {key:"sg_app", label:"SG Approach", series:g=>g.sg.map(r=>({d:r.d, v:r.approach}))},
    {key:"sg_short", label:"SG Short", series:g=>g.sg.map(r=>({d:r.d, v:r.short}))},
    {key:"ball", label:"Ball Speed", series:g=>g.phys.map(r=>({d:r.d, v:r.ball}))},
    {key:"chs", label:"CHS", series:g=>g.phys.map(r=>({d:r.d, v:r.chs}))},
    {key:"cmj", label:"CMJ", series:g=>g.phys.map(r=>({d:r.d, v:r.cmj}))},
    {key:"bj", label:"BJ", series:g=>g.phys.map(r=>({d:r.d, v:r.bj}))},
    {key:"rating_avg", label:"Coach Rating (avg)", series:g=>g.ratings.map(r=>({d:r.d, v:avg([r.holing,r.short,r.wedge,r.flight,r.plan])}))},
    {key:"att_g", label:"Attendance – Group", series:g=>g.attendance.map(r=>({d:r.d, v:r.group}))},
    {key:"att_1to1", label:"Attendance – 1:1", series:g=>g.attendance.map(r=>({d:r.d, v:r.one1}))},
  ];
  state.trends = state.trends || { metric:"sg_total", win:"All", selection:new Set(state.golfers.slice(0,5).map(g=>g.id)), mode:"Multi-line" };
  const {metric, win, selection, mode} = state.trends;
  const golfers = state.golfers;

  function seriesFor(g){
    const def = METRICS.find(m=>m.key===metric);
    const raw = def.series(g);
    const w = qWindowDates(win);
    const filtered = raw.filter(r=> w.includes(r.d) );
    return filtered.length ? filtered : raw.slice(-w.length||4);
  }

  // Gather series
  const chosen = golfers.filter(g=>selection.has(g.id));
  const series = chosen.map((g,idx)=>({ name:g.name, color:colorForIndex(idx), data:seriesFor(g) }));

  // Build CSV table data
  const cols = Array.from(new Set(series.flatMap(s=>s.data.map(d=>d.d)))); // quarters present
  const rowsCsv = series.map(s=>[s.name, ...cols.map(c => {
    const r = s.data.find(d=>d.d===c); return r? r.v : "";
  })]);

  function multilineSVG(){
    const w=780, h=420, p=40;
    // extents
    const xs = cols;
    const allVals = series.flatMap(s=>s.data.map(d=>d.v));
    const ymin = Math.min(...allVals), ymax = Math.max(...allVals);
    const gx = q => p + (xs.indexOf(q)/(xs.length-1||1))*(w-2*p);
    const gy = v => h - p - ((v - ymin)/((ymax - ymin)||1))*(h-2*p);
    const xTicks = xs.map(q=>`<text x="${gx(q)}" y="${h-p+18}" font-size="11" text-anchor="middle">${q}</text>`).join("");
    const yTicksVals = Array.from({length:6},(_,i)=> ymin + (i*(ymax-ymin))/5 );
    const yTicks = yTicksVals.map(v=>`<text x="${p-8}" y="${gy(v)+4}" font-size="11" text-anchor="end">${Math.round(v*10)/10}</text>`).join("");

    const axes = `
      <line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#ccc"/>
      <line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}" stroke="#ccc"/>
      ${yTicks}
      ${xTicks}
    `;
    const lines = series.map(s=>{
      const path = s.data.map((d,i)=> (i? "L":"M") + " " + gx(d.d) + " " + gy(d.v)).join(" ");
      return `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2"><title>${s.name}</title></path>`;
    }).join("");

    const dots = series.map(s=> s.data.map(d=>{
      const cx=gx(d.d), cy=gy(d.v);
      return `<circle cx="${cx}" cy="${cy}" r="3" fill="${s.color}"><title>${s.name} • ${d.d}: ${d.v}</title></circle>`;
    }).join("")).join("");

    const legend = series.map(s=>`<span style="display:inline-flex;align-items:center;gap:6px;margin-right:12px"><span style="width:14px;height:3px;background:${s.color};display:inline-block"></span>${s.name}</span>`).join("");

    return `
      <div>${legend}</div>
      <svg width="${w}" height="${h}">${axes}${lines}${dots}</svg>
    `;
  }

  
  function smallMultiples(){
    // grid of mini sparklines, one per golfer
    const cards = series.map(s=>`
      <div class="card">
        <div><strong>${s.name}</strong></div>
        ${spark(s.data.map(d=>d.v), 300, 60, "spark")}
        <div class="muted">${metric} • ${s.data.map(d=>d.d).join(", ")}</div>
      </div>
    `).join("");
    return `<div class="grid grid-2">${cards}</div>`;
  }

  const metricOpts = METRICS.map(m=>`<option value="${m.key}" ${m.key===metric?"selected":""}>${m.label}</option>`).join("");
  const golfersList = state.golfers.map(g=>`
    <label style="min-width:200px"><input type="checkbox" data-gid="${g.id}" ${selection.has(g.id)?"checked":""}/> ${g.name}</label>
  `).join("");

  main.innerHTML = `
    <h1>Trends</h1>
    <div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <label>Metric: <select id="trMetric">${metricOpts}</select></label>
      <label>Date Window:
        <select id="trWin">${["This Cycle","90 days","6 months","All"].map(w=>`<option ${w===win?"selected":""}>${w}</option>`).join("")}</select>
      </label>
      <label>Mode:
        <select id="trMode">${["Multi-line","Small multiples"].map(m=>`<option ${m===mode?"selected":""}>${m}</option>`).join("")}</select>
      </label>
      <button class="btn" id="trAll">Select all</button>
      <button class="btn" id="trNone">None</button>
      <button class="btn" id="trCSV">Export CSV</button>
    </div>

    <div class="card">
      ${mode==="Multi-line" ? multilineSVG() : smallMultiples()}
    </div>

    <div class="card">
      <details open>
        <summary style="cursor:pointer"><b>Select golfers</b></summary>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">${golfersList}</div>
      </details>
    </div>
  `;

  // wire up
  document.getElementById("trMetric").onchange = e=>{ state.trends.metric = e.target.value; renderTrends(main); };
  document.getElementById("trWin").onchange    = e=>{ state.trends.win = e.target.value; renderTrends(main); };
  document.getElementById("trMode").onchange   = e=>{ state.trends.mode = e.target.value; renderTrends(main); };
  document.getElementById("trAll").onclick     = ()=>{ state.trends.selection = new Set(state.golfers.map(g=>g.id)); renderTrends(main); };
  document.getElementById("trNone").onclick    = ()=>{ state.trends.selection = new Set(); renderTrends(main); };
  document.getElementById("trCSV").onclick     = ()=>{
    const head = ["Golfer", ...Array.from(new Set(series.flatMap(s=>s.data.map(d=>d.d))))];
    download("trends.csv", toCSV([head, ...rowsCsv]));
  };
  main.querySelectorAll('input[type="checkbox"][data-gid]').forEach(cb=>{
    cb.onchange = e => {
      const id = Number(e.target.getAttribute("data-gid"));
      if (e.target.checked) selection.add(id); else selection.delete(id);
      renderTrends(main);
    };
  });
}

/* ===== Utilities used by coach views ===== */
function getLoggedGolfer(){ return state.golfers.find(x=>x.id===state.loggedGolferId) || state.golfers[0]; }
function openProfile(id){ state.currentGolfer = state.golfers.find(x=>x.id===id); navTo("profile"); }

function labelFromKey(key){
  const map = {
    name:"Name", dob:"DOB", age:"Age", hi:"HI",
    sg_total:"SG Total", sg_putt:"SG Putting", sg_tee:"SG Tee",
    sg_app:"SG Approach", sg_short:"SG Short",
    ball:"Ball Speed", chs:"CHS", cmj:"CMJ", bj:"BJ",
    height:"Height", weight:"Weight",
    att_g:"Att (G/I)"
  };
  return map[key] || key;
}

/* ===== Coach → Compare (sortable any header, deltas, DOB/Age/Attendance) ===== */
function renderCompare(main){
  const colsAll = ["DOB","Age","HI","SG Total","SG Putting","SG Tee","SG Approach","SG Short","Ball Speed","CHS","CMJ","BJ","Height","Weight","Att (G/I)"];
  const selected = new Set(state.compare.columns);
  const windowDates = qWindowDates(state.compare.dateWindow);

  // Build rows from windowed data
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

  // Sorting
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

  // Expose sort + CSV helpers once per renderCompare (globals)
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
    const controls = `
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

        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${COMPARE_PRESETS.map(p=>`<button class="btn" data-preset="${p.name}">${p.name}</button>`).join("")}
          <span class="muted" id="presetNote">${state.compare.lastPreset || ""}</span>
        </div>

        <button class="btn" onclick="__cmpCSV()">Export CSV</button>
      </div>
    `;

    const table = `
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

    main.innerHTML = `<h1>Compare Golfers</h1>${controls}${table}`;

    // Wire controls AFTER innerHTML
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

    // Presets — update state and re-enter renderCompare so 'selected' refreshes
    function applyPreset(name){
      const p = COMPARE_PRESETS.find(x=>x.name===name);
      if(!p) return;
      state.compare.columns = p.columns.slice();
      state.compare.sortKey = p.sortKey;
      state.compare.sortDir = p.sortDir;
      state.compare.lastPreset = `Preset: ${p.name} • Sorted by ${labelFromKey(p.sortKey)}`;
      renderCompare(main);
    }
    main.querySelectorAll('button[data-preset]').forEach(btn=>{
      btn.onclick = ()=> applyPreset(btn.getAttribute('data-preset'));
    });
  }

  render();
}

function renderCoachProfile(main){
  const g = state.currentGolfer;
  if(!g){ main.innerHTML = "<p>No golfer selected.</p>"; return; }
  const sgRows = g.sg.map(s=>`<tr><td>${s.d}</td><td>${s.total}</td><td>${s.tee}</td><td>${s.approach}</td><td>${s.short}</td><td>${s.putting}</td></tr>`).join("");
  const physRows = g.phys.map(p=>`<tr><td>${p.d}</td><td>${p.chs}</td><td>${p.ball}</td><td>${p.cmj}</td><td>${p.bj}</td><td>${p.height}</td><td>${p.weight}</td></tr>`).join("");
  const attRows = g.attendance.map(a=>`<tr><td>${a.d}</td><td>${a.group}</td><td>${a.one1}</td></tr>`).join("");
  main.innerHTML = `
    <h1>${g.name} – Profile</h1>
    <div class="card"><strong>Handicap:</strong> ${fmt(g.hi)} &nbsp;|&nbsp; <strong>DOB:</strong> ${g.dob} &nbsp;|&nbsp; <strong>Age:</strong> ${g.age} (${g.agePrecise}y)</div>
    <div class="card"><h2>Strokes Gained</h2><table class="table"><thead><tr><th>Date</th><th>Total</th><th>Tee</th><th>Approach</th><th>Short</th><th>Putting</th></tr></thead><tbody>${sgRows}</tbody></table></div>
    <div class="card"><h2>Physical</h2><table class="table"><thead><tr><th>Date</th><th>CHS</th><th>Ball</th><th>CMJ</th><th>BJ</th><th>Height</th><th>Weight</th></tr></thead><tbody>${physRows}</tbody></table></div>
    <div class="card"><h2>Psych</h2><p class="muted">Placeholder – will link to your psych site/API.</p></div>
    <div class="card"><h2>Attendance</h2><table class="table"><thead><tr><th>Date</th><th>Group</th><th>1:1</th></tr></thead><tbody>${attRows}</tbody></table></div>
    <button class="btn" onclick="navTo('compare')">Back to Compare</button>
  `;
}

window.navTo = window.navTo || navTo;
window.loadGolferFromDB = window.loadGolferFromDB || loadGolferFromDB;

// Auto-render golfer dashboard once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');
  if (main) {
    renderGolferDashboard(main);
  } else {
    console.warn('No <main> element found.');
  }
});