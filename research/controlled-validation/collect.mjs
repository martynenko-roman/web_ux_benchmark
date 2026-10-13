import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const here = new URL('.', import.meta.url);
const runtimeModules = process.env.BENCHMARK_NODE_MODULES;
const require = runtimeModules ? createRequire(runtimeModules + '/package.json') : createRequire(import.meta.url);
const {chromium} = require('playwright');
const playwrightVersion = require('playwright/package.json').version;
const protocol = JSON.parse(await readFile(new URL('protocol.json',here),'utf8'));
const fixture = await readFile(new URL('fixture.html',here));
const sourceHashes = {};
for (const name of ['protocol.json','fixture.html','collect.mjs']) {
  sourceHashes[name] = createHash('sha256').update(await readFile(new URL(name,here))).digest('hex');
}
const output = {protocol, source_sha256:sourceHashes, started_utc:new Date().toISOString(),
  environment:{node:process.version, playwright:playwrightVersion, platform:os.platform(),
    arch:os.arch(), os_release:os.release(), cpu_model:os.cpus()[0].model,
    logical_cpus:os.cpus().length, total_memory_bytes:os.totalmem()}, observations:[]};
const outputPath = new URL(process.env.BENCHMARK_OUTPUT || 'observations.json',here);
const server = createServer((req,res)=>{
  if (req.url.startsWith('/fixture')) {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fixture);}
  else {res.writeHead(204);res.end();}
});
await new Promise((resolve,reject)=>{server.on('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;
let state = protocol.seed >>> 0;
function random() {state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;}
function shuffle(values) {const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
async function save() {await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');}
async function observation(condition,block,excluded=false) {
  const context=await browser.newContext({viewport:protocol.viewport,locale:protocol.locale,
    timezoneId:protocol.timezone,serviceWorkers:'block'});
  const page=await context.newPage();
  const row={condition:condition.id,mode:condition.mode,delay_ms:condition.delay_ms,block,
    excluded_warmup:excluded,started_utc:new Date().toISOString(),command_success:false,
    task_success:false,command_duration_ms:null,task_completion_duration_ms:null,
    page_response_ms:null,errors:[]};
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/fixture?mode=${condition.mode}&delay=${condition.delay_ms}`,
      {waitUntil:'load',timeout:5000});
    const failing=condition.mode.startsWith('missing');
    const timeout=failing?protocol.failure_timeout_ms:protocol.command_timeout_ms;
    if(condition.mode==='ready') await page.evaluate(()=>window.beginReadiness());
    const before=performance.now();
    try {
      await page.locator('#action').click({timeout});
      row.command_duration_ms=performance.now()-before;row.command_success=true;
    } catch(error) {row.command_failure_elapsed_ms=performance.now()-before;row.errors.push({stage:'command',name:error.name,message:error.message});}
    if(row.command_success) {
      try {
        await page.waitForFunction(()=>document.querySelector('#result').dataset.complete==='true',null,
          {timeout,polling:'raf'});
        row.task_completion_duration_ms=performance.now()-before;row.task_success=true;
      } catch(error) {row.task_failure_elapsed_ms=performance.now()-before;row.errors.push({stage:'completion',name:error.name,message:error.message});}
    }
    // Let observer callbacks arrive. This wait is outside the endpoint stopwatch.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    row.page=await page.evaluate(()=>window.observation);
    if(row.page.completed_ms!==null&&row.page.started_ms!==null)
      row.page_response_ms=row.page.completed_ms-row.page.started_ms;
  } catch(error) {row.errors.push({stage:'navigation-or-observation',name:error.name,message:error.message});}
  finally {await context.close();}
  output.observations.push(row);await save();
  console.log(JSON.stringify({condition:row.condition,block,success:row.task_success,
    command_ms:row.command_duration_ms===null?null:Math.round(row.command_duration_ms),
    response_ms:row.page_response_ms===null?null:Math.round(row.page_response_ms)}));
}
try {
  const executablePath=process.env.BENCHMARK_CHROME;
  output.environment.executable=executablePath || 'Playwright-managed Chromium';
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--disable-background-networking']});
  output.environment.browser=browser.version();
  output.environment.launch_args=['--disable-background-networking'];
  await observation(protocol.conditions[0],-1,true);
  for(let block=0;block<protocol.blocks;block++)
    for(const condition of shuffle(protocol.conditions)) await observation(condition,block);
  for(const mode of protocol.failure_controls)
    for(let block=0;block<protocol.failure_repetitions;block++) await observation({id:mode,mode,delay_ms:0},block);
  output.completed_utc=new Date().toISOString();await save();
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
