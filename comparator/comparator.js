"use strict";

// ── State ────────────────────────────────────────────────────────────────────
let D = null;
let offers = [];
let offerCounter = 0;
let ddMode = false;
let ddToken = null;
let ddByMonth = null;
let ddSelectedSupply = null;

// ── Helpers ──────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function n(v, dec) {
    if (dec === undefined) dec = 2;
    const x = parseFloat(v);
    return isNaN(x) ? '\u2014' : x.toFixed(dec).replace('.', ',');
}

function fmtDate(d) {
    if (!d || d === '0000-00-00') return '\u2014';
    const p = d.split('-');
    return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : esc(d);
}

const COMPANIES = {
    'R2-329':'Repsol Electricidad y Gas','R2-196':'Endesa Energ\xeda XXI',
    'R2-001':'Endesa Energ\xeda','R2-083':'Iberdrola','R2-078':'Naturgy',
    'R2-388':'EDP Espa\xf1a','R2-415':'Totalenergies','R2-458':'Holaluz',
    'R2-396':'Plenitude (Eni)','R2-154':'Repsol','R2-461':'Lucera',
    'R2-475':'Octopus Energy','R2-452':'Factor Energ\xeda','R2-462':'ERES',
};
const TARIFF_LABELS = {
    'A0': function() { return t('tariff.A0', '2.0TD \u2014 Dom\xe9stico hasta 15 kW'); },
    'A1': function() { return t('tariff.A1', '3.0TD \u2014 Entre 15 y 50 kW'); },
};
function getTariffLabel(code) { return (TARIFF_LABELS[code] && TARIFF_LABELS[code]()) || code; }

function numEP() { return D && D.tc === 'A1' ? 6 : 3; }
function numPP() { return D && D.tc === 'A1' ? 6 : 2; }
function pbCls(pi) { return 'pb pb' + Math.min(pi, 6); }
function tCls(pi)  { return 'tag t' + Math.min(pi, 6); }

// ── Cookie banner ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    if (localStorage.getItem('cookieOk') === '1') {
        document.getElementById('cookieBanner').classList.add('hidden');
    }
    if (location.protocol === 'file:') {
        document.getElementById('ddCorsWarn').classList.remove('hidden');
    }
    var isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (isSecure && 'BarcodeDetector' in window) {
        document.getElementById('qrScanBtn').classList.remove('hidden');
    }
});

// ── CNMC URL parser ───────────────────────────────────────────────────────────
function parseUrl() {
    ddMode = false;
    const raw = document.getElementById('cnmcUrl').value.trim();
    if (!raw) { alert(t('alert.no.url', 'Por favor, introduce una URL de la CNMC.')); return; }

    let params;
    try {
        params = Object.fromEntries(new URL(raw).searchParams);
    } catch(e) {
        const m = raw.match(/\?(.+)$/);
        if (!m) { alert(t('alert.invalid.url', 'URL no v\xe1lida. Copia el enlace completo desde la barra del navegador.')); return; }
        params = Object.fromEntries(new URLSearchParams(m[1]));
    }

    const g  = function(k, fb) { if (fb === undefined) fb = 0; const v = parseFloat(params[k]); return isNaN(v) ? fb : v; };
    const ps = function(k, fb) { if (fb === undefined) fb = ''; return params[k] !== undefined ? params[k] : fb; };

    D = {
        cp:ps('cp'), cups:ps('cups'), com:ps('com'), tc:ps('tc'), tf:ps('tf'),
        iniA:ps('iniA'), iniF:ps('iniF'), finF:ps('finF'),
        finContrato:ps('finContrato'), fFact:ps('fFact'),
        pP1:g('pP1'), pP2:g('pP2'), pP3:g('pP3'), pP4:g('pP4'), pP5:g('pP5'), pP6:g('pP6'),
        pmaxP1:g('pmaxP1'), pmaxP2:g('pmaxP2'),
        caP1:g('caP1'), caP2:g('caP2'), caP3:g('caP3'), caP4:g('caP4'), caP5:g('caP5'), caP6:g('caP6'),
        cfP1:g('cfP1'), cfP2:g('cfP2'), cfP3:g('cfP3'), cfP4:g('cfP4'), cfP5:g('cfP5'), cfP6:g('cfP6'),
        prE1:g('prE1'), prE2:g('prE2'), prE3:g('prE3'), prE4:g('prE4'), prE5:g('prE5'), prE6:g('prE6'),
        prP1:g('prP1'), prP2:g('prP2'), prP3:g('prP3'), prP4:g('prP4'), prP5:g('prP5'), prP6:g('prP6'),
        imp:g('imp'), impPot:g('impPot'), impEner:g('impEner'),
        impOtrosSinIE:g('impOtrosSinIE'), impOtrosConIE:g('impOtrosConIE'),
        ajuste:g('ajuste'), finBS:g('finBS'), exc:g('exc'),
    };

    D.days = (D.iniF && D.finF && D.iniF !== '0000-00-00')
        ? Math.max(1, Math.round((new Date(D.finF) - new Date(D.iniF)) / 86400000))
        : 30;

    const eps = numEP();
    for (let i = 1; i <= eps; i++) {
        const cf = 'cfP'+i, ca = 'caP'+i;
        if (!D[cf] && D[ca]) D[cf] = +(D[ca] * D.days / 365).toFixed(3);
    }

    const preBase = D.impPot + D.impEner + D.impOtrosSinIE + D.impOtrosConIE + D.ajuste - D.finBS;
    D.taxMult = (preBase > 0 && D.imp > 0) ? D.imp / preBase : 1.131;

    renderInvoice();

    if (offers.length === 0) {
        offerCounter++;
        offers.push({ id: offerCounter, name: 'Oferta 1', collapsed: false });
    }
    renderOffersList();

    document.getElementById('invoiceCard').classList.remove('hidden');
    document.getElementById('offersCard').classList.remove('hidden');
    document.getElementById('resultsCard').classList.add('hidden');
    document.getElementById('invoiceCard').scrollIntoView({ behavior: 'smooth' });
}

