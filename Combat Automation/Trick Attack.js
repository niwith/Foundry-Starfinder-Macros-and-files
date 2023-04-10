const clickEvent = event;
game.macros.getName("CombatAutomationHelpers").execute();

const target = combatAutomationHelpers.getSingleTarget();
if (!target) return;

const canTrickAttack = combatAutomationHelpers.checkTokenHasAnyFeatureByNames(token, ["Trick Attack (Ex)", "Sniper"]);
if (!canTrickAttack) return;

const trickAttackFeature = token.actor.items.find(item => item.name === "Trick Attack (Ex)");
const sniperFeature = token.actor.items.find(item => item.name === "Sniper");

const trickAttackWeaponFilter = (weapon) => 
  (!weapon.system.properties.unwieldy || (weapon.system.weaponType == "sniper" && sniperFeature)) // can't be an unwieldy weapon, unless its a sniper 
  && (
    (weapon.system.weaponType == "basicM" && weapon.system.properties.operative) // operative melee weapons
    || weapon.system.weaponType == "smallA" // all small arms are valid
    || (weapon.system.weaponType == "sniper" && sniperFeature) // snipers can be valid if certain class features picked
  );

const selectedWeapon = await combatAutomationHelpers.selectWeaponAsync(token, trickAttackWeaponFilter);
if (!selectedWeapon) return;

const weaponCanAttack = combatAutomationHelpers.checkWeaponCanAttack(selectedWeapon);
if (!weaponCanAttack) return;

const validTrickAttackSkills = ["ste", "blu", "int"];
const operativeSpecialization = token.actor.items.find(item => item.system.source === "Specialization");
if (operativeSpecialization) {
  operativeSpecialization.system.modifiers
    .filter(modifier => modifier.effectType === "skill-ranks" && modifier.modifierType === "constant") // Shouldn't actually be any other effects but just to be safe
    .forEach(modifier => validTrickAttackSkills.push(modifier.valueAffected))
}
const trickSkillId = await combatAutomationHelpers.getSkillToUseAsync(token, validTrickAttackSkills);

const completedRoll = await token.actor.rollSkill(trickSkillId);
await combatAutomationHelpers.waitForDiceRollAsync();
const rollResult = completedRoll.callbackResult.total;

const targetDetails = target.actor.system.details;
const targetDC = 20 + (targetDetails.cr ? targetDetails.cr : targetDetails.level.value);

const trickAttackSucceeded = rollResult >= targetDC;

await combatAutomationHelpers.simpleChatMessage("Trick Attack", `Trick attack was ${trickAttackSucceeded ? "successful" : "not successful"}`)

if (trickAttackSucceeded) {
  if (trickAttackFeature) await trickAttackFeature.setActive(true);
  if (sniperFeature) await sniperFeature.setActive(true);
}

const targetAlreadyFlatFooted = target.actor.hasCondition("flat-footed");

if (trickAttackSucceeded && !targetAlreadyFlatFooted) {
  await combatAutomationHelpers.requestApplyConditionStateAsync(target, "flat-footed", true, "trick attack was successful");
}

await combatAutomationHelpers.makeSingleAttackAsync(selectedWeapon, target, clickEvent);

// TODO: Check if operative has class feature letting them keep flat footed applied to enemies
if (!targetAlreadyFlatFooted && trickAttackSucceeded && target.actor.hasCondition("flat-footed")) {
  await combatAutomationHelpers.requestApplyConditionStateAsync(target, "flat-footed", false, "trick attack complete");
}

if (trickAttackFeature) await trickAttackFeature.setActive(false);
if (sniperFeature) await sniperFeature.setActive(false);
