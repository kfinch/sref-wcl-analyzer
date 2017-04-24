///////////////////////////////////////////////////////////////////////////////
// FERAL DRUID ANALYZER
///////////////////////////////////////////////////////////////////////////////

function FeralDruidSubAnalyzer ( playerName, playerInfo ) {
	
	// CONSTANTS
	
	this.druidOrangeColor = 'ff7d0a';
	this.darkGrayColor = '888888';
	
	
	// INSTANCE VARS
	
	
	
	/*
	 * Methodology:
	 * TODO
	 */
	this.parse = function( wclEvent ) {
		var targetId = wclEvent.targetID;
		var spellId = wclEvent.ability.guid;
		
		switch( wclEvent.type ) {
			case 'cast' : // TODO all calcs on cast, specifically combo builders vs. Rip
				break;
			default :
				break;
		}
	}
	
	this.getResult = function() {
		var res = $('<div>', {"class":"panel panel-default"});
		
		var playerNameElement = $('<div>', {"class":"panel-heading"})
				.html(toColorHtml("<b>" + playerName + "</br>", this.druidOrangeColor))
				.appendTo(res);
		
		return res;
	}
	
}

