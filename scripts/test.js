$(document).ready(function() {
	console.log("document ready!");
	
	$("#report-button").button().click(function() {
		console.log("report button pressed");
		
		// get fights JSON
		var reportCode = $("#report-input").val();
		console.log("reportCode=" + reportCode);
		var apiKey = "087783eb78c21061d028831d2344d118";
		var url = "https://www.warcraftlogs.com/v1/report/fights/" + reportCode
	  		+ "?api_key=" + apiKey;
		console.log("fetching json from " + url);
		
		var reportReq = $.getJSON(url)
		.done(function(data) {
    			console.log( "success" );
			console.log( JSON.stringify(data) );
		
			var fightSelect = $('<select>').appendTo("#fight-div");
			fightSelect.addClass("form-control"); // bootstrap style
			$(data.fights).each(function() {
 				fightSelect.append($("<option>").text(formatFight(this)));
			});
  		})
  		.fail(function() {
    			console.log( "error" );
  		});
		
	});
	
	function formatFight( fight ) { // expects 'fight' structure from array in report JSON
		console.log( JSON.stringify(fight) );
		stringResult = "";
		stringResult += fight.name + " (" + formatFightTime(fight.end_time - fight.start_time) + ")";
		if( fight.boss != 0 ) {
			stringResult += " (BOSS)";
		}
		console.log(stringResult);
		return stringResult;
	}
	
	function formatFightTime( totalSeconds ) {
		var minutes = Math.floor(totalSeconds / 60);
		var seconds = totalSeconds - (minutes*60);
		
		var result = "" + minutes + ":";
		if(seconds < 10) {
			result += "0";
		}
		result += seconds;
		return result;
	}

});
