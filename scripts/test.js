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
		stringResult += fight.name + " (" + formatFightTime(fight) + ")";
		if( fight.boss != 0 ) {
			stringResult += " (BOSS";
			if( fight.kill ) {
				stringResult += " KILL)";
			} else {
				var percent = Math.floor(fight.bossPercentage / 100);
				stringResult += " WIPE @" + percent + "%)";
			}
		}
		console.log(stringResult);
		return stringResult;
	}
	
	function formatFightTime( fight ) {
		var fightInSeconds = Math.floor((fight.end_time - fight.start_time) / 1000);
		
		var minutes = Math.floor(fightInSeconds / 60);
		var seconds = fightInSeconds - (minutes*60);
		
		var result = "" + minutes + ":";
		if(seconds < 10) {
			result += "0";
		}
		result += seconds;
		return result;
	}

});
