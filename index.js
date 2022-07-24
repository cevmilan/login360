/*
	Login360 service

*/

const dotenv = require('dotenv');
const { mount, configure } = require('./src/app.js');


//
main();

function main() {

	dotenv.config(); // import .env

	const cfg = configure();
	if ( !cfg ) {
		console.log('Invalid configuration');
		return;
	}

	const app = mount(cfg);

	app.listen(cfg.port, (err) => {
		console.log('Login360 server port: '+ cfg.port);
		if (err) {
			console.log(err);
		}
	});
}