// ── Invoice renderer (CNMC) ───────────────────────────────────────────────────
function renderInvoice() {
    const d = D, eps = numEP(), pps = numPP();

    document.getElementById('contractInfo').innerHTML =
        '<h3>'+t('inv.contract','Datos del contrato')+'</h3>' +
        '<div class="info-grid">' +
        '<div class="info-item"><div class="lbl">'+t('inv.cups','CUPS')+'</div><div class="val" style="font-size:.74rem">'+(esc(d.cups)||'\u2014')+'</div></div>' +
        '<div class="info-item"><div class="lbl">'+t('inv.company','Comercializadora')+'</div><div class="val" style="font-size:.84rem">'+(esc(COMPANIES[d.com]||d.com)||'\u2014')+'</div><div class="sub">'+esc(d.com)+'</div></div>' +
        '<div class="info-item"><div class="lbl">'+t('inv.tariff','Tarifa')+'</div><div class="val" style="font-size:.8rem">'+(esc(getTariffLabel(d.tc))||'\u2014')+'</div></div>' +
        '<div class="info-item"><div class="lbl">'+t('inv.zip','C\xf3digo postal')+'</div><div class="val">'+(esc(d.cp)||'\u2014')+'</div></div>' +
        '<div class="info-item"><div class="lbl">'+t('inv.period','Periodo facturado')+'</div><div class="val" style="font-size:.83rem">'+fmtDate(d.iniF)+' \u2192 '+fmtDate(d.finF)+'</div><div class="sub">'+d.days+' '+t('inv.days','d\xedas')+'</div></div>' +
        '<div class="info-item"><div class="lbl">'+t('inv.end.contract','Fin de contrato')+'</div><div class="val" style="font-size:.88rem">'+fmtDate(d.finContrato)+'</div></div>' +
        '</div>';

    let totCons = 0;
    for (let i = 1; i <= eps; i++) totCons += d['cfP'+i];
    let consItems = '', powItems = '';
    for (let i = 1; i <= eps; i++) {
        consItems += '<div class="info-item"><div class="lbl"><span class="'+pbCls(i)+'">' + t('inv.consumption','Consumo P')+i+'</span></div>' +
            '<div class="val">'+n(d['cfP'+i],1)+' kWh</div><div class="sub">'+t('inv.annual','Anual:')+' '+n(d['caP'+i],0)+' kWh</div></div>';
    }
    for (let i = 1; i <= pps; i++) {
        const maxStr = i <= 2 ? '<div class="sub">'+t('inv.max','M\xe1x:')+' '+n(d['pmaxP'+i],2)+' kW</div>' : '';
        powItems += '<div class="info-item"><div class="lbl"><span class="'+pbCls(i)+'">'+t('inv.power','Potencia P')+i+'</span></div>' +
            '<div class="val">'+n(d['pP'+i],3)+' kW</div>'+maxStr+'</div>';
    }
    document.getElementById('consumptionInfo').innerHTML =
        '<h3>'+t('inv.cons.power','Consumo y potencia')+'</h3><div class="info-grid">' +
        '<div class="info-item"><div class="lbl">'+t('inv.total.period','Total periodo')+'</div><div class="val">'+n(totCons,1)+' kWh</div><div class="sub">'+d.days+' '+t('inv.days','d\xedas')+'</div></div>' +
        consItems+powItems+'</div>';

    let priceItems = '';
    for (let i = 1; i <= eps; i++)
        priceItems += '<div class="info-item"><div class="lbl"><span class="'+pbCls(i)+'">P'+i+'</span> '+t('inv.energy.label','Energ\xeda P')+i+'</div><div class="val">'+n(d['prE'+i],6)+' \u20ac/kWh</div></div>';
    for (let i = 1; i <= pps; i++)
        priceItems += '<div class="info-item"><div class="lbl"><span class="'+pbCls(i)+'">P'+i+'</span> '+t('inv.power.label','Potencia P')+i+'</div><div class="val">'+n(d['prP'+i],5)+' \u20ac/kW\xb7a\xf1o</div></div>';
    document.getElementById('pricesInfo').innerHTML = '<h3>'+t('inv.prices','Precios actuales')+'</h3><div class="info-grid">'+priceItems+'</div>';

    let potRows = '', enerRows = '';
    const potParts = [], enerParts = [];
    for (let i = 1; i <= pps; i++) {
        const v = d['prP'+i]*d['pP'+i]*d.days/365;
        potParts.push(v);
        potRows += '<tr><td><span class="'+tCls(i)+'">P'+i+'</span> '+t('inv.power','Potencia P')+i+' <small style="color:var(--muted)">'+n(d['prP'+i],5)+' \u20ac/kW/a\xf1o \xd7 '+n(d['pP'+i],3)+' kW \xd7 '+d.days+' '+t('inv.days','d\xedas')+'</small></td><td class="r">'+n(v)+' \u20ac</td></tr>';
    }
    for (let i = 1; i <= eps; i++) {
        const v = d['prE'+i]*d['cfP'+i];
        enerParts.push(v);
        enerRows += '<tr><td><span class="'+tCls(i)+'">P'+i+'</span> '+t('inv.energy.label','Energ\xeda P')+i+' <small style="color:var(--muted)">'+n(d['prE'+i],6)+' \u20ac/kWh \xd7 '+n(d['cfP'+i],1)+' kWh</small></td><td class="r">'+n(v)+' \u20ac</td></tr>';
    }

    const ieBase = d.impPot + d.impEner + d.impOtrosConIE;
    const ie     = ieBase * 0.0511269;
    const preVat = d.impPot + d.impEner + d.impOtrosSinIE + d.impOtrosConIE + d.ajuste - d.finBS + ie;
    D.vatPct = preVat > 0 && d.imp > 0 ? Math.max(0, (d.imp/preVat-1)*100) : 10;
    const vatAmt = d.imp - preVat;

    const otrosRow  = (d.impOtrosSinIE||d.impOtrosConIE) ? '<tr><td>'+t('inv.meter','Contador y otros cargos')+'</td><td class="r">'+n(d.impOtrosSinIE+d.impOtrosConIE)+' \u20ac</td></tr>' : '';
    const ajusteRow = d.ajuste  ? '<tr><td>'+t('inv.adjust','Ajuste de facturaci\xf3n')+'</td><td class="r">'+n(d.ajuste)+' \u20ac</td></tr>' : '';
    const bonoRow   = d.finBS>0 ? '<tr><td>'+t('inv.bonus','Descuento Bono Social')+'</td><td class="r" style="color:var(--ok)">\u2212'+n(d.finBS)+' \u20ac</td></tr>' : '';

    document.getElementById('invoiceBreakdown').innerHTML =
        '<h3>'+t('inv.breakdown','Desglose de la factura')+'</h3><div class="overflow"><table class="tbl">' +
        '<thead><tr><th>'+t('inv.concept','Concepto')+'</th><th class="r">'+t('inv.amount','Importe')+'</th></tr></thead><tbody>' +
        potRows+'<tr class="sub"><td>'+t('inv.power.sub','Subtotal Potencia')+'</td><td class="r">'+n(d.impPot)+' \u20ac</td></tr>' +
        enerRows+'<tr class="sub"><td>'+t('inv.energy.sub','Subtotal Energ\xeda')+'</td><td class="r">'+n(d.impEner)+' \u20ac</td></tr>' +
        otrosRow+ajusteRow+bonoRow+
        '<tr><td>'+t('inv.elec.tax','Imp. Electricidad (5,11269%)')+'</td><td class="r">'+n(ie)+' \u20ac</td></tr>' +
        '<tr><td>'+t('inv.vat','IVA')+' ('+n(D.vatPct,1)+'%)</td><td class="r">'+n(vatAmt)+' \u20ac</td></tr>' +
        '<tr class="tot"><td>'+t('inv.total','TOTAL FACTURA')+'</td><td class="r">'+n(d.imp)+' \u20ac</td></tr>' +
        '</tbody></table></div>' +
        '<p class="note">'+t('inv.note','* El c\xe1lculo es estimado por posibles redondeos. Total oficial CNMC:')+' <strong>'+n(d.imp)+' \u20ac</strong>.</p>';
}

// ── Offers ────────────────────────────────────────────────────────────────────
function saveOfferInputs() {
    const eps = 6, pps = 6;
    offers.forEach(function(o) {
        const gv = function(id) { const el = document.getElementById(id); return el ? el.value : ''; };
        o.sName = gv('o'+o.id+'_name') || o.sName || o.name;
        o.sPrE  = []; for (let i=1;i<=eps;i++) o.sPrE.push(gv('o'+o.id+'_prE'+i));
        o.sPrP  = []; for (let i=1;i<=pps;i++) o.sPrP.push(gv('o'+o.id+'_prP'+i));
        o.sPP   = []; for (let i=1;i<=pps;i++) o.sPP.push(gv('o'+o.id+'_pP'+i));
        o.sDto  = gv('o'+o.id+'_dto');
        o.sFix  = gv('o'+o.id+'_fixedFee');
        o.sExc  = gv('o'+o.id+'_compExc');
        const tdChk = document.querySelector('input[name="td_'+o.id+'"]:checked');
        if (tdChk) o.offerTd = tdChk.value;
    });
}

