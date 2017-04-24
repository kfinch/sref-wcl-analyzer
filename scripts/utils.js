
/*
 * Given a duration in millis, returns a formatted string of that time in minutes and seconds.
 */
function formatTime( timeInMillis ) {
	var totalSeconds = Math.floor(timeInMillis / 1000);
	
	var minutes = Math.floor(totalSeconds / 60);
	var seconds = totalSeconds - (minutes*60);
	
	var result = "" + minutes + ":";
	if(seconds < 10) {
		result += "0";
	}
	result += seconds;
	return result;
}

/*
 * Returns num rounded to given number of decimal places.
 * If you want to round to whole number, faster to use Math.round()...
 */
function roundTo( num, places ) {
	var mult = Math.pow(10, places);
	return Math.round(num * mult) / mult;
}

/*
 * Given html, wraps it in font tag to turn it given color
 */
function toColorHtml( html, hexColor) {
	return '<font color="#' + hexColor + '">' +
			html + '</font>';
}

/*
 * Given a WoW spell's ID and name, builds a wowhead link to it
 */
function getSpellLinkHtml( spellId, spellName) {
	return '<a href="http://www.wowhead.com/spell=' + spellId + '">' + spellName + '</a>';
}