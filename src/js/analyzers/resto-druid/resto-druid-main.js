/**
 * RESTO DRUID ANALYZER
 *
 * Calculates several not apparent values about a resto druid's benefit from mastery.
 * These include:
 *		- 'Average HoTs' during healing, indicating total mastery benefit
 *		- Mastery benefit conveyed by each resto HoT on all *other* healing
 *		- Effective increase in average healing caused by a few common mastery procs
 */
class RestoDruidAnalyzer {
	
	constructor(playerName, playerInfo, fight, enemyNameMapping) {
		this.debugMode = false;
		
		this.playerName = playerName;
		this.playerInfo = playerInfo;
		this.fight = fight;
		this.enemyNameMapping = enemyNameMapping;
		
		this.druidOrangeColor = 'ff7d0a';
		this.darkGrayColor = '888888';
	
		this.playerId = this.playerInfo.sourceID;
		
		this.baseMasteryRating = playerInfo.mastery;
		this.baseCritRating = playerInfo.critSpell;
		this.baseHasteRating = playerInfo.hasteSpell;
		this.baseVersRating = playerInfo.versatilityHealingDone;
		this.baseInt = playerInfo.intellect;
		
		// you get 5% bonus int for wearing all leather
		// this is accounted for on the base int from combatantinfo,
		// but is not accounted for in the hypothetical one extra int I'm using to generate weights
		this.armorIntMultiplier = 1.05;
		
		this.critMultiplier = 2;
		
		if(playerInfo.gear[14].id === 142170) {
			console.log(playerName + " is wearing Drape of Shame");
			this.critMultiplier += 0.05;
		}
		// TODO handle different mults Tauren, ???
		
		this.totalHealing = 0; // total healing from all spells
		
		/*
		 * A mapping from healing spell ID to the properties of that heal.
		 * int: does this benefit from int?
		 * mastery_boost: does this add a mastery stack?
		 * mastery: does this benefit from mastery?
		 * crit: can this crit?
		 * haste_hpm: is this a HoT that ticks faster with haste?
		 * haste_hpct: can this be cast more with haste? (i.e. non CD spells)
		 * vers: does this benefit from Versatility?
		 */
		this.heals = new Map();
		// RG ticks have 'tick: true', for direct that field is undefined
		this.heals.set(8936, {'name':"Regrowth", // ???? seperate periodic and direct
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':true, 'vers':true
				});
		this.heals.set(774, {'name':"Rejuvenation",
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':true, 'vers':true
				});
		this.heals.set(155777, {'name':"Germination",
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':true, 'vers':true
				});
		this.heals.set(48438, {'name':"Wild Growth",
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(207386, {'name':"Spring Blossoms",
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(200389, {'name':"Cultivation", //TODO is haste_hpct: true a reasonable approx?
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':true, 'vers':true
				});
		this.heals.set(102352, {'name':"Cenarion Ward",
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(33763, {'name':"Lifebloom",
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(22842, {'name':"Frenzied Regeneration", //TODO is mastery: true correct?
				'int':false, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(5185, {'name':"Healing Touch",
				'int':true, 'mastery_boost':false, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':true, 'vers':true
				});
		this.heals.set(18562, {'name':"Swiftmend",
				'int':true, 'mastery_boost':false, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':false, 'vers':true
				});		
		this.heals.set(48503, {'name':"Living Seed", // TODO this one an obvious special case, how to handle?
				'int':true, 'mastery_boost':false, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':true, 'vers':true
				});
		this.heals.set(157982, {'name':"Tranquility",
				'int':true, 'mastery_boost':false, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(81269, {'name':"Effloresence", // TODO does efflo tick faster with haste?
				'int':true, 'mastery_boost':false, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(189853, {'name':"Dreamwalker",
				'int':true, 'mastery_boost':false, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(189800, {'name':"Nature's Essence",
				'int':true, 'mastery_boost':false, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(33778, {'name':"Lifebloom (bloom)",
				'int':true, 'mastery_boost':false, 'mastery':true,
				'crit':true, 'haste_hpm':false, 'haste_hpct':false, 'vers':true
				});
		// Ysera's gift has two spell IDs, one healing on you and one healing on others...
		this.heals.set(145109, {'name':"Ysera's Gift", //TODO does it scale with any of these things?
				'int':false, 'mastery_boost':false, 'mastery':false,
				'crit':false, 'haste_hpm':false, 'haste_hpct':false, 'vers':false
				});
		this.heals.set(145110, {'name':"Ysera's Gift", //TODO does it scale with any of these things?
				'int':false, 'mastery_boost':false, 'mastery':false,
				'crit':false, 'haste_hpm':false, 'haste_hpct':false, 'vers':false
				});
		this.heals.set(108238, {'name':"Renewal", //TODO does it scale with any of these things?
				'int':false, 'mastery_boost':false, 'mastery':false,
				'crit':false, 'haste_hpm':false, 'haste_hpct':false, 'vers':false
				});
		this.heals.set(224392, {'name':"Mark of Shifting", // TOOD does it scale with any of these things?
				'int':false, 'mastery_boost':false, 'mastery':false,
				'crit':false, 'haste_hpm':false, 'haste_hpct':false, 'vers':false
				});
		this.heals.set(253432, {'name':"Dreamer (T21)",
				'int':true, 'mastery_boost':true, 'mastery':true,
				'crit':true, 'haste_hpm':true, 'haste_hpct':false, 'vers':true
				});
		this.heals.set(207472, {'name':"Xavaric's Magnum Opus",
				'int':false, 'mastery_boost':false, 'mastery':false,
				'crit':false, 'haste_hpm':false, 'haste_hpct':false, 'vers':false
				});
		// after a fashion this scales with all stats, but for the sake of stat weights it's better to say 'none'
		this.heals.set(143924, {'name':"Leech", 
				'int':false, 'mastery_boost':false, 'mastery':false,
				'crit':false, 'haste_hpm':false, 'haste_hpct':false, 'vers':false
				});
		// TODO add trinkets?
		
		//// MASTERY ATTRIBUTION TO SPELLS AND PROCS ////
		
		// these are hots to track, with healing attributable directly and by mastery
		this.hotHealingMap = new Map(); // map from hot ID to obj w/ direct healing and mastery healing
		for(let [healId, healObj] of this.heals.entries()) {
			if(healObj.mastery_boost) {
				this.hotHealingMap.set(healId, {'name':healObj.name ,'direct':0, 'mastery':0});
			}
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
		
		//// STATS ////
		
		this.baseMasteryPercent = 4.8;
		this.masteryRatingPerOne = 666.6;
		this.bonusFromOneMastery = 1 / this.masteryRatingPerOne / 100;
		
		this.baseCritPercent = 8;
		this.critRatingPerOne = 400;
		this.bonusFromOneCrit = 1 / this.critRatingPerOne / 100;
		
		this.baseHastePercent = 0;
		this.hasteRatingPerOne = 375;
		this.bonusFromOneHaste = 1 / this.hasteRatingPerOne / 100;
		
		this.baseVersPercent = 0;
		this.versRatingPerOne = 475;
		this.bonusFromOneVers = 1 / this.versRatingPerOne / 100;
		
		
		this.hotsOnTarget = new Map(); // map from player ID to a set of hot IDs
		
		this.totalNoMasteryHealing = 0; // total healing before mastery
		this.druidSpellNoMasteryHealing = 0; // total healing before mastery from spells that benefit from mastery
		this.masteryTimesHealing = 0; // for calculating avg mastery stacks
		
		this.totalOneMastery = 0;
		this.totalOneCrit = 0;	
		this.totalOneHasteHpm = 0;
		this.totalOneHasteHpct = 0;
		this.totalOneVers = 0;
		this.totalOneVersDr = 0;
		this.totalOneInt = 0;
		
		// these mostly for debugging, for tracking what percent of healing we count as benefiting from different stats
		this.totalMasteryBenefitHealing = 0;
		this.totalCritBenefitHealing = 0;
		this.totalHasteHpmBenefitHealing = 0;
		this.totalVersBenefitHealing = 0;
		this.totalIntBenefitHealing = 0;
	}
	
	
	parse(wclEvent) {
		if(wclEvent.type === 'combatantinfo') {
			this.combatantInfo(wclEvent);
		}
		
		if(wclEvent.targetID === this.playerId) {
			if(wclEvent.type === 'damage') {
				this.damageTaken(wclEvent);
			}
		}
		 
		if(wclEvent.sourceID === this.playerId) {
			switch( wclEvent.type ) {
				case 'applybuff' :
					this.applyBuff(wclEvent);
					break;
				case 'removebuff' :
					this.removeBuff(wclEvent);
					break;
				case 'heal' :
					this.healOrAbsorb(wclEvent);
					break;
				case 'absorbed' :
					this.healOrAbsorb(wclEvent);
					break;
				default :
			}
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
				if(this.hotHealingMap.has(spellId)) { // prehot
					this.addSetIfAbsent(targetId);
					this.hotsOnTarget.get(targetId).add(spellId);
					this.debugLog("Player ID " + targetId + " prehotted with " +
							this.hotHealingMap.get(spellId).name);
				} else if(this.masteryBuffs.has(spellId)) { // pre-proc
					this.masteryBuffs.get(spellId).active = true;
				}
			}
		}
	}
	
	applyBuff(wclEvent) {
		let targetId = wclEvent.targetID;
		let spellId = wclEvent.ability.guid;
		
		if(this.hotHealingMap.has(spellId)) { // add hot to target
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
		if(this.hotHealingMap.has(spellId)) { // remove hot from target
			this.addSetIfAbsent(targetId);
			this.hotsOnTarget.get(targetId).delete(spellId);
		} else if(this.masteryBuffs.has(spellId)) { // remove mastery buff from self
			this.masteryBuffs.get(spellId).active = false;
		}
	}
	
	healOrAbsorb(wclEvent) {
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
		let hotsOn = this.hotsOnTarget.get(targetId);
		let numHotsOn = hotsOn.size;
		
		let healInfo = this.heals.get(spellId); // could be undefined
		let healDetails = this.getHealDetails(wclEvent, numHotsOn);
		
		this.totalNoMasteryHealing += healDetails.noMastery;
		if(healInfo !== undefined && healInfo.mastery) {
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
		}
		
		this.totalOneMastery += healDetails.oneMastery;
		this.totalOneCrit += healDetails.oneCrit;
		this.totalOneHasteHpm += healDetails.oneHasteHpm;
		this.totalOneHasteHpct += healDetails.oneHasteHpct;
		this.totalOneVers += healDetails.oneVers;
		this.totalOneInt += healDetails.oneInt;
	}

	damageTaken(wclEvent) {
		// we'll also count damage reduced by vers as effective healing
		// for purposes of determining stat weights
		
		let versBonus = this.getCurrVersBonus();
		let versDamageReduce = versBonus / 2;
		let noVersDamage = wclEvent.amount / (1 - versDamageReduce);
		let oneVers = noVersDamage * (this.bonusFromOneVers / 2);
		
		this.totalOneVersDr += oneVers;
	}
	
	//// HELPERS FUNCTIONS ////
	
	// helper for hotsOnTarget adds new set to mapping value if not there for target
	addSetIfAbsent(targetId) {
		if(!this.hotsOnTarget.has(targetId)) {
			this.hotsOnTarget.set(targetId, new Set());
		}
	}
	
	// extracts heal details from a wclEvent of type 'heal' or 'absorb'
	// including a breakdown of amounts boosted by different stats
	getHealDetails(healEvent, hotCount) {
		let amount = healEvent.amount; // doesn't include overheal
		if(healEvent.absorbed !== undefined) { // absorbed healing is effective healing
			amount += healEvent.absorbed;
		}
		
		let spellId = healEvent.ability.guid;
		let healInfo = this.heals.get(spellId);
		
		// MASTERY //
		
		let noMasteryHealing = amount;
		let oneStackMasteryHealing = 0;
		let oneMastery = 0;
		if(healInfo !== undefined && healInfo.mastery) {
			this.totalMasteryBenefitHealing += amount;
			
			let masteryBonus = this.getCurrMasteryBonus();		
			let healMasteryMultiply = 1 + (hotCount * masteryBonus);
			noMasteryHealing = amount / healMasteryMultiply;
			oneStackMasteryHealing = amount / (healMasteryMultiply / masteryBonus);
			oneMastery = this.bonusFromOneMastery * noMasteryHealing * hotCount;
		}
		
		// CRIT //
		
		let oneCrit = 0;
		if(healInfo !== undefined && healInfo.crit) {
			this.totalCritBenefitHealing += amount;
			
			// TODO handle different crit bonuses, Living Seed, RG bonus crit, and Abundance
			let critBonus = this.getCurrCritBonus();
			
			// a 'hitType' of 2 in the wclEvent seems to indicate a crit
			let noCritHealing = amount;
			if(healEvent.hitType === 2) {
				noCritHealing = amount / this.critMultiplier;
			}
			
			oneCrit = this.bonusFromOneCrit * noCritHealing * (this.critMultiplier - 1);
		}
		
		// HASTE //
		
		let oneHasteHpm = 0; // benefit from hpm only
		let oneHasteHpct = 0; // benefit from hpct and hpm
		
		if(healInfo !== undefined && healInfo.haste_hpm) {
			this.totalHasteHpmBenefitHealing += amount;
			
			let hasteBonus = this.getCurrHasteBonus();
			let noHasteHealing = amount / (1 + hasteBonus);
			oneHasteHpm = this.bonusFromOneHaste * noHasteHealing;
		}
		
		// TODO any way to make haste hpct calc less ugly?
		if(healInfo !== undefined && healInfo) {
			let hasteBonus = this.getCurrHasteBonus();
			let noHasteHealing = amount / (1 + hasteBonus);
			if(healInfo.haste_hpm) {
				noHasteHealing = noHasteHealing / (1 + hasteBonus);
			}
			
			let bonusFromOneHasteHpct = this.bonusFromOneHaste;
			if(healInfo.haste_hpm) {
				bonusFromOneHasteHpct = bonusFromOneHasteHpct * (1 + this.bonusFromOneHaste);
			}
			
			oneHasteHpct = bonusFromOneHasteHpct * noHasteHealing;
		}
		
		// VERS //
		
		let oneVers = 0;
		// almost everything benefits from vers, so if no healInfo for a spell we assume it DOES benefit
		// effectively I'm getting vers benefit with a blacklist rather than a whitelist
		if(healInfo === undefined || healInfo.vers) { 
			this.totalVersBenefitHealing += amount;
		
			let versBonus = this.getCurrVersBonus();
			let noVersHealing = amount / (1 + versBonus);
			oneVers = this.bonusFromOneVers * noVersHealing;
		}
		
		// INT //
		
		let oneInt = 0;
		if(healInfo !== undefined && healInfo.int) {
			this.totalIntBenefitHealing += amount;
			
			let bonusFromOneInt = (1 / this.baseInt) * this.armorIntMultiplier;
			oneInt = amount * bonusFromOneInt;
		}
		
		return {'noMastery':noMasteryHealing, 'oneStack':oneStackMasteryHealing, 'oneMastery':oneMastery,
				'oneCrit':oneCrit, 'oneHasteHpm':oneHasteHpm, 'oneHasteHpct':oneHasteHpct,
				'oneVers':oneVers, 'oneInt':oneInt,
				'total':amount, 'hotCount':hotCount};
	}
	
	getCurrMasteryBonus() {
		let masteryRating = this.baseMasteryRating;
		for(let masteryBuff of this.masteryBuffs.values()) {
			if(masteryBuff.active) {
				masteryRating += masteryBuff.amount;
			}
		}
		return (this.baseMasteryPercent + (masteryRating / this.masteryRatingPerOne)) / 100;
	}
	
	getCurrCritBonus() {
		let critRating = this.baseCritRating;
		// TODO add crit buff handling?
		return (this.baseCritPercent + (critRating / this.critRatingPerOne)) / 100;
	}
	
	getCurrHasteBonus() {
		let hasteRating = this.baseHasteRating;
		// TODO add haste buff handling?
		return (this.baseHastePercent + (hasteRating / this.hasteRatingPerOne)) / 100;
	}
	
	getCurrVersBonus() {
		let versRating = this.baseVersRating;
		// TODO add vers buff handling?
		return (this.baseVersPercent + (versRating / this.versRatingPerOne)) / 100;
	}
	
	// the amount of healing attributable to a mastery buff
	getBuffMasteryHealing(healDetails, buffAmount) {
		let masteryBonusFromBuff = (buffAmount / this.masteryRatingPerOne) / 100;
		return Math.round(healDetails.noMastery * masteryBonusFromBuff * healDetails.hotCount);
	}
	
	getResult() {		
		let res = $('<div>', {"class":"panel panel-default"});
		
		let playerNameElement = $('<div>', {"class":"panel-heading"})
				.html(toColorHtml("<b>" + this.playerName + " 🍂</br>", this.druidOrangeColor))
				.appendTo(res);
			
		let hotsListElement = $('<ul>', {"class":"list-group"})
				.appendTo(res);
		
		// STAT WEIGHTS //
		
		this.debugLog("Healing that benefits from stat for " + this.playerName + ":" +
				"\nInt: " + roundTo(this.totalIntBenefitHealing / this.totalHealing, 2) +
				"\nMastery: " + roundTo(this.totalMasteryBenefitHealing / this.totalHealing, 2) +
				"\nCrit: " + roundTo(this.totalCritBenefitHealing / this.totalHealing, 2) +
				"\nHaste: " + roundTo(this.totalHasteHpmBenefitHealing / this.totalHealing, 2) +
				"\nVers: " + roundTo(this.totalVersBenefitHealing / this.totalHealing, 2));
		
		// relative stat weights normalized so int = 1.00
		// TODO error check for no healing doesn't cause divide by zero
		let normalizedOneMastery = this.totalOneMastery / this.totalOneInt;
		let normalizedOneCrit = this.totalOneCrit / this.totalOneInt;
		let normalizedOneHasteHpm = this.totalOneHasteHpm / this.totalOneInt;
		let normalizedOneHasteHpct = this.totalOneHasteHpct / this.totalOneInt;
		let normalizedOneVers = this.totalOneVers / this.totalOneInt;
		let normalizedOneVersWithDr = (this.totalOneVers + this.totalOneVersDr) / this.totalOneInt;
		let normalizedOneInt = 1;
		
		$('<li>', {"class":"list-group-item small"})
				.html("<p><b>Relative Stat Weights</b></p>" +
						"&emsp;Intellect: <b>" + roundTo(normalizedOneInt, 2) + "</b><br>" + 
						"&emsp;Mastery: <b>" + roundTo(normalizedOneMastery, 2) + "</b><br>" +
						"&emsp;Crit: <b>" + roundTo(normalizedOneCrit, 2) + "</b><br>" +
						"&emsp;Haste (HPM): <b>" + roundTo(normalizedOneHasteHpm, 2) + "</b><br>" +
						"&emsp;Haste (HPCT): <b>" + roundTo(normalizedOneHasteHpct, 2) + "</b><br>" +
						"&emsp;Versatility: <b>" + roundTo(normalizedOneVers, 2) + "</b>" +
						toColorHtml(" (" + roundTo(normalizedOneVersWithDr, 2) + " w/ DR)", this.darkGrayColor) + "<br>")
				.appendTo(hotsListElement);
				
		let ratingForOnePercentMastery = this.getRatingForOnePercentString(this.totalOneMastery);
		let ratingForOnePercentCrit = this.getRatingForOnePercentString(this.totalOneCrit);
		let ratingForOnePercentHasteHpm = this.getRatingForOnePercentString(this.totalOneHasteHpm);
		let ratingForOnePercentHasteHpct = this.getRatingForOnePercentString(this.totalOneHasteHpct);
		let ratingForOnePercentVers = this.getRatingForOnePercentString(this.totalOneVers);
		let ratingForOnePercentVersWithDr = this.getRatingForOnePercentString(this.totalOneVers + this.totalOneVersDr);
		let ratingForOnePercentInt = this.getRatingForOnePercentString(this.totalOneInt);	
		$('<li>', {"class":"list-group-item small"})
				.html("<p><b>Rating for +1% Healing</b></p>" +
						"&emsp;Intellect: <b>" + roundTo(ratingForOnePercentInt, 0) + "</b><br>" +
						"&emsp;Mastery: <b>" + roundTo(ratingForOnePercentMastery, 0) + "</b><br>" +
						"&emsp;Crit: <b>" + roundTo(ratingForOnePercentCrit, 0) + "</b><br>" +
						"&emsp;Haste (HPM): <b>" + roundTo(ratingForOnePercentHasteHpm, 0) + "</b><br>" +
						"&emsp;Haste (HPCT): <b>" + roundTo(ratingForOnePercentHasteHpct, 0) + "</b><br>" +
						"&emsp;Versatility: <b>" + roundTo(ratingForOnePercentVers, 0) + "</b>" +
						toColorHtml(" (" + roundTo(ratingForOnePercentVersWithDr, 0) + " w/ DR)", this.darkGrayColor) + "<br>")
				.appendTo(hotsListElement);
				
		// HOT / MASTERY STUFF //
					
		// add report for avg HoT stacks
		let avgTotalMasteryStacks = this.masteryTimesHealing / this.totalNoMasteryHealing;
		let avgDruidSpellMasteryStacks = this.masteryTimesHealing / this.druidSpellNoMasteryHealing;
		$('<li>', {"class":"list-group-item small"})
				.html("<p><b>Average Mastery Stacks</b></p>" +
						"&emsp;All Healing: <b>" + roundTo(avgTotalMasteryStacks, 2) + "</b><br>" +
						"&emsp;Druid Spells: <b>" + roundTo(avgDruidSpellMasteryStacks, 2) + "</b><br>")
				.appendTo(hotsListElement);
		
		// add report for each HoT
		let hotText = "<p><b>HoT Mastery Contributions</b></p>";
		for(let [hotId, hotHealingObj] of this.hotHealingMap.entries()) {
			if(hotHealingObj.direct == 0) {
				console.log("No healing from hot ID " + hotId);
				continue; // don't include result entry for HoT you never used
			}
			
			let directPercent = roundTo(hotHealingObj.direct / this.totalHealing * 100, 1);
			let masteryPercent = roundTo(hotHealingObj.mastery / this.totalHealing * 100, 1);	
			let directTotal = roundTo(hotHealingObj.direct, 0).toLocaleString();
			let masteryTotal = roundTo(hotHealingObj.mastery, 0).toLocaleString();
			hotText += "<p>&emsp;" + getSpellLinkHtml(hotId, hotHealingObj.name) +
					'<br>&emsp;&emsp;Direct: <b>' + directPercent + "%</b> " +
					toColorHtml("(" + directTotal + ")", this.darkGrayColor) +
					'<br>&emsp;&emsp;Mastery: <b>' + masteryPercent + "%</b> " +
					toColorHtml("(" + masteryTotal + ")", this.darkGrayColor) +
					"</p>";
		}
		$('<li>', {"class":"list-group-item small"})
				.html(hotText)
				.appendTo(hotsListElement);
		
		// add report for each buff
		let hasProc = false;
		let procText = "<p><b>Mastery Procs</b></p>";
		for(let [buffId, buffObj] of this.masteryBuffs.entries()) {
			if(buffObj.attributableHealing == 0) {
				console.log("No healing from buff ID " + buffId);
				continue; // don't include result entry for buff that never procced / gave bonus
			}
			hasProc = true;
			
			let amountPercent = roundTo(buffObj.attributableHealing / this.totalHealing * 100, 1);
			procText += "&emsp;" + getSpellLinkHtml(buffId, buffObj.name) + ": <b>" + amountPercent + "%</b> " +
					toColorHtml("(" + buffObj.attributableHealing.toLocaleString() + ")", this.darkGrayColor) +
					"<br>";
		} 
		if(hasProc) {
			$('<li>', {"class":"list-group-item small"})
				.html(procText)
				.appendTo(hotsListElement);
		}
		
		// RAW TOTALS //

		$('<li>', {"class":"list-group-item small"})
				.html(toColorHtml("Total Healing: " + this.totalHealing.toLocaleString(), this.darkGrayColor))
				.appendTo(hotsListElement);
		
		return res;
	}
	
	getRatingForOnePercentString(healingFromOne) {
		if(healingFromOne === 0 || this.totalHealing === 0) {
			return "N/A";
		} else {
			return 0.01 / (healingFromOne / this.totalHealing);
		}
	}
	
	debugLog(message) {
		if(this.debugMode) {
			console.log(message);
		}
	}
	
}