function renderOffersList() {
    document.getElementById('offersList').innerHTML =
        offers.map(function(o, idx) { return offerCardHtml(o, idx+1); }).join('');
}

function addOffer() {
    saveOfferInputs();
    offerCounter++;
    offers.push({ id: offerCounter, name: 'Oferta '+offerCounter, collapsed: false, offerTd: D ? D.tc : 'A0' });
    renderOffersList();
}

function removeOffer(id) {
    saveOfferInputs();
    offers = offers.filter(function(o) { return o.id !== id; });
    if (offers.length === 0) { offerCounter++; offers.push({ id:offerCounter, name:'Oferta 1', collapsed:false }); }
    renderOffersList();
}

function toggleOffer(id) {
    saveOfferInputs();
    const o = offers.find(function(o) { return o.id === id; });
    if (o) o.collapsed = !o.collapsed;
    renderOffersList();
}

function changeTd(id, val) {
    saveOfferInputs();
    const o = offers.find(function(o) { return o.id === id; });
    if (o) o.offerTd = val;
    renderOffersList();
}

function offerCardHtml(offer, num) {
    const d = D;
    const offerTd = offer.offerTd || (D ? D.tc : 'A0');
    const eps = offerTd === 'A1' ? 6 : 3;
    const pps = offerTd === 'A1' ? 6 : 2;
    const ge = function(i) { return offer.sPrE && offer.sPrE[i] !== undefined ? offer.sPrE[i] : String(d['prE'+(i+1)] || ''); };
    const gp = function(i) { return offer.sPrP && offer.sPrP[i] !== undefined ? offer.sPrP[i] : String(d['prP'+(i+1)] || ''); };
    const gk = function(i) { return offer.sPP  && offer.sPP[i]  !== undefined ? offer.sPP[i]  : String(d['pP'+(i+1)]  || ''); };
    const gn = function()  { return offer.sName || offer.name; };

    let eFields = '', pPriceFields = '', pKWFields = '';
    for (let i=0; i<eps; i++) {
        const pi = i+1;
        eFields += '<div class="fg"><label><span class="'+pbCls(pi)+'">P'+pi+'</span> '+t('offer.energy.label','Energ\xeda P')+pi+' (\u20ac/kWh)</label>' +
            '<input type="number" id="o'+offer.id+'_prE'+pi+'" step="0.000001" value="'+esc(ge(i))+'" placeholder="0,000000"></div>';
    }
    for (let i=0; i<pps; i++) {
        const pi = i+1;
        const curKW = d['pP'+pi] || 0;
        pPriceFields += '<div class="fg"><label><span class="'+pbCls(pi)+'">P'+pi+'</span> '+t('offer.power.price.label','Potencia P')+pi+' (\u20ac/kW/a\xf1o)</label>' +
            '<input type="number" id="o'+offer.id+'_prP'+pi+'" step="0.00001" value="'+esc(gp(i))+'" placeholder="0"></div>';
        pKWFields += '<div class="fg"><label><span class="'+pbCls(pi)+'">P'+pi+'</span> '+t('offer.contracted.label','Potencia contratada (kW)')+'</label>' +
            '<input type="number" id="o'+offer.id+'_pP'+pi+'" step="0.001" value="'+esc(gk(i))+'" placeholder="'+n(curKW,3)+'"></div>';
    }

    const coll   = offer.collapsed ? 'collapsed' : '';
    const ico    = offer.collapsed ? '&#9654;' : '&#9660;';
    const delBtn = offers.length > 1
        ? '<button class="btn-del" onclick="event.stopPropagation();removeOffer('+offer.id+')">'+t('offer.del','\u2715 Eliminar')+'</button>' : '';

    return '<div class="offer-card '+coll+'" id="oc_'+offer.id+'">' +
        '<div class="offer-header" onclick="toggleOffer('+offer.id+')">' +
        '<span class="offer-num">'+num+'</span>' +
        '<input class="offer-name-inp" type="text" id="o'+offer.id+'_name" value="'+esc(gn())+'" placeholder="'+t('offer.name.ph','Nombre de la oferta')+'" onclick="event.stopPropagation()">' +
        '<button class="offer-toggle" aria-label="Plegar/desplegar">'+ico+'</button>' +
        delBtn+'</div>' +
        '<div class="offer-body">' +
        '<div class="td-sel">' +
        '<span class="td-sel-lbl">'+t('offer.td.label','Tipo de tarifa:')+'</span>' +
        '<label class="td-opt'+(offerTd==='A0'?' active':'')+'" onclick="changeTd('+offer.id+',\'A0\')">' +
        '<input type="radio" name="td_'+offer.id+'" value="A0"'+(offerTd==='A0'?' checked':'')+' style="pointer-events:none"> 2.0TD <small>3 periodos</small></label>' +
        '<label class="td-opt'+(offerTd==='A1'?' active':'')+'" onclick="changeTd('+offer.id+',\'A1\')">' +
        '<input type="radio" name="td_'+offer.id+'" value="A1"'+(offerTd==='A1'?' checked':'')+' style="pointer-events:none"> 3.0TD <small>6 periodos</small></label>' +
        '</div>' +
        '<h3>'+t('offer.energy.h3','Precios de energ\xeda (\u20ac/kWh)')+'</h3><div class="form-grid">'+eFields+'</div>' +
        '<h3>'+t('offer.power.h3','Precios de potencia (\u20ac/kW/a\xf1o)')+'</h3>' +
        '<p class="hint" style="margin-bottom:.5rem">'+t('offer.power.hint','Si la oferta tiene un precio \xfanico de potencia (p.ej. 28,43 \u20ac/kW/a\xf1o), intr\xf3ducelo en todos los periodos.')+'</p>' +
        '<div class="form-grid">'+pPriceFields+'</div>' +
        '<h3>'+t('offer.contracted.h3','Potencia contratada \u2014 si cambia respecto a la actual')+'</h3><div class="form-grid">'+pKWFields+'</div>' +
        '<h3>'+t('offer.other.h3','Otros t\xe9rminos')+'</h3><div class="form-grid">' +
        '<div class="fg"><label>Descuento sobre energ\xeda (%)</label><input type="number" id="o'+offer.id+'_dto" step="0.01" min="0" max="100" value="'+esc(offer.sDto||'')+'" placeholder="0"><div class="sh">% de descuento sobre el t\xe9rmino de energ\xeda</div></div>' +
        '<div class="fg"><label>Cuota fija mensual (\u20ac)</label><input type="number" id="o'+offer.id+'_fixedFee" step="0.01" value="'+esc(offer.sFix||'')+'" placeholder="0"><div class="sh">Cargo fijo mensual adicional de la tarifa</div></div>' +
        '<div class="fg"><label>Compensaci\xf3n excedentes (\u20ac/kWh)</label><input type="number" id="o'+offer.id+'_compExc" step="0.001" value="'+esc(offer.sExc||'')+'" placeholder="0"><div class="sh">Precio compra excedentes solar'+(d.exc>0?' \xb7 factura: '+n(d.exc,2)+' kWh':'')+'</div></div>' +
        '</div></div></div>';
}

