export function contentFailure(status, title, url) {
  if (status === null) return 'missing HTTP response';
  if (status >= 400) return `HTTP ${status}`;
  if (/access denied|just a moment|checking your browser|verify.{0,20}human|captcha|attention required|request blocked|pardon our interruption|security verification|robot or human|client challenge|^oh noes!$|your access has been blocked|are you a robot|access to this page has been denied|^error page\s*\|\s*ebay$|^page not found(?:\s*[-|].*)?$|^hang tight!\s*routing to checkout/i.test(title)) return 'access challenge or blocked document';
  if (/\/(login|signin|sign-in)(?:\/|\?|$)/i.test(new URL(url).pathname)) return 'authentication redirect';
  return null;
}
export function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
export function successfulResource(status) { return status >= 200 && status < 400; }
export function meanOrNull(values) {
  return values.length && values.every(v => finiteOrNull(v) !== null) ? values.reduce((a,b)=>a+b,0)/values.length : null;
}
export function summarizePage(page, runs, lighthouse) {
  const valid = runs.filter(r=>r.eligible && r.actions.length === 2 && r.actions.every(a=>a.command_success));
  const durations = valid.flatMap(r=>r.actions.map(a=>a.command_duration_ms));
  const requests = valid.reduce((s,r)=>s+r.network.request_count,0);
  const successful = valid.reduce((s,r)=>s+r.network.successful_request_count,0);
  const metrics = {
    lcp_ms: lighthouse.success ? finiteOrNull(lighthouse.lcp_ms) : null,
    cls: lighthouse.success ? finiteOrNull(lighthouse.cls) : null,
    accessibility_audit_score: lighthouse.success ? finiteOrNull(lighthouse.accessibility_audit_score) : null,
    scroll_command_duration_ms: meanOrNull(durations),
    resource_success_pct: requests ? 100*successful/requests : null,
  };
  const reasons=[];
  if(valid.length<3) reasons.push('fewer than three eligible browser runs');
  if(Object.values(metrics).some(v=>v===null)) reasons.push('missing retained measurement');
  return {...page,metrics,eligible:reasons.length===0,exclusion_reasons:reasons,eligible_runs:valid.length,lighthouse};
}
