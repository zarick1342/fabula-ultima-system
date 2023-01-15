/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class FabulaUltimaItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /**
   * Prepare a data object which is passed to any Roll formulas which are created related to this Item
   * @private
   */
   getRollData() {
    // If present, return the actor's roll data.
    if ( !this.actor ) return null;
    const rollData = this.actor.getRollData();
    // Grab the item's system data as well.
    rollData.item = foundry.utils.deepClone(this.system);

    return rollData;
  }

  getWeaponDisplayData() {
    if(this.type !== "weapon") {
      return false;
    }

    const hands = this.system.hands.value === 1 ? "One-Handed" : "Two-Handed";
    const qualText = this.quality ? this.quality : "No Quality.";
    const qualityString = `${hands} ⬩ ${this.system.type.value} ⬩ ${qualText}`;
    let attackString = `【${this.system.attributes.primary.value.toUpperCase()} + ${this.system.attributes.secondary.value.toUpperCase()}】`;
    if(this.system.accuracy.value > 0) {
      attackString += ` +${this.system.accuracy.value}`;
    }
    const damageString = `【HR + ${this.system.damage.value}】${this.system.damageType.value}`;

    return {
      attackString,
      damageString,
      qualityString
    }
  }

  async getSingleRollForItem(usedItem = null, addName = false) {
    const item = usedItem ?? this;
    let content = '';

    const hasDamage = item.type === 'weapon' || (['spell', 'skill', 'miscAbility'].includes(item.type) && item.system.rollInfo?.damage?.hasDamage?.value);

    const attrs = item.type === 'weapon' ? item.system.attributes : item.system.rollInfo.attributes;
    let accVal = item.type === 'weapon' ? item.system.accuracy.value : item.system.rollInfo.accuracy.value;
    accVal = accVal ?? 0;

    const primary = this.actor.system.attributes[attrs.primary.value].current;
    const secondary = this.actor.system.attributes[attrs.secondary.value].current;
    const roll = new Roll("1d@prim + 1d@sec + @mod", {prim: primary, sec: secondary, mod: accVal});
    await roll.evaluate();

    const bonusAccVal = usedItem ? this.system.rollInfo.accuracy.value : 0;
    const bonusAccValString = bonusAccVal ? ` + ${bonusAccVal} (${this.type})` : '';

    const acc = roll.total + bonusAccVal;
    const diceResults = roll.terms.filter((term) => term.results).map((die) => die.results[0].result);
    const hr = this.system.rollInfo && this.system.rollInfo.useWeapon?.hrZero?.value ? 0 : Math.max(...diceResults);
    const isCrit = diceResults[0] === diceResults[1] && diceResults[0] >= 6;

    const accString = `${diceResults[0]} (${attrs.primary.value.toUpperCase()}) + ${diceResults[1]} (${attrs.secondary.value.toUpperCase()}) + ${accVal} (${item.type})${bonusAccValString}`;
    const critString = isCrit ? "<strong>Critical hit!</strong><br />" : "";

    if(addName) {
      content += `<strong>${item.name}</strong><br />`;
    }

    content += `<strong>Accuracy:</strong> <span data-tooltip="${accString}">${acc}</span><br />${critString}`;

    if(hasDamage) {
      let damVal = item.type === 'weapon' ? item.system.damage.value : item.system.rollInfo.damage.value;
      damVal = damVal ?? 0;

      const bonusDamVal = usedItem ? this.system.rollInfo.damage.value : 0;
      const bonusDamValString = bonusDamVal ? ` + ${bonusDamVal} (${this.type})` : '';

      const damage = hr + damVal + bonusDamVal;
      const damType = item.type === 'weapon' ? item.system.damageType.value : item.system.rollInfo.damage.type.value;
      const damString = `${hr} (HR) + ${damVal} (${item.type})${bonusDamValString}`;

      content += `<strong>Damage:</strong> <span data-tooltip="${damString}">${damage}</span> ${damType}`;
    }

    return content;
  }

  async getRollString() {
    const item = this;
    let content = '';
    const isSpellOrSkill = ['spell', 'skill', 'miscAbility'].includes(item.type);

    const hasRoll = item.type === 'weapon' || (isSpellOrSkill && item.system.hasRoll?.value);

    if(hasRoll) {
      const usesWeapons = isSpellOrSkill && (item.system.rollInfo?.useWeapon?.accuracy?.value || item.system.rollInfo?.useWeapon?.damage?.value);

      if(usesWeapons) {
        const equippedWeapons = item.actor.items.filter((singleItem) => singleItem.type === 'weapon' && singleItem.system.isEquipped?.value);
        const itemContents = [];
        for(let i=0;i<equippedWeapons.length;i++) {
          const data = await this.getSingleRollForItem(equippedWeapons[i], true);
          itemContents.push(data);
          content = itemContents;
        }
      } else {
        content = await this.getSingleRollForItem();
      }
    }

    return content;
  }

  getSpellDataString() {
    const item = this;
    return item.type === 'spell' ? `${item.system.mpCost.value} MP, ${item.system.target.value}, ${item.system.duration.value}` : '';
  }

  getTargetFromNumber(num) {
    if(num <= 6) {
      return 'You <b>or</b> one ally you can see that is present on the scene';
    } else if(num <= 11) {
      return 'One enemy you can see that is present on the scene';
    } else if(num <= 16) {
      return 'You <b>and</b> every ally present on the scene';
    } else {
      return 'Every enemy present on the scene';
    }
  }

  getEffectFromNumber(num, level) {
    const damageVal = level >= 40 ? 40 : level >= 20 ? 30 : 20;

    switch(num) {
      case 1:
        return 'treats their <b>Dexterity</b> and <b>Might</b> dice as if they were one size higher (up to a maximum of <b>d12</b> until the end of your next turn.';
      case 2:
        return 'treats their <b>Insight</b> and <b>Willpower</b> dice as if they were one size higher (up to a maximum of <b>d12</b> until the end of your next turn.';
      case 3:
        return `suffers ${damageVal} <b>air</b> damage.`;
      case 4:
        return `suffers ${damageVal} <b>bolt</b> damage.`;
      case 5:
        return `suffers ${damageVal} <b>dark</b> damage.`;
      case 6:
        return `suffers ${damageVal} <b>earth</b> damage.`;
      case 7:
        return `suffers ${damageVal} <b>fire</b> damage.`;
      case 8:
        return `suffers ${damageVal} <b>ice</b> damage.`;
      case 9:
        return `gains Resistance to <b>air</b> and <b>fire</b> damage until the end of the scene.`;
      case 10:
        return `gains Resistance to <b>bolt</b> and <b>ice</b> damage until the end of the scene.`;
      case 11:
        return `gains Resistance to <b>dark</b> and <b>earth</b> damage until the end of the scene.`;
      case 12:
        return 'suffers <b>enraged</b>.';
      case 13:
        return 'suffers <b>poisoned</b>.';
      case 14:
        return 'suffers <b>dazed</b>, <b>shaken</b>, <b>slow</b>, and <b>weak</b>.';
      case 15:
        return 'recovers from all status effects.';
      case 16:
      case 17:
        return 'recovers 50 Hit Points and 50 Mind Points.';
      case 18:
        return 'recovers 100 Hit Points.';
      case 19:
        return 'recovers 100 Mind Points.';
      case 20:
        return 'recovers 100 Hit Points and 100 Mind Points.'
    }
  }

  async getAlchemyString() {
    const item = this;
    let string = '';
    const level = item.actor.system.level.value;
    if(item.type === 'miscAbility' && item.name.includes('Alchemy')) {
      const numRolls = item.name.includes("Superior") ? 4 : item.name.includes("Advanced") ? 3 : 2;
      const shouldTrim = item.name.includes("(smart)");
      const rollParts = [];
      for(let i=0;i<numRolls;i++) {
        rollParts.push("1d20");
      }
      const roll = new Roll(rollParts.join(" + "), {});
      await roll.evaluate();
      const diceResults = roll.terms.filter((term) => term.results).map((die) => die.results[0].result);

      const allEffects = [];
      const allEffectsOutput = [];

      diceResults.forEach((num, i) => {
        const thisResultEffects = [];
        const thisResultOutput = [];
        const target = this.getTargetFromNumber(num);
        const isFriends = target.includes("ally");
        if(!shouldTrim || !isFriends) {
          const damEffect = `${target} suffers 20 <b>poison</b> damage.`
          thisResultEffects.push(damEffect);
          thisResultOutput.push({
            combo: `${num}+Any`,
            effect: damEffect
          });
        }
        const healEffect = `${target} recovers 30 Hit Points.`
        thisResultEffects.push(healEffect);
        thisResultOutput.push({
          combo: `${num}+Any`,
          effect: healEffect
        });

        const otherResults = [...diceResults];
        otherResults.splice(i, 1);

        otherResults.forEach((res) => {
          const effect = `${target} ${this.getEffectFromNumber(res, level)}`;
          const effectForFriends = !effect.includes("suffers");
          const effectForFoes = !effect.includes("treats") && !effect.includes("gains") && !effect.includes("recovers from");
          const shouldInclude = !shouldTrim || (isFriends && effectForFriends) || (!isFriends && effectForFoes);
          if(!thisResultEffects.includes(effect) && shouldInclude) {
            thisResultEffects.push(effect);
            thisResultOutput.push({
              combo: `${num}+${res}`,
              effect
            });
          }
        });

        thisResultOutput.forEach((effect) => {
          if(!allEffects.includes(effect.effect)) {
            allEffects.push(effect.effect);
            allEffectsOutput.push({
              combo: effect.combo,
              effect: effect.effect
            });
          }
        });
      });

      string += `Rolls: ${diceResults.join(' ')}<br /><br />`;
      string += `<b>Possible Effects:</b><table><tr><th>Combo</th><th>Effect</th></tr>`;
      allEffectsOutput.forEach((effect) => {
        string += `<tr><td style="width:65px;">${effect.combo}</td><td>${effect.effect}</td></tr>`;
      });
      string += '</table>';
    }

    return string;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      const desc = item.system.description ?? '';
      const attackData = await this.getRollString();
      const spellString = this.getSpellDataString();
      const alchemyString = await this.getAlchemyString();

      const attackString = Array.isArray(attackData) ? attackData.join("<br /><br />") : attackData;

      let content = [spellString, desc, attackString, alchemyString].filter(part => part).join('<hr />');

      content = content ? `<hr />${content}` : '';

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.item.formula, rollData);
      // If you need to store the value first, uncomment the next line.
      // let result = await roll.roll({async: true});
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }
}
