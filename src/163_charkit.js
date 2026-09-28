// ============================================================================
// CharKit — the shared kit for minor roles and extras (chars agent, internal to Chars): seeded looks with
// varied proportions, faces, skin, hair, clothes and colours, so no extra ever reuses a named face.
//   CharKit.civ(R, {launch, country, kid, worn 0..3, big}) -> look fields
//   CharKit.faction(R, 'landline'|'doorknocker'|'retreat'|'smuggler'|'bandit') -> look fields
// R is a seeded random () => [0, 1).
// ============================================================================
const CharKit = (() => {
  const SKIN = ['#f3cfb3', '#ecc0a0', '#e2b08e', '#d6a07c', '#c68d68', '#b07650', '#94603e', '#7a4c30', '#5e3a26', '#4a2e1e'];
  const HAIR = ['#141110', '#241a14', '#3a2a1e', '#4e3624', '#6a4a2e', '#8a6440', '#a88458', '#c4a878', '#8a3e22', '#5a2e1a'];
  const TOPC = ['#2b3a55', '#6a2a2a', '#3a5a3a', '#d8d4cc', '#1c1c1e', '#8a6a4a', '#4a6a8a', '#a88a3a', '#7a4a6a', '#e0c8a0', '#3a3a3a', '#b85a3a', '#5a7a7a', '#c8c0b0', '#2e4a44'];
  const COUNTRY = ['#6a4a30', '#8a7a5a', '#4a5a3a', '#7a3a2a', '#b0a080', '#5a6a70', '#8a6a3a', '#3e4a38'];
  const DENIM = ['#2e3d58', '#3e5474', '#1e2432', '#4a5a74'], CHINO = ['#b8a888', '#5a5244', '#3a3c44', '#8a8270', '#2a2a2e'];
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  const dim = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');

  function civ(R, o = {}) {
    const kid = !!o.kid, sex = R() < 0.5 ? 'm' : 'f', fem = sex === 'f';
    const age = kid ? 6 + R() * 7 : 17 + Math.pow(R(), 1.35) * 66;
    const H = kid ? 1.12 + (age - 6) * 0.062 + R() * 0.05 : (fem ? 1.55 : 1.68) + (R() + R()) * 0.1 + (o.big ? 0.22 : 0);
    const fat = o.big ? 1.1 : R() < 0.35 ? R() * 0.7 : R() * 0.25 - 0.12, belly = Math.max(0, fat) * (0.8 + R() * 0.6);
    const skin = SKIN[Math.min(SKIN.length - 1, Math.floor(Math.pow(R(), 1.25) * SKIN.length))];
    const grey = age > 42 ? Math.min(1, (age - 42) / 28) : 0;
    const hc = grey > 0.7 ? '#b4b0a8' : pick(R, HAIR);
    const styles = kid ? (fem ? ['ponytail', 'buns', 'bob', 'long'] : ['short', 'messy', 'curly', 'crop'])
      : fem ? (age > 60 ? ['perm', 'bob', 'short'] : ['ponytail', 'bob', 'long', 'tied_back', 'buns', 'curly']) : (age > 50 ? ['receding', 'crop', 'side_part', 'buzz', 'comb'] : ['crop', 'short', 'side_part', 'messy', 'buzz', 'curly', 'tied_back']);
    const worn = o.worn || 0, cold = o.country && R() < 0.5;
    const L = {
      H, sex, age, child: kid,
      build: { sh: 0.9 + R() * 0.22, ch: 0.9 + R() * 0.2, wa: 0.92 + R() * 0.2 + belly * 0.2, hi: 0.92 + R() * 0.18, fat, belly, bust: fem ? 0.3 + R() * 0.7 : 0, musc: R() * 0.3, arm: 0.9 + R() * 0.2, leg: 0.92 + R() * 0.16, neck: 0.9 + R() * 0.25 + fat * 0.2 },
      head: { jaw: 0.85 + R() * 0.3, chin: 0.85 + R() * 0.3, width: 0.94 + R() * 0.12, nose: 0.85 + R() * 0.35, noseW: 0.9 + R() * 0.3, noseBump: R() * 0.6, cheek: 0.9 + R() * 0.25, lips: 0.8 + R() * 0.4, ear: 0.9 + R() * 0.25, hollow: worn > 1 ? 0.6 + R() * 0.4 : R() * 0.3, full: fat > 0.3 ? fat : 0, ipd: 0.058 + R() * 0.008 - (fem ? 0.002 : 0) },
      skin, iris: pick(R, ['#3a2618', '#4a3624', '#5a4632', '#5d7282', '#6a7a86', '#5a7a4a', '#2e1e14']), rosy: 0.3 + R() * 0.7,
      stubble: !fem && !kid ? R() * 0.8 : 0, greyStubble: grey, tired: R() * 0.5 + worn * 0.3, freckles: R() < 0.2 ? R() * 0.6 : 0, moles: Math.floor(R() * 3),
      hair: R() < (fem ? 0.02 : 0.08) && !kid ? { style: 'bald' } : { style: pick(R, styles), color: hc, grey, len: 0.8 + R() * 0.4, seed: Math.floor(R() * 999), part: (R() - 0.5) * 0.8 },
      beard: !fem && !kid && R() < 0.18 ? { style: R() < 0.2 ? 'big' : 'full', color: grey > 0.6 ? '#b0aca4' : hc, len: 0.6 + R() * 0.5 } : null,
      outfit: [], acc: [],
    };
    // clothes
    const tc = o.country ? pick(R, COUNTRY) : pick(R, TOPC), dirt = worn * 0.3 + R() * 0.2;
    const topK = pick(R, kid ? ['tee', 'tee', 'hoodie', 'jumper'] : o.country ? ['shirt', 'jumper', 'shirt', 'tee', 'cardigan'] : ['tee', 'tee', 'polo', 'shirt', 'hoodie', 'jumper', 'singlet']);
    const top = { k: topK, color: tc, dirt, sweat: worn * 0.3, blood: worn > 1 && R() < 0.5 ? 0.6 : 0, loose: 1 + R() * 0.4 };
    if (topK === 'shirt') Object.assign(top, R() < 0.4 ? { fab: 'plaid', plaidA: `rgba(${R() * 60 | 0},${R() * 60 | 0},${R() * 80 | 0},0.35)` } : {}, { tuck: R() < 0.3, sleeve: R() < 0.5 ? 1 : 0.28 });
    if (topK === 'polo') top.logo = false;
    if (topK === 'hoodie' && R() < 0.4) top.gap = 0.35;
    if (topK === 'tee' && R() < 0.3) Object.assign(top, { print: pick(R, ['SURF CO.', 'BRISBANE', 'REDCLIFFE\nSURF CLUB', 'NO WORRIES', 'GYM', 'BE FIRST']), ink: pick(R, ['#e8e4d8', '#f2c200', '#c8d8e8']) });
    L.outfit.push(top);
    if (!kid && R() < (o.country || cold ? 0.45 : 0.25) && topK !== 'hoodie') L.outfit.push(pick(R, [{ k: 'jacket', color: pick(R, ['#3a3a36', '#5a4a36', '#2a3040', '#6a5a40']), fab: pick(R, ['canvas', 'denim', 'nylon']), dirt }, { k: 'cardigan', color: pick(R, COUNTRY) }, { k: 'puffer', color: pick(R, ['#2a2a30', '#6a2a2a', '#2e3e2e', '#3a4a6a']), sleeve: 1 }]));
    const lk = pick(R, kid ? ['pants', 'shorts'] : ['pants', 'pants', 'pants', 'shorts']);
    L.outfit.push(lk === 'shorts' ? { k: 'shorts', color: pick(R, ['#5a5a4a', '#2a3a5a', '#8a7a5a', '#3a3a3a']), fab: 'canvas', dirt } : Object.assign({ k: 'pants', dirt }, pick(R, [{ fab: 'denim', color: pick(R, DENIM) }, { fab: 'twill', style: 'chinos', color: pick(R, CHINO) }, { fab: 'knit', style: 'trackies', color: '#2c2e34' }, { fab: 'canvas', style: 'cargo', color: '#4a4a3e' }])));
    L.outfit.push({ k: 'shoes', style: pick(R, fem ? ['sneaker', 'sneaker', 'dress', 'sandal', 'boot'] : ['sneaker', 'sneaker', 'boot', 'dress']), color: pick(R, ['#e8e4dc', '#2a2a2a', '#5a3e2a', '#8a8a8a', '#3a3a4a']), accent: pick(R, ['#c83a2a', '#2a6ac8', '#e8e4dc']), dirt: 0.3 + worn * 0.3 });
    // accessories
    if (R() < 0.18) L.acc.push({ k: 'cap', color: pick(R, ['#1c1c1e', '#2a3a5a', '#8a2a2a', '#d8d0c0']), back: R() < 0.3, text: R() < 0.3 ? 'yes' : null, fade: worn * 0.2 });
    else if (cold && R() < 0.4) L.acc.push({ k: 'beanie', color: pick(R, COUNTRY) });
    if (R() < 0.15 + (age > 50 ? 0.3 : 0)) L.acc.push({ k: 'glasses', color: pick(R, ['#2a2622', '#8a6a4a', '#5a5a5a']), round: R() < 0.4 });
    if (o.launch && R() < 0.2) L.acc.push({ k: 'backpack', color: pick(R, TOPC), size: 0.75 });
    if (!kid && R() < 0.2) L.acc.push({ k: 'watch' });
    return L;
  }

  function faction(R, f) {
    const L = civ(R, { country: f === 'bandit' || f === 'retreat', worn: f === 'bandit' ? 1 : 0 });
    const A = L.acc = L.acc.filter(a => a.k !== 'backpack');
    const swapTop = t => { L.outfit[0] = t; };
    if (f === 'landline') { A.push({ k: 'armband', side: 'L' }); if (R() < 0.5) A.push({ k: 'radio', phi: -0.55 }); }
    if (f === 'doorknocker') {
      const brand = pick(R, ['#1f7a4a', '#e05a1a', '#2a5aa8']);
      swapTop(R() < 0.5 ? { k: 'polo', color: brand, logo: 'POWERSAVE', logoInk: 'rgba(240,240,230,0.9)', dirt: 0.4, sweat: 0.6 } : { k: 'tee', color: dim(brand, 0.8), dirt: 0.4 });
      if (R() < 0.5) L.outfit.push({ k: 'vest', color: '#e8d020', fab: 'hivis', stripes: [{ at: 0.35, w: 0.07, color: '#c9ccc8' }], hem: 0.54 });
      A.push({ k: 'lanyard', text: pick(R, ['FIELD REP', 'TEAM CAPTAIN', 'SALES AGENT']) + ' — PowerSave Energy', h: 0.69 }, { k: 'cap', color: brand, text: 'PS' });
    }
    if (f === 'retreat') {
      L.outfit.splice(1, 0, R() < 0.5 ? { k: 'puffer', color: pick(R, ['#2e3a30', '#3a2a2a', '#2a3040', '#4a4436']), sleeve: 1 } : { k: 'vest', color: pick(R, ['#23324a', '#2a3a2a', '#3a2a2a']), fab: 'fleece', text: 'RETREAT\nTEAM' });
      A.push({ k: 'lanyard', text: pick(R, ['FACILITIES', 'OPERATIONS', 'PEOPLE & CULTURE', 'CATERING']) + ' — Offsite', h: 0.66 }, { k: 'beanie', color: pick(R, ['#3a3a36', '#4a3a2a', '#2a2a30']) });
      L.outfit = L.outfit.map(g => g.k === 'shoes' ? { k: 'shoes', style: 'boot', color: '#2a2420' } : g);
    }
    if (f === 'smuggler') { if (R() < 0.6) A.push({ k: 'beanie', color: pick(R, ['#1c1c1e', '#3a3a36']) }); swapTop({ k: 'hoodie', color: pick(R, ['#2a2a2e', '#3a4038', '#4a3a30']), dirt: 0.5, gap: R() < 0.5 ? 0.35 : 0 }); }
    if (f === 'bandit') { L.outfit.splice(1, 0, { k: 'jacket', color: pick(R, ['#5a4a36', '#3a3a30', '#6a5a3a']), fab: 'canvas', dirt: 0.8 }); A.push({ k: 'gloves', color: '#2a2420', fingerless: R() < 0.5 }); }
    return L;
  }
  return { civ, faction };
})();
