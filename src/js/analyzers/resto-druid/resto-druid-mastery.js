

class RestoDruidMasteryAnalyzer {
	
	constructor(playerInfo) {	
		this.playerId = playerInfo.sourceID;
		
		// constants to turn mastery rating into mastery strength
		this.baseMasteryPercent = 4.8;
		this.masteryRatingPerOne = 666.6;
		
		this.baseMasteryRating = playerInfo.mastery;
		
		// these are the spells that can be boosted by Mastery
		this.druidHeals = new Map();
		this.druidHeals.set(8936, "Regrowth");
		this.druidHeals.set(774, "Rejuvenation");
		this.druidHeals.set(155777, "Germination");
		this.druidHeals.set(48438, "Wild Growth");
		this.druidHeals.set(207386, "Spring Blossoms");
		this.druidHeals.set(200389, "Cultivation");
		this.druidHeals.set(102352, "Cenarion Ward");
		this.druidHeals.set(33763, "Lifebloom");
		this.druidHeals.set(22842, "Frenzied Regeneration");
		this.druidHeals.set(5185, "Healing Touch"); // y u casting it tho?
		this.druidHeals.set(18562, "Swiftmend");
		// Living Seed doesn't directly benefit, but does through Regrowth.
		// Including it on its own is technically wrong because it might heal with
		// a different number of HoTs present than the Regrowth that spawned it.
		// However, this is still a reasonable approximation.
		this.druidHeals.set(48503, "Living Seed");
		this.druidHeals.set(157982, "Tranquility");
		this.druidHeals.set(81269, "Effloresence");
		this.druidHeals.set(189853, "Dreamwalker");
		this.druidHeals.set(189800, "Nature's Essence");
		this.druidHeals.set(33778, "Lifebloom Bloom");
		this.druidHeals.set(253432, "Dreamer (T21)");
		// Ysera's Gift and Renewal don't benefit from Mastery,
		// presumably because they already scale with your max health.
		
		// these are the spells that cause Mastery boosting
		this.hots = new Map();
		this.hots.set(8936, "Regrowth");
		this.hots.set(774, "Rejuvenation");
		this.hots.set(155777, "Germination");
		this.hots.set(48438, "Wild Growth");
		this.hots.set(207386, "Spring Blossoms");
		this.hots.set(200389, "Cultivation");
		this.hots.set(102352, "Cenarion Ward");
		this.hots.set(33763, "Lifebloom");
		this.hots.set(22842, "Frenzied Regeneration"); // yes, it actually counts towards mastery -_-
		this.hots.set(253432, "Dreamer (T21)");
		
		this.hotsOnTarget = new Map(); // map from player ID to a set of hot IDs
		
		this.totalHealing = 0; // total healing from all spells
		this.totalNoMasteryHealing = 0; // total healing before mastery
		this.druidSpellNoMasteryHealing = 0; // total healing before mastery from spells that benefit from mastery
		this.masteryTimesHealing = 0; // for calculating avg mastery stacks
		
		// these are the hots to track, with healing attributable directly and by mastery
		this.hotHealingMap = new Map(); // map from hot ID to obj w/ direct healing and mastery healing
		for(let [hotId, hotName] of this.hots.entries()) {
			this.hotHealingMap.set(hotId, {'name':hotName ,'direct':0, 'mastery':0});
		}
		
		// these are common mastery procs to track
		this.masteryBuffs = new Map(); // map from buff ID to obj with buff name and buff strength
		this.masteryBuffs.set(232378, {'amount':4000, 'name':'T19 2pc', 'attributableHealing':0});
		this.masteryBuffs.set(224149, {'amount':3000, 'name':"Jacin's Ruse", 'attributableHealing':0});	
		// TODO: any other common buffs to add? What will I do about varying buff strength by item ilevel?
		for(let[buffId, buffObj] of this.masteryBuffs.entries()) {
			buffObj.attributableHealing = 0;
			buffObj.active = false;
		}
		
	}
	
	parse(wclEvent) {
		if(wclEvent.type === 'combatantinfo') {
			this.combatantInfo(wclEvent);
		}
		 
		if(wclEvent.sourceID !== this.playerId) {
			return;
		}
		
		switch( wclEvent.type ) {
			case 'applybuff' :
				this.applyBuff(wclEvent);
				break;
			case 'removebuff' :
				this.removeBuff(wclEvent);
				break;
			case 'heal' :
				this.heal(wclEvent);
				break;
			case 'absorbed' :
				this.absorbed(wclEvent);
				break;
			default :
		}
	}
	
	combatantInfo(wclEvent) {	
		let targetId = wclEvent.sourceID; // aura's target is combatantinfo source
		
		// handle prehots and pre-procs
		for(let aura of wclEvent.auras) {
			let spellId = aura.ability;
			let sourceId = aura.source; // aura's source is tracked here
			// if player was buff's source
			if(sourceId == this.playerId) {
				if(this.hots.has(spellId)) { // prehot
					this.addSetIfAbsent(targetId);
					this.hotsOnTarget.get(targetId).add(spellId);
					console.log("Player ID " + targetId + " prehotted with " + this.hots.get(spellId));
				} else if(this.masteryBuffs.has(spellId)) { // pre-proc
					this.masteryBuffs.get(spellId).active = true;
				}
			}
		}
	}
	
