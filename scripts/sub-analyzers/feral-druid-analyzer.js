///////////////////////////////////////////////////////////////////////////////
// FERAL DRUID ANALYZER
///////////////////////////////////////////////////////////////////////////////

function FeralDruidSubAnalyzer ( playerName, playerInfo, fight ) { // TODO will probably need encounterend time 
	
	// CONSTANTS
	
	this.druidOrangeColor = 'ff7d0a';
	this.darkGrayColor = '888888';
	
	// number of simulations to run to get AB average
	this.numSims = 10000;
	
	
	// relevent spell IDs
	this.ripId = 1079;
	this.abId = 210705;
	this.fbId = 22568;
	
	this.cpIds = new Set();
	this.cpIds.add(1822); // rake
	//this.cpIds.add(106830); // cat thrash
	this.cpIds.add(210722); // af (cast? do i need look for cast event?)
	this.cpIds.add(5221); // shred
	//this.cpIds.add(106785); // swipe
	this.cpIds.add(8921); // moonfire
	
	// INSTANCE VARS
	
	this.playerId = playerInfo.sourceID;
	
	this.ripDuration = 24 * 1000;
	if( playerInfo.talents[5].id = 202032 ) { // Jagged Wounds
		console.log(playerName + " is specced for Jagged Wounds")
		this.ripDuration = 16 * 1000;
	}
	this.ripPandemic = this.ripDuration * 0.3;
	
	this.hasSabertooth = (playerInfo.talents[5].id == 202031);
	this.noSabertoothRefreshPercent = 0.25;
	
	this.targets = new Map(); // from ID to FdsaTargetState

	/*
	 * Methodology:
	 * TODO 
	 */
	this.parse = function( wclEvent ) {
		if(wclEvent.type == 'cast') {
			console.log("Cast: " + wclEvent.ability.name + " @ " + wclEvent.timestamp);
			let spellId = wclEvent.ability.guid;
			let targetId = wclEvent.targetID;
			let timestamp = wclEvent.timestamp;
			
			if(targetId === undefined) {
				return;
			}
			
			// add a new target on Rip
			if(spellId == this.ripId && !this.targets.has(targetId)) {
				this.targets.set(targetId, new FdsaTargetState(this.numSims));
			}
			
			if(this.targets.has(targetId)) {
				let thisTargetState = this.targets.get(targetId);
				if(spellId == this.ripId) {
					thisTargetState.applyRip(timestamp, timestamp + this.ripDuration, this.ripPandemic);
				} else if(this.cpIds.has(spellId)) {
					thisTargetState.applyCp(timestamp);
				}
			}
			
		} else if(wclEvent.type == 'applydebuff') {
			console.log("Apply Debuff: " + wclEvent.ability.name + " @ " + wclEvent.timestamp);
			this.applyDebuff(wclEvent);
			
		} else if(wclEvent.type == 'refreshdebuff') {
			console.log("Refresh Debuff: " + wclEvent.ability.name + " @ " + wclEvent.timestamp);
			this.applyDebuff(wclEvent);
			
		} else if(wclEvent.type == 'damage') { // check FB, has to be on damage so I know target's health
			console.log("Damage: " + wclEvent.ability.name + " @ " + wclEvent.timestamp);
			let spellId = wclEvent.ability.guid;
			let targetId = wclEvent.targetID;
			let timestamp = wclEvent.timestamp;
			if(this.targets.has(targetId)) {
				let thisTargetState = this.targets.get(targetId);
				let targetHpPercentBefore = (wclEvent.hitPoints + wclEvent.amount) / wclEvent.maxHitPoints;
				if(spellId == this.fbId && (this.hasSabertooth || targetHpPercentBefore < this.noSabertoothRefreshPercent)) {
					thisTargetState.refreshRip(timestamp, timestamp + this.ripDuration, this.ripPandemic);
				}
			}
		}
	}
	
	this.applyDebuff = function( wclEvent ) {
		let targetId = wclEvent.targetID;
		let spellId = wclEvent.ability.guid;
		let timestamp = wclEvent.timestamp;
		if(this.targets.has(targetId)) {
			let thisTargetState = this.targets.get(targetId);
			if(spellId == this.abId) {
				thisTargetState.applyAb(timestamp);
			}
		}
	}
	
	this.getResult = function() {
		var res = $('<div>', {"class":"panel panel-default"});
		
		var playerNameElement = $('<div>', {"class":"panel-heading"})
				.html(toColorHtml("<b>" + playerName + "</b>", this.druidOrangeColor) +
						toColorHtml("<b>  Experimental Feral Analysis</b>", 'ff0000'))
				.appendTo(res);
		var targetListElement = $('<ul>', {"class":"list-group"})
				.appendTo(res);
				
		for(let[targetId, targetState] of this.targets.entries()) {
			console.log("Report for Target ID " + targetId);
			let reportObj = targetState.report(fight.start_time, fight.end_time);
			
			$('<li>', {"class":"list-group-item small"})
					.html("<p><b>Target ID " + targetId + "</b></p>" +
							"&emsp;Actual Rip Uptime: <b>" + reportObj.actualRipUptime + "%</b><br>" +
							"&emsp;Average Simmed AB Uptime: <b>" + reportObj.simmedAvgAbUptime + "%</b><br>" +
							"&emsp;Actual AB Uptime: <b>" + reportObj.actualAbUptime +
							"% (" + reportObj.actualAbPercentile + " percentile)</b><br>")
					.appendTo(targetListElement);
		}
		
		return res;
	}
	
	
	
}

