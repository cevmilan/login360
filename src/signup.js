/*
	Login360 signup routes

	/signup/
	/signup/verifymail

*/

const express = require('express');
const libstore = require('./store.js');
const libusers = require('./users.js');


module.exports = mountSignup;


// mountSignup( cfg, halt ): expressRouter
function mountSignup( cfg, halt ) {

	const pending = libstore.start('pending');
	const users = libstore.start('users');

	const router = express.Router();


	/*
	signup:json { email: string, passwd: string }
	res:json { error: string | id: string }
	- password is not hashed  (can be if uniform)
	- send e-mail with secret link to finish sign-up
	- save sing-up in "pending" table
	- return mailgun message id
	*/
	router.post('/', (req, res, next) => {

		const email = req.body.email || '';
		const passwd = req.body.passwd || '';
		const minl = cfg.minLength;
		if (passwd.length < minl || email.length < minl) {
			return halt(res, 'Invalid values');
		}
		if ( !libusers.validEmail(email) ) {
			return halt(res, 'Invalid e-mail: '+ email);
		}

		const uname = email; // set == or app can have separate

		if (pending.exists(uname) || users.exists(uname)) {
			return halt(res, 'Username exists: '+ uname);
		}
		// todo! we can clear all pending for this username?

		console.log('/signup/ '+ email);

		const hpass = libusers.getHash(cfg, passwd);
		const tnow = (new Date).getTime();
		const secret = libusers.getHash(cfg, email + tnow);
		const newrow = {
			email: email,
			uname: uname,
			passwd: hpass,
			secret: secret,
			created: tnow
		};
		const [err2, newid] = pending.insert(newrow);
		if (err2) {
			return halt(res, err2, 500);
		}

		// url for link in e-mail
		const cburl = cfg.targetUrl + secret;

		const send = libusers.signupSendEmail(cfg, email, cburl);
		send.then((result) => {
			console.log('e-mail sent.');
			res.send({ id: result.id });
		});
		send.catch((err) => {
			console.log('Send e-mail failed');
			console.log(err);
			res.status(500).send({ error: 'Send e-mail failed' });
		});
	});


	/*
	verfymail:json { verify: string }
	res:json { error: string | auth: string }
	- from e-mail click GET ? -> POST finish sign-up
	*/
	router.post('/verifymail', (req, res) => {

		const verify = req.body.verify || '';
		if (verify.length !== 64) { // sha-256
			return halt(res, 'Invalid value');
		}
		const [err1, current] = pending.current(verify, 'secret');
		if (err1) {
			return halt(res, 'Verification not found');
		}
		const ok = libusers.signupContinue(current, cfg.verifyTimeout);
		if ( !ok ) {
			return halt(res, 'Timeout for '+ current.uname);
		}
		if (users.exists(current.uname)) {
			return halt(res, 'Username exists: '+ uname);
		}

		console.log('/signup/verifymail for '+ current.uname);

		const [err4] = pending.remove(current.id);
		if (err4) {
			return halt(res, err4, 500);
		}

		const newuser = {
			email: current.email,
			uname: current.uname,
			passwd: current.passwd,
			auth: ''
		};
		const [err2, newid] = users.insert(newuser);
		if (err2) {
			return halt(res, err2, 500);
		}

		const [err3, auth] = libusers.doLogin(cfg, users, newid);
		if (err3) {
			return halt(res, err3, 500);
		}

		res.send({ auth });
	});

	return router;
}
