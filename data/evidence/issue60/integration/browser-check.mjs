import {chromium} from '../../../../web/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)).replace(/\/$/,'');
const ids=JSON.parse(fs.readFileSync(`${root}/data/evidence/issue60/human-answers-20261106/round2/adoption-review.json`)).approvedIds;
const origin='http://127.0.0.1:4181';
const manifest=await(await fetch(origin+'/data/manifest.json')).json();
for(const [name,hash] of Object.entries(manifest.files)) {const bytes=Buffer.from(await(await fetch(origin+'/data/'+name)).arrayBuffer()); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash);}
const full=await(await fetch(origin+'/data/full.json')).json();
const details=await(await fetch(origin+'/data/details.json')).json();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
let count=0;
try {for(const mode of ['full','split']) {
const context=await browser.newContext(); const page=await context.newPage();
await page.goto(`${origin}/?data=${mode}`); await page.locator('#cards').waitFor();
await page.waitForFunction(()=>!document.querySelector('#cards').disabled);
for(const id of ids) {
const p=full.places.find(p=>p.id===id); assert.equal(p.coordinate.status,'confirmed');
assert.deepEqual(details.places.find(p=>p.id===id).coordinate,p.coordinate);
assert(full.pins.some(p=>p.id===id&&p.kind==='place'&&!p.reference));
const rel=full.relations.find(r=>r.placeId===id); assert(rel);
await page.locator('#cards').selectOption(rel.cardId);
const facility=page.locator('.facility').filter({has:page.getByRole('heading',{name:p.name,exact:true})}).first();
await facility.waitFor();
const urls=await facility.locator('a').evaluateAll(nodes=>nodes.map(n=>n.href));
assert(urls.some(u=>new URL(u).searchParams.get('query')===`${p.coordinate.lat},${p.coordinate.lng}`),`${mode} ${id} Maps query`);
assert(urls.includes(rel.evidence.sourceUrl),`${mode} ${id} distribution source`);
assert((await facility.textContent()).includes(rel.evidence.checkedAt));
assert.deepEqual(details.places.find(p=>p.id===id).evidence,p.evidence);
count++; const close=page.getByRole('button',{name:'閉じる',exact:true}); if(await close.count()) await close.click();
}
await context.close(); console.log(mode,ids.length,'passed');
}} finally {await browser.close();}
fs.writeFileSync(`${root}/data/evidence/issue60/integration/browser-result.json`,JSON.stringify({newlyCheckedIds:ids,fullSplitDetailMapsChecks:count,distributionSourceChecks:count,positionEvidenceCheckedInJSON:true,positionEvidenceRenderedByExistingUI:false,externalMapsNavigation:false,generationHashes:manifest.files},null,2)+'\n');
