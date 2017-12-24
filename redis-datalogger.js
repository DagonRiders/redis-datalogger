var fs = require('fs'); // File system library, for writing data to files
var redis = require('redis'); // Redis library, needed for getting stuff from redis
var mkdirp = require('mkdirp'); // easy creating of new folders

// Globals
var REDISSERVER = '10.0.0.5';
var FILEPATH = 'D:/';

// Returns the correct folder for the current month
function getFolderPath() {
	return FILEPATH + "datalog/" + (new Date()).getFullYear() +"/" + (new Date()).getMonth() + "/";
}

// Returns the correct file for the current day
function getFilePath() {
	return getFolderPath() + (new Date()).getDate() + ".csv";
}

// Creates a new folder with a location based on the current month
function makeFolder() {
	console.log("Making " + getFolderPath())
	mkdirp(getFolderPath(), function(err) {
		if (err) throw err; // If there's an error stop and show the message
		console.log("Folder created");
	});
}

// Creates a new file with a filename/location based on the current date
function makeFile(sensors) {
	var fileHeader = "Date,"
	sensors.forEach(function(sensor) 
	{ 
		fileHeader += sensor.name + " (" + sensor.unit + "),";
	});
	fileHeader += "\n"
	fs.writeFile(getFilePath(), fileHeader, function(err) {  
		if (err) throw err; // If there's an error stop and show the message

		console.log("Header Written");
	});
}

// Adds a row to a CSV file based on the current values of sensors
function writeRow(sensors, sensorValues) {
	// Get a list of the values in the correct order
	var values = []
	sensors.forEach(function (sensor) {
		values.push(sensorValues[sensor.sensorID]);
	});

	// Make our new CSV format row
	// NB: date must be in quotes as it contains a comma!
	var newrow = "\"" + (new Date()).toISOString() + "\"," + values.join() + "\n";
	
	// Write the new row into the file
	console.log("Adding: " + newrow);
	fs.appendFile(getFilePath(), newrow, function(err) { if (err) throw err; });
}

function getData() {
	console.log("Running data fetch");

	// Get the list of sensors out of Redis
	redisConnect.get("sensors", function(err,reply) {
		var sensors = JSON.parse(reply);
		console.log(sensors);

		// Make the folder for this month if we need to
		if (!fs.existsSync(getFolderPath())) {
			makeFolder();
		}
		else
		{
			// Make the file for today if we need to
			if (!fs.existsSync(getFilePath())) {
				// If the file for today doesn't exist create it and write the header line
				makeFile(sensors);
			};

			var received = 0; // Keep track of how much data we've got back
			var sensorValues = {}; // An object to store the data we received

			// Write sensor data to the file
			sensors.forEach(function(sensor) { 
				// Go through everything in the sensors json object
				redisConnect.get("sensor." + sensor.sensorID,function(err,reply) {
					if (err) throw err; // If there's an error stop and show the message
					sensorValues[sensor.sensorID] = parseFloat(reply).toFixed(1);
					console.log(sensor.name + ": " + sensorValues[sensor.sensorID] + " " + sensor.unit);
					
					received++;
					if (received == sensors.length) {
						// We've now got all the data
						writeRow(sensors, sensorValues);
					}
				});
			});
		}
	});
}

// Connect to a redis server
var redisConnect = redis.createClient({host : REDISSERVER, port : 6379}); // If no server data will assume local host and weird in windows

// If there is a problem with redis put an error message
redisConnect.on('error',function() { console.log("Error in Redis"); }); 

getData();

// setInterval(getData, 1000 * 60 * 5);
// This needs fixing long term so it doesn't need windows task scheduler