/* -----------------------------
 * Golf Academy – minimal working app
 * ----------------------------- */

const { createClient } = supabase;

const SUPABASE_URL = "https://syecffopasrwkjonwvdk.supabase.co"; // <-- keep yours
const SUPABASE_ANON = "<YOUR_ANON_KEY>"; // <-- keep yours if you already have it in the deployed app
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// App state
const state = {
  role: null,
  currentGolfer: null,   // { id, hi, dob, sg[], phys[], ratings[], attendance[] }
};

// Small helpers
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function fmt(n, dec = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (+n).toFixed(dec);
}

// --------- Data loading ---------

// Load golfer + all quarter tables by golfer_id (NUMBER)
window.loadGolferFromDB = async function loadGolferFromDB(userId) {
  try {
    const golferId = Number(userId);
    if (!Number.isFinite(golferId)) {
      console.warn('loadGolferFromDB: userId must be numeric golfer.id, got:', userId);
      return null;
    }

    // Base golfer
    const { data: base, error: baseErr } = await supabase
      .from('golfers').select('id, hi, dob').eq('id', golferId).single();
    if (baseErr || !base) { console.warn('No golfer found', baseErr); return null; }

    // SG
    const { data: sgRows, error: sgErr } = await supabase
      .from('sg_quarter')
      .select('d, total, tee, approach, short, putting')
      .eq('golfer_id', golferId)
      .order('d', { ascending: true })
      .order('id', { ascending: true });
    if (sgErr) console.warn('sg_quarter error:', sgErr);

    const sg = (sgRows || []).map(r => ({
      d: r.d ?? '',
      total: +r.total || 0,
      tee: +r.tee || 0,
      approach: +r.approach || 0,
      short: +r.short || 0,
      putting: +r.putting || 0,
    }));

    // Phys
    const { data: physRows, error: physErr } = await supabase
      .from('phys_quarter')
      .select('d, chs, ball, cmj, bj, height, weight')
      .eq('golfer_id', golferId)
      .order('d', { ascending: true })
      .order('id', { ascending: true });
    if (physErr) console.warn('phys_quarter error:', physErr);

    const phys = (physRows || []).map(r => ({
      d: r.d ?? '',
      chs: +r.chs || 0, ball: +r.ball || 0, cmj: +r.cmj || 0, bj: +r.bj || 0,
      height: +r.height || 0, weight: +r.weight || 0,
    }));

    // Coach ratings
    const { data: rateRows, error: rateErr } = await supabase
      .from('coach_ratings')
      .select('d, holing, short, wedge, flight, plan')
      .eq('golfer_id', golferId)
      .order('d', { ascending: true })
      .order('id', { ascending: true });
    if (rateErr) console.warn('coach_ratings error:', rateErr);

    const ratings = (rateRows || []).map(r => ({
      d: r.d ?? '',
      holing:+r.holing||0, short:+r.short||0, wedge:+r.wedge||0, flight:+r.flight||0, plan:+r.plan||0
    }));

    // Attendance
    const { data: attRows, error: attErr } = await supabase
      .from('attendance')
      .select('d, group_sess, one1')
      .eq('golfer_id', golferId)
      .order('d', { ascending: true })
      .order('id', { ascending: true });
    if (attErr) console.warn('attendance error:', attErr);

    const attendance = (attRows || []).map(r => ({
      d: r.d ?? '', group:+(r.group_sess ?? 0), one1:+r.one1||0
    }));

    return {
      id: golferId,
      name: 'Demo Golfer',
      hi: +(base.hi ?? 0),
      dob: base.dob ?? null,
      sg, phys, ratings, attendance,
    };
  } catch (e) {
    console.error('loadGolferFromDB fatal:', e);
    return null;
  }
};

// --------- Navigation + rendering ---------

function setTitle(t) { document.getElementById('pageTitle').textContent = t; }
function mount(node) {
  const host = document.getElementById('page');
  host.innerHTML = '';
  host.appendChild(node);
}

window.navTo = async function navTo(view) {
  if (view === 'dashboard')       return renderDashboard();
  if (view === 'compare')         return renderCompare();
  if (view === 'correlations')    return renderCorrelations(); // TODO
  if (view === 'trends')          return renderTrends();       // TODO
  setTitle('Welcome');
  mount(el(`<div>Select a role to begin exploring.</div>`));
};