function getOfferData(id) {
    const d = D, eps = 6, pps = 6;
    const gv = function(elId, fb) { const v = parseFloat(document.getElementById(elId) && document.getElementById(elId).value); return isNaN(v) ? fb : v; };
    const nameEl = document.getElementById('o'+id+'_name');
    const ofr    = offers.find(function(o) { return o.id === id; });
    const prE = [], prP = [], pP = [];
    for (let i=0;i<eps;i++) prE.push(gv('o'+id+'_prE'+(i+1), d['prE'+(i+1)] || 0));
    for (let i=0;i<pps;i++) { prP.push(gv('o'+id+'_prP'+(i+1), d['prP'+(i+1)] || 0)); pP.push(gv('o'+id+'_pP'+(i+1), d['pP'+(i+1)] || 0)); }
    return {
        id: id,
        name:    (nameEl && nameEl.value) || (ofr && ofr.sName) || 'Oferta '+id,
        prE: prE, prP: prP, pP: pP,
        dto:     gv('o'+id+'_dto',      0) / 100,
        fixedFee:gv('o'+id+'_fixedFee', 0),
        compExc: gv('o'+id+'_compExc',  0),
    };
}

function calcOffer(od) {
    const d = D, eps = 6, pps = 6;
    const potParts = [], enerParts = [];
    let newPot = 0, newEner = 0;
    for (let i=0;i<pps;i++) { const v = od.prP[i]*od.pP[i]*d.days/365; potParts.push(v); newPot += v; }
    for (let i=0;i<eps;i++) { const v = od.prE[i]*d['cfP'+(i+1)]*(1-od.dto); enerParts.push(v); newEner += v; }
    const excComp  = od.compExc * d.exc;
    const fixedPer = od.fixedFee * (d.days / 30.4375);
    const newBase  = newPot + newEner + d.impOtrosSinIE + d.impOtrosConIE + d.ajuste - d.finBS + fixedPer - excComp;
    const newTotal = newBase * d.taxMult;
    return { potParts:potParts, enerParts:enerParts, newPot:newPot, newEner:newEner, excComp:excComp, fixedPer:fixedPer, newBase:newBase, newTotal:newTotal };
}

function calcCurrent() {
    const d = D, eps = 6, pps = 6;
    const potParts = [], enerParts = [];
    for (let i=0;i<pps;i++) potParts.push(d['prP'+(i+1)]*d['pP'+(i+1)]*d.days/365);
    for (let i=0;i<eps;i++) enerParts.push(d['prE'+(i+1)]*d['cfP'+(i+1)]);
    return {
        potParts:potParts, enerParts:enerParts,
        newPot:d.impPot, newEner:d.impEner,
        excComp:0, fixedPer:0,
        newBase: d.impPot+d.impEner+d.impOtrosSinIE+d.impOtrosConIE+d.ajuste-d.finBS,
        newTotal:d.imp,
    };
}

