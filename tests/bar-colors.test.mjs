import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBarColor, barColorContext, barColorFormUpdates } from "../module/bar-colors.mjs";

test("hex colors accept short/long forms with optional hash and reject non-color CSS", () => {
  for (const value of [null, undefined, '', ' ']) assert.equal(normalizeBarColor(value), '');
  assert.equal(normalizeBarColor(' abc '), '#AABBCC');
  assert.equal(normalizeBarColor('#6fd6ff'), '#6FD6FF');
  for (const value of ['red', '#1234', '#12345678', 'url(example)', '#000;display:none', 'linear-gradient(red,blue)']) assert.throws(() => normalizeBarColor(value), /hex color/);
});

test("bar fill selects default, either single color, or a two-color gradient without changing pool data", () => {
  assert.equal(barColorContext().barStyle, '');
  assert.equal(barColorContext({barColors:{start:'#abc'}}).barStyle, 'background:#AABBCC;');
  assert.equal(barColorContext({barColors:{end:'123456'}}).barStyle, 'background:#123456;');
  const pool = {value:120.4,max:100,min:-20,spent:-20.4,barColors:{start:'#112233',end:'#aa55ff'}};
  const before = structuredClone(pool);
  assert.equal(barColorContext(pool).barStyle, 'background:linear-gradient(90deg, #112233, #AA55FF);');
  assert.deepEqual(pool,before);
  assert.equal(barColorContext({barColors:{start:'#fff;position:fixed',end:'not a color'}}).barStyle,'');
});

test("color-only form edits preserve exact expenditure/current values, other settings and source data", () => {
  const id='resource00000001',system={health:{damage:12.5,barColors:{start:'',end:''}},ap:{value:9.5,barColors:{start:'#112233',end:''}},mana:{spent:7.5},customResources:{[id]:{spent:-20.4,barColors:{start:'#AABBCC',end:'#FFFFFF'}}}};
  const source=structuredClone(system),data={system:{health:{barColors:{start:'b85',end:''}},ap:{barColors:{start:'#112233',end:'#ccc'}},mana:{barColors:{start:'',end:''}},customResources:{[id]:{barColors:{start:'#AABBCC',end:''}}}}};
  assert.equal(barColorFormUpdates(system,data),data);
  assert.deepEqual(data,{system:{health:{barColors:{start:'#BB8855'}},ap:{barColors:{end:'#CCCCCC'}},mana:{},customResources:{[id]:{barColors:{end:''}}}}});
  assert.deepEqual(system,source);
  assert.deepEqual(barColorFormUpdates(system,{system:{ap:{value:8.75}}}),{system:{ap:{value:8.75}}});
});

test("invalid color submissions fail instead of saving malformed style data", () => {
  assert.throws(()=>barColorFormUpdates({mana:{}},{system:{mana:{barColors:{start:'url(bad)'}}}}),/hex color/);
});
