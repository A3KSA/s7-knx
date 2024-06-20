// Express
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');


function expressServer(datapointService) {
	app.get("/", (req, res) => {
        const filePath = path.join(__dirname, '../../public', 'index.html'); // Adjust the file path as needed
        res.sendFile(filePath, (err) => {
          if (err) {
            res.status(500).send('File not found');
          }
        });
	});

	app.get("/datapoint", (req, res) => {
        const objects = datapointService.getDatapoint();
		if (objects.length > 0) {
			
			res.send(objects);
		} else {
			res.send("No data available");
		}
	});

	app.get("/datapoint/:id", (req, res) => {
		const id = req.params.id;
        const object = datapointService.getDatapointById();
		res.send(object);
	});


	app.listen(port, () => {
		console.log(`Listening on port ${port}`);
	});
}

module.exports = expressServer;