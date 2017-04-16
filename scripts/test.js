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
  		})
  		.fail(function() {
    			console.log( "error" );
  		});
		
	});

});
