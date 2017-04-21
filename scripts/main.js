$(document).ready(function() {
	console.log("document ready!");
	
	var apiKey = "087783eb78c21061d028831d2344d118";
	
	// init initial app elements: input for report code, and button to dispatch query
	$("<div>", {id: "report-div", "class": "form-inline"})
			.appendTo($("#app-container"));
			
	$("<input>", {id: "report-input", "class": "form-control", "placeholder": "Report Code..."})
			.appendTo($("#report-div"));
			
	$("<button>", {id: "report-button", "class": "btn btn-primary"})
			.text("Get")
			.click(getReport)
			.appendTo($("#report-div"));
			
	$('<br>').appendTo($("#app-container"));
	
	/**
	 * Called when the 'Get' button is pressed for a report
	 */
	function getReport() {
		console.log("report button pressed");
		
		// remove previous fights div
		$("#fights-div").remove();
		
		// make new fights div for generate content
		var fightsDiv = $("<div>", {id: "fights-div", "class": "form-inline"})
				.appendTo($("#app-container"));
		
		// get fights JSON
		var reportCode = $("#report-input").val();
		console.log("reportCode=" + reportCode);
		var url = "https://www.warcraftlogs.com/v1/report/fights/" + reportCode
	  		+ "?api_key=" + apiKey;
		console.log("fetching report json from " + url);
		
		var reportReq = $.getJSON(url)
		.done(function(report) {
			console.log( JSON.stringify(report) );
		
			// add fight select menu
			var fightSelect = $('<select>', {id: "fight-select", "class": "form-control"})
					.data("reportCode", reportCode) // for retrieve at analysis time
					.data("reportData", report)
					.appendTo(fightsDiv);
			$(report.fights).each(function() {
				if(this.boss != 0) { // bosses only
					$("<option>")
							.text(formatFight(this))
							.data("fight", this) // attach fight object to option
							.appendTo(fightSelect);
				}
			});
			
			// add analyze button
			$('<button/>', {id: "analyze-button", "class": "btn btn-success"})
					.text("Analyze")
					.click(analyzeFight)
					.appendTo(fightsDiv);
  		})
  		.fail(function(errReport) { // bad report code returns an error message, which we'll pass to the user
    			console.log( "error fetching report json..." );
				console.log( JSON.stringify(errReport) );
				$('<div>', {"class": "alert alert-danger"})
						.text("ERROR: " + errReport.responseJSON.error)
						.appendTo(fightsDiv);
  		});
	}

	/*
	 * Entry function for analysis. Sets up data and then enters callback loop as data is fetched.
	 */
	function analyzeFight() {
		console.log("analyze button pressed");
		
		// remove previous analysis div
		$("#analysis-div").remove();
		
		// make new analysis div for generate content
		var analysisDiv = $("<div>", {id: "analysis-div"})
				.appendTo($("#fights-div"));
		$('<br>').appendTo($("#analysis-div"));
		
		var selectedOption = $("#fight-select :selected").first();
		var fightInfo = selectedOption.data("fight");
		
		// retrieve report code and report data
		var reportCode = $("#fight-select").data("reportCode");
		var reportData = $("#fight-select").data("reportData");
		
		console.log( selectedOption );
		console.log( JSON.stringify(selectedOption.data("fight")) );
		
		// init analyzer
		var analyzer = new MasterAnalyzer( getPlayerNameMapping( reportData ) );
		
		initProgressBar();
		
		// this enters callback loop as pages of data are sequentially fetched and analyzed
		// analyzers need data to be sequential, so we can't parallelize this without a lot of effort
		fetchPage( analyzer, reportCode, fightInfo.start_time, fightInfo.start_time, fightInfo.end_time );
	}
	
	/*
	 * fetchPage() and analyzePage() functions loops to perform the fight analysis.
	 * Fetches are async but data must be analyzed sequentially, hence the loop.
	 * As a side effect also creates and displays a progress bar in the analysis-div
	 *
	 * analyzer - an 'analyzer' object, which must have:
	 *			a parse(WCLEvent) function
	 *			and a getResults() function that returns an array of jQuery HTML objs displaying results
	 * data - a page of data
	 * reportCode - the WCL report code
	 * startTime - millis since start of report to start analysis at
	 * currTime - millis since start of report analysis is currently at. Used to req next page.
	 * endTime - millis since start of report to end analysis at
	 *
	 * As a side effect, this function also creates an updates a progress bar in results-div
	 */
	
	/*
	 * Fetches page of data, hands it off to analyzePage()
	 */
	function fetchPage( analyzer, reportCode, startTime, currTime, endTime ) {
		var url = "https://www.warcraftlogs.com/v1/report/events/" + reportCode +
		    "?api_key=" + apiKey +
		    "&start=" + currTime +
		    "&end=" + endTime;
		console.log("fetching event page json from " + url);
		
		var pageReq = $.getJSON(url)
		.done(function(data) {
			analyzePage( analyzer, data, reportCode, startTime, currTime, endTime );
		})
		.fail(function() {
			deleteProgressBar();
			console.log( "error fetching fight json..." );
			$('<div>', {"class": "alert alert-danger"})
					.text("ERROR fetching fight data!")
					.appendTo($("#analysis-div"));
		});
		
	}
	
	/*
	 * Analyzes a page of data. If there's more, gets next with fetchPage(). If not calls analysisDone().
	 */
	function analyzePage( analyzer, data, reportCode, startTime, currTime, endTime ) {
		updateProgressBar(startTime, currTime, endTime);
		
		var events = data.events;
		for (var i=0; i<events.length; i++) {
			analyzer.parse(events[i]);
		}
		
		if ("nextPageTimestamp" in data) {
			fetchPage(analyzer, reportCode, startTime, data.nextPageTimestamp, endTime);
		} else {
			analysisDone(analyzer);
		}
	}
	
	function analysisDone( analyzer ) {
		console.log("analysis done!");
		deleteProgressBar();
		var results = analyzer.getResults();
		for(var i=0; i<results.length; i++) {
			results[i].appendTo($("#analysis-div"));
		}
	}
	
	function getPlayerNameMapping( reportData ) {
		var playerNameMapping = new Map();
		
		for( friendly of reportData.friendlies ) {
			playerNameMapping.set(friendly.id, friendly.name);
		}
		
		return playerNameMapping;
	} 
	
	/*
	 * Progress Bar handling functions
	 */
	
	function initProgressBar() {
		var progressContainer  = $('<div>', {id:"progress-container", "class":"progress"})
				.appendTo($("#analysis-div"));
		
		$('<div>', {id:"progress-bar", "class":"progress-bar progress-bar-striped", "role":"progressbar",
				"aria-valuenow":"0", "aria-valuemin":"0", "aria-valuemax":"100", "style":"width: 0%"})
				.appendTo(progressContainer);
	}
	
	function updateProgressBar( startTime, currTime, endTime ) {
		var totalTimeInFight = endTime - startTime;
		var currTimeInFight = currTime - startTime;
		var currPercent = Math.round(currTimeInFight / totalTimeInFight * 100);
		console.log($("#progress-bar").first());
		$("#progress-bar").attr("aria-valuenow", currPercent).attr("style", "width: " + currPercent + "%");
	}
	
	function deleteProgressBar() {
		$("#progress-container").remove();
	}

	
	// Utils below, TODO move to utils.js file?
	
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