// ── Comparison ────────────────────────────────────────────────────────────────
function compareContracts() {
    if (!D || !offers.length) return;
    const d = D, eps = 6, pps = 6;

    const allOD   = offers.map(function(o) { return getOfferData(o.id); });
    const allCalc = allOD.map(function(od) { return calcOffer(od); });
    const curCalc = ddMode ? null : calcCurrent();

    let minT = Infinity, maxT = -Infinity;
    allCalc.forEach(function(c) { if (c.newTotal < minT) minT = c.newTotal; if (c.newTotal > maxT) maxT = c.newTotal; });
    const multi = allOD.length > 1;

    const curCard = ddMode ? '' :
        '<div class="sc cur">' +
        '<div class="sc-name">'+t('cmp.current','Tarifa actual')+'</div>' +
        '<div class="sc-total">'+n(d.imp)+' \u20ac</div>' +
        '<div class="sc-diff" style="color:var(--muted)">'+t('cmp.reference','Referencia')+'</div>' +
        '<div class="sc-period">'+d.days+' '+t('inv.days','d\xedas')+' \xb7 \u2248 '+n(d.imp*30.4375/d.days)+' \u20ac/mes<br>'+t('cmp.annual','proyecci\xf3n anual:')+' \u2248 '+n(d.imp*365/d.days)+' \u20ac</div></div>';

    let offerCards = '';
    allCalc.forEach(function(c, idx) {
        const od = allOD[idx];
        const refT = ddMode ? minT : d.imp;
        const diff = c.newTotal - refT, savs = -diff;
        const isBest  = multi && Math.abs(c.newTotal - minT) < 0.01;
        const isWorst = multi && Math.abs(c.newTotal - maxT) < 0.01 && maxT > minT + 0.01;
        const cls     = isBest ? 'best' : isWorst ? 'worst' : '';
        const vsLabel = ddMode ? t('cmp.vs.best','mejor oferta') : t('cmp.vs.cur','actual');
        const diffHtml = (!multi && ddMode) ? '<div class="sc-diff" style="color:var(--muted)">'+t('cmp.only','Oferta \xfanica')+'</div>' :
            Math.abs(savs) < 0.5
            ? '<div class="sc-diff" style="color:var(--muted)">'+t('cmp.equal','\u2248 igual que referencia')+'</div>'
            : savs > 0
                ? '<div class="sc-diff ok">\u25bc \u2212'+n(savs)+' \u20ac vs '+vsLabel+'</div>'
                : '<div class="sc-diff ko">\u25b2 +'+n(-savs)+' \u20ac vs '+vsLabel+'</div>';
        offerCards += '<div class="sc '+cls+'">' +
            (isBest ? '<div class="crown">&#128081;</div>' : '') +
            '<div class="sc-name">'+esc(od.name)+'</div>' +
            '<div class="sc-total">'+n(c.newTotal)+' \u20ac</div>' +
            diffHtml +
            '<div class="sc-period">'+d.days+' '+t('inv.days','d\xedas')+' \xb7 \u2248 '+n(c.newTotal*30.4375/d.days)+' \u20ac/mes<br>'+t('cmp.annual','proyecci\xf3n anual:')+' \u2248 '+n(c.newTotal*365/d.days)+' \u20ac</div>' +
            (isBest ? '<span class="sc-badge">'+t('cmp.best.badge','Mejor oferta')+'</span>' : '') +
            '</div>';
    });

    document.getElementById('summaryCards').innerHTML = '<div class="summary-grid">'+curCard+offerCards+'</div>';

    const thOffers = allOD.map(function(od) { return '<th class="r">'+esc(od.name)+'</th>'; }).join('');
    const thCur = ddMode ? '' : '<th class="r">'+t('cmp.current','Tarifa actual')+'</th>';

    function cRow(label, cur, vals, dec) {
        if (!dec) dec = 2;
        const curCell = ddMode ? '' : '<td class="r">'+n(cur,dec)+' \u20ac</td>';
        const cells = vals.map(function(v) {
            const delta = ddMode ? (multi ? v - Math.min.apply(null,vals) : 0) : (v - cur);
            const cls   = delta < -0.005 ? 'cell-ok' : delta > 0.005 ? 'cell-ko' : '';
            const sign  = delta > 0 ? '+' : '';
            return '<td class="r '+cls+'">'+n(v,dec)+' \u20ac'+(Math.abs(delta)>0.005?' <small style="opacity:.6">('+sign+n(delta,dec)+')</small>':'')+' </td>';
        }).join('');
        return '<tr><td>'+label+'</td>'+curCell+cells+'</tr>';
    }
    function sRow(label, cur, vals) {
        const curCell = ddMode ? '' : '<td class="r">'+n(cur)+' \u20ac</td>';
        const cells = vals.map(function(v) {
            const delta = ddMode ? (multi ? v - Math.min.apply(null,vals) : 0) : (v - cur);
            const cls   = delta < -0.005 ? 'cell-ok' : delta > 0.005 ? 'cell-ko' : '';
            const sign  = delta > 0 ? '+' : '';
            return '<td class="r '+cls+'">'+n(v)+' \u20ac'+(Math.abs(delta)>0.005?' <small style="opacity:.6">('+sign+n(delta)+')</small>':'')+' </td>';
        }).join('');
        return '<tr class="sub"><td>'+label+'</td>'+curCell+cells+'</tr>';
    }

    let rows = '';

    for (let i=0; i<pps; i++) {
        const pi = i+1;
        const curPotVal = ddMode ? 0 : curCalc.potParts[i];
        const anyPotVal = allCalc.some(function(c){return Math.abs(c.potParts[i]) > 0.0001;});
        if (Math.abs(curPotVal) > 0.0001 || anyPotVal) {
            rows += cRow('<span class="'+tCls(pi)+'">P'+pi+'</span> '+t('inv.power','Potencia P')+pi+' \u2014 '+n(d['pP'+pi]||0,3)+' kW',
                curPotVal, allCalc.map(function(c){return c.potParts[i];}), 4);
        }
    }
    rows += sRow(t('cmp.power.sub','Subtotal Potencia'), ddMode ? 0 : curCalc.newPot, allCalc.map(function(c){return c.newPot;}));

    for (let i=0; i<eps; i++) {
        const pi = i+1;
        const curEnerVal = ddMode ? 0 : curCalc.enerParts[i];
        const anyEnerVal = allCalc.some(function(c){return Math.abs(c.enerParts[i]) > 0.0001;});
        const offerHasPrice = allOD.some(function(od){return od.prE[i] > 0;});
        if (Math.abs(curEnerVal) > 0.0001 || anyEnerVal || offerHasPrice) {
            const cfLabel = (d['cfP'+pi]||0) > 0 ? n(d['cfP'+pi],1)+' kWh' : '0 kWh';
            rows += cRow('<span class="'+tCls(pi)+'">P'+pi+'</span> '+t('inv.energy.label','Energ\xeda P')+pi+' \u2014 '+cfLabel,
                curEnerVal, allCalc.map(function(c){return c.enerParts[i];}), 4);
        }
    }
    rows += sRow(t('cmp.energy.sub','Subtotal Energ\xeda'), ddMode ? 0 : curCalc.newEner, allCalc.map(function(c){return c.newEner;}));

    if (allCalc.some(function(c){return c.fixedPer > 0.001;})) {
        rows += cRow(t('cmp.fixed','Cuota fija del periodo'), 0, allCalc.map(function(c){return c.fixedPer;}));
    }

    if (allCalc.some(function(c){return c.excComp > 0.001;})) {
        const excCurCell = ddMode ? '' : '<td class="r">\u2014 \u20ac</td>';
        const cells = allCalc.map(function(c) {
            const cls = c.excComp > 0.005 ? 'cell-ok' : '';
            return '<td class="r '+cls+'">'+(c.excComp > 0 ? '\u2212' : '')+n(c.excComp)+' \u20ac <small style="opacity:.6">('+t('cmp.surplus.credit','(cr\xe9dito)').replace(/[()]/g,'')+')</small></td>';
        }).join('');
        rows += '<tr><td>'+t('cmp.surplus.comp','Comp. excedentes')+'\u2014 '+n(d.exc,2)+' kWh</td>'+excCurCell+cells+'</tr>';
    }

    const curTax = ddMode ? 0 : d.imp - curCalc.newBase;
    rows += cRow(t('cmp.taxes','Impuestos y otros (estimado)'), curTax, allCalc.map(function(c){return c.newTotal-c.newBase;}));

    const totCurCell = ddMode ? '' : '<td class="r">'+n(d.imp)+' \u20ac</td>';
    const totCells = allCalc.map(function(c) {
        const ref  = ddMode ? minT : d.imp;
        const diff = c.newTotal - ref;
        const cls  = diff < -0.005 ? 'cell-ok' : diff > 0.005 ? 'cell-ko' : '';
        const sign = diff > 0 ? '+' : '';
        return '<td class="r '+cls+'">'+n(c.newTotal)+' \u20ac <small style="opacity:.75">('+sign+n(diff)+')</small></td>';
    }).join('');
    rows += '<tr class="tot"><td>'+t('cmp.total','TOTAL PERIODO (estimado)')+'</td>'+totCurCell+totCells+'</tr>';

    const annCur     = ddMode ? 0 : d.imp * 365 / d.days;
    const annMinT    = minT * 365 / d.days;
    const annCurCell = ddMode ? '' : '<td class="r">'+n(annCur)+' \u20ac/a\xf1o</td>';
    const annCells   = allCalc.map(function(c) {
        const a    = c.newTotal * 365 / d.days;
        const refA = ddMode ? annMinT : annCur;
        const diff = a - refA;
        const cls  = diff < -0.005 ? 'cell-ok' : diff > 0.005 ? 'cell-ko' : '';
        const sign = diff > 0 ? '+' : '';
        return '<td class="r '+cls+'">'+n(a)+' \u20ac <small style="opacity:.6">('+sign+n(diff)+')</small></td>';
    }).join('');
    rows += '<tr class="sub"><td>'+t('cmp.annual.proj','Proyecci\xf3n anual estimada')+'</td>'+annCurCell+annCells+'</tr>';

    let cmpHtml = '<div class="overflow"><table class="tbl">' +
        '<thead><tr><th>Concepto</th>'+thCur+thOffers+'</tr></thead>' +
        '<tbody>'+rows+'</tbody></table></div>';
    if (ddMode && ddByMonth) { cmpHtml += renderMonthlyTable(allOD); }
    document.getElementById('cmpTable').innerHTML = cmpHtml;

    document.getElementById('cmpNote').textContent = ddMode
        ? t('cmp.note.dd', '* Importes estimados con multiplicador fiscal por defecto (1,131). El resultado real puede variar por cargos fijos del distribuidor y festivos auton\xf3micos no incluidos en el c\xe1lculo.')
        : t('cmp.note.cnmc', '* Los impuestos de las ofertas se estiman aplicando el mismo multiplicador fiscal de la factura original. El resultado es una aproximaci\xf3n; la factura real puede variar por cargos del sistema, redondeos y condiciones espec\xedficas de cada comercializadora.');

    document.getElementById('resultsCard').classList.remove('hidden');
    document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth' });
}

