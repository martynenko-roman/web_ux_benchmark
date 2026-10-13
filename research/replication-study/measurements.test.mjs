import test from 'node:test';
import assert from 'node:assert/strict';
import {contentFailure,finiteOrNull,meanOrNull,summarizePage} from './measurements.mjs';
test('failed navigation and challenges cannot become valid content',()=>{
  assert.equal(contentFailure(403,'Example','https://example.com'),'HTTP 403');
  assert.equal(contentFailure(200,'Just a moment...','https://example.com'),'access challenge or blocked document');
  assert.equal(contentFailure(200,'Client Challenge','https://pypi.org/search/'),'access challenge or blocked document');
  assert.equal(contentFailure(200,'Oh noes!','https://example.com'),'access challenge or blocked document');
  assert.equal(contentFailure(200,'Sign in','https://example.com/login'),'authentication redirect');
  assert.equal(contentFailure(200,'Example','https://example.com'),null);
});
test('missing, negative and nonfinite measurements remain unavailable',()=>{
  for(const v of [null,undefined,NaN,Infinity,-1,'0',true]) assert.equal(finiteOrNull(v),null);
  assert.equal(finiteOrNull(0),0);assert.equal(meanOrNull([]),null);assert.equal(meanOrNull([10,20]),15);
});
test('no successful runs or failed audit never produces perfect scores',()=>{
  const row=summarizePage({id:'x'},[],{success:false});
  assert.equal(row.eligible,false);for(const v of Object.values(row.metrics))assert.equal(v,null);
});
test('eligibility requires three runs and complete retained evidence',()=>{
  const run={eligible:true,actions:[{command_success:true,command_duration_ms:10},{command_success:true,command_duration_ms:20}],network:{request_count:4,successful_request_count:3}};
  const lh={success:true,lcp_ms:1000,cls:0,accessibility_audit_score:90};
  assert.equal(summarizePage({},[run,run],lh).eligible,false);
  const row=summarizePage({},[run,run,run],lh);assert.equal(row.eligible,true);assert.equal(row.metrics.resource_success_pct,75);assert.equal(row.metrics.scroll_command_duration_ms,15);
});
