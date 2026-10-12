import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync('cliente.js', 'utf8');
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }

for (const kind of ['Status', 'Chat']) {
  function harness() {
    let next = 0, calls = 0, fail = true;
    const timers = new Map();
    const c = vm.createContext({
      customerTrackedOrder: {id:'order',publicToken:'token',status:'pending'}, customerClient:{},
      document:{visibilityState:'visible'}, window:{navigator:{onLine:true},
        setTimeout(fn, delay) { const id=++next; timers.set(id,{fn,delay}); return id; },
        clearTimeout(id) { timers.delete(id); }},
      CUSTOMER_TERMINAL_ORDER_STATUSES:new Set(['delivered','cancelled']),
      CUSTOMER_STATUS_POLL_MIN_MS:15000, CUSTOMER_STATUS_POLL_MAX_MS:120000,
      CUSTOMER_CHAT_POLL_MIN_MS:15000, CUSTOMER_CHAT_POLL_MAX_MS:120000,
      customerStatusTimer:null, customerChatTimer:null,
      customerStatusPollSignature:'',customerChatPollSignature:'',customerChatGeneration:1,
      customerStatusPollingDelay:15000,customerChatPollingDelay:15000,
      customerTrackingRealtimeStatus:'idle',
      customerPollOrderStatus: async()=>{calls++;if(fail)throw new Error('network');return true;},
      customerLoadChatMessages: async()=>{calls++;if(fail)throw new Error('network');return true;},
    });
    vm.runInContext(section(`function customerStop${kind}Polling(`,
      kind==='Status'?'function customerStartStatusTracking(':'function customerStartChat('),c);
    return {c,timers,calls:()=>calls,recover:()=>{fail=false;}, async fire() {
      const [id,timer]=timers.entries().next().value; timers.delete(id); await timer.fn();
    }};
  }
  test(`${kind}: rejected reads keep one bounded retry and recover`,async()=>{
    const h=harness();h.c[`customerSchedule${kind}Poll`](0);
    for (const delay of [30000,60000,120000,120000]) {
      await h.fire();assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].delay,delay);
    }
    assert.equal(h.calls(),4);h.recover();await h.fire();
    assert.equal(h.calls(),5);assert.equal([...h.timers.values()][0].delay,15000);
  });
  for (const transition of ['hidden','offline','terminal','new-order']) {
    test(`${kind}: failed old read cannot restart after ${transition}`,async()=>{
      const h=harness();h.c[`customerSchedule${kind}Poll`](0);
      h.c[kind==='Status'?'customerPollOrderStatus':'customerLoadChatMessages']=async()=>{
        if(transition==='hidden')h.c.document.visibilityState='hidden';
        if(transition==='offline')h.c.window.navigator.onLine=false;
        if(transition==='terminal')h.c.customerTrackedOrder.status='delivered';
        if(transition==='new-order')h.c.customerTrackedOrder={id:'other',publicToken:'other'};
        throw new Error('network');
      };
      await h.fire();assert.equal(h.timers.size,0);
    });
  }
}

function courier(row) {
  const panel={hidden:true,innerHTML:''};
  const c=vm.createContext({customerElements:{courierTracking:panel},customerLanguage:'en',
    customerT:(key,values)=>`${key} ${JSON.stringify(values||{})}`,
    customerEscapeHtml:value=>String(value).replaceAll('<','&lt;')});
  vm.runInContext(section('function customerTrackingRelativeTime(', 'function customerStopOrderTrackingRealtime('),c);
  c.customerRenderCourierTracking({assignment_id:'assigned',...row});return panel;
}
test('missing courier data never invents a map, epoch ETA or decades-old location',()=>{
  const panel=courier({courier_lat:null,courier_lng:null});
  assert.equal(panel.hidden,false);assert.doesNotMatch(panel.innerHTML,/google.com|courierTrackingEta|courierTrackingLocation/);
  assert.match(panel.innerHTML,/courierTrackingWaiting/);
});
test('blank and malformed coordinates do not become zero coordinates',()=>{
  for(const value of ['', ' ', false, [], {}, 'invalid', 181]) {
    assert.doesNotMatch(courier({courier_lat:value,courier_lng:value}).innerHTML,/google.com/);
  }
});
test('legitimate zero and numeric-string coordinates remain available',()=>{
  for(const value of [0,'0','52.23'])assert.match(courier({courier_lat:value,courier_lng:21}).innerHTML,/google.com/);
});
test('valid courier timestamps and escaped names render normally',()=>{
  const panel=courier({courier_name:'<script>',courier_lat:52.23,courier_lng:21,
    courier_location_updated_at:new Date().toISOString(),estimated_delivery_at:new Date().toISOString()});
  assert.match(panel.innerHTML,/courierTrackingEta/);assert.match(panel.innerHTML,/courierTrackingLocation/);
  assert.doesNotMatch(panel.innerHTML,/<script>/);
});