function renderMonthlyTable(allOD) {
    const months = Object.keys(ddByMonth).sort();
    if (!months.length) return '';
    const MESES = [t('m.1','Ene'),t('m.2','Feb'),t('m.3','Mar'),t('m.4','Abr'),t('m.5','May'),t('m.6','Jun'),t('m.7','Jul'),t('m.8','Ago'),t('m.9','Sep'),t('m.10','Oct'),t('m.11','Nov'),t('m.12','Dic')];
    const thOffers = allOD.map(function(od) { return '<th class="r">'+esc(od.name)+'</th>'; }).join('');
    const monthTotals = allOD.map(function() { return 0; });
    let rows = '';
    months.forEach(function(mk) {
        const m = ddByMonth[mk];
        const daysM = m.days || 30;
        const parts = mk.split('-');
        const label = MESES[parseInt(parts[1],10)-1]+' '+parts[0];
        const cfM = [m.cfP1||0, m.cfP2||0, m.cfP3||0, 0, 0, 0];
        const excM = m.exc || 0;
        const monthCosts = allOD.map(function(od, idx) {
            const ofr  = offers.find(function(o) { return o.id === od.id; });
            const ppsM = (ofr && ofr.offerTd === 'A1') ? 6 : 2;
            const epsM = (ofr && ofr.offerTd === 'A1') ? 6 : 3;
            let pot = 0, ener = 0;
            for (let i=0; i<ppsM; i++) pot  += od.prP[i] * od.pP[i] * daysM / 365;
            for (let i=0; i<epsM; i++) ener += od.prE[i] * cfM[i] * (1 - od.dto);
            const base  = pot + ener + od.fixedFee*(daysM/30.4375) - od.compExc*excM;
            const total = base * D.taxMult;
            monthTotals[idx] += total;
            return total;
        });
        const minM  = Math.min.apply(null, monthCosts);
        const cells = monthCosts.map(function(c) {
            const best = allOD.length > 1 && Math.abs(c - minM) < 0.01;
            return '<td class="r'+(best?' cell-ok':'')+'">'+n(c)+' \u20ac</td>';
        }).join('');
        rows += '<tr><td>'+esc(label)+'</td>'+cells+'</tr>';
    });
    const minTotal = Math.min.apply(null, monthTotals);
    const totCells = monthTotals.map(function(t) {
        const best = allOD.length > 1 && Math.abs(t - minTotal) < 0.01;
        return '<td class="r'+(best?' cell-ok':'')+'" style="font-weight:700">'+n(t)+' \u20ac</td>';
    }).join('');
    rows += '<tr class="tot"><td>'+t('cmp.total.period','TOTAL PERIODO')+'</td>'+totCells+'</tr>';
    return '<h3 style="margin-top:1.5rem;margin-bottom:.75rem;font-size:.85rem;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.4px">'+t('cmp.monthly.title','Desglose mensual')+'</h3>' +
        '<div class="overflow"><table class="tbl">' +
        '<thead><tr><th>'+t('cmp.month.col','Mes')+'</th>'+thOffers+'</tr></thead>' +
        '<tbody>'+rows+'</tbody></table></div>';
}

// ── Source tab switcher ───────────────────────────────────────────────────────
function switchSrc(src) {
    document.querySelectorAll('.src-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('.src-tab[data-src="'+src+'"]').classList.add('active');
    document.getElementById('srcCnmc').classList.toggle('hidden', src !== 'cnmc');
    document.getElementById('srcDatadis').classList.toggle('hidden', src !== 'datadis');
}

// ── Datadis ───────────────────────────────────────────────────────────────────
function getEaster(year) {
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,
          f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
          i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,
          m=Math.floor((a+11*h+22*l)/451),
          mo=Math.floor((h+l-7*m+114)/31),
          dy=((h+l-7*m+114)%31)+1;
    return new Date(year, mo-1, dy);
}

function getNationalHolidays(year) {
    const h = new Set();
    const a = function(mo,dy) { h.add(year+'-'+String(mo).padStart(2,'0')+'-'+String(dy).padStart(2,'0')); };
    a(1,1); a(1,6); a(5,1); a(8,15); a(10,12); a(11,1); a(12,6); a(12,8); a(12,25);
    const easter = getEaster(year);
    const gf = new Date(easter); gf.setDate(easter.getDate()-2); a(gf.getMonth()+1, gf.getDate());
    const jj = new Date(easter); jj.setDate(easter.getDate()-3); a(jj.getMonth()+1, jj.getDate());
    return h;
}

function getPeriod20TD(date, hour, holidays) {
    const dow = date.getDay();
    const ds  = date.toISOString().slice(0,10);
    if (dow===0 || dow===6 || holidays.has(ds)) return 3;
    if (hour < 8) return 3;
    if ((hour>=10 && hour<14) || (hour>=18 && hour<22)) return 1;
    return 2;
}

async function ddDoLogin() {
    const u = document.getElementById('ddUser').value.trim();
    const p = document.getElementById('ddPass').value;
    if (!u || !p) { alert(t('alert.nif', 'Introduce NIF y contrase\xf1a.')); return; }
    const btn = document.getElementById('ddLoginBtn');
    btn.disabled = true; btn.textContent = t('dd.connecting', 'Conectando...');
    const st = document.getElementById('ddLoginStatus');
    st.className = 'dd-status dd-ok'; st.textContent = t('dd.authenticating', 'Autenticando...'); st.classList.remove('hidden');
    try {
        const r = await fetch('https://datadis.es/nikola-auth/tokens/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'username='+encodeURIComponent(u)+'&password='+encodeURIComponent(p)
        });
        if (!r.ok) throw new Error('HTTP '+r.status);
        ddToken = (await r.text()).trim();
        if (!ddToken || ddToken.length < 10) throw new Error(t('dd.err.token', 'Token inv\xe1lido recibido'));
        document.getElementById('ddPass').value = '';
        st.textContent = t('dd.loading.supplies', 'Conectado. Cargando suministros...');
        await ddLoadSupplies();
    } catch(e) {
        st.className = 'dd-status dd-err';
        st.textContent = 'Error: '+e.message+'. '+t('dd.err.credentials', 'Comprueba credenciales y que la p\xe1gina se sirve desde un servidor (no file://).');
        btn.disabled = false; btn.textContent = t('dd.connect.btn', '\ud83d\udd11 Conectar con Datadis');
    }
}

async function ddLoadSupplies() {
    const r = await fetch('https://datadis.es/api-private/api/get-supplies',
        { headers: { 'Authorization': 'Bearer '+ddToken } });
    if (!r.ok) throw new Error('Suministros HTTP '+r.status);
    const supplies = await r.json();
    if (!Array.isArray(supplies) || !supplies.length) throw new Error(t('dd.err.no.supplies', 'No se encontraron suministros asociados a la cuenta'));
    document.getElementById('ddLoginPanel').classList.add('hidden');
    document.getElementById('ddLoginStatus').classList.add('hidden');
    document.getElementById('ddSupplyPanel').classList.remove('hidden');
    const now = new Date();
    const toM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    const fromD = new Date(now); fromD.setMonth(fromD.getMonth()-12);
    const fromM = fromD.getFullYear()+'-'+String(fromD.getMonth()+1).padStart(2,'0');
    document.getElementById('ddFrom').value = fromM;
    document.getElementById('ddTo').value   = toM;
    window._ddSupplies = supplies;
    ddSelectedSupply = supplies[0];
    document.getElementById('ddSupplyList').innerHTML = supplies.map(function(s, idx) {
        return '<div class="supply-item'+(idx===0?' selected':'')+'" onclick="ddSelectSupply(this,'+idx+')">' +
            '<input type="radio" name="ddCups"'+(idx===0?' checked':'')+' style="accent-color:var(--primary);flex-shrink:0">' +
            '<div><div style="font-weight:700;font-size:.9rem">'+esc(s.cups||'-')+'</div>' +
            '<div class="supply-cups">'+(s.address||s.postalCode||'')+(s.pointType?' \xb7 Tipo '+s.pointType:'')+' \xb7 Distr. '+esc(s.distributorCode||'-')+'</div></div>' +
            '</div>';
    }).join('');
}

function ddSelectSupply(el, idx) {
    document.querySelectorAll('.supply-item').forEach(function(i) {
        i.classList.remove('selected');
        const radio = i.querySelector('input[type=radio]'); if (radio) radio.checked = false;
    });
    el.classList.add('selected');
    const radio = el.querySelector('input[type=radio]'); if (radio) radio.checked = true;
    ddSelectedSupply = window._ddSupplies[idx];
}

