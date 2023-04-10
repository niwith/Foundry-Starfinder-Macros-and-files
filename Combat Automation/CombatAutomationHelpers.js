// Very scuffed way of having a common function library between all my macros

class CombatAutomationHelpers {
    getRollWaitTime() {
        return 2600;
    }

    getSingleTarget() {
        const targets = game.user.targets;
        if (targets.size != 1) {
            ui.notifications.warn("Macro requires exactly one selected target");
            return null;
        }
        return targets.first();
    }

    async selectWeaponAsync(token, validFilterPredicate = (weapon) => true) {
        const items = token.actor.items;
        const weapons = items.filter(item => item.type === "weapon");
        const equippedWeapons = weapons.filter(item => item.system.equipped);
        const validWeapons = equippedWeapons.filter(validFilterPredicate);

        if (validWeapons.length === 0) {
            ui.notifications.warn("You have no valid weapons equipped");
            console.log("Valid weapon filter = " + validFilterPredicate);
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
    
    checkTokenHasAnyFeatureByNames(token, featureNames, displayWarning = true) {
        const hasFeature = token.actor.items.filter(item => featureNames.includes(item.name)).length > 0;
        if (displayWarning && !hasFeature) {
            ui.notifications.warn(`${token.name} does not have any of the following features: ${featureNames.join(", ")}`);
        }
        return hasFeature;
    }

    getTokenFeatureByName(token, featureName) {
        return token.actor.items.find(item => item.name === featureName);
    }

    checkWeaponCapacity(weapon, displayWarning = true) {
        if (weapon.hasCapacity && weapon.getCurrentCapacity() < weapon.system.usage.value) {
            if (displayWarning) {
                ui.notifications.warn(game.i18n.format("SFRPG.ItemNoAmmo", { name: weapon.name }));
            } 
            return false;
        }
        
        return true;
    }

    checkWeaponCanAttack(weapon, displayWarning = true) {
        // TODO: add any other required checks in here
        return this.checkWeaponCapacity(weapon, displayWarning);
    }

    async makeSingleAttackAsync(weapon, target, macroRunEvent) {
        const weaponCanAttack = this.checkWeaponCanAttack(weapon);
        if (!weaponCanAttack) {
            return;
        }
    
        const completedAttackRoll = await weapon.rollAttack({ event: macroRunEvent });
        await this.waitForDiceRollAsync();

        const attackRollTotalResult = completedAttackRoll.callbackResult.total;
        const attackRollDiceResult = completedAttackRoll.callbackResult.dice[0].total;
    
        const targetAC = target.actor.system.attributes[weapon.system.actionTarget].value;
    
        const isCrit = attackRollDiceResult == 20;
        const hitTarget = isCrit || (attackRollTotalResult != 1 && attackRollTotalResult >= targetAC);

        this.simpleChatMessage("Basic Attack", `Basic attack was a ${hitTarget ? (isCrit ? "crit" : "hit") : "miss"}`);
    
        if (!hitTarget) {
            return false;
        }
    
        // We always show dialog for crit because user needs to hit the crit button
        // since i have no idea how to force rollDamage to do a crit
        let modifiedDamageMacroRunEvent = macroRunEvent;
        if (isCrit) {
            modifiedDamageMacroRunEvent = { shiftKey: game.settings.get('sfrpg', 'useQuickRollAsDefault') };
        }
    
        const completedDamageRoll = await weapon.rollDamage({ event: modifiedDamageMacroRunEvent });
        await this.waitForDiceRollAsync();
        
        try {
            // TODO: fix bug in rollDamage 
            await this.requestApplyDamage(target, completedDamageRoll.callbackResult.total, "attack hit");
        } catch{
            console.log("Damage should start working once starfinder system updated to fix bug in rollDamage")
        }

        return true;
    }

    async getSkillToUseAsync(token, validSkillIds = null) {
        const tokenSkills = token.actor.system.skills;
        if (validSkillIds === null) {
            validSkillIds = Object.keys(tokenSkills);
        }

        let maxBonus = Number.MIN_VALUE;
        let maxBonusSkillId = null;
        validSkillIds.forEach((skillId) => {
            const skillModifier = tokenSkills[skillId].mod;
            if (skillModifier > maxBonus) {
                maxBonus = skillModifier;
                maxBonusSkillId = skillId;
            }
        });

        return maxBonusSkillId;
    }
    
    async simpleChatMessage(macroName, text) {
        await ChatMessage.create({
            content: `<h2>${macroName}</h2><p>${text}</p>`
        });
    }

    async requestApplyConditionStateAsync(token, conditionId, conditionState, reason) {
        const condition = CONFIG.SFRPG.statusEffects.filter(effect => effect.id === conditionId)[0];
        
        const description = `${game.user.name} requests for ${condition.label} to be ${conditionState ? "applied" : "removed"} ${conditionState ? "to" : "from"} ${token.name} because ${reason}.`;
        const buttonLabel = `${conditionState ? "Apply" : "Remove"} ${condition.label} ${conditionState ? "to" : "from"} ${token.name}`;
        
        if (Requestor) {
            await Requestor.request({
                description: description,
                buttonData: [{
                    label: buttonLabel,
                    permission: "GM",
                    targetTokenId: token.id,
                    conditionId: conditionId,
                    conditionState: conditionState,
                    action: async () => {
                        const targetToken = canvas.tokens.get(this.targetTokenId);
                        if (!targetToken.actor.hasCondition(this.conditionId) && this.conditionState) { // if don't have condition and you want to add
                            await targetToken.actor.setCondition(this.conditionId, true);
                        } else if (targetToken.actor.hasCondition(this.conditionId) && !this.conditionState) { // if has condition and you want to remove
                            await targetToken.actor.setCondition(this.conditionId, false);
                        }
                        // otherwise no changes needed
                    }
                }]
            });
        } else {
            await ChatMessage.create({
                content: description
            });
        }

        await combatAutomationHelpers.waitForPredicateAsync(
            `Waiting for DM to ${conditionState ? "apply" : "remove"} ${condition.label} ${conditionState ? "to" : "from"} ${token.name}`, 
            () => token.actor.hasCondition(conditionId) === conditionState);
    }

    async requestApplyDamage(token, damage, reason) {       
        const description =  `${game.user.name} requests for damage to be applied to ${token.name} because ${reason}.`
        const buttonLabel = `Apply damage to ${token.name}`;
        const totalPreDamageHealth = token.actor.system.attributes.sp + token.actor.system.attributes.hp;
        if (Requestor) {
            await Requestor.request({
                description: description,
                buttonData: [{
                    label: buttonLabel,
                    permission: "GM",
                    targetTokenId: token.id,
                    damage: damage,
                    action: async () => {
                        const targetToken = canvas.tokens.get(this.targetTokenId);
                        targetToken.actor.applyDamage(this.damage);
                    }
                }]
            });
        } else {
            await ChatMessage.create({
                content: description
            });
        }

        await combatAutomationHelpers.waitForPredicateAsync(
            `Waiting for DM to apply damage to ${token.name}`, 
            () =>  token.actor.system.attributes.sp + token.actor.system.attributes.hp < totalPreDamageHealth);
    }

    async waitForPredicateAsync(waitingForDescription, condition) {
        let killWait = false;
        const waitDialog = new Dialog({
            title: "Wait",
            content: waitingForDescription,
            buttons: {
              skipWaiting: {
                label: "Skip Waiting",
                callback: () => killWait = true 
              },
            },
            default: 'skipWaiting',
        });
        waitDialog.render(true);

        while (!killWait) {
            if (condition()) {
                killWait = true;
            }
            await this.wait(100);
        }

        waitDialog.close();
    }

    wait(time) {
        return new Promise(resolve => {
            setTimeout(resolve, time);
        });
    }

    async waitForDiceRollAsync() {
        return await this.wait(this.getRollWaitTime());
    }
}

window.combatAutomationHelpers = new CombatAutomationHelpers();