'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = p => readFileSync(join(__dirname,'..',p),'utf8');
const families = new Map([
  ['manifest','restaurante.html'],
  ['restaurante-manifest','restaurante.html'],
  ['cliente-manifest','cliente.html'],
  ['mesero-manifest','mesero.html'],
  ['colaborador-manifest','colaborador.html'],
  ['admin-manifest','admin.html'],
  ['portal-manifest','index.html']
]);
const base='https://example.test/';
const pages=['index.html','restaurante.html','cliente.html','mesero.html','colaborador.html','admin.html','portal.html'];
for (const [family, ownPage] of families) {
  for (const lang of ['es','pl','en']) {
    const filename=family+(lang==='es'?'':'.'+lang)+'.webmanifest';
    test(filename+' cannot capture another module',()=>{
      const original=read(filename),published=read('www/'+filename);
      assert.equal(published,original,'production mirror must match root');
      const m=JSON.parse(original);
      assert.equal(m.display,'standalone');
      assert.equal(new URL(m.scope,base).href,new URL(ownPage,base).href,'PWA scope must be exact');
      assert.ok(new URL(m.start_url,base).href.startsWith(new URL(m.scope,base).href),
        'installed PWA must start inside its scope');
      assert.ok(m.id && m.name, 'identity and name must be preserved');
      for (const other of pages) {
        if(other===ownPage)continue;
        assert.equal(new URL(other,base).href.startsWith(new URL(m.scope,base).href),false,
          filename+' must not capture '+other);
      }
    });
  }
}
test('restaurant native links stay in separate tabs',()=>{
  for(const prefix of ['','www/']){
    const html=read(prefix+'restaurante.html');
    for (const id of ['openClientPageButton','openWaiterLinkButton','restaurantKitchenLink']) {
      assert.match(html,new RegExp('id="'+id+'"[^>]*target="_blank"[^>]*rel="noopener noreferrer"'));
    }
    assert.match(html,/id="openFiscalPrinterTopButton"/);
  }
});
