///////////////////////////////////////////////////////////////////////////////
// RESTO DRUID ANALYZER
///////////////////////////////////////////////////////////////////////////////

function RestoDruidSubAnalyzer ( playerName, playerInfo, fight, enemyNameMapping ) {
	
	// temp until made into class, need this for closure reasons
	this.playerName = playerName;
	this.playerInfo = playerInfo;
	this.fight = fight;
	this.enemyNameMapping = enemyNameMapping;
	
	// CONSTANTS (TODO make these actually static?)
	
	this.druidOrangeColor = 'ff7d0a';
	this.darkGrayColor = '888888';
	
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
	this.druidHeals.set(5185 , "Healing Touch"); // y u casting it tho?
	this.druidHeals.set(18562 , "Swiftmend");
	// Living Seed doesn't directly benefit, but does through Regrowth.
	// Including it on its own is technically wrong because it might heal with
	// a different number of HoTs present than the Regrowth that spawned it.
	// However, this is still a reasonable approximation.
	this.druidHeals.set(48503 , "Living Seed");
	this.druidHeals.set(157982 , "Tranquility");
	this.druidHeals.set(81269 , "Effloresence");
	this.druidHeals.set(189853 , "Dreamwalker");
	this.druidHeals.set(189800 , "Nature's Essence");
	this.druidHeals.set(33778, "Lifebloom Bloom");
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
	
	this.masteryBuffs = new Map(); // map from buff ID to obj with buff name and buff strength
	this.masteryBuffs.set(232378, {'amount':4000, 'name':'T19 2pc'});
	this.masteryBuffs.set(224149, {'amount':3000, 'name':"Jacin's Ruse"});
	
	// TODO: any other common buffs to add? What will I do about varying buff strength by item ilevel?
	
	this.baseMasteryPercent = 4.8;
	this.masteryRatingPerOne = 666.6;
	
	// INSTANCE VARS
	
	this.playerId = this.playerInfo.sourceID;
	
	this.totalHealing = 0; // total healing from all spells
	this.totalNoMasteryHealing = 0; // total healing before mastery
	this.druidSpellNoMasteryHealing = 0; // total healing before mastery from spells that benefit from mastery
	this.masteryTimesHealing = 0; // for calculating avg mastery stacks
	
	this.hotHealingMap = new Map(); // map from hot ID to obj w/ direct healing and mastery healing
	for(hotId of this.hots.keys()) {
		this.hotHealingMap.set(hotId, {'direct':0, 'mastery':0});
	}
	
	this.hotsOnTarget = new Map(); // map from player ID to a set of hot IDs
	this.baseMasteryRating = this.playerInfo.mastery;
	this.masteryBuffsActive = new Map(); // map from buff ID to obj with buff name and buff strength
	
	// TODO: 3 maps just for the mastery buff? Make this implementation suck less.
	this.masteryBuffAccum = new Map(); // map from buff ID to obj with buff name and healing attributable to it
	for(var[buffId, buffObj] of this.masteryBuffs.entries()) {
		this.masteryBuffAccum.set(buffId, {'attributableHealing':0, 'name':buffObj.name});
	}
	
	/*
	 * Methodology:
	 * Per friendly target, track the presence of analyzed spell(s) cast by player.
	 * When analyzed spells are present during a heal,
	 * calculate how much was due to mastery stack, and add to running total.
	 * Be careful not to double count by counting mastery stack from self.
	 * 
	 * Shortcomings:
	 * Mastery procs (except for t19 2pc) are not accounted for.
	 */
	this.parse = function( wclEvent ) {
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
	
	// parse 'apply buff' event
	this.applyBuff = function( wclEvent ) {
		var targetId = wclEvent.targetID;
		var spellId = wclEvent.ability.guid;
		
		if(this.hots.has(spellId)) {
			this.addSetIfAbsent(targetId);
			this.hotsOnTarget.get(targetId).add(spellId);
		} else {
			// remove mastery buff from self
			if(this.masteryBuffs.has(spellId)) {
				this.masteryBuffsActive.set(spellId, this.masteryBuffs.get(spellId));
			}
		}
	}
	
	// parse 'remove buff' event
	this.removeBuff = function( wclEvent ) {
		var targetId = wclEvent.targetID;
		var spellId = wclEvent.ability.guid;
		
		// remove hot from target
		if(this.hots.has(spellId)) {
			this.addSetIfAbsent(targetId);
			this.hotsOnTarget.get(targetId).delete(spellId);
		} else {
			// remove mastery buff from self
			if(this.masteryBuffs.has(spellId)) {
				this.masteryBuffsActive.delete(spellId);
			}
		}
	}
	
	// parse 'heal' event
	this.heal = function( wclEvent ) {
		var targetId = wclEvent.targetID;
		var spellId = wclEvent.ability.guid;
		var amount = wclEvent.amount;
		
		this.totalHealing += amount;
		
		if(this.hotHealingMap.has(spellId)) {
			this.hotHealingMap.get(spellId).direct += amount;
		}
		
		this.addSetIfAbsent(targetId);
		if(this.druidHeals.has(spellId)) { // spell was boosted by mastery
			var hotsOn = this.hotsOnTarget.get(targetId);
			var numHotsOn = hotsOn.size;
			var healWoMastery = this.getNoMasteryHealing(amount, numHotsOn);
			this.totalNoMasteryHealing += healWoMastery;
			this.druidSpellNoMasteryHealing += healWoMastery;
			this.masteryTimesHealing += healWoMastery * numHotsOn;
			
			// give each HoT credit for mastery boosting
			for(hotOn of hotsOn) {
				if(hotOn != spellId) { // prevents double count
					this.hotHealingMap.get(hotOn).mastery +=
							this.getOneStackMasteryHealing(amount, numHotsOn);
				}
			}
			
			// attribute healing to mastery buffs that are present
			for(var[buffId, buffObj] of this.masteryBuffsActive.entries()) {
				var attributableHealing = this.getBuffMasteryHealing(
						amount, numHotsOn, buffObj.amount);
				this.masteryBuffAccum.get(buffId).attributableHealing += attributableHealing;
			}
			
		} else { // spell not boosted by mastery
			this.totalNoMasteryHealing += amount;
		}
		
		
	}
	
	// parse 'absorbed' event
	this.absorbed = function( wclEvent ) {
		// absorbs don't interact with mastery, but they do count towards total healing
		this.totalHealing += wclEvent.amount;
		this.totalNoMasteryHealing += wclEvent.amount;
	}
	
	
	this.getResult = function() {
		var res = $('<div>', {"class":"panel panel-default"});
		
		var playerNameElement = $('<div>', {"class":"panel-heading"})
				.html(toColorHtml("<b>" + this.playerName + " 🍂</br>", this.druidOrangeColor))
				.appendTo(res);
		
		var hotsListElement = $('<ul>', {"class":"list-group"})
				.appendTo(res);
				
		// add report for avg HoT stacks
		var avgTotalMasteryStacks =
				roundTo(this.masteryTimesHealing / this.totalNoMasteryHealing, 2);
		var avgDruidSpellMasteryStacks =
				roundTo(this.masteryTimesHealing / this.druidSpellNoMasteryHealing, 2);
		$('<li>', {"class":"list-group-item small"})
				.html("<p><b>Average Mastery Stacks</b></p>" +
						"&emsp;All Healing: <b>" + avgTotalMasteryStacks + "</b><br>" +
						"&emsp;Druid Spells: <b>" + avgDruidSpellMasteryStacks + "</b><br>")
				.appendTo(hotsListElement);
		
		// add report for each HoT
		var hotText = "<p><b>HoT Mastery Contributions</b></p>";
		for(var [hotId, hotHealingObj] of this.hotHealingMap.entries()) {
			if(hotHealingObj.direct == 0) {
				console.log("No healing from hot ID " + hotId);
				continue; // don't include result entry for HoT you never used
			}
			
			var directPercent = roundTo(hotHealingObj.direct / this.totalHealing * 100, 1);
			var masteryPercent = roundTo(hotHealingObj.mastery / this.totalHealing * 100, 1);		
			hotText += "<p>&emsp;" + getSpellLinkHtml(hotId, this.hots.get(hotId)) +
					'<br>&emsp;&emsp;Direct: <b>' + directPercent + "%</b> " +
					toColorHtml("(" + hotHealingObj.direct.toLocaleString() + ")", this.darkGrayColor) +
					'<br>&emsp;&emsp;Mastery: <b>' + masteryPercent + "%</b> " +
					toColorHtml("(" + hotHealingObj.mastery.toLocaleString() + ")", this.darkGrayColor) +
					"</p>";
		}
		$('<li>', {"class":"list-group-item small"})
				.html(hotText)
				.appendTo(hotsListElement);
		
		// add report for each buff
		var hasProc = false;
		var procText = "<p><b>Mastery Procs</b></p>";
		for(var [buffId, buffObj] of this.masteryBuffAccum.entries()) {
			if(buffObj.attributableHealing == 0) {
				console.log("No healing from buff ID " + buffId);
				continue; // don't include result entry for buff that never procced / gave bonus
			}
			hasProc = true;
			
			var amountPercent = roundTo(buffObj.attributableHealing / this.totalHealing * 100, 1);
			procText += "&emsp;" + getSpellLinkHtml(buffId, buffObj.name) + ": <b>" + amountPercent + "%</b> " +
					toColorHtml("(" + buffObj.attributableHealing.toLocaleString() + ")", this.darkGrayColor) +
					"<br>";
		} 
		if(hasProc) {
			$('<li>', {"class":"list-group-item small"})
				.html(procText)
				.appendTo(hotsListElement);
		}
		
		// report raw total healing done
		$('<li>', {"class":"list-group-item small"})
				.html(toColorHtml("Total Healing: " + this.totalHealing.toLocaleString(), this.darkGrayColor))
				.appendTo(hotsListElement);
		
		return res;
	}
	
	// helper for hotsOnTarget adds new set to mapping value if not there for target
	this.addSetIfAbsent = function( targetId ) {
		if(!this.hotsOnTarget.has(targetId)) {
			this.hotsOnTarget.set(targetId, new Set());
		}
	}
	
	// gets the amount of healing that can be attributed to *each* mastery stack
	this.getOneStackMasteryHealing = function( healAmount, hotCount ) {
		var masteryBonus = this.getCurrMastery();
		var healMasteryMultiply = 1 + (hotCount * masteryBonus);
		return Math.round(healAmount / (healMasteryMultiply / masteryBonus));
	}
	
	// the amount of healing that would have been done without mastery
	this.getNoMasteryHealing = function( healAmount, hotCount ) {
		var masteryBonus = this.getCurrMastery();
		var healMasteryMultiply = 1 + (hotCount * masteryBonus);
		return Math.round(healAmount / healMasteryMultiply);
	}
	
	// the amount of healing attributable to a mastery buff
	this.getBuffMasteryHealing = function( healAmount, hotCount, buffAmount) {
		var noMasteryHeal = this.getNoMasteryHealing(healAmount, hotCount);
		var masteryBonusFromBuff = (buffAmount / this.masteryRatingPerOne) / 100;
		return Math.round(noMasteryHeal * masteryBonusFromBuff * hotCount);
	}
	
	// uses curr mastery rating (including buffs), and calcs mastery % from it
	this.getCurrMastery = function() {
		var currMasteryRating = this.baseMasteryRating;
		for(masteryBuff of this.masteryBuffsActive.values()) {
			currMasteryRating += masteryBuff.amount;
		}
		
		return this.masteryRatingToBonus(currMasteryRating);
	}
	
	this.masteryRatingToBonus = function( rating ) {
		return (this.baseMasteryPercent + (rating / this.masteryRatingPerOne)) / 100;
	}
	
}

