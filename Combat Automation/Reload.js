const clickEvent = event;
game.macros.getName("CombatAutomationHelpers").execute();

const selectedWeapon = await combatAutomationHelpers.selectWeaponAsync(token, (weapon) => weapon.hasCapacity());
if (!selectedWeapon) return;

selectedWeapon.reload();