(function() {
 
    var app = Sammy('#app-container');
 
    $(document).ready(function() {
        app.run('#/');
    });
	
	// route for apps initial state, ready to get a report code
	app.get('#/', function() {
        console.log("Loading Initial route...");
    });
	
	// route for when a fight is selected
	app.get('#/reportCode=:reportId&fight=:encounterNum', function() {
		console.log("Loading Encounter route w/ reportID=" + this.params['reportId'] +
				" encounterNum=" + this.params['encounterNum']);
	});
	
	// route for app after report code has been entered, but before a fight selected
	app.get('#/reportCode=:reportId', function() {
		console.log("Loading Report route w/ reportID=" + this.params['reportId']);
	});
 
})();