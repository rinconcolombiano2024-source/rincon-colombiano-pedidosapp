import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';

test('Vercel serves only the reviewed frontend distribution, never the repository root',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  assert.equal(config.outputDirectory,'www');
  assert.equal(config.framework,null);
  assert.equal(config.buildCommand,'');
  assert.equal(config.installCommand,'');
  const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
  for(const file of walk(config.outputDirectory)) {
    assert.match(file,/\.(?:html|js|mjs|css|webmanifest|svg|png|txt|json)$/);
    if(file.endsWith('.mjs'))assert.equal(file,'www/inventory/preview.mjs','deny unknown ESM assets: '+file);
    if(file.endsWith('.txt'))assert.match(file,/vendor\/(?:QRCODE|SUPABASE)-LICENSE\.txt$/);
    if(file.endsWith('.json'))assert.ok(['www/BUILD-METADATA.json','www/rc-ordera-release.json'].includes(file), 'deny unknown JSON assets: '+file);
    assert.doesNotMatch(file,/(?:^|\/)(?:supabase|tests|scripts|docs|accounting|fiscal-agent|delivery-bridge|\.env)(?:\/|$)/);
  }
  for(const file of ['index.html','cliente.html','restaurante.html','colaborador.html','mesero.html','admin.html','service-worker.js','supabase-config.js','vendor/supabase-2.57.4.js','vendor/qrcode-generator-2.0.4.js']) {
    assert.ok(existsSync(join(config.outputDirectory,file)),file);
    assert.deepEqual(readFileSync(join(config.outputDirectory,file)),readFileSync(file));
  }
  for(const file of ['supabase-schema.sql','GUIA-ACCESO-ADMIN-V70.txt','supabase/config.toml','package.json','.env']) {
    assert.equal(existsSync(join(config.outputDirectory,file)),false,file);
  }
});
