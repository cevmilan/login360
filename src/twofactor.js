/*
	Login360 twofactor routes

	/twofactor/
	/twofactor/entercode

*/

const express = require('express');
const libstore = require('./store.js');
const libusers = require('./users.js');


module.exports = mount2FA;


// mount2FA( cfg, halt ): expressRouter
function mount2FA( cfg, halt ) {

	const users = libstore.open('users');

	const router = express.Router();


	/*
	login:json { passwd: string, uname: string, phone: string } -start 2FA login
	res:json { error: string | id: string }
	- phone is optional and can be [0-9\+]+ only
	- reuse old phone value for user or required if first
	- passwd is not hashed (can be if uniform)
	- in this app, uname == email
	- return twilio sms sid
	*/
	router.post('/', (req, res, next) => {

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

		let phone = (req.body.phone || '').replace(/[^0-9\+]+/g, '');
		if ( !phone ) {
			phone = current.phone;
		}
		if ( !phone || phone.length < 9 ) {
			return halt(res, 'Invalid phone number');
		}

		console.log('/twofactor for '+uname);

		const [err2, auth] = libusers.doLogin(cfg, users, current.id);
		if (err2) {
			return halt(res, err2, 500);
		}
		// save phone, prepare auth (real login is after /entercode)
		const [err3] = users.update(current.id, {preauth: auth, auth: '', phone});
		if (err3) {
			return halt(res, err3, 500);
		}

		const otp = libusers.twofactorGetCode(cfg, uname);

		const send = libusers.twofactorSendSMS(cfg, phone, otp);
		send.then((result) => {
			console.log('sms sent.');
			res.send({ id: result.sid });
		});
		send.catch((err) => {
			console.log('Send sms failed');
			console.log(err);
			res.status(500).send({ error: 'Send sms failed' });
		});
	});


	/*
	enter:json { uname: string, otp: string } -finish 2FA login
	res:json { error: string | auth: string }
	*/
	router.post('/entercode', (req, res) => {

		const uname = req.body.uname || '';
		const minl = cfg.minLength;
		if (uname.length < minl) {
			return halt(res, 'Invalid username');
		}
		const otp = req.body.otp || '';
		if (otp.length !== 6 || otp !== otp.replace(/[^0-9]+/g, '')) {
			return halt(res, 'One-time code must be 6 digits');
		}

		const [err, current] = users.current(uname, 'uname');
		if (err) {
			return halt(res, err);
		}
		if (current.auth) {
			console.log('Warning! Login is active: '+ uname); // halt ?
		}
		if ( !current.preauth ) {
			return halt(res, 'Missing preauth');
		}

		// must be same before timeout
		const otp2 = libusers.twofactorGetCode(cfg, uname);
		if (otp !== otp2) {
			return halt(res, 'One-time code is invalid');
		}

		console.log('/twofactor/entercode for '+ uname);

		const auth = current.preauth; // now issue auth
		const [err2] = users.update(current.id, {preauth: '', auth});
		if (err2) {
			return halt(res, err2, 500);
		}

		res.send({ auth });
	});


	return router;
}