async function ddFetchData() {
    if (!ddSelectedSupply) { alert(t('alert.supply', 'Selecciona un suministro.')); return; }
    const p1 = parseFloat(document.getElementById('ddPow1').value)||0;
    const p2 = parseFloat(document.getElementById('ddPow2').value)||0;
    const fromVal = document.getElementById('ddFrom').value;
    const toVal   = document.getElementById('ddTo').value;
    if (!fromVal || !toVal) { alert(t('alert.dates', 'Selecciona el rango de fechas.')); return; }
    const btn = document.getElementById('ddFetchBtn');
    btn.disabled = true; btn.textContent = t('dd.loading', 'Cargando...');
    const st = document.getElementById('ddFetchStatus');
    st.className = 'dd-status dd-ok'; st.textContent = t('dd.downloading', 'Descargando consumos horarios (puede tardar unos segundos)...'); st.classList.remove('hidden');
    try {
        const s    = ddSelectedSupply;
        const cups = s.cups || s.CUPS || '';
        const dist = s.distributorCode || s.distributor || '';
        const pt   = s.pointType || 1;
        const url  = 'https://datadis.es/api-private/api/get-consumption-data'
            + '?cups='+encodeURIComponent(cups)
            + '&distributorCode='+encodeURIComponent(dist)
            + '&startDate='+encodeURIComponent(fromVal.replace('-','/'))
            + '&endDate='+encodeURIComponent(toVal.replace('-','/'))
            + '&measurementType=0&pointType='+encodeURIComponent(pt);
        const r = await fetch(url, { headers: { 'Authorization': 'Bearer '+ddToken } });
        if (!r.ok) throw new Error('HTTP '+r.status);
        const rows = await r.json();
        if (!Array.isArray(rows)) throw new Error(t('dd.err.response', 'Respuesta inesperada de la API'));
        st.textContent = rows.length+t('dd.processing', ' registros. Procesando...');
        ddByMonth = processHourly(rows);
        ddMode    = true;
        const months = Object.keys(ddByMonth).sort();
        if (!months.length) throw new Error(t('dd.err.no.data', 'Sin datos de consumo en el periodo seleccionado'));
        let cfP1=0,cfP2=0,cfP3=0,exc=0,totalDays=0;
        months.forEach(function(mk) {
            const m = ddByMonth[mk]; cfP1+=m.cfP1; cfP2+=m.cfP2; cfP3+=m.cfP3; exc+=m.exc; totalDays+=m.days;
        });
        D = {
            cups:cups, com:'', tc:'A0', tf:'', cp:s.postalCode||'',
            iniF:months[0]+'-01', finF:months[months.length-1]+'-28',
            finContrato:'', fFact:'', iniA:'',
            pP1:p1, pP2:p2, pP3:0, pP4:0, pP5:0, pP6:0, pmaxP1:0, pmaxP2:0,
            caP1:totalDays>0?+(cfP1*365/totalDays).toFixed(1):0,
            caP2:totalDays>0?+(cfP2*365/totalDays).toFixed(1):0,
            caP3:totalDays>0?+(cfP3*365/totalDays).toFixed(1):0,
            caP4:0, caP5:0, caP6:0,
            cfP1:cfP1, cfP2:cfP2, cfP3:cfP3, cfP4:0, cfP5:0, cfP6:0,
            prE1:0,prE2:0,prE3:0,prE4:0,prE5:0,prE6:0,
            prP1:0,prP2:0,prP3:0,prP4:0,prP5:0,prP6:0,
            imp:0, impPot:0, impEner:0, impOtrosSinIE:0, impOtrosConIE:0,
            ajuste:0, finBS:0, exc:exc, days:totalDays, taxMult:1.131, vatPct:10,
        };
        if (offers.length===0) { offerCounter++; offers.push({id:offerCounter,name:'Oferta 1',collapsed:false,offerTd:'A0'}); }
        renderInvoiceDatadis(months, cfP1, cfP2, cfP3, exc, totalDays, cups, s.postalCode||'');
        renderOffersList();
        document.getElementById('invoiceCard').classList.remove('hidden');
        document.getElementById('offersCard').classList.remove('hidden');
        document.getElementById('resultsCard').classList.add('hidden');
        document.getElementById('invoiceCard').scrollIntoView({behavior:'smooth'});
        st.textContent = '\u2705 '+t('dd.fetch.btn.text','\u21d3 Cargar consumos horarios').replace('\u21d3 ','') + ' ' + months.length + ' meses, ' + Math.round(totalDays) + ' ' + t('inv.days','d\xedas') + '. ' + t('dd.period.note','Introduce las ofertas en el paso 3 y pulsa Comparar.').split('. ').slice(-1)[0];
    } catch(e) {
        st.className = 'dd-status dd-err';
        st.textContent = 'Error: '+e.message;
    } finally {
        btn.disabled = false; btn.textContent = t('dd.fetch.btn', '\u21d3 Cargar consumos horarios');
    }
}

