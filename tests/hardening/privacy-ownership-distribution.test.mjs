import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const web = readFileSync('privacy.html', 'utf8');
const android = readFileSync('www/privacy.html', 'utf8');

test('privacy notice is identical in web and packaged Android distributions', () => {
  assert.equal(android, web);
});

test('RC ORDERA identifies its individual owner and contact without assigning ownership to restaurant company', () => {
  assert.match(web, /Jhon Jarolt Mendez/);
  assert.match(web, /jarol\.mendez@gmail\.com/);
  assert.match(web, /persona física residente en Polonia/);
  assert.match(web, /no se presenta en esta página como sociedad registrada/);
  assert.match(web, /actualmente su titular declara que no cobra/);
});

test('privacy notice does not claim unverified compliance or consent infrastructure', () => {
  assert.match(web, /No se declara aquí que exista un sistema de consentimiento/);
  assert.match(web, /No se afirma una certificación RGPD o PCI DSS/);
  assert.match(web, /Información pendiente antes del lanzamiento/);
});

test('privacy notice describes rights, cookies, transfers and contact channel', () => {
  for (const heading of ['Conservación y derechos', 'Cookies y almacenamiento local', 'Seguridad y transferencias']) {
    assert.ok(web.includes(heading), 'missing privacy section: ' + heading);
  }
  assert.match(web, /mailto:jarol\.mendez@gmail\.com/);
});
