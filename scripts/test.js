$(document).ready(function(){
    alert("jQuery works!");
	
    $("#fight-button").button().click(function(){
        alert("button");
    });    

});



function getFights() {
	// make menu
	var menuDiv = document.getElementById('menu-div'); 
	var fightList = document.createElement("select");
	fightList.id = "fight-list";
	menuDiv.appendChild(fightList);

	// get fights JSON
	var apiKey = "087783eb78c21061d028831d2344d118"
	var url = "https://www.warcraftlogs.com/v1/report/fights/" + reportCode
	  + "?api_key=" + apiKey
	var reportObj = JSON.parse(getJson(url));

	// test
	var fightString = reportObj.fights;
	menuDiv.innerHTML = fightString[0];

	// populate menu with fight names
	var fights = reportObj.fights;
	for (var i = 0; i < fights.length; i++) {
	  var option = document.createElement("option");
	  option.value = fights[i].name;
	  option.text = fights[i].name;
	  fightList.appendChild(option);
	}
}

function getJson(yourUrl) {
	var Httpreq = new XMLHttpRequest(); // a new request
	Httpreq.open("GET",yourUrl,false);
	Httpreq.send(null);
	return Httpreq.responseText;          
}