	applyBuff(wclEvent) {
		let targetId = wclEvent.targetID;
		let spellId = wclEvent.ability.guid;
		
		if(this.hots.has(spellId)) { // add hot to target
			this.addSetIfAbsent(targetId);
			this.hotsOnTarget.get(targetId).add(spellId);
		} else if(this.masteryBuffs.has(spellId)) { // add mastery buff to self
			this.masteryBuffs.get(spellId).active = true;
		}
	}
	
	removeBuff(wclEvent) {
		let targetId = wclEvent.targetID;
		let spellId = wclEvent.ability.guid;
		
		// remove hot from target
		if(this.hots.has(spellId)) { // remove hot from target
			this.addSetIfAbsent(targetId);
			this.hotsOnTarget.get(targetId).delete(spellId);
		} else if(this.masteryBuffs.has(spellId)) { // remove mastery buff from self
			this.masteryBuffs.get(spellId).active = false;
		}
	}
	
	heal(wclEvent) {
		let targetId = wclEvent.targetID;
		let spellId = wclEvent.ability.guid;
		
		let amount = wclEvent.amount; // doesn't include overheal
		if(wclEvent.absorbed !== undefined) { // absorbed healing is effective healing
			amount += wclEvent.absorbed;
		}
		
		this.totalHealing += amount;
		
		if(this.hotHealingMap.has(spellId)) {
			this.hotHealingMap.get(spellId).direct += amount;
		}
		
		this.addSetIfAbsent(targetId);
		if(this.druidHeals.has(spellId)) { // spell was boosted by mastery
			let hotsOn = this.hotsOnTarget.get(targetId);
			let numHotsOn = hotsOn.size;
			let healDetails = this.getHealDetails(amount, numHotsOn);

			this.totalNoMasteryHealing += healDetails.noMastery;
			this.druidSpellNoMasteryHealing += healDetails.noMastery;
			this.masteryTimesHealing += healDetails.noMastery * numHotsOn;
			
			// give each HoT credit for mastery boosting
			for(let hotOn of hotsOn) {
				if(hotOn != spellId) { // prevents double count
					this.hotHealingMap.get(hotOn).mastery += healDetails.oneStack;
				}
			}
			
			// attribute healing to mastery buffs that are present
			for(let[buffId, buffObj] of this.masteryBuffs.entries()) {
				if(buffObj.active) {
					let attribHealing = this.getBuffMasteryHealing(
							healDetails, buffObj.amount);
					buffObj.attributableHealing += attribHealing;
				}
			}
			
		} else { // spell not boosted by mastery
			this.totalNoMasteryHealing += amount;
		}
		
		
	}
	
	absorbed(wclEvent) {
		// absorbs don't interact with mastery, but they do count towards total healing
		this.totalHealing += wclEvent.amount;
		this.totalNoMasteryHealing += wclEvent.amount;
	}
	
	
	
	//// HELPERS FUNCTIONS ////
	
	// helper for hotsOnTarget adds new set to mapping value if not there for target
	addSetIfAbsent(targetId) {
		if(!this.hotsOnTarget.has(targetId)) {
			this.hotsOnTarget.set(targetId, new Set());
		}
	}
	
	// gets heal broken down by mastery amounts
	getHealDetails(healAmount, hotCount) {
		let masteryRating = this.baseMasteryRating;
		for(let masteryBuff of this.masteryBuffs.values()) {
			if(masteryBuff.active) {
				masteryRating += masteryBuff.amount;
			}
		}
		
		let masteryBonus = (this.baseMasteryPercent + (masteryRating / this.masteryRatingPerOne)) / 100;
		
		let healMasteryMultiply = 1 + (hotCount * masteryBonus);
		
		// TODO why round here, why not later?
		let noMasteryHealing = Math.round(healAmount / healMasteryMultiply);
		let oneStackMasteryHealing = Math.round(healAmount / (healMasteryMultiply / masteryBonus));
		
		return {'noMastery':noMasteryHealing, 'oneStack':oneStackMasteryHealing,
				'total':healAmount, 'count':hotCount};
	}
	
	// the amount of healing attributable to a mastery buff
	getBuffMasteryHealing(healDetails, buffAmount) {
		let masteryBonusFromBuff = (buffAmount / this.masteryRatingPerOne) / 100;
		return Math.round(healDetails.noMastery * masteryBonusFromBuff * healDetails.count);
	}
	
	
	
	//// RESULT BUILDER ////
	
	getResult() {
		let avgTotalMasteryStacks = this.masteryTimesHealing / this.totalNoMasteryHealing;
		let avgDruidSpellMasteryStacks = this.masteryTimesHealing / this.druidSpellNoMasteryHealing;
		
		let bonusFromOneRating = (1 / this.masteryRatingPerOne) / 100;
		let healingFromOneRating =
				this.druidSpellNoMasteryHealing * bonusFromOneRating * avgDruidSpellMasteryStacks;
		
		let result = {};
		result.avgTotalMasteryStacks = avgTotalMasteryStacks;
		result.avgDruidSpellMasteryStacks = avgDruidSpellMasteryStacks;
		result.healingFromOneRating = healingFromOneRating;
		result.hotHealing = this.hotHealingMap;
		result.masteryBuffHealing = this.masteryBuffs;
		result.totalHealing = this.totalHealing;
		return result;
	}
}