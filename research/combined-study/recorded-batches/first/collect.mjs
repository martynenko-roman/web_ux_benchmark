import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
import {contentFailure,summarizePage} from './measurements.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const require=createRequire(new URL('../../package.json',import.meta.url));
const {chromium}=require('playwright');
const protocolPath=path.join(here,'protocol.json');
const protocol=JSON.parse(await readFile(protocolPath,'utf8'));
const manifest=JSON.parse(await readFile(path.join(here,'pages.json'),'utf8'));
const outputDir=path.resolve(process.env.STUDY_OUTPUT||path.join(here,'data'));
const reportPath=path.join(outputDir,'report.json');
const runsPath=path.join(outputDir,'runs.json');
await mkdir(path.join(outputDir,'raw','lighthouse'),{recursive:true});
await mkdir(path.join(outputDir,'raw','browser'),{recursive:true});
const sourceHashes={};
for(const name of ['protocol.json','pages.json','collect.mjs','lighthouse-worker.mjs','measurements.mjs'])sourceHashes[name]=createHash('sha256').update(await readFile(path.join(here,name))).digest('hex');
const report={metadata:{dataset_id:protocol.dataset_id,protocol_id:protocol.protocol_id,started_utc:new Date().toISOString(),completed_utc:null,source_commit:process.env.STUDY_SOURCE_COMMIT||null,source_sha256:sourceHashes,environment:{node:process.version,playwright:require('playwright/package.json').version,lighthouse:require('lighthouse/package.json').version,platform:os.platform(),os_release:os.release(),arch:os.arch(),cpu_model:os.cpus()[0].model,logical_cpus:os.cpus().length,memory_bytes:os.totalmem(),browser_executable:protocol.browser.executable,launch_args:protocol.browser.launch_args},protocol},pages:[]};
const allRuns={metadata:report.metadata,pages:[]};
try {await access(reportPath);throw new Error('Output report already exists; choose a distinct STUDY_OUTPUT directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(path.join(outputDir,'pages.json'),await readFile(path.join(here,'pages.json')));
await writeFile(path.join(outputDir,'protocol.json'),await readFile(protocolPath));
const browser=await chromium.launch({headless:true,executablePath:protocol.browser.executable,args:protocol.browser.launch_args.filter(x=>!x.startsWith('--headless'))});
report.metadata.environment.browser_version=browser.version();
const sourceOnly=process.argv.includes('--source-check');
if(sourceOnly) {await browser.close();console.log(JSON.stringify(report.metadata));process.exit(0);}
let seed=protocol.order_seed>>>0;
function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
const pages=[...manifest.pages];
for(let i=pages.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pages[i],pages[j]]=[pages[j],pages[i]];}
async function save(){await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');await writeFile(runsPath,JSON.stringify(allRuns,null,2)+'\n');}
async function browserRun(target,runIndex){
  const context=await browser.newContext({viewport:protocol.browser.viewport,deviceScaleFactor:1,locale:protocol.browser.locale,timezoneId:protocol.browser.timezone,serviceWorkers:'block'});
  const page=await context.newPage();
  const requests=new Map();const row={run:runIndex,started_utc:new Date().toISOString(),eligible:false,navigation_success:false,actions:[],errors:[]};
  page.on('request',req=>requests.set(req,{status:null,finished:false,failure:null,resource_type:req.resourceType()}));
  page.on('response',res=>{const entry=requests.get(res.request());if(entry)entry.status=res.status();});
  page.on('requestfinished',req=>{const entry=requests.get(req);if(entry)entry.finished=true;});
  page.on('requestfailed',req=>{const entry=requests.get(req);if(entry)entry.failure=req.failure()?.errorText||'request failed';});
  try {
    const response=await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:protocol.browser.navigation_timeout_ms});
    row.http_status=response?.status()??null;
    await page.waitForTimeout(protocol.browser.post_navigation_wait_ms);
    row.final_url=page.url();row.document_title=await page.title();
    row.content_failure=contentFailure(row.http_status,row.document_title,row.final_url);
    row.navigation_success=true;
    if(!row.content_failure){
      await page.mouse.move(protocol.browser.viewport.width/2,protocol.browser.viewport.height/2);
      for(let actionIndex=0;actionIndex<2;actionIndex++){
        const action={action_index:actionIndex,type:'wheel',delta_y:protocol.browser.scroll_delta_y,command_success:false,command_duration_ms:null};
        const before=await page.evaluate(()=>({x:scrollX,y:scrollY}));
        const begin=performance.now();
        try {await page.mouse.wheel(0,protocol.browser.scroll_delta_y);action.command_duration_ms=performance.now()-begin;action.command_success=true;}
        catch(error){action.error={name:error.name,message:error.message};}
        await page.waitForTimeout(protocol.browser.post_action_observation_ms);
        const after=await page.evaluate(()=>({x:scrollX,y:scrollY,document_height:document.documentElement.scrollHeight,viewport_height:innerHeight}));
        action.before=before;action.after=after;action.observed_scroll_displacement=after.y-before.y;
        row.actions.push(action);
      }
      row.eligible=row.actions.length===2&&row.actions.every(a=>a.command_success);
    }
  }catch(error){row.errors.push({stage:'navigation-or-observation',name:error.name,message:error.message});}
  finally {
    const entries=[...requests.values()];
    row.network={request_count:entries.length,successful_request_count:entries.filter(e=>e.finished&&!e.failure&&e.status>=200&&e.status<400).length,failed_request_count:entries.filter(e=>e.failure||e.status>=400).length,pending_request_count:entries.filter(e=>!e.finished&&!e.failure).length,resource_types:entries.reduce((r,e)=>(r[e.resource_type]=(r[e.resource_type]||0)+1,r),{})};
    row.completed_utc=new Date().toISOString();await context.close();
  }
  return row;
}
async function lighthouseRun(target,skip){
  const outputPath=path.join(outputDir,'raw','lighthouse',target.id+'.json');
  if(skip){const result={success:false,skipped_reason:'no eligible read-only browser run',lcp_ms:null,cls:null,accessibility_audit_score:null};await writeFile(outputPath,JSON.stringify(result,null,2)+'\n');return result;}
  const worker=spawn(process.execPath,[path.join(here,'lighthouse-worker.mjs'),target.url,protocolPath,outputPath],{detached:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',timedOut=false;
  worker.stdout.on('data',d=>stdout+=d);worker.stderr.on('data',d=>stderr+=d);
  const timer=setTimeout(()=>{timedOut=true;try{process.kill(-worker.pid,'SIGTERM');}catch{}},protocol.lighthouse.hard_timeout_ms);
  const killer=setTimeout(()=>{try{process.kill(-worker.pid,'SIGKILL');}catch{}},protocol.lighthouse.hard_timeout_ms+5000);
  const result=await new Promise(resolve=>worker.on('close',(code,signal)=>resolve({code,signal})));clearTimeout(timer);clearTimeout(killer);
  if(timedOut||result.code!==0){const failed={success:false,lcp_ms:null,cls:null,accessibility_audit_score:null,timed_out:timedOut,worker_exit:result,stdout,stderr:stderr.slice(-6000)};await writeFile(outputPath,JSON.stringify(failed,null,2)+'\n');return failed;}
  return JSON.parse(await readFile(outputPath,'utf8'));
}
try {
  await save();
  for(const target of pages){
    const started=new Date().toISOString();const runs=[];
    for(let index=0;index<protocol.browser.runs_per_url;index++)runs.push(await browserRun(target,index));
    await writeFile(path.join(outputDir,'raw','browser',target.id+'.json'),JSON.stringify({page_id:target.id,url:target.url,started_utc:started,runs},null,2)+'\n');
    const lh=await lighthouseRun(target,!runs.some(r=>r.eligible));
    report.pages.push(summarizePage(target,runs,lh));allRuns.pages.push({pageId:target.id,url:target.url,runs});await save();
    const eligible=report.pages.filter(p=>p.eligible).length;
    console.log(JSON.stringify({finished_urls:report.pages.length,total_urls:pages.length,page_id:target.id,eligible_urls:eligible,eligible_runs:runs.filter(r=>r.eligible).length,lighthouse_success:lh.success,completed_utc:new Date().toISOString()}));
  }
  report.metadata.completed_utc=new Date().toISOString();await save();
}finally{await browser.close();}
