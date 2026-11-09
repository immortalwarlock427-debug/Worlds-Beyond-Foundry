# Existing combat support

The sheet already supports weapon attack cards, damage previews, Block/Dodge/Parry, Command, reload, potion AP and turn refills. Command spends 5 own AP and offers 2 + CHA modifier (maximum 5); the recipient's AP total includes the grant. Sidebar actors and unlinked token copies are distinct recipients.

Attacks, abilities and areas resolve automatically (below), token movement spends AP in combat, and leaving an enemy's reach offers an opportunity attack. Further milestone automation and modules are still to come. See [roadmap](ROADMAP.md).

The sections below preserve rules sources and historical implementation checks. The shared [desktop audit](CHARACTER-SHEET-AUDIT.md) smoke-tests existing integration without starting the next combat phase.


## Contents

- [Automatic attack resolution](#resolution)
- [Ability areas, multiple targets and map effects](#areas)
- [Status conditions, Bleeding and Burning](#conditions)
- [Death and dying](#dying)
- [Movement AP](#movement)
- [Opportunity attacks](#opportunity)
- [Sides, collision and attack range](#positioning)
- [Weapon attacks and damage](#attacks)
- [Block reaction](#block)
- [Dodge reaction](#dodge)
- [Parry reaction](#parry)
- [Defend from weapon attack cards](#linked-defenses)
- [Token attacks and hand equipment](#token-attacks)
- [Command recipients and AP](#command-delivery)
- [Start-of-turn resources](#turn-refills)
- [Review of the inventory, catalog and attack additions](#action-review)


<a id="resolution"></a>
## Automatic attack resolution

Requested by the user on 2026-11-06. Follows Notion Defenses → Order of a Hit.

### Flow

1. With your character's token selected, Alt-click the target. Choose a weapon in hand or an ability whose **Targeting** is set, then the dice (normal, advantage, disadvantage). Weapon attacks keep their existing dialog and AP cost; abilities pay their costs through Use.
2. A hit (or a save ability) opens a popup for whoever answers for the target: the player assigned to that character, another owning player, or the GM. Weapon and attack-roll hits offer **Dodge**, **Parry** (DEX 21, armed, unused this round) and **Let it hit**. Save abilities offer the ability's save, or a save with the defender's choice of stat. A failed Dodge reopens the popup with what's left.
3. The GM's client rolls damage, applies a half-damage save, Resistance and Armor Rating, then asks the defender whether to **Block** what gets through.
4. Block is subtracted, Overwhelming Force raises the result back to half the rolled damage (weapons only, never through a Dodge), and the target's Health drops. A result card reports the outcome; the GM can **Undo** or **Apply** it from that card.

After a failed Dodge, Parry or save, the popup offers **Wonder** while uses remain: a reroll, or at FTH 21 **Defy Fate** to succeed. Each new result may use Wonder again; this reuses the sheet's Wonder action and its once-per-result rule.

Options with nothing to choose (no reactions in combat, no damage past Armor Rating) are skipped. Outside combat reactions aren't spent, so every defense stays available. The attack card shows who is being waited on; its owner can reopen the popup with **Respond**, and the GM can **Let it hit**, **Skip Block** or **Resolve by hand**, which brings back the manual damage and defense buttons.

### Immunity

Record immunities with **Resistances & immunities → Edit** on the Details tab (the same editor as resistances). A hit of a type the target is immune to deals no damage, Overwhelming Force included (Notion Defenses). A weapon hit on an immune target skips the defense popup and posts "X is immune to Y". Ability hits still ask, since the ability may do more than damage; the result card then shows the rolled damage and "immune".

### Healing

Set an ability's **Targeting** to **Heal the target**. **Healing** takes a formula like Damage (`2d8 + fth`) and the Area settings work the same way, so a circle can heal everyone ticked inside it. Using it pays the ability's costs, rolls once and posts a card. The active GM's client heals every target by that amount, up to full Health and up from below 0. The card then lists who healed how much. The GM gets **Undo healing** (puts the amount back on top of any damage taken since) and **Apply healing**. With **Automatic attack resolution** or **Apply damage automatically** off, the card waits for the GM's **Apply healing**. Healing doesn't end statuses yet; conditions are roadmap step 5.

### Settings and opt-outs

- **Automatic attack resolution** (world setting, on): off restores the manual attack card buttons.
- **Apply damage automatically** (world setting, on): off leaves Health alone and puts an **Apply** button on the result card.
- Automation needs a connected GM, because only the GM's client can change every combatant's Health. Without one, attacks use the manual buttons.

### Ability targeting

The ability editor's **Targeting** section sets: attack roll vs Natural Evasion or a target save; the stat used (blank uses the AP discount stat); the save stat or the target's choice; the DC (blank is 12 + the stat's modifier, per Notion Stats); no damage or half damage on a successful save; a damage formula where a stat's short or full name adds its modifier (`2d8 + str`, `1d10 + Intelligence`) and `mod` means the chosen stat; and a damage type. Ability attacks crit on a natural 20 and add the dice maximum, like weapons.

### Rule choices to confirm

- Weapon attacks don't offer a stat save. Notion defends against them with Natural Evasion and reactions; a free save would make Dodge pointless.
- Resistance to a multi-type weapon (Mace: Bludgeoning, Piercing) needs every listed type resisted.
- Immunity to a multi-type weapon needs every listed type, like Resistance.
- Areas, multiple targets and map effects are roadmap step 4.

### Code

`module/strike-core.mjs` holds the rules (tested in `tests/strike-core.test.mjs`). `module/strike.mjs` runs exchanges on the active GM's client, stores progress on the attack card's `flags.worlds-beyond.strike`, and talks to the defender's client over the system socket (tested in `tests/strike.test.mjs`). `module/ability-strikes.mjs` uses a targeted ability; `module/strike-settings.mjs` registers the two settings.

<a id="conditions"></a>
## Status conditions, Bleeding and Burning

Roadmap step 5, first part (2026-11-09). Follows Notion Status Effects Explained and Vitality (Shake It Off).

- **Token HUD:** Notion's 16 statuses use Notion's names and rules (the HUD sorts every status alphabetically): Bleeding, Blinded, Burning, Charmed, Deafened, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned and Unconscious. They reuse Foundry's ids where Foundry has the status (`fear` is Frightened, `restrain` Restrained, `stun` Stunned, `paralysis` Paralyzed), so statuses already on tokens carry over. Foundry's other statuses (Dead, Degenerating and the rest) stay available.
- **Status tab:** a status shows its Notion rule. **End** removes it, like clicking it off in the token HUD.
- **Bleeding and Burning at the start of the turn:** when a creature's turn starts, the active GM's client rolls 1d4 (Bleeding) or 1d6 fire (Burning), plus a die at each of levels 5, 10, 15 and 20 of the creature that caused it. Armor Rating doesn't reduce it. Burning counts as Fire, so Fire resistance halves it and Fire immunity stops it. Health drops and a card shows the roll; the GM can **Undo** it from the card.
- **Source level:** a Bleed weapon records its wielder's level. A status added from the token HUD has no source, so it uses the creature's own level and the card says so.
- **Bleed signature:** with automatic resolution, a weapon with Bleed starts Bleeding when its hit deals damage. A fully blocked hit doesn't cut in, so it doesn't. Bleeding doesn't stack.
- **Ending them:** any healing ends Bleeding (healing abilities, potions, rests, raising Health by hand). **Shake it off** (Status tab or the tick card) rolls d20 + VIT modifier against DC 12 and costs 5 AP lowered by VIT in combat. **Put out** ends Burning for 5 AP in combat. Entering water ends Burning too; remove it by hand.
- **Opt-out:** world setting **Automate Bleeding and Burning** (on). Off: no turn-start damage, Bleed weapons don't start Bleeding and healing doesn't end it.
- Undoing a damage result or a tick doesn't count as healing.

Not automated yet: the other statuses' advantage, disadvantage and movement effects, Unconscious at 0 Health, Bleeding Out, Death's Mercy, Trauma and exhaustion. Code: `module/conditions-core.mjs` (tests in `tests/conditions-core.test.mjs`) and `module/conditions.mjs`.

<a id="dying"></a>
## Death and dying

Roadmap step 5, second part (2026-11-09). Follows Notion Death and Dying.

- **Death Threshold:** level + current VIT, 5 lower for each Trauma. A character dies at the negative of it (level 5, VIT 21: dies at −26). With a threshold of 0 or less, any Health below 0 kills. Details → **Death & dying** shows it, with **Trauma** and **Stabilized** fields to correct.
- **Death's Mercy:** a hit that takes a character from 0 or above into the negative can't take them further below 0 than half their Death Threshold. Once below 0, damage hits in full. It applies to damage the system deals (attack results, Apply, Bleeding/Burning and Bleeding Out ticks). Health typed on the sheet stays as typed. The attack result card says when Mercy stopped part of a hit.
- **Unconscious:** at 0 Health or below the character gets the Unconscious status. It comes off when Health rises to 1 or more.
- **Bleeding Out:** at the start of their turn, a character at 0 or below who isn't stabilized loses 4 Health, with no Armor Rating or resistance. A card shows it with **Stabilize** and the GM's **Undo**.
- **Stabilize:** another creature spends 5 AP in combat and rolls d20 + its INT modifier against DC 12. Select that creature's token, then press **Stabilize** on the card or on the dying character's Overview. On a success they stop bleeding out and stay unconscious until healed. The GM's client applies it when a player stabilizes someone else's character. Indomitable's **Stabilize** roll (VIT 21) stabilizes yourself on a success.
- **Treat:** out of combat, a stabilized character can be treated for 10 minutes and brought back to 1 Health (Overview button).
- **Trauma:** each time a character at 0 or below recovers to 1 or more, Trauma goes up by 1. Undoing a damage result doesn't count. A long rest sets it back to 0 and clears Stabilized.
- **Death:** at the threshold the character gets the Dead status, and their combatants are marked defeated.
- **Opt-out:** world setting **Automate death and dying** (on).

Not automated yet: Knocked Out's exhaustion level (exhaustion is the next part of step 5) and "taking damage wakes a creature knocked out by something else". Code: `module/death-core.mjs` (tests in `tests/death-core.test.mjs`) and `module/death.mjs`.

<a id="areas"></a>
## Ability areas, multiple targets and map effects

Requested by the user on 2026-11-06 (roadmap step 4).

### Using an area ability

Set **Area** in the ability's Targeting section: Single target, Circle (placed), Around you, Cone from you, or Line from you, with its size in feet (cone angle and line width where they apply; blanks use 10 ft circles, a 15 ft 60° cone and a 30 ft × 5 ft line). Press **Use** on the sheet or a favorite, or Alt-click a token and choose the ability. The shape follows the mouse (circles snap to the grid; cones and lines aim from your token); tokens inside are ringed. Click to place it, right-click or Esc to cancel. A dialog lists everyone caught, all ticked; untick anyone it shouldn't hit, then **Use** pays the costs once and posts one card with a line per target.

A token counts when its center, or a point a quarter of the way in from any corner, is inside, so clipping a corner doesn't count. You're left out of your own area unless **Can include you** is ticked.

### How targets defend

- **Area attack** (Targeting set to attack roll with an area): no attack roll. Each target may **Dodge** against the DC, using a reaction, for half damage (Notion Defenses: against an area attack your Dodge is the save).
- **Area save**: each target makes the ability's save (or one of their choice) against the DC, with no or half damage on a success.
- Every target is asked at the same time. Damage is rolled once for the whole area; each target then applies its own Resistance, Armor Rating and Block. Only the first result card carries the dice.
- Single-target abilities are unchanged: Alt-click a token, or target one token and press Use.

Placement listens for the map's own pointer events in the window capture phase: on 14.365 Foundry claims mouse-down on the map before PixiJS delivers it to canvas objects, so a PixiJS click catcher never saw the click (verified live 2026-11-06, with placement, right-click cancel and token capture rechecked afterwards). Changing scenes cancels a placement.

### Map effects

**Map effect** offers None, Lightning, Fire, Ice, Arcane, Holy, Shadow, Poison and Force, each with a default color and an optional hex color override. Single targets get a streak from the caster to the target and an impact; areas fill their shape. Effects are drawn with the canvas itself (no modules or image assets), play for every connected client viewing that scene, and leave nothing behind. `module/draw.mjs` draws with whichever PixiJS API is present; the user's 14.365 build runs PixiJS 7.4.3 (checked live), and the v8 path is kept in case a later build switches.

### Code

Shapes and hit-testing: `module/area-core.mjs` (tests in `tests/area-core.test.mjs`). Placement and target confirmation: `module/area-targeting.mjs`. Effects: `module/vfx.mjs` (smoke-tested against fake PixiJS v7 and v8 in `tests/vfx.test.mjs`). Multi-target cards and area attacks: `module/ability-strikes.mjs` and `module/strike.mjs`.

### Not yet

- Lasting areas (a wall of fire that stays), and effects for weapon attacks.
- Range limits on placed circles aren't enforced; the GM rules on reach.
- Areas don't check walls or cover.

<a id="movement"></a>
## Movement AP

Requested by the user on 2026-11-06 (roadmap step 2). Follows Notion Stats → Agility and Armor Types Information.

### Rules applied

- In a started combat, moving a character's token on its own turn spends AP at its **Movement / AP** rate (5 ft + 5 ft per AGL modifier, minimum 5, plus gear and the sheet's corrections).
- AP is spent in whole points. Feet bought but not walked carry over for the rest of that turn: at 15 ft/AP, moving 10 ft costs 1 AP and the next 5 ft is free. Unused feet are lost when the turn ends.
- Heavy armor makes each 5 ft square cost 10 ft of movement. Difficult terrain is a Foundry Region with the core **Modify Movement Cost** behavior set to 2×, so a square there costs 10 ft, or 20 ft in heavy armor.
- **Surge** (AGL 21, from gear too) gives 2 AP each turn that only pay for movement, spent before the character's own AP. Command AP is spent next, then own AP, as for every other action.
- A move that costs more AP than the character has is stopped with a message saying what it needs. Nothing is spent.
- The ruler shows the cost while dragging, for example `30 ft · 1 AP + 1 Surge`, or `60 ft · 12 AP (8 left)` when it can't be afforded.
- Undoing a move (Ctrl+Z or Foundry's movement undo) refunds what that move spent, including Surge and Command AP.
- Moves off the character's turn are free and don't count: being shoved, the GM repositioning a token, or moving into a Parry.

### Opt-outs

- World settings, all on by default: **Movement costs AP**, **Heavy armor slows movement** and **Surge gives free movement AP**.
- The sheet's **Movement / AP** override sets the rate; **Square cost (ft)** under Adjust values replaces the automatic 5 or 10 ft per square for one character.
- The GM's **Displace** movement action (token HUD) is free, for a one-off move that shouldn't cost anything.

### Rule choices to confirm

- Feet left over after paying AP carry over within the turn. Without this, two 5 ft steps at 15 ft/AP would cost 2 AP while one 10 ft step costs 1.
- Blink (teleport) movement is charged like walking. A teleport ability pays its own AP through the ability instead, so its move can use Displace.

### Code

`module/movement-core.mjs` holds the rules (tested in `tests/movement-core.test.mjs`). `module/movement.mjs` registers the settings, charges AP before a token moves and refunds undone moves (`TokenDocument#_preUpdateMovement` / `_onUpdateMovement`), applies the square cost to Foundry's movement measurement and adds the AP cost to the ruler label. Each turn's payments are stored on the actor as `flags.worlds-beyond.movement`, keyed by combat, round and turn; a new turn starts empty.

It finds the current combatant by searching the combats, not through `TokenDocument#combatant`: that reads the combat tracker, which is briefly empty while it re-renders after an actor change (seen live on 14.365, where Foundry then also skipped recording the move).

### Not yet

- Moves while it isn't anyone's turn in the combat are free.

<a id="opportunity"></a>
## Opportunity attacks

Requested by the user on 2026-11-07 (roadmap step 2). Follows Notion Defenses (opportunity attacks use a reaction and no AP) and Weapons Explained (Reach, Bulwark).

### When you're asked

- In a started combat, when a token leaves the reach of an enemy combatant holding a melee weapon, that enemy's owner gets a popup: **Attack with** a weapon, or **Let them go**. The player assigned to the character answers, otherwise another owner, otherwise the GM.
- Reach is 5 ft, or 10 ft with a Reach weapon; any diagonal neighbor counts as 5 ft. Your reach is your longest held melee weapon's, so stepping from 5 ft to 10 ft of a glaive wielder doesn't provoke even if they also hold a dagger. Only weapons that reach the mover's last square inside your reach are offered.
- **Bulwark** weapons (Spear, Pike) also offer an attack when a creature moves *into* their reach.
- Enemies are friendly vs hostile (or secret) token dispositions: green vs red. Neutral tokens never provoke or attack. Use the token HUD's Ally/Enemy button (below) to switch sides.
- No prompt when: the attacker has no reactions left, is hidden or defeated; the mover is hidden or has **Flicker** (AGL 28); the move is a teleport (Blink), Displace or an undo; the scene uses a hex grid.

### The attack

**Attack with** opens the normal attack dialog as an opportunity attack: one weapon, melee only, no AP cost shown. **Spend a reaction** is ticked in combat; untick it to roll without spending one. The card says "Opportunity attack · 1 reaction spent". The mover has already finished moving when the attack resolves.

**The target can't Dodge, Parry or Block an opportunity attack** (user ruling, 2026-11-07). If it hits, Resistance and Armor Rating still reduce the damage, which is applied without a popup. Normal attacks keep every defense.

Reactions come back at the start of each creature's own turn. A character who spends their only reaction on an opportunity attack has none left to Dodge or Block until their next turn.

### Opt-outs

- World setting **Offer opportunity attacks** (on).
- **Let them go** on each popup, and the **Spend a reaction** checkbox.
- Before moving, the mover is asked to confirm a move that would provoke (see below). The warning opens beside the mover, its path and the enemies, so it doesn't cover them.

### Rule choices to confirm

- Notion doesn't say what provokes an opportunity attack. This uses D&D's rule: leaving an enemy's reach, which includes walking through it.
- Bulwark attacks count as opportunity attacks, so they use a reaction and Flicker avoids them.
- The attack happens after the move, not before the mover steps out. A hit doesn't stop the move (confirmed 2026-11-07).
- No defensive reactions against opportunity attacks (decided 2026-11-07). Notion Defenses says so since 2026-11-09: the target can't Dodge, Parry or Block it; Resistance and Armor Rating still apply.

### Code

`module/opportunity-core.mjs` holds the rules (tested in `tests/opportunity-core.test.mjs`). `module/opportunity.mjs` checks each finished move on the active GM's client (`moveToken` hook) and sends the popup to the attacker's owner over the system socket. `promptAttack`/`rollAttack` in `module/attack-actions.mjs` take an `opportunity` option that spends a reaction instead of AP (tested in `tests/action-handlers.test.mjs`).

<a id="positioning"></a>
## Sides, collision and attack range

Requested by the user on 2026-11-07, after opportunity attacks never fired: every token in their test combat was Hostile, so all of them were on the same side.

### Ally or enemy

Right-click a token: the left column of the token HUD has a **handshake** (Ally, green) or **skull** (Enemy, red) button. Clicking it switches the token between Foundry's Friendly and Hostile dispositions. Green and red tokens are enemies; tokens of the same color are teammates; Neutral (yellow, set in Token settings) is nobody's enemy. Owners of the token can use it.

### Collision

- Enemies block movement: a move through an enemy's space is stopped with "Orc is an enemy in the way. Go around it."
- Allies, neutral tokens and downed creatures (0 Health or less) can be moved through, but no token can end its move in another token's space.
- Applies in and out of combat. Hidden tokens never block, so they aren't revealed. Tokens at a different elevation don't block. The whole move is refused; nothing is spent.
- **Transforming into a bigger form** (for example Roman's 2×2 Monstrous form) looks for room: the new size is placed over the token's current space, nearest its usual growth spot, without overlapping any token or leaving the map. If no placement fits, the form doesn't activate: "There isn't enough space for Roman to transform here. Move somewhere with more room." Nothing is spent. Ending the form shrinks back inside the big space, so it always fits. Turning off **Tokens block movement** turns this off too.

### Warning before provoking

In combat, a move that would leave the reach of a visible enemy who has a reaction and a melee weapon asks first: "This move leaves Orc's reach. They can spend a reaction to attack... Move anyway?" **Stay** cancels the move; **Move anyway** goes ahead and is asked only once per move.

### Weapon reach and attack range

- Weapons have a **Melee reach (ft)** field (Range & loading on the weapon sheet). Blank means 5 ft, or 10 ft with the Reach property. It sets both melee attack reach and opportunity-attack reach.
- With a target token on the map, the attack dialog shows the distance and reach or range: "Orc is 15 ft away · reach 5 ft. Out of reach: move closer." Thrown and ranged attacks use the weapon's normal/long range: past normal range ticks **Past normal range** (disadvantage); past long range is out of range.
- The **Grip** choice for a Versatile weapon shows the dice rolled at the attacker's level, such as 2d8 / 2d10 for a Longsword at level 5.
- Attacking out of reach or range asks **Attack anyway?** first. Opportunity attacks skip the check, because the target has already moved away. Weapons with no listed range aren't checked.

### Opt-outs

World settings, all on: **Tokens block movement**, **Warn before provoking opportunity attacks**, **Check attack range**. The GM's **Displace** movement ignores collision and doesn't provoke. **Attack anyway** overrides a range check.

### Rule choices to confirm

- Distance and reach count any diagonal step as 5 ft, the same as movement on this world's grid.
- Neutral tokens can be moved through.
- Collision ignores creature size (a Tiny creature can't slip through a Huge enemy's space).

### Code

`module/positioning-core.mjs` (collision, attack range; tests in `tests/positioning-core.test.mjs`) and `module/positioning.mjs` (settings, token HUD button, footprints, attack distance). Collision and the provoke warning run in `TokenDocument#_preUpdateMovement` in `module/movement.mjs`, before movement AP is paid. `provokers` and `confirmProvoking` in `module/opportunity.mjs` share one check with the GM's prompts.

<a id="attacks"></a>
## Weapon attacks and damage

Roadmap step 4; reviewed action handling in version 0.9.2. Rules checked against Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48), [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d) and [Action Points](https://www.notion.so/406c72092efb81a491b3e7dc50e9ba73) on 2026-10-31, and the website's `combat-core.js` (`attackApCost`, `attackHits`, `criticalTotal`).

<a id="attacks-flow"></a>
### Flow

1. **Attack** appears on equipped weapons. The dialog offers only the choices the weapon allows: melee or thrown, STR or DEX (with each option's AP cost), one- or two-handed grip for Versatile, long range, and Mounted with feet charged for Mount weapons.
2. The attack card shows d20 + modifier, and Hit/Miss against the **targeted token's** Natural Evasion. With no target, it shows the total to compare by hand.
3. **Roll damage** rolls on the card. A crit shows **Roll critical damage**. A natural 18–19 with Finesse/Paragon and no target shows both buttons. Each attack can roll damage once.

<a id="attacks-rules-applied"></a>
### Rules applied

- Stats: Balanced STR or DEX. Heavy STR. Finesse DEX. Paragon STR or DEX, melee or ranged. Ordinary ranged and every thrown attack DEX.
- AP: 10 − the attack modifier. The user confirmed on 2026-11-01 that a negative modifier raises the cost and that the change is capped at half the base either way, rounded down: attacks cost 5–15, 11 AP spells 6–16, 5 AP reloads 3–7 (`actionApCost`). Notion's Action Points page only states the lower limit. The website's `attackApCost` has no upper cap.
- Spend AP starts ticked only when the character is in a started combat; outside combat actions are free. With too little AP the attack is refused and nothing is spent; untick Spend AP to roll anyway.
- Two weapons: with a Light weapon equipped in each hand, the dialog offers **Both**. Each weapon rolls to hit for one attack's AP (the main weapon's cost). The off-hand hit deals full rolled dice damage with no modifier or charge bonus. Each hand has its own damage button. Off-hand uses the same stat when its weapon allows it, otherwise its own.
- Loading: weapons with Loading track shots (blank = full). Each attack fires one; an empty weapon refuses to attack. **Reload** refills it for 5 AP minus DEX (3–7) in combat, free outside. Ammunition isn't spent, because Notion doesn't say attacks use it up.
- Automatic disadvantage: Heavy without 21 STR, Finesse without 21 DEX, Paragon without both, Mount while not mounted, past normal range, heavy armor without 21 STR. The dialog lists the reasons and pre-selects disadvantage, updating as Past normal range, Mounted or the attack mode change (0.9.1, after the user found the range box seemed to do nothing). The player can still change the dice, and the card says if a listed disadvantage wasn't used.
- Hit: total meets or beats Natural Evasion. A natural 20 always hits and crits. Finesse and Paragon also crit on a natural 18 or 19 that hits.
- Damage: the listed dice are rolled 1×/2×/3×/4×/5× at levels 1/5/10/15/20, with the modifier added once. Heavy and Paragon add double. Versatile in two hands uses the bracket damage and counts as Two-handed. Mount adds +1 per 10 ft charged, up to the attack modifier.
- Critical: maximum of the scaled dice + modifier, plus the dice rolled again (Notion: 2d10 + 6 → 26 + 2d10).
- Armor: with a target, the card shows how much of its Armor Rating counts. Two-handed hits ignore half, rounded down, so the half that counts rounds up. Puncture ignores 2 more afterward. [Linked defense controls](COMBAT.md#linked-defenses) open Dodge, Parry and Block from the weapon attack; Resistance selection and Health changes remain manual.
- Signature properties print their Notion text on the damage card as reminders.

<a id="attacks-not-yet"></a>
### Not yet

- Automating signature properties one at a time. They print as reminders on the damage card.
- Fast Roll. Foundry rolls every die anyway.
- Unarmed attacks.

Visibility, resource recovery and retry handling were reviewed and corrected in [ACTION-REVIEW.md](COMBAT.md#action-review).

<a id="attacks-order-of-a-hit"></a>
### Order of a hit

Rechecked Notion [Defenses → Order of a Hit](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d) and [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48) on 2026-11-02 for base-sheet review item 1. The website's current `combat-core.js` was also consulted; Notion governs the order.

`hitDamage` in `module/attacks.mjs` owns the Foundry-free calculation: Resistance halves damage (round down), effective Armor Rating is subtracted, Block is subtracted, then Overwhelming Force raises the result to half the original damage (round down) if needed. It returns each intermediate amount and the final total. Off-hand/critical adjustments have already determined the incoming damage. Dodge/Parry remain separate defense interactions.

Examples: 16 damage with Resistance becomes 8, then AR 6 leaves 2. A Block of 1 leaves 1; Overwhelming Force would raise it back to 8 afterward. Against AR 7, a Two-handed Puncture hit counts 4 AR minus 2, or 2 AR total. The combined property hint now states that rounding correctly; the existing effective-armor math is preserved.

New damage cards give conditional pre-Block previews for Resistance being present or absent and state the order explicitly. The target has no Resistance field yet, so the card does not select it automatically. The Overwhelming Force reminder comes after Block, even when no target was selected. Block's dialog/card use the same order. All explanations remain inside their existing expandable sections, and no Health is changed automatically.

<a id="attacks-validation"></a>
### Validation

`node --test` (92) covers stat choices, modes, AP costs, every disadvantage reason, crit thresholds and outcomes, the scaling table, double modifiers, versatile grips, Notion's crit example, Mount caps and Armor Rating halving/Puncture, using the real catalog items. The dialog and sheet templates were rendered with Foundry's Handlebars build.

The damage-order fix passes the full 375-test suite, including Resistance before AR, odd/even Two-handed/Puncture armor, Block, Overwhelming Force's final floor and zero/off-hand cases. Handler regressions verify conditional card numbers/order, escaping and unchanged Health. Offline v14.365 models/strict Handlebars render four damage-card cases plus Block dialog/card with dice/chat adapters. Thirty-six isolated browser states cover collapsed/expanded cards at 760/390/340 px using Foundry CSS; screenshots were inspected. Native live dice, sockets and multi-client interaction remain for user review.

Not yet checked in a running world:

- [ ] Equip a Longsword. Attack: STR/DEX choice with AP costs, Grip choice. AP drops by the cost.
- [ ] Target a token and attack: Hit/Miss against its Natural Evasion. Roll damage: one card, the button disables afterward.
- [ ] Greatsword at STR 20: disadvantage pre-selected with the reason. At level 5: 4d6 + 2× STR mod.
- [ ] Rapier: a natural 18–19 that hits is a crit. Critical damage formula shows max + dice.
- [ ] Handaxe: Thrown option rolls with DEX. Longbow: long-range checkbox adds a reason.
- [ ] Untick Spend AP with 0 AP: still rolls. Ticked: refused with a message.
- [ ] Player client: only the owner sees the damage buttons.
- [ ] Equip a Dagger and a Scimitar. Attack with the Dagger, Hands → Both: two to-hit rolls, one AP cost, two damage buttons. Off-hand damage is full dice damage with no modifier.
- [ ] Revolver: attack 6 times, the row shows shots falling to 0 and the 7th attack is refused. Reload in combat costs 5 − DEX mod AP, outside combat nothing.
- [ ] Start a combat with the character in it: Spend AP starts ticked. Outside combat it starts unticked.
- [ ] DEX 6 (−3): attacks cost 13 AP. Very low modifiers stop at 15.

<a id="block"></a>
## Block reaction

This is the first defense interaction in roadmap step 5. The user confirmed start-of-turn refills work before authorizing it.

<a id="block-sources"></a>
### Sources

- Notion [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d), read 2026-11-01: Block dice + STR, shield dice, equipment requirements, reaction cost, ally protection, damage order and Overwhelming Force.
- The website's current [Block controls in js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js), read 2026-11-01, informed the Block action and equipment reminders. Notion remains the rules authority. Foundry uses its own dialog/chat APIs and keeps manual corrections available.

<a id="block-behavior"></a>
### Behavior

- Click **Block** under **Worn armor and corrections**. The default formula uses the existing Foundry-free `blockDice` calculation and the character's prepared STR modifier, including automatic effects.
- Base dice are 1d4, adding one die at levels 5/10/15/20. The largest equipped shield's Block die replaces d4 for every die. Without a shield the roll uses d4; arm guards or a held weapon still allow Block.
- The formula is editable. `@mod` is the current STR modifier. Rare-metal multipliers and other special adjustments are manual; for example `(2d8 * 2) + @mod` multiplies the dice before adding STR. Fast Roll is also manual: replace two dice with `(1d8 * 2) + @mod` when applicable.
- **Spend 1 reaction** defaults on when this actor is in a started combat, including an unlinked token's own actor. Otherwise it defaults off. Checked spending requires one available reaction; players can correct the pool or untick it to roll without spending. Block spends no AP.
- The chat card contains a native Foundry roll and whether a reaction was spent. It respects public, GM, blind and self visibility. Blind rolls disable interactive dice.
- Dice and rendering failures do not spend reactions. A failed chat post refunds a spent reaction. A failed refund explicitly asks for manual correction. Actions share the existing local actor queue with attacks, reloads and consumables.
- Equipment eligibility and ally distance remain reminders. Version 0.18.0 adds [linked weapon attack cards](COMBAT.md#linked-defenses), including spent Block use per incoming hand; standalone sheet rolls retain manual association. Apply Resistance first, then Armor Rating, then subtract Block from the remaining damage and change Health manually. Fully blocking the remainder also stops effects that require cutting into the defender. Account for Overwhelming Force's half-damage floor when applicable.
- Base-sheet review item 1 rechecked Notion on 2026-11-02: Resistance halves the original damage rounded down, then Armor Rating and Block reduce it, then Overwhelming Force raises it to half the original rounded down if needed. The Block dialog/card and new damage cards state this same order. Shared Foundry-free `hitDamage` calculates the sequence for damage previews; Block continues to roll its reduction and leaves Health application manual. See [damage-order examples and tests](COMBAT.md#attacks-order-of-a-hit).
- No actor/item schema fields changed. Chat messages record the actor, reaction kind and spending choice in a system flag; linked messages also retain incoming context. Linked spending uses the additive actor flag documented above.

<a id="block-validation"></a>
### Validation

Automated adapter tests cover default dice and prepared STR, dialog defaults/cancellation, all four chat modes, blind interaction, optional spending, invalid formulas, failures and refunds, final-reaction double clicks, unchanged Health/AP/Wonder and owner permissions. Existing pure Block tests cover level scaling and equipped shield selection.

Templates were compiled locally with Foundry's bundled Handlebars. Foundry was not used to open a live sheet, roll dice, exercise sockets across clients or inspect phone layout. Local queues do not coordinate simultaneous actions from separate clients.

Test the installed branch before merging:

1. Restart Foundry and refresh player browsers. Open a character and find **Block** below the armor corrections.
2. At level 1 without a shield, check `1d4 + @mod`; equip a shield and check its die replaces d4. At level 5 check two dice. Change STR and confirm the new modifier appears in the result.
3. Cancel the dialog and confirm no roll or resource change. Outside combat, roll with spending unticked; reactions should stay unchanged. In combat, spending should default on and consume exactly one reaction, leaving AP/Health/Wonder unchanged.
4. With zero reactions, checked spending should report the empty pool. Correct the pool or untick spending to roll. Check an edited formula, including a negative STR modifier if appropriate.
5. Try public, GM, blind and self modes from a player and GM browser. Confirm only the intended audience sees the result. Check a narrow sheet and dialog.
6. Apply blocked damage manually, then advance the turn and verify reactions refill as before. For unlinked tokens, verify the token actor's own reaction pool changes.

<a id="dodge"></a>
## Dodge reaction

Version 0.12.0 added standalone Dodge. Version 0.18.0 also opens it from [linked attack cards](COMBAT.md#linked-defenses).

<a id="dodge-sources"></a>
### Sources

Read on 2026-11-01:

- Notion [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d): d20 + AGL, direct-attack and area-save comparisons, natural 20 exclusion and reaction use.
- Notion [Armor Types Information](https://www.notion.so/351c72092efb81c9b6c9ece66059f1de): heavy armor without 21 STR gives disadvantage on Dodges and AGL saves.
- Website [defense controls in js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js) and [defenseResult in js/combat-core.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/combat-core.js): incoming attack/save target, dice + modifier, result wording and forced success. Foundry reuses its existing check/Wonder cards instead of porting DOM code. Notion remains the rules authority.

<a id="dodge-behavior"></a>
### Behavior

- Click **Dodge** beside Block under **Worn armor and corrections**. It uses the prepared AGL modifier, including armor penalties and automatic adjustments.
- Choose a direct attack or area attack save. Enter the attack total/save DC, or leave it blank for manual comparison. An explicit zero is a valid target. Direct Dodge must **beat** the attack total; a tie fails. Area Dodge must **meet or beat** the save DC and halves damage on success, before Resistance and Armor Rating. A failed roll leaves full damage for subsequent defenses.
- A direct attack that rolled a natural 20 cannot be Dodged. Marking that checkbox reports the rule and spends nothing. That direct-attack flag does not apply to an area save. Non-attack area effects, such as mind control, cannot be Dodged; eligibility remains the player's decision. The defender's own natural 20/1 does not automatically succeed/fail.
- Normal, advantage and disadvantage use the same readable cards as checks/saves. Heavy armor disadvantage is preselected when the prepared equipment data says it applies; players may choose different dice for other effects/corrections. The card notes when a different mode was selected despite that condition.
- **Spend 1 reaction** defaults on for an actor in a started combat, otherwise off. It spends one current reaction and no AP. With no reactions available, correct the pool or explicitly untick spending. Health and Wonder remain unchanged by the initial Dodge. The shared local action queue prevents Dodge and Block from spending the same final reaction on one client.
- Dice/template failures do not spend. A failed chat post refunds the spent reaction; failed recovery reports manual correction. Chat visibility uses Foundry's public/GM/blind/self modes, and blind dice disable interaction.
- Dodge is a non-attack d20 check, or a save for an area attack, so its card supports **Wonder**. A reroll retains its original modifier, dice mode, target, direct/area choice and private audience, then recomputes the result. It spends Wonder without another reaction. At FTH 21, Defy Fate declares success, giving full avoidance for direct Dodge or half damage for an area save. A result uses Wonder once; its new reroll may use it again as before.
- Apply Health changes manually. Sheet-based Dodge accepts a manual total/DC; linked weapon cards prefill the total and track spent Dodge use per incoming hand. Distances and effect eligibility remain manual. A failed Dodge can be followed by Block or Parry with another reaction. Overwhelming Force does not stop a successful direct Dodge, but may raise damage back to its floor after an area save and other mitigation.
- No actor/item data fields changed. New Dodge chat messages store their comparison context in the existing system check flag, allowing Wonder to retain it. Old check/save/initiative/Block cards retain their behavior.

<a id="dodge-validation"></a>
### Validation

`node --test` covers direct/area ties, blank and zero targets, natural 20 exclusion, forced success, invalid input, prepared modifiers, heavy-armor defaults/corrections, all dice and chat modes, dialog cancellation, reaction refunds, competing Block/Dodge spending, permissions, readable cards and Wonder/Defy Fate integration. Existing tests cover per-result Wonder limits and failed posting recovery.

Local smoke checks use Foundry 14.365's real data model and bundled Handlebars to compile the editable/read-only sheet, all spending/armor dialog combinations, direct/area outcomes, manual comparison, zero targets, Wonder/Defy Fate and ordinary roll cards. No live Foundry world, sockets, actual dice UI or phone layout was exercised. Local queues do not coordinate separate clients.

Test the installed branch before merging:

1. Restart Foundry and refresh player browsers. Find **Dodge** under armor corrections and check its AGL modifier against the sheet.
2. Try direct and area rolls with a target, including a tie. Direct ties fail; area ties halve damage. Leave the target blank and confirm the card gives a manual comparison reminder. Try zero explicitly.
3. In combat, roll with reaction spending checked: exactly one reaction should be spent, with no AP/Health/Wonder change. Outside combat it should default off. Cancel and confirm no changes. At zero reactions, unticking spending should still allow a practice roll.
4. Mark an incoming direct natural 20 and confirm it reports that Dodge is unavailable without spending. Area attacks use the save DC; non-attack effects remain ineligible.
5. Wear heavy armor below 21 STR and check disadvantage is preselected; change the dice to verify manual corrections remain available. Check both dice and the kept result appear clearly.
6. Use Wonder on a failed Dodge, then on its new result. Confirm the target/modifier persist and only Wonder is spent. At FTH 21, check direct Dodge declares no damage while an area save declares half damage.
7. Check public/GM/blind/self visibility from GM and player browsers, an unlinked token's reaction pool, narrow sheet/dialog layout, and turn-start refills. Apply Health changes manually.

<a id="parry"></a>
## Parry reaction

Version 0.13.1 added Parry and keeps long roll dialogs scrollable above visible action buttons. Version 0.18.0 also opens it from [linked attack cards](COMBAT.md#linked-defenses); Health changes remain manual.

<a id="parry-sources-and-rule-choices"></a>
### Sources and rule choices

Read on 2026-11-01:

- Notion [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d): reaction use, DEX 21 and held equipment, visible physical attacks, ally protection, natural 20 eligibility and Overwhelming Force.
- Notion [Dexterity](https://www.notion.so/351c72092efb8132b174eb48b029c4ab): once each round, d20 + DEX, strictly beat the attack to negate damage and non-magical effects.
- Website [defense controls in js/app.js](https://github.com/immortalwarlock427-debug/Worlds-Beyond/blob/main/js/app.js): the Parry action, readiness reminders, ally choice and use tracking informed this dialog. Foundry uses its existing readable check/Wonder cards.

Notion is the rules authority. Availability follows the combat's **round number**. The website currently describes refreshing at the start of the character's turn and also adds DEX-modifier uses per long rest outside combat; those details are absent from the fetched Notion Parry rules. This implementation uses once per combat round, with unspent practice rolls outside combat. No additional out-of-combat use limit was inferred.

<a id="parry-behavior"></a>
### Behavior

- Click **Parry** below Block/Dodge under **Worn armor and corrections**. The roll uses the current prepared DEX modifier. Enter an attack total, or leave it blank for manual comparison. A tie fails. Incoming natural 20s can be parried; the defender's own natural 20 does not automatically win.
- DEX 21 and a held weapon or shield are requirements. The dialog warns when the effective score is too low or no weapon/shield is marked equipped. Requirements stay reminders for this trust-based sheet; players may correct equipment or account for another ability. Spending defaults off when either requirement is missing, while deliberate spending remains available.
- Select normal, advantage or disadvantage. Heavy armor alone does not impose Parry disadvantage under the fetched rules. The usual readable d20 + modifier card, kept-die explanation and Wonder control apply.
- **Spend 1 reaction** defaults on for an eligible character in a started combat when Parry is unused. It spends one current reaction and records this combat round's Parry use in the same actor update. No AP is spent. Another spent Parry in that round reports the used state. Changing turns does not renew it; the next round number does.
- When several started combats contain the actor, the viewed combat is preferred, then the first matching combat. Uses are tracked separately by combat. Linked actors share their use; unlinked token actors keep their own flags and reaction pool.
- When opening Parry after a spent use, the dialog offers **Reset Parry use** for a correction. It clears only the current combat's current-round use, closes the dialog, and rolls nothing. It does not refund a reaction. Reopen Parry to use it again; correct the reaction pool separately when needed. Unticking spending makes a practice roll and preserves both the reaction pool and round-use record.
- **Protect an ally** changes the card's label. The ally must be reachable with 1 AP of movement and the defender moves in front of the attack. Eligibility, visibility, distance and token movement remain manual. Linked cards track spent Parry use per incoming hand in addition to the round limit; standalone sheet rolls retain manual association.
- **Overwhelming Force** preserves a successful Parry's half-damage floor in the result explanation; non-magical effects are still negated. Otherwise a successful Parry negates the damage. Apply Health changes and any effect removal manually.
- Wonder retains the original target, ally choice, DEX modifier, dice mode, combat/round and private audience. It spends no additional reaction or Parry use. FTH 21 Defy Fate declares success but preserves Overwhelming Force's floor. A new Wonder result can use Wonder again as before; its parent result cannot.
- Dice/render failures spend nothing. Failed chat posting restores both the reaction and previous use record. Failed compensation reports that reactions and Parry use need manual correction. Public/GM/blind/self visibility is preserved; blind dice disable interaction.

<a id="parry-data-and-validation"></a>
### Data and validation

No actor/item schema fields were renamed, removed or added. New actor flag `flags.worlds-beyond.parryUses.<combatId>` stores the last spent round for each encounter. New Parry chat messages store defense context in the existing check flag for Wonder. Availability compares stored/current round values, so advancing a round needs no actor rewrite. The dialog reads availability when opened; a roll rechecks it in the shared local actor action queue.

Automated tests cover eligibility reminders, strict comparisons, manual/zero targets, Overwhelming Force, all dice/chat modes, round-versus-turn tracking, separate combats, reset without refund, failures and compensation, competing reaction spending, practice, permissions and Wonder/Defy Fate. Local smoke checks use Foundry 14.365's real data model and bundled Handlebars for editable/read-only controls, warnings, outcomes and ordinary Block/Dodge/check regressions.

Live Foundry verification reproduced the clipped action footer in 0.13.0, then confirmed 0.13.1 keeps Roll Parry visible while scrolling to the final instructions. No roll was submitted or resource changed during that layout check. The reset button, token movement, sockets and phone layout remain untested live. The local action queue does not coordinate separate clients. A Parry already being rolled keeps the round it started in if the tracker advances while dice are pending.

Test before merging:

1. Restart Foundry and refresh player browsers. Open Parry and check Roll Parry remains visible while the instructions scroll, including in a shorter window. At DEX 21, equip a weapon or shield and check the DEX modifier and spending default. Below DEX 21 or without held gear, check warnings and unspent practice defaults.
2. Enter an attack total; Parry must beat it, including when that attack rolled a natural 20. Try a tie, a blank target and normal/advantage/disadvantage.
3. In combat, spend one reaction. Confirm AP/Health/Wonder stay unchanged. A second spent Parry in that round should report it was used. Advancing only a turn keeps it used; advancing the round makes it available, provided reactions remain.
4. Open a used Parry dialog and select Reset Parry use. Confirm it rolls nothing and does not refund a reaction; reopen and check availability. Try practice rolls without spending.
5. Protect an ally and check its label. Use Overwhelming Force and verify successful results retain the half-damage reminder. Move tokens, change Health and remove effects manually.
6. Use Wonder on a failed Parry and check target/modifier/use records persist. At FTH 21, verify Defy Fate succeeds while Overwhelming Force still applies.
7. Check private chat modes with player/GM browsers, an unlinked token's own reaction/use state, narrow layouts, and existing Block/Dodge/turn-start refill behavior.

<a id="linked-defenses"></a>
## Defend from weapon attack cards

Version 0.18.0 connects existing Block, Dodge and Parry dialogs to incoming weapon attacks. Health, damage mitigation and token movement remain manual.

<a id="linked-defenses-sources"></a>
### Sources

Checked 2026-11-01: Notion [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d), last edited 2026-10-31. A defense kind can be used once against an attack, while another defense may follow a failed Dodge. Natural 20 attacks cannot be Dodged but can be Blocked or Parried. Parry remains once per round, and Overwhelming Force preserves its half-damage floor. Existing [Block](COMBAT.md#block), [Dodge](COMBAT.md#dodge) and [Parry](COMBAT.md#parry) comparisons, spending and corrections are reused.

The current website's `js/app.js` incoming-attack and `useDefense` controls were consulted. Foundry keeps its compact navy/brass buttons and collapsible help. The previously documented website/Notion difference in Parry refresh timing remains unchanged: Notion's once-per-round rule is used.

<a id="linked-defenses-behavior"></a>
### Behavior

- Visible hit or manually compared weapon-attack cards offer **Block · Dodge · Parry** below each hand. Known misses do not. Damage buttons still belong to the attacker; defense buttons belong to anyone with an owned character available. Opening or cancelling spends nothing.
- When multiple owned characters are available, choose the defender first. The attack's exact target actor, including its synthetic token actor, comes first, followed by controlled tokens, assigned character and owned world characters. Distinct unlinked tokens remain distinct choices. Dodge protects the original target; use Block/Parry for an ally or the sheet for a targeting correction.
- The existing dialog shows the incoming weapon/target and prepopulates the total. Natural 20 status prepopulates Dodge and disables its card shortcut; expanded Finesse/Paragon crits on 18–19 do not disable Dodge. Parry prepopulates Overwhelming Force and ally protection; Block preselects ally protection when appropriate. These form values stay editable for corrections. Equipment, shield/ally reach and physical visibility remain reminders.
- New attacks snapshot both hands' totals/natural dice, the attacker's STR 28 status and target actor/token UUIDs. Later stat, selection or equipment changes do not change those incoming facts. Older cards can use their saved evaluated rolls; without target/STR snapshots those details stay manual. Cards without usable totals/d20s retain sheet-based manual defenses.
- Spending marks that defense kind against the particular message and hand on the defender. The other hand, another character and another defense kind have separate use state. Unspent practice rolls do not create or clear marks. Refilling reactions, advancing combat or deleting a defense-result message does not unlock the same incoming attack.
- Reopening a used linked defense defaults to practice and offers **Reset linked [defense] use**. Reset clears only that mark, rolls nothing and refunds nothing. Parry's separate once-per-round mark retains its existing reset. Correcting both limits can require both resets; correct reactions separately if needed.
- Results show their incoming weapon/attacker/target and store the source message/hand. Dodge/Parry Wonder rerolls retain this context and the audience, spend no additional reaction and do not create another linked use. Defy Fate retains existing defense outcomes.
- Linked replies inherit public/GM/blind/self visibility from the incoming attack, even if the current roll mode has changed. A non-blind whisper's original author is retained as a recipient when necessary. Blind replies keep blind status and non-interactive dice. Invisible/deleted source attacks cannot start a linked spend. Standalone sheet defenses still use the current chat mode and manual comparison.
- Dice/render failures spend nothing; failed use marking or chat posting compensates reactions and linked/Parry marks. Failed compensation reports manual correction. Existing local queues serialize actions for one actor on one client; simultaneous actions on separate clients are not coordinated.

<a id="linked-defenses-data-scope"></a>
### Data scope

No actor/item data model changes or migrations. New actor flag `flags.worlds-beyond.defenseUses.<messageId>_<handIndex>.<kind>` records spent linked uses. New message fields are additive. Saved worlds, actor values, item data and old messages are not rewritten on load. Flags persist like Wonder history; no automatic pruning or deletion is introduced.

This step does not associate separate damage-result cards, automatically deduct Health, enforce an ordered defense chain, decide whether a prior Dodge/Parry succeeded before allowing another defense, or automate distance/effect eligibility. Players resolve those decisions, Resistance, Armor Rating, Block and Overwhelming Force in the existing rule order. Sheet-based manual defenses remain available for external rolls, area saves and corrections.

<a id="linked-defenses-validation"></a>
### Validation

`node --test` covers new attack snapshots, separate hands, natural 20 versus expanded crit, zero/legacy/missing rolls, defender selection and cancellation, unlinked identity, owner filtering, duplicate spending/races, resets, compensation, private audiences, Wonder and non-attacker controls. Real Foundry schema and strict Handlebars smoke checks cover unchanged standalone forms and linked variants. The PR records live checks and limits.

Before merging:

1. Restart Foundry and refresh player browsers. Make a targeted weapon attack and use its defense buttons from the defender's account. Confirm the correct character/token and total. Cancel and confirm resources stay unchanged.
2. Try a natural 20 (Dodge unavailable), an expanded 18–19 critical (Dodge available), a miss and a two-weapon attack with independent defense controls.
3. Spend Dodge, then Block against the same hand. Retry that Dodge and confirm it is used; reopen/reset for a correction without a refund. Check practice rolls and that the other hand/another defender remain independent.
4. Parry with STR 28 on the attacker; check the force flag and half-damage reminder. Check the separate round-use reset, shield/ally protection reminders and manual movement/Health handling.
5. Use Wonder and check source context, target and privacy persist with no second reaction. Try public/GM/blind/self modes, GM/player accounts, an unlinked target and a narrow window. Cross-client races, real transport failures and player/phone layouts require in-world testing.

<a id="token-attacks"></a>
## Token attacks and hand equipment

Version 0.19.0 adds the user's requested token-click attack shortcut and compatible equipped hand gear. It reuses weapon attacks and linked defenses; Health, token movement and damage application remain manual.

<a id="token-attacks-rules-checked"></a>
### Rules checked

Read 2026-11-01: Notion [Weapons Explained](https://www.notion.so/351c72092efb81608515cad619890c48), [Equipment Rules](https://www.notion.so/40ac72092efb81588f50ea19ac0ab5e4) and [Action Points](https://www.notion.so/406c72092efb81a491b3e7dc50e9ba73). Two Light weapons can fight together; Two-handed occupies both hands; Versatile can use either grip; Strapped occupies no hand. The user's explicit rule allows only one ordinary held weapon and permits a one-handed weapon plus a shield, including a non-Light weapon. The website's `equip`, `fits` and `attackWith` controls were consulted; Foundry retains its own dialogs and canvas.

Titan's Might audit: searched Game Systems for Titan/Might/push and fetched matching stat references. [Strength](https://www.notion.so/351c72092efb81bc9c1dc28707e48241) already says **15 ft**. Stats Explained only names the milestone; the other Titan search match is unrelated Titanium. No remaining 5 ft Titan's Might push wording was found, so no Notion edit was made. Foundry currently stores only its milestone name and does not automate the push. Weapon Hook and Reach keep their separate 5 ft rules.

<a id="token-attacks-how-to-attack"></a>
### How to attack

1. In Foundry's normal token selection tool, select exactly one character token you own.
2. Click another visible token. It becomes your target and your attacker remains selected. With one equipped weapon, its normal attack dialog opens; with several, choose the equipped weapon first.
3. Confirm dice, grip, AP spending and other options, then Attack. The clicked target's exact actor/token identity and defenses are passed through even if another token was previously targeted. Normal attack/damage cards and Block/Dodge/Parry controls follow.

Select your attacker, then Alt-click the target to open the attack dialog. Double-click a token to open its sheet with normal Foundry permissions. Target/ruler tools keep their original behavior. Multi-selection does not guess an attacker. Invisible targets, placement/ruler/drag workflows and unowned attackers do not open this shortcut. This does not grant permission to control, move or edit another player's token. A pending attack dialog suppresses duplicate clicks for that attacker.

No weapon equipped gives an instruction to equip one. Legacy invalid loadouts give an instruction to re-equip the intended weapon. Cancelling a chooser or attack dialog spends nothing. Attack-time checks catch weapons that were stowed/deleted or an incompatible two-hand grip before AP/shots are spent. Range, line of sight, ally/enemy intent and reach are still table decisions.

<a id="token-attacks-equipment-behavior"></a>
### Equipment behavior

- Two hand slots: a shield uses one; an ordinary weapon uses one; Two-handed uses both. Two held weapons must both be Light and one-handed. A non-Light one-handed weapon can still share with a shield.
- Strapped weapons do not consume a hand and can remain equipped alongside held gear, including a two-handed weapon. No additional Strapped count/forearm cap was invented. Strapped does not grant a combined two-weapon attack: that still needs a Light weapon in each hand.
- Equipping preserves the deliberately changed item first, keeps compatible gear and stows conflicts in the same Item update operation. For example, a Greatsword stows a sword/shield while keeping a Strapped crossbow; equipping a one-handed sword preserves a shield. A third Light weapon replaces one of the two already held. The user is told which items were stowed after a successful update.
- Item-sheet Equipped checkboxes and changes to Light/Two-handed/Strapped on equipped items use the same batch preflight. Armor, quantities, damage, artwork and unrelated fields remain intact. New embedded weapon/shield copies start stowed, including drops of already equipped source items; world-directory/compendium records are not changed by this rule.
- Existing actors are not rewritten when loading the world. Old invalid hand combinations stay saved until an intentional equipment edit; attacks require correcting them. Armor remains independently equippable. Inventory and defenses recompute from the resulting equipped gear as before.
- Versatile weapons are equipped as one-handed. Choosing two hands for an attack requires that second hand to be free. Stow the shield/other held weapon first; Strapped remains compatible. Weapon swaps keep their existing free/manual AP handling; Minor action/Quickdraw swap AP costs are not added here.

No actor/item schema fields were renamed, removed or added. Compatibility uses existing equipment flags/properties; there is no migration or automatic world-data cleanup. Batched updates are one client request, not a cross-client locking system.

<a id="token-attacks-validation"></a>
### Validation

Automated tests cover ordinary/Light/Strapped/shield/two-hand combinations, deterministic conflict stowing, item-operation cancellation/creation and property changes, unchanged unrelated data, stale weapons, explicit target selection, equipped-only choosers, cancellation, ownership, token permission boundaries, modifier clicks and duplicate dialogs. Existing attacks, defenses, rolls and model tests run with `node --test`.

The PR records real Foundry checks and limits. Before merging, test one-handed + shield, two Light weapons, Strapped + held gear and a two-handed swap using both the inventory and item editor. Select an owned token, Alt-click an enemy/player token, and confirm the attack names that target. Check double-click sheet access, a cancelled attack, multi-selection, unlinked tokens, player permissions and phone layout. Apply damage/Health manually.

<a id="command-delivery"></a>
## Command recipients and AP

**Character → Command** now lists sidebar characters first, labeled **Aldrich · Character**. Unlinked encounter actors remain separately selectable as **Aldrich · Token copy · Scene · token ID**. Linked combatants do not duplicate their sidebar actor. Selection carries the exact recipient UUID; the card, success notice and Receive tooltip identify which character/copy receives the offer.

Previously, encounter actors came first and every option showed only the name. That allowed a Command meant for the sidebar sheet to reach a separate same-name token copy. Foundry's ActorDelta can preserve the token's separate Command balance while continuing to inherit ordinary AP changes from the sidebar actor. This reproduces the user's screenshots: the token reports 17 + 5 = 22 while the sidebar shows 17; after spending 6 ordinary AP on the sidebar, the token reports 11 + 5 = 16 while the sidebar shows 11. Offline native v14.365 ActorDelta merge checks reproduce this behavior. The user's exact live token data was not inspected or changed.

<a id="command-delivery-amount-and-spending"></a>
### Amount and spending

Notion's [Charisma](https://app.notion.com/p/351c72092efb81e78d5ae82a2cf5cd8c) specifies a fixed 5-own-AP cost and a grant of 2 + CHA modifier, capped at 5. With +0 CHA, the new offer is **2**. Repeated grants keep the highest remaining amount instead of adding. If a recipient already has 5, the notice now says **offered 2 Command AP; kept existing 5**, distinguishing the new offer from that older balance. There is no new 5-AP grant from +0 CHA.

For the chosen character at 17 ordinary AP, a fresh 2-AP grant displays **19 / 17**, with **Includes 2 Command AP**. A 6-AP ability payment uses 2 Command + 4 ordinary AP, leaving **13 / 17**. The normal maximum stays 17. Outside combat the grant is usable immediately; during combat it is usable on the recipient's own turn. The website's AP payment code was rechecked for spending the separate grant first; no payment formula changed here.

Owned-recipient delivery verifies the saved balance and receipt. The active GM handles cross-owner delivery; the recipient can retry from chat. Invalid/cancelled offers report errors, and Receive buttons update only after actual receipt. Previously received cards do not refill spent grants. Old cards retain their original recipient; this update never transfers old grants or rewrites saved balances.

<a id="command-delivery-validation-and-user-check"></a>
### Validation and user check

`node --test`: **342 passed**. New regressions cover same-name sidebar/token choices with an existing 5-point token grant, exact UUID selection, +0 CHA offering 2, explicit token selection, linked-actor deduplication, retained-higher notices and spending 2 Command before 4 ordinary AP outside combat/on the recipient's turn.

Offline actual v14.365 schemas, native ActorDelta merge and strict templates reproduce the mismatch, then verify 19/17 → 13/17 on the chosen sidebar character while the token remains independent. Document updates/network use adapters. Isolated browser checks at 760/390/340 px confirm the sidebar option is selected by default, token labels differ, and the 44 px picker has no horizontal overflow. No live actor data was modified.

Not yet confirmed in the running world: the corrected picker, socket delivery, cross-owner permissions and live spending. Restart Foundry and refresh player browsers. Make a new offer and select **Aldrich · Character** for the Actors sidebar sheet. Confirm the card names Character, the notice says received 2, the sheet shows 19/17, and a 6-AP ability leaves 13/17. If testing the map copy instead, select its Token copy entry and open that exact token's sheet. An older 5-point grant remains until spent, expired or manually corrected using the existing controls; it is not erased on load.

<a id="turn-refills"></a>
## Start-of-turn resources

First small part of roadmap step 5, version 0.10.1. Checked on 2026-11-01 against Notion [Action Points](https://www.notion.so/406c72092efb81a491b3e7dc50e9ba73) and [Defenses](https://www.notion.so/406c72092efb81088e3be6e9d3b2c44d). AP is available each turn, and reactions explicitly return at the start of your turn. The website's `js/encounter-actions.js` `startTurn` also restores the current actor's AP; Foundry supplies the encounter lifecycle here.

<a id="turn-refills-behavior"></a>
### Behavior

- Starting combat refills the first character's AP and reactions. Advancing to another character, wrapping a round or advancing a one-character encounter refills the incoming character to its current prepared maxima, including manual maxima and effective-AGL reaction milestones.
- Already-full pools are left alone, without a write or warning. If a refill is needed, only `system.ap.value` and `system.reactions.value` are updated, together. Written refill values are numbers captured at that time. An already-full pool retains its existing stored value (including the full-pool `null` sentinel). Health, Wonder, mana/custom pools, loaded shots, quantities, overrides and stats are untouched.
- The handler uses native `combatTurnChange`, which the installed Foundry 14.365 source emits after the active GM finishes turn-start effects. Only `game.user.isActiveGM` writes the update, preventing each connected client from refilling separately. One GM must be connected for automatic refills; otherwise correct pools manually.
- A round/turn must move forward, and the event's combatant/round/turn must still match the current combat. Setup, ordinary page load, initiative-only edits/reordering, rewind and ended combat do not refill. If turns/rounds are jumped over, only the final current actor refills. A rewind itself does nothing; advancing forward again is a new turn start and refills again. The tracker remains editable.
- Native `combat.combatant.actor` resolves linked and unlinked token actors. The handler updates that actor directly, so an unlinked token does not refill its world actor or other tokens. Multiple combatants sharing a linked actor share that actor's resources as Foundry normally does.
- Refills share the actor action queue used for attacks/reloads/consumables. Concurrent duplicate start events on one client coalesce; queued work rechecks the turn and skips stale work if the tracker has already moved on. Current maxima are read when the update runs. This is not a server transaction with manual edits or other clients.
- Foundry can return no updated document when a diff is empty. That is accepted when the requested AP/reaction values are already satisfied; it is not automatically treated as cancellation.
- Failed or cancelled updates show a GM-facing error asking for manual correction. No success message or false refill is reported, and the native turn lifecycle is not rejected by the handler.

No data fields, Combat subclasses, UI layout, catalog contents, automatic damage or restrictions are added. Reaction spending/Block/Dodge/Parry, opportunity attacks, Command, potion AP costs and free Surge movement remain later parts of combat flow/movement. This refill does not add Surge's movement-only AP to the normal AP pool.

<a id="turn-refills-validation"></a>
### Validation

`node --test` covers first turn, next turn, round wrap, a one-character encounter, current/zero maxima, active-GM gating, setup/rewind/reorder/stale events, unlinked actor resolution, duplicate concurrent events, action-queue ordering, stale queued work and failed/cancelled updates, repeated already-full rounds, empty update responses and a single depleted pool. The source of Foundry 14.365 `Combat#_manageTurnEvents` and `#_onStartTurn` was inspected to verify that the GM hook follows effect refresh.

Not tested by Codex in a running world: actual combat tracker event dispatch and timing, expiring Active Effects, cross-client propagation, GM reconnection, and native linked/unlinked token synchronization. Adapter tests use simulated events/documents and do not prove those live behaviors.

<a id="turn-refills-in-world-checklist"></a>
### In-world checklist

- [ ] Restart Foundry and refresh browsers; confirm version 0.10.1. Have one GM connected.
- [ ] Put two characters with spent AP/reactions in combat, plus a depleted Health/Wonder pool. Start combat: only the first character's AP/reactions refill. Advance: only the incoming character refills. Health/Wonder stay spent.
- [ ] Advance through a round and a one-character encounter. Check level-based AP, AGL 21/28 reaction maxima and overrides including zero. Spent current values should match the maximum at turn start.
- [ ] Rewind, edit initiative, switch viewed combat, and refresh the browser: no extra refill. Advancing forward starts a turn and refills again. A multi-round jump refills only the final current actor.
- [ ] Check an unlinked token: its pools refill while its base world actor and another token keep their current values. Repeat with linked tokens.
- [ ] Connect another GM and a player. Each turn must cause one refill, with updates visible to owners. Spend AP immediately after the turn change: it must remain spent.
- [ ] Test a temporary effect affecting a resource maximum that expires at turn start; the refill should use the resulting maximum. Test manual corrections after the refill.

Wait for this turn-start behavior to be tested before adding reaction actions or Command.

When testing, open the sheet belonging to the actor in the tracker. A different actor (for example Orion open while aldrich takes the turn) will not be refilled.

<a id="action-review"></a>
## Review of the inventory, catalog and attack additions

Reviewed merged main through PR #13 (`c3804fe`) on 2026-11-01. Claude added inventory/consumables, catalog import, single/dual weapon attacks, loading/reload and live disadvantage controls. The baseline suite had 94 passing tests. Review included the new models, preparation/registration, catalog import, rule helpers and attack/consumable action handlers. This was a source/test review, not a running-world or exhaustive security audit.

<a id="action-review-findings-fixed-in-092"></a>
### Findings fixed in 0.9.2

1. Attack/reload/consumable handlers called ChatMessage.create without `messageMode`, so the selected GM/blind/self mode was not applied. They now capture the selected mode before asynchronous work and pass Foundry v14's creation option. Blind rolls disable interactive evaluation. Damage replies continue to copy the source audience instead of using today's chat setting. Hidden damage/healing content exposes no controls and cannot be acted on through these handlers.
2. Damage and consumable-healing cards marked themselves used before successful dice/Health updates, without recovery. Damage now prepares the roll and content before marking the card, and restores its previous flag if posting fails. Healing restores eligibility if its Health update fails. Flag snapshots are cloned to survive in-place document updates.
3. AP, shots or consumable quantity could remain spent after a failed chat post or intervening update. Successful resource changes now register compensating updates, run in reverse on failure. A cancelled update stops the action. If recovery also fails, an explicit warning asks for manual correction instead of reporting a successful refund.
4. Paragon stat choice took precedence over Thrown, offering STR for a custom thrown Paragon weapon. The user's clarified rule and Notion's Thrown rule require DEX for thrown attacks. Thrown now takes precedence; ranged Paragon still offers STR or DEX.

Local queues serialize attacks/reloads/consumable actions by actor and damage by source message, preventing rapid local clicks from spending the same resources twice or posting duplicate damage. These are not server transactions: concurrent actions from separate clients, manual edits during recovery and disconnects can still require correction. Wonder retains its existing separate queue. No schema migration, catalog refresh, new gameplay restriction or existing field change is introduced.

<a id="action-review-validation-and-next-work"></a>
### Validation and next work

Tests now exercise the action handlers: all four visibility modes, blind evaluation, source-audience damage replies, attack/reload/item refunds, cancelled spending, damage roll/render/post failures, healing retry, rapid duplicate clicks, insufficient AP after a queued action and failed recovery. The original rule/catalog/inventory tests remain in place. API options were verified in the installed Foundry 14.365 ChatMessage source.

Not tested by Codex in a running world: actual private/blind rendering, GM/player permissions, native dice interactions, chat rerender during recovery, cross-client updates and combat tracker behavior.

Before adding combat flow, test:

- [ ] Restart Foundry and refresh browsers; confirm version 0.9.2.
- [ ] Attack, reload and use a healing consumable with public/GM/blind/self chat modes from GM/player clients. Confirm audience and hidden totals/actions. Follow-up damage keeps its source audience after changing the chat setting.
- [ ] Verify ordinary attacks still spend AP/shots exactly once; two-Light-weapon attacks retain one AP cost and separate damage buttons.
- [ ] Use a consumable and apply healing once. Confirm quantity and Health changes are correct and the second click does nothing.
- [ ] Try repeated fast damage/action clicks. Reload and confirm used flags and resources remain correct.

The user merged and approved these review fixes. Start-of-turn AP/reaction refill is now implemented in [TURN-REFILLS.md](COMBAT.md#turn-refills), awaiting testing before reaction actions and Command. Drinking-potion AP integration also remains future combat-flow work; this review preserves the current consumable gameplay costs.

### Updated weapon damage rules

Off-hand hits deal full rolled dice damage without a stat modifier or mount bonus. A Versatile weapon held in two hands uses its larger die. Only the Two-handed property halves Armor Rating, and Versatile Puncture still applies its flat reduction of 2. Overwhelming Force retains its floor of half the original roll through Resistance, Armor Rating, Block and Parry. Dodge and immunity still apply.