function processHourly(rows) {
    const byMonth = {}, yearCache = {};
    rows.forEach(function(row) {
        const ds = (row.date||'').replace(/\//g,'-');
        if (!ds || ds.length < 10) return;
        const hour = parseInt((row.time||row.hour||'0').split(':')[0], 10);
        const mk   = ds.slice(0,7);
        const yr   = parseInt(ds.slice(0,4), 10);
        if (!yearCache[yr]) yearCache[yr] = getNationalHolidays(yr);
        const date = new Date(ds+'T12:00:00');
        const p    = getPeriod20TD(date, hour, yearCache[yr]);
        if (!byMonth[mk]) byMonth[mk] = {cfP1:0,cfP2:0,cfP3:0,exc:0,days:new Set()};
        byMonth[mk]['cfP'+p] += parseFloat(row.consumptionKWh||row.consumption||0)||0;
        byMonth[mk].exc       += parseFloat(row.surplusEnergyKWh||row.surplus||0)||0;
        byMonth[mk].days.add(ds);
    });
    Object.keys(byMonth).forEach(function(k) { byMonth[k].days = byMonth[k].days.size; });
    return byMonth;
}

function renderInvoiceDatadis(months, cfP1, cfP2, cfP3, exc, totalDays, cups, cp) {
    const tot = cfP1+cfP2+cfP3;
    const pct = function(v) { return tot > 0 ? n(v/tot*100,1) : '0'; };
    document.getElementById('contractInfo').innerHTML =
        '<h3>'+t('dd.inv.contract','Datos del suministro (Datadis)')+'</h3>' +
        '<div class="info-grid">' +
        '<div class="info-item"><div class="lbl">'+t('inv.cups','CUPS')+'</div><div class="val" style="font-size:.74rem">'+esc(cups)+'</div></div>' +
        '<div class="info-item"><div class="lbl">'+t('inv.zip','C\xf3digo postal')+'</div><div class="val">'+(esc(cp)||'\u2014')+'</div></div>' +
        '<div class="info-item"><div class="lbl">'+t('inv.tariff','Tarifa')+'</div><div class="val">'+t('dd.tariff','2.0TD peninsular')+'</div></div>' +
        '<div class="info-item"><div class="lbl">'+t('dd.inv.period','Periodo')+'</div><div class="val" style="font-size:.83rem">'+esc(months[0])+' \u2192 '+esc(months[months.length-1])+'</div><div class="sub">'+Math.round(totalDays)+' '+t('inv.days','d\xedas')+'</div></div>' +
        '</div>';
    document.getElementById('consumptionInfo').innerHTML =
        '<h3>'+t('dd.cons.title','Consumo total por periodo (2.0TD peninsular)')+'</h3>' +
        '<div class="info-grid">' +
        '<div class="info-item"><div class="lbl">'+t('dd.cons.total','Total')+'</div><div class="val">'+n(tot,1)+' kWh</div><div class="sub">'+Math.round(totalDays)+' '+t('inv.days','d\xedas')+'</div></div>' +
        '<div class="info-item"><div class="lbl"><span class="pb pb1">P1</span> '+t('dd.cons.p1','Punta (10-14h, 18-22h L-V)')+'</div><div class="val">'+n(cfP1,1)+' kWh</div><div class="sub">'+pct(cfP1)+'%</div></div>' +
        '<div class="info-item"><div class="lbl"><span class="pb pb2">P2</span> '+t('dd.cons.p2','Llano (resto L-V laborable)')+'</div><div class="val">'+n(cfP2,1)+' kWh</div><div class="sub">'+pct(cfP2)+'%</div></div>' +
        '<div class="info-item"><div class="lbl"><span class="pb pb3">P3</span> '+t('dd.cons.p3','Valle (0-8h y S/D/festivos)')+'</div><div class="val">'+n(cfP3,1)+' kWh</div><div class="sub">'+pct(cfP3)+'%</div></div>' +
        (exc>0?'<div class="info-item"><div class="lbl">'+t('dd.cons.surplus','Excedentes')+'</div><div class="val">'+n(exc,1)+' kWh</div></div>':'')+
        '</div>';
    document.getElementById('pricesInfo').innerHTML =
        '<p class="hint" style="margin-top:.5rem">'+t('dd.period.note','Periodos calculados seg\xfan Circular CNMC 3/2020 (festivos nacionales peninsulares; festivos auton\xf3micos no incluidos). Introduce las ofertas en el paso 3 y pulsa Comparar.')+'</p>';
    document.getElementById('invoiceBreakdown').innerHTML = '';
}

// ── CSV export / import ───────────────────────────────────────────────────────
function exportOffersCSV() {
    saveOfferInputs();
    const SEP = '|';
    const header = 'nombre|tarifa|prE1|prE2|prE3|prE4|prE5|prE6|prP1|prP2|prP3|prP4|prP5|prP6|pP1|pP2|pP3|pP4|pP5|pP6|descuento|cuotaFija|compExc';
    const rows = offers.map(function(o) {
        const e = function(v) { return String(v||'').replace(/\|/g, '\\|'); };
        const prE = []; for (let i=0;i<6;i++) prE.push(o.sPrE && o.sPrE[i] !== undefined ? o.sPrE[i] : '');
        const prP = []; for (let i=0;i<6;i++) prP.push(o.sPrP && o.sPrP[i] !== undefined ? o.sPrP[i] : '');
        const pP  = []; for (let i=0;i<6;i++) pP.push(o.sPP  && o.sPP[i]  !== undefined ? o.sPP[i]  : '');
        return [e(o.sName||o.name), e(o.offerTd||'A0'),
            ...prE.map(e), ...prP.map(e), ...pP.map(e),
            e(o.sDto||''), e(o.sFix||''), e(o.sExc||'')
        ].join(SEP);
    });
    const csv = [header].concat(rows).join('\n');
    const blob = new Blob([csv], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ofertas_luz.csv'; a.click();
    URL.revokeObjectURL(url);
}

function parseCSVLine(line) {
    return line.split('|').map(function(v) { return v.replace(/\\\|/g, '|').trim(); });
}

function loadTemplate(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        const newOffers = [];
        const lines = ev.target.result.trim().split('\n');
        for (let li = 1; li < lines.length; li++) {
            const cols = parseCSVLine(lines[li]);
            if (cols.length < 2 || !cols[0]) continue;
            offerCounter++;
            newOffers.push({
                id: offerCounter, collapsed: false,
                name: cols[0], sName: cols[0],
                offerTd: cols[1] || 'A0',
                sPrE: cols.slice(2,8), sPrP: cols.slice(8,14), sPP: cols.slice(14,20),
                sDto: cols[20]||'', sFix: cols[21]||'', sExc: cols[22]||'',
            });
        }
        if (!newOffers.length) { alert(t('alert.no.offers.file', 'No se encontraron ofertas v\xe1lidas en el archivo.')); return; }
        offers = newOffers;
        renderOffersList();
        document.getElementById('offersCard').classList.remove('hidden');
        input.value = '';
    };
    reader.readAsText(file);
}

function importOffersCSV(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        const lines = ev.target.result.trim().split('\n');
        if (lines.length < 2) { alert(t('alert.csv.empty', 'CSV vac\xedo o sin datos.')); return; }
        const newOffers = [];
        for (let li = 1; li < lines.length; li++) {
            const cols = parseCSVLine(lines[li]);
            if (cols.length < 2 || !cols[0]) continue;
            offerCounter++;
            newOffers.push({
                id: offerCounter, collapsed: false,
                name: cols[0], sName: cols[0],
                offerTd: cols[1] || 'A0',
                sPrE: cols.slice(2,8), sPrP: cols.slice(8,14), sPP: cols.slice(14,20),
                sDto: cols[20]||'', sFix: cols[21]||'', sExc: cols[22]||'',
            });
        }
        if (!newOffers.length) { alert(t('alert.no.offers.csv', 'No se encontraron ofertas v\xe1lidas en el CSV.')); return; }
        offers = newOffers;
        renderOffersList();
        document.getElementById('offersCard').classList.remove('hidden');
        input.value = '';
    };
    reader.readAsText(file);
}

// ── QR Scanner ────────────────────────────────────────────────────────────────
var qrStream = null;
var qrInterval = null;

async function startQRScanner() {
    var modal  = document.getElementById('qrModal');
    var video  = document.getElementById('qrVideo');
    var status = document.getElementById('qrStatus');
    modal.classList.remove('hidden');
    status.textContent = t('qr.starting', 'Iniciando c\xe1mara...');

    try {
        qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        video.srcObject = qrStream;
        await video.play();

        var detector = new BarcodeDetector({ formats: ['qr_code'] });
        status.textContent = t('qr.aim', 'Apunta al c\xf3digo QR de tu factura');

        qrInterval = setInterval(async function () {
            if (video.readyState < 2) return;
            try {
                var codes = await detector.detect(video);
                if (!codes.length) return;
                var raw = codes[0].rawValue;
                if (raw.includes('comparador.cnmc.gob.es')) {
                    document.getElementById('cnmcUrl').value = raw;
                    stopQRScanner();
                    parseUrl();
                } else {
                    status.textContent = t('qr.not.cnmc', 'QR detectado, pero no es una URL de la CNMC. Intenta de nuevo.');
                }
            } catch (e) { /* frame skip */ }
        }, 400);
    } catch (e) {
        status.textContent = t('qr.cam.error', 'Error al acceder a la c\xe1mara: ') + e.message;
    }
}

function stopQRScanner() {
    clearInterval(qrInterval); qrInterval = null;
    if (qrStream) { qrStream.getTracks().forEach(function (tk) { tk.stop(); }); qrStream = null; }
    var video = document.getElementById('qrVideo');
    if (video) video.srcObject = null;
    document.getElementById('qrModal').classList.add('hidden');
}
