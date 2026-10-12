import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../../package.json',import.meta.url));
const lighthouse=(await import(require.resolve('lighthouse'))).default;
const {launch}=await import(require.resolve('chrome-launcher'));
const [url,protocolPath,outputPath]=process.argv.slice(2);
const protocol=JSON.parse(await readFile(protocolPath,'utf8'));
let chrome;
const result={started_utc:new Date().toISOString(),success:false,url,lcp_ms:null,cls:null,accessibility_audit_score:null};
try {
  chrome=await launch({chromePath:protocol.browser.executable,chromeFlags:protocol.browser.launch_args});
  const response=await lighthouse(url,{port:chrome.port,logLevel:'error',output:'json'},
    {extends:'lighthouse:default',settings:protocol.lighthouse.settings});
  if(!response)throw new Error('Lighthouse returned no result');
  const lhr=response.lhr;
  result.runtime_error=lhr.runtimeError||null;
  result.effective_settings=lhr.configSettings;
  result.fetch_time=lhr.fetchTime;
  result.final_url=lhr.finalDisplayedUrl||lhr.finalUrl;
  result.user_agent=lhr.userAgent;
  result.lighthouse_version=lhr.lighthouseVersion;
  result.environment=lhr.environment;
  result.run_warnings=lhr.runWarnings;
  result.audits={};
  for(const [id,audit] of Object.entries(lhr.audits)) {
    result.audits[id]={title:audit.title,score:audit.score,score_display_mode:audit.scoreDisplayMode,numeric_value:audit.numericValue,numeric_unit:audit.numericUnit,error_message:audit.errorMessage};
  }
  result.accessibility_audit_references=lhr.categories.accessibility?.auditRefs||[];
  if(!lhr.runtimeError) {
    result.lcp_ms=lhr.audits['largest-contentful-paint']?.numericValue??null;
    result.cls=lhr.audits['cumulative-layout-shift']?.numericValue??null;
    result.accessibility_audit_score=lhr.categories.accessibility?.score!=null?100*lhr.categories.accessibility.score:null;
    result.success=[result.lcp_ms,result.cls,result.accessibility_audit_score].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
  }
} catch(error) {result.error={name:error.name,message:error.message};}
finally {if(chrome)await chrome.kill();result.completed_utc=new Date().toISOString();await writeFile(outputPath,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({success:result.success,lcp_ms:result.lcp_ms,error:result.error||result.runtime_error||null}));
