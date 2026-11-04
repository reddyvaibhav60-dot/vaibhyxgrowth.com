/*! Vaibhyx Growth — unified tracking layer v1.0
 *  Pushes clean, flat events to window.dataLayer for GTM -> Meta Pixel / CAPI / GA4 / Google Ads.
 *  Debug:  add ?vgdebug=1 to any URL (logs every event to the console)
 *  Exclude your own visits: open any page once with ?notrack=1  (re-enable with ?track=1)
 */
(function (w, d) {
  'use strict';
  w.dataLayer = w.dataLayer || [];

  var Q = new URLSearchParams(w.location.search);

  /* ---------- storage / cookie helpers ---------- */
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} return null; }
  function cookie(n) { var m = d.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function setCookie(n, v, days) { d.cookie = n + '=' + encodeURIComponent(v) + ';max-age=' + (days * 86400) + ';path=/;SameSite=Lax'; }
  function uuid() {
    if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  /* ---------- internal traffic + debug ---------- */
  if (Q.get('notrack') === '1') ls('vg_internal', '1');
  if (Q.get('track') === '1') ls('vg_internal', null);
  var INTERNAL = ls('vg_internal') === '1';
  var DEBUG = Q.get('vgdebug') === '1';

  /* ---------- page identity ---------- */
  var FILE = (w.location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  var SERVICES = {
    'google-ads': 'Google Ads Management', 'meta-ads': 'Meta Ads Management', 'seo': 'SEO Optimization',
    'linkedin': 'LinkedIn B2B Lead Gen', 'tracking': 'Tracking & Analytics', 'landing-page': 'Landing Page Design',
    'ad-creatives': 'Ad Creatives', 'crm': 'CRM & Automation', 'campaign-launch': 'End-to-End Campaign Launch'
  };
  var PAGE_TYPE = FILE === 'index' ? 'home' : FILE === 'audit' ? 'audit' : FILE === 'thank-you' ? 'thank_you' : SERVICES[FILE] ? 'service' : 'other';
  var SERVICE = SERVICES[FILE] || (FILE === 'audit' ? 'Free Growth Audit' : '');

  /* ---------- identity: client, session, visits ---------- */
  var CID = ls('vg_cid'); if (!CID) { CID = uuid(); ls('vg_cid', CID); }
  var SID = ss('vg_sid'), newSession = false;
  if (!SID) { SID = uuid(); ss('vg_sid', SID); newSession = true; ls('vg_vc', String((parseInt(ls('vg_vc'), 10) || 0) + 1)); }
  var VISITS = parseInt(ls('vg_vc'), 10) || 1;

  /* ---------- attribution: first touch + last touch (90 days) ---------- */
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'fbclid', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'li_fat_id'];
  var NINETY = 90 * 864e5;

  function channel(t, host) {
    var m = (t.utm_medium || '').toLowerCase(), s = (t.utm_source || '').toLowerCase();
    if (t.gclid || t.gbraid || t.wbraid || (/cpc|ppc|paid/.test(m) && /google|bing/.test(s))) return 'paid_search';
    if (t.fbclid || /paid_social|paidsocial|cpm/.test(m) || (/cpc|paid/.test(m) && /facebook|instagram|meta|fb|ig/.test(s))) return 'paid_social';
    if (/cpc|ppc|paid/.test(m)) return 'paid_other';
    if (/email/.test(m)) return 'email';
    if (host) {
      if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(host)) return 'organic_search';
      if (/facebook\.|instagram\.|linkedin\.|t\.co|twitter\.|x\.com|youtube\./.test(host)) return 'organic_social';
      return 'referral';
    }
    return 'direct';
  }

  function capture() {
    var t = {}, found = false;
    KEYS.forEach(function (k) { var v = Q.get(k); if (v) { t[k] = v; found = true; } });
    var host = '';
    try { host = d.referrer ? new URL(d.referrer).hostname : ''; } catch (e) {}
    if (host === w.location.hostname) host = '';
    var ft = parse(ls('vg_ft')), lt = parse(ls('vg_lt'));
    var fresh = function (x) { return x && x.ts && (Date.now() - x.ts) < NINETY; };
    var make = function () { t.channel = channel(t, host); t.referrer_host = host; t.landing_page = w.location.pathname; t.ts = Date.now(); return t; };
    if (found || host || !fresh(lt)) { lt = make(); ls('vg_lt', JSON.stringify(lt)); }
    if (!fresh(ft)) { ft = lt; ls('vg_ft', JSON.stringify(ft)); }
    if (t.fbclid && !cookie('_fbc')) setCookie('_fbc', 'fb.1.' + Date.now() + '.' + t.fbclid, 90);
    return { ft: ft, lt: lt };
  }
  var T = capture(), FT = T.ft || {}, LT = T.lt || {};

  /* ---------- core push ---------- */
  function device() { var x = w.innerWidth; return x < 768 ? 'mobile' : x < 1024 ? 'tablet' : 'desktop'; }

  function base() {
    return {
      page_type: PAGE_TYPE, page_path: w.location.pathname, page_title: d.title, service_name: SERVICE,
      session_id: SID, client_id: CID, traffic_channel: LT.channel || '',
      utm_source: LT.utm_source || '', utm_medium: LT.utm_medium || '', utm_campaign: LT.utm_campaign || '',
      utm_content: LT.utm_content || '', utm_term: LT.utm_term || ''
    };
  }

  function push(ev, data) {
    if (INTERNAL) { if (DEBUG) console.log('[vg] skipped (internal visitor):', ev); return null; }
    var o = Object.assign({ event: ev, event_id: uuid() }, base(), data || {});
    w.dataLayer.push(o);
    if (DEBUG) console.log('[vg]', ev, o);
    return o;
  }

  // Backwards compatible helper: dlPush(event, category, label)
  w.dlPush = function (ev, cat, label, extra) { push(ev, Object.assign({ click_category: cat || '', click_label: label || '' }, extra || {})); };

  /* ---------- sections ---------- */
  var SECTION_SEL = 'section[id],header,footer,.hero,.page-hero,.feat-sec,.form-card,.bigcta,.wa-fab';
  function sectionOf(el) {
    var s = el.closest && el.closest('[data-section]');
    if (s) return s.getAttribute('data-section');
    s = el.closest && el.closest(SECTION_SEL);
    if (!s) return 'page';
    if (s.id) return s.id;
    if (/^(HEADER|FOOTER)$/.test(s.tagName)) return s.tagName.toLowerCase();
    return String(s.className || '').split(' ')[0] || 'section';
  }

  /* ---------- page view + view content ---------- */
  function pageView() {
    push('vg_page_view', {
      page_url: w.location.href, page_referrer: d.referrer, visit_count: VISITS, new_session: newSession,
      device_type: device(), viewport: w.innerWidth + 'x' + w.innerHeight, screen_size: (w.screen ? w.screen.width + 'x' + w.screen.height : ''),
      language: navigator.language || '', connection_type: (navigator.connection && navigator.connection.effectiveType) || ''
    });
    if (PAGE_TYPE === 'service' || PAGE_TYPE === 'audit') {
      push('view_content', { content_name: SERVICE, content_type: 'service', content_category: PAGE_TYPE === 'audit' ? 'audit' : 'service_page', content_ids: [FILE] });
    }
  }

  /* ---------- clicks (every link and button) ---------- */
  d.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('a,button,[data-track]');
    if (!el) return;
    var href = el.getAttribute('href') || '', abs = el.href || '';
    var text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    var ev = el.getAttribute('data-track'), meta = '';
    if (/wa\.me|whatsapp\.com/.test(abs)) { ev = 'whatsapp_click'; meta = 'Contact'; }
    else if (/^mailto:/i.test(href)) { ev = 'email_click'; meta = 'Contact'; }
    else if (/^tel:/i.test(href)) { ev = 'phone_click'; meta = 'Contact'; }
    else if (!ev) {
      if (el.tagName === 'A') {
        if (href.charAt(0) === '#') ev = 'anchor_click';
        else { var u = null; try { u = new URL(abs); } catch (x) {} ev = (u && u.hostname !== w.location.hostname) ? 'outbound_click' : 'internal_link_click'; }
      } else ev = 'button_click';
    }
    var data = {
      click_category: el.getAttribute('data-track-category') || '', click_label: el.getAttribute('data-track-label') || text,
      click_text: text, click_url: abs, click_id: el.id || '', click_section: sectionOf(el)
    };
    if (meta) data.meta_event = meta;
    push(ev, data);
  }, true);

  /* ---------- scroll depth ---------- */
  var STEPS = [10, 25, 50, 75, 90, 100], fired = {}, maxScroll = 0, ticking = false;
  function scrollPct() {
    var de = d.documentElement, b = d.body;
    var h = Math.max(de.scrollHeight, b.scrollHeight) - w.innerHeight;
    if (h <= 0) return 0;
    return Math.min(100, Math.round((w.pageYOffset || de.scrollTop || 0) / h * 100));
  }
  w.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    w.requestAnimationFrame(function () {
      ticking = false;
      var p = scrollPct(); if (p > maxScroll) maxScroll = p;
      STEPS.forEach(function (s) { if (p >= s && !fired[s]) { fired[s] = 1; push('scroll_depth', { percent_scrolled: s, scroll_depth_label: s + '%' }); } });
    });
  }, { passive: true });

  /* ---------- engaged time (visible + active only) ---------- */
  var engaged = 0, lastAct = Date.now(), TIMES = [15, 30, 60, 120, 180], firedT = {};
  ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (t) { w.addEventListener(t, function () { lastAct = Date.now(); }, { passive: true }); });
  setInterval(function () {
    if (d.visibilityState === 'visible' && (Date.now() - lastAct) < 10000) {
      engaged++;
      TIMES.forEach(function (s) { if (engaged >= s && !firedT[s]) { firedT[s] = 1; push('engaged_time', { engaged_seconds: s }); } });
    }
  }, 1000);

  /* ---------- section views ---------- */
  function observeSections() {
    if (!('IntersectionObserver' in w)) return;
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var n = sectionOf(en.target);
        if (!seen[n]) { seen[n] = 1; push('section_view', { section_name: n }); }
        io.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    d.querySelectorAll('section[id],.hero,.page-hero,.feat-sec,.form-card,.bigcta,footer').forEach(function (el) { io.observe(el); });
  }

  /* ---------- forms ---------- */
  var form = { started: false, submitted: false, abandonSent: false, done: {}, last: '', count: 0 };
  function formId() { return PAGE_TYPE === 'audit' ? 'audit' : (SERVICE || FILE); }
  var FIELD = '.mform input,.mform select,.mform textarea';

  d.addEventListener('focusin', function (e) {
    var t = e.target; if (!t.matches || !t.matches(FIELD)) return;
    form.last = t.id || t.name || '';
    if (!form.started) { form.started = true; push('form_start', { form_id: formId(), form_type: PAGE_TYPE === 'audit' ? 'audit' : 'service', first_field: form.last }); }
  });
  function fieldDone(e) {
    var t = e.target; if (!t.matches || !t.matches(FIELD)) return;
    if (t.tagName === 'SELECT' && e.type !== 'change') return;
    var n = t.id || t.name;
    if (!n || form.done[n] || !String(t.value).trim()) return;
    form.done[n] = 1; form.count++;
    push('form_field_complete', { form_id: formId(), field_name: n, fields_completed: form.count });
  }
  d.addEventListener('focusout', fieldDone);
  d.addEventListener('change', fieldDone);

  function watchErrors() {
    if (!w.MutationObserver) return;
    d.querySelectorAll('.merr').forEach(function (el) {
      new MutationObserver(function () {
        if (el.style.display === 'block' && el.textContent) push('form_validation_error', { form_id: formId(), error_message: el.textContent.slice(0, 120) });
      }).observe(el, { attributes: true, attributeFilter: ['style'], childList: true, characterData: true, subtree: true });
    });
  }
  function formAbandon() {
    if (form.started && !form.submitted && !form.abandonSent) {
      form.abandonSent = true;
      push('form_abandon', { form_id: formId(), last_field: form.last, fields_completed: form.count });
    }
  }

  /* ---------- lead capture + Meta dedupe ---------- */
  function phoneDigits(p) {
    var x = String(p || '').replace(/\D/g, '');
    if (x.length === 10) x = '91' + x; else if (x.length === 11 && x.charAt(0) === '0') x = '91' + x.slice(1);
    return x;
  }

  function sheetFields(eid) {
    return {
      event_id: eid || '', session_id: SID, client_id: CID, page_url: w.location.href, landing_page: FT.landing_page || '',
      referrer: d.referrer, fbp: cookie('_fbp'), fbc: cookie('_fbc'),
      fbclid: LT.fbclid || FT.fbclid || '', gclid: LT.gclid || FT.gclid || '', gbraid: LT.gbraid || FT.gbraid || '', wbraid: LT.wbraid || FT.wbraid || '',
      utm_source: LT.utm_source || '', utm_medium: LT.utm_medium || '', utm_campaign: LT.utm_campaign || '', utm_content: LT.utm_content || '', utm_term: LT.utm_term || '',
      traffic_channel: LT.channel || '',
      first_source: FT.utm_source || FT.referrer_host || '', first_medium: FT.utm_medium || '', first_campaign: FT.utm_campaign || '', first_channel: FT.channel || '',
      user_agent: navigator.userAgent, device_type: device(), visit_count: VISITS, engaged_seconds: engaged, max_scroll_percent: maxScroll
    };
  }

  function formSubmit(i) {
    form.submitted = true;
    var eid = uuid();
    var lead = {
      event_id: eid, form_type: i.form_type, form_id: formId(), service_name: i.service || SERVICE,
      email: String(i.email || '').toLowerCase().trim(), phone: phoneDigits(i.phone),
      first_name: String(i.name || '').trim().split(/\s+/)[0] || '', city: String(i.city || '').toLowerCase().trim(),
      business_category: i.category || '', budget: i.budget || '', goal: i.goal || '', ts: Date.now()
    };
    ss('vg_lead', JSON.stringify(lead));
    var data = {
      event_id: eid, form_id: lead.form_id, form_type: lead.form_type, service_name: lead.service_name,
      business_category: lead.business_category, budget: lead.budget, goal: lead.goal, fields_completed: form.count
    };
    push('form_submit', data);
    push(lead.form_type === 'audit' ? 'audit_form_submit' : 'service_form_submit', data); // legacy event names
    return { event_id: eid, sheet: sheetFields(eid) };
  }

  // Fires the real conversion ONCE, on the thank-you page only, and only after a genuine submission.
  function leadConfirmed(eidParam) {
    var lead = parse(ss('vg_lead'));
    var eid = (lead && lead.event_id) || eidParam || '';
    if (!eid) { push('thank_you_direct_visit', {}); return false; }
    var key = 'vg_lead_fired_' + eid;
    if (ls(key)) { push('lead_duplicate_blocked', { event_id: eid }); return false; }
    ls(key, '1');
    var ud = {};
    if (lead) {
      if (lead.email) ud.email = lead.email;
      if (lead.phone) ud.phone_number = '+' + lead.phone;
      if (lead.first_name || lead.city) ud.address = { first_name: lead.first_name, city: lead.city, country: 'in' };
    }
    var svc = (lead && lead.service_name) || '';
    var type = (lead && lead.form_type) || 'unknown';
    push('thank_you_page_view', { conversion_type: type, service_name: svc });
    push('generate_lead', {
      event_id: eid, lead_type: type, form_type: type, service_name: svc, content_name: svc,
      content_category: type === 'audit' ? 'audit' : 'service_quote',
      business_category: (lead && lead.business_category) || '', budget: (lead && lead.budget) || '', goal: (lead && lead.goal) || '',
      fbp: cookie('_fbp'), fbc: cookie('_fbc'),
      user_email: (lead && lead.email) || '', user_phone_digits: (lead && lead.phone) || '', user_data: ud
    });
    return true;
  }

  /* ---------- exit, performance, errors, copy ---------- */
  var exitSent = false;
  function exitPage() {
    if (exitSent) return; exitSent = true;
    push('page_exit', { engaged_seconds: engaged, max_scroll_percent: maxScroll });
    formAbandon();
  }
  d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') exitPage(); else exitSent = false; });
  w.addEventListener('pagehide', exitPage);

  var exitIntent = false;
  d.addEventListener('mouseout', function (e) {
    if (exitIntent || e.relatedTarget || e.clientY > 0 || engaged < 5) return;
    exitIntent = true;
    push('exit_intent', { max_scroll_percent: maxScroll, form_started: form.started });
  });

  w.addEventListener('load', function () {
    setTimeout(function () {
      var n = w.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (!n) return;
      push('page_performance', { ttfb_ms: Math.round(n.responseStart), dom_ready_ms: Math.round(n.domContentLoadedEventEnd), load_ms: Math.round(n.loadEventEnd) });
    }, 0);
  });

  var errs = 0;
  w.addEventListener('error', function (e) {
    if (!e || !e.message || errs++ >= 5) return;
    push('js_error', { error_message: String(e.message).slice(0, 150), error_source: String(e.filename || '').split('/').pop(), error_line: e.lineno || 0 });
  });

  d.addEventListener('copy', function () {
    var s = String(w.getSelection ? w.getSelection() : '').trim();
    if (!s || s.length > 80) return;
    var digits = s.replace(/\D/g, '');
    if (s.indexOf('@') > -1) push('copy_email', {});
    else if (digits.length >= 10 && digits.length <= 13) push('copy_phone', {});
  });

  /* ---------- init + public API ---------- */
  function init() { pageView(); observeSections(); watchErrors(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();

  w.vgTrack = {
    push: push, formSubmit: formSubmit, leadConfirmed: leadConfirmed, sheetFields: sheetFields,
    attribution: function () { return { first: FT, last: LT }; }
  };
})(window, document);
