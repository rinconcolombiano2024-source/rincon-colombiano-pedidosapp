import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('local QR uses the pinned unmodified renderer, generates GIF data, and bounds its cache',()=>{
 // Git may check out vendor text as CRLF while npm keeps LF. Compare every
 // other character exactly: changing renderer code must still fail this test.
 const canonical=file=>readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 assert.equal(canonical('vendor/qrcode-generator-2.0.4.js'),canonical('node_modules/qrcode-generator/dist/qrcode.js'));
 const context=vm.createContext({window:{}});vm.runInContext(readFileSync('vendor/qrcode-generator-2.0.4.js','utf8'),context);vm.runInContext(readFileSync('local-qr.js','utf8'),context);
 let calls=0;const original=context.qrcode;context.qrcode=(...args)=>{calls++;return original(...args);};Object.assign(context.qrcode,original);
 const render=context.window.RC_ORDERA_QR.image,url='https://fixture.test/cliente.html?store=fixture&mesa='+encodeURIComponent('Łódź Bogotá');
 assert.match(render(url),/^data:image\/gif;base64,/);assert.equal(render(url),render(url));assert.equal(calls,1);
 assert.notEqual(render(url+'-other'),render(url));assert.equal(calls,3);
 assert.throws(()=>render('x'.repeat(2049)),/INVALID_QR_LINK/);assert.throws(()=>render(''),/INVALID_QR_LINK/);
 assert.doesNotMatch(readFileSync('app.js','utf8'),/api\.qrserver\.com/);
});
