// Run: node tests/encore-embed.browser.mjs
// Requires Playwright (or CODEX_PRIMARY_RUNTIME_NODE_MODULES). Set
// ENCORE_BROWSER_EXECUTABLE when using an existing Chromium installation.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const gameStub = `<!doctype html><body><canvas></canvas><script>
parent.postMessage({type:'bcd:encore:ready',version:'test'},location.origin);
addEventListener('message',e=>{if(e.data.type==='bcd:encore:diagnostics:request')parent.postMessage({type:'bcd:encore:diagnostics:report',version:'test',report:{presentation:{},device:{},runtime:{embedded:true},room:{}}},location.origin)});
</script>`;
const server = http.createServer((request,response) => {
  const pathname = new URL(request.url,'http://localhost').pathname;
  if(pathname==='/__encore-game__/'){response.setHeader('Content-Type','text/html');response.end(gameStub);return;}
  let filename = path.join(root,pathname);
  if(fs.existsSync(filename)&&fs.statSync(filename).isDirectory())filename=path.join(filename,'index.html');
  if(!filename.startsWith(root)||!fs.existsSync(filename)){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png'})[path.extname(filename)]||'application/octet-stream');
  response.end(fs.readFileSync(filename));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
 browser = await chromium.launch({headless:true,...(process.env.ENCORE_BROWSER_EXECUTABLE?{executablePath:process.env.ENCORE_BROWSER_EXECUTABLE}:{})});
 for(const language of ['en','es']) {
  const context=await browser.newContext({viewport:{width:428,height:926},deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({contentType:'application/json',body:'[]'}));
  await page.addInitScript(()=>{window.ENCORE_ROYALE_URL='/__encore-game__/?embed=1'});
  await page.goto(`${base}/?encore-dev=1`);
  await page.evaluate(language=>{
   sharedFetch=async()=>[];
   const state=getBcdState();state.users.push({id:'test',name:'Tester',username:'tester',language});state.currentUserId='test';
   enterSite();visibleLimit=4196;renderSongs();scrollTo(0,20000);
  },language);
  const scrollBefore=await page.evaluate(()=>scrollY);
  await page.evaluate(()=>openEncoreRoyale());
  await page.locator('.encore-portal.is-playing').waitFor();
  assert.deepEqual(await page.evaluate(()=>({shell:getComputedStyle(document.querySelector('body>.shell')).display,clip:getComputedStyle(document.querySelector('.encore-portal')).clipPath,curtain:getComputedStyle(document.querySelector('.encore-curtain')).display})),{shell:'none',clip:'none',curtain:'none'});
  await page.locator('.encore-diagnostics-button').click();
  await page.waitForFunction(()=>document.querySelector('.encore-diagnostics-output').textContent.includes('Host   '));
  // Diagnostics updates must not repeatedly translate every song in the shell.
  const mutations=await page.evaluate(async()=>{
   let count=0;const observer=new MutationObserver(records=>count+=records.length);
   observer.observe(document.querySelector('.shell'),{childList:true,subtree:true,characterData:true});
   await new Promise(resolve=>setTimeout(resolve,1200));observer.disconnect();return count;
  });
  assert.equal(mutations,0);
  await page.evaluate(()=>closeEncoreRoyale());
  assert.notEqual(await page.locator('.shell').evaluate(node=>getComputedStyle(node).display),'none');
  assert.equal(await page.evaluate(()=>scrollY),scrollBefore);
  await page.waitForFunction(()=>!document.querySelector('.encore-portal'));
  assert.equal(page.frames().length,1);
  assert.deepEqual(errors,[]);
  console.log(`${language}: entrance cleanup, quiet hidden songbook, diagnostics, scroll restoration and iframe teardown passed`);
  await context.close();
 }
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
