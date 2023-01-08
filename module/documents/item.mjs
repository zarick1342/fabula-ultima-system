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

  async getSingleRollForItem() {
    const item = this;
    let content = '';

    const hasDamage = item.type === 'weapon' || (['spell', 'skill'].includes(item.type) && item.system.rollInfo?.damage?.hasDamage?.value);

    const attrs = item.type === 'weapon' ? item.system.attributes : item.system.rollInfo.attributes;
    let accVal = item.type === 'weapon' ? item.system.accuracy.value : item.system.rollInfo.accuracy.value;
    accVal = accVal ?? 0;

    const primary = this.actor.system.attributes[attrs.primary.value].current;
    const secondary = this.actor.system.attributes[attrs.secondary.value].current;
    const roll = new Roll("1d@prim + 1d@sec + @mod", {prim: primary, sec: secondary, mod: accVal});
    await roll.evaluate();

    const acc = roll.total;
    const diceResults = roll.terms.filter((term) => term.results).map((die) => die.results[0].result);
    const hr = Math.max(...diceResults);
    const isCrit = diceResults[0] === diceResults[1] && diceResults[0] >= 6;

    const accString = `${diceResults[0]} (${attrs.primary.value.toUpperCase()}) + ${diceResults[1]} (${attrs.secondary.value.toUpperCase()}) + ${accVal} (${item.type})`;
    const critString = isCrit ? "<strong>Critical hit!</strong><br />" : "";

    content = `<strong>Accuracy:</strong> <span data-tooltip="${accString}">${acc}</span><br />${critString}`;

    if(hasDamage) {
      let damVal = item.type === 'weapon' ? item.system.damage.value : item.system.rollInfo.damage.value;
      damVal = damVal ?? 0;
      const damage = hr + damVal;
      const damType = item.type === 'weapon' ? item.system.damageType.value : item.system.rollInfo.damage.type.value;
      const damString = `${hr} (HR) + ${damVal} (${item.type})`;

      content += `<strong>Damage:</strong> <span data-tooltip="${damString}">${damage}</span> ${damType}`;
    }

    return content;
  }

  async getRollString() {
    const item = this;
    let content = '';
    const isSpellOrSkill = ['spell', 'skill'].includes(item.type);

    const hasRoll = item.type === 'weapon' || (isSpellOrSkill && item.system.hasRoll.value);

    if(hasRoll) {
      const usesWeapons = isSpellOrSkill && (item.system.rollInfo?.useWeapon?.accuracy?.value || item.system.rollInfo?.useWeapon?.damage?.value);

      if(usesWeapons) {
        const equippedWeapons = item.actor.items.filter((singleItem) => singleItem.type === 'weapon' && singleItem.system.isEquipped?.value);
        itemContents = [];
        for(let i=0;i<equippedWeapons.length;i++) {
          // const data = await this.getSingleRollForItem();
          // itemContents.push(data);
          // content = itemContents
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
      const attackString = await this.getRollString();
      const spellString = this.getSpellDataString();

      let content = [spellString, desc, attackString].filter(part => part).join('<hr />');

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
