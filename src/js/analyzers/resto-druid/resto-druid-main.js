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
		this.playerName = playerName;
		this.playerInfo = playerInfo;
		this.fight = fight;
		this.enemyNameMapping = enemyNameMapping;
		
		this.druidOrangeColor = 'ff7d0a';
		this.darkGrayColor = '888888';
	
		this.playerId = this.playerInfo.sourceID;
		
		this.totalHealing = 0; // total healing from all spells
		
		this.masteryAnalyzer = new RestoDruidMasteryAnalyzer(playerInfo);
	}
	
	
	parse(wclEvent) {	 
		// pass to sub-analyzers
		this.masteryAnalyzer.parse(wclEvent);
		
		// track total healing here
		if(wclEvent.sourceID === this.playerId) {
			switch( wclEvent.type ) {
				case 'heal' :
					this.totalHealing += wclEvent.amount; // doesn't include overheal
					if(wclEvent.absorbed !== undefined) { // absorbed healing is effective healing
						this.totalHealing += wclEvent.absorbed;
					}
					break;
				case 'absorbed' :
					this.totalHealing += wclEvent.amount;
					break;
				default :
			}
		}
	}
	
	getResult() {
		let masteryResult = this.masteryAnalyzer.getResult();
		
		let res = $('<div>', {"class":"panel panel-default"});
		
		let playerNameElement = $('<div>', {"class":"panel-heading"})
				.html(toColorHtml("<b>" + this.playerName + " 🍂</br>", this.druidOrangeColor))
				.appendTo(res);
		
		
		// MASTERY RESULTS //
		
		let hotsListElement = $('<ul>', {"class":"list-group"})
				.appendTo(res);
				
		let healingFromOneMastery = masteryResult.healingFromOneRating;
		let ratingForOnePercent = 0.01 / (healingFromOneMastery / this.totalHealing);
		$('<li>', {"class":"list-group-item small"})
				.html("<p><b>Mastery Weight</b></p>" +
						"&emsp;Healing from 1 Rating: <b>" + roundTo(healingFromOneMastery, 0) + "</b><br>" +
						"&emsp;Rating for +1% Healing: <b>" + roundTo(ratingForOnePercent, 0) + "</b><br>")
				.appendTo(hotsListElement);
				
		// add report for avg HoT stacks
		let avgTotalMasteryStacks = roundTo(masteryResult.avgTotalMasteryStacks, 2);
		let avgDruidSpellMasteryStacks = roundTo(masteryResult.avgDruidSpellMasteryStacks, 2);
		$('<li>', {"class":"list-group-item small"})
				.html("<p><b>Average Mastery Stacks</b></p>" +
						"&emsp;All Healing: <b>" + avgTotalMasteryStacks + "</b><br>" +
						"&emsp;Druid Spells: <b>" + avgDruidSpellMasteryStacks + "</b><br>")
				.appendTo(hotsListElement);
		
		// add report for each HoT
		let hotText = "<p><b>HoT Mastery Contributions</b></p>";
		for(let [hotId, hotHealingObj] of masteryResult.hotHealing.entries()) {
			if(hotHealingObj.direct == 0) {
				console.log("No healing from hot ID " + hotId);
				continue; // don't include result entry for HoT you never used
			}
			
			let directPercent = roundTo(hotHealingObj.direct / this.totalHealing * 100, 1);
			let masteryPercent = roundTo(hotHealingObj.mastery / this.totalHealing * 100, 1);		
			hotText += "<p>&emsp;" + getSpellLinkHtml(hotId, hotHealingObj.name) +
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
		let hasProc = false;
		let procText = "<p><b>Mastery Procs</b></p>";
		for(let [buffId, buffObj] of masteryResult.masteryBuffHealing.entries()) {
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
	
	// helper for hotsOnTarget adds new set to mapping value if not there for target
	addSetIfAbsent(targetId) {
		if(!this.hotsOnTarget.has(targetId)) {
			this.hotsOnTarget.set(targetId, new Set());
		}
	}
	
}

