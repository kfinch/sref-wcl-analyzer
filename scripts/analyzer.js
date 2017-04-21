
function TestAnalyzer () {
	this.eventsSeen = 0;
	
	this.parse = function() {
		this.eventsSeen++;
	}
	
	this.getResults = function() {
		var results = [];
		
		var testRes = $('<div>', {"class": "well well-sm"})
				.text("test results: I saw " + this.eventsSeen + " events!");
		results.push(testRes);
			
		return results;
	}	
}

/*
function RestoDruidSpellMasteryAnalyzer () {
	this.
}
*/
