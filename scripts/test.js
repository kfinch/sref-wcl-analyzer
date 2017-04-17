$(document).ready(function() {
	console.log("document ready!");
	
	var apiKey = "087783eb78c21061d028831d2344d118";
	
	$("#report-button").button().click(function() {
		console.log("report button pressed");
		
		// where fight info will be populated
		var fightDiv = $("#fight-div");
		fightDiv.empty();
		
		// get fights JSON
		var reportCode = $("#report-input").val();
		console.log("reportCode=" + reportCode);
		var url = "https://www.warcraftlogs.com/v1/report/fights/" + reportCode
	  		+ "?api_key=" + apiKey;
		console.log("fetching json from " + url);
		
		var reportReq = $.getJSON(url)
		.done(function(data) {
    			console.log( "success" );
			console.log( JSON.stringify(data) );
		
			// add fight select menu
			var fightSelect = $('<select>', {id: "fight-select"}).appendTo(fightDiv);
			fightSelect.addClass("form-control"); // bootstrap style
			$(data.fights).each(function() {
				if(this.boss != 0) { // bosses only
					var fightOption = $("<option>").text(formatFight(this));
					fightOption.attr("data-start", this.start_time);
					fightOption.attr("data-end", this.end_time);
					
 					fightSelect.append(fightOption);
				}
			});
			
			// add analyze button
			var analyzeButton = $('<button/>', {text: "Analyze", id: "analyze-button"});
			analyzeButton.addClass("btn btn-success");
			analyzeButton.appendTo(fightDiv);
			analyzeButton.button().click(handleAnalyzeButtonClick);
  		})
  		.fail(function() {
    			console.log( "error" );
  		});
		
	});

	function handleAnalyzeButtonClick() {
		var resultDiv = $("#result-div");
		resultDiv.empty();
		
		var selectedOption = $("#fight-select :selected")[0];
		console.log( selectedOption );
		resultDiv.append(selectedOption.data-start + " " + selectedOption.data-end);
		
	}
	
	function analyzeEach( analyzers, reportCode, startTime, endTime ) {
		
	}
	
	function getEventsPage( reportCode, startTime, endTime ) {
		var url = "https://www.warcraftlogs.com/v1/report/events/" + reportCode +
		    "?api_key=" + apiKey +
		    "&start=" + startTime +
		    "&end=" + endTime;
		
		var resultData;
		var pageReq = $.getJSON(url)
		.done(function(data) {
			resultData = data;
		})
		.fail(function() {
			
		});
		return resultData;
	}
	
	function formatFight( fight ) { // expects 'fight' structure from array in report JSON
		console.log( JSON.stringify(fight) );
		stringResult = "";
		stringResult += fight.name + " (" + formatFightTime(fight) + ")";
		if( fight.kill ) {
			stringResult += " (KILL)";
		} else {
			var percent = Math.floor(fight.bossPercentage / 100);
			stringResult += " (WIPE @ " + percent + "%)";
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