// Dashboard (uses state.currentGolfer)
function renderDashboard() {
  const g = state.currentGolfer;
  setTitle('Golfer Dashboard');
  if (!g) return mount(el(`<div>Pick a role or golfer.</div>`));

  const last4 = g.sg.slice(-4);
  const sgTotal = last4.reduce((s,r)=>s+(r.total||0),0) / (last4.length||1);

  mount(el(`
    <div class="cards">
      <div class="card"><div class="kpi">${fmt(g.hi)}</div><div>Handicap Index</div></div>
      <div class="card"><div class="kpi">${fmt(sgTotal)}</div><div>SG Total (last 4)</div></div>
      <div class="card"><div class="kpi">${fmt((g.phys.slice(-1)[0]||{}).ball,0)} mph</div><div>Ball Speed</div></div>
      <div class="card"><div class="kpi">${fmt(avgCoach(g.ratings),1)}</div><div>Coach Rating (avg)</div></div>
      <div class="card"><div class="kpi">${fmt(sumAtt(g.attendance))}</div><div>Attendance (Group / 1:1)</div></div>
    </div>
  `));
}
function avgCoach(rows){ if(!rows?.length) return 0; let s=0,c=0; rows.forEach(r=>{['holing','short','wedge','flight','plan'].forEach(k=>{s+=+r[k]||0;c++;});}); return s/(c||1); }
function sumAtt(rows){ if(!rows?.length) return 0; let g=0,o=0; rows.forEach(r=>{g+=+r.group||0;o+=+r.one1||0;}); return g+'/'+o; }

// Compare (reads all golfers + each golfer’s SG avg)
async function renderCompare() {
  setTitle('Compare Golfers');

  // base UI
  const root = el(`
    <div>
      <div class="toolbar">
        <label>Date Window:
          <select id="cmpWin">
            <option value="all">All</option>
            <option value="last4">Last 4</option>
          </select>
        </label>
        <button id="btnCsv">Export CSV</button>
      </div>
      <table class="table" id="cmpTable">
        <thead>
          <tr><th>#</th><th>Name</th><th>DOB</th><th>Age</th><th>HI</th><th>SG Total</th><th>Profile</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `);
  mount(root);

  // load golfers
  const { data: golfers, error } = await supabase
    .from('golfers')
    .select('id, dob, hi')
    .order('id', { ascending: true })
    .limit(100);
  if (error) { console.warn('No golfers found in DB', error); return; }

  const tbody = root.querySelector('tbody');
  tbody.innerHTML = '';

  let idx = 1;
  for (const g of golfers) {
    // get SG rows per golfer (avg total)
    const { data: sgRows } = await supabase
      .from('sg_quarter')
      .select('d, total')
      .eq('golfer_id', g.id)
      .order('d', { ascending: true })
      .limit(16);

    const sg = sgRows || [];
    const windowSel = root.querySelector('#cmpWin').value;
    const use = windowSel === 'last4' ? sg.slice(-4) : sg;
    const sgTotal = use.reduce((s,r)=>s+(+r.total||0),0) / (use.length||1);

    const age = g.dob ? Math.floor((Date.now() - new Date(g.dob+'T00:00:00Z'))/(365.2425*24*3600*1000)) : '—';

    const row = el(`
      <tr>
        <td>${idx++}</td>
        <td>Demo Golfer</td>
        <td>${g.dob ?? '—'}</td>
        <td>${age}</td>
        <td>${fmt(g.hi,1)}</td>
        <td>${fmt(sgTotal,1)}</td>
        <td><button data-id="${g.id}" class="viewBtn">View</button></td>
      </tr>
    `);
    tbody.appendChild(row);
  }

  // view button -> switch current golfer then dashboard
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.viewBtn');
    if (!btn) return;
    const gid = Number(btn.dataset.id);
    const g = await window.loadGolferFromDB(gid);
    if (g) {
      state.currentGolfer = g;
      navTo('dashboard');
    }
  });

  // change window recalculates SG
  root.querySelector('#cmpWin').addEventListener('change', renderCompare);
}

// TODO placeholders
function renderCorrelations(){ setTitle('Correlations'); mount(el(`<div>Coming soon.</div>`)); }
function renderTrends(){ setTitle('Trends'); mount(el(`<div>Coming soon.</div>`)); }

// --------- Impersonation & role nav ---------

window.impersonate = async function impersonate(role) {
  state.role = role;
  document.getElementById('whoami').textContent = 'Role: ' + role;

  // role nav
  const nav = document.getElementById('roleNav');
  nav.innerHTML = '';
  let pages = [];
  if (role === 'golfer') pages = ['Dashboard','Compare','Correlations','Trends'];
  if (role === 'coach')  pages = ['Compare','Correlations','Trends'];
  if (role === 'admin')  pages = ['Compare','Correlations','Trends','Admin Dashboard']; // placeholder

  pages.forEach(p => {
    const b = document.createElement('button');
    b.textContent = p;
    b.onclick = () => navTo(p.toLowerCase().replace(/ /g,'-'));
    nav.appendChild(b);
  });

  // pick a golfer to view: latest ID in DB (works with demo seed)
  if (role === 'golfer') {
    const { data: latest } = await supabase.from('golfers').select('id').order('id', { ascending:false }).limit(1);
    const gid = latest?.[0]?.id;
    if (gid) {
      const g = await window.loadGolferFromDB(gid);
      if (g) state.currentGolfer = g;
    }
  }

  if (pages.length) navTo(pages[0].toLowerCase().replace(/ /g,'-'));
};

// Boot: nothing fancy; user clicks a role
