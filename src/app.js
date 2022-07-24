/*
	Login360 service routes

	/login
	/logout
	/changepass
	/signup/**
	/twofactor/**

*/

const express = require('express');
const bodyParser = require('body-parser');
const mountSignup = require('./signup.js');
const mount2FA = require('./twofactor.js');
const libstore = require('./store.js');
const libusers = require('./users.js');


module.exports = { mount, configure };


// mount( cfg ): expressApp -set routes
function mount( cfg ) {

	const pending = libstore.start('pending');
	const users = libstore.start('users');
	// pending sign-up and users tables

	const app = express();

	// expecting only POST:json requests
	app.use(bodyParser.json());


	// save url -used in halt as line prefix
	app.use((req, res, next) => {

		res.locals.url = req.originalUrl;
		next();
	});


	// exceptions -respond only with generic message
	app.use((err, req, res, next) => {

		if (res.headersSent) {
			next('Server error!');
		}
		console.log('Server error!');
		console.log(err);
		res.status(500).send({error: 'Server error!'});
	});


	app.use('/signup', mountSignup(cfg, halt));

	if (cfg.otpSeed) { // empty==disable
		app.use('/twofactor', mount2FA(cfg, halt));
	}


	// testing !!! view data
	app.get('/view', (req, res) => {

		res.send([ users.rows, [], pending.rows ]);
	});


	/*
	changepass:json { uname: string, oldpass: string, newpass: string, auth: string }
	res:json { error: string | done=1 }
	- set new pass
	- old and new not hashed (can be if uniform)
	- uname is requred (others can have equal password)
	*/
	app.post('/changepass', (req, res) => {

		const auth = req.body.auth || '';
		const id = libusers.validAuth(users, auth);
		if ( !id ) {
			return halt(res, 'Required auth');
		}

		const minl = cfg.minLength;
		const uname = req.body.uname || '';
		const oldpass = req.body.oldpass || '';
		const newpass = req.body.newpass || '';
		if (uname.length < minl || oldpass.length < minl || newpass.length < minl) {
			return halt(res, 'Invalid values');
		}

		const [err1, user] = users.current(uname, 'uname');
		if (err1) {
			return halt(res, 'Not found '+ uname);
		}
		const oldhash = libusers.getHash(cfg, oldpass);
		const hpass = libusers.getHash(cfg, newpass);
		if (oldhash !== user.passwd) {
			return halt(res, 'Invalid password '+uname);
		}

		console.log('/changepass for '+ uname);

		const [err2] = users.update(user.id, { passwd: hpass });
		if (err2) {
			return halt(res, err, 500);
		}
		res.send({ done:1 });
	});


	/*
	login:json { passwd: string, uname: string }
	res:json { error: string | auth: string }
	- by username and password, set auth
	- passwd is not hashed (can be if uniform)
	- in this app, uname == email
	*/
	app.post('/login', (req, res) => {

		const passwd = req.body.passwd || '';
		const uname = req.body.uname || '';
		const minl = cfg.minLength;
		if (passwd.length < minl || uname.length < minl) {
			return halt(res, 'Invalid values');
		}

		const [err, current] = users.current(uname, 'uname');
		if (err) {
			return halt(res, err);
		}
		if (current.auth) {
			console.log('Warning! Login is active: '+ uname); // halt ?
		}

		console.log('/login id '+ current.id +' '+ uname);

		const [err2, auth] = libusers.doLogin(cfg, users, current.id);
		if (err2) {
			return halt(res, err2, 500);
		}
		res.send({ auth });
	});


	/*
	logout:json { auth: string } - terminate auth
	res:json { error: string | done=1 }
	*/
	app.post('/logout', (req, res) => {

		const auth = req.body.auth || '';
		const id = libusers.validAuth(users, auth);
		if ( !id ) {
			return halt(res, 'Required auth');
		}

		console.log('/logout id '+id);

		const [err] = users.update(id, {auth: ''});
		if (err) {
			return halt(res, err, 500);
		}
		res.send({ done:1 });
	});

	return app;
}


// halt( res, err, code=400 ): void
// not-happy path in handlers, console, send error
function halt( res, err, code ) {

	console.log(res.locals.url +' Error! '+ err);
	res.status(code || 400).send({error: err});
}


// configure(): cfg?
// after dotenv -build, validate and return cfg
function configure() {

	const cfg = {
		twilioSid: process.env.TWILIOSID,
		twilioToken: process.env.TWILIOTOKEN,
		twilioPhone: process.env.TWILIOPHONE,
		mailFrom: process.env.MAILFROM,
		mgKey: process.env.MGKEY,
		mgDomain: process.env.MGDOMAIN,
		//mgUrl: process.env.MGURL,
		targetUrl: process.env.TARGETURL,
		salt: process.env.SALT,
		otpSeed: process.env.OTPSEED,
		otpTimeout: process.env.OTPTIMEOUT || 60,
		minLength: process.env.MINLENGTH || 5,
		verifyTimeout: process.env.VERIFYTIMEOUT || 3600,
		port: process.env.PORT || 9999
	};

	const bad = (
		!cfg.twilioPhone || !cfg.twilioSid || !cfg.twilioToken || !cfg.mailFrom ||
		!cfg.salt || !cfg.targetUrl || !cfg.mgKey || !cfg.mgDomain ||
		(cfg.otpSeed && cfg.otpSeed !== cfg.otpSeed.replace(/[^2-7A-Z=]+/g, ''))
	);

	return bad ? null : cfg;
}
