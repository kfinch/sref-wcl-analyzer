///////////////////////////////////////////////////////////////////////////////
// FERAL DRUID ANALYZER
///////////////////////////////////////////////////////////////////////////////

function FeralDruidSubAnalyzer ( playerName, playerInfo ) { // TODO will probably need encounterend time 
	
	// CONSTANTS
	
	this.druidOrangeColor = 'ff7d0a';
	this.darkGrayColor = '888888';
	
	// number of simulations to run to get AB average
	this.numSims = 100;
	
	
	// relevent spell IDs
	this.ripId = 1079
	this.abId = 210705
	// direct CP generators and bleed CP generators need to be found differently from logs.
	// direct: look for 'damage done' event
	// bleed: look for 'debuff applied' or 'debuff refreshed' event
	this.cpBleedIds = new Set();
	this.cpBleedIds.add(1822); // rake
	this.cpBleedIds.add(106830); // cat thrash
	this.cpBleedIds.add(210722); // af (cast? do i need look for cast event?)
	
	this.cpDirectIds = new Set();
	this.cpDirectIds.add(5221); // shred
	this.cpDirectIds.add(106785); // swipe
	
	// INSTANCE VARS
	
	this.playerId = playerInfo.sourceID;
	
	this.ripDuration = 24;
	if( playerInfo.talents[5].id = 202032 ) { // Jagged Wounds
		this.ripDuration = 16;
	}
	this.ripPandemic = this.ripDuration * 0.3;
	
	this.targets = new Map(); // from ID to FdsaTargetState

	/*
	 * Methodology:
	 * TODO
	 */
	this.parse = function( wclEvent ) {
		if(wclEvent.type == 'cast') {
			console.log("Cast: " + wclEvent.ability.name);
		}
		if(wclEvent.type == 'applydebuff') {
			console.log("Apply Debuff: " + wclEvent.ability.name);
		}
		if(wclEvent.type == 'refreshdebuff') {
			console.log("Refresh Debuff: " + wclEvent.ability.name);
		}
		
		/*
		switch( wclEvent.type ) {
			case 'cast' : // TODO capture bleed application from cast? (or debuff applied?)
				console.log(wclEvent);
				break;
			case 'damage' : // capture swipe from damage done because I don't get target
				break;
			case 'debuffapplied' : // capture thrash from debuffapplied because its a bleed and I don't get target
				// TODO only procs AB w/ t19-pc, need to check for that
				console.log(wclEvent);
				break;
			default :
				break;
		}
		*/
	}
	
	this.getResult = function() {
		var res = $('<div>', {"class":"panel panel-default"});
		
		var playerNameElement = $('<div>', {"class":"panel-heading"})
				.html(toColorHtml("<b>" + playerName + "</br>", this.druidOrangeColor))
				.appendTo(res);
		
		return res;
	}
	
	
	
}

// data structure holds the rip / AB / simmed-AB state of a target
function FdsaTargetState( sims ) {
	this.abChance = 0.1;
	
	this.rip = new FdsaBleedState();
	this.ab = new FdsaBleedState();
	this.simAbs = [sims];
	for(var i=0; i<sims; i++) {
		this.simAbs[i] = new FdsaBleedState();
	}
	
	this.applyRip = function( time, newFallsAt, maxPandemic ) {
		this.rip.applyPandemic( time, newFallsAt );
	}
	
	this.applyCp = function( time ) {
		if(this.rip.bleedUp) { // CP on target only relevent if Rip is active
			for(var i=0; i<sims; i++) {
				if(Math.random() < this.abChance) {
					this.simAbs[i].apply(time, this.rip.fallsAt);
				}
			}
		}
	}
	
	this.applyAb = function( time ) {
		this.ab.apply( time, this.rip.fallsAt );
	}
}

function FdsaBleedState() {
	this.bleedUp = false;
	this.appliedAt = 0; // in millis since encounter start
	this.fallsAt = 0; // in millis since encounter start
	this.accumDur = 0; // in millis
	
	this.update = function( time ) {
		if(this.bleedUp && time > this.fallsAt) {
			this.bleedUp = false;
			this.accumDur += (this.fallsAt - this.appliedAt);
		} 
	}
	
	this.apply = function( time, newFallsAt ) {
		this.update(time);
		if(this.bleedUp) {
			this.fallsAt = newFallsAt;
		} else {
			this.bleedUp = true;
			this.appliedAt = time;
			this.fallsAt = newFallsAt;
		}
	}
	
	this.applyPandemic = function( time, newFallsAt, maxPandemic ) {
		this.update(time);
		if(this.bleedUp) {
			var remainingDur = this.fallsAt - time;
			if(remainingDur > maxPandemic) {
				this.fallsAt = newFallsAt + maxPandemic;
			} else {
				this.fallsAt = newFallsAt + remainingDur;
			}
		} else {
			this.bleedUp = true;
			this.appliedAt = time;
			this.fallsAt = newFallsAt;
		}
	}
	
	this.remove = function( time ) {
		this.update(time);
		if(this.bleedUp) {
			this.bleedUp = false;
			this.accumDur += (time - this.appliedAt);
		}
	}
} 



