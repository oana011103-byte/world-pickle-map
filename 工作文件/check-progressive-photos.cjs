// Simulate delayed and failed image loads without a browser or network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {parseHTML}=require((process.env.PICKLE_QA_NODE_MODULES||'/tmp/pickle-unit-qa/node_modules')+'/linkedom');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0];
const data=JSON.parse(html.match(/const DATA = (.+);\n/)[1]);
const {document,window}=parseHTML('<html><body></body></html>');
const context=vm.createContext({document,HTMLImageElement:window.HTMLImageElement});
vm.runInContext(script.slice(script.indexOf('const esc ='),script.indexOf('function licenseUrl')),context);
vm.runInContext(script.slice(script.indexOf("document.addEventListener('load', async event"),script.indexOf('function referenceBlock')),context);
const render=(e,detail=false)=>{context.entry=e;document.body.innerHTML=vm.runInContext(`photoBlock(entry,'food-photo',${detail})`,context);return document.querySelector('.photo-media');};
async function run(){
for(const e of [...data.china,...data.world]){
 const media=render(e),[preview,full]=media.querySelectorAll('img');
 assert(preview.src.startsWith('data:image/webp;base64,'),'first image requires no network');
 assert(!full.classList.contains('photo-ready'),'pending full image does not cover preview');
 full.dispatchEvent(new window.Event('load',{bubbles:true}));
 assert(full.classList.contains('photo-ready'));
 const detail=render(e,true);
 assert.equal(detail.querySelector('img').src,full.src,'loaded hover photo survives detail switch');
 detail.querySelector('.photo-full').dispatchEvent(new window.Event('error',{bubbles:true}));
 assert(document.querySelector('.photo-figure').classList.contains('image-failed'));
 assert(detail.querySelector('img').src,'preview retained after full image failure');
}
assert(!html.includes('.image-failed img{display:none'));
console.log('PASS: 64 entries show embedded previews before network completion; load swaps in full photos; detail switches retain loaded images; errors retain previews. DOM simulation.');

// Download completion alone must not hide the visible preview.
const media=render(data.china[0],true),full=media.querySelector('.photo-full');
let finishDecode;full.decode=()=>new Promise(resolve=>{finishDecode=resolve;});
full.dispatchEvent(new window.Event('load',{bubbles:true}));
assert(!full.classList.contains('photo-ready'),'keep preview during decode');
finishDecode();await new Promise(setImmediate);
assert(full.classList.contains('photo-ready'),'reveal only after decode');
// The very same decoded DOM node must survive the click transition.
const original=full;context.oldPhoto=original;
render(data.china[0],true);
vm.runInContext('retainPhotoInDetail(oldPhoto,document.body)',context);
assert.equal(document.querySelector('.photo-media img'),original,'reuse node, not only URL');
assert(!original.classList.contains('photo-full'));
assert(!original.hasAttribute('data-food-photo'));
assert.equal(original.getAttribute('aria-hidden'),'true');
// Hover warming is deduplicated, decoded, and memory-bounded.
context.entry=data.world[0];vm.runInContext('warmDetailPhoto(entry)',context);
const warmed=vm.runInContext('detailPhotoCache.get(entry.id)',context);
let finishWarm;warmed.image.decode=()=>new Promise(resolve=>{finishWarm=resolve;});
warmed.image.dispatchEvent(new window.Event('load'));
assert(!warmed.ready);
finishWarm();await new Promise(setImmediate);assert(warmed.ready);
vm.runInContext('warmDetailPhoto(entry)',context);
assert.equal(vm.runInContext('detailPhotoCache.get(entry.id).image',context),warmed.image);
for(const e of data.china){context.entry=e;vm.runInContext('warmDetailPhoto(entry)',context);}
assert(vm.runInContext('detailPhotoCache.size',context)<=6);
console.log('PASS: delayed decode preserves photo; exact image node moves to detail; hover warming reuses downloads, waits for decode, and retains at most 6 images.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
