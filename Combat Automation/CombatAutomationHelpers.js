//#region CombatAutomationHelpers.js functions, paste into your combat automation macro
function getSingleTarget() {
    const targets = game.user.targets;
    if (targets.size != 1) {
        ui.notifications.warn("Macro requires exactly one selected target");
        return null;
    }
    return targets.first();
}

async function selectWeaponAsync(token, validFilterPredicate = (weapon) => true) {
    const items = token.actor.items;
    const equippedWeapons = items.filter(item => item.type === "weapon" && item.config && item.config.hasAttack);
    const validWeapons = equippedWeapons.filter(validFilterPredicate);
    console.log(validFilterPredicate);
    console.log(validWeapons);
    if (validWeapons.length === 0) {
        ui.notifications.warn("You have no valid weapons equipped");
        return null;
    }
    if (validWeapons.length === 1) {
        return validWeapons[0];
    }
    
    const dialogButtons = [];

    let selectedWeapon = null;

    validWeapons.forEach(weapon => dialogButtons.push({
        callback: () => selectedWeapon = weapon,
        icon: '<img src=' + weapon.img + '><br>',
        label: weapon.name
    }));

    await Dialog.wait({
        title: "Select Weapon",
        buttons: dialogButtons,
        default: 0
    });

    return selectedWeapon;
}

async function makeSingleAttackAsync(weapon, target, macroRunEvent) {
    if (weapon.config.hasCapacity && weapon.getCurrentCapacity() < weapon.system.usage.value) {
        ui.notifications.warn(game.i18n.format("SFRPG.ItemNoAmmo", { name: weapon.name }));
        return;
    }

    const completedAttackRoll = await weapon.rollAttack({ event: macroRunEvent });
    await wait(1000);
    const attackRollTotalResult = completedAttackRoll.callbackResult.total;
    const attackRollDiceResult = completedAttackRoll.callbackResult.dice[0].total;

    const targetAC = target.actor.system.attributes[weapon.system.actionTarget].value;

    const isCrit = attackRollDiceResult == 20;
    const hitTarget = isCrit || (attackRollTotalResult != 1 && attackRollTotalResult >= targetAC);

    await ChatMessage.create({
        content: `<h2>Basic Attack</h2><p>Basic attack was a ${hitTarget ? (isCrit ? "crit" : "hit") : "miss"}</p>`
    });

    if (!hitTarget) {
        return false;
    }

    // We always show dialog for crit because user needs to hit the crit button
    // since i have no idea how to force rollDamage to do a crit
    let modifiedDamageMacroRunEvent = macroRunEvent;
    if (isCrit) {
        modifiedDamageMacroRunEvent = { shiftKey: game.settings.get('sfrpg', 'useQuickRollAsDefault') };
    }

    await weapon.rollDamage({ event: modifiedDamageMacroRunEvent });

    return true;
}

function wait(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    });
}
//#endregion