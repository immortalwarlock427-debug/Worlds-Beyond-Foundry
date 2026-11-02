import { test } from "node:test";
import assert from "node:assert/strict";
import { commandAlly, receiveCommand, commandCandidates, decorateCommand } from "../module/command.mjs";
function fixture() {
  const actors = new Map(), posts = [], warnings = [], infos = [], errors = [];
  const actor = (id, mod = 0) => {
    const doc = { uuid: `Actor.${id}`, name: id, type: "character", visible: true, isOwner: true, flags: {},
      system: { ap: { value: 10 }, command: { value: 0, fresh: false }, stats: { cha: { mod } } },
      getFlag: (scope, key) => doc.flags[scope]?.[key],
      async update(data) { for (const [path, value] of Object.entries(data)) { const parts = path.split('.'), last = parts.pop(); const parent = parts.reduce((entry, key) => entry[key] ??= {}, doc); parent[last] = value; } return doc; }
    }; actors.set(doc.uuid, doc); return doc;
  };
  const sender = actor('leader', 2), ally = actor('ally');
  const ChatMessage = { getSpeaker: () => ({}), async create(data, options) { const message = { ...data, id: `m${posts.length}`, uuid: `ChatMessage.m${posts.length}`, getFlag: (scope, key) => data.flags[scope]?.[key] }; posts.push({ message, options }); return message; } };
  globalThis.game = { actors: Array.from(actors.values()), combats: [], settings: { get: () => 'gm' } };
  globalThis.foundry = { documents: { ChatMessage: { implementation: ChatMessage } }, utils: { fromUuid: async uuid => actors.get(uuid), fromUuidSync: uuid => actors.get(uuid) } };
  globalThis.ui = { notifications: { warn: message => warnings.push(message), info: message => infos.push(message), error: message => errors.push(message) } };
  return { sender, ally, actor, actors, posts, ChatMessage, warnings, infos, errors };
}
test("Command spends a fixed 5 own AP, applies the highest grant once and keeps the selected chat mode", async () => {
  const f = fixture(); f.sender.system.command.value = 5;
  const message = await commandAlly(f.sender, f.ally);
  assert.equal(f.sender.system.ap.value, 5); assert.equal(f.sender.system.command.value, 5);
  assert.equal(f.ally.system.command.value, 4); assert.equal(f.ally.system.command.fresh, true);
  assert.deepEqual(f.posts[0].options, { messageMode: 'gm' });
  f.ally.system.command.value = 1; await receiveCommand(message); assert.equal(f.ally.system.command.value, 1);
  f.sender.system.stats.cha.mod = 0;
  f.ally.system.command.value = 4; await commandAlly(f.sender, f.ally); assert.equal(f.ally.system.command.value, 4);
});
test("cross-owner Command stays claimable; recipient permission and receipt make retries safe", async () => {
  const f = fixture(); f.ally.isOwner = false;
  const message = await commandAlly(f.sender, f.ally); assert.equal(f.sender.system.ap.value, 5); assert.equal(f.ally.system.command.value, 0);
  await receiveCommand(message); assert.equal(f.ally.system.command.value, 0);
  f.ally.isOwner = true;
  const update = f.ally.update; f.ally.update = async () => undefined;
  await assert.rejects(receiveCommand(message), /cancelled/);
  f.ally.update = update;
  await Promise.all([receiveCommand(message), receiveCommand(message)]);
  assert.equal(f.ally.system.command.value, 4); assert.equal(f.ally.getFlag('worlds-beyond', 'commandClaims').length, 1);
});
test("failed Command post refunds the commander; insufficient own AP, self-targets and deleted allies cannot spend", async () => {
  const f = fixture(); f.ChatMessage.create = async () => { throw new Error('offline'); };
  await assert.rejects(commandAlly(f.sender, f.ally), /offline/); assert.equal(f.sender.system.ap.value, 10); assert.equal(f.ally.system.command.value, 0);
  f.sender.system.ap.value = 4; f.sender.system.command.value = 5;
  await assert.rejects(commandAlly(f.sender, f.ally), /Not enough AP/); assert.equal(f.sender.system.ap.value, 4);
  assert.equal(await commandAlly(f.sender, f.sender), undefined);
  f.actors.delete(f.ally.uuid); await assert.rejects(commandAlly(f.sender, f.ally), /no longer exists/);
});
test("Command candidates retain exact synthetic combat actors and exclude the commander", () => {
  const f = fixture(), token = f.actor('scene-token'); game.combats = [{ combatants: [{ actor: token }] }];
  assert.deepEqual(commandCandidates(f.sender).map(actor => actor.uuid), [token.uuid, f.ally.uuid]);
});

test("owned Command delivers outside combat directly and reports the increased total without raising the normal cap", async () => {
  const f = fixture(); f.ally.system.ap.max = 10;
  const create = f.ChatMessage.create;
  f.ChatMessage.create = async (...args) => { const message = await create(...args); message.getFlag = () => undefined; return message; };
  await commandAlly(f.sender, f.ally);
  assert.equal(f.ally.system.command.value, 4); assert.equal(f.ally.system.ap.value, 10); assert.equal(f.ally.system.ap.max, 10);
  assert.match(f.infos[0], /14 AP total, including 4 Command AP/);
});

test("receiving serialized numeric offers works, while invalid or unretained grants produce errors instead of silent success", async () => {
  const f = fixture();
  const offer = { uuid: 'ChatMessage.older', getFlag: () => ({ targetUuid: f.ally.uuid, amount: '2' }) };
  await receiveCommand(offer); assert.equal(f.ally.system.command.value, 2);
  await assert.rejects(receiveCommand({ ...offer, getFlag: () => ({ targetUuid: f.ally.uuid, amount: 'bad' }) }), /invalid Command amount/);
  await assert.rejects(receiveCommand({ ...offer, getFlag: () => undefined }), /no Command offer/);
  f.ally.update = async () => f.ally;
  await assert.rejects(receiveCommand({ ...offer, uuid: 'ChatMessage.new' }), /not retained/);
});

test("Command receive controls refresh after actual receipt and stay retryable on invalid offers", async () => {
  const f = fixture(); f.ally.isOwner = false; const message = await commandAlly(f.sender, f.ally); f.ally.isOwner = true;
  const buttons = []; globalThis.document = { createElement: () => ({ addEventListener(name, handler) { this[name] = handler; } }) };
  const content = { querySelector: () => null, append: button => buttons.push(button) };
  const html = { querySelector: () => content }; message.isContentVisible = true;
  decorateCommand(message, html); assert.equal(buttons[0].textContent, 'Receive Command AP');
  await receiveCommand(message); assert.equal(buttons[0].textContent, 'Command received'); assert.equal(buttons[0].disabled, true);
  const invalid = { ...message, uuid: 'ChatMessage.invalid', getFlag: () => ({ targetUuid: f.ally.uuid, amount: 'invalid' }) };
  decorateCommand(invalid, html); await buttons[1].click();
  assert.equal(buttons[1].disabled, false); assert.equal(buttons[1].textContent, 'Receive Command AP'); assert.match(f.errors[0], /invalid Command amount/);
});
