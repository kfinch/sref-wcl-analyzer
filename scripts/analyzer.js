///////////////////////////////////////////////////////////////////////////////
// MASTER ANALYZER
///////////////////////////////////////////////////////////////////////////////

class MasterAnalyzer {
	
	constructor(playerNameMapping, enemyNameMapping, fight) {
		this.playerNameMapping = playerNameMapping;
		this.enemyNameMapping = enemyNameMapping;
		this.fight = fight;
		this.subAnalyzers = [];
		console.log("MasterAnalyzer built!");
	}
	
	/*
	 * Use combatantinfo events to build new subanalyzers for players,
	 * and pass events through to those subanalyzers when player matches
	 */
	parse( wclEvent ) {
		if( wclEvent.type == 'combatantinfo' ) {
			this.addSubAnalyzers( wclEvent );
		} else {
			for(let subAnalyzer of this.subAnalyzers) {
				if( wclEvent.sourceID == subAnalyzer.playerId ) {
					subAnalyzer.parse( wclEvent );
				}
			}
		}
	}
	
	/*
	 * Concatenates subanalyzer results and returns them
	 */
	getResults() {
		let results = [];
		for(let subAnalyzer of this.subAnalyzers) {
			results.push(subAnalyzer.getResult())
		}
		return results;
	}
	
	/*
	 * Determines if any subanalyzers should be built for a given combatantinfo,
	 * and adds them to the subanalyzer list
	 */
	addSubAnalyzers( combatantinfo ) {
		let name = this.playerNameMapping.get(combatantinfo.sourceID);
		
		// each spec has a semi arbitrary ID
		// see: http://wowwiki.wikia.com/wiki/SpecializationID
		if( combatantinfo.specID == 105 ) {
			console.log(name + " - Resto Druid");
			console.log(combatantinfo);
			this.subAnalyzers.push(new RestoDruidSubAnalyzer(
					name, combatantinfo, this.fight, this.enemyNameMapping));
		} else if( combatantinfo.specID == 103 ) { 
			console.log(name + " - Feral Druid");
			console.log(combatantinfo);
			// keep this line commented in production until Feral analyzer implemented
			this.subAnalyzers.push(new FeralDruidSubAnalyzer(
					name, combatantinfo, this.fight, this.enemyNameMapping));
		} else {
			// no analysis for you
		}
		// add more subanalyzers here
	}
}