$(document).ready(function() {
	console.log("document ready!");
	
	// This is my (Sref's) public api key.
	// WCL documentation implies these are inteded for use with webapps, so this should be fine.
	var apiKey = "230d616c242ecbd6e2bfc07c4593d485";
	
	// init initial app elements: input for report code, and button to dispatch query
	$("<div>", {id: "report-div", "class": "form-inline"})
			.appendTo($("#app-container"));
			
	$("<input>", {id: "report-input", "class": "form-control", "placeholder": "Enter Report URL or ID..."})
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
		var reportCode = parseReportCode($("#report-input").val());
		console.log("reportCode=" + reportCode);
		
		// TODO instead implement the below as input validation?
		if(reportCode == null) {
			console.log( "this doesn't look like a report code" );
			$('<div>', {"class": "alert alert-danger"})
					.text("Input isn't a WCL report")
					.appendTo(fightsDiv);
			return;
		} else {
			// replaces full url with just report code in entry box for clarity
			$("#report-input").val(reportCode);
		}
		
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
					
			// add fights
			var includedFights = $(report.fights).filter(function() { return this.boss != 0; });
			if(includedFights.length == 0) {
				console.log("No boss fights, including all fights");
				includedFights = $(report.fights);
			}
			includedFights.each(function() {
				$("<option>")
						.text(formatFight(this))
						.data("fight", this) // attach fight object to option
						.appendTo(fightSelect);
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
	 * Detects either a pasted link or just a lone report code,
	 * and returns the report code. If input doesn't look like a report code, returns null.
	 */
	function parseReportCode( input ) {
		var wclUrlRegex = /warcraftlogs\.com\/reports\/([0-9a-zA-Z]*)/;
		var codeAloneRegex = /^([0-9a-zA-Z]+)$/;
		console.log("Matching entered report code vs regex: ");
		
		var wclUrlMatch = wclUrlRegex.exec(input);
		console.log(wclUrlMatch);
		if(wclUrlMatch != null) {
			return wclUrlMatch[1];
		}
		
		var codeAloneMatch = codeAloneRegex.exec(input);
		console.log(codeAloneMatch);
		if(codeAloneMatch != null) {
			return codeAloneMatch[1];
		}
		
		return null;
	}

	/*
	 * Entry function for analysis. Sets up data and then enters callback loop as data is fetched.
	 */
	function analyzeFight() {
		console.log("analyze button pressed");
		
		// remove previous analysis div
		$("#analysis-div").remove();
		
		// make new analysis div for generate content
		var analysisDiv = $("<div>", {id:"analysis-div"})
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
		var analyzer = new MasterAnalyzer( getPlayerNameMapping( reportData ),
				getEnemyNameMapping( reportData ), fightInfo );
		
		initProgressBar();
		
		// this enters callback loop as pages of data are sequentially fetched and analyzed
		// analyzers need data to be sequential, so we can't parallelize this without a lot of effort
		fetchPage( analyzer, fightInfo, reportCode, fightInfo.start_time, fightInfo.start_time, fightInfo.end_time );
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
	function fetchPage( analyzer, fightInfo, reportCode, startTime, currTime, endTime ) {
		var url = "https://www.warcraftlogs.com/v1/report/events/" + reportCode +
		    "?api_key=" + apiKey +
		    "&start=" + currTime +
		    "&end=" + endTime +
			"&actorclass=Druid"; // perf improvement as long as we only care about druid events
		//console.log("fetching event page json from " + url);
		
		var pageReq = $.getJSON(url)
		.done(function(data) {
			analyzePage( analyzer, fightInfo, data, reportCode, startTime, currTime, endTime );
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
	function analyzePage( analyzer, fightInfo, data, reportCode, startTime, currTime, endTime ) {
		updateProgressBar(startTime, currTime, endTime);
		
		var events = data.events;
		for (var i=0; i<events.length; i++) {
			analyzer.parse(events[i]);
		}
		
		if ("nextPageTimestamp" in data) {
			fetchPage(analyzer, fightInfo, reportCode, startTime, data.nextPageTimestamp, endTime);
		} else {
			analysisDone(analyzer, fightInfo);
		}
	}
	
	function analysisDone( analyzer, fightInfo ) {
		console.log("analysis done!");
		deleteProgressBar();
		
		var analysisTitleDiv = $('<div>', {"class":"panel panel-default"})
				.appendTo($("#analysis-div"));
		var analysisTitleHeader = $('<div>', {"class":"panel-heading text-center"})
				.html("<b>" + formatFight(fightInfo) + "</b>")
				.appendTo(analysisTitleDiv);
		
		var analysisRowDiv = $('<div>', {"class":"row"})
				.appendTo($("#analysis-div"));
		var analysisLeftColDiv = $('<div>', {"class":"col-sm-6"})
				.appendTo(analysisRowDiv);
		var analysisRightColDiv = $('<div>', {"class":"col-sm-6"})
				.appendTo(analysisRowDiv);
		
		var results = analyzer.getResults();
		for(var i=0; i<results.length; i++) {
			if(i%2 == 0) {
				results[i].appendTo(analysisLeftColDiv);
			} else {
				results[i].appendTo(analysisRightColDiv);
			}
		}
	}
	
	function getPlayerNameMapping( reportData ) {
		var playerNameMapping = new Map();
		
		for( friendly of reportData.friendlies ) {
			playerNameMapping.set(friendly.id, friendly.name);
		}
		
		console.log(playerNameMapping);
		return playerNameMapping;
	} 
	
	function getEnemyNameMapping( reportData ) {
		var enemyNameMapping = new Map();
		
		for( enemy of reportData.enemies ) {
			enemyNameMapping.set(enemy.id, enemy.name);
		}
		
		console.log(enemyNameMapping);
		return enemyNameMapping;
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
		//console.log($("#progress-bar").first());
		$("#progress-bar").attr("aria-valuenow", currPercent).attr("style", "width: " + currPercent + "%");
	}
	
	function deleteProgressBar() {
		$("#progress-container").remove();
	}

	function formatFight( fight ) { // expects 'fight' structure from array in report JSON
		console.log( JSON.stringify(fight) );
		stringResult = fight.name + " " + getDifficulty(fight) +
				" (" + formatTime(fight.end_time - fight.start_time) + ")";
		if (fight.boss == 0) {
			console.log(stringResult);
			return stringResult;
		}
		
		if( fight.kill ) {
			stringResult += " (KILL)";
		} else {
			var percent = Math.floor(fight.bossPercentage / 100);
			stringResult += " (WIPE @ " + percent + "%)";
		}
		console.log(stringResult);
		return stringResult;
	}
	
	function getDifficulty( fight ) {
		switch(fight.difficulty) {
			case 1:
				return "LFR";
				break;
			case 3:
				return "Normal";
				break;
			case 4:
				return "Heroic";
				break;
			case 5:
				return "Mythic";
				break;
			default:
				return "";
				break;
		}
	}

});
