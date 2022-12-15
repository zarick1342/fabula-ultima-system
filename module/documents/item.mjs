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
    const label = `[${item.type}] ${item.name}`;

    if(item.type === "weapon") {
      console.log(this.actor);
      const primary = this.actor.system.attributes[item.system.attributes.primary.value].current;
      const secondary = this.actor.system.attributes[item.system.attributes.secondary.value].current;
      const roll = new Roll("1d@prim + 1d@sec + @mod", {prim: primary, sec: secondary, mod: item.system.accuracy.value});
      await roll.evaluate();

      const acc = roll.total;
      const diceResults = roll.terms.filter((term) => term.results).map((die) => die.results[0].result);
      const hr = Math.max(...diceResults);
      const isCrit = diceResults[0] === diceResults[1] && diceResults[0] >= 6;
      const damage = hr + item.system.damage.value;

      let content = `${roll.result}<br />Accuracy: ${acc}, HR: ${hr} Damage: ${damage}`;
      if(isCrit) {
        content += " Critical hit!";
      }

      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content
      });
    }

    // If there's no roll data, send a chat message.
    else if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? ''
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