// data structure holds the rip / AB / simmed-AB state of a target
function FdsaTargetState( numSims ) {
	this.abChance = 0.1;
	
	this.rip = new FdsaBleedState(true, "Rip");
	this.ab = new FdsaBleedState(true, "AB");
	this.simAbs = [numSims];
	for(var i=0; i<numSims; i++) {
		this.simAbs[i] = new FdsaBleedState(false, "");
	}
	
	this.applyRip = function( time, newFallsAt, maxPandemic ) {
		this.rip.applyPandemic( time, newFallsAt, maxPandemic );
	}
	
	this.refreshRip = function( time, newFallsAt, maxPandemic ) { // FB within window
		this.rip.refreshPandemic( time, newFallsAt, maxPandemic );
	}
	
	this.applyCp = function( time ) {
		if(this.rip.isBleedUp()) { // CP on target only relevent if Rip is active
			for(var i=0; i<numSims; i++) {
				if(Math.random() < this.abChance) {
					this.simAbs[i].apply(time, this.rip.fallsAt);
				}
			}
		}
	}
	
	this.applyAb = function( time ) {
		this.rip.update(time);
		this.ab.apply( time, this.rip.fallsAt );
	}
	
	this.handleDeath = function( time ) {
		this.rip.remove(time);
		this.ab.remove(time);
		for(let simAb of this.simAbs) {
			simAb.remove(time);
		}
	}
	
	this.report = function( fightStartTime, fightEndTime ) {
		this.handleDeath(fightEndTime);
	
		let fightTime = fightEndTime - fightStartTime;
		let ripUptime = this.rip.accumDur / fightTime;
		let abUptime = this.ab.accumDur / fightTime;
	
		console.log("Actual Rip uptime: " + roundTo(ripUptime * 100, 1));
		console.log("Actual AB uptime: " + roundTo(abUptime * 100, 1));
		
		let averageAbSim = this.simAbs.reduce((a,v)=>v.accumDur+a, 0) / this.simAbs.length;
		let averageAbSimUptime = averageAbSim / fightTime;
		
		console.log("Simmed AB uptime: " + roundTo(averageAbSimUptime * 100, 1));
		
		let numSimsBelowActual = this.simAbs.filter(v => v.accumDur < this.ab.accumDur).length;
		let actualPercentile = Math.round(numSimsBelowActual / this.simAbs.length * 100);
		console.log("Actual AB percentile: " + actualPercentile);
		
		var reportObj = {};
		reportObj.actualRipUptime = roundTo(ripUptime * 100, 1);
		reportObj.actualAbUptime = roundTo(abUptime * 100, 1);
		reportObj.simmedAvgAbUptime = roundTo(averageAbSimUptime * 100, 1);
		reportObj.actualAbPercentile = Math.round(numSimsBelowActual / this.simAbs.length * 100);
		return reportObj;
	}
}

function FdsaBleedState( isVerbose, name ) {
	this.bleedUp = false;
	this.appliedAt = 0; // in millis since log start
	this.fallsAt = 0; // in millis since log start
	this.accumDur = 0; // in millis
	
	this.isBleedUp = function( time ) {
		this.update(time);
		return this.bleedUp;
	}
	
	this.update = function( time ) {
		if(this.bleedUp && time > this.fallsAt) {
			if(isVerbose){console.log(name + " fell @ " + Math.round(this.fallsAt/1000));} // debug logging
			this.bleedUp = false;
			this.accumDur += (this.fallsAt - this.appliedAt);
		} 
	}
	
	this.apply = function( time, newFallsAt ) {
		this.applyHelper(time, newFallsAt, 0, false);
	}
	
	this.applyPandemic = function( time, newFallsAt, maxPandemic) {
		this.applyHelper(time, newFallsAt, maxPandemic, false);
	}
	
	this.refresh = function( time, newFallsAt ) {
		this.applyHelper(time, newFallsAt, 0, true);
	}
	
	this.refreshPandemic = function( time, newFallsAt, maxPandemic) {
		this.applyHelper(time, newFallsAt, maxPandemic, true);
	}
	
	this.applyHelper = function( time, newFallsAt, maxPandemic, refreshOnly ) {
		this.update(time);
		if(this.bleedUp) {
			var remainingDur = this.fallsAt - time;
			if(remainingDur > maxPandemic) {
				this.fallsAt = newFallsAt + maxPandemic;
			} else {
				this.fallsAt = newFallsAt + remainingDur;
			}
			if(isVerbose){console.log(name + " refreshed @ " + Math.round(time/1000));} // debug logging
		} else if(!refreshOnly) {
			if(isVerbose){console.log(name + " applied @ " + Math.round(time/1000));} // debug logging
			this.bleedUp = true;
			this.appliedAt = time;
			this.fallsAt = newFallsAt;
		}
	}
	
	this.remove = function( time ) {
		this.update(time);
		if(this.bleedUp) {
			if(isVerbose){console.log(name + " removed @ " + Math.round(this.fallsAt/1000));} // debug logging
			this.bleedUp = false;
			this.accumDur += (time - this.appliedAt);
		}
	}
} 



