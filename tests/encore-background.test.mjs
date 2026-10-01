import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const definition = name => html.split('\n').filter(line => new RegExp(`^(async )?function ${name}\\(`).test(line)).at(-1);

test('Encore pauses karaoke render and request/chat polling before doing work', async () => {
  const context = vm.createContext({ document:{body:{classList:{contains:()=>true}}}, chatSyncing:false });
  for (const name of ['renderActive','syncSharedBoard','syncChat']) {
    vm.runInContext(definition(name), context);
    await vm.runInContext(`${name}()`, context);
  }
  // No state, rendering, or network globals were needed, and chat can resume.
  assert.equal(context.chatSyncing, false);
});

test('translation preserves text nodes and does not rewrite unchanged translations', () => {
  let writes = 0;
  const node = { parentElement:{closest:()=>false}, value:' Request ', get nodeValue(){return this.value}, set nodeValue(value){writes++;this.value=value} };
  const context = vm.createContext({
    document:{body:{classList:{contains:()=>false}},createTreeWalker:()=>{let first=true;return {nextNode:()=>first?(first=false,node):null}},querySelectorAll:()=>[]},
    NodeFilter:{SHOW_TEXT:4},currentUser:()=>({language:'es'}),GLOBAL_UI_TRANSLATIONS:{es:{Request:'Solicitar'}}
  });
  vm.runInContext(definition('translateEverything'), context);
  vm.runInContext('translateEverything();translateEverything()', context);
  assert.equal(node.nodeValue, ' Solicitar ');
  assert.equal(writes, 1);
});

test('translation skips a hidden karaoke DOM while Encore is active', () => {
  vm.runInNewContext(`${definition('translateEverything')};translateEverything()`, {document:{body:{classList:{contains:()=>true}}}});
});
