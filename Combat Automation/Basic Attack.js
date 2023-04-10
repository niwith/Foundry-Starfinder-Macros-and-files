const clickEvent = event;
game.macros.getName("CombatAutomationHelpers").execute();

const target = combatAutomationHelpers.getSingleTarget();
if (!target) return;

const weapon = await combatAutomationHelpers.selectWeaponAsync(token);
if (!weapon) return;

await combatAutomationHelpers.makeSingleAttackAsync(weapon, target, clickEvent);
